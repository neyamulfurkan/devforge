'use client'

// 1. React imports
import { useState } from 'react'

// 3. Third-party library imports
import { ArrowLeft, Copy, ClipboardPaste, CheckCircle2 } from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// 5. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 6. Internal imports — utils
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GenerateDocumentStepProps {
  generatedPrompt: string
  onImport: (documentText: string) => void
  isImporting: boolean
  onBack: () => void
}

type PathOption = 'generate' | 'direct'

// ─── Component ───────────────────────────────────────────────────────────────

export function GenerateDocumentStep({
  generatedPrompt,
  onImport,
  isImporting,
  onBack,
}: GenerateDocumentStepProps): JSX.Element {
  const [activePath, setActivePath] = useState<PathOption>('generate')
  const [pastedDocument, setPastedDocument] = useState('')

  const canImport = pastedDocument.trim().length > 100

  const STEPS = [
    'Copy the prompt above',
    'Open Claude in a new tab',
    'Paste the prompt into Claude',
    'Claude generates your Global Context Document',
    'Copy the entire document Claude outputs',
    'Return here and paste it below',
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Path selector */}
      <div className="grid grid-cols-2 gap-3">
        {/* Path A */}
        <button
          type="button"
          onClick={() => setActivePath('generate')}
          className={cn(
            'flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150',
            'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none',
            activePath === 'generate'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:border-[var(--border-default)]'
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                activePath === 'generate'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                  : 'border-[var(--border-default)]'
              )}
            >
              {activePath === 'generate' && (
                <div className="h-2 w-2 rounded-full bg-white" />
              )}
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Generate Prompt
            </span>
            <span className="ml-auto rounded-full bg-[var(--accent-primary)] px-2 py-0.5 text-[10px] font-medium text-white">
              Recommended
            </span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            We generate a master prompt you paste into Claude
          </p>
        </button>

        {/* Path B */}
        <button
          type="button"
          onClick={() => setActivePath('direct')}
          className={cn(
            'flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150',
            'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none',
            activePath === 'direct'
              ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
              : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] hover:border-[var(--border-default)]'
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
                activePath === 'direct'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                  : 'border-[var(--border-default)]'
              )}
            >
              {activePath === 'direct' && (
                <div className="h-2 w-2 rounded-full bg-white" />
              )}
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              I Already Have a Document
            </span>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            Skip generation and paste your existing document
          </p>
        </button>
      </div>

      {/* Path A content */}
      {activePath === 'generate' && (
        <div className="flex flex-col gap-5">
          {/* Generated prompt */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Your Generated Prompt
              </p>
              <CopyButton value={generatedPrompt} size="md" label="Copy Prompt" />
            </div>
            <div className="relative rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)]">
              <Textarea
                value={generatedPrompt}
                readOnly
                rows={8}
                className="resize-none border-0 bg-transparent font-mono text-xs leading-relaxed text-[var(--text-secondary)] focus:ring-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                aria-label="Generated prompt — copy this into Claude"
              />
            </div>
          </div>

          {/* Step instructions */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              Instructions
            </p>
            <ol className="flex flex-col gap-2">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[10px] font-bold text-[var(--accent-primary)]">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-snug text-[var(--text-secondary)]">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Paste area */}
          <div className="flex flex-col gap-2">
            <Label>Paste your Global Context Document here</Label>
            <Textarea
              value={pastedDocument}
              onChange={(e) => setPastedDocument(e.target.value)}
              placeholder="Paste the complete Global Context Document that Claude generated..."
              rows={8}
              disabled={isImporting}
              className={cn(
                'min-h-[200px] resize-y bg-[var(--bg-input)] text-sm',
                'border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)]',
                'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)]'
              )}
            />
          </div>
        </div>
      )}

      {/* Path B content */}
      {activePath === 'direct' && (
        <div className="flex flex-col gap-2">
          <Label>Paste your Global Context Document</Label>
          <Textarea
            value={pastedDocument}
            onChange={(e) => setPastedDocument(e.target.value)}
            placeholder="Paste your complete Global Context Document here..."
            rows={14}
            disabled={isImporting}
            className={cn(
              'min-h-[200px] resize-y bg-[var(--bg-input)] text-sm',
              'border-[var(--border-default)] text-[var(--text-primary)]',
              'placeholder:text-[var(--text-tertiary)]',
              'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)]'
            )}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isImporting}
          className="gap-2 border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          type="button"
          onClick={() => onImport(pastedDocument.trim())}
          disabled={!canImport || isImporting}
          className={cn(
            'gap-2 bg-[var(--accent-primary)] font-medium text-white',
            'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
          )}
        >
          {isImporting ? (
            <>
              <InlineSpinner />
              <span>Parsing document…</span>
            </>
          ) : (
            <>
              <ClipboardPaste className="h-4 w-4" />
              <span>Import &amp; Parse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// Local label helper (avoids importing shadcn Label just for this small wrapper)
function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}): JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-[var(--text-primary)]"
    >
      {children}
    </label>
  )
}