import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { healthCheck as libreHealthCheck } from '@/lib/providers/libretranslate';

const CHECK_TIMEOUT = 2000;

async function checkMiniflux(): Promise<boolean> {
  try {
    const res = await fetch(`${config.miniflux.url}/v1/me`, {
      headers: { 'X-Auth-Token': config.miniflux.apiKey },
      signal: AbortSignal.timeout(CHECK_TIMEOUT),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkOpenRouter(): Promise<boolean> {
  try {
    const res = await fetch(`${config.openrouter.url}/models`, {
      headers: { Authorization: `Bearer ${config.openrouter.apiKey}` },
      signal: AbortSignal.timeout(CHECK_TIMEOUT),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const [miniflux, libretranslate, openrouter] = await Promise.all([
    checkMiniflux(),
    libreHealthCheck(),
    checkOpenRouter(),
  ]);

  const allHealthy = miniflux && libretranslate && openrouter;

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    services: { miniflux, libretranslate, openrouter },
  });
}
