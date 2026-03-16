'use client'

// 1. React imports
// (none beyond JSX)

// 2. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 3. Internal imports — utils
import { cn } from '@/lib/utils'

// 4. Local types
interface ErrorFixPromptsProps {
  identifyPrompt: string
  replacePrompt: string
}

interface StepCardProps {
  step: 1 | 2
  label: string
  instruction: string
  promptText: string
}

// Private step card sub-component
function StepCard({ step, label, instruction, promptText }: StepCardProps): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-lg border bg-[var(--bg-secondary)]',
        'border-l-4',
        step === 1
          ? 'border-[var(--border-default)] border-l-[var(--accent-primary)]'
          : 'border-[var(--border-default)] border-l-purple-500'
      )}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
        {/* Step number badge */}
        <span
          className={cn(
            'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white shrink-0',
            step === 1 ? 'bg-[var(--accent-primary)]' : 'bg-purple-500'
          )}
        >
          {step}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{instruction}</p>
        </div>

        {/* Large copy button */}
        <CopyButton value={promptText} size="lg" />
      </div>

      {/* Prompt text */}
      <div className="relative">
        <textarea
          readOnly
          value={promptText}
          rows={6}
          className={cn(
            'w-full rounded-b-lg bg-[#1a1a1a] text-[var(--text-primary)]',
            'text-xs font-mono p-4 resize-none outline-none',
            'border-0 leading-relaxed',
            'overflow-y-auto max-h-48',
            'cursor-text select-text'
          )}
          aria-label={`${label} prompt text`}
        />
      </div>
    </div>
  )
}

// Required GCD sections for error fixing — shown as a strip above Step 1
const TSC_GCD_REQUIRED = [
  { num: '1', label: 'Overview' },
  { num: '3', label: 'Stack' },
  { num: '4', label: 'File Structure' },
  { num: '5', label: 'Standards' },
  { num: '9', label: 'Sequence' },
  { num: '11', label: 'Registry' },
]

export function ErrorFixPrompts({
  identifyPrompt,
  replacePrompt,
  isTscSession = false,
}: ErrorFixPromptsProps & { isTscSession?: boolean }): JSX.Element {
  return (
    <div className="space-y-3">
      {/* Section label */}
      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
        AI Fix Prompts
      </p>

      {/* Required GCD sections strip — shown for all sessions, critical for TSC */}
      <div className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-light)] px-3 py-2">
        <p className="text-xs font-medium text-[var(--accent-primary)] mb-1.5">
          Required GCD sections for Step 1:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TSC_GCD_REQUIRED.map((s) => (
            <span
              key={s.num}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--accent-border)] px-2 py-0.5 text-xs font-mono text-[var(--accent-primary)]"
            >
              §{s.num} <span className="text-[var(--text-tertiary)] font-sans">{s.label}</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-1.5">
          Paste these sections from your Document tab into Claude before Step 1.
        </p>
      </div>

      {/* Step 1 */}
      <StepCard
        step={1}
        label={isTscSession ? 'Step 1 — TSC File Identification' : 'Step 1 — File Identification'}
        instruction={
          isTscSession
            ? 'Show this to Claude with GCD sections §1 §3 §4 §5 §9 §11. Claude MUST respond in JSON-only format.'
            : 'Show this to Claude along with your complete Global Context Document. Claude MUST respond in JSON-only format.'
        }
        promptText={identifyPrompt}
      />

      {/* Step 2 */}
      <StepCard
        step={2}
        label={isTscSession ? 'Step 2 — TSC Surgical Fix' : 'Step 2 — Surgical Line Replacement'}
        instruction={
          isTscSession
            ? 'Show this to Claude with GCD §5 §9 and the files from Step 1. Claude MUST respond in JSON-only format.'
            : 'Show this to Claude along with the files identified in Step 1. Claude MUST respond in JSON-only format.'
        }
        promptText={replacePrompt}
      />
    </div>
  )
}