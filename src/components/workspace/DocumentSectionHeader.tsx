'use client'

// 1. React imports
import { useState, useCallback, useEffect } from 'react'

// 2. Third-party library imports
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react'

// 3. Internal imports — workspace components
import { DocumentInlineEditor } from '@/components/workspace/DocumentInlineEditor'

// 4. Internal imports — shared components
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'

// 5. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 6. Internal imports — types
import type { ParsedDocumentSection } from '@/types'

// 7. Internal imports — utils
import { cn } from '@/lib/utils'
// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentSectionProps {
  section: ParsedDocumentSection
  onUpdate: (sectionNumber: string, content: string) => void
  searchQuery?: string
  /** Called when user clicks Append on section 11, 12, or 13 — receives the text to append */
  onAppend?: (text: string) => void | Promise<void>
  /** Whether a save is in-flight for this section */
  isSaving?: boolean
  /** Force the section open (true) or closed (false); undefined = use internal state */
  forceExpanded?: boolean
}

// ─── Highlight helper ─────────────────────────────────────────────────────────
// Injects <mark class="mark-highlight"> around query occurrences in rendered html
function highlightQuery(html: string, query: string): string {
  if (!query.trim()) return html
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return html.replace(regex, '<mark class="mark-highlight">$1</mark>')
}

// ─── Header row ───────────────────────────────────────────────────────────────

interface SectionHeaderRowProps {
  section: ParsedDocumentSection
  isExpanded: boolean
  onToggle: () => void
  onEdit: () => void
  onAppend?: (text: string) => void | Promise<void>
  wordCount: number
}

function DocumentSectionHeader({
  section,
  isExpanded,
  onToggle,
  onEdit,
  onAppend,
  wordCount,
}: SectionHeaderRowProps): JSX.Element {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggle()}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-tertiary)]" />
        )}
        <span className="text-xs font-mono text-[var(--text-tertiary)] flex-shrink-0">
          §{section.sectionNumber}
        </span>
        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {section.title}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        <span className="text-xs text-[var(--text-tertiary)]">{wordCount}w</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>
    </div>
  )
}

// ─── JSON Registry Renderer (Section 11) ─────────────────────────────────────

function parseJsonBlocks(content: string): Array<{ fileNumber: string; raw: string; parsed: Record<string, unknown> | null }> {
  const blocks: Array<{ fileNumber: string; raw: string; parsed: Record<string, unknown> | null }> = []
  // Match ALL NNN. { ... } blocks — greedy multiline
  const pattern = /^(\d{3}[a-z]?)\.\s*(\{[\s\S]*?\n\})/gm
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    const fileNumber = match[1]
    const raw = match[2]
    let parsed: Record<string, unknown> | null = null
    try { parsed = JSON.parse(raw) } catch { /* skip */ }
    blocks.push({ fileNumber, raw, parsed })
  }
  return blocks
}

function JsonRegistryCard({ entry, searchQuery }: { entry: { fileNumber: string; raw: string; parsed: Record<string, unknown> | null }; searchQuery?: string }): JSX.Element {
  const [open, setOpen] = useState(false)
  const { parsed, fileNumber, raw } = entry
  const fileName = parsed ? String(parsed['file'] ?? '') : ''
  const status = parsed ? String(parsed['status'] ?? '') : ''
  const exports = parsed && Array.isArray(parsed['exports']) ? (parsed['exports'] as string[]) : []
  const isMatch = searchQuery?.trim()
    ? (fileName.toLowerCase().includes(searchQuery.toLowerCase()) || raw.toLowerCase().includes(searchQuery.toLowerCase()))
    : false

  return (
    <div className={cn(
      'rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] mb-2 overflow-hidden',
      isMatch && 'ring-1 ring-[var(--accent-primary)]'
    )}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--bg-quaternary)] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-[var(--text-tertiary)]" /> : <ChevronRight className="h-3 w-3 flex-shrink-0 text-[var(--text-tertiary)]" />}
        <span className="font-mono text-xs text-[var(--text-tertiary)] flex-shrink-0">{fileNumber}.</span>
        <span className="text-xs font-medium text-[var(--text-primary)] truncate flex-1">{fileName || raw.slice(0, 60)}</span>
        {status && (
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 font-mono',
            status === 'COMPLETE' ? 'text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20' :
            status === 'IN_PROGRESS' ? 'text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20' :
            'text-[var(--text-tertiary)] border-[var(--border-subtle)] bg-[var(--bg-quaternary)]'
          )}>{status}</span>
        )}
        {exports.length > 0 && (
          <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">{exports.length} export{exports.length !== 1 ? 's' : ''}</span>
        )}
        <CopyButton value={raw} size="sm" />
      </div>
      {open && (
        <div className="px-3 pb-3 border-t border-[var(--border-subtle)]">
          <pre className="mt-2 text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-all leading-relaxed">{raw}</pre>
        </div>
      )}
    </div>
  )
}

function JsonRegistryRenderer({ content, searchQuery }: { content: string; searchQuery?: string }): JSX.Element {
  const blocks = parseJsonBlocks(content)
  if (blocks.length === 0) {
    return <MarkdownRenderer content={content} enableCopyPerElement />
  }
  return (
    <div>
      <div className="text-xs text-[var(--text-tertiary)] mb-2">{blocks.length} entries</div>
      {blocks.map((entry) => (
        <JsonRegistryCard key={entry.fileNumber} entry={entry} searchQuery={searchQuery} />
      ))}
    </div>
  )
}

// ─── Inline Append Panel ──────────────────────────────────────────────────────

interface InlineAppendPanelProps {
  onAppend: (text: string) => void
  isAppending: boolean
}

function InlineAppendPanel({ onAppend, isAppending }: InlineAppendPanelProps): JSX.Element {
  const [text, setText] = useState('')
  return (
    <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      <p className="text-xs text-[var(--text-tertiary)] mb-2">Paste content to append to this section:</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste here…"
        rows={5}
        className="w-full resize-y rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-colors"
      />
      <div className="flex justify-end mt-2">
        <button
          type="button"
          disabled={!text.trim() || isAppending}
          onClick={() => { onAppend(text); setText('') }}
          className="px-3 py-1.5 rounded text-xs font-medium bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAppending ? 'Appending…' : 'Add'}
        </button>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentSection({
  section,
  onUpdate,
  searchQuery,
  onAppend,
  isSaving = false,
  forceExpanded,
}: DocumentSectionProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const effectiveExpanded = forceExpanded !== undefined ? forceExpanded : isExpanded
  const [isEditing, setIsEditing] = useState(false)
  const [isAppending, setIsAppending] = useState(false)

  // Collapse editor when isSaving finishes (isSaving goes false)
  useEffect(() => {
    if (!isSaving && isEditing) {
      // Keep editing open — parent controls close via onSave callback
    }
  }, [isSaving, isEditing])

  // Auto-expand when there's a search match
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length > 0) {
      const matches = section.rawContent
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      if (matches) setIsExpanded(true)
    }
  }, [searchQuery, section.rawContent])

  const handleToggle = useCallback(() => {
    if (!isEditing) setIsExpanded((v) => !v)
  }, [isEditing])

  const handleEdit = useCallback(() => {
    setIsExpanded(true)
    setIsEditing(true)
  }, [])

  // Strip the header line from rawContent so the editor only shows body
  const editableContent = section.rawContent
    .split('\n')
    .slice(1)
    .join('\n')
    .trimStart()

  const handleSave = useCallback(
    (content: string) => {
      onUpdate(section.sectionNumber, content)
      setIsEditing(false)
    },
    [onUpdate, section.sectionNumber]
  )

  const handleCancel = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleInlineAppend = useCallback(async (text: string) => {
    if (!onAppend) return
    // Strip any leading section header line the user may have accidentally included
    const stripped = text
      .replace(/^#{0,3}\s*(?:SECTION\s+)?\d+(?:\.\d+)?\s*[—–\-]+\s*.+\n?/i, '')
      .trimStart()
    if (!stripped) return
    setIsAppending(true)
    try {
      await onAppend(stripped)
    } finally {
      setIsAppending(false)
    }
  }, [onAppend])

  // Determine append button visibility — sections 11, 12, 13 are append-only
  const showAppend = section.isAppendOnly && !!onAppend

  // Rendered content with optional search highlight
  const isSection11 = section.sectionNumber === '11'
  const renderedContent = searchQuery?.trim()
      ? highlightQuery(section.rawContent, searchQuery)
      : section.rawContent

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      {/* ── Header (always visible) ──────────────────────────────────── */}
      <DocumentSectionHeader
        section={section}
        isExpanded={effectiveExpanded}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onAppend={showAppend ? onAppend : undefined}
        wordCount={section.wordCount}
      />

      {/* ── Collapsible body ──────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {effectiveExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {isEditing ? (
              /* ── Inline editor ──────────────────────────────────────── */
              <DocumentInlineEditor
                initialContent={editableContent}
                onSave={handleSave}
                onCancel={handleCancel}
                isSaving={isSaving}
              />
            ) : (
              /* ── Read-only rendered markdown ────────────────────────── */
              <>
                <div className="px-4 py-3">
                  {isSection11 ? (
                    <JsonRegistryRenderer
                      content={section.rawContent}
                      searchQuery={searchQuery}
                    />
                  ) : searchQuery?.trim() ? (
                    <div
                      className="markdown-body text-sm"
                      dangerouslySetInnerHTML={{ __html: renderedContent }}
                    />
                  ) : (
                    <MarkdownRenderer
                      content={section.rawContent}
                      enableCopyPerElement
                    />
                  )}
                </div>
                {/* ── Inline append panel for sections 11, 12, 13 ── */}
                {showAppend && (
                  <InlineAppendPanel
                    onAppend={handleInlineAppend}
                    isAppending={isAppending}
                  />
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DocumentSection