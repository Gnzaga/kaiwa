import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    await requireSession();

    const feeds = await db
      .select({
        id: schema.feeds.id,
        name: schema.feeds.name,
        url: schema.feeds.url,
        sourceName: schema.feeds.sourceName,
        regionName: schema.regions.name,
        categoryName: schema.categories.name,
        sourceLanguage: schema.feeds.sourceLanguage,
        enabled: schema.feeds.enabled,
      })
      .from(schema.feeds)
      .innerJoin(schema.regions, eq(schema.feeds.regionId, schema.regions.id))
      .innerJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
      .where(eq(schema.feeds.enabled, true))
      .orderBy(schema.regions.name, schema.feeds.sourceName);

    // Group feeds by region
    const byRegion = new Map<string, typeof feeds>();
    for (const feed of feeds) {
      const key = feed.regionName;
      if (!byRegion.has(key)) byRegion.set(key, []);
      byRegion.get(key)!.push(feed);
    }

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const outlines = [...byRegion.entries()].map(([region, regionFeeds]) => {
      const children = regionFeeds.map(f =>
        `    <outline type="rss" text="${esc(f.sourceName)}" title="${esc(f.sourceName)}" xmlUrl="${esc(f.url)}" category="${esc(f.categoryName)}" language="${esc(f.sourceLanguage)}" />`
      ).join('\n');
      return `  <outline text="${esc(region)}" title="${esc(region)}">\n${children}\n  </outline>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Kaiwa Feeds</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="kaiwa-feeds.opml"',
      },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
