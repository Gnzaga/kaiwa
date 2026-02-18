import { NextResponse } from 'next/server';
import { eq, and, sql, count } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const twoMonthsAgo = new Date(today);
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);
    const yearStart = new Date(today.getFullYear(), 0, 1);

    // Overall counts
    const [totals] = await db
      .select({
        totalRead: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isRead} = true)`,
        totalStarred: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isStarred} = true)`,
        totalArchived: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isArchived} = true)`,
        readToday: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isRead} = true AND ${schema.userArticleStates.readAt} >= ${today.toISOString()})`,
        readThisWeek: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isRead} = true AND ${schema.userArticleStates.readAt} >= ${weekAgo.toISOString()})`,
        readLastWeek: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isRead} = true AND ${schema.userArticleStates.readAt} >= ${twoWeeksAgo.toISOString()} AND ${schema.userArticleStates.readAt} < ${weekAgo.toISOString()})`,
        readThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isRead} = true AND ${schema.userArticleStates.readAt} >= ${monthAgo.toISOString()})`,
        readLastMonth: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isRead} = true AND ${schema.userArticleStates.readAt} >= ${twoMonthsAgo.toISOString()} AND ${schema.userArticleStates.readAt} < ${monthAgo.toISOString()})`,
        readThisYear: sql<number>`COUNT(*) FILTER (WHERE ${schema.userArticleStates.isRead} = true AND ${schema.userArticleStates.readAt} >= ${yearStart.toISOString()})`,
      })
      .from(schema.userArticleStates)
      .where(eq(schema.userArticleStates.userId, userId));

    // Top regions (by articles read)
    const topRegions = await db
      .select({
        regionId: schema.feeds.regionId,
        regionName: schema.regions.name,
        flagEmoji: schema.regions.flagEmoji,
        count: count(),
      })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .innerJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .innerJoin(schema.regions, eq(schema.feeds.regionId, schema.regions.id))
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.isRead, true),
        ),
      )
      .groupBy(schema.feeds.regionId, schema.regions.name, schema.regions.flagEmoji)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    // Top tags (from read articles' summaryTags)
    const topTags = await db
      .select({
        tag: sql<string>`tag`,
        count: sql<number>`count(*)`,
      })
      .from(
        sql`${schema.userArticleStates}
          JOIN ${schema.articles} ON ${schema.userArticleStates.articleId} = ${schema.articles.id},
          jsonb_array_elements_text(${schema.articles.summaryTags}) AS tag`,
      )
      .where(
        sql`${schema.userArticleStates.userId} = ${userId}
          AND ${schema.userArticleStates.isRead} = true
          AND ${schema.articles.summaryTags} IS NOT NULL`,
      )
      .groupBy(sql`tag`)
      .orderBy(sql`count(*) DESC`)
      .limit(8);

    // Top sources (by articles read)
    const topSources = await db
      .select({
        sourceName: schema.feeds.sourceName,
        count: count(),
      })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .innerJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(and(eq(schema.userArticleStates.userId, userId), eq(schema.userArticleStates.isRead, true)))
      .groupBy(schema.feeds.sourceName)
      .orderBy(sql`count(*) DESC`)
      .limit(8);

    // Sentiment distribution of read articles
    const sentimentDist = await db
      .select({
        sentiment: schema.articles.summarySentiment,
        count: count(),
      })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.isRead, true),
          sql`${schema.articles.summarySentiment} IS NOT NULL`,
        ),
      )
      .groupBy(schema.articles.summarySentiment)
      .orderBy(sql`count(*) DESC`);

    // Reading lists count + total articles in DB + total words read
    const [[{ listCount }], [{ totalArticles }], [{ totalWordsRead }]] = await Promise.all([
      db.select({ listCount: count() }).from(schema.readingLists).where(eq(schema.readingLists.userId, userId)),
      db.select({ totalArticles: count() }).from(schema.articles),
      db
        .select({
          totalWordsRead: sql<number>`coalesce(sum(char_length(coalesce(${schema.articles.translatedContent}, ${schema.articles.originalContent}, '')) / 5), 0)`,
        })
        .from(schema.userArticleStates)
        .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
        .where(and(eq(schema.userArticleStates.userId, userId), eq(schema.userArticleStates.isRead, true))),
    ]);

    // Peak reading hour (0-23)
    const hourlyActivity = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${schema.userArticleStates.readAt} AT TIME ZONE 'UTC')::int`,
        count: count(),
      })
      .from(schema.userArticleStates)
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.isRead, true),
          sql`${schema.userArticleStates.readAt} IS NOT NULL`,
        ),
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${schema.userArticleStates.readAt} AT TIME ZONE 'UTC')::int`)
      .orderBy(sql`count(*) DESC`)
      .limit(24);

    // Daily activity for last 365 days (reading streak + heatmap)
    const dailyActivity = await db
      .select({
        day: sql<string>`DATE(${schema.userArticleStates.readAt} AT TIME ZONE 'UTC')`,
        count: count(),
      })
      .from(schema.userArticleStates)
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.isRead, true),
          sql`${schema.userArticleStates.readAt} >= NOW() - INTERVAL '365 days'`,
        ),
      )
      .groupBy(sql`DATE(${schema.userArticleStates.readAt} AT TIME ZONE 'UTC')`)
      .orderBy(sql`DATE(${schema.userArticleStates.readAt} AT TIME ZONE 'UTC') ASC`);

    return NextResponse.json({
      totals,
      topRegions,
      topSources,
      topTags,
      listCount,
      totalArticles,
      totalWordsRead: Number(totalWordsRead),
      dailyActivity,
      sentimentDist,
      hourlyActivity,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
