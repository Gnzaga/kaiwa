import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const feedId = parseInt(id, 10);
    if (isNaN(feedId)) {
      return NextResponse.json({ error: 'Invalid feed ID' }, { status: 400 });
    }

    const [deleted] = await db
      .delete(schema.feeds)
      .where(eq(schema.feeds.id, feedId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: feedId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
