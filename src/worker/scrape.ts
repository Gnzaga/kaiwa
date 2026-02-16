import type { Job } from 'pg-boss';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { config } from '@/lib/config';
import { boss, queueTranslate } from '@/lib/queue';
import { downloadArticleImage } from '@/lib/images';

interface ScrapeJobData {
  articleId: number;
}

const ACCEPT_LANGUAGE_MAP: Record<string, string> = {
  ja: 'ja,en;q=0.9',
  zh: 'zh-TW,zh;q=0.9,en;q=0.8',
  tl: 'tl,en;q=0.9',
  en: 'en-US,en;q=0.9',
};

function extractImageUrl(dom: JSDOM, parsedContent: string | null): string | null {
  const doc = dom.window.document;

  // Priority 1: og:image meta tag
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImage && ogImage.startsWith('http')) return ogImage;

  // Priority 2: First <img> in parsed Readability content
  if (parsedContent) {
    const contentDom = new JSDOM(parsedContent);
    const firstImg = contentDom.window.document.querySelector('img[src]');
    const src = firstImg?.getAttribute('src');
    if (src && src.startsWith('http') && !src.includes('icon') && !src.includes('logo')) {
      return src;
    }
  }

  // Priority 3: First <img> in HTML body
  const bodyImg = doc.querySelector('body img[src]');
  const bodySrc = bodyImg?.getAttribute('src');
  if (bodySrc && bodySrc.startsWith('http') && !bodySrc.includes('icon') && !bodySrc.includes('logo')) {
    return bodySrc;
  }

  return null;
}

export async function handleScrape(jobs: Job<ScrapeJobData>[]) {
  for (const job of jobs) {
    const { articleId } = job.data;
    console.log(`[scrape] Processing article ${articleId}`);

    const article = await db.query.articles.findFirst({
      where: eq(schema.articles.id, articleId),
      with: { feed: true },
    });

    if (!article) {
      console.error(`[scrape] Article ${articleId} not found`);
      continue;
    }

    const regionId = article.feed?.regionId ?? 'jp';

    if (!config.scrape.enabled) {
      console.log(`[scrape] Scraping disabled, skipping article ${articleId}`);
      await boss.send(queueTranslate(regionId), { articleId });
      continue;
    }

    const sourceLanguage = article.sourceLanguage ?? 'ja';
    const acceptLanguage = ACCEPT_LANGUAGE_MAP[sourceLanguage] ?? 'en-US,en;q=0.9';

    try {
      const response = await fetch(article.originalUrl, {
        headers: {
          'User-Agent': config.scrape.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': acceptLanguage,
        },
        signal: AbortSignal.timeout(config.scrape.timeoutMs),
      });

      if (!response.ok) {
        console.warn(`[scrape] Article ${articleId}: HTTP ${response.status} from ${article.originalUrl}`);
        await boss.send(queueTranslate(regionId), { articleId });
        continue;
      }

      const html = await response.text();
      const dom = new JSDOM(html, { url: article.originalUrl });
      const parsed = new Readability(dom.window.document).parse();

      if (!parsed || !parsed.textContent) {
        console.warn(`[scrape] Article ${articleId}: Readability extracted nothing`);
        await boss.send(queueTranslate(regionId), { articleId });
        continue;
      }

      const scraped = parsed.textContent.trim();
      const original = article.originalContent ?? '';

      const updates: Record<string, unknown> = {};

      if (scraped.length > original.length && scraped.length >= config.scrape.minContentLength) {
        updates.originalContent = scraped;
        console.log(
          `[scrape] Article ${articleId}: replaced content (${original.length} -> ${scraped.length} chars)`,
        );
      } else {
        console.log(
          `[scrape] Article ${articleId}: kept original (original=${original.length}, scraped=${scraped.length} chars)`,
        );
      }

      // Extract and download article image
      if (!article.imageUrl && !updates.imageUrl) {
        const rawImageUrl = extractImageUrl(dom, parsed.content ?? null);
        if (rawImageUrl) {
          const storedUrl = await downloadArticleImage(rawImageUrl, articleId);
          if (storedUrl) {
            updates.imageUrl = storedUrl;
            console.log(`[scrape] Article ${articleId}: saved image`);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await db
          .update(schema.articles)
          .set(updates)
          .where(eq(schema.articles.id, articleId));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[scrape] Article ${articleId}: scrape failed (${message}), using original content`);
    }

    await boss.send(queueTranslate(regionId), { articleId });
    console.log(`[scrape] Article ${articleId} done, translation enqueued`);
  }
}
