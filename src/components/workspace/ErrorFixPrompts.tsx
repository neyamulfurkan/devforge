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

export function ErrorFixPrompts({ identifyPrompt, replacePrompt }: ErrorFixPromptsProps): JSX.Element {
  return (
    <div className="space-y-3">
      {/* Section label */}
      <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
        AI Fix Prompts
      </p>

      {/* Step 1 */}
      <StepCard
        step={1}
        label="Step 1 — File Identification"
        instruction="Show this to Claude along with your complete Global Context Document"
        promptText={identifyPrompt}
      />

      {/* Step 2 */}
      <StepCard
        step={2}
        label="Step 2 — Surgical Line Replacement"
        instruction="Show this to Claude along with the files identified in Step 1"
        promptText={replacePrompt}
      />
    </div>
  )
}