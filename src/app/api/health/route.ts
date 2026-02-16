import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { healthCheck as libreHealthCheck } from '@/lib/providers/libretranslate';

async function checkMiniflux(): Promise<boolean> {
  try {
    const res = await fetch(`${config.miniflux.url}/v1/me`, {
      headers: { 'X-Auth-Token': config.miniflux.apiKey },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkOpenWebUI(): Promise<boolean> {
  try {
    const res = await fetch(`${config.openwebui.url}/api/models`, {
      headers: { Authorization: `Bearer ${config.openwebui.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const [miniflux, libretranslate, openwebui] = await Promise.all([
    checkMiniflux(),
    libreHealthCheck(),
    checkOpenWebUI(),
  ]);

  const allHealthy = miniflux && libretranslate && openwebui;

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    services: { miniflux, libretranslate, openwebui },
  });
}
