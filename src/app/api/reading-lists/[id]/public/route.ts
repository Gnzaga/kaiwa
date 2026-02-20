import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listId = parseInt(id, 10);
    if (isNaN(listId)) {
      return NextResponse.json({ error: 'Invalid list ID' }, { status: 400 });
    }

    const list = await db.query.readingLists.findFirst({
      where: eq(schema.readingLists.id, listId),
    });

    if (!list || !list.isPublic) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const items = await db
      .select({
        itemId: schema.readingListItems.id,
        sortOrder: schema.readingListItems.sortOrder,
        addedAt: schema.readingListItems.addedAt,
        articleId: schema.articles.id,
        originalTitle: schema.articles.originalTitle,
        translatedTitle: schema.articles.translatedTitle,
        originalUrl: schema.articles.originalUrl,
        publishedAt: schema.articles.publishedAt,
        summaryTldr: schema.articles.summaryTldr,
        summaryTags: schema.articles.summaryTags,
        imageUrl: sql<string | null>`COALESCE(${schema.articles.imageUrl}, (regexp_match(COALESCE(${schema.articles.translatedContent}, ${schema.articles.originalContent}, ''), '<img[^>]+src="([^"]+)"'))[1])`,
        feedSourceName: schema.feeds.sourceName,
        count: sql<number>`count(*) over ()`,
      })
      .from(schema.readingListItems)
      .innerJoin(schema.articles, eq(schema.readingListItems.articleId, schema.articles.id))
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(eq(schema.readingListItems.readingListId, listId))
      .orderBy(schema.readingListItems.sortOrder);

    return NextResponse.json({
      list,
      data: items.map(a => ({
        ...a,
        imageUrl: a.imageUrl
          ? (a.imageUrl as string).startsWith('http') ? a.imageUrl : `/api/images/${a.imageUrl}`
          : null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
