'use client'

// 3. Third-party library imports
import { ArrowRight, Zap } from 'lucide-react'
import Link from 'next/link'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WelcomeBannerProps {
  userName: string
  hasProjects: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WelcomeBanner({ userName, hasProjects }: WelcomeBannerProps): JSX.Element | null {
  if (hasProjects) return null

  const firstName = userName.split(' ')[0] ?? userName

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 p-8">
      {/* Decorative Zap icon */}
      <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.12]">
        <Zap className="h-28 w-28 text-white" strokeWidth={1} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold text-white">
            Welcome to DevForge, {firstName}!
          </h2>
          <p className="max-w-md text-base text-white/80">
            Start by creating your first AI-assisted project — from idea to deployed app,
            every step organized.
          </p>
        </div>

        <Button
          asChild
          className="mt-2 shrink-0 gap-2 bg-white font-semibold text-gray-900 hover:bg-white/90 active:scale-95 sm:mt-0"
        >
          <Link href="/projects/new">
            Create Your First Project
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}