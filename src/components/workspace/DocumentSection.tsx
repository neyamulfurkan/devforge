'use client'

// 1. React imports
import { useCallback, useMemo, useState } from 'react'

// 2. Third-party library imports
import { useQueryClient } from '@tanstack/react-query'
import { FileText, Search, Clock, ChevronUp, ChevronDown } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 4. Internal imports — shared components
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { CopyButton } from '@/components/shared/CopyButton'
import { VersionHistoryPanel } from '@/components/shared/VersionHistoryPanel'
import { DocumentSearchOverlay } from '@/components/workspace/DocumentSearchOverlay'

// 5. Internal imports — workspace components
// DocumentSectionItem accepts: section, onUpdate, isSaving?, searchQuery?
import { DocumentSection as DocumentSectionItem } from '@/components/workspace/DocumentSectionHeader'

// 6. Internal imports — hooks
import { useDocument } from '@/hooks/useDocument'

// 7. Internal imports — types + utils
import type { ParsedDocumentSection } from '@/types'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentTabProps {
  projectId: string
  onAddFeature?: () => void
}

// RawDocument type removed — using useDocument hook instead

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRawContentIntoSections(rawContent: string): ParsedDocumentSection[] {
  if (!rawContent.trim()) return []
  const sections: ParsedDocumentSection[] = []
  // Split on lines that look like "## SECTION N" or "# N." or "## N —"
  const sectionRegex = /^## SECTION (\d+(?:\.\d+)*)[\s\u2014\u2013\u2012\-]+(.*)/i
  const lines = rawContent.split('\n')
  let currentSection: ParsedDocumentSection | null = null
  let currentLines: string[] = []

  const flush = () => {
    if (currentSection) {
      currentSection.rawContent = currentLines.join('\n').trim()
      currentSection.wordCount = currentSection.rawContent.split(/\s+/).filter(Boolean).length
      sections.push(currentSection)
    }
  }

  for (const line of lines) {
    const match = line.match(sectionRegex)
    if (match) {
      flush()
      const num = match[1]
      const title = match[2].trim()
      currentSection = {
        sectionNumber: num,
        title,
        rawContent: '',
        wordCount: 0,
        isAppendOnly: ['11', '12', '13'].includes(num),
        subsections: [],
      }
      currentLines = [line]
    } else if (currentSection) {
      currentLines.push(line)
    }
  }
  flush()
  return sections
}

function normaliseSections(raw: unknown): ParsedDocumentSection[] {
  if (Array.isArray(raw)) return raw as ParsedDocumentSection[]
  if (raw !== null && typeof raw === 'object') {
    const vals = Object.values(raw as Record<string, unknown>)
    if (vals.length > 0 && typeof vals[0] === 'object') {
      return vals as ParsedDocumentSection[]
    }
  }
  return []
}

function buildSearchMatches(
  sections: ParsedDocumentSection[],
  query: string
): Set<string> {
  if (!query.trim()) return new Set()
  const lower = query.toLowerCase()
  const matched = new Set<string>()
  for (const s of sections) {
    if (
      s.title.toLowerCase().includes(lower) ||
      s.rawContent.toLowerCase().includes(lower)
    ) {
      matched.add(s.sectionNumber)
    }
    for (const sub of s.subsections ?? []) {
      if (
        sub.title.toLowerCase().includes(lower) ||
        sub.rawContent.toLowerCase().includes(lower)
      ) {
        matched.add(sub.sectionNumber)
      }
    }
  }
  return matched
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DocumentSkeleton(): JSX.Element {
  return (
    <div className="mx-4 my-4 flex flex-col gap-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0"
        >
          <div className="h-4 w-8 rounded bg-[var(--bg-quaternary)]" />
          <div
            className="h-4 rounded bg-[var(--bg-quaternary)]"
            style={{ width: `${30 + (i % 5) * 12}%` }}
          />
          <div className="ml-auto h-3 w-14 rounded bg-[var(--bg-quaternary)]" />
        </div>
      ))}
    </div>
  )
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

interface DocumentTopBarProps {
  rawContent: string
  versionNumber: number | undefined
  updatedAt: string | undefined
  searchActive: boolean
  onSearchToggle: () => void
  onVersionHistory: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
}

function DocumentTopBar({
  rawContent,
  versionNumber,
  updatedAt,
  searchActive,
  onSearchToggle,
  onVersionHistory,
  onExpandAll,
  onCollapseAll,
}: DocumentTopBarProps): JSX.Element {
  const relativeTime = (() => {
    if (!updatedAt) return 'unknown'
    const diff = Date.now() - new Date(updatedAt).getTime()
    if (isNaN(diff)) return 'unknown'
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  })()

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">
          Global Context Document
        </span>
        {versionNumber !== undefined && (
          <span className="hidden sm:inline text-xs text-[var(--text-tertiary)] bg-[var(--bg-quaternary)] border border-[var(--border-subtle)] rounded-full px-2 py-0.5 font-mono whitespace-nowrap">
            v{versionNumber}
          </span>
        )}
        <span className="hidden md:flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
          <Clock className="h-3 w-3" />
          {relativeTime}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCollapseAll}
          aria-label="Collapse all sections"
          className="hidden sm:flex h-8 gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] px-2"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          Collapse all
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onExpandAll}
          aria-label="Expand all sections"
          className="hidden sm:flex h-8 gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] px-2"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Expand all
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSearchToggle}
          aria-label={searchActive ? 'Close search' : 'Search document'}
          className={cn(
            'h-8 w-8 p-0 transition-colors duration-150',
            searchActive
              ? 'text-[var(--accent-primary)] bg-[var(--accent-light)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
          )}
        >
          <Search className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onVersionHistory}
          aria-label="Version history"
          className="h-8 w-8 p-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]"
        >
          <Clock className="h-4 w-4" />
        </Button>
        <CopyButton
          value={rawContent}
          size="sm"
          label="Copy GCD"
          successMessage="GCD copied!"
          showToast
          toastLabel="Global Context Document"
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentSection({ projectId, onAddFeature }: DocumentTabProps): JSX.Element {
  const queryClient = useQueryClient()

  // ── Local state ──────────────────────────────────────────────────────────
  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [versionPanelOpen, setVersionPanelOpen] = useState(false)
  const [expandOverrides, setExpandOverrides] = useState<Record<string, boolean>>({})

  // ── Fetch document via shared hook ───────────────────────────────────────
  const { document: doc, isLoading, updateSection: updateSectionFn, appendToSection } = useDocument(projectId)

  const handleUpdate = useCallback(
    (sectionNumber: string, content: string): void => {
      void updateSectionFn(sectionNumber, content)
    },
    [updateSectionFn]
  )

  // ── Derive sections from rawContent ──────────────────────────────────────
  const sections: ParsedDocumentSection[] = useMemo(() => {
    if (!doc?.rawContent) return []
    const parsed = parseRawContentIntoSections(doc.rawContent)
    const seen = new Map<string, ParsedDocumentSection>()
    for (const s of parsed) {
      seen.set(s.sectionNumber, s)
    }
    return Array.from(seen.values())
  }, [doc?.rawContent])

  const matchedSections = buildSearchMatches(sections, searchQuery)
  const matchedList = Array.from(matchedSections)
  const matchCount = matchedList.length

  // ── Search callbacks ─────────────────────────────────────────────────────
  const handleSearch = useCallback((q: string): void => {
    setSearchQuery(q)
    setCurrentMatchIndex(0)
  }, [])

  const handleSearchToggle = useCallback((): void => {
    setSearchActive((prev) => {
      if (prev) {
        setSearchQuery('')
        setCurrentMatchIndex(0)
      }
      return !prev
    })
  }, [])

  const handleSearchNext = useCallback((): void => {
    setCurrentMatchIndex((i) => (matchCount > 0 ? (i + 1) % matchCount : 0))
  }, [matchCount])

  const handleSearchPrev = useCallback((): void => {
    setCurrentMatchIndex((i) =>
      matchCount > 0 ? (i - 1 + matchCount) % matchCount : 0
    )
  }, [matchCount])

  // ── Expand / collapse all ────────────────────────────────────────────────
  const handleExpandAll = useCallback((): void => {
    const next: Record<string, boolean> = {}
    for (const s of sections) {
      next[s.sectionNumber] = true
      for (const sub of s.subsections ?? []) next[sub.sectionNumber] = true
    }
    setExpandOverrides(next)
  }, [sections])

  const handleCollapseAll = useCallback((): void => {
    const next: Record<string, boolean> = {}
    for (const s of sections) {
      next[s.sectionNumber] = false
      for (const sub of s.subsections ?? []) next[sub.sectionNumber] = false
    }
    setExpandOverrides(next)
  }, [sections])

  // ── Render guards ────────────────────────────────────────────────────────
  if (isLoading) {
    return <DocumentSkeleton />
  }

  if (!doc) {
    return (
      <div className="flex flex-1 items-center justify-center py-16 px-4">
        <EmptyState
          icon={FileText}
          title="No document yet"
          description="Import your Global Context Document from the Overview tab to get started."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <DocumentTopBar
        rawContent={doc.rawContent}
        versionNumber={doc.currentVersion}
        updatedAt={String(doc.updatedAt)}
        searchActive={searchActive}
        onSearchToggle={handleSearchToggle}
        onVersionHistory={() => setVersionPanelOpen(true)}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
      />

      {/* Search overlay */}
      {searchActive && (
        <DocumentSearchOverlay
          onSearch={handleSearch}
          matchCount={matchCount}
          currentMatch={matchCount > 0 ? currentMatchIndex + 1 : 0}
          onNext={handleSearchNext}
          onPrev={handleSearchPrev}
          onClose={handleSearchToggle}
        />
      )}

      {/* Non-blocking background-refetch indicator */}
      {false && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--accent-light)] border-b border-[var(--accent-border)] flex-shrink-0">
          <LoadingSpinner size={12} />
          <span className="text-xs text-[var(--accent-primary)]">Syncing document…</span>
        </div>
      )}

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto">
        {sections.length === 0 ? (
          <div className="flex items-center justify-center py-16 px-4">
            <EmptyState
              icon={FileText}
              title="No sections found"
              description="The document was imported but no sections could be parsed. Try re-importing."
            />
          </div>
        ) : (
          <div className="mx-4 my-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {sections.map((section) => {
              const isMatch = searchQuery
                ? matchedSections.has(section.sectionNumber)
                : false
              const isCurrentMatch =
                searchQuery &&
                matchedList[currentMatchIndex] === section.sectionNumber

              // FIX 2: Do NOT pass isSearchMatch / isCurrentSearchMatch /
              // expandedOverride / onExpandChange to DocumentSectionItem —
              // those props don't exist on its interface. Instead we handle
              // the highlight ring and forced-expand at the wrapper div level,
              // keeping DocumentSectionItem's prop contract intact.
              //
              // The search-forced expand is communicated via the expandOverrides
              // state which we update here when search results change.
              const resolvedExpand: boolean | undefined =
                searchQuery && isMatch
                  ? true
                  : expandOverrides[section.sectionNumber]

              return (
                <div
                  key={section.sectionNumber}
                  className={cn(
                    'transition-colors duration-150',
                    isCurrentMatch &&
                      'ring-2 ring-inset ring-[var(--accent-primary)]',
                    isMatch && !isCurrentMatch && 'bg-[var(--accent-light)]'
                  )}
                >
                  {/*
                    Only pass the props DocumentSectionItem actually accepts.
                    FIX 3: `expanded` (not used here, but kept in mind) — if
                    you add an onExpandChange callback anywhere, annotate the
                    parameter as `(expanded: boolean) => void`.
                  */}
                  <DocumentSectionItem
                    section={section}
                    onUpdate={handleUpdate}
                    isSaving={false}
                    searchQuery={searchQuery}
                    forceExpanded={resolvedExpand}
                    onAppend={
                      section.isAppendOnly
                        ? (text: string) => appendToSection(section.sectionNumber, text)
                        : undefined
                    }
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Version history slide-in panel */}
      {versionPanelOpen && (
        <VersionHistoryPanel
          projectId={projectId}
          open={versionPanelOpen}
          onClose={() => setVersionPanelOpen(false)}
        />
      )}
    </div>
  )
}

export default DocumentSection