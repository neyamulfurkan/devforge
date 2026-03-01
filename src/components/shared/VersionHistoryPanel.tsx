'use client'

// 1. React imports
import { useState } from 'react'

// 3. Third-party library imports
import { Clock, Eye, RotateCcw, X } from 'lucide-react'

// 4. Internal imports — UI components
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

// 5. Internal imports — shared components
import { ConfirmModal } from '@/components/shared/ConfirmModal'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// 6. Internal imports — hooks, utils, types
import { useDocument } from '@/hooks/useDocument'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import type { VersionSummary } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VersionHistoryPanelProps {
  projectId: string
  open: boolean
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function humanizeTriggerEvent(event: string): string {
  if (event === 'manual_edit') return 'Manual edit'
  if (event === 'feature_added') return 'Feature added'
  if (event === 'document_imported') return 'Document imported'
  if (event === 'version_restored') return 'Version restored'

  // json_appended_FILE_XXX → 'JSON appended (FILE XXX)'
  const jsonMatch = event.match(/^json_appended_FILE_(.+)$/)
  if (jsonMatch) return `JSON appended (FILE ${jsonMatch[1]})`

  // Fallback: convert snake_case to sentence case
  return event
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Sub-component: VersionRow ────────────────────────────────────────────────

interface VersionRowProps {
  version: VersionSummary
  onView: (version: VersionSummary) => void
  onRestore: (versionNumber: number) => void
  isLatest: boolean
}

function VersionRow({ version, onView, onRestore, isLatest }: VersionRowProps): JSX.Element {
  return (
    <div className="group flex flex-col gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3 transition-colors hover:border-[var(--border-default)]">
      {/* Top row: version number + label */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[var(--text-tertiary)]">
            v{version.versionNumber}
          </span>
          {isLatest && (
            <span className="rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-primary)]">
              Current
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onView(version)}
            className="h-7 gap-1.5 px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
          {!isLatest && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRestore(version.versionNumber)}
              className="h-7 gap-1.5 px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore
            </Button>
          )}
        </div>
      </div>

      {/* Trigger event label */}
      <p className="text-sm text-[var(--text-secondary)]">
        {humanizeTriggerEvent(version.triggerEvent)}
      </p>

      {/* Change summary */}
      {version.changeSummary && (
        <p className="text-xs text-[var(--text-tertiary)]">{version.changeSummary}</p>
      )}

      {/* Timestamps */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <Clock className="h-3 w-3" />
        <span title={formatDate(version.createdAt)}>
          {formatRelativeTime(version.createdAt)}
        </span>
        <span className="text-[var(--border-default)]">·</span>
        <span>{formatDate(version.createdAt)}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VersionHistoryPanel({
  projectId,
  open,
  onClose,
}: VersionHistoryPanelProps): JSX.Element {
  const { versions, isVersionsLoading, restoreVersion } = useDocument(projectId)

  const [viewingVersion, setViewingVersion] = useState<VersionSummary | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<number | null>(null)
  const [viewContent, setViewContent] = useState<string>('')
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  // Fetch full raw content for a version when "View" is clicked
  const handleView = async (version: VersionSummary): Promise<void> => {
    setIsLoadingContent(true)
    setViewingVersion(version)
    try {
      const res = await fetch(
        `/api/projects/${projectId}/document/versions?versionNumber=${version.versionNumber}`
      )
      if (res.ok) {
        const json = await res.json()
        setViewContent((json.data as { rawContent?: string })?.rawContent ?? '')
      }
    } finally {
      setIsLoadingContent(false)
    }
  }

  const handleRestoreConfirm = async (): Promise<void> => {
    if (restoreTarget === null) return
    await restoreVersion(restoreTarget)
    setRestoreTarget(null)
    onClose()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent
          side="right"
          className="flex w-[400px] flex-col gap-0 border-l border-[var(--border-default)] bg-[var(--bg-secondary)] p-0 sm:max-w-[400px]"
        >
          {/* Header */}
          <SheetHeader className="flex flex-row items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <SheetTitle className="text-sm font-semibold text-[var(--text-primary)]">
              Version History
            </SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Close version history"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1 px-4 py-4">
            {isVersionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size={24} />
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Clock className="h-8 w-8 text-[var(--text-tertiary)]" />
                <p className="text-sm text-[var(--text-secondary)]">No versions yet</p>
                <p className="max-w-[240px] text-xs text-[var(--text-tertiary)]">
                  Versions are saved when you edit and save a section, append JSON, or add features.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {versions.map((version, index) => (
                  <VersionRow
                    key={version.id}
                    version={version}
                    isLatest={index === 0}
                    onView={handleView}
                    onRestore={(vn) => setRestoreTarget(vn)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* View version dialog */}
      <Dialog
        open={viewingVersion !== null}
        onOpenChange={(o) => { if (!o) { setViewingVersion(null); setViewContent('') } }}
      >
        <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-[var(--shadow-lg)]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-sm font-semibold">
              {viewingVersion
                ? `Version ${viewingVersion.versionNumber} — ${humanizeTriggerEvent(viewingVersion.triggerEvent)}`
                : 'Version'}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1">
            {isLoadingContent ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size={24} />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--text-secondary)]">
                {viewContent || 'No content available.'}
              </pre>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Restore confirm modal */}
      <ConfirmModal
        open={restoreTarget !== null}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setRestoreTarget(null)}
        title="Restore this version?"
        description={`This will restore version ${restoreTarget} as the current document. A new version snapshot will be created before restoring, so you won't lose the current state.`}
        confirmLabel="Restore"
        confirmVariant="default"
      />
    </>
  )
}