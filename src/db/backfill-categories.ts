import { PgBoss } from 'pg-boss';
import { Pool } from 'pg';
import { config } from '@/lib/config';

/**
 * Backfill script: fixes legacy image URLs and re-queues summarized articles
 * that lack a summary_category for re-summarization.
 *
 * Usage: npx tsx src/db/backfill-categories.ts
 */
async function main() {
  const pool = new Pool({ connectionString: config.database.url });

  // 1. Fix legacy image URLs: strip MinIO prefix, keep just the key
  const minioPrefix = config.minio.publicUrl;
  const { rowCount: imageFixed } = await pool.query(`
    UPDATE articles
    SET image_url = REGEXP_REPLACE(image_url, '^https?://[^/]+/[^/]+/', '')
    WHERE image_url LIKE 'http%'
  `);
  console.log(`Fixed ${imageFixed} legacy image URLs`);

  // 2. Reset summary_status for articles that completed summarization but have no category
  const { rowCount: resetCount } = await pool.query(`
    UPDATE articles
    SET summary_status = 'pending', summary_error = NULL
    WHERE summary_status = 'complete' AND summary_category IS NULL
  `);
  console.log(`Reset ${resetCount} articles for re-summarization`);

  // 3. Enqueue those articles for summarization
  const boss = new PgBoss(config.database.url);
  await boss.start();

  const regions = ['jp', 'us', 'ph', 'tw'];
  for (const r of regions) {
    await boss.createQueue(`summarize-${r}`);
  }

  const { rows } = await pool.query(`
    SELECT a.id, f.region_id
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE a.summary_status = 'pending'
      AND a.translation_status = 'complete'
    ORDER BY a.id
  `);

  console.log(`Enqueuing ${rows.length} articles for re-summarization...`);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const region = row.region_id || 'jp';
    await boss.send(`summarize-${region}`, { articleId: row.id });
    counts[region] = (counts[region] || 0) + 1;
  }
  console.log('Per-region:', counts);
  console.log(`Done: ${rows.length} enqueued`);

  await boss.stop();
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
