// 1. Next-Auth imports

import NextAuth from 'next-auth'
import type { NextAuthConfig, DefaultSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'

// 2. Adapter
import { PrismaAdapter } from '@auth/prisma-adapter'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Password hashing
import { compare } from 'bcryptjs'

// 5. Validation
import { z } from 'zod'

// ─── NextAuth type augmentation ──────────────────────────────────────────────
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}



// ─── Local validation schema (server-side only, not re-exported) ─────────────
const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ─── NextAuth configuration ──────────────────────────────────────────────────
export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as NextAuthConfig['adapter'],

  session: {
    strategy: 'jwt',
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    // ── Email + Password ────────────────────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<{ id: string; email: string; name: string } | null> {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) {
          return null
        }

        const { email, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
          },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const passwordMatches = await compare(password, user.passwordHash)
        if (!passwordMatches) {
          return null
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),

    // ── Google OAuth ────────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  callbacks: {
    async jwt({ token, user }: { token: Record<string, unknown>; user?: { id?: string } | null }) {
      if (user) {
        token.sub = user.id
      }
      if (token.sub && !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub as string },
          select: { id: true },
        })
        if (!dbUser) return null
      }
      return token
    },

    async session({ session, token }: { session: DefaultSession & { user?: { id?: string } }; token: Record<string, unknown> }) {
      if (token.sub && session.user) {
        session.user.id = token.sub as string
      }
      return session
    },
  },
}

export const {
  handlers,
  signIn,
  signOut,
  auth,
  auth: getServerSession,
} = NextAuth(authOptions)