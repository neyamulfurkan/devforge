'use client'

// 1. React imports
import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// 2. Third-party library imports
import { X, ClipboardCopy, Braces, Loader2, Check } from 'lucide-react'

// 3. Internal imports — UI components
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CodeBlock } from '@/components/shared/CodeBlock'

// 5. Internal imports — workspace components
// 6. Internal imports — hooks, types, utils
import { useFiles } from '@/hooks/useFiles'
import { useDocument } from '@/hooks/useDocument'
import { copyToClipboard } from '@/lib/utils'
import type { FileWithContent, FileStatus } from '@/types'
import { cn } from '@/lib/utils'

// Local types
interface FileDetailPanelProps {
  file: FileWithContent
  projectId: string
  onClose: () => void
}

const STATUS_OPTIONS: { label: string; value: FileStatus }[] = [
  { label: 'Empty', value: 'EMPTY' },
  { label: 'Code Pasted', value: 'CODE_PASTED' },
  { label: 'Complete', value: 'COMPLETE' },
  { label: 'Error', value: 'ERROR' },
]

const STATUS_CHIP_STYLES: Record<FileStatus, string> = {
  EMPTY: 'bg-[var(--status-empty-bg)] text-[var(--status-empty)] border-[var(--status-empty)]/30',
  CODE_PASTED:
    'bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)] border-[var(--status-in-progress)]/30',
  COMPLETE:
    'bg-[var(--status-complete-bg)] text-[var(--status-complete)] border-[var(--status-complete)]/30',
  ERROR: 'bg-[var(--status-error-bg)] text-[var(--status-error)] border-[var(--status-error)]/30',
}

export function FileDetailPanel({
  file,
  projectId,
  onClose,
}: FileDetailPanelProps): JSX.Element {
  const { updateFileStatus, appendJsonSummary } = useFiles(projectId)
  const { document: projectDocument } = useDocument(projectId)
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState(file.notes ?? '')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [jsonInlineInput, setJsonInlineInput] = useState('')
  const [jsonSaveState, setJsonSaveState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [jsonSaveError, setJsonSaveError] = useState<string | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleStatusChange = useCallback(
    async (status: FileStatus): Promise<void> => {
      if (isUpdatingStatus || status === file.status) return
      setIsUpdatingStatus(true)
      try {
        await updateFileStatus(file.id, status)
      } finally {
        setIsUpdatingStatus(false)
      }
    },
    [file.id, file.status, updateFileStatus, isUpdatingStatus]
  )

  const handleNoteBlur = useCallback(async (): Promise<void> => {
    if (notes === (file.notes ?? '')) return
    await updateFileStatus(file.id, file.status, { notes })
  }, [file.id, file.status, file.notes, notes, updateFileStatus])

  const handleCopyGcdWithPrompt = useCallback(async (): Promise<void> => {
    const gcd = projectDocument?.rawContent ?? ''
    const prompt = file.filePrompt ?? ''
    if (!gcd && !prompt) return

    const sep = '═'.repeat(60)

    const combined = [
      gcd,
      '',
      sep,
      `TASK: GENERATE FILE ${file.fileNumber} — ${file.filePath}`,
      sep,
      '',
      'FILE-SPECIFIC PROMPT (read STEP 1 first — it governs whether you may write code):',
      '',
      '',
      prompt,
      '',
      sep,
      'OUTPUT FORMAT — YOU MUST FOLLOW THIS EXACTLY:',
      sep,
      '',
      '1. Output the COMPLETE file implementation — every function, every handler, every import fully written. No placeholders, no "// TODO", no truncation.',
      '',
      '2. Immediately after the code block output this JSON registry entry (no commentary between them):',
      '',
      '```json',
      '{',
      `  "file": "${file.filePath}",`,
      `  "fileNumber": "${file.fileNumber}",`,
      '  "exports": [],',
      '  "imports": [],',
      '  "keyLogic": "brief description of what this file does",',
      '  "sideEffects": [],',
      '  "dependents": [],',
      '  "status": "complete",',
      `  "generatedAt": "${new Date().toISOString()}"`,
      '}',
      '```',
      '',
      'Do NOT add any commentary after the JSON block. The JSON is the last thing in your response.',
    ].join('\n')

    await copyToClipboard(combined)
  }, [projectDocument?.rawContent, file.filePrompt, file.filePath, file.fileNumber, file.requiredFiles])

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className={cn(
            'w-[380px] max-w-full flex flex-col gap-0 p-0',
            'bg-[var(--bg-secondary)] border-l border-[var(--border-default)]'
          )}
        >
          {/* Header */}
          <SheetHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
            <SheetTitle className="text-sm font-semibold text-[var(--text-primary)]">
              File Details
            </SheetTitle>
            
          </SheetHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* File Path */}
            <section>
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
                File Path
              </p>
              <div className="flex items-center gap-2 bg-[var(--bg-input)] rounded-md px-3 py-2 border border-[var(--border-subtle)]">
                <span className="font-mono text-xs text-[var(--text-primary)] flex-1 break-all">
                  {file.filePath}
                </span>
                <CopyButton value={file.filePath} size="sm" />
              </div>
            </section>

            {/* File Number */}
            <section>
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
                File Number
              </p>
              <span className="font-mono text-sm text-[var(--text-secondary)] bg-[var(--bg-quaternary)] px-2 py-0.5 rounded">
                {file.fileNumber}
              </span>
            </section>

            {/* Status */}
            <section>
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                Status
              </p>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={file.status} />
              </div>
              {/* Status change chips */}
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleStatusChange(value)}
                    disabled={isUpdatingStatus}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border font-medium transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                      'disabled:opacity-50',
                      file.status === value
                        ? STATUS_CHIP_STYLES[value]
                        : 'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)]'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* File Prompt */}
            <section>
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
                File Prompt
              </p>
              {file.filePrompt ? (
                <div className="relative">
                  <Textarea
                    readOnly
                    value={file.filePrompt}
                    className={cn(
                      'min-h-[150px] resize-none font-mono text-xs pr-10',
                      'bg-[var(--bg-input)] border-[var(--border-subtle)]',
                      'text-[var(--text-secondary)] cursor-default'
                    )}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyGcdWithPrompt}
                      title="Copy full GCD + this file's prompt"
                      aria-label="Copy GCD with file prompt"
                      className="h-6 w-6 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-light)]"
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                    </Button>
                    <CopyButton value={file.filePrompt} size="sm" />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)] italic">
                  No prompt stored yet. Use the Prompts tab to parse and store file prompts.
                </p>
              )}
            </section>

            {/* Required Dependencies */}
            {file.requiredFiles.length > 0 && (
              <section>
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                  Required Dependencies
                </p>
                <ul className="space-y-1">
                  {file.requiredFiles.map((dep) => (
                    <li
                      key={dep}
                      className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-quaternary)] px-2 py-1 rounded"
                    >
                      {dep}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* JSON Summary — inline, auto-saves on valid JSON paste */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Braces className="h-3 w-3" />
                  JSON Registry
                </p>
                {file.jsonSummary && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--status-complete-bg)] text-[var(--status-complete)]">
                    ✓ In Section 11
                  </span>
                )}
              </div>
              {file.jsonSummary ? (
                <CodeBlock
                  code={JSON.stringify(file.jsonSummary, null, 2)}
                  language="json"
                  showCopy
                  className="text-xs"
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                    Paste the JSON Claude outputs after the file code — it auto-saves to Section 11.
                  </p>
                  <textarea
                    value={jsonInlineInput}
                    onChange={(e) => {
                      const val = e.target.value
                      setJsonInlineInput(val)
                      if (jsonSaveState !== 'idle' && jsonSaveState !== 'submitting') { setJsonSaveState('idle'); setJsonSaveError(null) }
                      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
                      if (val.trim().endsWith('}')) {
                        autoSaveTimerRef.current = setTimeout(async () => {
                          try {
                            const parsed = JSON.parse(val.trim()) as Record<string, unknown>
                            if (typeof parsed['file'] === 'string' && typeof parsed['fileNumber'] === 'string') {
                              setJsonSaveState('submitting')
                              setJsonSaveError(null)
                              await appendJsonSummary(file.id, parsed)
                              await queryClient.refetchQueries({ queryKey: ['files', projectId] })
                              await queryClient.refetchQueries({ queryKey: ['document', projectId] })
                              setJsonSaveState('done')
                              setJsonInlineInput('')
                            }
                          } catch { /* incomplete JSON — keep waiting */ }
                        }, 700)
                      }
                    }}
                    placeholder={`{
  "file": "${file.filePath}",
  "fileNumber": "${file.fileNumber}",
  ...
}`}
                    rows={5}
                    className={cn(
                      'w-full resize-y rounded-md border px-3 py-2 font-mono text-xs',
                      'bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                      'outline-none transition-colors duration-150',
                      jsonSaveState === 'done'
                        ? 'border-[var(--status-complete)]'
                        : jsonSaveState === 'error'
                        ? 'border-[var(--status-error)]'
                        : 'border-[var(--border-default)] focus:border-[var(--accent-primary)]'
                    )}
                  />
                  <div className="flex items-center gap-2 min-h-[20px]">
                    {jsonSaveState === 'submitting' && (
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--accent-primary)]">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving to Section 11…
                      </span>
                    )}
                    {jsonSaveState === 'done' && (
                      <span className="flex items-center gap-1.5 text-[11px] text-[var(--status-complete)]">
                        <Check className="h-3 w-3" /> Saved to Section 11 ✓
                      </span>
                    )}
                    {jsonSaveState === 'error' && jsonSaveError && (
                      <span className="text-[11px] text-[var(--status-error)]">{jsonSaveError}</span>
                    )}
                    {jsonSaveState === 'idle' && jsonInlineInput.trim() && (
                      <span className="text-[11px] text-[var(--text-tertiary)]">Paste complete JSON to auto-save…</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Notes */}
            <section>
              <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">
                Notes
              </p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder="Add private notes about this file…"
                className={cn(
                  'min-h-[80px] resize-none text-sm',
                  'bg-[var(--bg-input)] border-[var(--border-subtle)]',
                  'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                  'focus:border-[var(--accent-primary)]'
                )}
              />
            </section>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-4 py-3 border-t border-[var(--border-subtle)]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Close
            </Button>
          </div>
        </SheetContent>
      </Sheet>


    </>
  )
}