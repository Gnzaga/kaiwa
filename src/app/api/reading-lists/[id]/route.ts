import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { id } = await params;
    const listId = parseInt(id, 10);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'Invalid list ID' }, { status: 400 });
    }

    const list = await db.query.readingLists.findFirst({
      where: and(eq(schema.readingLists.id, listId), eq(schema.readingLists.userId, userId)),
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    const [items, countResult] = await Promise.all([
      db
        .select({
          itemId: schema.readingListItems.id,
          note: schema.readingListItems.note,
          sortOrder: schema.readingListItems.sortOrder,
          addedAt: schema.readingListItems.addedAt,
          articleId: schema.articles.id,
          originalTitle: schema.articles.originalTitle,
          translatedTitle: schema.articles.translatedTitle,
          originalUrl: schema.articles.originalUrl,
          publishedAt: schema.articles.publishedAt,
          translationStatus: schema.articles.translationStatus,
          summaryTldr: schema.articles.summaryTldr,
          summaryTags: schema.articles.summaryTags,
          imageUrl: schema.articles.imageUrl,
          feedSourceName: schema.feeds.sourceName,
          feedRegionId: schema.feeds.regionId,
          isRead: sql<boolean>`coalesce(${schema.userArticleStates.isRead}, false)`,
        })
        .from(schema.readingListItems)
        .innerJoin(schema.articles, eq(schema.readingListItems.articleId, schema.articles.id))
        .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
        .leftJoin(
          schema.userArticleStates,
          sql`${schema.userArticleStates.articleId} = ${schema.articles.id} AND ${schema.userArticleStates.userId} = ${userId}`,
        )
        .where(eq(schema.readingListItems.readingListId, listId))
        .orderBy(schema.readingListItems.sortOrder)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.readingListItems)
        .where(eq(schema.readingListItems.readingListId, listId)),
    ]);

    return NextResponse.json({
      list,
      data: items,
      total: Number(countResult[0].count),
      page,
      pageSize,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { id } = await params;
    const listId = parseInt(id, 10);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'Invalid list ID' }, { status: 400 });
    }

    const list = await db.query.readingLists.findFirst({
      where: and(eq(schema.readingLists.id, listId), eq(schema.readingLists.userId, userId)),
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === 'string') updates.name = body.name;
    if (typeof body.description === 'string' || body.description === null) updates.description = body.description;
    if (typeof body.isPublic === 'boolean') updates.isPublic = body.isPublic;

    const [updated] = await db
      .update(schema.readingLists)
      .set(updates)
      .where(eq(schema.readingLists.id, listId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { id } = await params;
    const listId = parseInt(id, 10);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'Invalid list ID' }, { status: 400 });
    }

    const list = await db.query.readingLists.findFirst({
      where: and(eq(schema.readingLists.id, listId), eq(schema.readingLists.userId, userId)),
    });

    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    await db.delete(schema.readingLists).where(eq(schema.readingLists.id, listId));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
