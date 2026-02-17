import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const params = request.nextUrl.searchParams;
    const region = params.get('region');
    const category = params.get('category');
    const source = params.get('source');

    const conditions = [];
    if (region) conditions.push(eq(schema.feeds.regionId, region));
    if (category) {
      conditions.push(eq(schema.categories.slug, category));
      if (region) conditions.push(eq(schema.categories.regionId, region));
    }
    if (source) conditions.push(eq(schema.feeds.sourceName, source));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all matching article IDs
    const articles = await db
      .select({ id: schema.articles.id })
      .from(schema.articles)
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .leftJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
      .where(where);

    if (articles.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const now = new Date();
    const articleIds = articles.map((a) => a.id);

    // Bulk upsert: mark all as read
    await db
      .insert(schema.userArticleStates)
      .values(
        articleIds.map((articleId) => ({
          userId,
          articleId,
          isRead: true,
          isStarred: false,
          isArchived: false,
          readAt: now,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.userArticleStates.userId, schema.userArticleStates.articleId],
        set: {
          isRead: true,
          readAt: sql`CASE WHEN ${schema.userArticleStates.readAt} IS NULL THEN ${now.toISOString()} ELSE ${schema.userArticleStates.readAt} END`,
          updatedAt: now,
        },
      });

    return NextResponse.json({ count: articleIds.length });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
