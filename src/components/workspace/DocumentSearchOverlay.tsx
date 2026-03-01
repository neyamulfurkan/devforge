'use client'

// 1. React imports
import { useEffect, useRef } from 'react'

// 2. Third-party library imports
import { ChevronUp, ChevronDown, X } from 'lucide-react'

// 3. Internal imports — shared components
import { SearchInput } from '@/components/shared/SearchInput'

// 4. Internal imports — utils
import { cn } from '@/lib/utils'

// Local types
interface DocumentSearchOverlayProps {
  onSearch: (query: string) => void
  matchCount: number
  currentMatch: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

export function DocumentSearchOverlay({
  onSearch,
  matchCount,
  currentMatch,
  onNext,
  onPrev,
  onClose,
}: DocumentSearchOverlayProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  // Focus search input on mount
  useEffect(() => {
    const input = containerRef.current?.querySelector('input')
    input?.focus()
  }, [])

  // Escape key closes the overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          onPrev()
        } else {
          onNext()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNext, onPrev])

  return (
    <div
      ref={containerRef}
      className={cn(
        'w-full bg-[var(--bg-secondary)] border-b border-[var(--border-default)]',
        'px-4 py-2 flex items-center gap-3'
      )}
      role="search"
      aria-label="Search document"
    >
      {/* Search input — minimal 150ms debounce */}
      <div className="flex-1 max-w-sm">
        <SearchInput
          onSearch={onSearch}
          placeholder="Search document…"
          debounceMs={150}
        />
      </div>

      {/* Match counter — hidden when no matches */}
      {matchCount > 0 && (
        <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap select-none">
          {currentMatch} of {matchCount}
        </span>
      )}

      {matchCount === 0 && (
        <span className="text-sm text-[var(--text-tertiary)] whitespace-nowrap select-none">
          No matches
        </span>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={matchCount === 0}
          aria-label="Previous match"
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-md',
            'text-[var(--text-secondary)] transition-colors duration-150',
            'hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
            'disabled:opacity-40 disabled:pointer-events-none',
            // Mobile touch target
            'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0'
          )}
        >
          <ChevronUp className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={matchCount === 0}
          aria-label="Next match"
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-md',
            'text-[var(--text-secondary)] transition-colors duration-150',
            'hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
            'disabled:opacity-40 disabled:pointer-events-none',
            'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0'
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close search"
        className={cn(
          'inline-flex items-center justify-center w-7 h-7 rounded-md',
          'text-[var(--text-tertiary)] transition-colors duration-150',
          'hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
          'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0'
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}