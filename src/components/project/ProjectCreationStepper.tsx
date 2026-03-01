'use client'

// 3. Third-party library imports
import { Check } from 'lucide-react'

// 6. Internal imports — utils
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Step {
  label: string
  description: string
}

interface ProjectCreationStepperProps {
  currentStep: 1 | 2 | 3
  steps: Step[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectCreationStepper({
  currentStep,
  steps,
}: ProjectCreationStepperProps): JSX.Element {
  return (
    <nav aria-label="Project creation progress">
      <ol className="flex items-start gap-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStep
          const isCurrent = stepNumber === currentStep
          const isLast = index === steps.length - 1

          return (
            <li
              key={step.label}
              className={cn(
                'flex flex-1 items-start',
                isLast ? 'flex-none' : 'flex-1'
              )}
            >
              {/* Step + connector */}
              <div className="flex flex-1 flex-col items-start">
                {/* Circle + connecting line */}
                <div className="flex w-full items-center">
                  {/* Circle */}
                  <div
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-200',
                      isCompleted && [
                        'border-[var(--status-complete)] bg-[var(--status-complete)] text-white',
                      ],
                      isCurrent && [
                        'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white',
                        'shadow-[var(--shadow-glow)]',
                      ],
                      !isCompleted && !isCurrent && [
                        'border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]',
                      ]
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                    ) : (
                      <span>{stepNumber}</span>
                    )}
                  </div>

                  {/* Connecting line (not shown for last step) */}
                  {!isLast && (
                    <div
                      className={cn(
                        'mx-2 h-0.5 flex-1 transition-colors duration-200',
                        isCompleted
                          ? 'bg-[var(--status-complete)]'
                          : 'bg-[var(--border-default)]'
                      )}
                    />
                  )}
                </div>

                {/* Labels — hidden on mobile */}
                <div className="mt-2 hidden flex-col gap-0.5 sm:flex">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isCurrent
                        ? 'text-[var(--text-primary)]'
                        : isCompleted
                        ? 'text-[var(--status-complete)]'
                        : 'text-[var(--text-tertiary)]'
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="max-w-[140px] text-xs text-[var(--text-tertiary)]">
                    {step.description}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}