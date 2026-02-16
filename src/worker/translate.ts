import type { Job } from 'pg-boss';
import { translateArticle } from '@/lib/translate';
import { boss, QUEUE_SUMMARIZATION } from '@/lib/queue';

interface TranslateJobData {
  articleId: number;
}

export async function handleTranslate(jobs: Job<TranslateJobData>[]) {
  for (const job of jobs) {
    const { articleId } = job.data;
    console.log(`[translate] Processing article ${articleId}`);

    try {
      await translateArticle(articleId);
      await boss.send(QUEUE_SUMMARIZATION, { articleId });
      console.log(`[translate] Article ${articleId} translated, summarization enqueued`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[translate] Article ${articleId} failed: ${message}`);
      throw err;
    }
  }
}
