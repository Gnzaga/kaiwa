import { eq } from 'drizzle-orm';
import { db, schema } from './db';
import { config } from './config';

const SYSTEM_PROMPT = `You are a Japanese media analyst specializing in law and economics. Given a translated article, produce a structured JSON analysis.

Respond with ONLY valid JSON in this exact format:
{
  "tldr": "A single-sentence summary of the article (max 280 characters)",
  "bullets": ["Key point 1", "Key point 2", "Key point 3"],
  "tags": ["tag1", "tag2", "tag3"],
  "sentiment": "bullish|bearish|neutral|restrictive|permissive",
  "sentiment_reasoning": "Brief explanation of why this sentiment was chosen"
}

Rules:
- tldr: One sentence, max 280 characters
- bullets: 3-5 key points
- tags: 2-5 lowercase tags relevant to the content
- sentiment: Must be exactly one of: bullish, bearish, neutral, restrictive, permissive
- sentiment_reasoning: 1-2 sentences explaining the sentiment choice`;

const MAX_RETRIES = 3;

interface SummaryResult {
  tldr: string;
  bullets: string[];
  tags: string[];
  sentiment: string;
  sentiment_reasoning: string;
}

function parseSummaryResponse(content: string): SummaryResult {
  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!parsed.tldr || !parsed.bullets || !parsed.tags || !parsed.sentiment || !parsed.sentiment_reasoning) {
    throw new Error('Summary response missing required fields');
  }

  return {
    tldr: String(parsed.tldr),
    bullets: parsed.bullets.map(String),
    tags: parsed.tags.map(String),
    sentiment: parsed.sentiment,
    sentiment_reasoning: parsed.sentiment_reasoning,
  };
}

export async function summarizeArticle(articleId: number): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, articleId),
  });
  if (!article) throw new Error(`Article ${articleId} not found`);
  if (!article.translatedContent) {
    throw new Error(`Article ${articleId} has no translation`);
  }

  await db
    .update(schema.articles)
    .set({ summaryStatus: 'summarizing', updatedAt: new Date() })
    .where(eq(schema.articles.id, articleId));

  const articleText = `Title: ${article.translatedTitle}\n\n${article.translatedContent}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${config.openwebui.url}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openwebui.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openwebui.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: articleText },
          ],
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`OpenWebUI summarize failed: ${res.status} ${detail}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('Summarization returned empty response');

      const summary = parseSummaryResponse(content);

      await db
        .update(schema.articles)
        .set({
          summaryTldr: summary.tldr,
          summaryBullets: summary.bullets,
          summaryTags: summary.tags,
          summarySentiment: summary.sentiment as typeof article.summarySentiment,
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
