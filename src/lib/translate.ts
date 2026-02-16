import { eq } from 'drizzle-orm';
import { db, schema } from './db';
import * as libre from './providers/libretranslate';
import * as llm from './providers/llm-translate';

type Provider = 'libretranslate' | 'llm' | 'passthrough';

const MAX_ATTEMPTS = 3;

export async function translateArticle(articleId: number): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, articleId),
  });
  if (!article) throw new Error(`Article ${articleId} not found`);

  const sourceLanguage = article.sourceLanguage ?? 'ja';

  // English passthrough: copy original → translated, skip API calls
  if (sourceLanguage === 'en') {
    await db
      .update(schema.articles)
      .set({
        translatedTitle: article.originalTitle,
        translatedContent: article.originalContent,
        translationProvider: 'passthrough',
        translationStatus: 'complete',
        translationError: null,
        translatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.articles.id, articleId));
    return;
  }

  await db
    .update(schema.articles)
    .set({ translationStatus: 'translating', updatedAt: new Date() })
    .where(eq(schema.articles.id, articleId));

  let lastError: Error | null = null;
  let attempts = 0;

  // Try LibreTranslate first, then LLM fallback
  const providers: { name: Provider; fn: { translate: (text: string, src?: string) => Promise<{ text: string }> } }[] = [
    {
      name: 'libretranslate',
      fn: { translate: (text: string, src?: string) => libre.translate(text, src, 'en') },
    },
    {
      name: 'llm',
      fn: { translate: (text: string, src?: string) => llm.translate(text, src) },
    },
  ];

  for (const provider of providers) {
    if (attempts >= MAX_ATTEMPTS) break;

    try {
      attempts++;
      const [titleResult, contentResult] = await Promise.all([
        provider.fn.translate(article.originalTitle, sourceLanguage),
        provider.fn.translate(article.originalContent, sourceLanguage),
      ]);

      await db
        .update(schema.articles)
        .set({
          translatedTitle: titleResult.text,
          translatedContent: contentResult.text,
          translationProvider: provider.name,
          translationStatus: 'complete',
          translationError: null,
          translatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.articles.id, articleId));

      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // All attempts exhausted
  await db
    .update(schema.articles)
    .set({
      translationStatus: 'error',
      translationError: lastError?.message ?? 'Unknown translation error',
      updatedAt: new Date(),
    })
    .where(eq(schema.articles.id, articleId));
}

export async function forceTranslate(
  articleId: number,
  provider: 'libretranslate' | 'llm',
): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, articleId),
  });
  if (!article) throw new Error(`Article ${articleId} not found`);

  const sourceLanguage = article.sourceLanguage ?? 'ja';

  await db
    .update(schema.articles)
    .set({ translationStatus: 'translating', updatedAt: new Date() })
    .where(eq(schema.articles.id, articleId));

  try {
    let titleResult: { text: string };
    let contentResult: { text: string };

    if (provider === 'libretranslate') {
      [titleResult, contentResult] = await Promise.all([
        libre.translate(article.originalTitle, sourceLanguage, 'en'),
        libre.translate(article.originalContent, sourceLanguage, 'en'),
      ]);
    } else {
      [titleResult, contentResult] = await Promise.all([
        llm.translate(article.originalTitle, sourceLanguage),
        llm.translate(article.originalContent, sourceLanguage),
      ]);
    }

    await db
      .update(schema.articles)
      .set({
        translatedTitle: titleResult.text,
        translatedContent: contentResult.text,
        translationProvider: provider,
        translationStatus: 'complete',
        translationError: null,
        translatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.articles.id, articleId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.articles)
      .set({
        translationStatus: 'error',
        translationError: message,
        updatedAt: new Date(),
      })
      .where(eq(schema.articles.id, articleId));
    throw err;
  }
}
