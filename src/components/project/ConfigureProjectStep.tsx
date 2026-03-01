'use client'

// 1. React imports
import { useState, useEffect, KeyboardEvent } from 'react'

// 3. Third-party library imports
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'

// 4. Internal imports — UI components
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// 6. Internal imports — validation, types, utils
import { createProjectSchema, type CreateProjectInput } from '@/validations/project'
import type { ProjectConfig } from '@/types'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConfigureProjectStepProps {
  onNext: (config: ProjectConfig) => void
  onBack: () => void
  description: string
}

const PLATFORM_OPTIONS = [
  { value: 'web_app', label: 'Web App' },
  { value: 'mobile_app', label: 'Mobile App' },
  { value: 'desktop_app', label: 'Desktop App' },
  { value: 'api_backend', label: 'API / Backend' },
  { value: 'game', label: 'Game' },
  { value: 'other', label: 'Other' },
] as const

const MAX_TAGS = 10

// Extract first meaningful line from description for the name default
function extractProjectName(description: string): string {
  const firstLine = (description ?? '').split('\n')[0]?.trim() ?? ''
  // Take first 6 words max
  const words = firstLine.split(/\s+/).slice(0, 6).join(' ')
  return words.length > 60 ? words.slice(0, 60) : words
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConfigureProjectStep({
  onNext,
  onBack,
  description,
}: ConfigureProjectStepProps): JSX.Element {
  const [techStack, setTechStack] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: extractProjectName(description),
      platformType: 'web_app',
      visibility: 'private',
      techStack: [],
      additionalNotes: '',
      description,
    },
  })

  // Keep techStack in form in sync with local state
  useEffect(() => {
    setValue('techStack', techStack)
  }, [techStack, setValue])

  const addTag = (): void => {
    const tag = tagInput.trim()
    if (tag && !techStack.includes(tag) && techStack.length < MAX_TAGS) {
      setTechStack((prev) => [...prev, tag])
      setTagInput('')
    }
  }

  const removeTag = (tag: string): void => {
    setTechStack((prev) => prev.filter((t) => t !== tag))
  }

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && tagInput === '' && techStack.length > 0) {
      setTechStack((prev) => prev.slice(0, -1))
    }
  }

  const onSubmit = (data: CreateProjectInput): void => {
    onNext({
      name: data.name,
      platformType: data.platformType,
      visibility: data.visibility as 'private' | 'public',
      techStack,
      additionalNotes: data.additionalNotes,
    })
  }

  const platformValue = watch('platformType')
  const visibilityValue = watch('visibility')

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Project Name */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="name"
          className="text-sm font-medium text-[var(--text-primary)]"
        >
          Project Name <span className="text-[var(--status-error)]">*</span>
        </Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="My Awesome Project"
          className={cn(
            'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
            'placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]',
            errors.name && 'border-[var(--status-error)] focus:border-[var(--status-error)]'
          )}
        />
        {errors.name && (
          <p className="text-xs text-[var(--status-error)]">{errors.name.message}</p>
        )}
      </div>

      {/* Platform Type */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-[var(--text-primary)]">
          Platform Type
        </Label>
        <Select
          value={platformValue}
          onValueChange={(v) => setValue('platformType', v as CreateProjectInput['platformType'])}
        >
          <SelectTrigger
            className="bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]"
          >
            <SelectValue placeholder="Select platform" />
          </SelectTrigger>
          <SelectContent className="border-[var(--border-default)] bg-[var(--bg-tertiary)]">
            {PLATFORM_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[var(--text-primary)] focus:bg-[var(--bg-quaternary)]"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Visibility */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium text-[var(--text-primary)]">
          Visibility
        </Label>
        <RadioGroup
          value={visibilityValue}
          onValueChange={(v) => setValue('visibility', v as 'private' | 'public')}
          className="flex gap-4"
        >
          {(['private', 'public'] as const).map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem
                value={opt}
                id={`visibility-${opt}`}
                className="border-[var(--border-default)] text-[var(--accent-primary)]"
              />
              <Label
                htmlFor={`visibility-${opt}`}
                className="cursor-pointer text-sm text-[var(--text-secondary)]"
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                {opt === 'public' && (
                  <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">
                    (appears in Project Feed)
                  </span>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Tech Stack Tags */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium text-[var(--text-primary)]">
          Tech Stack{' '}
          <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
        </Label>

        {/* Tag display */}
        {techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {techStack.map((tag) => (
              <Badge
                key={tag}
                className="gap-1 border border-[var(--accent-border)] bg-[var(--accent-light)] pr-1 text-xs font-medium text-[var(--accent-primary)]"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-[var(--accent-primary)]/20 focus-visible:outline-none"
                  aria-label={`Remove ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={addTag}
          placeholder="Type a technology and press Enter (e.g. Next.js, Prisma, Supabase)"
          disabled={techStack.length >= MAX_TAGS}
          className="bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)]"
        />
        <p className="text-xs text-[var(--text-tertiary)]">
          Press Enter or Tab to add · Backspace to remove last · {MAX_TAGS - techStack.length} remaining
        </p>
      </div>

      {/* Additional Notes */}
      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="additionalNotes"
          className="text-sm font-medium text-[var(--text-primary)]"
        >
          Additional Notes{' '}
          <span className="font-normal text-[var(--text-tertiary)]">(optional)</span>
        </Label>
        <Textarea
          id="additionalNotes"
          {...register('additionalNotes')}
          placeholder="Any constraints, preferences, or things to keep in mind..."
          rows={3}
          className="bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] resize-none"
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="gap-2 border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          type="submit"
          className="gap-2 bg-[var(--accent-primary)] font-medium text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
        >
          Next: Generate Document
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  )
}