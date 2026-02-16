import { PgBoss } from 'pg-boss';
import { config } from './config';

export const QUEUE_SYNC = 'sync-feeds';
export const QUEUE_TRANSLATION = 'translate-article';
export const QUEUE_SCRAPE = 'scrape-article';
export const QUEUE_SUMMARIZATION = 'summarize-article';

export const boss = new PgBoss(config.database.url);

let started = false;
export async function ensureBossStarted() {
  if (!started) {
    await boss.start();
    await boss.createQueue(QUEUE_SCRAPE);
    await boss.createQueue(QUEUE_TRANSLATION);
    await boss.createQueue(QUEUE_SUMMARIZATION);
    await boss.createQueue(QUEUE_SYNC);
    started = true;
  }
}
