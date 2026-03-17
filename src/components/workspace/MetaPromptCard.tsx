'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party imports
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Internal imports — hooks
import { useDocument } from '@/hooks/useDocument'
import { useProjectPrompts } from '@/hooks/usePrompts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MetaPromptCardProps {
  projectId: string
}

type GenerateState = 'idle' | 'generating' | 'ready' | 'error'

type ParseState = 'idle' | 'parsing' | 'done' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export function MetaPromptCard({ projectId }: MetaPromptCardProps): JSX.Element {
  // ── State ──────────────────────────────────────────────────────────────────
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('')
  const [generateState, setGenerateState] = useState<GenerateState>('idle')
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [rawOutput, setRawOutput] = useState<string>('')
  const [parseState, setParseState] = useState<ParseState>('idle')
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<{ count: number; fileNumbers: string[] } | null>(null)

  const [isOutputExpanded, setIsOutputExpanded] = useState(false)

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { document: docData, isLoading: isDocLoading } = useDocument(projectId)
  const { parseAndStore } = useProjectPrompts(projectId)

  // ── Generate meta-prompt ───────────────────────────────────────────────────
  const handleGenerate = useCallback(async (): Promise<void> => {
    setGenerateState('generating')
    setGenerateError(null)
    setGeneratedPrompt('')

    try {
      const res = await fetch('/api/ai/generate-meta-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(
          (json as { error?: string }).error ?? `Server error: ${res.status}`
        )
      }

      const data = json.data as { prompt: string; totalFiles: number }
      setGeneratedPrompt(data.prompt)
      setGenerateState('ready')
      setIsOutputExpanded(true)
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate meta-prompt')
      setGenerateState('error')
    }
  }, [projectId])

  // ── Parse Claude's JSON output ─────────────────────────────────────────────
  const handleParse = useCallback(async (): Promise<void> => {
    if (!rawOutput.trim()) return

    setParseState('parsing')
    setParseError(null)
    setParseResult(null)

    try {
      const result = await parseAndStore(rawOutput)
      setParseResult({ count: result.count, fileNumbers: result.fileNumbers })
      setParseState('done')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse output')
      setParseState('error')
    }
  }, [rawOutput, parseAndStore])

  // ── Derived state ──────────────────────────────────────────────────────────
  const hasDocument = Boolean(docData?.rawContent)
  const isGenerating = generateState === 'generating'
  const isParsing = parseState === 'parsing'
  const canGenerate = hasDocument && !isGenerating
  const canParse = rawOutput.trim().length > 0 && !isParsing

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-primary)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10">
          <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Meta-Prompt Generator
          </h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Generate the prompt that produces your per-file spec JSON array
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Step 1 — Generate */}
        <div className="space-y-3">
          <StepLabel number={1} text="Generate the meta-prompt" />

          {!hasDocument && !isDocLoading && (
            <Notice variant="warning">
              No Global Context Document found. Create one in the Document tab first.
            </Notice>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full h-9 text-sm font-medium bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Generate Meta-Prompt
              </>
            )}
          </Button>

          {generateState === 'error' && generateError && (
            <Notice variant="error">{generateError}</Notice>
          )}

          {generateState === 'ready' && generatedPrompt && (
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-hidden">
              {/* Collapsible header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsOutputExpanded((p) => !p)}
                onKeyDown={(e) => e.key === 'Enter' && setIsOutputExpanded((p) => !p)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
              >
                <span className="font-medium">Prompt ready — paste into Claude</span>
                <div className="flex items-center gap-2">
                  <CopyButton
                    value={generatedPrompt}
                    size="sm"
                    successMessage="Meta-prompt copied!"
                    showToast
                    toastLabel="Meta-Prompt"
                  />
                  {isOutputExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </div>
              </div>
              {isOutputExpanded && (
                <pre className="px-4 py-3 text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-words max-h-72 overflow-y-auto border-t border-[var(--border-primary)]">
                  {generatedPrompt}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border-primary)]" />

        {/* Step 2 — Paste Claude's output */}
        <div className="space-y-3">
          <StepLabel number={2} text="Paste Claude's JSON array output" />

          <Textarea
            value={rawOutput}
            onChange={(e) => {
              setRawOutput(e.target.value)
              if (parseState !== 'idle') {
                setParseState('idle')
                setParseError(null)
                setParseResult(null)
              }
            }}
            placeholder="Paste Claude's response here — the raw JSON array starting with [ ..."
            className="min-h-[120px] resize-y font-mono text-xs bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus-visible:ring-[var(--accent-primary)]"
            spellCheck={false}
          />

          <Button
            onClick={handleParse}
            disabled={!canParse}
            variant="outline"
            className="w-full h-9 text-sm font-medium border-[var(--border-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
          >
            {isParsing ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Parsing & Storing…
              </>
            ) : (
              'Parse & Store File Prompts'
            )}
          </Button>

          {parseState === 'error' && parseError && (
            <Notice variant="error">{parseError}</Notice>
          )}

          {parseState === 'done' && parseResult && (
            <Notice variant="success">
              {`Stored ${parseResult.count} file prompt${parseResult.count !== 1 ? 's' : ''} successfully. Your file prompts are now available in the Files tab.`}
            </Notice>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepLabel({ number, text }: { number: number; text: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-[10px] font-bold text-[var(--accent-primary)]">
        {number}
      </span>
      <span className="text-xs font-medium text-[var(--text-secondary)]">{text}</span>
    </div>
  )
}

type NoticeVariant = 'warning' | 'error' | 'success'

function Notice({
  variant,
  children,
}: {
  variant: NoticeVariant
  children: React.ReactNode
}): JSX.Element {
  const styles: Record<NoticeVariant, string> = {
    warning:
      'bg-amber-500/10 border-amber-500/20 text-amber-400',
    error:
      'bg-[var(--status-error-bg)] border-[var(--status-error)]/20 text-[var(--status-error)]',
    success:
      'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/20 text-[var(--status-complete)]',
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${styles[variant]}`}
    >
      {variant !== 'success' && (
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      )}
      <span>{children}</span>
    </div>
  )
}