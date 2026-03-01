'use client'

// 1. Third-party library imports
import type { LucideIcon } from 'lucide-react'

// 2. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 3. Internal imports — utils
import { cn } from '@/lib/utils'

// Local types
interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-8 text-center',
        className
      )}
    >
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-quaternary)]">
        <Icon
          className="h-6 w-6 text-[var(--text-tertiary)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>

      {/* Title */}
      <h3 className="mt-4 text-lg font-medium text-[var(--text-primary)]">
        {title}
      </h3>

      {/* Description */}
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)] leading-relaxed">
        {description}
      </p>

      {/* Optional action button */}
      {action && (
        <Button
          type="button"
          onClick={action.onClick}
          className="mt-6 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}