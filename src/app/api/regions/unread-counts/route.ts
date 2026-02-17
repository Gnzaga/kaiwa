import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Count articles per region where user hasn't read them yet
    const counts = await db
      .select({
        regionId: schema.feeds.regionId,
        unread: sql<number>`COUNT(*)`,
      })
      .from(schema.articles)
      .innerJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .leftJoin(
        schema.userArticleStates,
        sql`${schema.userArticleStates.articleId} = ${schema.articles.id} AND ${schema.userArticleStates.userId} = ${userId}`,
      )
      .where(
        sql`COALESCE(${schema.userArticleStates.isRead}, false) = false
          AND ${schema.articles.publishedAt} >= NOW() - INTERVAL '7 days'`,
      )
      .groupBy(schema.feeds.regionId);

    // Return as { regionId: count }
    const result: Record<string, number> = {};
    for (const row of counts) {
      result[row.regionId] = Number(row.unread);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
