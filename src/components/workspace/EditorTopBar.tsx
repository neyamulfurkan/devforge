'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party imports
import { Lock, Unlock, CheckSquare, Braces, ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { StatusBadge } from '@/components/shared/StatusBadge'

// 5. Internal imports — hooks and utils
import { useEditorStore, getProjectLocalState } from '@/store/editorStore'
import { useFiles } from '@/hooks/useFiles'
import { formatRelativeTime, cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

// 6. Internal imports — types
import type { FileWithContent } from '@/types'
import { FilePromptPanel } from '@/components/workspace/FilePromptPanel'

// 7. Local types
interface OpenPromptButtonProps {
  file: FileWithContent
  projectId: string
}

function OpenPromptButton({ file, projectId }: OpenPromptButtonProps): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View file-specific prompt"
        className={cn(
          'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border transition-all duration-150',
          'border-[var(--border-default)] text-[var(--text-tertiary)]',
          'hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)]'
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span className="hidden sm:inline">Prompt</span>
      </button>
      <FilePromptPanel
        file={open ? file : null}
        projectId={projectId}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

interface EditorTopBarProps {
  file: FileWithContent | null
  onMarkComplete: () => void
  projectId: string
}

export function EditorTopBar({ file, onMarkComplete, projectId }: EditorTopBarProps): JSX.Element {
  const { isReadOnly, toggleReadOnly, fileContent } = useEditorStore()
  const { isLocalMode, openLocalPath } = getProjectLocalState(projectId)
  const [isMarkingComplete, setIsMarkingComplete] = useState(false)
  const [jsonPanelOpen, setJsonPanelOpen] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [jsonState, setJsonState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const { appendJsonSummary } = useFiles(projectId)
  const queryClient = useQueryClient()

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
    <div className="flex flex-col flex-shrink-0">
    <div
      className={cn(
        'flex h-11 items-center gap-3 border-b border-[var(--border-subtle)]',
        'bg-[var(--bg-secondary)] px-4'
      )}
    >
      {/* Left: File path breadcrumb */}
      <div className="flex min-w-0 flex-1 items-center gap-1 font-mono text-sm">
        {breadcrumbSegments.map((segment: string, index: number) => {
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
        

        {/* Open + Copy Prompt — DB mode only, when file has a prompt */}
        {!isLocalMode && file && file.filePrompt && (
          <OpenPromptButton file={file} projectId={projectId} />
        )}

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
              {file.status === 'COMPLETE' ? '✓ Complete' : 'Mark Complete'}
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

        {/* JSON Registry button — always shown when DB file is open */}
        {file && file.id && (
          <button
            type="button"
            onClick={() => setJsonPanelOpen((v) => !v)}
            title="Append JSON registry entry to Section 11"
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-all duration-150',
              file.jsonSummary
                ? 'bg-[var(--status-complete-bg)] text-[var(--status-complete)] border border-[var(--status-complete)]/30'
                : jsonPanelOpen
                ? 'bg-[var(--accent-light)] text-[var(--accent-primary)] border border-[var(--accent-border)]'
                : 'border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)]'
            )}
          >
            <Braces className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {file.jsonSummary ? '✓ JSON' : 'JSON'}
            </span>
            {jsonPanelOpen
              ? <ChevronUp className="h-3 w-3" />
              : <ChevronDown className="h-3 w-3" />
            }
          </button>
        )}

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

    {/* ── JSON Registry Panel — always available when file has DB id ──── */}
    {jsonPanelOpen && file && file.id && (
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 space-y-2">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              JSON Registry — {file.filePath}
            </span>
            {file.jsonSummary && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--status-complete-bg)] text-[var(--status-complete)]">
                ✓ Stored in Section 11
              </span>
            )}
          </div>

          {/* Already stored — show readonly */}
          {file.jsonSummary ? (
            <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-md p-3 max-h-36 overflow-y-auto whitespace-pre-wrap break-words">
              {JSON.stringify(file.jsonSummary, null, 2)}
            </pre>
          ) : (
            /* Not stored yet — show paste input */
            <div className="space-y-2">
              <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                After Claude generates this file, paste the JSON registry object it outputs below. It will be appended to{' '}
                <span className="font-mono text-[var(--text-secondary)]">Section 11</span> of your GCD.
              </p>
              <textarea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value)
                  if (jsonState !== 'idle') { setJsonState('idle'); setJsonError(null) }
                }}
                placeholder={`{\n  "file": "${file.filePath}",\n  "fileNumber": "${file.fileNumber}",\n  "exports": [...],\n  ...\n}`}
                rows={4}
                className="w-full resize-y rounded-md px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-default)] text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
              {jsonState === 'error' && jsonError && (
                <p className="text-[11px] text-[var(--status-error)]">{jsonError}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!jsonInput.trim() || jsonState === 'submitting'}
                  onClick={async () => {
                    const trimmed = jsonInput.trim()
                    if (!trimmed) return
                    setJsonState('submitting')
                    setJsonError(null)
                    try {
                      const parsed = JSON.parse(trimmed)
                      await appendJsonSummary(file.id, parsed)
                      // Auto-mark file as complete when JSON is appended
                      await onMarkComplete()
                      await queryClient.refetchQueries({ queryKey: ['document', projectId] })
                      await queryClient.refetchQueries({ queryKey: ['files', projectId] })
                      setJsonState('done')
                      setJsonInput('')
                      setTimeout(() => {
                        setJsonState('idle')
                        setJsonPanelOpen(false)
                      }, 1500)
                    } catch (err) {
                      setJsonState('error')
                      setJsonError(
                        err instanceof SyntaxError
                          ? 'Invalid JSON — check for syntax errors'
                          : err instanceof Error ? err.message : 'Failed to append'
                      )
                    }
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border transition-all duration-150',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    jsonState === 'done'
                      ? 'border-[var(--status-complete)]/40 bg-[var(--status-complete-bg)] text-[var(--status-complete)]'
                      : 'border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white'
                  )}
                >
                  {jsonState === 'submitting' ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Appending…</>
                  ) : jsonState === 'done' ? (
                    <><Check className="h-3 w-3" /> Appended ✓</>
                  ) : (
                    <><Braces className="h-3 w-3" /> Append to Section 11</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setJsonPanelOpen(false); setJsonInput(''); setJsonState('idle'); setJsonError(null) }}
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
</div>
      )}
    </div>
  )
}