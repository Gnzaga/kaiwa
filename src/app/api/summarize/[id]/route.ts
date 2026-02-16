import { NextRequest, NextResponse } from 'next/server';
import { summarizeArticle } from '@/lib/summarize';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    await summarizeArticle(articleId);

    return NextResponse.json({ success: true, articleId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : message.includes('no translation') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
