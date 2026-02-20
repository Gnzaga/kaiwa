import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';
import { getQueryEmbedding } from '@/lib/embed';

const PAGE_SIZE = 20;

type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const params = request.nextUrl.searchParams;
    const q = params.get('q');
    const page = Math.max(1, parseInt(params.get('page') ?? '1', 10));
    const sort = params.get('sort') ?? 'relevance'; // 'relevance' | 'newest' | 'oldest'
    const mode = (params.get('mode') ?? 'keyword') as SearchMode;
    const region = params.get('region');
    const category = params.get('category');
    const source = params.get('source');
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    const tags = params.get('tags');
    const sentiment = params.get('sentiment');

    if (!q) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    // Build shared filter conditions (no FTS/vector conditions here)
    const filterConditions: ReturnType<typeof sql>[] = [];

    if (region) {
      filterConditions.push(sql`${schema.feeds.regionId} = ${region}`);
    }
    if (category) {
      filterConditions.push(sql`${schema.categories.slug} = ${category}`);
      if (region) {
        filterConditions.push(sql`${schema.categories.regionId} = ${region}`);
      }
    }
    if (source) {
      filterConditions.push(sql`${schema.feeds.sourceName} = ${source}`);
    }
    if (dateFrom) {
      filterConditions.push(sql`${schema.articles.publishedAt} >= ${dateFrom}`);
    }
    if (dateTo) {
      filterConditions.push(sql`${schema.articles.publishedAt} <= ${dateTo}`);
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      filterConditions.push(sql`${schema.articles.summaryTags} ?| array[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]`);
    }
    if (sentiment) {
      filterConditions.push(sql`${schema.articles.summarySentiment} = ${sentiment}`);
    }

    const offset = (page - 1) * PAGE_SIZE;

    // Determine if we need vector search
    const needsVector = mode === 'semantic' || mode === 'hybrid';
    let queryEmbedding: number[] | null = null;

    if (needsVector) {
      try {
        queryEmbedding = await getQueryEmbedding(q);
      } catch (err) {
        console.error('[search] Embedder unavailable, falling back to keyword:', err);
        // Fall back to keyword-only if embedder is down
        if (mode === 'semantic') {
          // For pure semantic, we can't do anything without embeddings
          // Fall back to keyword search
        }
      }
    }

    const effectiveMode: SearchMode = (needsVector && !queryEmbedding) ? 'keyword' : mode;

    if (effectiveMode === 'keyword') {
      return await keywordSearch(q, filterConditions, sort, offset, userId, page);
    }

    if (effectiveMode === 'semantic' && queryEmbedding) {
      return await semanticSearch(queryEmbedding, filterConditions, sort, offset, userId, page);
    }

    if (effectiveMode === 'hybrid' && queryEmbedding) {
      return await hybridSearch(q, queryEmbedding, filterConditions, sort, userId, page);
    }

    // Shouldn't reach here, but fallback to keyword
    return await keywordSearch(q, filterConditions, sort, offset, userId, page);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const selectFields = {
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
  sourceLanguage: schema.articles.sourceLanguage,
  imageUrl: sql<string | null>`COALESCE(${schema.articles.imageUrl}, (regexp_match(COALESCE(${schema.articles.translatedContent}, ${schema.articles.originalContent}, ''), '<img[^>]+src="([^"]+)"'))[1])`,
  feedSourceName: schema.feeds.sourceName,
  feedRegionId: schema.feeds.regionId,
  categorySlug: schema.categories.slug,
};

function baseQuery(userId: string) {
  return db
    .select({
      ...selectFields,
      isRead: sql<boolean>`COALESCE(${schema.userArticleStates.isRead}, false)`,
      isStarred: sql<boolean>`COALESCE(${schema.userArticleStates.isStarred}, false)`,
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
    );
}

function countQuery(userId: string) {
  return db
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
    );
}

function transformImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `/api/images/${url}`;
}

const tsvector = sql`to_tsvector('english', COALESCE(${schema.articles.translatedTitle}, '') || ' ' || COALESCE(${schema.articles.translatedContent}, '') || ' ' || COALESCE(${schema.articles.summaryTldr}, ''))`;

async function keywordSearch(
  q: string,
  filterConditions: ReturnType<typeof sql>[],
  sort: string,
  offset: number,
  userId: string,
  page: number,
) {
  const ftsCondition = sql`${tsvector} @@ plainto_tsquery('english', ${q})`;
  const where = and(ftsCondition, ...filterConditions);
  const rankExpr = sql<number>`ts_rank(${tsvector}, plainto_tsquery('english', ${q}))`;

  const [articles, countResult] = await Promise.all([
    baseQuery(userId)
      .where(where)
      .orderBy(
        sort === 'newest' ? sql`${schema.articles.publishedAt} DESC`
          : sort === 'oldest' ? sql`${schema.articles.publishedAt} ASC`
          : sql`${rankExpr} DESC`
      )
      .limit(PAGE_SIZE)
      .offset(offset),
    countQuery(userId).where(where),
  ]);

  return NextResponse.json({
    data: articles.map(a => ({ ...a, imageUrl: transformImageUrl(a.imageUrl) })),
    total: Number(countResult[0].count),
    page,
    pageSize: PAGE_SIZE,
  });
}

async function semanticSearch(
  queryEmbedding: number[],
  filterConditions: ReturnType<typeof sql>[],
  sort: string,
  offset: number,
  userId: string,
  page: number,
) {
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const hasEmbedding = sql`articles.embedding IS NOT NULL`;
  const where = and(hasEmbedding, ...filterConditions);
  const distanceExpr = sql<number>`embedding <=> ${vectorStr}::vector`;

  const [articles, countResult] = await Promise.all([
    db
      .select({
        ...selectFields,
        isRead: sql<boolean>`COALESCE(${schema.userArticleStates.isRead}, false)`,
        isStarred: sql<boolean>`COALESCE(${schema.userArticleStates.isStarred}, false)`,
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
      .orderBy(
        sort === 'newest' ? sql`${schema.articles.publishedAt} DESC`
          : sort === 'oldest' ? sql`${schema.articles.publishedAt} ASC`
          : distanceExpr
      )
      .limit(PAGE_SIZE)
      .offset(offset),
    countQuery(userId).where(where),
  ]);

  return NextResponse.json({
    data: articles.map(a => ({ ...a, imageUrl: transformImageUrl(a.imageUrl) })),
    total: Number(countResult[0].count),
    page,
    pageSize: PAGE_SIZE,
  });
}

async function hybridSearch(
  q: string,
  queryEmbedding: number[],
  filterConditions: ReturnType<typeof sql>[],
  sort: string,
  userId: string,
  page: number,
) {
  // For non-relevance sorts, just use keyword search with the sort
  if (sort === 'newest' || sort === 'oldest') {
    const offset = (page - 1) * PAGE_SIZE;
    return await keywordSearch(q, filterConditions, sort, offset, userId, page);
  }

  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const filterWhere = filterConditions.length > 0 ? and(...filterConditions) : undefined;

  // Reciprocal Rank Fusion: fetch top 100 from each method, fuse with 1/(60+rank)
  const [keywordResults, semanticResults] = await Promise.all([
    // Keyword top 100
    db
      .select({
        id: schema.articles.id,
        rank: sql<number>`ts_rank(${tsvector}, plainto_tsquery('english', ${q}))`,
      })
      .from(schema.articles)
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .leftJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
      .where(and(
        sql`${tsvector} @@ plainto_tsquery('english', ${q})`,
        filterWhere,
      ))
      .orderBy(sql`ts_rank(${tsvector}, plainto_tsquery('english', ${q})) DESC`)
      .limit(100),

    // Semantic top 100
    db
      .select({
        id: schema.articles.id,
        distance: sql<number>`embedding <=> ${vectorStr}::vector`,
      })
      .from(schema.articles)
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .leftJoin(schema.categories, eq(schema.feeds.categoryId, schema.categories.id))
      .where(and(
        sql`embedding IS NOT NULL`,
        filterWhere,
      ))
      .orderBy(sql`embedding <=> ${vectorStr}::vector`)
      .limit(100),
  ]);

  // Compute RRF scores
  const scores = new Map<number, number>();

  keywordResults.forEach((row, idx) => {
    const rrf = 1 / (60 + idx);
    scores.set(row.id, (scores.get(row.id) ?? 0) + rrf);
  });

  semanticResults.forEach((row, idx) => {
    const rrf = 1 / (60 + idx);
    scores.set(row.id, (scores.get(row.id) ?? 0) + rrf);
  });

  // Sort by fused score, paginate
  const sorted = [...scores.entries()]
    .sort((a, b) => b[1] - a[1]);

  const total = sorted.length;
  const offset = (page - 1) * PAGE_SIZE;
  const pageIds = sorted.slice(offset, offset + PAGE_SIZE).map(([id]) => id);

  if (pageIds.length === 0) {
    return NextResponse.json({ data: [], total: 0, page, pageSize: PAGE_SIZE });
  }

  // Fetch full article data for the page
  const articles = await db
    .select({
      ...selectFields,
      isRead: sql<boolean>`COALESCE(${schema.userArticleStates.isRead}, false)`,
      isStarred: sql<boolean>`COALESCE(${schema.userArticleStates.isStarred}, false)`,
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
    .where(sql`${schema.articles.id} = ANY(${pageIds})`);

  // Re-sort by RRF score
  const scoreMap = new Map(sorted);
  articles.sort((a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0));

  return NextResponse.json({
    data: articles.map(a => ({ ...a, imageUrl: transformImageUrl(a.imageUrl) })),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}
