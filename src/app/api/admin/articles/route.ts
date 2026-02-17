import { NextRequest, NextResponse } from 'next/server';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth-helpers';
import { boss, ensureBossStarted, QUEUE_TRANSLATION, QUEUE_SUMMARIZATION, QUEUE_SCRAPE } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { action, articleIds, filter } = body;

    // Bulk operations on articles
    switch (action) {
      case 'requeue-translate': {
        const ids = articleIds ?? await getFilteredIds(filter, 'translation');
        await ensureBossStarted();
        await db
          .update(schema.articles)
          .set({ translationStatus: 'pending', translationError: null, updatedAt: new Date() })
          .where(inArray(schema.articles.id, ids));
        for (const id of ids) {
          await boss.send(QUEUE_TRANSLATION, { articleId: id });
        }
        return NextResponse.json({ queued: ids.length, action });
      }

      case 'requeue-summarize': {
        const ids = articleIds ?? await getFilteredIds(filter, 'summary');
        await ensureBossStarted();
        await db
          .update(schema.articles)
          .set({ summaryStatus: 'pending', summaryError: null, updatedAt: new Date() })
          .where(inArray(schema.articles.id, ids));
        for (const id of ids) {
          await boss.send(QUEUE_SUMMARIZATION, { articleId: id });
        }
        return NextResponse.json({ queued: ids.length, action });
      }

      case 'requeue-scrape': {
        const ids = articleIds ?? await getFilteredIds(filter, 'scrape');
        await ensureBossStarted();
        await db
          .update(schema.articles)
          .set({ translationStatus: 'pending', summaryStatus: 'pending', updatedAt: new Date() })
          .where(inArray(schema.articles.id, ids));
        for (const id of ids) {
          await boss.send(QUEUE_SCRAPE, { articleId: id });
        }
        return NextResponse.json({ queued: ids.length, action });
      }

      case 'reset-errors': {
        // Reset all errored articles back to pending
        const [translateResult] = await db
          .update(schema.articles)
          .set({ translationStatus: 'pending', translationError: null, updatedAt: new Date() })
          .where(eq(schema.articles.translationStatus, 'error'))
          .returning({ id: schema.articles.id });

        const [summaryResult] = await db
          .update(schema.articles)
          .set({ summaryStatus: 'pending', summaryError: null, updatedAt: new Date() })
          .where(eq(schema.articles.summaryStatus, 'error'))
          .returning({ id: schema.articles.id });

        return NextResponse.json({
          translationReset: translateResult ? 1 : 0,
          summaryReset: summaryResult ? 1 : 0,
          action,
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getFilteredIds(filter: string | undefined, type: string): Promise<number[]> {
  let condition;
  switch (filter) {
    case 'error':
      condition = type === 'translation'
        ? eq(schema.articles.translationStatus, 'error')
        : type === 'summary'
          ? eq(schema.articles.summaryStatus, 'error')
          : and(eq(schema.articles.translationStatus, 'error'), eq(schema.articles.summaryStatus, 'error'));
      break;
    case 'pending':
      condition = type === 'translation'
        ? eq(schema.articles.translationStatus, 'pending')
        : type === 'summary'
          ? eq(schema.articles.summaryStatus, 'pending')
          : eq(schema.articles.translationStatus, 'pending');
      break;
    default:
      // Default: all errored
      condition = type === 'translation'
        ? eq(schema.articles.translationStatus, 'error')
        : eq(schema.articles.summaryStatus, 'error');
  }

  const rows = await db
    .select({ id: schema.articles.id })
    .from(schema.articles)
    .where(condition)
    .limit(500);

  return rows.map(r => r.id);
}
