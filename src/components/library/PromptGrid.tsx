'use client'

// 1. Third-party library imports
import { Search } from 'lucide-react'

// 2. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 3. Internal imports — shared components
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// 4. Internal imports — feature components, types
import { PromptCard } from '@/components/library/PromptCard'
import type { LibraryPrompt } from '@/types'

// 5. Local types
interface PromptGridProps {
  prompts: LibraryPrompt[]
  isLoading: boolean
  onLoadMore: () => void
  hasMore: boolean
  onDelete?: (promptId: string) => Promise<void>
  currentUserId?: string | null
}

// 6. Skeleton card matching PromptCard height
function PromptCardSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5 animate-pulse">
      {/* Title skeleton */}
      <div className="h-5 w-3/4 rounded bg-[var(--bg-quaternary)]" />
      {/* Description skeleton */}
      <div className="mt-2 space-y-1.5">
        <div className="h-3.5 w-full rounded bg-[var(--bg-quaternary)]" />
        <div className="h-3.5 w-5/6 rounded bg-[var(--bg-quaternary)]" />
      </div>
      {/* Badges */}
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-16 rounded-full bg-[var(--bg-quaternary)]" />
        <div className="h-5 w-20 rounded-full bg-[var(--bg-quaternary)]" />
      </div>
      {/* Rating + count */}
      <div className="mt-3 flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-[var(--bg-quaternary)]" />
        <div className="h-4 w-16 rounded bg-[var(--bg-quaternary)]" />
      </div>
      {/* Copy button */}
      <div className="mt-4 h-10 w-full rounded-md bg-[var(--bg-quaternary)]" />
    </div>
  )
}

// 7. Component
export function PromptGrid({
  prompts,
  isLoading,
  onLoadMore,
  hasMore,
  onDelete,
  currentUserId,
}: PromptGridProps): JSX.Element {
  // Loading with no data yet → show skeletons
  if (isLoading && prompts.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <PromptCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // Empty state
  if (!isLoading && prompts.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No prompts found"
        description="Be the first to submit one, or try adjusting your filters."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onDelete={onDelete}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {/* Loading more indicator */}
      {isLoading && prompts.length > 0 && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size={24} />
        </div>
      )}

      {/* Load More button */}
      {!isLoading && hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onLoadMore}
            className="border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] px-8"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}

export default PromptGrid