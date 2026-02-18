import { NextResponse } from 'next/server';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const notes = await db
      .select({
        articleId: schema.userArticleStates.articleId,
        note: schema.userArticleStates.note,
        updatedAt: schema.userArticleStates.updatedAt,
        isRead: schema.userArticleStates.isRead,
        isStarred: schema.userArticleStates.isStarred,
        title: sql<string>`coalesce(${schema.articles.translatedTitle}, ${schema.articles.originalTitle})`,
        originalUrl: schema.articles.originalUrl,
        publishedAt: schema.articles.publishedAt,
        sourceName: schema.feeds.sourceName,
        regionId: schema.feeds.regionId,
      })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          isNotNull(schema.userArticleStates.note),
          sql`${schema.userArticleStates.note} != ''`,
        ),
      )
      .orderBy(sql`${schema.userArticleStates.updatedAt} DESC NULLS LAST`);

    return NextResponse.json(notes);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
