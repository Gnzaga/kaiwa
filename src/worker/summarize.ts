import type { Job } from 'pg-boss';
import { summarizeArticle } from '@/lib/summarize';

interface SummarizeJobData {
  articleId: number;
}

export async function handleSummarize(jobs: Job<SummarizeJobData>[]) {
  for (const job of jobs) {
    const { articleId } = job.data;
    console.log(`[summarize] Processing article ${articleId}`);

    try {
      await summarizeArticle(articleId);
      console.log(`[summarize] Article ${articleId} summarized`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[summarize] Article ${articleId} failed: ${message}`);
      throw err;
    }
  }
}
