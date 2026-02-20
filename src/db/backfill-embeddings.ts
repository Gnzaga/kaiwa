import { Pool } from 'pg';
import { config } from '@/lib/config';

/**
 * Backfill script: generates embeddings for all summarized articles.
 * Requires the embedder service to be running.
 *
 * Usage: npx tsx src/db/backfill-embeddings.ts
 */

const BATCH_SIZE = 50;

interface EmbedResponse {
  embeddings: number[][];
}

async function main() {
  const pool = new Pool({ connectionString: config.database.url });
  const embedderUrl = config.embedder.url;

  // Verify embedder is healthy
  const health = await fetch(`${embedderUrl}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`Embedder not reachable at ${embedderUrl}`);
    process.exit(1);
  }
  console.log(`Embedder healthy at ${embedderUrl}`);

  // Get articles that need embedding
  const { rows: articles } = await pool.query(`
    SELECT id,
           COALESCE(translated_title, original_title) AS title,
           COALESCE(summary_tldr, LEFT(COALESCE(translated_content, original_content), 4000)) AS content
    FROM articles
    WHERE summary_status = 'complete'
      AND embedding IS NULL
    ORDER BY id
  `);

  console.log(`Found ${articles.length} articles to embed`);

  let processed = 0;
  let errors = 0;

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const texts = batch.map((a: { title: string; content: string }) =>
      `${a.title}\n\n${a.content}`.slice(0, 8000)
    );

    try {
      const res = await fetch(`${embedderUrl}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        throw new Error(`Embedder returned ${res.status}`);
      }

      const data: EmbedResponse = await res.json();

      // Update each article with its embedding
      for (let j = 0; j < batch.length; j++) {
        const article = batch[j];
        const embedding = data.embeddings[j];
        await pool.query(
          `UPDATE articles
           SET embedding = $1::vector,
               embedding_status = 'complete',
               embedded_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(embedding), article.id]
        );
      }

      processed += batch.length;
      console.log(`Processed ${processed}/${articles.length} (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    } catch (err) {
      errors += batch.length;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Batch starting at index ${i} failed: ${msg}`);

      // Mark these as errored
      for (const article of batch) {
        await pool.query(
          `UPDATE articles SET embedding_status = 'error', embedding_error = $1 WHERE id = $2`,
          [msg, article.id]
        );
      }
    }
  }

  console.log(`\nDone: ${processed} embedded, ${errors} errors`);
  console.log('\nIf backfill is complete, create the HNSW index:');
  console.log('  CREATE INDEX idx_articles_embedding ON articles USING hnsw (embedding vector_cosine_ops);');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
