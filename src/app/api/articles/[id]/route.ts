import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { boss, ensureBossStarted, QUEUE_SCRAPE, QUEUE_TRANSLATION, QUEUE_SUMMARIZATION } from '@/lib/queue';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const article = await db.query.articles.findFirst({
      where: eq(schema.articles.id, articleId),
      with: { feed: true },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json({ article, related: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    switch (body.type) {
      case 'toggleRead':
        updates.isRead = !article.isRead;
        break;
      case 'toggleStar':
        updates.isStarred = !article.isStarred;
        break;
      case 'toggleArchive':
        updates.isArchived = !article.isArchived;
        break;
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
        // Legacy: direct boolean fields
        if (typeof body.isRead === 'boolean') updates.isRead = body.isRead;
        if (typeof body.isStarred === 'boolean') updates.isStarred = body.isStarred;
        if (typeof body.isArchived === 'boolean') updates.isArchived = body.isArchived;
        break;
    }

    const [updated] = await db
      .update(schema.articles)
      .set(updates)
      .where(eq(schema.articles.id, articleId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
