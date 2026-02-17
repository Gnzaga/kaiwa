import type { Job } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { fetchEntries, markAsRead } from '@/lib/miniflux';
import { boss, queueScrape } from '@/lib/queue';
import { downloadArticleImage } from '@/lib/images';

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
      console.log(`[sync] Entry ${entry.id} (feed_id=${entry.feed_id}): no matching feed, skipped`);
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

    // Check for image in enclosures
    let imageUrl: string | null = null;
    const imageEnclosure = entry.enclosures?.find(
      (e) => e.mime_type?.startsWith('image/'),
    );

    const [article] = await db
      .insert(schema.articles)
      .values({
        minifluxEntryId: entry.id,
        feedId: feed.id,
        originalTitle: entry.title,
        originalContent: entry.content,
        originalUrl: entry.url,
        publishedAt: new Date(entry.published_at),
        sourceLanguage: feed.sourceLanguage ?? 'ja',
        translationStatus: 'pending',
        summaryStatus: 'pending',
      })
      .returning();

    // Download enclosure image if available
    if (imageEnclosure?.url) {
      imageUrl = await downloadArticleImage(imageEnclosure.url, article.id);
      if (imageUrl) {
        await db
          .update(schema.articles)
          .set({ imageUrl })
          .where(eq(schema.articles.id, article.id));
      }
    }

    await markAsRead(entry.id);

    // Enqueue scrape job to region-specific queue
    await boss.send(queueScrape(feed.regionId), { articleId: article.id });

    created++;
  }

  console.log(`[sync] Done: ${created} created, ${skipped} skipped`);
}
