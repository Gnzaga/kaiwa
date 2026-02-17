import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-helpers';

export async function GET() {
  try {
    await requireAdmin();

    const userList = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        image: schema.users.image,
        isAdmin: schema.users.isAdmin,
        articleStates: sql<number>`(SELECT count(*) FROM user_article_states WHERE user_id = ${schema.users.id})`,
        readingLists: sql<number>`(SELECT count(*) FROM reading_lists WHERE user_id = ${schema.users.id})`,
        feeds: sql<number>`(SELECT count(*) FROM feeds WHERE submitted_by_user_id = ${schema.users.id})`,
      })
      .from(schema.users)
      .orderBy(schema.users.name);

    return NextResponse.json(userList);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { userId, isAdmin } = body;

    if (!userId || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'userId and isAdmin required' }, { status: 400 });
    }

    const [updated] = await db
      .update(schema.users)
      .set({ isAdmin })
      .where(eq(schema.users.id, userId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
