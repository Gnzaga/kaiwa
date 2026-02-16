import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { boss, ensureBossStarted, QUEUE_SCRAPE } from '@/lib/queue';

export async function POST(
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
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Reset statuses and enqueue the full pipeline: scrape → translate → summarize
    await db
      .update(schema.articles)
      .set({
        translationStatus: 'pending',
        summaryStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(schema.articles.id, articleId));

    await ensureBossStarted();
    await boss.send(QUEUE_SCRAPE, { articleId });

    return NextResponse.json({ articleId, queued: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
