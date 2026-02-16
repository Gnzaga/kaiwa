import NextAuth from 'next-auth';
import { config } from './config';

const authentikProvider = config.auth.authentik.issuer
  ? {
      id: 'authentik',
      name: 'Authentik',
      type: 'oidc' as const,
      issuer: config.auth.authentik.issuer,
      clientId: config.auth.authentik.clientId!,
      clientSecret: config.auth.authentik.clientSecret!,
    }
  : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: authentikProvider ? [authentikProvider] : [],
  session: {
    strategy: 'jwt',
  },
  secret: config.auth.secret,
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.groups = (profile as Record<string, unknown>).groups;
      }
      return token;
    },
    session({ session, token }) {
      if (token.groups) {
        (session as unknown as Record<string, unknown>).groups = token.groups;
      }
      return session;
    },
  },
});

export const authConfig = {
  matcher: ['/((?!api/health|_next/static|_next/image|favicon.ico).*)'],
};
