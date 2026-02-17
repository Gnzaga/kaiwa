import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

const DEFAULTS = {
  defaultRegionId: null,
  theme: 'system' as const,
  articlesPerPage: 20,
  autoMarkRead: true,
};

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const prefs = await db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, userId),
    });

    return NextResponse.json(prefs ?? { userId, ...DEFAULTS });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if ('defaultRegionId' in body) updates.defaultRegionId = body.defaultRegionId;
    if ('theme' in body && ['system', 'dark', 'light'].includes(body.theme)) updates.theme = body.theme;
    if ('articlesPerPage' in body && typeof body.articlesPerPage === 'number') {
      updates.articlesPerPage = Math.min(100, Math.max(5, body.articlesPerPage));
    }
    if ('autoMarkRead' in body && typeof body.autoMarkRead === 'boolean') updates.autoMarkRead = body.autoMarkRead;

    const existing = await db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, userId),
    });

    let result;
    if (existing) {
      [result] = await db
        .update(schema.userPreferences)
        .set(updates)
        .where(eq(schema.userPreferences.userId, userId))
        .returning();
    } else {
      [result] = await db
        .insert(schema.userPreferences)
        .values({ userId, ...DEFAULTS, ...updates })
        .returning();
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
