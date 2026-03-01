// src/components/providers/Providers.tsx
'use client'

// 1. React imports
import { useState } from 'react'

// 2. Third-party library imports
import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

// 3. Local types
interface ProvidersProps {
  children: React.ReactNode
}

// 4. Component — creates QueryClient inside component to avoid shared state between requests
export function Providers({ children }: ProvidersProps): JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,          // 10s default — overridden per hook
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            },
          }}
        />
      </QueryClientProvider>
    </SessionProvider>
  )
}