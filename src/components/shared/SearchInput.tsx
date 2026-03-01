'use client'

// 1. React imports
import { useState, useEffect, useRef, useCallback } from 'react'

// 2. Third-party library imports
import { Search, X } from 'lucide-react'

// 3. Internal imports — UI components
import { Input } from '@/components/ui/input'

// 4. Internal imports — utils
import { cn, debounce } from '@/lib/utils'

// Local types
interface SearchInputProps {
  onSearch: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export function SearchInput({
  onSearch,
  placeholder = 'Search…',
  debounceMs = 300,
  className,
}: SearchInputProps): JSX.Element {
  const [value, setValue] = useState('')

  // Stable debounced callback — recreate only when onSearch or debounceMs changes
  const debouncedSearch = useRef(debounce(onSearch as (...args: unknown[]) => unknown, debounceMs))

  useEffect(() => {
    debouncedSearch.current = debounce(onSearch as (...args: unknown[]) => unknown, debounceMs)
  }, [onSearch, debounceMs])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const next = e.target.value
      setValue(next)
      debouncedSearch.current(next)
    },
    []
  )

  const handleClear = useCallback((): void => {
    setValue('')
    onSearch('')
  }, [onSearch])

  return (
    <div className={cn('relative', className)}>
      {/* Search icon */}
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]"
        aria-hidden="true"
      />

      <Input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'pl-9 bg-[var(--bg-input)] border-[var(--border-default)]',
          'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
          'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)]',
          'transition-colors duration-150',
          // Extra right padding when clear button is visible
          value ? 'pr-8' : 'pr-3'
        )}
        aria-label={placeholder}
      />

      {/* Clear button — only when value is non-empty */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'flex h-5 w-5 items-center justify-center rounded-sm',
            'text-[var(--text-tertiary)] transition-colors duration-150',
            'hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
            // Mobile touch target
            'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}