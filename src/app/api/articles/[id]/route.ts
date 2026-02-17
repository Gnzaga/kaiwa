import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';
import { boss, ensureBossStarted, QUEUE_SCRAPE, QUEUE_TRANSLATION, QUEUE_SUMMARIZATION } from '@/lib/queue';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const rows = await db
      .select({
        article: schema.articles,
        feed: schema.feeds,
        isRead: sql<boolean>`COALESCE(${schema.userArticleStates.isRead}, false)`,
        isStarred: sql<boolean>`COALESCE(${schema.userArticleStates.isStarred}, false)`,
        isArchived: sql<boolean>`COALESCE(${schema.userArticleStates.isArchived}, false)`,
      })
      .from(schema.articles)
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .leftJoin(
        schema.userArticleStates,
        and(
          eq(schema.userArticleStates.articleId, schema.articles.id),
          eq(schema.userArticleStates.userId, userId),
        ),
      )
      .where(eq(schema.articles.id, articleId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const row = rows[0];
    const article = {
      ...row.article,
      feed: row.feed,
      sourceName: row.feed?.sourceName,
      isRead: row.isRead,
      isStarred: row.isStarred,
      isArchived: row.isArchived,
    };

    // Find related articles by matching tags
    const tags = row.article.summaryTags as string[] | null;
    let relatedArticles: Record<string, unknown>[] = [];
    if (tags && tags.length > 0) {
      const relatedRows = await db
        .select({
          id: schema.articles.id,
          originalTitle: schema.articles.originalTitle,
          translatedTitle: schema.articles.translatedTitle,
          originalUrl: schema.articles.originalUrl,
          publishedAt: schema.articles.publishedAt,
          summaryTldr: schema.articles.summaryTldr,
          summaryTags: schema.articles.summaryTags,
          summarySentiment: schema.articles.summarySentiment,
          summaryStatus: schema.articles.summaryStatus,
          translationStatus: schema.articles.translationStatus,
          translationProvider: schema.articles.translationProvider,
          sourceLanguage: schema.articles.sourceLanguage,
          imageUrl: schema.articles.imageUrl,
          feedId: schema.articles.feedId,
          sourceName: schema.feeds.sourceName,
          isRead: sql<boolean>`COALESCE(${schema.userArticleStates.isRead}, false)`,
          isStarred: sql<boolean>`COALESCE(${schema.userArticleStates.isStarred}, false)`,
          isArchived: sql<boolean>`COALESCE(${schema.userArticleStates.isArchived}, false)`,
        })
        .from(schema.articles)
        .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
        .leftJoin(
          schema.userArticleStates,
          and(
            eq(schema.userArticleStates.articleId, schema.articles.id),
            eq(schema.userArticleStates.userId, userId),
          ),
        )
        .where(
          and(
            sql`${schema.articles.id} != ${articleId}`,
            sql`${schema.articles.summaryTags} ?| array[${sql.join(tags.map((t) => sql`${t}`), sql`, `)}]`,
          ),
        )
        .orderBy(desc(schema.articles.publishedAt))
        .limit(5);

      relatedArticles = relatedRows;
    }

    return NextResponse.json({ article, related: relatedArticles });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const article = await db.query.articles.findFirst({
      where: eq(schema.articles.id, articleId),
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const body = await request.json();

    // For toggle actions, upsert into userArticleStates
    if (body.type === 'toggleRead' || body.type === 'toggleStar' || body.type === 'toggleArchive') {
      // Get current state
      const existing = await db.query.userArticleStates.findFirst({
        where: and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.articleId, articleId),
        ),
      });

      const now = new Date();
      let stateUpdate: Record<string, unknown> = { updatedAt: now };

      switch (body.type) {
        case 'toggleRead': {
          const newVal = !(existing?.isRead ?? false);
          stateUpdate.isRead = newVal;
          stateUpdate.readAt = newVal ? now : null;
          break;
        }
        case 'toggleStar': {
          const newVal = !(existing?.isStarred ?? false);
          stateUpdate.isStarred = newVal;
          stateUpdate.starredAt = newVal ? now : null;
          break;
        }
        case 'toggleArchive': {
          const newVal = !(existing?.isArchived ?? false);
          stateUpdate.isArchived = newVal;
          stateUpdate.archivedAt = newVal ? now : null;
          break;
        }
      }

      if (existing) {
        await db
          .update(schema.userArticleStates)
          .set(stateUpdate)
          .where(
            and(
              eq(schema.userArticleStates.userId, userId),
              eq(schema.userArticleStates.articleId, articleId),
            ),
          );
      } else {
        await db.insert(schema.userArticleStates).values({
          userId,
          articleId,
          isRead: false,
          isStarred: false,
          isArchived: false,
          ...stateUpdate,
        });
      }

      // Return the updated article with user state
      const state = existing
        ? { ...existing, ...stateUpdate }
        : { isRead: false, isStarred: false, isArchived: false, ...stateUpdate };

      return NextResponse.json({
        ...article,
        isRead: state.isRead,
        isStarred: state.isStarred,
        isArchived: state.isArchived,
      });
    }

    // Article-level operations (retranslate, resummarize, rescrape)
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    switch (body.type) {
      case 'retranslate':
        updates.translationStatus = 'pending';
        updates.translationError = null;
        await ensureBossStarted();
        await boss.send(QUEUE_TRANSLATION, { articleId });
        break;
      case 'resummarize':
        updates.summaryStatus = 'pending';
        updates.summaryError = null;
        await ensureBossStarted();
        await boss.send(QUEUE_SUMMARIZATION, { articleId });
        break;
      case 'rescrape':
        updates.translationStatus = 'pending';
        updates.summaryStatus = 'pending';
        await ensureBossStarted();
        await boss.send(QUEUE_SCRAPE, { articleId });
        break;
      default:
        break;
    }

    const [updated] = await db
      .update(schema.articles)
      .set(updates)
      .where(eq(schema.articles.id, articleId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
