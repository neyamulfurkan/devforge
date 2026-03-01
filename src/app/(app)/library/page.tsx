'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { Plus } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 4. Internal imports — layout components
import { PageContainer } from '@/components/layout/PageContainer'

// 5. Internal imports — shared components
import { SearchInput } from '@/components/shared/SearchInput'

// 6. Internal imports — feature components
import { LibraryFilters } from '@/components/library/LibraryFilters'
import { PromptGrid } from '@/components/library/PromptGrid'
import { SubmitPromptModal } from '@/components/library/SubmitPromptModal'

// 7. Internal imports — hooks
import { useLibrary } from '@/hooks/useLibrary'
import { useSession } from 'next-auth/react'

// 8. Component definition
export default function LibraryPage(): JSX.Element {
  // 8a. State hooks
  const [selectedTool, setSelectedTool] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [sortBy, setSortBy] = useState<'most_copied' | 'highest_rated' | 'newest' | 'trending'>('most_copied')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [submitModalOpen, setSubmitModalOpen] = useState(false)

  // 8b. External hooks
  const { data: session } = useSession()
  const { prompts, isLoading, hasMore, deletePrompt } = useLibrary({
    tool: selectedTool || undefined,
    category: selectedCategory || undefined,
    sort: sortBy,
    search: searchQuery || undefined,
    page,
  })

  // 8c. Event handlers — reset page to 1 on any filter change
  const handleToolChange = useCallback((value: string): void => {
    setSelectedTool(value)
    setPage(1)
  }, [])

  const handleCategoryChange = useCallback((value: string): void => {
    setSelectedCategory(value)
    setPage(1)
  }, [])

  const handleSortChange = useCallback((value: string): void => {
    setSortBy(value as typeof sortBy)
    setPage(1)
  }, [])

  const handleSearch = useCallback((value: string): void => {
    setSearchQuery(value)
    setPage(1)
  }, [])

  const handleLoadMore = useCallback((): void => {
    setPage((prev) => prev + 1)
  }, [])

  // 8f. JSX return
  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Prompt Library</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Discover and copy prompts for Claude, ChatGPT, Midjourney, and more
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setSubmitModalOpen(true)}
          className="shrink-0 gap-2 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
        >
          <Plus className="h-4 w-4" />
          Submit a Prompt
        </Button>
      </div>

      {/* Search bar — prominent, full width */}
      <div className="mb-4">
        <SearchInput
          onSearch={handleSearch}
          placeholder="Search prompts for Claude, ChatGPT, Midjourney…"
          debounceMs={300}
          className="w-full"
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <LibraryFilters
          selectedTool={selectedTool}
          selectedCategory={selectedCategory}
          sortBy={sortBy}
          onToolChange={handleToolChange}
          onCategoryChange={handleCategoryChange}
          onSortChange={handleSortChange}
        />
      </div>

      {/* Prompt grid */}
      <PromptGrid
        prompts={prompts}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onDelete={deletePrompt}
        currentUserId={session?.user?.id ?? null}
      />

      {/* Submit prompt modal */}
      <SubmitPromptModal
        open={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
      />
    </PageContainer>
  )
}