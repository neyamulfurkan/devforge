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
import { addErrorSessionSchema, type AddErrorSessionInput } from '@/validations/error'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Local types
interface AddErrorSessionProps {
  projectId: string
  onAdded: () => void
}

type InputMode = 'standard' | 'tsc'

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

  // 8b. External hooks
  const { addSession, addTscSession, parseTscOutput } = useErrors(projectId)

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

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    setInputMode('standard')
    setTscOutput('')
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