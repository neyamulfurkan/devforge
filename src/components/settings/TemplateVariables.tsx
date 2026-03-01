'use client'

// 1. Internal imports — UI components
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

// 2. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 3. Internal imports — constants, utils, types
import { TEMPLATE_VARIABLES, type DefaultTemplateKey } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { TemplateVariable } from '@/types'

// 4. Local types
interface TemplateVariablesProps {
  templateKey: string
}

// 5. Component definition
export function TemplateVariables({ templateKey }: TemplateVariablesProps): JSX.Element {
  const variables = (TEMPLATE_VARIABLES[templateKey as DefaultTemplateKey] ?? []) as TemplateVariable[]

  if (variables.length === 0) {
    return (
      <div className="flex items-center justify-center px-4 py-8">
        <p className="text-sm text-[var(--text-tertiary)] text-center">
          No variables available for this template.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 flex flex-col gap-4">
        {variables.map((variable) => {
          const placeholder = `{{${variable.name}}}`

          return (
            <div
              key={variable.name}
              className={cn(
                'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3',
                'transition-colors duration-150 hover:border-[var(--border-default)]'
              )}
            >
              {/* Variable name row */}
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono text-xs px-2 py-0.5 shrink-0',
                    'border-[var(--accent-border)] bg-[var(--accent-light)]',
                    'text-[var(--accent-primary)]'
                  )}
                >
                  {placeholder}
                </Badge>
                <CopyButton
                  value={placeholder}
                  size="sm"
                  aria-label={`Copy ${placeholder}`}
                />
              </div>

              {/* Description */}
              <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                {variable.description}
              </p>

              {/* Example value */}
              {variable.example && (
                <div className="mt-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    Example
                  </span>
                  <p
                    className={cn(
                      'mt-0.5 text-xs font-mono leading-relaxed text-[var(--text-tertiary)]',
                      'bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]',
                      'rounded px-2 py-1 line-clamp-2'
                    )}
                  >
                    {variable.example}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

export default TemplateVariables