import type { Job } from 'pg-boss';
import { eq } from 'drizzle-orm';
import { summarizeArticle } from '@/lib/summarize';
import { boss, queueEmbed } from '@/lib/queue';
import { db, schema } from '@/lib/db';

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

      // Chain to embedding queue
      const article = await db.query.articles.findFirst({
        where: eq(schema.articles.id, articleId),
        with: { feed: true },
      });
      if (article?.feed?.regionId) {
        await boss.send(queueEmbed(article.feed.regionId), { articleId });
        console.log(`[summarize] Enqueued embed for article ${articleId}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[summarize] Article ${articleId} failed: ${message}`);
      throw err;
    }
  }
}
