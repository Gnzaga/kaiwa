import type { Job } from 'pg-boss';
import { embedArticle } from '@/lib/embed';

interface EmbedJobData {
  articleId: number;
}

export async function handleEmbed(jobs: Job<EmbedJobData>[]) {
  for (const job of jobs) {
    const { articleId } = job.data;
    console.log(`[embed] Processing article ${articleId}`);

    try {
      await embedArticle(articleId);
      console.log(`[embed] Article ${articleId} embedded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[embed] Article ${articleId} failed: ${message}`);
      throw err;
    }
  }
}
