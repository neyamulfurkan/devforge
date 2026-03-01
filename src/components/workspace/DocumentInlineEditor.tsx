'use client'

// 1. React imports
import { useState, useRef, useCallback } from 'react'

// 2. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 3. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentInlineEditorProps {
  initialContent: string
  onSave: (content: string) => void
  onCancel: () => void
  isSaving?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentInlineEditor({
  initialContent,
  onSave,
  onCancel,
  isSaving = false,
}: DocumentInlineEditorProps): JSX.Element {
  const [content, setContent] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to content height
  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
  }, [])

  // CRITICAL: Only saves on explicit button click — NO auto-save (Section 5.11)
  const handleSave = useCallback(() => {
    if (!isSaving) {
      onSave(content)
    }
  }, [content, isSaving, onSave])

  return (
    <div className="flex flex-col gap-3 p-3">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onInput={handleInput}
        disabled={isSaving}
        aria-label="Section content editor"
        className="w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 font-mono text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)] focus-visible:outline-none transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ minHeight: '200px' }}
      />

      {/* Buttons row — right-aligned */}
      <div className="flex items-center justify-end gap-2 mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] hover:bg-[var(--bg-quaternary)]"
        >
          Cancel
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <InlineSpinner />
              Saving…
            </span>
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </div>
  )
}

export default DocumentInlineEditor