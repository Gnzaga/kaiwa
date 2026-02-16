import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';

export async function GET() {
  try {
    const feeds = await db.select().from(schema.feeds).orderBy(schema.feeds.name);
    return NextResponse.json(feeds);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { minifluxFeedId, name, url, regionId, categoryId, sourceLanguage, sourceName } = body;
    if (!minifluxFeedId || !name || !url || !regionId || !categoryId || !sourceName) {
      return NextResponse.json(
        { error: 'Missing required fields: minifluxFeedId, name, url, regionId, categoryId, sourceName' },
        { status: 400 },
      );
    }

    const [feed] = await db
      .insert(schema.feeds)
      .values({
        minifluxFeedId,
        name,
        url,
        regionId,
        categoryId,
        sourceLanguage: sourceLanguage ?? 'en',
        sourceName,
      })
      .returning();

    return NextResponse.json(feed, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
