import type { Job } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { translateArticle } from '@/lib/translate';
import { db, schema } from '@/lib/db';
import { boss, queueSummarize } from '@/lib/queue';

interface TranslateJobData {
  articleId: number;
}

export async function handleTranslate(jobs: Job<TranslateJobData>[]) {
  for (const job of jobs) {
    const { articleId } = job.data;
    console.log(`[translate] Processing article ${articleId}`);

    try {
      // Look up region for routing to the correct summarize queue
      const article = await db.query.articles.findFirst({
        where: eq(schema.articles.id, articleId),
        with: { feed: true },
      });
      const regionId = article?.feed?.regionId ?? 'jp';

      await translateArticle(articleId);
      await boss.send(queueSummarize(regionId), { articleId });
      console.log(`[translate] Article ${articleId} translated, summarization enqueued`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[translate] Article ${articleId} failed: ${message}`);
      throw err;
    }
  }
}
