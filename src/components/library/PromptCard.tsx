'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { Bookmark, BookmarkCheck, Check, ChevronDown, ChevronUp, Copy, Star, Trash2, Pin, PinOff } from 'lucide-react'

// 3. Internal imports — UI components
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Internal imports — hooks, constants, utils, types
import { useLibrary } from '@/hooks/useLibrary'
import { useQuickPrompts } from '@/hooks/useQuickPrompts'
import { SaveToCollectionModal } from '@/components/library/SaveToCollectionModal'
import { AI_TOOL_COLOR_MAP, AI_TOOLS } from '@/lib/constants'
import { copyToClipboard, cn } from '@/lib/utils'
import type { LibraryPrompt } from '@/types'

// 6. Local types
interface PromptCardProps {
  prompt: LibraryPrompt
  currentUserId?: string | null
  onDelete?: (promptId: string) => void
}

// 7. Helper — format copy count (2400 → "2.4k")
function formatCopyCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

// 8. Helper — compute average rating from 0–5
function computeRating(ratingSum: number, ratingCount: number): number {
  if (ratingCount === 0) return 0
  return Math.round((ratingSum / ratingCount) * 10) / 10
}

// 9. StarRating sub-component
function StarRating({ rating }: { rating: number }): JSX.Element {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i < Math.round(rating)
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-transparent text-[var(--border-emphasis)]'
          )}
        />
      ))}
      <span className="ml-1 text-xs text-[var(--text-tertiary)]">{rating > 0 ? rating.toFixed(1) : '—'}</span>
    </div>
  )
}

// 10. Component
export function PromptCard({ prompt, currentUserId, onDelete }: PromptCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [saveModalOpen, setSaveModalOpen] = useState(false)

  const { copyPrompt } = useLibrary()
  const { handlePin, isPinned } = useQuickPrompts()
  const pinned = isPinned(prompt.id)

  // Resolve AI tool label and color
  const toolMeta = AI_TOOLS.find((t) => t.value === prompt.aiTool)
  const toolLabel = toolMeta?.label ?? prompt.aiTool
  const toolColor = AI_TOOL_COLOR_MAP[prompt.aiTool] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20'

  const rating = computeRating(prompt.ratingSum, prompt.ratingCount)

  // Handle copy: clipboard + increment count
  const handleCopy = useCallback(async (): Promise<void> => {
    await copyToClipboard(prompt.promptText)
    await copyPrompt(prompt.id)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }, [prompt.promptText, prompt.id, copyPrompt])

  const handleSave = useCallback((): void => {
    setSaveModalOpen(true)
  }, [])

  const isOwner = Boolean(currentUserId && (prompt as LibraryPrompt & { authorId?: string }).authorId === currentUserId)

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!confirm('Delete this prompt? This cannot be undone.')) return
    onDelete?.(prompt.id)
  }, [prompt.id, onDelete])

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border bg-[var(--bg-tertiary)]',
        'border-[var(--border-subtle)] p-5 transition-all duration-150',
        'hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-md)]'
      )}
    >
      {/* Delete — only for author */}
      {isOwner && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Delete prompt"
          className={cn(
            'absolute right-20 top-3 flex h-8 w-8 items-center justify-center rounded-md',
            'text-[var(--text-tertiary)] transition-colors duration-150',
            'hover:text-red-400 hover:bg-red-400/10'
          )}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      {/* Pin to Quick Prompts */}
      <button
        type="button"
        onClick={() =>
          handlePin({
            id: prompt.id,
            title: prompt.title,
            promptText: prompt.promptText,
            aiTool: prompt.aiTool,
            category: prompt.category,
            sourceType: 'library',
            sourceId: prompt.id,
          })
        }
        aria-label={pinned ? 'Unpin from Quick Prompts' : 'Pin to Quick Prompts'}
        className={cn(
          'absolute right-12 top-3 flex h-8 w-8 items-center justify-center rounded-md',
          'transition-all duration-150',
          'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
          pinned
            ? 'text-[var(--accent-primary)] bg-[var(--accent-light)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-light)]'
        )}
      >
        {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
      </button>

      {/* Bookmark — top-right */}
      <button
        type="button"
        onClick={handleSave}
        aria-label="Save to collection"
        className={cn(
          'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md',
          'text-[var(--text-tertiary)] transition-colors duration-150',
          'hover:text-[var(--accent-primary)] hover:bg-[var(--accent-light)]',
          'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
          isSaved && 'text-[var(--accent-primary)]'
        )}
      >
        <Bookmark className={cn('w-4 h-4', isSaved && 'fill-[var(--accent-primary)]')} />
      </button>

      {/* Title */}
      <h3 className="pr-8 text-[16px] font-semibold leading-snug text-[var(--text-primary)] line-clamp-2">
        {prompt.title}
      </h3>

      {/* Description — 2-line clamp */}
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2">
        {prompt.description}
      </p>

      {/* Badges row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
            toolColor
          )}
        >
          {toolLabel}
        </span>
        <Badge variant="outline" className="text-xs capitalize text-[var(--text-secondary)]">
          {prompt.category.replace('_', ' ')}
        </Badge>
      </div>

      {/* Rating + copy count */}
      <div className="mt-3 flex items-center justify-between">
        <StarRating rating={rating} />
        <span className="text-xs text-[var(--text-tertiary)]">
          {formatCopyCount(prompt.copyCount)} copies
        </span>
      </div>

      {/* Expandable prompt text */}
      {isExpanded && (
        <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--text-secondary)] max-h-48 overflow-y-auto">
            {prompt.promptText}
          </pre>
        </div>
      )}

      {/* Expand / collapse toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className={cn(
          'mt-3 flex items-center gap-1 self-start text-xs text-[var(--text-tertiary)]',
          'hover:text-[var(--text-secondary)] transition-colors duration-150'
        )}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" /> Hide prompt
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" /> Show prompt
          </>
        )}
      </button>

      {/* Copy button — large full-width */}
      <Button
        type="button"
        onClick={handleCopy}
        className={cn(
          'mt-4 w-full font-medium transition-all duration-150 active:scale-95 gap-2',
          isCopied
            ? 'bg-green-600 hover:bg-green-600 text-white'
            : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white'
        )}
      >
        {isCopied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy Prompt
          </>
        )}
      </Button>
<SaveToCollectionModal
        open={saveModalOpen}
        promptId={prompt.id}
        onClose={() => {
          setSaveModalOpen(false)
          setIsSaved(true)
        }}
      />
    </div>
  )
}

export default PromptCard