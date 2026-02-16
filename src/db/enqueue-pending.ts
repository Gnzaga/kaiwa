import { PgBoss } from 'pg-boss';
import { Pool } from 'pg';
import { config } from '@/lib/config';

async function main() {
  const boss = new PgBoss(config.database.url);
  await boss.start();

  // Create all region queues
  const regions = ['jp', 'us', 'ph', 'tw'];
  for (const r of regions) {
    await boss.createQueue(`scrape-${r}`);
    await boss.createQueue(`translate-${r}`);
    await boss.createQueue(`summarize-${r}`);
  }

  const pool = new Pool({ connectionString: config.database.url });
  const { rows } = await pool.query(`
    SELECT a.id, f.region_id
    FROM articles a
    JOIN feeds f ON a.feed_id = f.id
    WHERE a.translation_status = 'pending'
    ORDER BY a.id
  `);

  console.log(`Enqueuing ${rows.length} articles...`);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const region = row.region_id || 'jp';
    await boss.send(`scrape-${region}`, { articleId: row.id });
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
