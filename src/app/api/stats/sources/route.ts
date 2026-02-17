import { NextResponse } from 'next/server';
import { sql, gte, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET() {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sources = await db
      .select({
        name: schema.feeds.name,
        count: sql<number>`count(*)`,
      })
      .from(schema.articles)
      .innerJoin(schema.feeds, sql`${schema.articles.feedId} = ${schema.feeds.id}`)
      .where(gte(schema.articles.createdAt, todayStart))
      .groupBy(schema.feeds.name)
      .orderBy(desc(sql`count(*)`))
      .limit(7);

    return NextResponse.json(sources.map(s => ({ name: s.name, count: Number(s.count) })));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
