'use client'

// 1. Internal imports — UI components
import { Badge } from '@/components/ui/badge'

// 2. Internal imports — utils
import { cn } from '@/lib/utils'

// 3. Internal imports — types
import type { FileStatus } from '@/types'

// Local types
interface StatusBadgeProps {
  status: FileStatus
  className?: string
}

// Maps FileStatus to display label and Tailwind classes (Section 7.3)
const STATUS_CONFIG: Record<
  FileStatus,
  { label: string; className: string; dotColor: string }
> = {
  EMPTY: {
    label: 'Empty',
    className:
      'bg-[var(--status-empty-bg)] text-[var(--status-empty)] border border-[var(--status-empty)]/20',
    dotColor: 'bg-[var(--status-empty)]',
  },
  CODE_PASTED: {
    label: 'Code Pasted',
    className:
      'bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)] border border-[var(--status-in-progress)]/20',
    dotColor: 'bg-[var(--status-in-progress)]',
  },
  COMPLETE: {
    label: 'Complete',
    className:
      'bg-[var(--status-complete-bg)] text-[var(--status-complete)] border border-[var(--status-complete)]/20',
    dotColor: 'bg-[var(--status-complete)]',
  },
  ERROR: {
    label: 'Error',
    className:
      'bg-[var(--status-error-bg)] text-[var(--status-error)] border border-[var(--status-error)]/20',
    dotColor: 'bg-[var(--status-error)]',
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps): JSX.Element {
  const config = STATUS_CONFIG[status]

  return (
    <Badge
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {/* Dot indicator */}
      <span
        className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', config.dotColor)}
        aria-hidden="true"
      />
      {config.label}
    </Badge>
  )
}