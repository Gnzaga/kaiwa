import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

// GET — list muted feed IDs for current user
export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const rows = await db
      .select({ feedId: schema.userMutedSources.feedId })
      .from(schema.userMutedSources)
      .where(eq(schema.userMutedSources.userId, userId));
    return NextResponse.json(rows.map((r) => r.feedId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST { feedId } — mute a source
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { feedId } = await request.json();
    if (!feedId || typeof feedId !== 'number') {
      return NextResponse.json({ error: 'feedId required' }, { status: 400 });
    }
    await db
      .insert(schema.userMutedSources)
      .values({ userId, feedId })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE { feedId } — unmute a source
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { feedId } = await request.json();
    if (!feedId || typeof feedId !== 'number') {
      return NextResponse.json({ error: 'feedId required' }, { status: 400 });
    }
    await db
      .delete(schema.userMutedSources)
      .where(
        and(
          eq(schema.userMutedSources.userId, userId),
          eq(schema.userMutedSources.feedId, feedId),
        ),
      );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
