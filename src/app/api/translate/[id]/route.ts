import { NextRequest, NextResponse } from 'next/server';
import { translateArticle, forceTranslate } from '@/lib/translate';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const provider = request.nextUrl.searchParams.get('provider');

    if (provider === 'llm' || provider === 'libretranslate') {
      await forceTranslate(articleId, provider);
    } else {
      await translateArticle(articleId);
    }

    return NextResponse.json({ success: true, articleId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
