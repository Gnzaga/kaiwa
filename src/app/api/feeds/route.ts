import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';
import { discoverFeed, createFeed, getOrCreateCategory } from '@/lib/miniflux';

export async function GET() {
  try {
    await requireSession();
    const feeds = await db.select().from(schema.feeds).orderBy(schema.feeds.name);
    return NextResponse.json(feeds);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    // User feed submission flow (simplified body with url)
    if (body.url && !body.minifluxFeedId) {
      const { url, regionId, categoryId, sourceLanguage } = body;
      if (!url || !regionId || !categoryId) {
        return NextResponse.json(
          { error: 'Missing required fields: url, regionId, categoryId' },
          { status: 400 },
        );
      }

      // Discover feed via Miniflux
      const discovered = await discoverFeed(url);
      if (!discovered || discovered.length === 0) {
        return NextResponse.json(
          { error: 'No valid feed found at this URL' },
          { status: 400 },
        );
      }

      const feedUrl = discovered[0].url;
      const feedTitle = discovered[0].title || new URL(url).hostname;

      // Get or create "User Feeds" category in Miniflux
      const minifluxCategoryId = await getOrCreateCategory('User Feeds');

      // Create feed in Miniflux
      let minifluxFeedId: number;
      try {
        const result = await createFeed({ feed_url: feedUrl, category_id: minifluxCategoryId });
        minifluxFeedId = result.feed_id;
      } catch (err) {
        // Handle duplicate — Miniflux returns 409
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('409')) {
          return NextResponse.json(
            { error: 'This feed already exists in the system' },
            { status: 409 },
          );
        }
        throw err;
      }

      // Insert into local feeds table
      const [feed] = await db
        .insert(schema.feeds)
        .values({
          minifluxFeedId,
          name: feedTitle,
          url: feedUrl,
          regionId,
          categoryId,
          sourceLanguage: sourceLanguage ?? 'en',
          sourceName: new URL(url).hostname,
          submittedByUserId: session.user.id,
        })
        .returning();

      return NextResponse.json(feed, { status: 201 });
    }

    // System feed creation (original flow for admin)
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
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
