import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ['/((?!api/auth|api/health|api/reading-lists/.*/public|lists/.*/public|_next/static|_next/image|favicon.ico).*)'],
};
