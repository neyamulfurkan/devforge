'use client'

// 1. React imports
import { useState, useMemo, useCallback } from 'react'

// 2. Third-party library imports
import { ChevronDown, ChevronRight, Terminal, Package, Copy } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// 4. Internal imports — shared components
import { SearchInput } from '@/components/shared/SearchInput'

// 5. Internal imports — workspace components
import { FileRow } from '@/components/workspace/FileRow'
import { TerminalScriptModal } from '@/components/workspace/TerminalScriptModal'

// 6. Internal imports — hooks, types, utils
import { useFiles } from '@/hooks/useFiles'
import { useDocument } from '@/hooks/useDocument'
import type { FileWithContent, ExtractedFile } from '@/types'
import { cn, calculateProgress } from '@/lib/utils'
import { PHASE_NAMES } from '@/lib/constants'
import { generateNpmInstallCommand } from '@/services/scriptGenerator'

// Local types
interface FileSequenceTableProps {
  projectId: string
  onOpenInEditor: (fileId: string) => void
}

type FilterChip = 'all' | 'incomplete' | 'complete' | 'error' | 'nocode'

interface FilterConfig {
  label: string
  value: FilterChip
}

const FILTER_CHIPS: FilterConfig[] = [
  { label: 'All', value: 'all' },
  { label: 'Incomplete', value: 'incomplete' },
  { label: 'Complete', value: 'complete' },
  { label: 'Error', value: 'error' },
  { label: 'No Code', value: 'nocode' },
]

function matchesFilter(file: FileWithContent, filter: FilterChip): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'incomplete':
      return file.status !== 'COMPLETE'
    case 'complete':
      return file.status === 'COMPLETE'
    case 'error':
      return file.status === 'ERROR'
    case 'nocode':
      return file.status === 'EMPTY'
    default:
      return true
  }
}

export function FileSequenceTable({
  projectId,
  onOpenInEditor,
}: FileSequenceTableProps): JSX.Element {
  const { files, isLoading } = useFiles(projectId)
  const { document: doc } = useDocument(projectId)

  const [activeFilter, setActiveFilter] = useState<FilterChip>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set([1, 2, 3]))
  const [scriptModalOpen, setScriptModalOpen] = useState(false)
  const [gcdCopied, setGcdCopied] = useState(false)
  const [gcdFspCopied, setGcdFspCopied] = useState(false)
  // Filter + search files
  const filteredFiles = useMemo((): FileWithContent[] => {
    return files.filter((f) => {
      if (!matchesFilter(f, activeFilter)) return false
      if (
        searchQuery &&
        !f.filePath.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [files, activeFilter, searchQuery])

  // Group filtered files by phase
  const phaseGroups = useMemo(() => {
    const groups = new Map<number, FileWithContent[]>()
    for (const file of filteredFiles) {
      const arr = groups.get(file.phase) ?? []
      arr.push(file)
      groups.set(file.phase, arr)
    }
    // Sort phases numerically
    return Array.from(groups.entries()).sort(([a], [b]) => a - b)
  }, [filteredFiles])

  // Overall progress stats
  const totalFiles = files.length
  const completedFiles = files.filter((f) => f.status === 'COMPLETE').length
  const progressPct = calculateProgress(completedFiles, totalFiles)

  // Phase progress helper (from all files, not filtered)
  const getPhaseStats = useCallback(
    (phaseNum: number): { total: number; completed: number } => {
      const phaseFiles = files.filter((f) => f.phase === phaseNum)
      return {
        total: phaseFiles.length,
        completed: phaseFiles.filter((f) => f.status === 'COMPLETE').length,
      }
    },
    [files]
  )

  const togglePhase = useCallback((phaseNum: number): void => {
    setExpandedPhases((prev) => {
      const next = new Set(prev)
      if (next.has(phaseNum)) {
        next.delete(phaseNum)
      } else {
        next.add(phaseNum)
      }
      return next
    })
  }, [])

  // Convert FileWithContent to ExtractedFile for script generator
 const extractedFiles: ExtractedFile[] = useMemo(
    () =>
      files.map((f) => ({
        fileNumber: f.fileNumber,
        filePath: f.filePath,
        fileName: f.fileName,
        phase: f.phase,
        phaseName: f.phaseName,
        requiredFiles: f.requiredFiles ?? [],
      })),
    [files]
  )

  const npmInstallCmd = useMemo(() => {
    if (!doc?.rawContent) return 'npm install'
    return generateNpmInstallCommand(doc.rawContent)
  }, [doc?.rawContent])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-tertiary)]">
        Loading files…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] space-y-3 shrink-0">
        {/* Progress row */}
        <div className="flex items-center gap-3">
          <Progress
            value={progressPct}
            className="flex-1 h-2 bg-[var(--bg-quaternary)]"
          />
          <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap shrink-0">
            <span className="text-[var(--text-primary)] font-medium">{completedFiles}</span>
            {' / '}
            {totalFiles} files complete
          </span>
        </div>

        {/* Filter chips + search + actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter chips */}
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_CHIPS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveFilter(value)}
                className={cn(
                  'text-xs px-3 py-1 rounded-full border font-medium transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                  activeFilter === value
                    ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                    : 'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[160px]">
            <SearchInput
              onSearch={setSearchQuery}
              placeholder="Search files…"
              debounceMs={200}
            />
          </div>

          {/* Action buttons */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const content = doc?.rawContent
              if (!content) return
              navigator.clipboard.writeText(content).then(() => {
                setGcdCopied(true)
                setTimeout(() => setGcdCopied(false), 1500)
              }).catch(() => undefined)
            }}
            className={cn(
              'gap-1.5 border-[var(--border-default)]',
              gcdCopied
                ? 'text-green-400 border-green-400/40'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
            )}
          >
            <Copy className="h-3.5 w-3.5" />
            {gcdCopied ? 'Copied!' : 'Copy GCD'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const gcd = doc?.rawContent
              if (!gcd) return
              const selectedFile = files.find((f) => f.filePrompt)
              const allPrompts = files
                .filter((f) => f.filePrompt?.trim())
                .map((f) => `=== FILE ${f.fileNumber}: ${f.filePath} ===\n\n${f.filePrompt}`)
                .join('\n\n' + '─'.repeat(60) + '\n\n')
              const combined = `${gcd}\n\n${'═'.repeat(60)}\nFILE-SPECIFIC PROMPTS\n${'═'.repeat(60)}\n\n${allPrompts}`
              navigator.clipboard.writeText(combined).then(() => {
                setGcdFspCopied(true)
                setTimeout(() => setGcdFspCopied(false), 1500)
              }).catch(() => undefined)
            }}
            className={cn(
              'gap-1.5 border-[var(--border-default)]',
              gcdFspCopied
                ? 'text-green-400 border-green-400/40'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
            )}
          >
            <Copy className="h-3.5 w-3.5" />
            {gcdFspCopied ? 'Copied!' : 'Copy GCD + Prompts'}
          </Button>          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScriptModalOpen(true)}
            className={cn(
              'gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)]',
              'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
            )}
          >
            <Terminal className="h-3.5 w-3.5" />
            Generate Script
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              // Copy npm install command directly
              navigator.clipboard.writeText(npmInstallCmd).catch(() => undefined)
            }}
            className={cn(
              'gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)]',
              'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
            )}
          >
            <Package className="h-3.5 w-3.5" />
            npm install
          </Button>
        </div>
      </div>

      {/* Phase groups */}
      <div className="flex-1 overflow-y-auto">
        {phaseGroups.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-tertiary)] text-sm">
            No files match the current filter.
          </div>
        ) : (
          phaseGroups.map(([phaseNum, phaseFiles]) => {
            const { total, completed } = getPhaseStats(phaseNum)
            const isExpanded = expandedPhases.has(phaseNum)
            const phaseName =
              phaseFiles[0]?.phaseName ?? PHASE_NAMES[phaseNum] ?? `Phase ${phaseNum}`

            return (
              <div key={phaseNum} className="border-b border-[var(--border-subtle)]">
                {/* Phase header */}
                <button
                  type="button"
                  onClick={() => togglePhase(phaseNum)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5',
                    'bg-[var(--bg-secondary)] hover:bg-[var(--bg-quaternary)]',
                    'transition-colors duration-150 text-left',
                    'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
                  )}
                  aria-expanded={isExpanded}
                >
                  {/* Chevron */}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                  )}

                  {/* Phase name */}
                  <span className="text-sm font-medium text-[var(--text-primary)] flex-1">
                    Phase {phaseNum} — {phaseName}
                  </span>

                  {/* Phase progress fraction */}
                  <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
                    {completed}/{total} complete
                  </span>

                  {/* Mini progress bar */}
                  <div className="w-16 shrink-0">
                    <Progress
                      value={calculateProgress(completed, total)}
                      className="h-1.5 bg-[var(--bg-quaternary)]"
                    />
                  </div>
                </button>

                {/* File rows */}
                {isExpanded && (
                  <div>
                    {phaseFiles.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        projectId={projectId}
                        isSelected={false}
                        onSelect={onOpenInEditor}
                      />
                    ))}                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Terminal script modal */}
      <TerminalScriptModal
        open={scriptModalOpen}
        onClose={() => setScriptModalOpen(false)}
        files={extractedFiles}
        npmInstallCmd={npmInstallCmd}
      />
    </div>
  )
}