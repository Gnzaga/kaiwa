import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET() {
  try {
    const regions = await db.query.regions.findMany({
      where: eq(schema.regions.enabled, true),
      orderBy: asc(schema.regions.sortOrder),
      with: {
        categories: {
          where: eq(schema.categories.enabled, true),
          orderBy: asc(schema.categories.sortOrder),
        },
      },
    });

    return NextResponse.json(regions);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
