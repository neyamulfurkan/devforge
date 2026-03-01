'use client'

// 1. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 2. Internal imports — utils
import { cn } from '@/lib/utils'

// Local types
interface CodeBlockProps {
  code: string
  language?: string
  showCopy?: boolean
  className?: string
}

export function CodeBlock({
  code,
  language,
  showCopy = true,
  className,
}: CodeBlockProps): JSX.Element {
  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden',
        className
      )}
      style={{ background: '#1a1a1a' }}
    >
      {/* Top bar: language label + copy button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        {/* Language label */}
        {language ? (
          <span className="text-xs font-medium text-[var(--text-tertiary)] select-none">
            {language}
          </span>
        ) : (
          <span />
        )}

        {/* Copy button */}
        {showCopy && (
          <CopyButton
            value={code}
            size="sm"
            className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          />
        )}
      </div>

      {/* Code content */}
      <pre
        className="overflow-x-auto p-4 text-sm leading-relaxed"
        style={{ margin: 0 }}
      >
        <code
          className="font-mono text-[var(--text-primary)] whitespace-pre"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
        >
          {code}
        </code>
      </pre>
    </div>
  )
}