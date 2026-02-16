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

  // Auth is enforced at the ingress level via Authentik forward-auth annotations.
  // The middleware just passes through — the ingress ensures only authenticated
  // requests reach the app.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico).*)'],
};
