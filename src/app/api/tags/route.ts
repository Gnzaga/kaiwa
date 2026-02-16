import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET() {
  try {
    const tags = await db
      .select({
        tag: sql<string>`tag`,
        count: sql<number>`count(*)`,
      })
      .from(
        sql`${schema.articles}, jsonb_array_elements_text(${schema.articles.summaryTags}) AS tag`,
      )
      .where(sql`${schema.articles.summaryTags} IS NOT NULL`)
      .groupBy(sql`tag`)
      .orderBy(sql`count(*) DESC`);

    return NextResponse.json(tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
