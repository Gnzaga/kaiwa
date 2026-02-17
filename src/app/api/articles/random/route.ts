import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    // Pick a random unread article from last 7 days
    const [article] = await db
      .select({ id: schema.articles.id })
      .from(schema.articles)
      .leftJoin(
        schema.userArticleStates,
        sql`${schema.userArticleStates.articleId} = ${schema.articles.id} AND ${schema.userArticleStates.userId} = ${userId}`,
      )
      .where(
        sql`COALESCE(${schema.userArticleStates.isRead}, false) = false
          AND ${schema.articles.publishedAt} >= NOW() - INTERVAL '7 days'
          AND ${schema.articles.summaryStatus} = 'complete'`,
      )
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (!article) {
      return NextResponse.json({ error: 'No unread articles found' }, { status: 404 });
    }

    return NextResponse.json({ id: article.id });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
