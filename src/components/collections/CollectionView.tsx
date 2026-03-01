'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { Plus, Copy, Globe, Lock } from 'lucide-react'
import { toast } from 'sonner'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { EmptyState } from '@/components/shared/EmptyState'
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Internal imports — feature components (lazy to avoid circular deps)
import { CollectionPromptCard } from '@/components/collections/CollectionPromptCard'
import { AddEditPromptModal } from '@/components/collections/AddEditPromptModal'

// 6. Internal imports — hooks, utils, types
import { useCollections } from '@/hooks/useCollections'
import { copyToClipboard, cn } from '@/lib/utils'
import type { CollectionPrompt, Collection } from '@/types'

// 7. Local types
interface CollectionViewProps {
  collectionId: string
}

// 8. Inline name editor sub-component
interface InlineNameEditorProps {
  initialName: string
  onSave: (name: string) => Promise<void>
}

function InlineNameEditor({ initialName, onSave }: InlineNameEditorProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [isSaving, setIsSaving] = useState(false)

  const handleBlur = useCallback(async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === initialName) {
      setName(initialName)
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    try {
      await onSave(trimmed)
    } catch {
      setName(initialName)
      toast.error('Failed to rename collection')
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }, [name, initialName, onSave])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.currentTarget.blur()
      }
      if (e.key === 'Escape') {
        setName(initialName)
        setIsEditing(false)
      }
    },
    [initialName]
  )

  if (isEditing) {
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        className={cn(
          'text-2xl font-bold bg-transparent border-b-2 border-[var(--accent-primary)]',
          'text-[var(--text-primary)] outline-none w-full max-w-sm',
          'placeholder:text-[var(--text-tertiary)] transition-colors duration-150'
        )}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title="Click to rename"
      className={cn(
        'text-2xl font-bold text-[var(--text-primary)] text-left',
        'hover:text-[var(--accent-primary)] transition-colors duration-150',
        'rounded focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] outline-none'
      )}
    >
      {name}
    </button>
  )
}

// 9. Component
export function CollectionView({ collectionId }: CollectionViewProps): JSX.Element {
  const {
    collections,
    updateCollection,
    updatePrompt,
    getCollectionPrompts,
  } = useCollections()

  const { prompts, isLoading } = getCollectionPrompts(collectionId)

  // Local optimistic prompt order for drag-and-drop
  const [localPrompts, setLocalPrompts] = useState<CollectionPrompt[] | null>(null)
  const displayPrompts = localPrompts ?? prompts

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<CollectionPrompt | null>(null)

  // Resolve current collection metadata
  const collection = collections.find((c) => c.id === collectionId) as
    | (Collection & { _count?: { prompts: number } })
    | undefined

  const isPublic = collection?.visibility === 'PUBLIC'

  // ─── Drag-and-drop ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent): Promise<void> => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const current = localPrompts ?? prompts
      const oldIndex = current.findIndex((p) => p.id === active.id)
      const newIndex = current.findIndex((p) => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(current, oldIndex, newIndex)
      setLocalPrompts(reordered)

      try {
        await Promise.all(
          reordered.map((p, idx) =>
            updatePrompt(collectionId, p.id, { sortOrder: idx })
          )
        )
      } catch {
        // Rollback
        setLocalPrompts(current)
        toast.error('Failed to reorder prompts')
      }
    },
    [localPrompts, prompts, collectionId, updatePrompt]
  )

  // Keep localPrompts in sync when server data changes (e.g. after add/delete)
  // Reset optimistic order whenever prompts.length changes or ids change
  const promptIds = prompts.map((p) => p.id).join(',')
  // We intentionally use a string comparison to detect changes without exhaustive-deps
  useState(() => {
    setLocalPrompts(null)
  })

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleRename = useCallback(
    async (name: string): Promise<void> => {
      await updateCollection(collectionId, { name })
    },
    [collectionId, updateCollection]
  )

  const handleVisibilityToggle = useCallback(async (): Promise<void> => {
    try {
      await updateCollection(collectionId, {
        visibility: isPublic ? 'PRIVATE' : 'PUBLIC',
      })
      toast.success(isPublic ? 'Collection set to private' : 'Collection is now public')
    } catch {
      toast.error('Failed to update visibility')
    }
  }, [collectionId, isPublic, updateCollection])

  const handleCopyEntireSection = useCallback(async (): Promise<void> => {
    if (displayPrompts.length === 0) {
      toast.info('No prompts to copy')
      return
    }
    const text = displayPrompts
      .map((p, i) => `--- Prompt ${i + 1}: ${p.title} ---\n${p.promptText}`)
      .join('\n\n')
    const success = await copyToClipboard(text)
    if (success) {
      toast.success(`Copied ${displayPrompts.length} prompts to clipboard`)
    } else {
      toast.error('Failed to copy to clipboard')
    }
  }, [displayPrompts])

  const handleAddPrompt = useCallback((): void => {
    setEditingPrompt(null)
    setIsModalOpen(true)
  }, [])

  const handleEditPrompt = useCallback((prompt: CollectionPrompt): void => {
    setEditingPrompt(prompt)
    setIsModalOpen(true)
  }, [])

  const handleModalClose = useCallback((): void => {
    setIsModalOpen(false)
    setEditingPrompt(null)
    // Reset local order so fresh server data is used
    setLocalPrompts(null)
  }, [])

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-[var(--bg-quaternary)]" />
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-md bg-[var(--bg-quaternary)]" />
            <div className="h-9 w-28 animate-pulse rounded-md bg-[var(--bg-quaternary)]" />
          </div>
        </div>
        {/* Card skeletons */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]"
          />
        ))}
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-4">
        {/* Left: name + visibility badge */}
        <div className="flex flex-wrap items-center gap-3">
          {collection ? (
            <InlineNameEditor
              initialName={collection.name}
              onSave={handleRename}
            />
          ) : (
            <div className="h-8 w-40 animate-pulse rounded bg-[var(--bg-quaternary)]" />
          )}

          {/* Visibility toggle badge */}
          <button
            type="button"
            onClick={handleVisibilityToggle}
            title={isPublic ? 'Click to make private' : 'Click to make public'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              'transition-all duration-150 hover:opacity-80 active:scale-95',
              'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] outline-none',
              isPublic
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : 'border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-secondary)]'
            )}
          >
            {isPublic ? (
              <>
                <Globe className="h-3 w-3" />
                Public
              </>
            ) : (
              <>
                <Lock className="h-3 w-3" />
                Private
              </>
            )}
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Copy entire section */}
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyEntireSection}
            disabled={displayPrompts.length === 0}
            className={cn(
              'gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)]',
              'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <Copy className="h-4 w-4" />
            Copy All
          </Button>

          {/* Add prompt */}
          <Button
            type="button"
            onClick={handleAddPrompt}
            className="gap-1.5 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
          >
            <Plus className="h-4 w-4" />
            Add Prompt
          </Button>
        </div>
      </div>

      {/* Prompt count sub-header */}
      {displayPrompts.length > 0 && (
        <div className="px-6 pt-3 pb-1">
          <span className="text-xs text-[var(--text-tertiary)]">
            {displayPrompts.length} {displayPrompts.length === 1 ? 'prompt' : 'prompts'}
          </span>
        </div>
      )}

      {/* Prompt list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {displayPrompts.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No prompts yet"
            description="Add your first prompt to this collection."
            action={{ label: 'Add Prompt', onClick: handleAddPrompt }}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayPrompts.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-3">
                {displayPrompts.map((prompt) => (
                  <CollectionPromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onEdit={handleEditPrompt}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add / Edit prompt modal */}
      <AddEditPromptModal
        open={isModalOpen}
        onClose={handleModalClose}
        collectionId={collectionId}
        editingPrompt={editingPrompt}
      />
    </div>
  )
}

export default CollectionView