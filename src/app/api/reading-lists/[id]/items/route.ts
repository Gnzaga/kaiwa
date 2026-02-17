import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function POST(
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
    const { articleId, note } = body;
    if (!articleId || typeof articleId !== 'number') {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    // Get max sort order
    const maxResult = await db
      .select({ max: sql<number>`COALESCE(MAX(${schema.readingListItems.sortOrder}), -1)` })
      .from(schema.readingListItems)
      .where(eq(schema.readingListItems.readingListId, listId));

    const [item] = await db
      .insert(schema.readingListItems)
      .values({
        readingListId: listId,
        articleId,
        note: typeof note === 'string' ? note.trim() || null : null,
        sortOrder: Number(maxResult[0].max) + 1,
      })
      .returning();

    return NextResponse.json(item, { status: 201 });
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
    if (isNaN(listId)) return NextResponse.json({ error: 'Invalid list ID' }, { status: 400 });

    const list = await db.query.readingLists.findFirst({
      where: and(eq(schema.readingLists.id, listId), eq(schema.readingLists.userId, userId)),
    });
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

    const body = await request.json();
    const { articleId, note } = body;
    if (!articleId || typeof articleId !== 'number') {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    const [updated] = await db
      .update(schema.readingListItems)
      .set({ note: typeof note === 'string' ? note.trim() || null : null })
      .where(
        and(
          eq(schema.readingListItems.readingListId, listId),
          eq(schema.readingListItems.articleId, articleId),
        ),
      )
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
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
    const { articleId } = body;
    if (!articleId || typeof articleId !== 'number') {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    await db
      .delete(schema.readingListItems)
      .where(
        and(
          eq(schema.readingListItems.readingListId, listId),
          eq(schema.readingListItems.articleId, articleId),
        ),
      );

    return NextResponse.json({ deleted: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
