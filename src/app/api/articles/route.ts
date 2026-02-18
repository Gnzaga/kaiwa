import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, asc, and, sql, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get('page') ?? '1', 10));
    const region = params.get('region');
    const category = params.get('category'); // category slug
    const source = params.get('source');
    const translationStatus = params.get('translationStatus');
    const summaryStatus = params.get('summaryStatus');
    const tags = params.get('tags') ?? params.get('tag'); // tags=comma-separated or tag=single
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    const isRead = params.get('isRead');
    const isStarred = params.get('isStarred');
    const isArchived = params.get('isArchived');
    const sentiment = params.get('sentiment');
    const language = params.get('language');
    const sort = params.get('sort') ?? 'newest';
    const q = params.get('q');
    const minReadingMinutes = params.get('minReadingMinutes');
    const maxReadingMinutes = params.get('maxReadingMinutes');
    const ids = params.get('ids');

    const conditions = [];

    if (region) {
      conditions.push(eq(schema.feeds.regionId, region));
    }
    if (category) {
      // Filter by category slug within the region
      conditions.push(eq(schema.categories.slug, category));
      if (region) {
        conditions.push(eq(schema.categories.regionId, region));
      }
    }
    if (source) {
      conditions.push(eq(schema.feeds.sourceName, source));
    }
    if (translationStatus) {
      conditions.push(eq(schema.articles.translationStatus, translationStatus as 'pending' | 'translating' | 'complete' | 'error'));
    }
    if (summaryStatus) {
      conditions.push(eq(schema.articles.summaryStatus, summaryStatus as 'pending' | 'summarizing' | 'complete' | 'error'));
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      conditions.push(sql`${schema.articles.summaryTags} ?| array[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]`);
    }
    if (dateFrom) {
      conditions.push(sql`${schema.articles.publishedAt} >= ${dateFrom}`);
    }
    if (dateTo) {
      conditions.push(sql`${schema.articles.publishedAt} <= ${dateTo}`);
    }
    if (isRead !== null && isRead !== undefined) {
      conditions.push(sql`COALESCE(${schema.userArticleStates.isRead}, false) = ${isRead === 'true'}`);
    }
    if (isStarred !== null && isStarred !== undefined) {
      conditions.push(sql`COALESCE(${schema.userArticleStates.isStarred}, false) = ${isStarred === 'true'}`);
    }
    if (isArchived !== null && isArchived !== undefined) {
      conditions.push(sql`COALESCE(${schema.userArticleStates.isArchived}, false) = ${isArchived === 'true'}`);
    }
    if (sentiment) {
      conditions.push(eq(schema.articles.summarySentiment, sentiment));
    }
    if (language) {
      conditions.push(eq(schema.articles.sourceLanguage, language));
    }
    if (q) {
      conditions.push(sql`(COALESCE(${schema.articles.translatedTitle}, ${schema.articles.originalTitle}) ILIKE ${'%' + q.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%'})`);
    }
    if (minReadingMinutes) {
      conditions.push(sql`CEIL(char_length(COALESCE(${schema.articles.translatedContent}, ${schema.articles.originalContent}, '')) / 1000.0) >= ${parseInt(minReadingMinutes, 10)}`);
    }
    if (maxReadingMinutes) {
      conditions.push(sql`CEIL(char_length(COALESCE(${schema.articles.translatedContent}, ${schema.articles.originalContent}, '')) / 1000.0) <= ${parseInt(maxReadingMinutes, 10)}`);
    }
    if (ids) {
      const idList = ids.split(',').map(n => parseInt(n, 10)).filter(n => !isNaN(n));
      if (idList.length > 0) {
        conditions.push(inArray(schema.articles.id, idList));
      }
    }

    // Exclude muted sources for this user
    const mutedRows = await db
      .select({ feedId: schema.userMutedSources.feedId })
      .from(schema.userMutedSources)
      .where(eq(schema.userMutedSources.userId, userId));
    if (mutedRows.length > 0) {
      conditions.push(sql`${schema.articles.feedId} NOT IN (${sql.join(mutedRows.map(r => sql`${r.feedId}`), sql`, `)})`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy;
    switch (sort) {
      case 'oldest':
        orderBy = asc(schema.articles.publishedAt);
        break;
      case 'source':
        orderBy = asc(schema.feeds.sourceName);
        break;
      case 'sentiment':
        orderBy = asc(schema.articles.summarySentiment);
        break;
      case 'unread_first':
        orderBy = sql`COALESCE(${schema.userArticleStates.isRead}, false) ASC, ${schema.articles.publishedAt} DESC`;
        break;
      case 'quickest':
        orderBy = sql`CEIL(char_length(COALESCE(${schema.articles.translatedContent}, ${schema.articles.originalContent}, '')) / 1000.0) ASC`;
        break;
      default:
        orderBy = desc(schema.articles.publishedAt);
    }

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
          translationProvider: schema.articles.translationProvider,
          summaryStatus: schema.articles.summaryStatus,
          summaryTldr: schema.articles.summaryTldr,
          summaryTags: schema.articles.summaryTags,
          summarySentiment: schema.articles.summarySentiment,
          isRead: sql<boolean>`COALESCE(${schema.userArticleStates.isRead}, false)`,
          isStarred: sql<boolean>`COALESCE(${schema.userArticleStates.isStarred}, false)`,
          isArchived: sql<boolean>`COALESCE(${schema.userArticleStates.isArchived}, false)`,
          readAt: schema.userArticleStates.readAt,
          sourceLanguage: schema.articles.sourceLanguage,
          imageUrl: schema.articles.imageUrl,
          feedSourceName: schema.feeds.sourceName,
          feedRegionId: schema.feeds.regionId,
          categorySlug: schema.categories.slug,
          readingMinutes: sql<number>`CEIL(char_length(COALESCE(${schema.articles.translatedContent}, ${schema.articles.originalContent}, '')) / 1000.0)`,
        })
        .from(schema.articles)
        .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
        .leftJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
        .leftJoin(
          schema.userArticleStates,
          and(
            eq(schema.userArticleStates.articleId, schema.articles.id),
            eq(schema.userArticleStates.userId, userId),
          ),
        )
        .where(where)
        .orderBy(orderBy)
        .limit(PAGE_SIZE)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
        .leftJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
        .leftJoin(
          schema.userArticleStates,
          and(
            eq(schema.userArticleStates.articleId, schema.articles.id),
            eq(schema.userArticleStates.userId, userId),
          ),
        )
        .where(where),
    ]);

    return NextResponse.json({
      data: articles,
      total: Number(countResult[0].count),
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
