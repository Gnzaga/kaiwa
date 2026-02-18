import { NextResponse } from 'next/server';
import { eq, and, isNotNull, sql, count } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const [{ total }] = await db
      .select({ total: count() })
      .from(schema.userArticleStates)
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          isNotNull(schema.userArticleStates.note),
          sql`${schema.userArticleStates.note} != ''`,
        ),
      );

    return NextResponse.json({ count: total });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json({ count: 0 });
  }
}
