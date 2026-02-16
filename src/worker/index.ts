import { boss, QUEUE_SYNC, QUEUE_SCRAPE, QUEUE_TRANSLATION, QUEUE_SUMMARIZATION } from '@/lib/queue';
import { config } from '@/lib/config';
import { handleSync } from './sync';
import { handleScrape } from './scrape';
import { handleTranslate } from './translate';
import { handleSummarize } from './summarize';

async function main() {
  console.log('[worker] Starting pg-boss...');
  await boss.start();
  console.log('[worker] pg-boss started');

  // Ensure queues exist (pg-boss v12+ requires explicit creation)
  await boss.createQueue(QUEUE_SCRAPE);
  await boss.createQueue(QUEUE_TRANSLATION);
  await boss.createQueue(QUEUE_SUMMARIZATION);
  await boss.createQueue(QUEUE_SYNC);
  console.log('[worker] Queues created');

  // Register job handlers
  await boss.work(
    QUEUE_SCRAPE,
    { localConcurrency: config.worker.scrapeConcurrency },
    handleScrape,
  );
  console.log(`[worker] Registered handler: ${QUEUE_SCRAPE} (concurrency: ${config.worker.scrapeConcurrency})`);

  await boss.work(
    QUEUE_TRANSLATION,
    { localConcurrency: config.worker.translationConcurrency },
    handleTranslate,
  );
  console.log(`[worker] Registered handler: ${QUEUE_TRANSLATION} (concurrency: ${config.worker.translationConcurrency})`);

  await boss.work(
    QUEUE_SUMMARIZATION,
    { localConcurrency: config.worker.summarizationConcurrency },
    handleSummarize,
  );
  console.log(`[worker] Registered handler: ${QUEUE_SUMMARIZATION} (concurrency: ${config.worker.summarizationConcurrency})`);

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
