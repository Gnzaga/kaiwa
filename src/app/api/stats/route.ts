import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, gte, count } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get('region');
    const category = request.nextUrl.searchParams.get('category');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const regionCondition = region
      ? sql`${schema.articles.feedId} IN (SELECT id FROM feeds WHERE region_id = ${region}${category ? sql` AND category_id = (SELECT id FROM categories WHERE slug = ${category} LIMIT 1)` : sql``})`
      : undefined;

    const oneHourAgo = new Date(Date.now() - 3600000);
    const [
      totalArticlesToday,
      articlesThisHour,
      totalArticles,
      translationsPending,
      summariesPending,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .where(
          regionCondition
            ? and(gte(schema.articles.createdAt, todayStart), regionCondition)
            : gte(schema.articles.createdAt, todayStart),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .where(
          regionCondition
            ? and(gte(schema.articles.createdAt, oneHourAgo), regionCondition)
            : gte(schema.articles.createdAt, oneHourAgo),
        ),
      db.select({ count: count() }).from(schema.articles).where(regionCondition ? regionCondition : undefined),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .where(
          regionCondition
            ? and(eq(schema.articles.translationStatus, 'pending'), regionCondition)
            : eq(schema.articles.translationStatus, 'pending'),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .where(
          regionCondition
            ? and(eq(schema.articles.summaryStatus, 'pending'), regionCondition)
            : eq(schema.articles.summaryStatus, 'pending'),
        ),
    ]);

    return NextResponse.json({
      articlesToday: Number(totalArticlesToday[0].count),
      articlesThisHour: Number(articlesThisHour[0].count),
      totalArticles: Number(totalArticles[0].count),
      translationsPending: Number(translationsPending[0].count),
      summariesPending: Number(summariesPending[0].count),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
