import { NextResponse } from 'next/server';
import { eq, desc, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET() {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const articles = await db
      .select({
        id: schema.articles.id,
        translatedTitle: schema.articles.translatedTitle,
        originalTitle: schema.articles.originalTitle,
        originalUrl: schema.articles.originalUrl,
        publishedAt: schema.articles.publishedAt,
        summaryTldr: schema.articles.summaryTldr,
        summaryBullets: schema.articles.summaryBullets,
        summaryTags: schema.articles.summaryTags,
        sourceName: schema.feeds.sourceName,
      })
      .from(schema.userArticleStates)
      .innerJoin(schema.articles, eq(schema.userArticleStates.articleId, schema.articles.id))
      .leftJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
      .where(
        sql`${schema.userArticleStates.userId} = ${userId}
          AND ${schema.userArticleStates.isStarred} = true`,
      )
      .orderBy(desc(schema.articles.publishedAt))
      .limit(200);

    const lines: string[] = [`# Kaiwa — Starred Articles`, ``, `Exported ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · ${articles.length} articles`, ``];

    for (const a of articles) {
      const title = a.translatedTitle || a.originalTitle;
      const date = new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      lines.push(`## [${title}](${a.originalUrl})`);
      lines.push(`*${a.sourceName ?? 'Unknown'} · ${date}*`);
      if (a.summaryTldr) lines.push(``, a.summaryTldr);
      if (a.summaryBullets && (a.summaryBullets as string[]).length > 0) {
        lines.push(``);
        for (const b of a.summaryBullets as string[]) lines.push(`- ${b}`);
      }
      if (a.summaryTags && (a.summaryTags as string[]).length > 0) {
        lines.push(``, `Tags: ${(a.summaryTags as string[]).join(', ')}`);
      }
      lines.push(``);
    }

    const markdown = lines.join('\n');

    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="kaiwa-starred-${new Date().toISOString().split('T')[0]}.md"`,
      },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
