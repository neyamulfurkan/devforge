'use client'

// 1. Internal imports — utils
import { cn } from '@/lib/utils'

// ─── LoadingSpinner ───────────────────────────────────────────────────────────

interface LoadingSpinnerProps {
  size?: number
  className?: string
}

export function LoadingSpinner({
  size = 24,
  className,
}: LoadingSpinnerProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('animate-spin', className)}
      aria-label="Loading"
      role="status"
    >
      {/* Background arc — muted */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--border-emphasis)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Foreground arc — accent */}
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="var(--accent-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── FullPageSpinner ──────────────────────────────────────────────────────────

interface FullPageSpinnerProps {
  size?: number
  className?: string
}

export function FullPageSpinner({
  size = 32,
  className,
}: FullPageSpinnerProps): JSX.Element {
  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center',
        'bg-[var(--bg-primary)]/70 backdrop-blur-[2px]',
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <LoadingSpinner size={size} />
    </div>
  )
}

// ─── InlineSpinner ────────────────────────────────────────────────────────────

interface InlineSpinnerProps {
  className?: string
}

export function InlineSpinner({ className }: InlineSpinnerProps): JSX.Element {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('inline-block animate-spin', className)}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={0.3}
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}