import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe auth config (no adapter, no Node.js imports).
 * Used by middleware to check session cookies.
 * Reads env vars directly — no config.ts import (it uses 'fs').
 */

const authentikProvider = process.env.AUTHENTIK_ISSUER
  ? {
      id: 'authentik',
      name: 'Authentik',
      type: 'oidc' as const,
      issuer: process.env.AUTHENTIK_ISSUER,
      clientId: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
    }
  : null;

export const authConfig: NextAuthConfig = {
  providers: authentikProvider ? [authentikProvider] : [],
  secret: process.env.NEXTAUTH_SECRET ?? 'dev-secret-change-in-production',
  trustHost: true,
  pages: {
    signIn: '/api/auth/signin',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
  },
};
