'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 3. Third-party library imports
import { Zap, AlertCircle, ArrowRight } from 'lucide-react'

// 4. Internal imports — UI components
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// 5. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 6. Internal imports — hooks, utils
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DescribeProjectStepProps {
  onNext: (description: string, useAI: boolean) => void
  isLoading?: boolean
}

const MIN_WORD_COUNT = 50

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

const PLACEHOLDER = `Describe your project in as much detail as possible. For example:

"I want to build a restaurant management platform for a small chain of 3 restaurants. The platform needs to handle online reservations with table management, a full POS system that integrates with Stripe for payments, real-time kitchen display so staff can see orders instantly, inventory tracking with low-stock alerts sent via email, a customer loyalty program with points and rewards, and an admin panel where managers can view sales reports, staff schedules, and menu management. It should work on tablets for staff use and smartphones for customers making reservations. Staff authentication should use PINs, customer-facing parts should support email sign-up and Google OAuth."`

// ─── Component ───────────────────────────────────────────────────────────────

export function DescribeProjectStep({
  onNext,
  isLoading = false,
}: DescribeProjectStepProps): JSX.Element {
  const [description, setDescription] = useState('')
  const [useAI, setUseAI] = useState(false)

  const { settings } = useSettings()
  const hasGroqKey = Boolean(settings?.groqApiKey)
  const wordCount = countWords(description)
  const canProceed = wordCount >= MIN_WORD_COUNT && !isLoading

  const handleNext = useCallback((): void => {
    if (!canProceed) return
    onNext(description.trim(), useAI && hasGroqKey)
  }, [canProceed, onNext, description, useAI, hasGroqKey])

  return (
    <div className="flex flex-col gap-6">
      {/* Textarea */}
      <div className="relative flex flex-col gap-2">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={10}
          className={cn(
            'min-h-[240px] resize-y bg-[var(--bg-input)] text-sm leading-relaxed',
            'border-[var(--border-default)] text-[var(--text-primary)]',
            'placeholder:text-[var(--text-tertiary)]',
            'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)]',
            'transition-colors duration-150'
          )}
          disabled={isLoading}
          aria-label="Project description"
        />

        {/* Word count */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-xs text-[var(--text-tertiary)]">
            {wordCount < MIN_WORD_COUNT ? (
              <span className="text-[var(--status-in-progress)]">
                {MIN_WORD_COUNT - wordCount} more word{MIN_WORD_COUNT - wordCount !== 1 ? 's' : ''} needed
              </span>
            ) : (
              <span className="text-[var(--status-complete)]">✓ Enough detail</span>
            )}
          </span>
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              wordCount >= MIN_WORD_COUNT
                ? 'text-[var(--status-complete)]'
                : 'text-[var(--text-tertiary)]'
            )}
          >
            {wordCount} words
          </span>
        </div>
      </div>

      {/* AI Enhancement toggle */}
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border p-4 transition-colors duration-150',
          useAI && hasGroqKey
            ? 'border-[var(--accent-border)] bg-[var(--accent-light)]'
            : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)]'
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                useAI && hasGroqKey
                  ? 'bg-[var(--accent-primary)]'
                  : 'bg-[var(--bg-quaternary)]'
              )}
            >
              <Zap
                className={cn(
                  'h-3.5 w-3.5 transition-colors',
                  useAI && hasGroqKey ? 'text-white' : 'text-[var(--text-tertiary)]'
                )}
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <Label
                htmlFor="ai-enhancement"
                className="cursor-pointer text-sm font-medium text-[var(--text-primary)]"
              >
                Enhance with AI (Groq)
              </Label>
              <p className="text-xs text-[var(--text-tertiary)]">
                AI will add technical detail while preserving your intent
              </p>
            </div>
          </div>

          <Switch
            id="ai-enhancement"
            checked={useAI}
            onCheckedChange={setUseAI}
            disabled={isLoading}
            aria-label="Toggle AI enhancement"
          />
        </div>

        {/* Warning if AI toggle on but no key */}
        {useAI && !hasGroqKey && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--status-in-progress)]/30 bg-[var(--status-in-progress-bg)] px-3 py-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-in-progress)]" />
            <p className="text-xs text-[var(--status-in-progress)]">
              Groq API key required. Add it in{' '}
              <a
                href="/settings"
                className="font-medium underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                Settings → AI Integration
              </a>
              . Enhancement will be skipped otherwise.
            </p>
          </div>
        )}
      </div>

      {/* Next button */}
      <div className="flex justify-end">
        <Button
          onClick={handleNext}
          disabled={!canProceed}
          className={cn(
            'gap-2 bg-[var(--accent-primary)] font-medium text-white',
            'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
          )}
        >
          {isLoading ? (
            <>
              <InlineSpinner />
              <span>Enhancing description…</span>
            </>
          ) : (
            <>
              <span>Next: Configure Project</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}