import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const lists = await db
      .select({
        id: schema.readingLists.id,
        name: schema.readingLists.name,
        description: schema.readingLists.description,
        isPublic: schema.readingLists.isPublic,
        createdAt: schema.readingLists.createdAt,
        updatedAt: schema.readingLists.updatedAt,
        articleCount: sql<number>`count(distinct ${schema.readingListItems.id})`,
        readCount: sql<number>`count(distinct ${schema.userArticleStates.articleId}) filter (where ${schema.userArticleStates.isRead} = true)`,
      })
      .from(schema.readingLists)
      .leftJoin(schema.readingListItems, eq(schema.readingListItems.readingListId, schema.readingLists.id))
      .leftJoin(
        schema.userArticleStates,
        sql`${schema.userArticleStates.articleId} = ${schema.readingListItems.articleId} AND ${schema.userArticleStates.userId} = ${userId}`,
      )
      .where(eq(schema.readingLists.userId, userId))
      .groupBy(schema.readingLists.id)
      .orderBy(schema.readingLists.createdAt);

    return NextResponse.json(lists);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const { name, description } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const [list] = await db
      .insert(schema.readingLists)
      .values({ userId, name, description: description ?? null })
      .returning();

    return NextResponse.json(list, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
