import { Pool } from 'pg';
import { config } from '@/lib/config';

/**
 * Migration: enable pgvector and add embedding columns to articles.
 * Usage: npx tsx src/db/migrate-pgvector.ts
 */
async function main() {
  const pool = new Pool({ connectionString: config.database.url });

  console.log('Enabling pgvector extension...');
  await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  console.log('Adding embedding columns...');
  await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding vector(384)`);
  await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding_status text DEFAULT 'pending'`);
  await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding_error text`);
  await pool.query(`ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedded_at timestamptz`);

  console.log('Migration complete.');
  console.log('NOTE: Run the HNSW index creation AFTER backfill:');
  console.log('  CREATE INDEX idx_articles_embedding ON articles USING hnsw (embedding vector_cosine_ops);');

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
