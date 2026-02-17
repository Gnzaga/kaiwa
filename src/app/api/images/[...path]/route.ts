import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const imagePath = path.join('/');
  const minioUrl = `${config.minio.endpoint}/${config.minio.bucket}/${imagePath}`;

  try {
    const res = await fetch(minioUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const body = res.body;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
