'use client'

import { useState } from 'react'
import { useCollections } from '@/hooks/useCollections'
import { useLibrary } from '@/hooks/useLibrary'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FolderOpen } from 'lucide-react'

interface SaveToCollectionModalProps {
  open: boolean
  promptId: string | null
  onClose: () => void
}

export function SaveToCollectionModal({ open, promptId, onClose }: SaveToCollectionModalProps): JSX.Element {
  const { collections, isLoading } = useCollections()
  const { saveToCollection } = useLibrary()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (): Promise<void> => {
    if (!promptId || !selectedId) return
    setIsSaving(true)
    try {
      await saveToCollection(promptId, selectedId)
      toast.success('Saved to collection!')
      setSelectedId(null)
      onClose()
    } catch {
      toast.error('Failed to save to collection')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClose = (): void => {
    setSelectedId(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base font-semibold">
            Save to Collection
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1">
          {isLoading ? (
            <div className="flex justify-center py-6"><InlineSpinner /></div>
          ) : collections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FolderOpen className="h-8 w-8 text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)]">No collections yet.</p>
              <p className="text-xs text-[var(--text-tertiary)]">Create one in My Collections first.</p>
            </div>
          ) : (
            collections.map((col) => (
              <button
                key={col.id}
                type="button"
                onClick={() => setSelectedId(col.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors duration-150',
                  selectedId === col.id
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
                )}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-medium">{col.name}</span>
                {col._count && (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {col._count.prompts} prompt{col._count.prompts !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSaving}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}
            disabled={!selectedId || isSaving || collections.length === 0}
            className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">
            {isSaving ? <><InlineSpinner className="mr-2" />Saving…</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SaveToCollectionModal