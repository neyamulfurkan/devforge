// 1. React imports
import type { ReactNode } from 'react'

// 2. Local types
interface AuthLayoutProps {
  children: ReactNode
}

// 3. Component — Server Component (no 'use client')
export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Subtle radial gradient background — matches landing page hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Animated grid overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content wrapper — sits above background layers */}
      <div className="relative z-10 flex w-full flex-col items-center px-4 py-12">
        {/* Logo / wordmark */}
        <div className="mb-8 flex items-center gap-2.5 select-none">
          {/* Icon mark */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)',
              boxShadow: 'var(--shadow-glow)',
            }}
            aria-hidden="true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Platform name */}
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            DevForge
          </span>
        </div>

        {/* Page content (card) */}
        {children}
      </div>
    </div>
  )
}