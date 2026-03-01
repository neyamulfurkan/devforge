'use client'

// 3. Third-party library imports
import Link from 'next/link'
import { Plus, BookOpen, Bookmark, ArrowRight } from 'lucide-react'

// 6. Internal imports — utils
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  lastOpenedProjectId?: string
}

interface ActionItem {
  label: string
  description: string
  href: string
  icon: React.ElementType
  primary?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuickActions({ lastOpenedProjectId }: QuickActionsProps): JSX.Element {
  const baseActions: ActionItem[] = [
    {
      label: 'New Project',
      description: 'Start a new AI-assisted build',
      href: '/projects/new',
      icon: Plus,
      primary: true,
    },
    {
      label: 'Prompt Library',
      description: 'Browse community prompts',
      href: '/library',
      icon: BookOpen,
    },
    {
      label: 'My Collections',
      description: 'Your saved prompt sets',
      href: '/collections',
      icon: Bookmark,
    },
  ]

  const actions: ActionItem[] = lastOpenedProjectId
    ? [
        ...baseActions,
        {
          label: 'Continue Last Session',
          description: 'Resume where you left off',
          href: `/projects/${lastOpenedProjectId}/workspace`,
          icon: ArrowRight,
        },
      ]
    : baseActions

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-4 transition-all duration-150',
              'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
              'focus-visible:ring-offset-[var(--bg-primary)] outline-none',
              action.primary
                ? [
                    'border-[var(--accent-border)] bg-[var(--accent-light)]',
                    'hover:border-[var(--accent-primary)] hover:bg-[var(--accent-light)]',
                    'hover:shadow-[var(--shadow-glow)]',
                  ]
                : [
                    'border-[var(--border-subtle)] bg-[var(--bg-tertiary)]',
                    'hover:border-[var(--border-default)] hover:bg-[var(--bg-quaternary)]',
                  ]
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg',
                action.primary
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-quaternary)] text-[var(--text-secondary)]'
              )}
            >
              <Icon className="h-4 w-4" />
            </div>

            {/* Text */}
            <div className="flex flex-col gap-0.5">
              <span
                className={cn(
                  'text-sm font-medium',
                  action.primary
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-primary)]'
                )}
              >
                {action.label}
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {action.description}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}