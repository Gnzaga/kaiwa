import { auth } from './auth';
import { NextResponse } from 'next/server';

type AuthSession = {
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
  isAdmin?: boolean;
};

export async function requireSession(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session as unknown as AuthSession;
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireSession();
  if (!session.isAdmin) {
    throw NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return session;
}
