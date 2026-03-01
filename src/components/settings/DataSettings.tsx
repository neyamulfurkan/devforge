'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import { Download, Trash2, AlertTriangle, HardDrive } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

// 4. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'

// 5. Internal imports — hooks, utils
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

// 6. Local helper — estimate storage usage from settings data
function estimateStorageUsage(settings: Record<string, unknown> | null | undefined): string {
  if (!settings) return '—'
  const jsonSize = new TextEncoder().encode(JSON.stringify(settings)).length
  // Rough heuristic: multiply by 50 to approximate total DB row sizes
  const estimatedBytes = jsonSize * 50
  if (estimatedBytes >= 1_000_000) return `~${(estimatedBytes / 1_000_000).toFixed(1)} MB`
  if (estimatedBytes >= 1_000) return `~${Math.round(estimatedBytes / 1_000)} KB`
  return `~${estimatedBytes} B`
}

// 7. Component definition
export function DataSettings(): JSX.Element {
  // 8a. State hooks
  const [isExporting, setIsExporting] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 8b. External hooks
  const { settings } = useSettings()
  const { deleteAccount } = useAuth()

  // 8c. Derived state
  const canDelete = deleteInput === 'DELETE'
  const storageEstimate = estimateStorageUsage(settings as Record<string, unknown> | null | undefined)

  // 8d. Event handlers
  const handleExport = useCallback(async (): Promise<void> => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/settings?action=export')
      if (!response.ok) {
        throw new Error('Export failed')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const today = new Date().toISOString().split('T')[0]
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `devforge-export-${today}.json`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed'
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const handleDeleteConfirm = useCallback(async (): Promise<void> => {
    setIsDeleting(true)
    try {
      await deleteAccount()
      // deleteAccount handles signOut and redirect to /
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account'
      toast.error(message)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }, [deleteAccount])

  // 8f. JSX return
  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* Export All Data */}
      <Card
        className={cn(
          'p-6 border-[var(--border-subtle)] bg-[var(--bg-tertiary)]'
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-light)] border border-[var(--accent-border)]">
            <Download className="h-5 w-5 text-[var(--accent-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Export All Data
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
              Download a complete JSON export of all your projects, collections, prompt templates,
              and settings. This file can be used as a backup or to migrate your data.
            </p>
            <Button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className={cn(
                'mt-4 gap-2 bg-[var(--accent-primary)] text-white',
                'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
              )}
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <InlineSpinner />
                  Exporting…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </span>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Storage Usage */}
      <Card
        className={cn(
          'p-6 border-[var(--border-subtle)] bg-[var(--bg-tertiary)]'
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-quaternary)]">
            <HardDrive className="h-5 w-5 text-[var(--text-secondary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Storage Usage
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
              Estimated storage used by your account data including projects, documents, and code.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-2xl font-bold text-[var(--text-primary)]">
                {storageEstimate}
              </span>
              <span className="text-sm text-[var(--text-tertiary)]">estimated</span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              Actual usage may vary. Large projects with many files will use more storage.
            </p>
          </div>
        </div>
      </Card>

      {/* Delete Account */}
      <Card
        className={cn(
          'p-6 border-2 border-[var(--status-error)]/30 bg-[var(--status-error-bg)]'
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/30">
            <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--status-error)]">
              Delete Account
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">
              Permanently delete your account and all associated data including projects, documents,
              collections, and settings. This action{' '}
              <strong className="text-[var(--text-primary)]">cannot be undone</strong>.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="delete-confirm-input"
                  className="text-sm text-[var(--text-secondary)]"
                >
                  Type{' '}
                  <code className="font-mono font-bold text-[var(--status-error)] bg-[var(--status-error)]/10 px-1.5 py-0.5 rounded">
                    DELETE
                  </code>{' '}
                  to confirm
                </Label>
                <Input
                  id="delete-confirm-input"
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE here"
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(
                    'max-w-xs bg-[var(--bg-input)] text-[var(--text-primary)]',
                    'placeholder:text-[var(--text-tertiary)]',
                    'border-[var(--border-default)]',
                    'focus-visible:ring-[var(--status-error)]',
                    'focus-visible:border-[var(--status-error)]',
                    canDelete && 'border-[var(--status-error)] ring-1 ring-[var(--status-error)]/30'
                  )}
                />
              </div>

              <Button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!canDelete || isDeleting}
                className={cn(
                  'self-start gap-2 bg-[var(--status-error)] text-white',
                  'hover:opacity-90 active:scale-95 transition-all duration-150',
                  'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100'
                )}
              >
                {isDeleting ? (
                  <span className="flex items-center gap-2">
                    <InlineSpinner />
                    Deleting…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete My Account
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={showDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Account Permanently?"
        description="All your projects, documents, collections, prompts, and settings will be permanently deleted. This cannot be undone. Are you absolutely sure?"
        confirmLabel="Yes, Delete My Account"
        confirmVariant="destructive"
      />
    </div>
  )
}

export default DataSettings