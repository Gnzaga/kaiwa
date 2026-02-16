import type { Job } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { fetchEntries, markAsRead } from '@/lib/miniflux';
import { boss, QUEUE_TRANSLATION } from '@/lib/queue';

export async function handleSync(_jobs: Job[]) {
  console.log('[sync] Starting Miniflux sync...');
  const { entries } = await fetchEntries({ status: 'unread', limit: 100 });
  console.log(`[sync] Fetched ${entries.length} unread entries`);

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const feed = await db.query.feeds.findFirst({
      where: eq(schema.feeds.minifluxFeedId, entry.feed_id),
    });

    if (!feed) {
      skipped++;
      continue;
    }

    const existing = await db.query.articles.findFirst({
      where: eq(schema.articles.minifluxEntryId, entry.id),
    });

    if (existing) {
      skipped++;
      continue;
    }

    const [article] = await db
      .insert(schema.articles)
      .values({
        minifluxEntryId: entry.id,
        feedId: feed.id,
        originalTitle: entry.title,
        originalContent: entry.content,
        originalUrl: entry.url,
        publishedAt: new Date(entry.published_at),
        translationStatus: 'pending',
        summaryStatus: 'pending',
      })
      .returning();

    await markAsRead(entry.id);

    // Enqueue translation job
    await boss.send(QUEUE_TRANSLATION, { articleId: article.id });

    created++;
  }

  console.log(`[sync] Done: ${created} created, ${skipped} skipped`);
}
