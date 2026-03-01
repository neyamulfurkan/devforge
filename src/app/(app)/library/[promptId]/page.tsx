'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Next.js imports
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'

// 3. Third-party library imports
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Star, Copy, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

// 4. Internal imports — UI components
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// 5. Internal imports — shared components
import { EmptyState } from '@/components/shared/EmptyState'
import { CopyButton } from '@/components/shared/CopyButton'
import { PageContainer } from '@/components/layout/PageContainer'

// 6. Internal imports — feature components
import { PromptCard } from '@/components/library/PromptCard'

// 7. Internal imports — hooks, utils, types
import { useLibrary } from '@/hooks/useLibrary'
import { useCollections } from '@/hooks/useCollections'
import { formatRelativeTime, cn } from '@/lib/utils'
import { AI_TOOL_COLOR_MAP, AI_TOOLS } from '@/lib/constants'
import type { LibraryPrompt, ApiResponse } from '@/types'

// Extended type — API returns author via Prisma include
type LibraryPromptWithAuthor = LibraryPrompt & {
  author: { name: string; profileImageUrl: string | null } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCopyCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

function computeRating(ratingSum: number, ratingCount: number): number {
  if (ratingCount === 0) return 0
  return Math.round((ratingSum / ratingCount) * 10) / 10
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              i < Math.round(rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-[var(--border-emphasis)]'
            )}
          />
        ))}
      </div>
      <span className="text-sm text-[var(--text-secondary)]">
        {rating > 0 ? rating.toFixed(1) : '—'}
      </span>
      {count > 0 && (
        <span className="text-xs text-[var(--text-tertiary)]">({count} ratings)</span>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PromptDetailSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-2/3 rounded-lg bg-[var(--bg-quaternary)]" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-[var(--bg-quaternary)]" />
        <div className="h-4 w-4/5 rounded bg-[var(--bg-quaternary)]" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded-full bg-[var(--bg-quaternary)]" />
        <div className="h-6 w-24 rounded-full bg-[var(--bg-quaternary)]" />
      </div>
      <div className="h-48 rounded-xl bg-[var(--bg-quaternary)]" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LibraryPromptDetailPage(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const promptId = params.promptId as string

  const { copyPrompt, saveToCollection } = useLibrary()
  const { collections } = useCollections()

  const [isSaving, setIsSaving] = useState(false)

  // Fetch single prompt
  const {
    data: prompt,
    isLoading,
    isError,
  } = useQuery<LibraryPromptWithAuthor | null>({
    queryKey: ['library-prompt', promptId],
    queryFn: async (): Promise<LibraryPromptWithAuthor | null> => {
      const res = await fetch(`/api/library/${promptId}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch prompt')
      const json: ApiResponse<LibraryPromptWithAuthor> = await res.json()
      return json.data ?? null
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch related prompts (same aiTool or category)
  const { data: relatedData } = useQuery({
    queryKey: ['library-related', prompt?.aiTool, prompt?.category],
    queryFn: async (): Promise<LibraryPrompt[]> => {
      if (!prompt) return []
      const params = new URLSearchParams({ tool: prompt.aiTool, pageSize: '4' })
      const res = await fetch(`/api/library?${params.toString()}`)
      if (!res.ok) return []
      const json: ApiResponse<{ items: LibraryPrompt[] }> = await res.json()
      // Exclude current prompt
      return (json.data?.items ?? []).filter((p) => p.id !== promptId)
    },
    enabled: !!prompt,
    staleTime: 5 * 60 * 1000,
  })

  const relatedPrompts = relatedData ?? []

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!prompt) return
    await copyPrompt(prompt.id)
  }, [prompt, copyPrompt])

  const handleSaveToCollection = useCallback(
    async (collectionId: string): Promise<void> => {
      if (!prompt) return
      setIsSaving(true)
      try {
        await saveToCollection(prompt.id, collectionId)
        toast.success('Saved to collection')
      } catch {
        toast.error('Failed to save to collection')
      } finally {
        setIsSaving(false)
      }
    },
    [prompt, saveToCollection]
  )

  // ── Error / not found ───────────────────────────────────────────────────
  if (!isLoading && (isError || prompt === null)) {
    return (
      <PageContainer>
        <EmptyState
          icon={BookOpen}
          title="Prompt not found"
          description="This prompt may have been removed or doesn't exist."
          action={{ label: 'Back to Library', onClick: () => router.push('/library') }}
        />
      </PageContainer>
    )
  }

  const toolMeta = AI_TOOLS.find((t) => t.value === prompt?.aiTool)
  const toolLabel = toolMeta?.label ?? prompt?.aiTool ?? ''
  const toolColor =
    prompt?.aiTool ? (AI_TOOL_COLOR_MAP[prompt.aiTool] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20') : ''
  const rating = prompt ? computeRating(prompt.ratingSum, prompt.ratingCount) : 0

  return (
    <PageContainer>
      {/* Back nav */}
      <button
        type="button"
        onClick={() => router.back()}
        className={cn(
          'mb-6 flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]',
          'hover:text-[var(--text-secondary)] transition-colors duration-150'
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </button>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PromptDetailSkeleton />
          </motion.div>
        ) : prompt ? (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-8"
          >
            {/* Two-column layout on desktop */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* ── Main content (2/3) ─────────────────────────────── */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                {/* Title */}
                <h1 className="text-3xl font-bold leading-tight text-[var(--text-primary)]">
                  {prompt.title}
                </h1>

                {/* Description */}
                <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
                  {prompt.description}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                      toolColor
                    )}
                  >
                    {toolLabel}
                  </span>
                  <Badge
                    variant="outline"
                    className="capitalize text-xs text-[var(--text-secondary)]"
                  >
                    {prompt.category.replace(/_/g, ' ')}
                  </Badge>
                </div>

                {/* Prompt text block */}
                <div className="relative rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)]">
                  {/* Header bar */}
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5">
                    <span className="text-xs font-medium text-[var(--text-tertiary)]">
                      Prompt Text
                    </span>
                    <CopyButton
                      value={prompt.promptText}
                      size="lg"
                      label="Copy"
                      className="gap-1.5 text-sm"
                    />
                  </div>
                  {/* Content */}
                  <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words max-h-[520px] overflow-y-auto">
                    {prompt.promptText}
                  </pre>
                </div>

                {/* Copy + Save actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleCopy}
                    className="gap-2 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Prompt
                  </Button>

                  {/* Save to Collection dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        className="gap-2 border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Save to Collection
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-56 border-[var(--border-default)] bg-[var(--bg-tertiary)]"
                    >
                      <DropdownMenuLabel className="text-xs text-[var(--text-tertiary)]">
                        My Collections
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
                      {collections.length === 0 ? (
                        <DropdownMenuItem disabled className="text-xs text-[var(--text-tertiary)]">
                          No collections yet
                        </DropdownMenuItem>
                      ) : (
                        collections.map((col) => (
                          <DropdownMenuItem
                            key={col.id}
                            onClick={() => void handleSaveToCollection(col.id)}
                            className="cursor-pointer text-sm text-[var(--text-primary)] focus:bg-[var(--bg-quaternary)]"
                          >
                            {col.name}
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* ── Sidebar (1/3) ──────────────────────────────────── */}
              <aside className="flex flex-col gap-6">
                {/* Stats card */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Stats
                  </h2>
                  <div className="flex flex-col gap-4">
                    {/* Copy count */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-secondary)]">Total copies</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatCopyCount(prompt.copyCount)}
                      </span>
                    </div>
                    {/* Rating */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm text-[var(--text-secondary)]">Rating</span>
                      <StarRating rating={rating} count={prompt.ratingCount} />
                    </div>
                  </div>
                </div>

                {/* Author card */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    Author
                  </h2>
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-[var(--accent-light)]">
                      {prompt.author?.profileImageUrl ? (
                        <Image
                          src={prompt.author.profileImageUrl}
                          alt={prompt.author.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-[var(--accent-primary)]">
                          {getInitials(prompt.author?.name ?? 'U')}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {prompt.author?.name ?? 'Anonymous'}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {formatRelativeTime(prompt.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {/* ── Related Prompts ─────────────────────────────────── */}
            {relatedPrompts.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">
                  Related Prompts
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {relatedPrompts.slice(0, 4).map((related) => (
                    <PromptCard key={related.id} prompt={related} />
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </PageContainer>
  )
}