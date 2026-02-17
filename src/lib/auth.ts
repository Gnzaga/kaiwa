import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { config } from './config';
import { db } from './db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';

const ADMIN_GROUPS = ['ak admins', 'akadmin'];

function hasAdminGroup(groups: unknown): boolean {
  if (!Array.isArray(groups)) return false;
  return groups.some(g => typeof g === 'string' && ADMIN_GROUPS.includes(g.toLowerCase()));
}

const authentikProvider = config.auth.authentik.issuer
  ? {
      id: 'authentik',
      name: 'Authentik',
      type: 'oidc' as const,
      issuer: config.auth.authentik.issuer,
      clientId: config.auth.authentik.clientId!,
      clientSecret: config.auth.authentik.clientSecret!,
      profile(profile: Record<string, unknown>) {
        return {
          id: profile.sub as string,
          name: profile.name as string ?? profile.preferred_username as string,
          email: profile.email as string,
          image: profile.picture as string | undefined,
        };
      },
    }
  : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: authentikProvider ? [authentikProvider] : [],
  session: {
    strategy: 'database',
  },
  secret: config.auth.secret,
  callbacks: {
    async signIn({ profile }) {
      // Update admin status from Authentik groups on every sign-in
      if (profile?.sub) {
        const isAdmin = hasAdminGroup((profile as Record<string, unknown>).groups);
        await db
          .update(users)
          .set({ isAdmin })
          .where(eq(users.id, profile.sub as string));
      }
      return true;
    },
    session({ session, user }) {
      if (user) {
        session.user.id = user.id;
        // Attach isAdmin to session
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).isAdmin = (user as any).isAdmin;
      }
      return session;
    },
  },
});
