'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
// (none beyond React)

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Internal imports — feature components (lazy-safe direct import)
import { ErrorFixPrompts } from '@/components/workspace/ErrorFixPrompts'

// 6. Internal imports — services, hooks, types, utils
import { useErrors } from '@/hooks/useErrors'
import { formatRelativeTime, formatDate, truncate, cn } from '@/lib/utils'
import type { ErrorSession } from '@/types'

// 7. Local types
interface ErrorSessionCardProps {
  session: ErrorSession
  projectId: string
  onResolve: (sessionId: string, note: string) => void
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  TYPESCRIPT: 'TypeScript',
  BUILD: 'Build',
  RUNTIME: 'Runtime',
  CONSOLE: 'Console',
  OTHER: 'Other',
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  TYPESCRIPT: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BUILD: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  RUNTIME: 'bg-red-500/10 text-red-400 border-red-500/20',
  CONSOLE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  OTHER: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

export function ErrorSessionCard({
  session,
  projectId,
  onResolve,
}: ErrorSessionCardProps): JSX.Element {
  // 8a. State hooks
  const [isExpanded, setIsExpanded] = useState(false)
  const [isResolving, setIsResolving] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')
  const [identifiedFilesInput, setIdentifiedFilesInput] = useState(
    session.identifiedFiles?.join('\n') ?? ''
  )
  const [isSavingFiles, setIsSavingFiles] = useState(false)

  // 8b. External hooks
  const { updateIdentifiedFiles } = useErrors(projectId)

  // 8c. Computed values
  const isPending = session.status === 'PENDING'
  const hasPrompts = Boolean(session.identifyPrompt && session.replacePrompt)

  // 8d. Event handlers
  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleResolveClick = useCallback(() => {
    setIsResolving(true)
  }, [])

  const handleResolveConfirm = useCallback(() => {
    onResolve(session.id, resolutionNote)
    setIsResolving(false)
  }, [session.id, resolutionNote, onResolve])

  const handleResolveCancel = useCallback(() => {
    setIsResolving(false)
    setResolutionNote('')
  }, [])

  const handleSaveIdentifiedFiles = useCallback(async () => {
    const files = identifiedFilesInput
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
    if (files.length === 0) return
    setIsSavingFiles(true)
    try {
      await updateIdentifiedFiles(session.id, files)
    } finally {
      setIsSavingFiles(false)
    }
  }, [identifiedFilesInput, session.id, updateIdentifiedFiles])

  return (
    <div
      className={cn(
        'rounded-xl border bg-[var(--bg-tertiary)] transition-colors duration-150',
        isPending
          ? 'border-l-4 border-l-[var(--status-error)] border-[var(--border-default)]'
          : 'border-l-4 border-l-[var(--status-complete)] border-[var(--border-default)]'
      )}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={handleToggleExpand}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggleExpand()
          }
        }}
      >
        {/* Error type badge */}
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0',
            ERROR_TYPE_COLORS[session.errorType] ?? ERROR_TYPE_COLORS.OTHER
          )}
        >
          {ERROR_TYPE_LABELS[session.errorType] ?? session.errorType}
        </span>

        {/* Timestamp */}
        <span
          className="text-xs text-[var(--text-tertiary)] shrink-0"
          title={formatDate(session.createdAt)}
        >
          {formatRelativeTime(session.createdAt)}
        </span>

        {/* Status badge */}
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0',
            isPending
              ? 'bg-[var(--status-error-bg)] text-[var(--status-error)] border-[var(--status-error)]/20'
              : 'bg-[var(--status-complete-bg)] text-[var(--status-complete)] border-[var(--status-complete)]/20'
          )}
        >
          <span
            className={cn(
              'mr-1.5 h-1.5 w-1.5 rounded-full',
              isPending ? 'bg-[var(--status-error)]' : 'bg-[var(--status-complete)]'
            )}
          />
          {isPending ? 'Pending' : 'Resolved'}
        </span>

        {/* Spacer */}
        <div className="flex-1 min-w-0">
          {!isExpanded && (
            <p className="text-xs text-[var(--text-tertiary)] font-mono truncate">
              {truncate(session.errorOutput, 100)}
            </p>
          )}
        </div>

        {/* Expand chevron */}
        <svg
          className={cn(
            'h-4 w-4 text-[var(--text-tertiary)] shrink-0 transition-transform duration-200',
            isExpanded && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* ── Expanded content ── */}
      {isExpanded && (
        <div className="border-t border-[var(--border-subtle)] px-4 pt-4 pb-4 space-y-4">
          {/* Full error output */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
              Error Output
            </p>
            <div className="relative rounded-lg bg-[#1a1a1a] border border-[var(--border-subtle)] overflow-hidden">
              {/* Copy button overlay */}
              <div className="absolute top-2 right-2 z-10">
                <CopyButton value={session.errorOutput} size="sm" />
              </div>
              <pre className="p-4 text-xs font-mono text-[var(--text-primary)] overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto pr-10">
                {session.errorOutput}
              </pre>
            </div>
          </div>

          {/* Fix prompts */}
          {hasPrompts && (
            <ErrorFixPrompts
              identifyPrompt={session.identifyPrompt!}
              replacePrompt={session.replacePrompt!}
            />
          )}

          {/* Identified files input */}
          {isPending && (
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
                Which files did Claude identify? (one per line)
              </label>
              <textarea
                className={cn(
                  'w-full rounded-md border bg-[var(--bg-input)] text-[var(--text-primary)]',
                  'text-xs font-mono placeholder:text-[var(--text-tertiary)]',
                  'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                  'focus:ring-1 focus:ring-[var(--accent-light)] outline-none',
                  'transition-colors duration-150 resize-none p-3',
                  'min-h-[80px]'
                )}
                value={identifiedFilesInput}
                onChange={(e) => setIdentifiedFilesInput(e.target.value)}
                placeholder="src/services/documentParser.ts&#10;src/hooks/useDocument.ts"
              />
              <div className="flex justify-end mt-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveIdentifiedFiles}
                  disabled={isSavingFiles || !identifiedFilesInput.trim()}
                  className="h-7 text-xs"
                >
                  {isSavingFiles ? 'Saving…' : 'Save Files'}
                </Button>
              </div>
            </div>
          )}

          {/* Resolved: show existing identified files + resolution note */}
          {!isPending && session.identifiedFiles && session.identifiedFiles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Files Identified
              </p>
              <div className="flex flex-wrap gap-1.5">
                {session.identifiedFiles.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-quaternary)] border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-mono text-[var(--text-secondary)]"
                  >
                    {f}
                    <CopyButton value={f} size="sm" />
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resolved note */}
          {!isPending && session.resolutionNote && (
            <div className="rounded-lg bg-[var(--status-complete-bg)] border border-[var(--status-complete)]/20 p-3">
              <p className="text-xs font-medium text-[var(--status-complete)] mb-1">
                Resolution Note
              </p>
              <p className="text-xs text-[var(--text-primary)]">{session.resolutionNote}</p>
              {session.resolvedAt && (
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  Resolved {formatRelativeTime(session.resolvedAt)}
                </p>
              )}
            </div>
          )}

          {/* Mark Resolved flow */}
          {isPending && !isResolving && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResolveClick}
              className="h-8 text-xs border-[var(--status-complete)]/30 text-[var(--status-complete)] hover:bg-[var(--status-complete-bg)]"
            >
              ✓ Mark as Resolved
            </Button>
          )}

          {isPending && isResolving && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)] block">
                Resolution note (optional)
              </label>
              <textarea
                className={cn(
                  'w-full rounded-md border bg-[var(--bg-input)] text-[var(--text-primary)]',
                  'text-sm placeholder:text-[var(--text-tertiary)]',
                  'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                  'focus:ring-1 focus:ring-[var(--accent-light)] outline-none',
                  'transition-colors duration-150 resize-none p-3 min-h-[72px]'
                )}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Describe what fixed the error…"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={handleResolveCancel} className="h-8 text-xs">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleResolveConfirm}
                  className="h-8 text-xs bg-[var(--status-complete)] hover:bg-[var(--status-complete)]/90 text-white"
                >
                  Confirm Resolved
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Quick-access copy buttons — always visible ── */}
      {hasPrompts && (
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border-subtle)]',
            'bg-[var(--bg-secondary)] rounded-b-xl'
          )}
        >
          <span className="text-xs text-[var(--text-tertiary)] shrink-0">Quick copy:</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-[var(--accent-primary)] text-white shrink-0"
              >
                1
              </span>
              <CopyButton
                value={session.identifyPrompt!}
                size="sm"
                label="File ID Prompt"
              />
            </div>
            <div className="w-px h-4 bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-[var(--accent-primary)] text-white shrink-0"
              >
                2
              </span>
              <CopyButton
                value={session.replacePrompt!}
                size="sm"
                label="Line Replace Prompt"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}