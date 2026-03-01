'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Internal imports — UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// 3. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 4. Internal imports — utils
import { cn } from '@/lib/utils'

// Local types
interface ConfirmModalProps {
  open: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  title: string
  description: string
  confirmLabel?: string
  confirmVariant?: 'default' | 'destructive'
}

export function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
}: ConfirmModalProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      await onConfirm()
    } finally {
      setIsLoading(false)
    }
  }, [onConfirm])

  const handleCancel = useCallback((): void => {
    if (isLoading) return
    onCancel()
  }, [isLoading, onCancel])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel() }}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-[var(--shadow-lg)]">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-[var(--text-primary)]">
            {title}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>

        <DialogFooter className="mt-2 flex gap-2 sm:flex-row sm:justify-end">
          {/* Cancel */}
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </Button>

          {/* Confirm */}
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={cn(
              'min-w-[90px] font-medium transition-all duration-150',
              confirmVariant === 'destructive'
                ? 'bg-[var(--status-error)] text-white hover:opacity-90 active:scale-95'
                : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <InlineSpinner />
                <span>{confirmLabel}</span>
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}