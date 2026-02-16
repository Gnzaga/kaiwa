import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { fetchEntries, markAsRead } from '@/lib/miniflux';

export async function POST() {
  try {
    const { entries } = await fetchEntries({ status: 'unread', limit: 100 });

    let created = 0;
    let skipped = 0;

    for (const entry of entries) {
      // Find matching feed in our DB
      const feed = await db.query.feeds.findFirst({
        where: eq(schema.feeds.minifluxFeedId, entry.feed_id),
      });

      if (!feed) {
        skipped++;
        continue;
      }

      // Check if article already exists
      const existing = await db.query.articles.findFirst({
        where: eq(schema.articles.minifluxEntryId, entry.id),
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(schema.articles).values({
        minifluxEntryId: entry.id,
        feedId: feed.id,
        originalTitle: entry.title,
        originalContent: entry.content,
        originalUrl: entry.url,
        publishedAt: new Date(entry.published_at),
        translationStatus: 'pending',
        summaryStatus: 'pending',
      });

      await markAsRead(entry.id);
      created++;
    }

    return NextResponse.json({
      synced: created,
      skipped,
      total: entries.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
