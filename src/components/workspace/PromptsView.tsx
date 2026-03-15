'use client'

// 1. React imports
import { useState, useCallback, useMemo } from 'react'

// 2. Third-party library imports
import { FileText, Search, Check, Minus, BookOpen, ChevronRight, X, Loader2, Copy } from 'lucide-react'
import { toast } from 'sonner'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// 4. Internal imports — shared components
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingSpinner, InlineSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

// 5. Internal imports — workspace components (lazy to avoid circular)
import dynamic from 'next/dynamic'

const MetaPromptCard = dynamic(
  () => import('@/components/workspace/MetaPromptCard').then((m) => m.MetaPromptCard),
  { ssr: false, loading: () => <MetaPromptCardSkeleton /> }
)

const FilePromptPanel = dynamic(
  () => import('@/components/workspace/FilePromptPanel').then((m) => m.FilePromptPanel),
  { ssr: false }
)

// 6. Internal imports — hooks, types, utils
import { useProjectPrompts } from '@/hooks/usePrompts'
import { useFiles } from '@/hooks/useFiles'
import { cn } from '@/lib/utils'
import type { FileWithContent } from '@/types'

// ─── Local types ──────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'has_prompt' | 'no_prompt'

interface PromptsViewProps {
  projectId: string
}

// ─── MetaPromptCard skeleton ─────────────────────────────────────────────────

function MetaPromptCardSkeleton(): JSX.Element {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5 animate-pulse">
      <div className="h-4 w-48 rounded bg-[var(--bg-quaternary)]" />
      <div className="mt-3 h-3 w-full rounded bg-[var(--bg-quaternary)]" />
      <div className="mt-2 h-3 w-3/4 rounded bg-[var(--bg-quaternary)]" />
    </div>
  )
}

// ─── Parse Dialog ─────────────────────────────────────────────────────────────

interface ParseDialogProps {
  open: boolean
  onClose: () => void
  onParse: (raw: string) => Promise<void>
  isParsing: boolean
}

function ParseDialog({ open, onClose, onParse, isParsing }: ParseDialogProps): JSX.Element {
  const [rawOutput, setRawOutput] = useState('')

  const handleParse = useCallback(async () => {
    const trimmed = rawOutput.trim()
    if (!trimmed) return
    await onParse(trimmed)
    setRawOutput('')
  }, [rawOutput, onParse])

  const handleClose = useCallback(() => {
    setRawOutput('')
    onClose()
  }, [onClose])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl bg-[var(--bg-tertiary)] border-[var(--border-default)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)] text-base font-semibold">
            Parse File Prompts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Instructions */}
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">How to use:</span>{' '}
              Copy the meta-prompt above → paste it along with your complete Global Context
              Document into Claude → copy Claude&apos;s entire response → paste it below.
              The platform will automatically extract and store each file&apos;s prompt.
            </p>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Paste Claude&apos;s response here
            </label>
            <textarea
              value={rawOutput}
              onChange={(e) => setRawOutput(e.target.value)}
              placeholder="Paste the full output from Claude containing all file-specific prompts…"
              rows={12}
              className={cn(
                'w-full resize-y rounded-md px-3 py-2.5',
                'bg-[var(--bg-input)] border border-[var(--border-default)]',
                'text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                'font-mono leading-relaxed',
                'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)]',
                'outline-none transition-colors duration-150',
                'min-h-[200px]'
              )}
            />
            <p className="text-xs text-[var(--text-tertiary)]">
              {rawOutput.trim().length > 0
                ? `${rawOutput.trim().length.toLocaleString()} characters pasted`
                : 'Paste Claude\'s output above to begin parsing'}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isParsing}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleParse}
            disabled={rawOutput.trim().length === 0 || isParsing}
            className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          >
            {isParsing ? (
              <>
                <InlineSpinner className="mr-2" />
                Parsing…
              </>
            ) : (
              'Parse & Store'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── File Prompt Row ──────────────────────────────────────────────────────────

interface FilePromptRowProps {
  file: FileWithContent
  hasPrompt: boolean
  isSelected: boolean
  onSelect: (file: FileWithContent) => void
}

function FilePromptRow({
  file,
  hasPrompt,
  isSelected,
  onSelect,
}: FilePromptRowProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(file)}
      className={cn(
        'group w-full flex items-center gap-3 px-4 py-3 text-left',
        'border-b border-[var(--border-subtle)] last:border-0',
        'transition-colors duration-150',
        isSelected
          ? 'bg-[var(--accent-light)] border-l-2 border-l-[var(--accent-primary)]'
          : 'hover:bg-[var(--bg-quaternary)]'
      )}
      aria-pressed={isSelected}
      aria-label={`View prompt for ${file.filePath}`}
    >
      {/* File number */}
      <span className="shrink-0 font-mono text-xs text-[var(--text-tertiary)] w-10 text-right">
        {file.fileNumber}
      </span>

      {/* File path */}
      <span
        className={cn(
          'flex-1 min-w-0 truncate font-mono text-xs',
          isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
        )}
        title={file.filePath}
      >
        {file.filePath}
      </span>

      {/* Has prompt indicator */}
      <span className="shrink-0">
        {hasPrompt ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--status-complete-bg)]">
            <Check className="h-3 w-3 text-[var(--status-complete)]" aria-hidden="true" />
          </span>
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-quaternary)]">
            <Minus className="h-3 w-3 text-[var(--text-tertiary)]" aria-hidden="true" />
          </span>
        )}
      </span>

      {/* Chevron indicator */}
      <ChevronRight
        className={cn(
          'h-4 w-4 shrink-0 transition-transform duration-150',
          isSelected
            ? 'text-[var(--accent-primary)] rotate-90'
            : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
        )}
        aria-hidden="true"
      />
    </button>
  )
}

// ─── PromptsView ──────────────────────────────────────────────────────────────

export function PromptsView({ projectId }: PromptsViewProps): JSX.Element {
  const { prompts, isLoading: promptsLoading, parseAndStore } = useProjectPrompts(projectId)
  const { files, isLoading: filesLoading } = useFiles(projectId)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [selectedFile, setSelectedFile] = useState<FileWithContent | null>(null)
  const [parseDialogOpen, setParseDialogOpen] = useState(false)
  const [isParsing, setIsParsing] = useState(false)

  const isLoading = promptsLoading || filesLoading

  // Build filtered + sorted file list
  const filteredFiles = useMemo(() => {
    if (!files) return []

    return files
      .filter((file) => {
        const matchesSearch =
          searchQuery.trim() === '' ||
          file.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.fileNumber.includes(searchQuery)

        const hasPrompt = Boolean(prompts[file.fileNumber])
        const matchesFilter =
          filterMode === 'all' ||
          (filterMode === 'has_prompt' && hasPrompt) ||
          (filterMode === 'no_prompt' && !hasPrompt)

        return matchesSearch && matchesFilter
      })
      .sort((a, b) => {
        // Sort by numeric file number, then letter suffix
        const numA = parseInt(a.fileNumber, 10)
        const numB = parseInt(b.fileNumber, 10)
        if (numA !== numB) return numA - numB
        return a.fileNumber.localeCompare(b.fileNumber)
      })
  }, [files, searchQuery, filterMode, prompts])

  // Prompt counts for filter labels
  const { totalCount, hasPromptCount, noPromptCount } = useMemo(() => {
    const total = files?.length ?? 0
    const hasP = files?.filter((f) => Boolean(prompts[f.fileNumber])).length ?? 0
    return { totalCount: total, hasPromptCount: hasP, noPromptCount: total - hasP }
  }, [files, prompts])

  const handleParse = useCallback(
    async (rawOutput: string) => {
      setIsParsing(true)
      try {
        const result = await parseAndStore(rawOutput)
        const count = result?.count ?? 0
        toast.success(`${count} file prompt${count !== 1 ? 's' : ''} stored successfully`, {
          description: count === 0 ? 'Try pasting Claude\'s full unmodified response.' : undefined,
        })
        setParseDialogOpen(false)
      } catch {
        toast.error('Failed to parse prompts — check that you pasted Claude\'s full response')
      } finally {
        setIsParsing(false)
      }
    },
    [parseAndStore]
  )

  const handleSelectFile = useCallback((file: FileWithContent) => {
    setSelectedFile((prev) => (prev?.id === file.id ? null : file))
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedFile(null)
  }, [])

  const FILTER_TABS: Array<{ mode: FilterMode; label: string; count: number }> = [
    { mode: 'all', label: 'All', count: totalCount },
    { mode: 'has_prompt', label: 'Has Prompt', count: hasPromptCount },
    { mode: 'no_prompt', label: 'No Prompt', count: noPromptCount },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-0">
      {/* ── Meta Prompt Card (pinned at top) ─────────────────────────── */}
      <div className="shrink-0 p-4 pb-0">
        <MetaPromptCard projectId={projectId} />
      </div>

      {/* ── File Prompts Section ──────────────────────────────────────── */}
      <div className="mt-4 flex flex-1 min-h-0 flex-col px-4 pb-4">
        {/* Section header */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText
              className="h-4 w-4 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              File-Specific Prompts
            </h2>
            <Badge
              className="h-5 px-1.5 text-[10px] bg-[var(--bg-quaternary)] text-[var(--text-secondary)] border-0"
            >
              {hasPromptCount}/{totalCount}
            </Badge>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Copy All Prompts button — only shown when prompts exist */}
            {hasPromptCount > 0 && (
              <Button
                type="button"
                onClick={() => {
                  const allPromptText = filteredFiles
                    .filter((f) => Boolean(prompts[f.fileNumber]))
                    .map((f) => `=== FILE ${f.fileNumber}: ${f.filePath} ===\n\n${prompts[f.fileNumber]}`)
                    .join('\n\n' + '─'.repeat(60) + '\n\n')
                  navigator.clipboard.writeText(allPromptText).then(() => {
                    toast.success(`Copied ${hasPromptCount} prompt${hasPromptCount !== 1 ? 's' : ''} to clipboard`)
                  }).catch(() => {
                    toast.error('Failed to copy to clipboard')
                  })
                }}
                size="sm"
                variant="outline"
                className={cn(
                  'h-8 gap-1.5 text-xs',
                  'border-[var(--border-default)] text-[var(--text-secondary)]',
                  'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]',
                  'active:scale-95 transition-all duration-150'
                )}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy All ({hasPromptCount})
              </Button>
            )}

            <Button
              type="button"
              onClick={() => setParseDialogOpen(true)}
              size="sm"
              className={cn(
                'h-8 gap-1.5 text-xs',
                'bg-[var(--accent-primary)] text-white',
                'hover:bg-[var(--accent-hover)] active:scale-95',
                'transition-all duration-150'
              )}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Parse File Prompts
            </Button>
          </div>
        </div>

        {/* Filters + Search row */}
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1">
            {FILTER_TABS.map(({ mode, label, count }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150',
                  filterMode === mode
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
                aria-pressed={filterMode === mode}
              >
                {label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[10px] leading-none',
                    filterMode === mode
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)]'
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <SearchInput
            onSearch={setSearchQuery}
            placeholder="Search by file path or number…"
            debounceMs={200}
            className="flex-1"
          />
        </div>

        {/* Main content area: table + optional side panel */}
        <div className="flex flex-1 min-h-0 gap-3">
          {/* File list */}
          <div
            className={cn(
              'flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]',
              'overflow-hidden transition-all duration-200',
              selectedFile ? 'w-full lg:w-1/2' : 'flex-1'
            )}
          >
            {/* Table header */}
            <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5">
              <span className="w-10 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                #
              </span>
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                File Path
              </span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                Prompt
              </span>
              <span className="w-4" aria-hidden="true" />
            </div>

            {/* Table body */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <LoadingSpinner size={24} />
                </div>
              ) : filteredFiles.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title={searchQuery ? 'No matching files' : 'No files found'}
                  description={
                    searchQuery
                      ? `No files match "${searchQuery}". Try a different search.`
                      : filterMode === 'has_prompt'
                      ? 'No files have prompts stored yet. Use Parse File Prompts to get started.'
                      : filterMode === 'no_prompt'
                      ? 'All files have prompts stored — great work!'
                      : 'No files found in this project.'
                  }
                />
              ) : (
                filteredFiles.map((file) => (
                  <FilePromptRow
                    key={file.id}
                    file={file}
                    hasPrompt={Boolean(prompts[file.fileNumber])}
                    isSelected={selectedFile?.id === file.id}
                    onSelect={handleSelectFile}
                  />
                ))
              )}
            </div>

            {/* Table footer — result count */}
            {!isLoading && filteredFiles.length > 0 && (
              <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2">
                <p className="text-xs text-[var(--text-tertiary)]">
                  Showing {filteredFiles.length} of {totalCount} file
                  {totalCount !== 1 ? 's' : ''}
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="ml-2 inline-flex items-center gap-0.5 text-[var(--accent-primary)] hover:underline"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Clear search
                    </button>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* File Prompt Panel (right side on lg+, full width on mobile) */}
          {selectedFile && (
            <div className="hidden lg:flex lg:w-1/2 min-h-0">
              <FilePromptPanel
                file={selectedFile}
                projectId={projectId}
                onClose={handleClosePanel}
              />
            </div>
          )}
        </div>

        {/* Mobile: FilePromptPanel rendered below table when file is selected */}
        {selectedFile && (
          <div className="mt-3 flex lg:hidden">
            <FilePromptPanel
              file={selectedFile}
              projectId={projectId}
              onClose={handleClosePanel}
            />
          </div>
        )}
      </div>

      {/* ── Parse Dialog ──────────────────────────────────────────────── */}
      <ParseDialog
        open={parseDialogOpen}
        onClose={() => setParseDialogOpen(false)}
        onParse={handleParse}
        isParsing={isParsing}
      />
    </div>
  )
}

export default PromptsView