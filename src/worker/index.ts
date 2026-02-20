import {
  boss,
  QUEUE_SYNC,
  QUEUE_SCRAPE,
  QUEUE_TRANSLATION,
  QUEUE_SUMMARIZATION,
  REGIONS,
  queueScrape,
  queueTranslate,
  queueSummarize,
  queueEmbed,
} from '@/lib/queue';
import { config } from '@/lib/config';
import { handleSync } from './sync';
import { handleScrape } from './scrape';
import { handleTranslate } from './translate';
import { handleSummarize } from './summarize';
import { handleEmbed } from './embed';

async function main() {
  console.log('[worker] Starting pg-boss...');
  await boss.start();
  console.log('[worker] pg-boss started');

  // Create all queues
  await boss.createQueue(QUEUE_SCRAPE);
  await boss.createQueue(QUEUE_TRANSLATION);
  await boss.createQueue(QUEUE_SUMMARIZATION);
  await boss.createQueue(QUEUE_SYNC);
  for (const region of REGIONS) {
    await boss.createQueue(queueScrape(region));
    await boss.createQueue(queueTranslate(region));
    await boss.createQueue(queueSummarize(region));
    await boss.createQueue(queueEmbed(region));
  }
  console.log('[worker] Queues created');

  // Register per-region handlers — each region gets its own concurrency
  for (const region of REGIONS) {
    await boss.work(
      queueScrape(region),
      { localConcurrency: config.worker.scrapeConcurrency },
      handleScrape,
    );
    await boss.work(
      queueTranslate(region),
      { localConcurrency: config.worker.translationConcurrency },
      handleTranslate,
    );
    await boss.work(
      queueSummarize(region),
      { localConcurrency: config.worker.summarizationConcurrency },
      handleSummarize,
    );
    await boss.work(
      queueEmbed(region),
      { localConcurrency: 2 },
      handleEmbed,
    );
    console.log(`[worker] Registered handlers for region: ${region}`);
  }

  // Legacy fallback handlers (for articles enqueued without region)
  await boss.work(
    QUEUE_SCRAPE,
    { localConcurrency: config.worker.scrapeConcurrency },
    handleScrape,
  );
  await boss.work(
    QUEUE_TRANSLATION,
    { localConcurrency: config.worker.translationConcurrency },
    handleTranslate,
  );
  await boss.work(
    QUEUE_SUMMARIZATION,
    { localConcurrency: config.worker.summarizationConcurrency },
    handleSummarize,
  );
  console.log('[worker] Registered legacy fallback handlers');

  // Register sync handler
  await boss.work(QUEUE_SYNC, handleSync);
  console.log(`[worker] Registered handler: ${QUEUE_SYNC}`);

  // Schedule periodic sync via cron
  const cronExpression = `*/${config.worker.pollIntervalMinutes} * * * *`;
  await boss.schedule(QUEUE_SYNC, cronExpression, {});
  console.log(`[worker] Scheduled sync cron: ${cronExpression}`);

  // Run an initial sync on startup
  await boss.send(QUEUE_SYNC, {});
  console.log('[worker] Initial sync enqueued');

  console.log('[worker] Ready and processing jobs');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[worker] Shutting down...');
    await boss.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
