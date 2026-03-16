'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 4. Internal imports — services, hooks, validation, utils
import { useErrors } from '@/hooks/useErrors'
import { useEditorStore } from '@/store/editorStore'
import { addErrorSessionSchema, type AddErrorSessionInput } from '@/validations/error'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Local types
interface AddErrorSessionProps {
  projectId: string
  onAdded: () => void
}

type InputMode = 'standard' | 'tsc' | 'auto'

const AUTO_FIX_PROMPT = `You are reviewing error logs from a Next.js TypeScript codebase. Identify which files need to be read to fix ALL errors shown.

Respond with ONLY this JSON — no prose:

\`\`\`json
{
  "files": ["exact/path/from/project/root.ts"],
  "reason": "one sentence"
}
\`\`\`

RULES:
- Maximum 15 files — prioritize files with most errors
- Use exact paths as shown in the error output
- NO text before or after the JSON

Here are the error logs:`

const WINDOWS_SCAN_CMD = `npx tsc --noEmit 2>&1 | node -e "const fs=require('fs');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>fs.writeFileSync('devforge-errors.json',JSON.stringify({errors:d,timestamp:Date.now()})))"`

const MAC_SCAN_CMD = `npx tsc --noEmit 2>&1 | node -e "const fs=require('fs');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>fs.writeFileSync('devforge-errors.json',JSON.stringify({errors:d,timestamp:Date.now()})))"`

const ERROR_TYPE_OPTIONS = [
  { value: 'TYPESCRIPT', label: 'TypeScript' },
  { value: 'BUILD', label: 'Build' },
  { value: 'RUNTIME', label: 'Runtime' },
  { value: 'CONSOLE', label: 'Console' },
  { value: 'OTHER', label: 'Other' },
] as const

export function AddErrorSession({ projectId, onAdded }: AddErrorSessionProps): JSX.Element {
  // 8a. State hooks
  const [isOpen, setIsOpen] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>('standard')
  const [tscOutput, setTscOutput] = useState('')
  const [isTscSubmitting, setIsTscSubmitting] = useState(false)
  const [autoOutput, setAutoOutput] = useState('')
  const [autoCopiedPrompt, setAutoCopiedPrompt] = useState(false)
  const [autoCopiedFiles, setAutoCopiedFiles] = useState(false)
  const [autoParsedFiles, setAutoParsedFiles] = useState<string[]>([])
  const [autoFileListInput, setAutoFileListInput] = useState('')
  const [autoFileListError, setAutoFileListError] = useState<string | null>(null)
  const [scannedErrors, setScannedErrors] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [copiedScanCmd, setCopiedScanCmd] = useState(false)
  const [lastScanTime, setLastScanTime] = useState<number | null>(null)

  // 8b. External hooks
  const { addSession, addTscSession, parseTscOutput } = useErrors(projectId)
  const getLocalState = useEditorStore((s) => s.getLocalState)

  const handleAutoCopyPrompt = useCallback(async () => {
    if (!autoOutput.trim()) return
    await navigator.clipboard.writeText(AUTO_FIX_PROMPT + '\n\n' + autoOutput.trim())
    setAutoCopiedPrompt(true)
    setTimeout(() => setAutoCopiedPrompt(false), 2500)
  }, [autoOutput])

  const handleAutoParseFileList = useCallback((raw: string) => {
    setAutoFileListInput(raw)
    if (!raw.trim()) { setAutoParsedFiles([]); setAutoFileListError(null); return }
    try {
      const fenceStart = raw.indexOf('```')
      let jsonStr = raw.trim()
      if (fenceStart !== -1) {
        const afterFence = raw.indexOf('\n', fenceStart) + 1
        const closeFence = raw.indexOf('```', afterFence)
        jsonStr = closeFence !== -1 ? raw.slice(afterFence, closeFence).trim() : raw.slice(afterFence).trim()
      }
      const data = JSON.parse(jsonStr) as unknown
      if (typeof data !== 'object' || data === null) throw new Error('Must be a JSON object')
      const filesArr = (data as Record<string, unknown>).files
      if (!Array.isArray(filesArr)) throw new Error('Response must have a "files" array')
      if (!filesArr.every((f) => typeof f === 'string')) throw new Error('All files must be strings')
      setAutoParsedFiles((filesArr as string[]).slice(0, 15))
      setAutoFileListError(null)
    } catch (e) {
      setAutoParsedFiles([])
      setAutoFileListError(e instanceof Error ? e.message : 'Invalid format')
    }
  }, [])

  const handleAutoCopyFiles = useCallback(async () => {
    if (autoParsedFiles.length === 0) return
    const sep = '='.repeat(60)
    const blocks = autoParsedFiles.map((f) => `${sep}\nFILE: ${f}\n${sep}\n[PASTE THE COMPLETE FILE CODE HERE]`).join('\n\n')
    const fixPrompt = [
      '',
      '',
      sep,
      'NOW PROVIDE FIXES',
      sep,
      '',
      'You have read all the files above. Provide ALL fixes as a JSON array.',
      'Paste the array directly — no prose, no markdown fences around the array itself:',
      '',
      '[',
      '  {',
      '    "file": "exact/path/from/project/root.ts",',
      '    "search": "unique 1-4 line anchor that appears ONLY ONCE in the file — copy exactly",',
      '    "replace": "complete replacement — no placeholders, no truncation, fully written"',
      '  }',
      ']',
      '',
      'CRITICAL RULES:',
      '- search must be 1-4 lines MAXIMUM',
      '- search must appear EXACTLY ONCE in the file',
      '- replace must be 100% complete code — no // ...existing code..., no // TODO',
      '- Fix every error shown in the logs above',
      '- ONLY the JSON array — nothing else',
    ].join('\n')
    await navigator.clipboard.writeText('Here are the files you requested:\n\n' + blocks + fixPrompt)
    setAutoCopiedFiles(true)
    setTimeout(() => setAutoCopiedFiles(false), 2500)
  }, [autoParsedFiles])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddErrorSessionInput>({
    resolver: zodResolver(addErrorSessionSchema),
    defaultValues: {
      errorType: 'TYPESCRIPT',
      errorOutput: '',
    },
  })

  const errorOutput = watch('errorOutput')

  // 8d. Event handlers
  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])

  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('win')

  const handleCopyScanCmd = useCallback(async () => {
    const cmd = isWindows ? WINDOWS_SCAN_CMD : MAC_SCAN_CMD
    await navigator.clipboard.writeText(cmd)
    setCopiedScanCmd(true)
    setTimeout(() => setCopiedScanCmd(false), 2500)
  }, [isWindows])

  const handleScanFromFolder = useCallback(async () => {
    setIsScanning(true)
    setScanError(null)
    try {
      const { localFileTree: localTree } = getLocalState(projectId)

      const findFile = (nodes: Array<{ type: string; name: string; path: string; handle: unknown; children?: unknown[] }>, name: string): FileSystemFileHandle | null => {
        for (const node of nodes) {
          if (node.type === 'file' && node.name === name) return node.handle as FileSystemFileHandle
          if (node.type === 'folder' && node.children) {
            const found = findFile(node.children as Array<{ type: string; name: string; path: string; handle: unknown; children?: unknown[] }>, name)
            if (found) return found
          }
        }
        return null
      }

      const handle = findFile(localTree, 'devforge-errors.json')
      if (!handle) {
        setScanError('devforge-errors.json not found. Run the scan command in your terminal first, then click Scan again.')
        setIsScanning(false)
        return
      }

      const file = await handle.getFile()
      const text = await file.text()
      const parsed = JSON.parse(text) as { errors: string; timestamp: number }
      setScannedErrors(parsed.errors ?? '')
      setLastScanTime(parsed.timestamp ?? null)
      setAutoOutput(parsed.errors ?? '')
      setScanError(null)
    } catch {
      setScanError('Could not read devforge-errors.json. Make sure you have linked your project folder in the Editor tab.')
    } finally {
      setIsScanning(false)
    }
  }, [projectId])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    setInputMode('standard')
    setTscOutput('')
    setAutoOutput('')
    setAutoParsedFiles([])
    setAutoFileListInput('')
    setAutoFileListError(null)
    setScannedErrors('')
    setScanError(null)
    reset()
  }, [reset])

  const onSubmit = useCallback(
    async (data: AddErrorSessionInput) => {
      await addSession(data)
      reset()
      setIsOpen(false)
      onAdded()
    },
    [addSession, reset, onAdded]
  )

  const handleTscSubmit = useCallback(async () => {
    if (!tscOutput.trim() || isTscSubmitting) return
    setIsTscSubmitting(true)
    try {
      await addTscSession(tscOutput.trim())
      setTscOutput('')
      setIsOpen(false)
      setInputMode('standard')
      onAdded()
    } finally {
      setIsTscSubmitting(false)
    }
  }, [tscOutput, isTscSubmitting, addTscSession, onAdded])

  // ── Collapsed state: just a button ──
  if (!isOpen) {
    return (
      <Button
        onClick={handleOpen}
        className={cn(
          'h-9 text-sm gap-2',
          'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white'
        )}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add Error Session
      </Button>
    )
  }

  // ── Expanded form ──
  const tscGroups = inputMode === 'tsc' ? parseTscOutput(tscOutput) : []
  const tscTotalErrors = tscGroups.reduce((n, g) => n + g.errorCount, 0)

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">New Error Session</h3>
        <button
          type="button"
          onClick={handleCancel}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setInputMode('standard')}
          className={cn(
            'flex-1 rounded-lg border py-2 px-3 text-xs font-medium transition-colors',
            inputMode === 'standard'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
              : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          )}
        >
          Standard error
        </button>
        <button
          type="button"
          onClick={() => setInputMode('tsc')}
          className={cn(
            'flex-1 rounded-lg border py-2 px-3 text-xs font-medium transition-colors',
            inputMode === 'tsc'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
              : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          )}
        >
          <span className="font-mono">npx tsc --noEmit</span> output
        </button>
        <button
          type="button"
          onClick={() => setInputMode('auto')}
          className={cn(
            'flex-1 rounded-lg border py-2 px-3 text-xs font-medium transition-colors',
            inputMode === 'auto'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
              : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          )}
        >
          ⚡ Auto Fix
        </button>
      </div>

      {/* ── TSC mode ── */}
      {inputMode === 'tsc' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)] block">
              Paste the full output of{' '}
              <code className="font-mono bg-[var(--bg-quaternary)] px-1 rounded">npx tsc --noEmit</code>
            </label>
            <textarea
              value={tscOutput}
              onChange={(e) => setTscOutput(e.target.value)}
              rows={10}
              className={cn(
                'w-full rounded-md border bg-[var(--bg-input)] text-[var(--text-primary)]',
                'text-xs font-mono placeholder:text-[var(--text-tertiary)]',
                'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                'focus:ring-1 focus:ring-[var(--accent-light)] outline-none',
                'transition-colors duration-150 resize-y p-3 min-h-[180px]'
              )}
              placeholder={`src/hooks/useErrors.ts(42,7): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/components/workspace/ErrorSessionCard.tsx(18,3): error TS7006: Parameter 'session' implicitly has an 'any' type.
...`}
            />
          </div>

          {/* Live parse preview */}
          {tscOutput.trim().length > 0 && (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 space-y-2">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Detected:{' '}
                <span className="text-[var(--status-error)] font-bold">{tscTotalErrors} error(s)</span>
                {' '}across{' '}
                <span className="font-bold text-[var(--text-primary)]">{tscGroups.length} file(s)</span>
              </p>
              {tscGroups.length > 0 && (
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {tscGroups.map((g) => (
                    <li key={g.filePath} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[var(--text-primary)] truncate flex-1">{g.filePath}</span>
                      <span className="ml-2 shrink-0 text-[var(--status-error)]">
                        {g.errorCount} error{g.errorCount !== 1 ? 's' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel} className="h-9 text-sm">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleTscSubmit}
              disabled={isTscSubmitting || tscOutput.trim().length < 10}
              className={cn(
                'h-9 text-sm gap-2 min-w-[180px]',
                'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isTscSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating TSC Prompts…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate TSC Fix Prompts
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Auto Fix mode ── */}
      {inputMode === 'auto' && (
        <div className="space-y-3">
          {/* ── Scan from folder ── */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              Auto Scan — reads errors directly from your project folder
            </p>
            <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
              Run this command once in your terminal. DevForge will read the output automatically.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyScanCmd}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-medium border transition-all duration-150',
                  copiedScanCmd
                    ? 'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
                )}
              >
                {copiedScanCmd ? '✓ Copied!' : `📋 Copy ${isWindows ? 'Windows' : 'Mac/Linux'} Scan Command`}
              </button>
              <button
                type="button"
                onClick={handleScanFromFolder}
                disabled={isScanning}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-medium transition-all duration-150',
                  isScanning
                    ? 'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] cursor-wait'
                    : scannedErrors
                    ? 'bg-[var(--status-complete-bg)] border border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                    : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white active:scale-95'
                )}
              >
                {isScanning ? '⏳ Scanning…' : scannedErrors ? '✓ Errors Loaded' : '🔍 Scan Project'}
              </button>
            </div>
            {scanError && (
              <p className="text-xs text-[var(--status-error)] leading-relaxed">{scanError}</p>
            )}
            {scannedErrors && lastScanTime && (
              <p className="text-xs text-[var(--status-complete)]">
                ✓ {scannedErrors.split('\n').filter((l) => l.includes('error TS')).length} TypeScript errors loaded
                {' — '}scanned {new Date(lastScanTime).toLocaleTimeString()}
              </p>
            )}
            <p className="text-[10px] text-[var(--text-tertiary)]">
              Tip: Run the scan command whenever you want fresh errors. Click Scan Project to reload.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="text-[10px] text-[var(--text-tertiary)]">or paste manually</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)] block">
              Step 1 — Paste ALL error logs (TypeScript, build, runtime, console — any format)
            </label>
            <textarea
              value={autoOutput}
              onChange={(e) => setAutoOutput(e.target.value)}
              rows={8}
              className={cn(
                'w-full rounded-md border bg-[var(--bg-input)] text-[var(--text-primary)]',
                'text-xs font-mono placeholder:text-[var(--text-tertiary)]',
                'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                'focus:ring-1 focus:ring-[var(--accent-light)] outline-none',
                'transition-colors duration-150 resize-y p-3 min-h-[160px]'
              )}
              placeholder={'src/hooks/useEditor.ts(42,7): error TS2345: ...\nsrc/components/Button.tsx(18,3): error TS7006: ...\n\nOr paste build errors, runtime errors — any format works'}
            />
            {autoOutput.trim().length > 10 && (
              <p className="text-xs text-[var(--text-tertiary)]">
                {autoOutput.trim().split('\n').filter(Boolean).length} lines detected
              </p>
            )}
          </div>

          {autoOutput.trim().length > 10 && (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Step 2 — Ask Claude which files to review</p>
              <p className="text-xs text-[var(--text-tertiary)]">Copies your errors + a prompt. Paste into Claude — Claude will reply with a file list.</p>
              <button
                type="button"
                onClick={handleAutoCopyPrompt}
                className={cn(
                  'w-full flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-medium border transition-all duration-150',
                  autoCopiedPrompt
                    ? 'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                    : 'border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white'
                )}
              >
                {autoCopiedPrompt ? '✓ Copied — paste into Claude' : '📋 Copy Errors + File-Request Prompt'}
              </button>
            </div>
          )}

          {autoOutput.trim().length > 10 && (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Step 3 — Paste Claude's file list response</p>
              <textarea
                value={autoFileListInput}
                onChange={(e) => handleAutoParseFileList(e.target.value)}
                rows={4}
                className={cn(
                  'w-full rounded-md border px-3 py-2 font-mono text-xs resize-none',
                  'bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                  'outline-none transition-colors duration-150 focus:ring-1',
                  autoFileListError && autoFileListInput.trim()
                    ? 'border-[var(--status-error)] focus:ring-[var(--status-error)]'
                    : autoParsedFiles.length > 0
                    ? 'border-[var(--status-complete)] focus:ring-[var(--status-complete)]'
                    : 'border-[var(--border-default)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-primary)]'
                )}
                placeholder="Paste Claude's JSON response here…"
              />
              {autoFileListError && autoFileListInput.trim() && (
                <p className="text-xs text-[var(--status-error)]">{autoFileListError}</p>
              )}
              {autoParsedFiles.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-[var(--status-complete)] font-medium">
                    {autoParsedFiles.length} file{autoParsedFiles.length !== 1 ? 's' : ''} identified
                  </p>
                  {autoParsedFiles.map((f, i) => (
                    <p key={i} className="text-xs font-mono text-[var(--accent-primary)] truncate">• {f}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {autoParsedFiles.length > 0 && (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Step 4 — Copy file template + fix prompt</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Copies a template for all {autoParsedFiles.length} files + the fix instruction. Paste each file's code, send to Claude. Claude responds with a JSON array you paste into Auto Apply Fixes.
              </p>
              <button
                type="button"
                onClick={handleAutoCopyFiles}
                className={cn(
                  'w-full flex items-center justify-center gap-2 h-8 rounded-lg text-xs font-medium transition-all duration-150',
                  autoCopiedFiles
                    ? 'bg-[var(--status-complete-bg)] border border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white active:scale-95'
                )}
              >
                {autoCopiedFiles
                  ? `✓ Copied ${autoParsedFiles.length} file template`
                  : `⚡ Copy ${autoParsedFiles.length} File Template + Fix Prompt`}
              </button>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel} className="h-9 text-sm">
              Close
            </Button>
          </div>
        </div>
      )}

      {/* ── Standard mode ── */}
      {inputMode === 'standard' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Error type select */}
          <div className="space-y-1.5">
            <label htmlFor="errorType" className="text-xs font-medium text-[var(--text-secondary)] block">
              Error Type
            </label>
            <select
              id="errorType"
              {...register('errorType')}
              className={cn(
                'w-full h-10 rounded-md border bg-[var(--bg-input)] text-[var(--text-primary)]',
                'text-sm px-3 appearance-none',
                'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                'focus:ring-1 focus:ring-[var(--accent-light)] outline-none',
                'transition-colors duration-150 cursor-pointer',
                errors.errorType && 'border-[var(--status-error)]'
              )}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23606060' stroke-width='2'%3E%3Cpath d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '32px',
              }}
            >
              {ERROR_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.errorType && (
              <p className="text-xs text-[var(--status-error)]">{errors.errorType.message}</p>
            )}
          </div>

          {/* Error output textarea */}
          <div className="space-y-1.5">
            <label htmlFor="errorOutput" className="text-xs font-medium text-[var(--text-secondary)] block">
              Error Output
              <span className="ml-2 text-[var(--text-tertiary)] font-normal">
                Paste the complete error message
              </span>
            </label>
            <textarea
              id="errorOutput"
              {...register('errorOutput')}
              rows={8}
              className={cn(
                'w-full rounded-md border bg-[var(--bg-input)] text-[var(--text-primary)]',
                'text-xs font-mono placeholder:text-[var(--text-tertiary)]',
                'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                'focus:ring-1 focus:ring-[var(--accent-light)] outline-none',
                'transition-colors duration-150 resize-y p-3 min-h-[160px]',
                errors.errorOutput && 'border-[var(--status-error)]'
              )}
              placeholder={`TypeError: Cannot read properties of undefined (reading 'map')
    at DocumentSection (src/components/workspace/DocumentSection.tsx:42:18)
    ...`}
            />
            <div className="flex items-center justify-between">
              {errors.errorOutput ? (
                <p className="text-xs text-[var(--status-error)]">{errors.errorOutput.message}</p>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)]">{errorOutput.length} characters</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={isSubmitting} className="h-9 text-sm">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || errorOutput.trim().length < 10}
              className={cn(
                'h-9 text-sm gap-2 min-w-[160px]',
                'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating Prompts…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Fix Prompts
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}