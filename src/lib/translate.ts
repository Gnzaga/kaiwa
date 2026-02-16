import { eq } from 'drizzle-orm';
import { db, schema } from './db';
import * as libre from './providers/libretranslate';
import * as llm from './providers/llm-translate';

type Provider = 'libretranslate' | 'llm';

const MAX_ATTEMPTS = 3;

export async function translateArticle(articleId: number): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, articleId),
  });
  if (!article) throw new Error(`Article ${articleId} not found`);

  await db
    .update(schema.articles)
    .set({ translationStatus: 'translating', updatedAt: new Date() })
    .where(eq(schema.articles.id, articleId));

  let lastError: Error | null = null;
  let attempts = 0;

  // Try LibreTranslate first, then LLM fallback
  const providers: { name: Provider; fn: { translate: typeof libre.translate } }[] = [
    { name: 'libretranslate', fn: libre },
    { name: 'llm', fn: llm },
  ];

  for (const provider of providers) {
    if (attempts >= MAX_ATTEMPTS) break;

    try {
      attempts++;
      const [titleResult, contentResult] = await Promise.all([
        provider.fn.translate(article.originalTitle),
        provider.fn.translate(article.originalContent),
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
  provider: Provider,
): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, articleId),
  });
  if (!article) throw new Error(`Article ${articleId} not found`);

  await db
    .update(schema.articles)
    .set({ translationStatus: 'translating', updatedAt: new Date() })
    .where(eq(schema.articles.id, articleId));

  const providerModule = provider === 'libretranslate' ? libre : llm;

  try {
    const [titleResult, contentResult] = await Promise.all([
      providerModule.translate(article.originalTitle),
      providerModule.translate(article.originalContent),
    ]);

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
