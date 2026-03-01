// src/app/layout.tsx

// 1. Next.js imports
import type { Metadata } from 'next'

// 2. Internal imports — providers and globals
import { Providers } from '@/components/providers/Providers'
import '@/app/globals.css'

// 3. Metadata
export const metadata: Metadata = {
  title: {
    default: 'DevForge',
    template: '%s | DevForge',
  },
  description:
    'Build AI-assisted projects without losing context, prompts, or your mind. The complete workflow platform for AI-assisted development.',
  openGraph: {
    title: 'DevForge',
    description:
      'Build AI-assisted projects without losing context, prompts, or your mind.',
    type: 'website',
    siteName: 'DevForge',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevForge',
    description:
      'Build AI-assisted projects without losing context, prompts, or your mind.',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

// 4. Root layout — server component
interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}