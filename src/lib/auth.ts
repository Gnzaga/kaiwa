import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';
import { authConfig } from './auth.config';

const ADMIN_GROUPS = ['ak admins', 'akadmin'];

function hasAdminGroup(groups: unknown): boolean {
  if (!Array.isArray(groups)) return false;
  return groups.some(g => typeof g === 'string' && ADMIN_GROUPS.includes(g.toLowerCase()));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile }) {
      if (profile?.sub) {
        const isAdmin = hasAdminGroup((profile as Record<string, unknown>).groups);
        await db
          .update(users)
          .set({ isAdmin })
          .where(eq(users.id, profile.sub as string));
      }
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      // On initial sign-in, read isAdmin from DB (set by signIn callback above)
      if (user?.id) {
        const [dbUser] = await db
          .select({ isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        token.isAdmin = dbUser?.isAdmin ?? false;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, token }: any) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      session.isAdmin = token?.isAdmin ?? false;
      return session;
    },
  },
});
