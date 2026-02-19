import { eq } from 'drizzle-orm';
import { db, schema } from './db';
import { config } from './config';

const REGION_CONTEXT: Record<string, string> = {
  jp: 'Japanese',
  us: 'American',
  ph: 'Philippine',
  tw: 'Taiwanese',
};

function buildSystemPrompt(regionId?: string, categorySlug?: string): string {
  const regionAdj = regionId ? (REGION_CONTEXT[regionId] ?? '') : '';
  const categoryContext = categorySlug ? ` specializing in ${categorySlug}` : '';

  return `You are a${regionAdj ? ` ${regionAdj}` : 'n international'} media analyst${categoryContext}. Given an article (which may be in any language), produce a structured JSON analysis.

IMPORTANT: ALL output must be in English. If the article is not in English, translate your analysis into English.

Respond with ONLY valid JSON in this exact format:
{
  "tldr": "A single-sentence summary of the article in English (max 280 characters)",
  "bullets": ["Key point 1 in English", "Key point 2 in English", "Key point 3 in English"],
  "tags": ["tag1", "tag2", "tag3"],
  "sentiment": "positive|negative|neutral|mixed|bullish|bearish|restrictive|permissive",
  "sentiment_reasoning": "Brief explanation of why this sentiment was chosen, in English",
  "category": "politics|news|tech|government|underreported|law|economics"
}

Rules:
- ALL fields must be in English, even if the source article is in another language
- tldr: One sentence, max 280 characters
- bullets: 3-5 key points
- tags: 2-5 lowercase tags relevant to the content
- sentiment: Must be exactly one of: positive, negative, neutral, mixed, bullish, bearish, restrictive, permissive
- sentiment_reasoning: 1-2 sentences explaining the sentiment choice
- category: Must be exactly one of: politics, news, tech, government, underreported, law, economics. Choose based on the primary topic of the article.`;
}

const MAX_RETRIES = 3;

const VALID_CATEGORIES = ['politics', 'news', 'tech', 'government', 'underreported', 'law', 'economics'] as const;

interface SummaryResult {
  tldr: string;
  bullets: string[];
  tags: string[];
  sentiment: string;
  sentiment_reasoning: string;
  category: string;
}

function parseSummaryResponse(content: string): SummaryResult {
  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed.tldr || !parsed.bullets || !parsed.tags || !parsed.sentiment || !parsed.sentiment_reasoning) {
    throw new Error('Summary response missing required fields');
  }

  const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'news';

  return {
    tldr: String(parsed.tldr),
    bullets: parsed.bullets.map(String),
    tags: parsed.tags.map(String),
    sentiment: parsed.sentiment,
    sentiment_reasoning: parsed.sentiment_reasoning,
    category,
  };
}

export async function summarizeArticle(articleId: number): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, articleId),
    with: { feed: { with: { category: true } } },
  });
  if (!article) throw new Error(`Article ${articleId} not found`);

  const content = article.translatedContent || article.originalContent;
  const title = article.translatedTitle || article.originalTitle;
  if (!content) {
    throw new Error(`Article ${articleId} has no content`);
  }

  await db
    .update(schema.articles)
    .set({ summaryStatus: 'summarizing', updatedAt: new Date() })
    .where(eq(schema.articles.id, articleId));

  const regionId = article.feed?.regionId;
  const categorySlug = article.feed?.category?.slug;
  const systemPrompt = buildSystemPrompt(regionId, categorySlug);

  const articleText = `Title: ${title}\n\n${content}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${config.openrouter.url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openrouter.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openrouter.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: articleText },
          ],
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`OpenRouter summarize failed: ${res.status} ${detail}`);
      }

      const data = await res.json();
      const responseContent = data.choices?.[0]?.message?.content?.trim();
      if (!responseContent) throw new Error('Summarization returned empty response');

      const summary = parseSummaryResponse(responseContent);

      await db
        .update(schema.articles)
        .set({
          summaryTldr: summary.tldr,
          summaryBullets: summary.bullets,
          summaryTags: summary.tags,
          summarySentiment: summary.sentiment,
          summaryCategory: summary.category,
          summaryStatus: 'complete',
          summaryError: null,
          summarizedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.articles.id, articleId));

      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // All retries exhausted
  await db
    .update(schema.articles)
    .set({
      summaryStatus: 'error',
      summaryError: lastError?.message ?? 'Unknown summarization error',
      updatedAt: new Date(),
    })
    .where(eq(schema.articles.id, articleId));
}
