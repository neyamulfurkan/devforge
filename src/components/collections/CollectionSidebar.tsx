'use client'

// 1. React imports
import { useState, useCallback, useRef } from 'react'

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
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Lock, Globe, Plus, X, Loader2, FolderOpen } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 4. Internal imports — shared components
import { EmptyState } from '@/components/shared/EmptyState'

// 5. Internal imports — hooks, utils, types
import { useCollections } from '@/hooks/useCollections'
import { cn } from '@/lib/utils'
import type { Collection } from '@/types'

// ─── Local types ──────────────────────────────────────────────────────────────

interface CollectionSidebarProps {
  selectedCollectionId: string | null
  onSelect: (id: string) => void
}

interface CollectionWithCount extends Collection {
  _count?: { prompts: number }
}

// ─── Sortable collection item ─────────────────────────────────────────────────

interface SortableCollectionItemProps {
  collection: CollectionWithCount
  isSelected: boolean
  onSelect: (id: string) => void
}

function SortableCollectionItem({
  collection,
  isSelected,
  onSelect,
}: SortableCollectionItemProps): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const promptCount = collection._count?.prompts ?? 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer',
        'transition-all duration-150',
        isSelected
          ? 'bg-[var(--accent-light)] border-l-2 border-[var(--accent-primary)] pl-1.5'
          : 'hover:bg-[var(--bg-quaternary)] border-l-2 border-transparent'
      )}
      onClick={() => onSelect(collection.id)}
      role="button"
      tabIndex={0}
      aria-current={isSelected ? 'true' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(collection.id)
        }
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        className={cn(
          'flex-shrink-0 flex h-5 w-5 items-center justify-center rounded',
          'text-[var(--text-tertiary)] cursor-grab active:cursor-grabbing',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          'touch-none focus-visible:opacity-100'
        )}
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Collection name */}
      <span
        className={cn(
          'flex-1 truncate text-sm leading-snug',
          isSelected
            ? 'text-[var(--accent-primary)] font-medium'
            : 'text-[var(--text-primary)]'
        )}
      >
        {collection.name}
      </span>

      {/* Prompt count badge */}
      <span
        className={cn(
          'flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
          isSelected
            ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
            : 'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] group-hover:bg-[var(--border-default)]'
        )}
      >
        {promptCount}
      </span>

      {/* Visibility icon */}
      {collection.visibility === 'PUBLIC' ? (
        <Globe
          className="flex-shrink-0 h-3.5 w-3.5 text-[var(--status-complete)]"
          aria-label="Public collection"
        />
      ) : (
        <Lock
          className="flex-shrink-0 h-3.5 w-3.5 text-[var(--text-tertiary)]"
          aria-label="Private collection"
        />
      )}
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function CollectionSidebarSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-1 px-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-md px-2 py-2"
        >
          <div className="h-3.5 w-3.5 rounded bg-[var(--bg-quaternary)]" />
          <div
            className="h-4 rounded bg-[var(--bg-quaternary)]"
            style={{ width: `${55 + (i % 3) * 15}%` }}
          />
          <div className="ml-auto h-4 w-5 rounded-full bg-[var(--bg-quaternary)]" />
        </div>
      ))}
    </div>
  )
}

// ─── New collection inline form ───────────────────────────────────────────────

interface NewCollectionFormProps {
  onCreate: (name: string) => Promise<void>
  onCancel: () => void
}

function NewCollectionForm({ onCreate, onCancel }: NewCollectionFormProps): JSX.Element {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on mount
  const focusInput = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus()
      // Store ref without reassigning inputRef (already handled by useRef)
    }
  }, [])

  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmed = name.trim()
    if (!trimmed || isCreating) return
    setIsCreating(true)
    try {
      await onCreate(trimmed)
      // Parent will hide the form on success
    } catch {
      setIsCreating(false)
    }
  }, [name, isCreating, onCreate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void handleSubmit()
      } else if (e.key === 'Escape') {
        onCancel()
      }
    },
    [handleSubmit, onCancel]
  )

  return (
    <div className="px-2 py-1">
      <div className="flex items-center gap-1.5">
        <Input
          ref={focusInput as React.RefCallback<HTMLInputElement>}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Collection name…"
          disabled={isCreating}
          maxLength={100}
          className={cn(
            'h-8 flex-1 bg-[var(--bg-input)] border-[var(--border-default)]',
            'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'focus-visible:ring-[var(--accent-primary)] text-sm'
          )}
        />
        <button
          type="button"
          disabled={!name.trim() || isCreating}
          onClick={() => void handleSubmit()}
          aria-label="Create collection"
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
            'bg-[var(--accent-primary)] text-white transition-all duration-150',
            'hover:bg-[var(--accent-hover)] active:scale-95',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
        >
          {isCreating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isCreating}
          aria-label="Cancel"
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
            'text-[var(--text-tertiary)] transition-colors duration-150',
            'hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 px-0.5 text-xs text-[var(--text-tertiary)]">
        Press Enter to create · Esc to cancel
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CollectionSidebar({
  selectedCollectionId,
  onSelect,
}: CollectionSidebarProps): JSX.Element {
  const [showNewForm, setShowNewForm] = useState(false)

  const { collections, isLoading, createCollection, reorderCollections } =
    useCollections()

  // Local ordered IDs for optimistic drag-and-drop reordering
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null)

  // Resolve display order: use local override while dragging, else server order
  const displayCollections: CollectionWithCount[] = orderedIds
    ? (orderedIds
        .map((id) => (collections as CollectionWithCount[]).find((c) => c.id === id))
        .filter(Boolean) as CollectionWithCount[])
    : (collections as CollectionWithCount[])

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const currentIds = orderedIds ?? collections.map((c) => c.id)
      const oldIndex = currentIds.indexOf(active.id as string)
      const newIndex = currentIds.indexOf(over.id as string)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(currentIds, oldIndex, newIndex)
      setOrderedIds(reordered)
      void reorderCollections(reordered).catch(() => {
        // Rollback on failure
        setOrderedIds(null)
      })
    },
    [collections, orderedIds, reorderCollections]
  )

  const handleCreate = useCallback(
    async (name: string): Promise<void> => {
      await createCollection(name)
      setShowNewForm(false)
      setOrderedIds(null) // reset local order so server order is used
    },
    [createCollection]
  )

  const handleNewClick = useCallback((): void => {
    setShowNewForm(true)
  }, [])

  const handleCancelNew = useCallback((): void => {
    setShowNewForm(false)
  }, [])

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pb-2 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          My Collections
        </h2>
      </div>

      {/* Collection list */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {isLoading ? (
          <CollectionSidebarSkeleton />
        ) : displayCollections.length === 0 && !showNewForm ? (
          <EmptyState
            icon={FolderOpen}
            title="No collections yet"
            description="Create a collection to organize your prompts."
            className="py-8"
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={displayCollections.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-0.5 px-2">
                {displayCollections.map((collection) => (
                  <SortableCollectionItem
                    key={collection.id}
                    collection={collection}
                    isSelected={selectedCollectionId === collection.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* New collection form or button */}
      <div className="border-t border-[var(--border-subtle)] pt-2 pb-1">
        {showNewForm ? (
          <NewCollectionForm onCreate={handleCreate} onCancel={handleCancelNew} />
        ) : (
          <div className="px-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleNewClick}
              className={cn(
                'w-full justify-start gap-2 text-sm',
                'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                'hover:bg-[var(--bg-quaternary)] h-9 px-2'
              )}
            >
              <Plus className="h-4 w-4 flex-shrink-0" />
              New Collection
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CollectionSidebar