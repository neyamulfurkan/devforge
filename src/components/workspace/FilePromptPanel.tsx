'use client'

// 1. React imports
import { useState, useCallback, useEffect, useRef } from 'react'

// 2. Third-party library imports
import { X, Hash, FileText, Copy, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { EmptyState } from '@/components/shared/EmptyState'

// 5. Internal imports — types and utils
import { useDocument } from '@/hooks/useDocument'
import type { FileWithContent } from '@/types'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilePromptPanelProps {
  file: FileWithContent | null
  projectId: string
  onClose: () => void
}

// ─── GCD + Prompt Button ──────────────────────────────────────────────────────

function GcdPlusPromptButton({
  gcdContent,
  filePrompt,
  filePath,
  fileNumber,
  requiredFiles,
}: {
  gcdContent: string
  filePrompt: string
  filePath: string
  fileNumber: string
  requiredFiles: string[]
}): JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(() => {
    const sep = '═'.repeat(60)
    const combined = [
      gcdContent,
      '',
      sep,
      `TASK: GENERATE FILE ${fileNumber} — ${filePath}`,
      sep,
      '',
      'FILE-SPECIFIC PROMPT (read STEP 1 first — it governs whether you may write code):',
      '',
      '',
      filePrompt,
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
      `  "file": "${filePath}",`,
      `  "fileNumber": "${fileNumber}",`,
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

    navigator.clipboard.writeText(combined).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => undefined)
  }, [gcdContent, filePrompt, filePath, fileNumber, requiredFiles])

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Copy GCD + this file's prompt with dependency check instructions"
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border transition-all duration-150',
        copied
          ? 'border-[var(--status-complete)]/40 bg-[var(--status-complete-bg)] text-[var(--status-complete)]'
          : 'border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)]'
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : 'GCD+'}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilePromptPanel({
  file,
  projectId,
  onClose,
}: FilePromptPanelProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const { document: docData } = useDocument(projectId)

  // ── Trap focus + close on Escape ────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus the panel when it opens
  useEffect(() => {
    if (file) {
      panelRef.current?.focus()
    }
  }, [file])

  const hasPrompt = Boolean(file?.filePrompt?.trim())
  const hasRequiredFiles = Boolean(file?.requiredFiles?.length)

  return (
    <AnimatePresence>
      {file && (
        <>
          {/* Backdrop — mobile only */}
          <motion.div
            key="file-prompt-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="file-prompt-panel"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={`Prompt for ${file.fileName}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={cn(
              'fixed right-0 top-0 z-50 h-full w-full max-w-[400px]',
              'flex flex-col bg-[var(--bg-secondary)] border-l border-[var(--border-default)]',
              'shadow-[var(--shadow-lg)] outline-none'
            )}
          >
            {/* ── Header ────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)] shrink-0">
              <div className="min-w-0">
                {/* File path */}
                <p
                  className="text-sm font-mono text-[var(--text-primary)] truncate"
                  title={file.filePath}
                >
                  {file.filePath}
                </p>

                {/* File number badge */}
                <div className="flex items-center gap-1.5 mt-1">
                  <Hash className="h-3 w-3 text-[var(--text-tertiary)]" aria-hidden="true" />
                  <Badge
                    className={cn(
                      'text-[10px] px-1.5 py-0 font-mono',
                      'bg-[var(--bg-quaternary)] text-[var(--text-secondary)]',
                      'border-[var(--border-default)]'
                    )}
                  >
                    FILE {file.fileNumber}
                  </Badge>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    Phase {file.phase} — {file.phaseName}
                  </span>
                </div>
              </div>

              {/* Close button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close prompt panel"
                className={cn(
                  'shrink-0 h-8 w-8 p-0 text-[var(--text-tertiary)]',
                  'hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* ── Content (scrollable) ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 scrollbar-thin">
              {hasPrompt ? (
                <>
                  {/* Prompt section */}
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                        File-Specific Prompt
                      </p>
                      {/* Copy buttons */}
                      <div className="flex items-center gap-2">
                        <CopyButton
                          value={file.filePrompt ?? ''}
                          size="sm"
                          label="FSP"
                          aria-label="Copy file-specific prompt only"
                        />
                        {docData?.rawContent && (
                          <GcdPlusPromptButton
                            gcdContent={docData.rawContent}
                            filePrompt={file.filePrompt ?? ''}
                            filePath={file.filePath}
                            fileNumber={file.fileNumber}
                            requiredFiles={file.requiredFiles}
                          />
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        readOnly
                        value={file.filePrompt ?? ''}
                        aria-label="File prompt content"
                        className={cn(
                          'w-full min-h-[300px] resize-none rounded-lg px-3 py-2.5',
                          'bg-[var(--bg-input)] border border-[var(--border-default)]',
                          'text-sm text-[var(--text-primary)] leading-relaxed font-mono',
                          'focus:outline-none focus:border-[var(--accent-primary)]',
                          'scrollbar-thin'
                        )}
                      />
                    </div>
                  </section>

                  {/* Required dependencies */}
                  {hasRequiredFiles && (
                    <section>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                        Required Dependencies
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mb-2 leading-relaxed">
                        Show these files to Claude alongside this prompt:
                      </p>
                      <ul className="space-y-1.5">
                        {file.requiredFiles.map((dep) => (
                          <li
                            key={dep}
                            className="group flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]"
                          >
                            <span className="text-xs font-mono text-[var(--text-secondary)] truncate">
                              {dep}
                            </span>
                            <CopyButton value={dep} size="sm" aria-label={`Copy ${dep}`} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              ) : (
                /* Empty state — no prompt stored yet */
                <EmptyState
                  icon={FileText}
                  title="No prompt stored yet"
                  description="Generate all file-specific prompts using the Meta-Prompt card above, then paste Claude's output into the Parse dialog."
                  className="py-12"
                />
              )}
            </div>

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <div className="shrink-0 px-4 py-3 border-t border-[var(--border-subtle)]">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className={cn(
                  'w-full border-[var(--border-default)] text-[var(--text-secondary)]',
                  'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]',
                  'transition-all duration-150'
                )}
              >
                Close
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default FilePromptPanel