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
import { useCollections } from '@/hooks/useCollections'
import {
  createCollectionPromptSchema,
  type CreateCollectionPromptInput,
} from '@/validations/prompt'
import { AI_TOOLS, PROMPT_CATEGORIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CollectionPrompt } from '@/types'

// 6. Local types
interface AddEditPromptModalProps {
  open: boolean
  onClose: () => void
  collectionId: string
  editingPrompt?: CollectionPrompt | null
}

// 7. Component
export function AddEditPromptModal({
  open,
  onClose,
  collectionId,
  editingPrompt,
}: AddEditPromptModalProps): JSX.Element {
  const isEditing = editingPrompt != null

  const { createPrompt, updatePrompt } = useCollections()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCollectionPromptInput>({
    resolver: zodResolver(createCollectionPromptSchema),
    defaultValues: {
      title: '',
      promptText: '',
      aiTool: '',
      category: '',
      notes: '',
      visibility: 'PRIVATE',
    },
  })

  // Pre-fill form when editing, reset when creating or closing
  useEffect(() => {
    if (open) {
      if (editingPrompt) {
        reset({
          title: editingPrompt.title,
          promptText: editingPrompt.promptText,
          aiTool: editingPrompt.aiTool ?? '',
          category: editingPrompt.category ?? '',
          notes: editingPrompt.notes ?? '',
          visibility: editingPrompt.visibility,
        })
      } else {
        reset({
          title: '',
          promptText: '',
          aiTool: '',
          category: '',
          notes: '',
          visibility: 'PRIVATE',
        })
      }
    }
  }, [open, editingPrompt, reset])

  const onSubmit = async (data: CreateCollectionPromptInput): Promise<void> => {
    try {
      // Strip empty optional strings to undefined so API doesn't store blank values
      const payload = {
        ...data,
        aiTool: data.aiTool?.trim() || undefined,
        category: data.category?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
      }

      if (isEditing) {
        await updatePrompt(collectionId, editingPrompt.id, payload)
        toast.success('Prompt updated')
      } else {
        await createPrompt(collectionId, payload)
        toast.success('Prompt added to collection')
      }

      reset()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
    }
  }

  // Shared input className
  const inputCn = (hasError: boolean): string =>
    cn(
      'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
      'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]',
      hasError && 'border-[var(--status-error)]'
    )

  const selectCn = (hasError: boolean): string =>
    cn(
      'h-10 w-full rounded-md border px-3 py-2 text-sm appearance-none',
      'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
      'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
      'focus:ring-offset-2 focus:ring-offset-[var(--bg-tertiary)]',
      'transition-colors duration-150',
      hasError && 'border-[var(--status-error)]'
    )

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className={cn(
          'max-w-lg border-[var(--border-default)] bg-[var(--bg-tertiary)]',
          'text-[var(--text-primary)]'
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">
            {isEditing ? 'Edit Prompt' : 'Add Prompt'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt-title" className="text-sm text-[var(--text-secondary)]">
              Title <span className="text-[var(--status-error)]">*</span>
            </Label>
            <Input
              id="prompt-title"
              placeholder="e.g. Refactor TypeScript component"
              {...register('title')}
              className={inputCn(!!errors.title)}
            />
            {errors.title && (
              <p className="text-xs text-[var(--status-error)]">{errors.title.message}</p>
            )}
          </div>

          {/* AI Tool + Category — side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* AI Tool */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-ai-tool" className="text-sm text-[var(--text-secondary)]">
                AI Tool <span className="text-xs text-[var(--text-tertiary)]">(optional)</span>
              </Label>
              <select
                id="prompt-ai-tool"
                {...register('aiTool')}
                className={selectCn(false)}
              >
                <option value="" className="bg-[var(--bg-secondary)]">Any</option>
                {AI_TOOLS.map((tool) => (
                  <option key={tool.value} value={tool.value} className="bg-[var(--bg-secondary)]">
                    {tool.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prompt-category" className="text-sm text-[var(--text-secondary)]">
                Category <span className="text-xs text-[var(--text-tertiary)]">(optional)</span>
              </Label>
              <select
                id="prompt-category"
                {...register('category')}
                className={selectCn(false)}
              >
                <option value="" className="bg-[var(--bg-secondary)]">None</option>
                {PROMPT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-[var(--bg-secondary)]">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Prompt Text */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt-text" className="text-sm text-[var(--text-secondary)]">
              Prompt Text <span className="text-[var(--status-error)]">*</span>
            </Label>
            <textarea
              id="prompt-text"
              placeholder="Paste or write your full prompt here..."
              rows={7}
              {...register('promptText')}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-sm resize-y min-h-[140px]',
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)]',
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

          {/* Notes — private, never shown publicly */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt-notes" className="text-sm text-[var(--text-secondary)]">
              Private notes{' '}
              <span className="text-xs text-[var(--text-tertiary)]">— never shown publicly</span>
            </Label>
            <textarea
              id="prompt-notes"
              placeholder="Personal context, usage tips, variations to try..."
              rows={2}
              {...register('notes')}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-sm resize-y',
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
                'focus:ring-offset-2 focus:ring-offset-[var(--bg-tertiary)]',
                'leading-relaxed transition-colors duration-150'
              )}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-1">
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
            className={cn(
              'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]',
              'active:scale-95 transition-all duration-150 min-w-[100px]'
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <InlineSpinner />
                {isEditing ? 'Saving…' : 'Adding…'}
              </span>
            ) : (
              isEditing ? 'Save Changes' : 'Add Prompt'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddEditPromptModal