'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import {
  Download,
  Terminal,
  FileText,
  Archive,
  FileCode,
  Copy,
  ChevronRight,
} from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Internal imports — services, hooks, types
import {
  exportProjectAsZip,
  exportDocumentAsMarkdown,
  exportDocumentAsText,
} from '@/services/exportService'
import { useFiles } from '@/hooks/useFiles'
import { useDocument } from '@/hooks/useDocument'
import { TerminalScriptModal } from '@/components/workspace/TerminalScriptModal'
import { cn } from '@/lib/utils'
import type { ExtractedFile } from '@/types'
import { copyToClipboard } from '@/lib/utils'

// 6. Local types
interface ExportViewProps {
  projectId: string
}

// ─── Export card sub-component ────────────────────────────────────────────────

interface ExportCardProps {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
  accentColor?: string
}

function ExportCard({
  icon,
  title,
  description,
  children,
  accentColor = 'var(--accent-primary)',
}: ExportCardProps): JSX.Element {
  return (
    <Card
      className={cn(
        'bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]',
        'rounded-xl p-5 flex flex-col gap-4',
        'hover:border-[var(--border-default)] transition-colors duration-150'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">{children}</div>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExportView({ projectId }: ExportViewProps): JSX.Element {
  const [isExportingZip, setIsExportingZip] = useState(false)
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false)
  const [isCopyingDoc, setIsCopyingDoc] = useState(false)

  const { files, isLoading: isFilesLoading } = useFiles(projectId)
  const { document: doc, isLoading: isDocLoading } = useDocument(projectId)

  const isLoading = isFilesLoading || isDocLoading

  // Derived values
  const filesWithCode = files.filter((f) => f.codeContent !== null)
  const projectName = doc?.rawContent
    ? (() => {
        const match = /^Name:\s*(.+)$/m.exec(doc.rawContent)
        return match ? match[1].trim() : 'devforge-project'
      })()
    : 'devforge-project'

  const rawContent = doc?.rawContent ?? ''

  // Extract npm install command from Section 3.3
  const npmInstallCmd = (() => {
    if (!rawContent) return 'npm install'
    const section33Match = /## SECTION 3\.3[^\n]*\n([\s\S]*?)(?=## SECTION|\n## |$)/i.exec(rawContent)
    if (!section33Match) return 'npm install'
    const sectionContent = section33Match[1]
    const depsMatch = /dependencies:([\s\S]*?)(?=devDependencies:|$)/i.exec(sectionContent)
    const devDepsMatch = /devDependencies:([\s\S]*?)(?=\n## |$)/i.exec(sectionContent)

    if (!depsMatch) return 'npm install'

    const extractPackages = (text: string): string[] => {
      return text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean)
    }

    const deps = extractPackages(depsMatch[1] ?? '')
    const devDeps = devDepsMatch ? extractPackages(devDepsMatch[1] ?? '') : []

    let cmd = 'npm install'
    if (deps.length > 0) cmd += ` ${deps.join(' ')}`
    if (devDeps.length > 0) cmd += ` && npm install -D ${devDeps.join(' ')}`
    return cmd
  })()

  // Extract file tree for terminal script
  const extractedFiles = (() => {
    if (!rawContent) return []
    const fileRegex = /^FILE (\d{3}[a-z]?): (.+)$/gm
    const results: ExtractedFile[] = []
    let match: RegExpExecArray | null
    while ((match = fileRegex.exec(rawContent)) !== null) {
      const filePath = match[2].trim()
      const segments = filePath.split('/')
      const fileName = segments[segments.length - 1] ?? filePath
      results.push({
        fileNumber: match[1],
        filePath,
        fileName,
        phase: 1,
        phaseName: 'Foundation',
        requiredFiles: [],
      })
    }
    return results
  })()

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleExportZip = useCallback(async () => {
    if (filesWithCode.length === 0) {
      toast.error('No files with code to export. Paste code into files first.')
      return
    }
    setIsExportingZip(true)
    try {
      await exportProjectAsZip(projectName, filesWithCode)
      toast.success(`Exported ${filesWithCode.length} files as ZIP.`)
    } catch {
      toast.error('Failed to generate ZIP. Please try again.')
    } finally {
      setIsExportingZip(false)
    }
  }, [filesWithCode, projectName])

  const handleExportMd = useCallback(() => {
    if (!rawContent) {
      toast.error('No document content to export.')
      return
    }
    exportDocumentAsMarkdown(projectName, rawContent)
    toast.success('Document exported as Markdown.')
  }, [rawContent, projectName])

  const handleExportTxt = useCallback(() => {
    if (!rawContent) {
      toast.error('No document content to export.')
      return
    }
    exportDocumentAsText(projectName, rawContent)
    toast.success('Document exported as plain text.')
  }, [rawContent, projectName])

  const handleCopyDoc = useCallback(async () => {
    if (!rawContent) {
      toast.error('No document content to copy.')
      return
    }
    setIsCopyingDoc(true)
    const success = await copyToClipboard(rawContent)
    setIsCopyingDoc(false)
    if (success) {
      toast.success('Full document copied to clipboard.')
    } else {
      toast.error('Failed to copy to clipboard.')
    }
  }, [rawContent])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Export Project</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
          Download your generated code, setup scripts, or the full context document.
        </p>
      </div>

      {/* Cards grid — 1 col mobile, 3 col desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Card 1: ZIP Export */}
        <ExportCard
          icon={<Archive className="h-4 w-4" />}
          title="Export Project ZIP"
          description="Download all files with code as a ZIP archive preserving the full folder structure."
          accentColor="var(--accent-primary)"
        >
          {/* File count indicator */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <FileCode className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
            <span className="text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">
                {filesWithCode.length}
              </span>
              {' of '}
              <span className="font-semibold text-[var(--text-primary)]">
                {files.length}
              </span>
              {' files have code'}
            </span>
            {filesWithCode.length === 0 && (
              <Badge className="ml-auto bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)] border-0 text-[10px]">
                Empty
              </Badge>
            )}
          </div>

          <Button
            onClick={handleExportZip}
            disabled={isExportingZip || filesWithCode.length === 0}
            className={cn(
              'w-full gap-2 justify-center',
              'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white',
              'disabled:opacity-40'
            )}
          >
            {isExportingZip ? (
              <>
                <LoadingSpinner />
                Generating…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export ZIP
              </>
            )}
          </Button>

          {filesWithCode.length === 0 && (
            <p className="text-[10px] text-[var(--text-tertiary)] text-center">
              Paste code into files in the Code Editor tab first
            </p>
          )}
        </ExportCard>

        {/* Card 2: Terminal Script */}
        <ExportCard
          icon={<Terminal className="h-4 w-4" />}
          title="Terminal Setup Script"
          description="Generate a shell script that creates all project folders and empty files in one command."
          accentColor="var(--status-complete)"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">
                {extractedFiles.length}
              </span>
              {' files × Windows CMD + Mac/Linux Bash'}
            </span>
          </div>

          <Button
            onClick={() => setIsScriptModalOpen(true)}
            disabled={extractedFiles.length === 0}
            className={cn(
              'w-full gap-2 justify-center',
              'bg-[var(--status-complete)] hover:opacity-90 text-white',
              'disabled:opacity-40'
            )}
          >
            <Terminal className="h-4 w-4" />
            Generate Script
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          {extractedFiles.length === 0 && (
            <p className="text-[10px] text-[var(--text-tertiary)] text-center">
              Import a Global Context Document first to generate the file tree
            </p>
          )}
        </ExportCard>

        {/* Card 3: Document Export */}
        <ExportCard
          icon={<FileText className="h-4 w-4" />}
          title="Export Context Document"
          description="Download or copy the complete Global Context Document as Markdown or plain text."
          accentColor="var(--status-in-progress)"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">
                {rawContent
                  ? `~${Math.ceil(rawContent.length / 1000)}k`
                  : '0'}
              </span>
              {' characters'}
            </span>
            {!rawContent && (
              <Badge className="ml-auto bg-[var(--status-empty-bg)] text-[var(--status-empty)] border-0 text-[10px]">
                No doc
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleExportMd}
              disabled={!rawContent}
              variant="outline"
              className="flex-1 gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              .md
            </Button>
            <Button
              onClick={handleExportTxt}
              disabled={!rawContent}
              variant="outline"
              className="flex-1 gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              .txt
            </Button>
          </div>

          <Button
            onClick={handleCopyDoc}
            disabled={!rawContent || isCopyingDoc}
            variant="outline"
            className={cn(
              'w-full gap-2 border-[var(--border-default)]',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              'disabled:opacity-40'
            )}
          >
            {isCopyingDoc ? (
              <>
                <LoadingSpinner />
                Copying…
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy to Clipboard
              </>
            )}
          </Button>
        </ExportCard>
      </div>

      {/* Terminal Script Modal */}
      <TerminalScriptModal
        open={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
        files={extractedFiles}
        npmInstallCmd={npmInstallCmd}
      />
    </div>
  )
}