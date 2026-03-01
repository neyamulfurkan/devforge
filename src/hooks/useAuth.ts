// src/hooks/useAuth.ts

// 1. React imports
import { useCallback } from 'react'

// 2. Next.js imports
import { useRouter } from 'next/navigation'

// 3. Third-party library imports
import { useSession, signOut } from 'next-auth/react'

// 4. Internal imports — types
import type { User } from '@/types'

// 5. Local types
interface AuthUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

interface UseAuthReturn {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isLoading = status === 'loading'
  const isAuthenticated = !!session && session.user != null

  const user: AuthUser | null = session?.user
    ? {
        id: (session.user as AuthUser).id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : null

  const logout = useCallback(async (): Promise<void> => {
    await signOut({ callbackUrl: '/login' })
  }, [])

  const deleteAccount = useCallback(async (): Promise<void> => {
    const response = await fetch('/api/settings/account', {
      method: 'DELETE',
    })

    if (!response.ok) {
      const data = await response.json() as { error?: string }
      throw new Error(data.error ?? 'Failed to delete account')
    }

    await signOut({ callbackUrl: '/' })
  }, [])

  return {
    user,
    isLoading,
    isAuthenticated,
    logout,
    deleteAccount,
  }
}