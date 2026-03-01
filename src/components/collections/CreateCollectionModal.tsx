'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Collection } from '@/types'

interface CreateCollectionModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description?: string) => Promise<Collection>
}

export function CreateCollectionModal({ open, onClose, onCreate }: CreateCollectionModalProps): JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async (): Promise<void> => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setIsCreating(true)
    try {
      await onCreate(trimmedName, description.trim() || undefined)
      toast.success('Collection created!')
      setName('')
      setDescription('')
      onClose()
    } catch {
      toast.error('Failed to create collection')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = (): void => {
    setName('')
    setDescription('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-sm bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base font-semibold">
            New Collection
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="col-name" className="text-sm text-[var(--text-secondary)]">
              Name <span className="text-[var(--status-error)]">*</span>
            </Label>
            <Input
              id="col-name"
              placeholder="e.g. Coding Prompts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              className={cn(
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]'
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="col-desc" className="text-sm text-[var(--text-secondary)]">
              Description <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
            </Label>
            <Input
              id="col-desc"
              placeholder="What is this collection for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]'
              )}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isCreating}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">
            {isCreating ? <><InlineSpinner className="mr-2" />Creating…</> : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateCollectionModal