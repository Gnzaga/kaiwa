import { NextResponse } from 'next/server';
import { eq, sql, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    await requireSession();

    const feeds = await db
      .select({
        id: schema.feeds.id,
        name: schema.feeds.name,
        sourceName: schema.feeds.sourceName,
        regionId: schema.feeds.regionId,
        regionName: schema.regions.name,
        regionFlag: schema.regions.flagEmoji,
        categoryId: schema.feeds.categoryId,
        categoryName: schema.categories.name,
        sourceLanguage: schema.feeds.sourceLanguage,
        enabled: schema.feeds.enabled,
        articleCount: sql<number>`COUNT(${schema.articles.id})`,
        lastArticleAt: sql<string | null>`MAX(${schema.articles.publishedAt})`,
      })
      .from(schema.feeds)
      .innerJoin(schema.regions, eq(schema.feeds.regionId, schema.regions.id))
      .innerJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
      .leftJoin(schema.articles, eq(schema.articles.feedId, schema.feeds.id))
      .groupBy(
        schema.feeds.id,
        schema.regions.name,
        schema.regions.flagEmoji,
        schema.categories.name,
      )
      .orderBy(desc(sql`COUNT(${schema.articles.id})`));

    return NextResponse.json(feeds);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
