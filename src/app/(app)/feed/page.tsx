'use client'

// 1. React imports
import { useState, useCallback, useMemo } from 'react'

// 2. Third-party library imports
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Globe, Loader2 } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// 4. Internal imports — shared components
import { EmptyState } from '@/components/shared/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'

// 5. Internal imports — feature components
import { FeedProjectCard } from '@/components/feed/FeedProjectCard'
import { ShareProjectModal } from '@/components/feed/ShareProjectModal'

// 6. Internal imports — types, utils
import { cn } from '@/lib/utils'
import type { SharedProjectWithAuthor, PaginatedResult, ApiResponse, Project } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_TYPE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Web App', value: 'WebApp' },
  { label: 'Mobile', value: 'Mobile' },
  { label: 'Game', value: 'Game' },
  { label: 'API', value: 'API' },
  { label: 'Dashboard', value: 'Dashboard' },
  { label: 'Other', value: 'Other' },
] as const

type ProjectTypeFilter = (typeof PROJECT_TYPE_FILTERS)[number]['value']

const SORT_OPTIONS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Most Viewed', value: 'most_viewed' },
  { label: 'Most Copied', value: 'most_copied' },
] as const

type SortOption = (typeof SORT_OPTIONS)[number]['value']

const PAGE_SIZE = 12

// ─── Filter chip ─────────────────────────────────────────────────────────────

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-150',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] outline-none',
        'active:scale-95',
        active
          ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
          : 'border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]'
      )}
    >
      {label}
    </button>
  )
}

// ─── Feed grid skeleton ───────────────────────────────────────────────────────

function FeedGridSkeleton(): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-72 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]"
        />
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedPage(): JSX.Element {
  const [activeType, setActiveType] = useState<ProjectTypeFilter>('all')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [page, setPage] = useState(1)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams()
    if (activeType !== 'all') p.set('type', activeType)
    p.set('sort', sortBy)
    p.set('page', String(page))
    p.set('pageSize', String(PAGE_SIZE))
    return p.toString()
  }, [activeType, sortBy, page])

  // Fetch feed
  const { data: feedData, isLoading: isFeedLoading } = useQuery({
    queryKey: ['feed', activeType, sortBy, page],
    queryFn: async (): Promise<PaginatedResult<SharedProjectWithAuthor>> => {
      const res = await fetch(`/api/feed?${queryParams}`)
      if (!res.ok) throw new Error('Failed to fetch feed')
      const json: ApiResponse<PaginatedResult<SharedProjectWithAuthor>> = await res.json()
      if (!json.data) throw new Error(json.error ?? 'Unknown error')
      return json.data
    },
    staleTime: 2 * 60 * 1000,
  })

  // Fetch user's projects for ShareProjectModal
  const { data: userProjects = [] } = useQuery<Project[]>({
    queryKey: ['user-projects-for-feed'],
    queryFn: async (): Promise<Project[]> => {
      const res = await fetch('/api/projects')
      if (!res.ok) return []
      const json: ApiResponse<Project[]> = await res.json()
      return json.data ?? []
    },
    staleTime: 60 * 1000,
    enabled: shareModalOpen, // only fetch when modal opens
  })

  const projects = feedData?.items ?? []
  const hasMore = feedData?.hasMore ?? false
  const total = feedData?.total ?? 0

  // Reset page when filters change
  const handleTypeChange = useCallback((type: ProjectTypeFilter): void => {
    setActiveType(type)
    setPage(1)
  }, [])

  const handleSortChange = useCallback((sort: SortOption): void => {
    setSortBy(sort)
    setPage(1)
  }, [])

  const handleLoadMore = useCallback((): void => {
    setPage((prev) => prev + 1)
  }, [])

  const handleShareOpen = useCallback((): void => {
    setShareModalOpen(true)
  }, [])

  const handleShareClose = useCallback((): void => {
    setShareModalOpen(false)
  }, [])

  return (
    <PageContainer>
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Project Feed</h1>
          {total > 0 && !isFeedLoading && (
            <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">
              {total.toLocaleString()} project{total !== 1 ? 's' : ''} shared
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleShareOpen}
          className="gap-2 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
        >
          <Globe className="h-4 w-4" />
          Share a Project
        </Button>
      </div>

      {/* ── Filter row ───────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Project type chips */}
        <div className="flex flex-wrap items-center gap-2">
          {PROJECT_TYPE_FILTERS.map(({ label, value }) => (
            <FilterChip
              key={value}
              label={label}
              active={activeType === value}
              onClick={() => handleTypeChange(value)}
            />
          ))}
        </div>

        {/* Sort dropdown */}
        <Select value={sortBy} onValueChange={(v) => handleSortChange(v as SortOption)}>
          <SelectTrigger
            className={cn(
              'h-9 w-40 border-[var(--border-default)] bg-[var(--bg-tertiary)]',
              'text-sm text-[var(--text-primary)] focus:ring-[var(--accent-primary)]'
            )}
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="border-[var(--border-default)] bg-[var(--bg-tertiary)]">
            {SORT_OPTIONS.map(({ label, value }) => (
              <SelectItem
                key={value}
                value={value}
                className="text-sm text-[var(--text-primary)] focus:bg-[var(--bg-quaternary)]"
              >
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Feed grid ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isFeedLoading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FeedGridSkeleton />
          </motion.div>
        ) : projects.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={Globe}
              title="No projects yet"
              description="Be the first to share a project with the community."
              action={{ label: 'Share a Project', onClick: handleShareOpen }}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`feed-${activeType}-${sortBy}-${page}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {projects.map((project) => (
                <FeedProjectCard key={project.id} project={project} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-10 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadMore}
                  className={cn(
                    'min-w-[140px] border-[var(--border-default)]',
                    'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    'hover:border-[var(--border-emphasis)] transition-all duration-150'
                  )}
                >
                  {isFeedLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Share modal ───────────────────────────────────────────────────── */}
      <ShareProjectModal
        open={shareModalOpen}
        onClose={handleShareClose}
        projects={userProjects}
      />
    </PageContainer>
  )
}