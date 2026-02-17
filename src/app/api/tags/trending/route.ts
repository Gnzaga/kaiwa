import { NextResponse } from 'next/server';
import { sql, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const tags = await db
      .select({
        tag: sql<string>`tag`,
        count: sql<number>`count(*)`,
      })
      .from(
        sql`${schema.articles}, jsonb_array_elements_text(${schema.articles.summaryTags}) AS tag`,
      )
      .where(
        sql`${schema.articles.summaryTags} IS NOT NULL AND ${schema.articles.publishedAt} >= ${since}`,
      )
      .groupBy(sql`tag`)
      .orderBy(sql`count(*) DESC`)
      .limit(12);

    return NextResponse.json(tags.map(t => ({ tag: t.tag, count: Number(t.count) })));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
