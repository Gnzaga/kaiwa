import { NextResponse } from 'next/server';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const articles = await db
      .select({
        title: sql<string>`COALESCE(${schema.articles.translatedTitle}, ${schema.articles.originalTitle})`,
        url: schema.articles.originalUrl,
        tldr: schema.articles.summaryTldr,
        tags: schema.articles.summaryTags,
        sentiment: schema.articles.summarySentiment,
        publishedAt: schema.articles.publishedAt,
        sourceName: schema.feeds.name,
      })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.isRead, true),
          sql`${schema.userArticleStates.readAt} >= ${weekAgo.toISOString()}`,
        ),
      )
      .orderBy(desc(schema.userArticleStates.readAt))
      .limit(50);

    const lines: string[] = [
      `# Weekly Reading Digest`,
      `*Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}*`,
      `*${articles.length} article${articles.length !== 1 ? 's' : ''} read this week*`,
      '',
    ];

    for (const a of articles) {
      lines.push(`## [${a.title}](${a.url})`);
      if (a.sourceName) lines.push(`*${a.sourceName} · ${new Date(a.publishedAt).toLocaleDateString()}*`);
      if (a.tldr) lines.push(``, a.tldr);
      if (a.tags && (a.tags as string[]).length > 0) {
        lines.push(``, `Tags: ${(a.tags as string[]).slice(0, 5).join(', ')}`);
      }
      lines.push('');
    }

    return NextResponse.json({ markdown: lines.join('\n'), count: articles.length });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
