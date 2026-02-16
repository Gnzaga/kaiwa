import { PgBoss } from 'pg-boss';
import { config } from './config';

export const QUEUE_SYNC = 'sync-feeds';

// Region-aware queue names
export const REGIONS = ['jp', 'us', 'ph', 'tw'];

export function queueScrape(regionId: string) { return `scrape-${regionId}`; }
export function queueTranslate(regionId: string) { return `translate-${regionId}`; }
export function queueSummarize(regionId: string) { return `summarize-${regionId}`; }

// Legacy queue names (for API endpoints that don't know the region)
export const QUEUE_SCRAPE = 'scrape-article';
export const QUEUE_TRANSLATION = 'translate-article';
export const QUEUE_SUMMARIZATION = 'summarize-article';

export const boss = new PgBoss(config.database.url);

let started = false;
export async function ensureBossStarted() {
  if (!started) {
    await boss.start();
    // Legacy queues
    await boss.createQueue(QUEUE_SCRAPE);
    await boss.createQueue(QUEUE_TRANSLATION);
    await boss.createQueue(QUEUE_SUMMARIZATION);
    await boss.createQueue(QUEUE_SYNC);
    // Per-region queues
    for (const region of REGIONS) {
      await boss.createQueue(queueScrape(region));
      await boss.createQueue(queueTranslate(region));
      await boss.createQueue(queueSummarize(region));
    }
    started = true;
  }
}
