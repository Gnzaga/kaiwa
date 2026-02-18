import { NextResponse } from 'next/server';
import { eq, and, sql, not } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

// Returns up to 5 unread articles that match the user's most-read tags or sources from the last 30 days.
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get user's top tags from last 30 days
    const topTagsRows = await db
      .select({ tag: sql<string>`tag` })
      .from(
        sql`${schema.userArticleStates}
          JOIN ${schema.articles} ON ${schema.userArticleStates.articleId} = ${schema.articles.id},
          jsonb_array_elements_text(${schema.articles.summaryTags}) AS tag`,
      )
      .where(
        sql`${schema.userArticleStates.userId} = ${userId}
          AND ${schema.userArticleStates.isRead} = true
          AND ${schema.userArticleStates.readAt} >= ${thirtyDaysAgo.toISOString()}
          AND ${schema.articles.summaryTags} IS NOT NULL`,
      )
      .groupBy(sql`tag`)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    const topTags = topTagsRows.map(r => r.tag);

    // Get user's top source from last 30 days
    const topSourceRows = await db
      .select({ sourceName: schema.feeds.sourceName })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .innerJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.isRead, true),
          sql`${schema.userArticleStates.readAt} >= ${thirtyDaysAgo.toISOString()}`,
        ),
      )
      .groupBy(schema.feeds.sourceName)
      .orderBy(sql`count(*) DESC`)
      .limit(3);

    const topSources = topSourceRows.map(r => r.sourceName);

    if (topTags.length === 0 && topSources.length === 0) {
      return NextResponse.json([]);
    }

    // Get articles the user hasn't read yet that match top tags or sources
    // Use a scoring approach: tag match = 2pts per matching tag, source match = 1pt
    const tagCondition = topTags.length > 0
      ? sql`(
          SELECT COUNT(*) FROM jsonb_array_elements_text(${schema.articles.summaryTags}) t
          WHERE t = ANY(ARRAY[${sql.join(topTags.map(t => sql`${t}`), sql`, `)}])
        )`
      : sql`0`;

    const sourceCondition = topSources.length > 0
      ? sql`CASE WHEN ${schema.feeds.sourceName} = ANY(ARRAY[${sql.join(topSources.map(s => sql`${s}`), sql`, `)}]) THEN 1 ELSE 0 END`
      : sql`0`;

    // Find articles not read by this user
    const readArticleIds = db
      .select({ articleId: schema.userArticleStates.articleId })
      .from(schema.userArticleStates)
      .where(and(eq(schema.userArticleStates.userId, userId), eq(schema.userArticleStates.isRead, true)));

    const recommended = await db
      .select({
        id: schema.articles.id,
        translatedTitle: schema.articles.translatedTitle,
        originalTitle: schema.articles.originalTitle,
        originalUrl: schema.articles.originalUrl,
        publishedAt: schema.articles.publishedAt,
        summaryTldr: schema.articles.summaryTldr,
        summaryTags: schema.articles.summaryTags,
        summarySentiment: schema.articles.summarySentiment,
        feedSourceName: schema.feeds.sourceName,
        score: sql<number>`(${tagCondition}) * 2 + ${sourceCondition}`,
      })
      .from(schema.articles)
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(
        and(
          sql`${schema.articles.id} NOT IN (${readArticleIds})`,
          sql`${schema.articles.summaryStatus} = 'complete'`,
          sql`${schema.articles.publishedAt} >= NOW() - INTERVAL '7 days'`,
        ),
      )
      .orderBy(sql`score DESC, ${schema.articles.publishedAt} DESC`)
      .limit(5);

    return NextResponse.json(recommended.filter(a => (a.score ?? 0) > 0));
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
