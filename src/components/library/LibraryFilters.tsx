'use client'

// 1. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 2. Internal imports — constants, utils
import { AI_TOOLS, PROMPT_CATEGORIES } from '@/lib/constants'
import { cn } from '@/lib/utils'

// 3. Local types
interface LibraryFiltersProps {
  selectedTool: string
  selectedCategory: string
  sortBy: string
  onToolChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onSortChange: (value: string) => void
}

// 4. Sort options
const SORT_OPTIONS = [
  { value: 'most_copied', label: 'Most Copied' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
] as const

// 5. Chip sub-component
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex flex-shrink-0 items-center rounded-full px-3 py-1 text-sm font-medium',
        'transition-all duration-150 whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
        'min-h-[36px] md:min-h-0',
        active
          ? 'bg-[var(--accent-primary)] text-white shadow-sm'
          : [
              'border border-[var(--border-default)] bg-[var(--bg-tertiary)]',
              'text-[var(--text-secondary)]',
              'hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]',
              'hover:bg-[var(--accent-light)]',
            ]
      )}
    >
      {label}
    </button>
  )
}

// 6. Component
export function LibraryFilters({
  selectedTool,
  selectedCategory,
  sortBy,
  onToolChange,
  onCategoryChange,
  onSortChange,
}: LibraryFiltersProps): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: AI Tool chips + Sort (right-aligned) */}
      <div className="flex items-center gap-3">
        {/* Tool chips — scrollable */}
        <div
          className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by AI tool"
        >
          <FilterChip
            label="All"
            active={selectedTool === ''}
            onClick={() => onToolChange('')}
          />
          {AI_TOOLS.map((tool) => (
            <FilterChip
              key={tool.value}
              label={tool.label}
              active={selectedTool === tool.value}
              onClick={() => onToolChange(tool.value)}
            />
          ))}
        </div>

        {/* Sort dropdown — desktop only inline, mobile below */}
        <div className="hidden shrink-0 sm:block">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="Sort prompts"
            className={cn(
              'h-9 rounded-md border px-3 pr-8 text-sm',
              'bg-[var(--bg-tertiary)] border-[var(--border-default)]',
              'text-[var(--text-secondary)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
              'focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
              'transition-colors duration-150 appearance-none cursor-pointer',
              'hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]'
            )}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23606060' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-[var(--bg-secondary)] text-[var(--text-primary)]"
              >
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Category chips */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Filter by category"
      >
        <FilterChip
          label="All"
          active={selectedCategory === ''}
          onClick={() => onCategoryChange('')}
        />
        {PROMPT_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat.value}
            label={cat.label}
            active={selectedCategory === cat.value}
            onClick={() => onCategoryChange(cat.value)}
          />
        ))}
      </div>

      {/* Sort dropdown — mobile only, full width */}
      <div className="sm:hidden">
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sort prompts"
          className={cn(
            'h-10 w-full rounded-md border px-3 text-sm',
            'bg-[var(--bg-tertiary)] border-[var(--border-default)]',
            'text-[var(--text-secondary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
            'transition-colors duration-150 appearance-none'
          )}
        >
          {SORT_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-[var(--bg-secondary)] text-[var(--text-primary)]"
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default LibraryFilters