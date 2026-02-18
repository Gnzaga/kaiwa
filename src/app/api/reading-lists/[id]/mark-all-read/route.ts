import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function POST(
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

    // Bulk upsert: mark all articles in the list as read for this user
    await db.execute(sql`
      INSERT INTO user_article_states (user_id, article_id, is_read, read_at)
      SELECT ${userId}, article_id, true, NOW()
      FROM reading_list_items
      WHERE reading_list_id = ${listId}
      ON CONFLICT (user_id, article_id)
      DO UPDATE SET is_read = true, read_at = EXCLUDED.read_at
    `);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
