'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { X, ClipboardCopy } from 'lucide-react'

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
import { JsonAppendModal } from '@/components/workspace/JsonAppendModal'

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
  const { updateFileStatus } = useFiles(projectId)
  const { document: projectDocument } = useDocument(projectId)
  const [notes, setNotes] = useState(file.notes ?? '')
  const [jsonModalOpen, setJsonModalOpen] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

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

            {/* JSON Summary */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  JSON Summary
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setJsonModalOpen(true)}
                  className="h-6 text-xs text-[var(--accent-primary)] hover:text-[var(--accent-hover)] px-2"
                >
                  {file.jsonSummary ? 'Update' : 'Append JSON'}
                </Button>
              </div>
              {file.jsonSummary ? (
                <CodeBlock
                  code={JSON.stringify(file.jsonSummary, null, 2)}
                  language="json"
                  showCopy
                  className="text-xs"
                />
              ) : (
                <p className="text-xs text-[var(--text-tertiary)] italic">
                  No JSON appended yet.
                </p>
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

      {/* JSON append modal */}
      {jsonModalOpen && (
        <JsonAppendModal
          open={jsonModalOpen}
          onClose={() => setJsonModalOpen(false)}
          projectId={projectId}
          prefilledFilePath={file.filePath}
        />
      )}
    </>
  )
}