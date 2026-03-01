import type { NextAuthConfig } from 'next-auth'

// Lightweight config for Edge middleware — no Prisma, no bcryptjs
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user?.id
    },
  },
}