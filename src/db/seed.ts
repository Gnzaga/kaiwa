import { db, schema } from '@/lib/db';
import { sql } from 'drizzle-orm';

const REGIONS = [
  { id: 'us', name: 'United States', code: 'US', defaultLanguage: 'en', flagEmoji: '\u{1F1FA}\u{1F1F8}', sortOrder: 0 },
  { id: 'jp', name: 'Japan', code: 'JP', defaultLanguage: 'ja', flagEmoji: '\u{1F1EF}\u{1F1F5}', sortOrder: 1 },
  { id: 'ph', name: 'Philippines', code: 'PH', defaultLanguage: 'en', flagEmoji: '\u{1F1F5}\u{1F1ED}', sortOrder: 2 },
  { id: 'tw', name: 'Taiwan', code: 'TW', defaultLanguage: 'zh', flagEmoji: '\u{1F1F9}\u{1F1FC}', sortOrder: 3 },
];

const CATEGORY_SLUGS = [
  { slug: 'politics', name: 'Politics', icon: 'politics', sortOrder: 0 },
  { slug: 'news', name: 'News', icon: 'news', sortOrder: 1 },
  { slug: 'tech', name: 'Tech', icon: 'tech', sortOrder: 2 },
  { slug: 'government', name: 'Government', icon: 'government', sortOrder: 3 },
  { slug: 'underreported', name: 'Underreported', icon: 'underreported', sortOrder: 4 },
  { slug: 'law', name: 'Law', icon: 'law', sortOrder: 5 },
  { slug: 'economics', name: 'Economics', icon: 'economics', sortOrder: 6 },
];

async function seed() {
  console.log('[seed] Seeding regions...');
  for (const region of REGIONS) {
    await db
      .insert(schema.regions)
      .values(region)
      .onConflictDoNothing({ target: schema.regions.id });
  }
  console.log(`[seed] ${REGIONS.length} regions seeded`);

  console.log('[seed] Seeding categories...');
  const categories = REGIONS.flatMap((region) =>
    CATEGORY_SLUGS.map((cat) => ({
      id: `${region.id}-${cat.slug}`,
      regionId: region.id,
      slug: cat.slug,
      name: cat.name,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
    }))
  );

  for (const category of categories) {
    await db
      .insert(schema.categories)
      .values(category)
      .onConflictDoNothing({ target: schema.categories.id });
  }
  console.log(`[seed] ${categories.length} categories seeded`);

  // Backfill existing feeds: set region_id and category_id based on old category
  console.log('[seed] Backfilling existing feeds...');
  await db.execute(sql`
    UPDATE feeds SET region_id = 'jp', source_language = 'ja'
    WHERE region_id IS NULL OR region_id = ''
  `);
  await db.execute(sql`
    UPDATE feeds SET category_id = 'jp-law'
    WHERE category_id IS NULL AND category = 'law'
  `);
  await db.execute(sql`
    UPDATE feeds SET category_id = 'jp-economics'
    WHERE category_id IS NULL AND category = 'economics'
  `);

  // Backfill existing articles: set source_language
  console.log('[seed] Backfilling existing articles...');
  await db.execute(sql`
    UPDATE articles SET source_language = 'ja'
    WHERE source_language IS NULL OR source_language = ''
  `);

  console.log('[seed] Done!');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] Error:', err);
    process.exit(1);
  });
