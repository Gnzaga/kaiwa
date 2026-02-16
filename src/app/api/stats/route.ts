import { NextResponse } from 'next/server';
import { eq, and, sql, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalArticlesToday,
      translationsPending,
      summariesPending,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .where(gte(schema.articles.createdAt, todayStart)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .where(
          and(
            eq(schema.articles.translationStatus, 'pending'),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .where(
          and(
            eq(schema.articles.summaryStatus, 'pending'),
          ),
        ),
    ]);

    return NextResponse.json({
      articlesToday: Number(totalArticlesToday[0].count),
      translationsPending: Number(translationsPending[0].count),
      summariesPending: Number(summariesPending[0].count),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
