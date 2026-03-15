'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party imports
import { Lock, Unlock, CheckSquare, FileCode } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { StatusBadge } from '@/components/shared/StatusBadge'

// 5. Internal imports — hooks and utils
import { useEditorStore } from '@/store/editorStore'
import { formatRelativeTime, cn } from '@/lib/utils'

// 6. Internal imports — types
import type { FileWithContent } from '@/types'

// 7. Local types
interface EditorTopBarProps {
  file: FileWithContent | null
  onMarkComplete: () => void
}

export function EditorTopBar({ file, onMarkComplete }: EditorTopBarProps): JSX.Element {
  const { isReadOnly, toggleReadOnly, fileContent, isLocalMode, openLocalPath } = useEditorStore()
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)

  const handleMarkComplete = useCallback(async () => {
    if (isMarkingComplete) return
    setIsMarkingComplete(true)
    try {
      await onMarkComplete()
    } finally {
      setIsMarkingComplete(false)
    }
  }, [onMarkComplete, isMarkingComplete])

  // In local mode, use the open local path for the breadcrumb
  const displayPath = isLocalMode ? (openLocalPath ?? '') : (file?.filePath ?? '')
  const breadcrumbSegments = displayPath ? displayPath.split('/') : []

  if (!file && !isLocalMode) {
    return (
      <div
        className={cn(
          'flex h-11 items-center border-b border-[var(--border-subtle)]',
          'bg-[var(--bg-secondary)] px-4'
        )}
      >
        <span className="text-sm text-[var(--text-tertiary)]">No file open</span>
      </div>
    )
  }

  if (!openLocalPath && isLocalMode) {
    return (
      <div
        className={cn(
          'flex h-11 items-center border-b border-[var(--border-subtle)]',
          'bg-[var(--bg-secondary)] px-4'
        )}
      >
        <span className="text-sm text-[var(--text-tertiary)]">Select a file from the folder</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-11 items-center gap-3 border-b border-[var(--border-subtle)]',
        'bg-[var(--bg-secondary)] px-4'
      )}
    >
      {/* Left: File path breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-1 font-mono text-sm">
        {breadcrumbSegments.map((segment, index) => {
          const isLast = index === breadcrumbSegments.length - 1
          return (
            <span key={index} className="flex items-center gap-1 min-w-0">
              {index > 0 && (
                <span className="text-[var(--text-tertiary)] flex-shrink-0">/</span>
              )}
              <span
                className={cn(
                  'truncate',
                  isLast
                    ? 'text-[var(--text-primary)] font-medium'
                    : 'text-[var(--text-tertiary)]'
                )}
              >
                {segment}
              </span>
            </span>
          )
        })}
      </div>

      {/* Center: Status badge — DB mode only */}
      {!isLocalMode && file && (
        <div className="flex-shrink-0">
          <StatusBadge status={file.status} />
        </div>
      )}

      {/* Center: LOCAL badge — local mode only */}
      {isLocalMode && (
        <div className="flex-shrink-0">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent-primary)]">
            LOCAL
          </span>
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {/* Copy all file content — always shown */}
        <CopyButton
          value={fileContent}
          size="sm"
          label="Copy All"
          aria-label="Copy file content"
        />

        {/* Mark complete — DB mode only */}
        {!isLocalMode && file && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkComplete}
            disabled={isMarkingComplete || file.status === 'COMPLETE'}
            className={cn(
              'h-7 gap-1.5 px-2 text-xs',
              file.status === 'COMPLETE'
                ? 'text-[var(--status-complete)] cursor-default'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            aria-label="Mark file as complete"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {file.status === 'COMPLETE' ? 'Complete' : 'Mark Complete'}
            </span>
          </Button>
        )}

        {/* Read-only toggle — always shown */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleReadOnly}
          className={cn(
            'h-7 w-7 p-0',
            isReadOnly
              ? 'text-[var(--accent-primary)]'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          )}
          aria-label={isReadOnly ? 'Disable read-only mode' : 'Enable read-only mode'}
          title={isReadOnly ? 'Read-only — click to edit' : 'Click to lock file'}
        >
          {isReadOnly ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <Unlock className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Divider */}
        <div className="h-4 w-px bg-[var(--border-subtle)]" aria-hidden="true" />

        {/* Line count + last modified — DB mode only */}
        {!isLocalMode && file && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            {file.lineCount != null && (
              <Badge
                className={cn(
                  'rounded px-1.5 py-0 text-[11px] font-mono',
                  'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] border-none'
                )}
              >
                {file.lineCount.toLocaleString()}L
              </Badge>
            )}
            {file.updatedAt && (
              <span className="hidden md:inline">
                {formatRelativeTime(file.updatedAt)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}