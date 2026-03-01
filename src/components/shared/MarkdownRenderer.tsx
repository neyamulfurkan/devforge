'use client'

// 1. React imports
import type { ReactNode } from 'react'

// 2. Third-party library imports
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'

// 3. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { CodeBlock } from '@/components/shared/CodeBlock'

// 4. Internal imports — utils
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string
  className?: string
  enableCopyPerElement?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in (node as object)) {
    return extractText((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

function CopyableWrapper({
  children,
  value,
}: {
  children: ReactNode
  value: string
}): JSX.Element {
  return (
    <div className="group/copyable relative">
      {children}
      <span className="absolute right-0 top-0 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover/copyable:opacity-100">
        <CopyButton value={value} size="sm" />
      </span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MarkdownRenderer({
  content,
  className,
  enableCopyPerElement = false,
}: MarkdownRendererProps): JSX.Element {

  const components: Components = {
    h1: ({ children }) => (
      <h1 className="mb-4 mt-6 text-2xl font-bold text-[var(--text-primary)] first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-3 mt-5 text-xl font-semibold text-[var(--text-primary)] first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-4 text-base font-semibold text-[var(--text-primary)] first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-2 mt-3 text-sm font-semibold text-[var(--text-primary)] first:mt-0">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="mb-1 mt-2 text-sm font-medium text-[var(--text-primary)]">{children}</h5>
    ),
    h6: ({ children }) => (
      <h6 className="mb-1 mt-2 text-xs font-medium text-[var(--text-secondary)]">{children}</h6>
    ),

    p: ({ children }) => {
      const text = extractText(children)
      const el = (
        <p className="mb-3 text-sm leading-relaxed text-[var(--text-secondary)] last:mb-0">
          {children}
        </p>
      )
      if (enableCopyPerElement && text.trim().length > 0) {
        return <CopyableWrapper value={text}>{el}</CopyableWrapper>
      }
      return el
    },

    code: ({ children, className: codeClass, ...props }) => {
      const isInline = !codeClass?.startsWith('language-')
      if (isInline) {
        return (
          <code
            className="rounded bg-[var(--accent-light)] px-1.5 py-0.5 font-mono text-xs font-medium text-[var(--accent-primary)]"
            {...props}
          >
            {children}
          </code>
        )
      }
      const language = codeClass?.replace('language-', '') ?? 'text'
      const codeText = extractText(children)
      return <CodeBlock code={codeText} language={language} showCopy />
    },

    pre: ({ children }) => <div className="my-3">{children}</div>,

    ul: ({ children }) => (
      <ul className="mb-3 ml-5 list-disc space-y-1 text-sm text-[var(--text-secondary)]">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm text-[var(--text-secondary)]">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,

    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-2 border-[var(--accent-border)] pl-4 text-sm italic text-[var(--text-secondary)]">
        {children}
      </blockquote>
    ),

    hr: () => <hr className="my-4 border-[var(--border-subtle)]" />,

    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent-primary)] underline underline-offset-2 hover:text-[var(--accent-hover)] transition-colors duration-150"
      >
        {children}
      </a>
    ),

    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-[var(--text-secondary)]">{children}</em>
    ),

    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-[var(--border-default)]">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-[var(--border-subtle)]">{children}</tbody>
    ),
    tr: ({ children }) => <tr className="hover:bg-[var(--bg-quaternary)]">{children}</tr>,
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)]">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{children}</td>
    ),
  }

  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer