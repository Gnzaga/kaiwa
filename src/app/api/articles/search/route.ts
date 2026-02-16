import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = params.get('q');
    const page = Math.max(1, parseInt(params.get('page') ?? '1', 10));
    const region = params.get('region');
    const category = params.get('category');
    const source = params.get('source');
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    const tags = params.get('tags');

    if (!q) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const conditions = [
      sql`to_tsvector('english', COALESCE(${schema.articles.translatedTitle}, '') || ' ' || COALESCE(${schema.articles.translatedContent}, '') || ' ' || COALESCE(${schema.articles.summaryTldr}, '')) @@ plainto_tsquery('english', ${q})`,
    ];

    if (region) {
      conditions.push(eq(schema.feeds.regionId, region));
    }
    if (category) {
      conditions.push(eq(schema.categories.slug, category));
      if (region) {
        conditions.push(eq(schema.categories.regionId, region));
      }
    }
    if (source) {
      conditions.push(eq(schema.feeds.sourceName, source));
    }
    if (dateFrom) {
      conditions.push(sql`${schema.articles.publishedAt} >= ${dateFrom}`);
    }
    if (dateTo) {
      conditions.push(sql`${schema.articles.publishedAt} <= ${dateTo}`);
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      conditions.push(sql`${schema.articles.summaryTags} ?| array[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]`);
    }

    const where = and(...conditions);
    const offset = (page - 1) * PAGE_SIZE;

    const [articles, countResult] = await Promise.all([
      db
        .select({
          id: schema.articles.id,
          originalTitle: schema.articles.originalTitle,
          originalUrl: schema.articles.originalUrl,
          translatedTitle: schema.articles.translatedTitle,
          publishedAt: schema.articles.publishedAt,
          translationStatus: schema.articles.translationStatus,
          summaryStatus: schema.articles.summaryStatus,
          summaryTldr: schema.articles.summaryTldr,
          summaryTags: schema.articles.summaryTags,
          summarySentiment: schema.articles.summarySentiment,
          isRead: schema.articles.isRead,
          isStarred: schema.articles.isStarred,
          sourceLanguage: schema.articles.sourceLanguage,
          imageUrl: schema.articles.imageUrl,
          feedSourceName: schema.feeds.sourceName,
          feedRegionId: schema.feeds.regionId,
          categorySlug: schema.categories.slug,
          rank: sql<number>`ts_rank(to_tsvector('english', COALESCE(${schema.articles.translatedTitle}, '') || ' ' || COALESCE(${schema.articles.translatedContent}, '') || ' ' || COALESCE(${schema.articles.summaryTldr}, '')), plainto_tsquery('english', ${q}))`,
        })
        .from(schema.articles)
        .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
        .leftJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
        .where(where)
        .orderBy(sql`rank DESC`)
        .limit(PAGE_SIZE)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
        .leftJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
        .where(where),
    ]);

    return NextResponse.json({
      data: articles,
      total: Number(countResult[0].count),
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
