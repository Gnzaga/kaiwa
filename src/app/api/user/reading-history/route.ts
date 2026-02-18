import { NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const rows = await db
      .select({
        readAt: schema.userArticleStates.readAt,
        title: schema.articles.translatedTitle,
        originalTitle: schema.articles.originalTitle,
        url: schema.articles.originalUrl,
        publishedAt: schema.articles.publishedAt,
        sourceName: schema.feeds.sourceName,
        regionId: schema.feeds.regionId,
        sentiment: schema.articles.summarySentiment,
        tags: schema.articles.summaryTags,
        isStarred: schema.userArticleStates.isStarred,
        wordCount: sql<number>`char_length(coalesce(${schema.articles.translatedContent}, ${schema.articles.originalContent}, '')) / 5`,
      })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(
        and(
          eq(schema.userArticleStates.userId, userId),
          eq(schema.userArticleStates.isRead, true),
        ),
      )
      .orderBy(desc(schema.userArticleStates.readAt))
      .limit(5000);

    const escape = (v: string | null | undefined) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = 'read_at,title,source,region,url,published_at,sentiment,tags,starred,word_count';
    const csvRows = rows.map(r => [
      escape(r.readAt ? new Date(r.readAt).toISOString() : ''),
      escape(r.title || r.originalTitle),
      escape(r.sourceName),
      escape(r.regionId),
      escape(r.url),
      escape(new Date(r.publishedAt).toISOString()),
      escape(r.sentiment),
      escape(r.tags ? (r.tags as string[]).join('; ') : ''),
      r.isStarred ? 'true' : 'false',
      String(r.wordCount ?? 0),
    ].join(','));

    const csv = [header, ...csvRows].join('\n');
    const filename = `kaiwa-reading-history-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
