import type { Job } from 'pg-boss';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { config } from '@/lib/config';
import { boss, QUEUE_TRANSLATION } from '@/lib/queue';

interface ScrapeJobData {
  articleId: number;
}

export async function handleScrape(jobs: Job<ScrapeJobData>[]) {
  for (const job of jobs) {
    const { articleId } = job.data;
    console.log(`[scrape] Processing article ${articleId}`);

    const article = await db.query.articles.findFirst({
      where: eq(schema.articles.id, articleId),
    });

    if (!article) {
      console.error(`[scrape] Article ${articleId} not found`);
      continue;
    }

    if (!config.scrape.enabled) {
      console.log(`[scrape] Scraping disabled, skipping article ${articleId}`);
      await boss.send(QUEUE_TRANSLATION, { articleId });
      continue;
    }

    try {
      const response = await fetch(article.originalUrl, {
        headers: {
          'User-Agent': config.scrape.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ja,en;q=0.9',
        },
        signal: AbortSignal.timeout(config.scrape.timeoutMs),
      });

      if (!response.ok) {
        console.warn(`[scrape] Article ${articleId}: HTTP ${response.status} from ${article.originalUrl}`);
        await boss.send(QUEUE_TRANSLATION, { articleId });
        continue;
      }

      const html = await response.text();
      const dom = new JSDOM(html, { url: article.originalUrl });
      const parsed = new Readability(dom.window.document).parse();

      if (!parsed || !parsed.textContent) {
        console.warn(`[scrape] Article ${articleId}: Readability extracted nothing`);
        await boss.send(QUEUE_TRANSLATION, { articleId });
        continue;
      }

      const scraped = parsed.textContent.trim();
      const original = article.originalContent ?? '';

      if (scraped.length > original.length && scraped.length >= config.scrape.minContentLength) {
        await db
          .update(schema.articles)
          .set({ originalContent: scraped })
          .where(eq(schema.articles.id, articleId));
        console.log(
          `[scrape] Article ${articleId}: replaced content (${original.length} → ${scraped.length} chars)`,
        );
      } else {
        console.log(
          `[scrape] Article ${articleId}: kept original (original=${original.length}, scraped=${scraped.length} chars)`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[scrape] Article ${articleId}: scrape failed (${message}), using original content`);
    }

    await boss.send(QUEUE_TRANSLATION, { articleId });
    console.log(`[scrape] Article ${articleId} done, translation enqueued`);
  }
}
