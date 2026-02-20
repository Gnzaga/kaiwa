import { NextRequest } from 'next/server';
import { config } from '@/lib/config';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const upstream = await fetch(`${config.researcher.url}/research/${id}/stream`, {
    headers: { Accept: 'text/event-stream' },
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: 'Stream unavailable' }), {
      status: upstream.status || 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Forward the SSE stream
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
