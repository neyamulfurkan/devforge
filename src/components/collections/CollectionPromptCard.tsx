'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Edit2, Trash2, Globe, Lock, Pin, PinOff } from 'lucide-react'
import { toast } from 'sonner'

// 3. Internal imports — UI components
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { ConfirmModal } from '@/components/shared/ConfirmModal'

// 5. Internal imports — hooks, utils, types
import { useCollections } from '@/hooks/useCollections'
import { useQuickPrompts } from '@/hooks/useQuickPrompts'
import { cn, truncate } from '@/lib/utils'
import { AI_TOOL_COLOR_MAP, AI_TOOLS } from '@/lib/constants'
import type { CollectionPrompt } from '@/types'

// 6. Local types
interface CollectionPromptCardProps {
  prompt: CollectionPrompt
  onEdit: (prompt: CollectionPrompt) => void
}

// 7. Component
export function CollectionPromptCard({
  prompt,
  onEdit,
}: CollectionPromptCardProps): JSX.Element {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false)

  const { updatePrompt, deletePrompt } = useCollections()
  const { handlePin, isPinned } = useQuickPrompts()
  const pinned = isPinned(prompt.id)

  // ─── dnd-kit sortable ────────────────────────────────────────────────────
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prompt.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // ─── Resolve AI tool metadata ────────────────────────────────────────────
  const toolMeta = AI_TOOLS.find((t) => t.value === prompt.aiTool)
  const toolLabel = toolMeta?.label ?? prompt.aiTool
  const toolColor =
    prompt.aiTool != null
      ? (AI_TOOL_COLOR_MAP[prompt.aiTool] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20')
      : null

  const isPublic = prompt.visibility === 'PUBLIC'

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleToggleVisibility = useCallback(async (): Promise<void> => {
    setIsTogglingVisibility(true)
    try {
      await updatePrompt(prompt.collectionId, prompt.id, {
        visibility: isPublic ? 'PRIVATE' : 'PUBLIC',
      })
      toast.success(
        isPublic ? 'Prompt set to private' : 'Prompt published to library'
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update visibility'
      toast.error(message)
    } finally {
      setIsTogglingVisibility(false)
    }
  }, [prompt.collectionId, prompt.id, isPublic, updatePrompt])

  const handleDelete = useCallback(async (): Promise<void> => {
    await deletePrompt(prompt.collectionId, prompt.id)
    toast.success('Prompt deleted')
    setShowDeleteModal(false)
  }, [prompt.collectionId, prompt.id, deletePrompt])

  const handleEdit = useCallback((): void => {
    onEdit(prompt)
  }, [prompt, onEdit])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-start gap-3 rounded-xl border bg-[var(--bg-tertiary)] p-4',
          'border-[var(--border-subtle)] transition-all duration-150',
          'hover:border-[var(--border-default)]',
          isDragging && 'opacity-50 shadow-[var(--shadow-lg)] z-50'
        )}
      >
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Drag to reorder"
          className={cn(
            'mt-0.5 flex-shrink-0 cursor-grab text-[var(--text-tertiary)]',
            'hover:text-[var(--text-secondary)] transition-colors duration-150',
            'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
            'flex items-center justify-center rounded-md',
            'focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[var(--accent-primary)]',
            'active:cursor-grabbing'
          )}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <p className="text-sm font-medium text-[var(--text-primary)] leading-snug">
            {prompt.title}
          </p>

          {/* Truncated prompt text */}
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)] font-mono">
            {truncate(prompt.promptText, 100)}
          </p>

          {/* AI tool badge (if set) */}
          {prompt.aiTool != null && toolColor != null && (
            <div className="mt-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                  toolColor
                )}
              >
                {toolLabel}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {/* Pin to Quick Prompts */}
          <button
            type="button"
            onClick={() =>
              handlePin({
                id: prompt.id,
                title: prompt.title,
                promptText: prompt.promptText,
                aiTool: prompt.aiTool ?? null,
                category: prompt.category ?? null,
                sourceType: 'collection',
                sourceId: prompt.collectionId,
              })
            }
            aria-label={pinned ? 'Unpin from Quick Prompts' : 'Pin to Quick Prompts'}
            className={cn(
              'flex items-center justify-center rounded-md w-7 h-7 transition-all duration-150',
              'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
              pinned
                ? 'text-[var(--accent-primary)] bg-[var(--accent-light)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-light)]'
            )}
          >
            {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>

          {/* Copy button — always visible */}
          <CopyButton
            value={prompt.promptText}
            size="sm"
            aria-label="Copy prompt"
          />

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={handleToggleVisibility}
            disabled={isTogglingVisibility}
            aria-label={isPublic ? 'Set to private' : 'Publish to library'}
            className={cn(
              'flex items-center justify-center rounded-md w-7 h-7',
              'transition-colors duration-150',
              'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-[var(--accent-primary)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isPublic
                ? 'text-[var(--accent-primary)] hover:text-[var(--accent-hover)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            {isPublic ? (
              <Globe className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
          </button>

          {/* Edit button */}
          <button
            type="button"
            onClick={handleEdit}
            aria-label="Edit prompt"
            className={cn(
              'flex items-center justify-center rounded-md w-7 h-7',
              'text-[var(--text-tertiary)] transition-colors duration-150',
              'hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)]',
              'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-[var(--accent-primary)]'
            )}
          >
            <Edit2 className="w-4 h-4" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            aria-label="Delete prompt"
            className={cn(
              'flex items-center justify-center rounded-md w-7 h-7',
              'text-[var(--text-tertiary)] transition-colors duration-150',
              'hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)]',
              'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-[var(--status-error)]'
            )}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={showDeleteModal}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        title="Delete Prompt"
        description={`Are you sure you want to delete "${prompt.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
      />
    </>
  )
}

export default CollectionPromptCard