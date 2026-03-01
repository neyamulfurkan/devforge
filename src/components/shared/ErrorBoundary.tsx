'use client'

// 1. React imports
import { Component, type ErrorInfo, type ReactNode } from 'react'

// 2. Local types
interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', info.componentStack)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="flex min-h-[300px] w-full flex-col items-center justify-center p-8">
          <div
            className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-8 text-center shadow-[var(--shadow-md)]"
          >
            {/* Error icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--status-error-bg)]">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                  stroke="var(--status-error)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="text-lg font-medium text-[var(--text-primary)]">
              Something went wrong
            </h2>

            {/* Error message */}
            {this.state.error?.message && (
              <p className="max-w-sm text-sm text-[var(--text-secondary)]">
                {this.state.error.message}
              </p>
            )}

            {/* Try again button */}
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-2 rounded-md bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[var(--accent-hover)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-tertiary)]"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}