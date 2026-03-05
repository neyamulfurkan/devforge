'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { AnimatePresence, motion } from 'framer-motion'
import { FolderOpen, Layers, Plus } from 'lucide-react'

// 3. Internal imports — UI components
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

// 4. Internal imports — shared components
import { EmptyState } from '@/components/shared/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'

// 5. Internal imports — feature components
import { CollectionSidebar } from '@/components/collections/CollectionSidebar'
import { CollectionView } from '@/components/collections/CollectionView'

// 6. Internal imports — hooks, utils
import { useCollections } from '@/hooks/useCollections'

import { cn } from '@/lib/utils'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CollectionsPage(): JSX.Element {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  

  const { collections, isLoading, createCollection } = useCollections()

  const handleSelect = useCallback((id: string): void => {
    setSelectedCollectionId(id)
    setMobileSheetOpen(false) // close mobile sheet after selection
  }, [])

  // ── Empty state: user has no collections yet ───────────────────────────
  if (!isLoading && collections.length === 0) {
    return (
      <PageContainer>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Collections</h1>
        </div>
        <EmptyState
          icon={FolderOpen}
          title="No collections yet"
          description="Create your first collection to start organizing your prompts."
          action={{
            label: 'Create Collection',
            onClick: async () => {
              const name = window.prompt('Collection name:')
              if (name?.trim()) {
                await createCollection(name.trim())
              }
            },
          }}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="p-0 md:p-0">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">

        {/* ── Desktop Sidebar (220px fixed left) ─────────────────────────── */}
        <aside
          className={cn(
            'hidden md:flex flex-col flex-shrink-0 w-[220px]',
            'border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]',
            'overflow-hidden'
          )}
        >
          <CollectionSidebar
            selectedCollectionId={selectedCollectionId}
            onSelect={handleSelect}
          />
        </aside>

        {/* ── Mobile: Sheet slide-in from left ────────────────────────────── */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] w-full">
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-[var(--border-default)] text-[var(--text-secondary)]"
              >
                <Layers className="h-4 w-4" />
                Collections
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className={cn(
                'w-[280px] p-0',
                'border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
              )}
            >
              <CollectionSidebar
                selectedCollectionId={selectedCollectionId}
                onSelect={handleSelect}
              />
            </SheetContent>
          </Sheet>

          {/* Selected collection name breadcrumb on mobile */}
          {selectedCollectionId && (
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {collections.find((c) => c.id === selectedCollectionId)?.name ?? ''}
            </span>
          )}
        </div>

        {/* ── Main content area ────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
          <AnimatePresence mode="wait">
            {selectedCollectionId ? (
              <motion.div
                key={selectedCollectionId}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="h-full"
              >
                <CollectionView collectionId={selectedCollectionId} />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex h-full items-center justify-center"
              >
                <EmptyState
                  icon={FolderOpen}
                  title="Select a collection to view"
                  description="Choose a collection from the sidebar to see its prompts."
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </PageContainer>
  )
}