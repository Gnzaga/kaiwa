import { NextRequest, NextResponse } from 'next/server';
import { eq, and, asc } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireSession } from '@/lib/auth-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession();
    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const rows = await db
      .select({
        id: schema.comments.id,
        content: schema.comments.content,
        createdAt: schema.comments.createdAt,
        updatedAt: schema.comments.updatedAt,
        user: {
          id: schema.users.id,
          name: schema.users.name,
          image: schema.users.image,
        },
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .where(eq(schema.comments.articleId, articleId))
      .orderBy(asc(schema.comments.createdAt));

    return NextResponse.json({ comments: rows });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const articleId = parseInt(id, 10);
    if (isNaN(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'Content must be 2000 characters or fewer' }, { status: 400 });
    }

    const [comment] = await db
      .insert(schema.comments)
      .values({ articleId, userId: session.user.id, content })
      .returning();

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
      columns: { id: true, name: true, image: true },
    });

    return NextResponse.json({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      user: user ?? { id: session.user.id, name: null, image: null },
    }, { status: 201 });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    await params; // consume params
    const body = await request.json();
    const commentId = typeof body.commentId === 'number' ? body.commentId : NaN;
    if (isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'Content must be 2000 characters or fewer' }, { status: 400 });
    }

    const existing = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
    });
    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const [updated] = await db
      .update(schema.comments)
      .set({ content, updatedAt: new Date() })
      .where(eq(schema.comments.id, commentId))
      .returning();

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
      columns: { id: true, name: true, image: true },
    });

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      user: user ?? { id: session.user.id, name: null, image: null },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    await params; // consume params
    const body = await request.json();
    const commentId = typeof body.commentId === 'number' ? body.commentId : NaN;
    if (isNaN(commentId)) {
      return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
    }

    const existing = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
    });
    if (!existing) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }
    if (existing.userId !== session.user.id && !session.isAdmin) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await db.delete(schema.comments).where(eq(schema.comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
