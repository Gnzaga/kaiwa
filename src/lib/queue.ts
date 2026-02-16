import { PgBoss } from 'pg-boss';
import { config } from './config';

export const QUEUE_SYNC = 'sync-feeds';
export const QUEUE_TRANSLATION = 'translate-article';
export const QUEUE_SUMMARIZATION = 'summarize-article';

export const boss = new PgBoss(config.database.url);
