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

// 5. Local types
interface AddErrorSessionProps {
  projectId: string
  onAdded: () => void
}

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

  // 8b. External hooks
  const { addSession } = useErrors(projectId)

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
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 space-y-4">
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Error type select */}
        <div className="space-y-1.5">
          <label
            htmlFor="errorType"
            className="text-xs font-medium text-[var(--text-secondary)] block"
          >
            Error Type
          </label>
          <select
            id="errorType"
            {...register('errorType')}
            className={cn(
              'w-full h-10 rounded-md border bg-[var(--bg-input)] text-[var(--text-primary)]',
              'text-sm px-3',
              'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
              'focus:ring-1 focus:ring-[var(--accent-light)] outline-none',
              'transition-colors duration-150 cursor-pointer',
              // Custom select arrow
              'appearance-none',
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
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.errorType && (
            <p className="text-xs text-[var(--status-error)]">{errors.errorType.message}</p>
          )}
        </div>

        {/* Error output textarea */}
        <div className="space-y-1.5">
          <label
            htmlFor="errorOutput"
            className="text-xs font-medium text-[var(--text-secondary)] block"
          >
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
              'transition-colors duration-150 resize-y p-3',
              'min-h-[160px]',
              errors.errorOutput && 'border-[var(--status-error)]'
            )}
            placeholder={`TypeError: Cannot read properties of undefined (reading 'map')
    at DocumentSection (src/components/workspace/DocumentSection.tsx:42:18)
    at renderWithHooks (react-dom.development.js:14985:18)
    ...`}
          />
          <div className="flex items-center justify-between">
            {errors.errorOutput ? (
              <p className="text-xs text-[var(--status-error)]">{errors.errorOutput.message}</p>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">
                {errorOutput.length} characters
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-9 text-sm"
          >
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
                {/* Inline spinner */}
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Generating Prompts…
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Generate Fix Prompts
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}