import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { id } = await params;
    const feedId = parseInt(id, 10);
    if (isNaN(feedId)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
    }

    const feed = await db.query.feeds.findFirst({
      where: eq(schema.feeds.id, feedId),
    });

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    // Users can only delete their own submitted feeds
    if (feed.submittedByUserId !== userId) {
      return NextResponse.json({ error: 'You can only delete feeds you submitted' }, { status: 403 });
    }

    const [deleted] = await db
      .delete(schema.feeds)
      .where(eq(schema.feeds.id, feedId))
      .returning();

    return NextResponse.json({ deleted: true, id: feedId });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
