'use client'

// 1. React imports
import { useState, useEffect, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import { Check, AlertCircle, ChevronDown, ChevronRight, Braces } from 'lucide-react'

// 3. Internal imports — UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// 4. Internal imports — services, hooks, types, utils
import { useQueryClient } from '@tanstack/react-query'
import { validateJsonSummary, formatJsonEntry } from '@/services/jsonRegistryService'
import { useDocument } from '@/hooks/useDocument'
import { useFiles } from '@/hooks/useFiles'
import { cn } from '@/lib/utils'

// ─── Local types ─────────────────────────────────────────────────────────────

interface JsonAppendModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  prefilledFilePath?: string
}

type ValidationState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'valid' }

// ─── Format preview constant ──────────────────────────────────────────────────

const FORMAT_PREVIEW = `{
  "file": "src/services/example.ts",
  "fileNumber": "026",
  "exports": ["functionA", "functionB"],
  "imports": ["@/types", "@/lib/utils"],
  "keyLogic": "Brief description of key logic",
  "status": "complete"
}`

// ─── Normalize helper ─────────────────────────────────────────────────────────

/**
 * Claude sometimes outputs "path" instead of "file".
 * Normalize before validation so either key is accepted.
 */
function normalizeJsonInput(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // If "path" exists but "file" doesn't, remap it
    if (!('file' in parsed) && 'path' in parsed) {
      parsed['file'] = parsed['path']
      delete parsed['path']
      return JSON.stringify(parsed, null, 2)
    }
  } catch {
    // Not valid JSON yet — return raw and let the validator surface the error
  }
  return raw
}

// ─── Component ────────────────────────────────────────────────────────────────

export function JsonAppendModal({
  open,
  onClose,
  projectId,
  prefilledFilePath = '',
}: JsonAppendModalProps): JSX.Element {
  // ── State ──────────────────────────────────────────────────────────────────
  const [filePath, setFilePath] = useState<string>(prefilledFilePath)
  const [jsonText, setJsonText] = useState<string>('')
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' })
  const [parsedJson, setParsedJson] = useState<Record<string, unknown> | null>(null)
  const [isAppending, setIsAppending] = useState<boolean>(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false)

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const queryClient = useQueryClient()
  const { appendToSection } = useDocument(projectId)
  const { files, updateFileStatus, appendJsonSummary, isLoading: filesLoading } = useFiles(projectId)

  // ── Sync prefilledFilePath on open ────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setFilePath(prefilledFilePath)
      setJsonText('')
      setValidation({ status: 'idle' })
      setParsedJson(null)
      setIsPreviewOpen(false)
    }
  }, [open, prefilledFilePath])

  // ── Real-time JSON validation ─────────────────────────────────────────────
  const handleJsonChange = useCallback((raw: string) => {
    setJsonText(raw)

    if (raw.trim() === '') {
      setValidation({ status: 'idle' })
      setParsedJson(null)
      return
    }

    // Normalize "path" → "file" before parsing
    const normalized = normalizeJsonInput(raw)

    // Step 1: parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(normalized)
    } catch {
      setValidation({ status: 'error', message: 'Invalid JSON — check syntax' })
      setParsedJson(null)
      return
    }

    // Step 2: validate required fields
    const result = validateJsonSummary(parsed)
    if (!result.valid) {
      setValidation({ status: 'error', message: result.errors[0] ?? 'Validation failed' })
      setParsedJson(null)
      return
    }

    setParsedJson(parsed as Record<string, unknown>)
    setValidation({ status: 'valid' })
  }, [])

  // ── Append handler ────────────────────────────────────────────────────────
  const handleAppend = useCallback(async () => {
    if (!parsedJson || validation.status !== 'valid') return

    setIsAppending(true)
    const toastId = toast.loading('Appending JSON to Section 11…')
    try {      // Find the matching file first so we can use the single API route
      // that atomically saves jsonSummary, updates Section 11, reconciles
      // requiredFiles, and creates a version snapshot in one transaction.
      const matchingFile = files.find(
        (f) => f.filePath === filePath || f.filePath === parsedJson['file']
      )

      if (matchingFile) {
        // ✅ Single path: hits /files/[fileId]/json which handles everything
        await appendJsonSummary(matchingFile.id, parsedJson)

        if (matchingFile.status !== 'COMPLETE') {
          await updateFileStatus(matchingFile.id, 'COMPLETE').catch(() => {
            // Non-blocking — file status update failure shouldn't block success
          })
        }
      } else {
        // Fallback: no matching file found — append directly to document section
        const formatted = formatJsonEntry(parsedJson)
        await appendToSection('11', formatted)
        await queryClient.invalidateQueries({ queryKey: ['files', projectId] })
      }

      // Wait for actual network refetch to complete — not just cache invalidation
      await queryClient.refetchQueries({ queryKey: ['document', projectId] })
      await queryClient.refetchQueries({ queryKey: ['files', projectId] })
      toast.success('✅ Section 11 updated — JSON entry saved to registry', { id: toastId })
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to append JSON'
      toast.error(message, { id: toastId })
    } finally {
      setIsAppending(false)
    }
  }, [parsedJson, validation.status, appendToSection, appendJsonSummary, filePath, files, updateFileStatus, queryClient, projectId, onClose])

  // ── Derived ───────────────────────────────────────────────────────────────
  const isValid = validation.status === 'valid'
  const hasError = validation.status === 'error'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-2xl bg-[var(--bg-secondary)] border-[var(--border-default)] text-[var(--text-primary)] p-0 gap-0">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-light)]">
              <Braces className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <DialogTitle className="text-base font-semibold text-[var(--text-primary)]">
              Append File JSON to Registry
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-5">

          {/* File path field */}
          <div className="space-y-1.5">
            <label
              htmlFor="json-modal-filepath"
              className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
            >
              File Path
            </label>
            <Input
              id="json-modal-filepath"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="src/services/example.ts"
              className="font-mono text-sm bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)] focus-visible:border-[var(--accent-primary)]"
            />
          </div>

          {/* JSON textarea */}
          <div className="space-y-1.5">
            <label
              htmlFor="json-modal-textarea"
              className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
            >
              JSON Summary
            </label>
            <div className="relative">
              <textarea
                id="json-modal-textarea"
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                placeholder={`Paste the JSON summary Claude generated after the file code…`}
                rows={10}
                spellCheck={false}
                className={cn(
                  'w-full min-h-[200px] resize-y rounded-md border px-3 py-2.5 font-mono text-sm',
                  'bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                  'outline-none transition-colors duration-150',
                  'focus:ring-1',
                  isValid
                    ? 'border-[var(--status-complete)] focus:border-[var(--status-complete)] focus:ring-[var(--status-complete)]'
                    : hasError
                    ? 'border-[var(--status-error)] focus:border-[var(--status-error)] focus:ring-[var(--status-error)]'
                    : 'border-[var(--border-default)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-primary)]'
                )}
              />
            </div>

            {/* Validation feedback */}
            <div className="min-h-[20px]">
              {isValid && (
                <p className="flex items-center gap-1.5 text-xs text-[var(--status-complete)]">
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  Valid JSON — required fields present
                </p>
              )}
              {hasError && (
                <p className="flex items-center gap-1.5 text-xs text-[var(--status-error)]">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {(validation as { status: 'error'; message: string }).message}
                </p>
              )}
            </div>
          </div>

          {/* Format preview — collapsed by default */}
          <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPreviewOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
            >
              <span>Expected JSON structure</span>
              {isPreviewOpen
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />
              }
            </button>

            {isPreviewOpen && (
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] px-4 py-3">
                <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre overflow-x-auto">
                  {FORMAT_PREVIEW}
                </pre>
                <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                  Required fields: <code className="text-[var(--accent-primary)]">file</code>,{' '}
                  <code className="text-[var(--accent-primary)]">fileNumber</code>,{' '}
                  <code className="text-[var(--accent-primary)]">exports</code>,{' '}
                  <code className="text-[var(--accent-primary)]">imports</code>,{' '}
                  <code className="text-[var(--accent-primary)]">keyLogic</code>,{' '}
                  <code className="text-[var(--accent-primary)]">status</code>
                </p>
                <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">
                  Note: <code className="text-[var(--accent-primary)]">"path"</code> is automatically
                  remapped to <code className="text-[var(--accent-primary)]">"file"</code> if Claude
                  uses the wrong key.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="px-6 py-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isAppending}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAppend}
            disabled={!isValid || isAppending}
            className={cn(
              'min-w-[140px] font-medium transition-all duration-150 active:scale-95',
              isValid
                ? 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white'
                : 'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] cursor-not-allowed'
            )}
          >
            {isAppending ? (
              <span className="flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Appending…
              </span>
            ) : (
              'Validate & Append'
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  )
}