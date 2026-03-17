'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { Copy, Check } from 'lucide-react'

// 3. Internal imports — UI components
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// 4. Internal imports — utils
import { copyToClipboard } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { COPY_TOOLTIP_DURATION_MS } from '@/lib/constants'

// 5. Local types
interface CopyButtonProps {
  value: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
  successMessage?: string
  'aria-label'?: string
}

// Size variant config
const SIZE_CONFIG = {
  sm: {
    button: 'w-7 h-7',
    icon: 'w-3.5 h-3.5',
  },
  md: {
    button: 'w-8 h-8',
    icon: 'w-4 h-4',
  },
  lg: {
    button: 'w-9 h-9',
    icon: 'w-[18px] h-[18px]',
  },
} as const

export function CopyButton({
  value,
  size = 'md',
  className,
  label,
  successMessage,
  'aria-label': ariaLabel,
}: CopyButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async (): Promise<void> => {
    if (copied) return

    const success = await copyToClipboard(value)
    if (success) {
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, COPY_TOOLTIP_DURATION_MS)
    }
  }, [value, copied])

  const { button, icon } = SIZE_CONFIG[size]

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? (successMessage ?? 'Copied!') : (ariaLabel ?? 'Copy to clipboard')}
            className={cn(
              // Base styles
              'relative inline-flex items-center justify-center rounded-md',
              'text-[var(--text-tertiary)] transition-all duration-150',
              // Hover state
              'hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)]',
              // Focus visible ring
              'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
              'focus-visible:ring-offset-[var(--bg-primary)] outline-none',
              // Active press
              'active:scale-95',
              // Minimum mobile touch target (44x44px)
              'min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0',
              // Copied state
              copied && 'text-[var(--status-complete)]',
              // Size variant
              button,
              className
            )}
          >
            {/* Swap icon with cross-fade */}
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center transition-all duration-150',
                copied ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
              )}
            >
              <Copy className={icon} />
            </span>
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center transition-all duration-150',
                copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              )}
            >
              <Check className={cn(icon, 'text-[var(--status-complete)]')} />
            </span>

            {/* Optional label text */}
            {label && (
              <span className="ml-6 text-[13px] font-medium">{copied ? (successMessage ?? 'Copied!') : label}</span>
            )}
          </button>
        </TooltipTrigger>

        <TooltipContent side="top" className="text-xs">
          {copied ? (successMessage ?? 'Copied!') : (label ? `Copy ${label.replace(/^Copy — /, '')}` : (ariaLabel ?? 'Copy to clipboard'))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default CopyButton