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
    // Session valid for 30 days
    maxAge: 30 * 24 * 60 * 60,
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
        try {
          const parsed = credentialsSchema.safeParse(credentials)
          if (!parsed.success) return null

          const { email, password } = parsed.data

          // Case-insensitive email lookup — fixes login issues caused by
          // mismatched capitalisation between registration and login forms
          const user = await prisma.user.findFirst({
            where: {
              email: {
                equals: email,
                mode: 'insensitive',
              },
            },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
            },
          })

          if (!user || !user.passwordHash) return null

          const passwordMatches = await compare(password, user.passwordHash)
          if (!passwordMatches) return null

          // Update last active timestamp (non-blocking — don't await)
          prisma.user
            .update({
              where: { id: user.id },
              data: { lastActiveAt: new Date() },
            })
            .catch(() => {
              // Non-critical — ignore failures
            })

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? '',
          }
        } catch (error) {
          console.error('[Auth] credentials authorize error:', error)
          return null
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
    async jwt({
      token,
      user,
    }: {
      token: Record<string, unknown>
      user?: { id?: string } | null
    }) {
      // On first sign-in, attach the user id to the token
      if (user?.id) {
        token.sub = user.id
      }

      // On subsequent requests, verify the user still exists in DB
      if (token.sub && !user) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub as string },
            select: { id: true },
          })
          // If the user has been deleted, invalidate the token
          if (!dbUser) return null
        } catch (error) {
          console.error('[Auth] JWT db lookup error:', error)
          // Don't invalidate on DB errors — let the session continue
        }
      }

      return token
    },

    async session({
      session,
      token,
    }: {
      session: DefaultSession & { user?: { id?: string } }
      token: Record<string, unknown>
    }) {
      // Attach user id from JWT token to the session object
      if (token.sub && session.user) {
        session.user.id = token.sub as string
      }
      return session
    },
  },

  // Suppress verbose NextAuth logs in production
  debug: process.env.NODE_ENV === 'development',
}

export const {
  handlers,
  signIn,
  signOut,
  auth,
  auth: getServerSession,
} = NextAuth(authOptions)