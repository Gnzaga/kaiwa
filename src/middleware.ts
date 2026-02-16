import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isAuthentikConfigured = Boolean(process.env.AUTHENTIK_ISSUER);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow health checks and static assets
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // In development or when Authentik is not configured, allow all requests.
  // Forward-auth enforcement only works behind an ingress with the Authentik outpost.
  if (!isAuthentikConfigured || process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // With Authentik configured, forward-auth is handled at the ingress level.
  // This middleware is a fallback — check for the X-authentik-username header
  // set by the Authentik outpost.
  const username = request.headers.get('x-authentik-username');
  if (!username) {
    return NextResponse.redirect(
      new URL('/outpost.goauthentik.io/start?rd=' + encodeURIComponent(request.url), request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico).*)'],
};
