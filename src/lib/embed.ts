import { eq, sql } from 'drizzle-orm';
import { db, schema } from './db';
import { config } from './config';

interface EmbedResponse {
  embeddings: number[][];
}

async function callEmbedder(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${config.embedder.url}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Embedder request failed: ${res.status} ${detail}`);
  }

  const data: EmbedResponse = await res.json();
  return data.embeddings;
}

export async function embedArticle(articleId: number): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: eq(schema.articles.id, articleId),
  });
  if (!article) throw new Error(`Article ${articleId} not found`);

  const title = article.translatedTitle || article.originalTitle;
  const content = article.summaryTldr || article.translatedContent || article.originalContent;
  const text = `${title}\n\n${content}`.slice(0, 8000);

  await db
    .update(schema.articles)
    .set({ embeddingStatus: 'embedding', updatedAt: new Date() })
    .where(eq(schema.articles.id, articleId));

  try {
    const [embedding] = await callEmbedder([text]);

    await db
      .update(schema.articles)
      .set({
        embeddingStatus: 'complete',
        embeddingError: null,
        embeddedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.articles.id, articleId));

    // Write the vector via raw SQL since Drizzle doesn't support vector type
    await db.execute(
      sql`UPDATE articles SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${articleId}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.articles)
      .set({
        embeddingStatus: 'error',
        embeddingError: message,
        updatedAt: new Date(),
      })
      .where(eq(schema.articles.id, articleId));
    throw err;
  }
}

export async function getQueryEmbedding(query: string): Promise<number[]> {
  const [embedding] = await callEmbedder([query]);
  return embedding;
}
