import { NextResponse } from 'next/server';
import { db, schema } from '@/lib/db';
import { config } from '@/lib/config';
import { healthCheck as libreHealthCheck } from '@/lib/providers/libretranslate';
import { sql } from 'drizzle-orm';

async function checkService(
  name: string,
  fn: () => Promise<boolean>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ok = await fn();
    return ok ? { ok: true } : { ok: false, error: 'Service returned error' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function GET() {
  try {
    const [health, feeds, queueCounts] = await Promise.all([
      Promise.all([
        checkService('miniflux', async () => {
          const res = await fetch(`${config.miniflux.url}/v1/me`, {
            headers: { 'X-Auth-Token': config.miniflux.apiKey },
            signal: AbortSignal.timeout(5000),
          });
          return res.ok;
        }),
        checkService('libretranslate', libreHealthCheck),
        checkService('openwebui', async () => {
          const res = await fetch(`${config.openwebui.url}/api/models`, {
            headers: { Authorization: `Bearer ${config.openwebui.apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          return res.ok;
        }),
      ]),
      db.select().from(schema.feeds).orderBy(schema.feeds.name),
      db
        .select({
          translationPending: sql<number>`count(*) filter (where ${schema.articles.translationStatus} = 'pending')`,
          summarizationPending: sql<number>`count(*) filter (where ${schema.articles.summaryStatus} = 'pending')`,
        })
        .from(schema.articles),
    ]);

    const [miniflux, libretranslate, openwebui] = health;

    return NextResponse.json({
      pollingInterval: config.worker.pollIntervalMinutes,
      health: { miniflux, libretranslate, openwebui },
      queue: {
        translationPending: Number(queueCounts[0]?.translationPending ?? 0),
        summarizationPending: Number(queueCounts[0]?.summarizationPending ?? 0),
      },
      feeds: feeds.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        category: f.category,
        sourceName: f.sourceName,
        enabled: f.enabled,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
