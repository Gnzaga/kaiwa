import { NextResponse } from 'next/server';
import { sql, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-helpers';
import { boss, ensureBossStarted, QUEUE_TRANSLATION, QUEUE_SUMMARIZATION, QUEUE_SCRAPE, QUEUE_SYNC, REGIONS, queueScrape, queueTranslate, queueSummarize } from '@/lib/queue';

export async function GET() {
  try {
    await requireAdmin();

    // Article stats
    const [articleStats] = await db
      .select({
        total: sql<number>`count(*)`,
        translated: sql<number>`count(*) FILTER (WHERE ${schema.articles.translationStatus} = 'complete')`,
        translating: sql<number>`count(*) FILTER (WHERE ${schema.articles.translationStatus} = 'translating')`,
        translationPending: sql<number>`count(*) FILTER (WHERE ${schema.articles.translationStatus} = 'pending')`,
        translationError: sql<number>`count(*) FILTER (WHERE ${schema.articles.translationStatus} = 'error')`,
        summarized: sql<number>`count(*) FILTER (WHERE ${schema.articles.summaryStatus} = 'complete')`,
        summarizing: sql<number>`count(*) FILTER (WHERE ${schema.articles.summaryStatus} = 'summarizing')`,
        summaryPending: sql<number>`count(*) FILTER (WHERE ${schema.articles.summaryStatus} = 'pending')`,
        summaryError: sql<number>`count(*) FILTER (WHERE ${schema.articles.summaryStatus} = 'error')`,
      })
      .from(schema.articles);

    // Ingestion throughput (last hour)
    const oneHourAgo = new Date(Date.now() - 3600000);
    const [ingestStats] = await db
      .select({ ingestedLastHour: sql<number>`count(*)` })
      .from(schema.articles)
      .where(gte(schema.articles.createdAt, oneHourAgo));

    // User count
    const [userStats] = await db
      .select({
        total: sql<number>`count(*)`,
        admins: sql<number>`count(*) FILTER (WHERE ${schema.users.isAdmin} = true)`,
      })
      .from(schema.users);

    // Feed count
    const [feedStats] = await db
      .select({
        total: sql<number>`count(*)`,
        enabled: sql<number>`count(*) FILTER (WHERE ${schema.feeds.enabled} = true)`,
        userSubmitted: sql<number>`count(*) FILTER (WHERE ${schema.feeds.submittedByUserId} IS NOT NULL)`,
      })
      .from(schema.feeds);

    // Queue stats
    let queueStats: Record<string, number> = {};
    try {
      await ensureBossStarted();
      const allQueues = [
        QUEUE_TRANSLATION, QUEUE_SUMMARIZATION, QUEUE_SCRAPE, QUEUE_SYNC,
        ...REGIONS.flatMap(r => [queueScrape(r), queueTranslate(r), queueSummarize(r)]),
      ];
      for (const q of allQueues) {
        const info = await boss.getQueue(q);
        if (info && info.queuedCount > 0) queueStats[q] = info.queuedCount;
      }
    } catch {
      // Queue unavailable
    }

    // Active sessions
    const [sessionStats] = await db
      .select({
        active: sql<number>`count(*)`,
      })
      .from(schema.sessions);

    return NextResponse.json({
      articles: { ...articleStats, ingestedLastHour: Number(ingestStats.ingestedLastHour) },
      users: userStats,
      feeds: feedStats,
      queues: queueStats,
      sessions: { active: Number(sessionStats.active) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
