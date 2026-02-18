import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { action } = await request.json();

    if (action === 'enable-all') {
      await db.update(schema.feeds).set({ enabled: true });
      return NextResponse.json({ ok: true, action });
    }
    if (action === 'disable-all') {
      await db.update(schema.feeds).set({ enabled: false });
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
