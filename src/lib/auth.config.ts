import type { NextAuthConfig } from 'next-auth'

// Lightweight config for Edge middleware — no Prisma, no bcryptjs
// Used by middleware.ts to protect routes without importing heavy Node modules
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      return session
    },
  },
}