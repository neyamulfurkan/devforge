'use client'

// 1. React imports
import { useEffect } from 'react'

// 2. Third-party library imports
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

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
import { Label } from '@/components/ui/label'

// 4. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 5. Internal imports — hooks, validations, constants, utils
import { useLibrary } from '@/hooks/useLibrary'
import { createLibraryPromptSchema, type CreateLibraryPromptInput } from '@/validations/prompt'
import { AI_TOOLS, PROMPT_CATEGORIES } from '@/lib/constants'
import { cn } from '@/lib/utils'

// 6. Local types
interface SubmitPromptModalProps {
  open: boolean
  onClose: () => void
}

// 7. Component
export function SubmitPromptModal({ open, onClose }: SubmitPromptModalProps): JSX.Element {
  const { submitPrompt } = useLibrary()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateLibraryPromptInput>({
    resolver: zodResolver(createLibraryPromptSchema),
    defaultValues: {
      makePublic: true,
    },
  })

  const makePublic = watch('makePublic')

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  const onSubmit = async (data: CreateLibraryPromptInput): Promise<void> => {
    try {
      await submitPrompt(data)
      toast.success('Prompt submitted to the library!')
      reset()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit prompt'
      toast.error(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className={cn(
          'max-w-lg border-[var(--border-default)] bg-[var(--bg-tertiary)]',
          'text-[var(--text-primary)]'
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">Submit a Prompt</DialogTitle>
        </DialogHeader>

        {/* Form — no <form> tag per artifact rule; use onSubmit on button */}
        <div className="flex flex-col gap-4 py-2">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title" className="text-sm text-[var(--text-secondary)]">
              Title <span className="text-[var(--status-error)]">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g. Code Review Assistant"
              {...register('title')}
              className={cn(
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]',
                errors.title && 'border-[var(--status-error)]'
              )}
            />
            {errors.title && (
              <p className="text-xs text-[var(--status-error)]">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description" className="text-sm text-[var(--text-secondary)]">
              Description <span className="text-[var(--status-error)]">*</span>
            </Label>
            <Input
              id="description"
              placeholder="Briefly describe what this prompt does (2–3 sentences)"
              {...register('description')}
              className={cn(
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]',
                errors.description && 'border-[var(--status-error)]'
              )}
            />
            {errors.description && (
              <p className="text-xs text-[var(--status-error)]">{errors.description.message}</p>
            )}
          </div>

          {/* AI Tool + Category — side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* AI Tool */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aiTool" className="text-sm text-[var(--text-secondary)]">
                AI Tool <span className="text-[var(--status-error)]">*</span>
              </Label>
              <select
                id="aiTool"
                {...register('aiTool')}
                className={cn(
                  'h-10 w-full rounded-md border px-3 py-2 text-sm',
                  'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
                  'focus:ring-offset-2 focus:ring-offset-[var(--bg-tertiary)]',
                  'transition-colors duration-150 appearance-none',
                  errors.aiTool && 'border-[var(--status-error)]'
                )}
              >
                <option value="" className="bg-[var(--bg-secondary)]">Select tool</option>
                {AI_TOOLS.map((tool) => (
                  <option key={tool.value} value={tool.value} className="bg-[var(--bg-secondary)]">
                    {tool.label}
                  </option>
                ))}
              </select>
              {errors.aiTool && (
                <p className="text-xs text-[var(--status-error)]">{errors.aiTool.message}</p>
              )}
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category" className="text-sm text-[var(--text-secondary)]">
                Category <span className="text-[var(--status-error)]">*</span>
              </Label>
              <select
                id="category"
                {...register('category')}
                className={cn(
                  'h-10 w-full rounded-md border px-3 py-2 text-sm',
                  'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
                  'focus:ring-offset-2 focus:ring-offset-[var(--bg-tertiary)]',
                  'transition-colors duration-150 appearance-none',
                  errors.category && 'border-[var(--status-error)]'
                )}
              >
                <option value="" className="bg-[var(--bg-secondary)]">Select category</option>
                {PROMPT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-[var(--bg-secondary)]">
                    {cat.label}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-[var(--status-error)]">{errors.category.message}</p>
              )}
            </div>
          </div>

          {/* Prompt Text */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promptText" className="text-sm text-[var(--text-secondary)]">
              Prompt Text <span className="text-[var(--status-error)]">*</span>
            </Label>
            <textarea
              id="promptText"
              placeholder="Paste your full prompt here..."
              rows={6}
              {...register('promptText')}
              className={cn(
                'w-full min-h-[150px] rounded-md border px-3 py-2 text-sm',
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)] resize-y',
                'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
                'focus:ring-offset-2 focus:ring-offset-[var(--bg-tertiary)]',
                'font-mono leading-relaxed transition-colors duration-150',
                errors.promptText && 'border-[var(--status-error)]'
              )}
            />
            {errors.promptText && (
              <p className="text-xs text-[var(--status-error)]">{errors.promptText.message}</p>
            )}
          </div>

          {/* Make Public toggle */}
          <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Make Public</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Visible in the community library for everyone
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={makePublic}
              onClick={() => setValue('makePublic', !makePublic)}
              className={cn(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
                'transition-colors duration-200 ease-in-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]',
                makePublic ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-emphasis)]'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow',
                  'transform transition duration-200 ease-in-out',
                  makePublic ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
            className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150 min-w-[110px]"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <InlineSpinner /> Submitting…
              </span>
            ) : (
              'Submit Prompt'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SubmitPromptModal