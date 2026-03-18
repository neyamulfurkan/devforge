'use client'

// 1. React imports
import React, { useEffect, useCallback, Suspense } from 'react'

// 2. Next.js imports
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// 3. Third-party library imports
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// 4. Internal imports — shared components
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

// 4b. Additional icon imports for EditorLayout
import { FolderOpen, FolderDown, Loader2, CheckCircle2, ChevronRight, Sparkles, Check, Wand2, Bug, Plus, GitBranch, Copy, CheckCheck, XCircle, AlertCircle, FileEdit, ChevronDown, X, PanelBottomOpen, GitCommit } from 'lucide-react'

// 5. Internal imports — workspace components
import { WorkspaceNav } from '@/components/workspace/WorkspaceNav'
import { WorkspaceOverview } from '@/components/workspace/WorkspaceOverview'
import { FileSequenceTable } from '@/components/workspace/FileSequenceTable'
import { AddErrorSession } from '@/components/workspace/AddErrorSession'
import { ErrorSessionCard } from '@/components/workspace/ErrorSessionCard'
import { ExportView } from '@/components/workspace/ExportView'
import { PromptsView } from '@/components/workspace/PromptsView'
import { EditorFileTree } from '@/components/workspace/EditorFileTree'
import { EditorTopBar } from '@/components/workspace/EditorTopBar'
import { JsonAppendModal } from '@/components/workspace/JsonAppendModal'

// 6. Internal imports — hooks, stores, types
import { useProject } from '@/hooks/useProject'
import { useErrors } from '@/hooks/useErrors'
import { useEditor } from '@/hooks/useEditor'
import { useFiles } from '@/hooks/useFiles'
import { useDocument } from '@/hooks/useDocument'
import { useProjectStore } from '@/store/projectStore'
import { useEditorStore } from '@/store/editorStore'
import type { WorkspaceTab, FileWithContent } from '@/types'
import { CopyButton } from '@/components/shared/CopyButton'

// 7. Monaco editor — SSR disabled (required: browser-only DOM APIs)
const MonacoEditorWrapper = dynamic(
  () => import('@/components/workspace/MonacoEditorWrapper'),
  { ssr: false, loading: () => <EditorLoadingSkeleton /> }
)

// 8. DocumentSection — lazy to allow independent generation (FILE 097)
const NewFeatureFlow = dynamic(
  () =>
    import('@/components/workspace/NewFeatureFlow')
      .then((m) => ({ default: m.NewFeatureFlow }))
      .catch(() => {
        const Fallback = () => null
        Fallback.displayName = 'NewFeatureFlowFallback'
        return { default: Fallback }
      }),
  { ssr: false }
) as React.ComponentType<{ projectId: string; onComplete: () => void }>
const DocumentSection = dynamic(
  () =>
    import('@/components/workspace/DocumentSection')
      .then((m) => m.DocumentSection ?? m.default)
      .catch(() => {
        // Graceful fallback if FILE 097 hasn't been generated yet
        const Fallback = () => (
          <div className="flex h-full items-center justify-center text-[var(--text-tertiary)] text-sm">
            DocumentSection component not yet available (FILE 097).
          </div>
        )
        Fallback.displayName = 'DocumentSectionFallback'
        return Fallback
      }),
  { ssr: false }
) as React.ComponentType<{ projectId: string; onAddFeature?: () => void }>

// ─── Constants ─────────────────────────────────────────────────────────────────────── TEST OK

const VALID_TABS: WorkspaceTab[] = [
  'overview',
  'document',
  'files',
  'editor',
  'prompts',
  'errors',
  'setup',
  'export',
]

function isValidTab(value: string | null): value is WorkspaceTab {
  return VALID_TABS.includes(value as WorkspaceTab)
}

// ─── Loading skeleton for the Monaco editor panel ────────────────────────────

function EditorLoadingSkeleton(): JSX.Element {
  return (
    <div className="flex h-full w-full animate-pulse flex-col bg-[#1e1e1e]">
      <div className="flex h-full overflow-hidden">
        <div className="flex w-12 flex-col gap-2 border-r border-[#2a2a2a] px-2 py-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-[#2a2a2a]"
              style={{ width: `${14 + (i % 3) * 8}px` }}
            />
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 py-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-[#2a2a2a]"
              style={{ width: `${20 + (i % 5) * 12}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Shared prompt helpers — 100% identical to FileRow.tsx GcdPlusCodeButton ─

function trimGcdForPhase(gcdContent: string, phase: number): string {
  const alwaysInclude = new Set(['1', '3', '4', '5', '9', '11'])
  const phaseAdditional: Record<string, Set<string>> = {
    foundation: new Set(['2', '6', '10']),
    services:   new Set(['2']),
    frontend:   new Set(['7', '8']),
    api:        new Set(['6', '10']),
  }
  const getPhaseGroup = (p: number): string => {
    if (p <= 2) return 'foundation'
    if (p <= 5) return 'services'
    if (p <= 8) return 'frontend'
    return 'api'
  }
  const group = getPhaseGroup(phase)
  const allowed = new Set([...alwaysInclude, ...(phaseAdditional[group] ?? new Set())])
  const lines = gcdContent.split('\n')
  const outputLines: string[] = []
  let currentSectionAllowed = true
  let currentSectionNum = ''
  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+SECTION\s+(\d+(?:\.\d+)?)/i)
    if (sectionMatch) {
      const num = sectionMatch[1] ?? ''
      currentSectionNum = num.split('.')[0] ?? num
      currentSectionAllowed = allowed.has(currentSectionNum)
    }
    if (currentSectionAllowed) outputLines.push(line)
  }
  return outputLines.join('\n')
}

function getBuildStateForFile(
  file: { fileNumber: string; filePath: string; phase: number; phaseName: string; status: string },
  allFiles: Array<{ fileNumber: string; filePath: string; status: string; phase: number; phaseName: string }>
): string {
  const completedFiles = allFiles.filter((f) => f.status === 'COMPLETE')
  const completedCount = completedFiles.length
  const totalCount = allFiles.length
  if (completedCount === 0) {
    return `CURRENT BUILD STATE: Phase ${file.phase} — ${file.phaseName}. No files completed yet. This is the first file being generated.`
  }
  const lastCompleted = completedFiles[completedFiles.length - 1]
  const lastNum = lastCompleted?.fileNumber ?? '000'
  const lastPath = lastCompleted?.filePath ?? ''
  const phaseComplete = completedFiles.filter((f) => f.phase === file.phase)
  const phaseTotal = allFiles.filter((f) => f.phase === file.phase)
  return `CURRENT BUILD STATE: Phase ${file.phase} — ${file.phaseName}. Files 001–${lastNum} are complete (${completedCount}/${totalCount} total). Phase ${file.phase} progress: ${phaseComplete.length}/${phaseTotal.length} files done. Last completed: ${lastPath}. FILE ${file.fileNumber} (${file.filePath}) is next.`
}

function extractRegistryEntry(gcdContent: string, filePath: string): string | null {
  const lines = gcdContent.split('\n')
  let inSection11 = false
  let entryLines: string[] = []
  let capturing = false
  let braceDepth = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^##\s+SECTION\s+11/i.test(line)) { inSection11 = true; continue }
    if (inSection11 && /^##\s+SECTION\s+\d+/i.test(line)) { inSection11 = false; break }
    if (!inSection11) continue
    if (!capturing && line.includes(filePath)) { capturing = true; entryLines = [line]; continue }
    if (capturing) {
      entryLines.push(line)
      for (const ch of line) {
        if (ch === '{') braceDepth++
        if (ch === '}') braceDepth--
      }
      if (braceDepth <= 0 && entryLines.some((l) => l.includes('{'))) break
    }
  }
  return entryLines.length > 1 ? entryLines.join('\n') : null
}

// ─── Next File Bar ────────────────────────────────────────────────────────────
// Shows the next incomplete file and lets user open + copy its full prompt
// in one click. Lives above the editor mode switcher.

function NextFileBar({ projectId }: { projectId: string }): JSX.Element | null {
  const { files } = useFiles(projectId)
  const { document: docData } = useDocument(projectId)
  const { openFile } = useEditor(projectId)
  const [copyState, setCopyState] = React.useState<'idle' | 'loading' | 'done'>('idle')
  const [copySuccessMessage, setCopySuccessMessage] = React.useState('')

  // Find the next file to work on: first EMPTY, then CODE_PASTED, ordered by fileNumber
  const nextFile = React.useMemo(() => {
    const incomplete = files
      .filter((f) => f.status !== 'COMPLETE')
      .sort((a, b) => {
        // Sort by numeric part of fileNumber first, then string
        const aNum = parseInt(a.fileNumber.replace(/\D/g, ''), 10)
        const bNum = parseInt(b.fileNumber.replace(/\D/g, ''), 10)
        if (aNum !== bNum) return aNum - bNum
        return a.fileNumber.localeCompare(b.fileNumber)
      })
    return incomplete[0] ?? null
  }, [files])

  const completedCount = files.filter((f) => f.status === 'COMPLETE').length
  const totalCount = files.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const handleOpenAndCopy = React.useCallback(async () => {
    if (!nextFile || copyState === 'loading') return
    setCopyState('loading')

    try {
      // 1 — open via DB mode so openFileId is set correctly in the store
      await openFile(nextFile.id)

      // 1b — find the disk file handle, write existing DB code to disk NOW,
      // and link the handle so future Monaco edits also auto-save to disk
      const { localModeByProject } = useEditorStore.getState()
      const localState = localModeByProject[projectId]
      if (localState?.localFileTree?.length) {
        // Tree walker — finds a file node by path
        const findDiskNode = (
          nodes: import('@/store/editorStore').LocalFileNode[],
          targetPath: string
        ): import('@/store/editorStore').LocalFileNode | null => {
          for (const node of nodes) {
            if (node.type === 'file') {
              const nodePath = node.path.replace(/^\/+/, '')
              const target = targetPath.replace(/^\/+/, '')
              if (
                nodePath === target ||
                nodePath.endsWith('/' + target)
              ) return node
            }
            if (node.type === 'folder' && node.children?.length) {
              const found = findDiskNode(node.children, targetPath)
              if (found) return found
            }
          }
          return null
        }

        const diskNode = findDiskNode(localState.localFileTree, nextFile.filePath)
        if (diskNode && diskNode.type === 'file') {
          const diskHandle = diskNode.handle as FileSystemFileHandle

          // Step A — fetch the existing DB code for this file
          let existingCode = ''
          try {
            const codeRes = await fetch(`/api/projects/${projectId}/files/${nextFile.id}/code`)
            if (codeRes.ok) {
              const codeJson = await codeRes.json()
              existingCode = codeJson.data?.codeContent ?? ''
            }
          } catch { /* no code yet — will write empty file */ }

          // Step B — write to disk RIGHT NOW so VSCode sees it immediately
          try {
            const writable = await diskHandle.createWritable()
            await writable.write(existingCode)
            await writable.close()
          } catch { /* permission denied or handle stale — skip */ }

          // Step C — link the handle in the store so every future
          // Monaco keystroke/paste auto-saves to this disk file (500ms debounce)
          useEditorStore.getState().openLocalFile(
            projectId,
            diskHandle,
            diskNode.path
          )
        }
      }

      // 2 — build prompt: 100% identical to GcdPlusCodeButton in FileRow.tsx
      const gcd = docData?.rawContent ?? ''
      const fsp = nextFile.filePrompt ?? ''
      const sep = '═'.repeat(60)
      const thinSep = '─'.repeat(60)
      const filePath = nextFile.filePath
      const fileNumber = nextFile.fileNumber
      const filePhase = nextFile.phase
      const filePhaseName = nextFile.phaseName
      const fileStatus = nextFile.status
      const requiredFiles = nextFile.requiredFiles

      const cleanPath = (raw: string): string => raw.replace(/^FILE\s+[\w]+:\s*/i, '').trim()

      // Read store state at click time — never stale
      const storeState = useEditorStore.getState()
      const liveContent = storeState.fileContent
      const projectLocalState = storeState.localModeByProject[projectId] ?? {
        isLocalMode: false, localFileTree: [], openLocalPath: null,
        openLocalHandle: null, localFolderHandle: null,
      }
      const liveTree = projectLocalState.localFileTree
      const livePath = projectLocalState.openLocalPath
      const liveLocalMode = projectLocalState.isLocalMode

      // Fetch all project file metadata (for DB fallback + dependent detection)
      let allProjectFiles: Array<{
        id: string; filePath: string; fileNumber: string; status: string
        phase: number; phaseName: string; jsonSummary: Record<string, unknown> | null
      }> = []
      try {
        const listRes = await fetch(`/api/projects/${projectId}/files`)
        if (listRes.ok) {
          const listJson = await listRes.json()
          allProjectFiles = Array.isArray(listJson.data) ? listJson.data : []
        }
      } catch { /* DB fallback won't work but local disk still will */ }

      // IMPROVEMENT 1: Phase-trim the GCD
      const trimmedGcd = trimGcdForPhase(gcd, filePhase)

      // IMPROVEMENT 5: Build state
      const buildState = getBuildStateForFile(
        { fileNumber, filePath, phase: filePhase, phaseName: filePhaseName, status: fileStatus },
        allProjectFiles
      )

      // IMPROVEMENT 3: CSS module auto-detection
      const cssModulePath = filePath.endsWith('.tsx')
        ? filePath.replace(/\.tsx$/, '.module.css') : null

      const allRequiredPaths = [...requiredFiles.map(cleanPath).filter(Boolean)]
      if (cssModulePath && !allRequiredPaths.includes(cssModulePath)) {
        const cssMatch = allProjectFiles.find((f) => {
          const fNorm = f.filePath.replace(/^\/+/, '')
          const cssNorm = cssModulePath.replace(/^\/+/, '')
          return fNorm === cssNorm || fNorm.endsWith('/' + cssNorm)
        })
        if (cssMatch) allRequiredPaths.push(cssModulePath)
      }

      // Fetch each required file — 3 sources: editor memory, local disk, DB/cloud
      const results: Array<{ path: string; content: string; source: string; isCss: boolean }> = []
      const missing: Array<{ path: string; stub: string | null }> = []

      // Local tree walker — identical to GcdPlusCodeButton
      const findInLocalTree = async (nodes: import('@/store/editorStore').LocalFileNode[], requiredPath: string): Promise<string | null> => {
        const normalised = requiredPath.replace(/^\/+/, '')
        const requiredFilename = normalised.split('/').pop() ?? ''
        for (const node of nodes) {
          if (node.type === 'file') {
            const nodePath = node.path.replace(/^\/+/, '')
            const nodeFilename = nodePath.split('/').pop() ?? ''
            const isMatch = nodePath === normalised || nodePath.endsWith('/' + normalised) ||
              (requiredFilename.length > 5 && nodeFilename === requiredFilename)
            if (isMatch) {
              try {
                const fsHandle = node.handle as FileSystemFileHandle
                const f = await fsHandle.getFile()
                const text = await f.text()
                if (text.trim()) return text
              } catch { /* stale handle — continue */ }
            }
          }
          if (node.type === 'folder' && node.children?.length) {
            const found = await findInLocalTree(node.children, requiredPath)
            if (found) return found
          }
        }
        return null
      }

      for (const reqPath of allRequiredPaths) {
        if (!reqPath) continue
        let content: string | null = null
        let source = ''
        const isCss = reqPath.endsWith('.css') || reqPath.endsWith('.scss')

        // Source 1 — currently open file in editor memory
        if (livePath && liveContent?.trim()) {
          const livNorm = livePath.replace(/^\/+/, '')
          const reqNorm = reqPath.replace(/^\/+/, '')
          if (livNorm === reqNorm || livNorm.endsWith('/' + reqNorm) || reqNorm.endsWith('/' + livNorm)) {
            content = liveContent; source = 'editor'
          }
        }

        // Source 2 — local disk tree
        if (!content && liveLocalMode && liveTree.length > 0) {
          const diskContent = await findInLocalTree(liveTree, reqPath)
          if (diskContent) { content = diskContent; source = 'disk' }
        }

        // Source 3 — DB / Cloudinary via API
        if (!content) {
          const reqNorm = reqPath.replace(/^\/+/, '')
          const match = allProjectFiles.find((f) => {
            const fNorm = f.filePath.replace(/^\/+/, '')
            return fNorm === reqNorm || fNorm.endsWith('/' + reqNorm) || reqNorm.endsWith('/' + fNorm)
          })
          if (match) {
            try {
              const codeRes = await fetch(`/api/projects/${projectId}/files/${match.id}/code`)
              if (codeRes.ok) {
                const codeJson = await codeRes.json()
                const fetched: string = codeJson.data?.codeContent ?? ''
                if (fetched.trim()) { content = fetched; source = 'cloud' }
              }
            } catch { /* non-fatal */ }
          }
        }

        if (content) {
          results.push({ path: reqPath, content, source, isCss })
        } else {
          // IMPROVEMENT 4: Section 11 stub for missing files
          const stub = extractRegistryEntry(gcd, reqPath)
          missing.push({ path: reqPath, stub })
        }
      }

      // IMPROVEMENT 2: Dependent registry entries
      const dependentEntries: Array<{ fileNum: string; path: string; entry: string }> = []
      for (const pf of allProjectFiles) {
        if (pf.filePath === filePath) continue
        const summary = pf.jsonSummary as Record<string, unknown> | null
        if (!summary) continue
        const deps = summary['dependents']
        if (Array.isArray(deps) && deps.some((d) =>
          typeof d === 'string' && (d === filePath || d.includes(filePath) || filePath.includes(d))
        )) {
          const entry = extractRegistryEntry(gcd, pf.filePath)
          if (entry) dependentEntries.push({ fileNum: pf.fileNumber, path: pf.filePath, entry })
        }
      }

      // Assemble blocks — identical structure to GcdPlusCodeButton
      const requiredFilesBlock = results
        .map((r) => {
          const label = r.isCss
            ? `REQUIRED FILE: ${r.path} — USE THESE EXACT CLASS NAMES IN YOUR JSX`
            : `REQUIRED FILE: ${r.path} — READ THIS BEFORE GENERATING`
          return `${sep}\n${label}\n${sep}\n\n${r.content}`
        }).join('\n\n')

      const missingBlock = missing.length > 0
        ? missing.map(({ path, stub }) =>
            stub
              ? `${sep}\nREQUIRED FILE: ${path} — FULL CONTENTS NOT PROVIDED\nUse this registry entry as the interface reference:\n${thinSep}\n${stub}\n${thinSep}`
              : `${sep}\n⚠️ REQUIRED FILE: ${path} — NOT FOUND\nProceed without it. Do not guess its contents.`
          ).join('\n\n')
        : ''

      const dependentBlock = dependentEntries.length > 0
        ? `${sep}\nDEPENDENT FILES — THESE IMPORT FROM THE FILE YOU ARE GENERATING\nTheir registry entries define exactly what interface they expect from you.\n${sep}\n\n${
            dependentEntries.map((d) => `FILE ${d.fileNum} (${d.path}) expects from ${filePath}:\n${thinSep}\n${d.entry}`).join('\n\n')
          }\n\n${sep}`
        : ''

      const providedFilesNote = results.length > 0
        ? `NOTE: The following files have been provided above and you have read them:\n${results.map((r) => `  • ${r.path}${r.isCss ? ' (CSS module — use exact class names)' : ''}`).join('\n')}\nReference them directly for imports, types, hook names, store selectors, class names, and design patterns. Do not guess their shape.`
        : ''

      const combined = `${trimmedGcd}

${results.length > 0 || missing.length > 0 ? `${requiredFilesBlock}

${missingBlock}` : ''}

${dependentBlock}

${results.length > 0 || missing.some((m) => m.stub) ? `${sep}\nEND REQUIRED FILES. CONTEXT CONFIRMED. GENERATE NOW.\n${sep}` : ''}

${sep}
TASK: GENERATE FILE ${fileNumber} — ${filePath}
${sep}

${buildState}

${providedFilesNote ? `${providedFilesNote}\n\n` : ''}FILE-SPECIFIC PROMPT:

${fsp}

${sep}
OUTPUT FORMAT — YOU MUST FOLLOW THIS EXACTLY:
${sep}

Your entire response must contain ONLY two things in this exact order:

1. The complete file code in a single fenced code block. Every function, every handler, every import fully written. No placeholders, no "// TODO", no truncation.

2. Immediately after the closing fence of the code block — this JSON object with no text before or after it:

\`\`\`json
{
  "file": "${filePath}",
  "fileNumber": "${fileNumber}",
  "exports": ["ExportName — max 3 word description"],
  "imports": ["package — one reason, omit React/Next/Node built-ins"],
  "keyLogic": "One sentence. What this file actually does.",
  "sideEffects": ["one short phrase — omit array if none"],
  "dependents": ["top 3 files that import this one"],
  "status": "complete",
  "generatedAt": "${new Date().toISOString()}"
}
\`\`\`

STRICT RULES:
- Do NOT repeat, quote, or reference the GCD
- Do NOT add any text after the JSON closing fence
- Do NOT add introductory text before the code block
- Do NOT add "I've implemented..." commentary anywhere
- All required files are provided above. Do not ask for clarification. Do not ask to proceed. Generate immediately.
- JSON must be the absolute last thing in your response`

      await navigator.clipboard.writeText(combined)
      // Build a human-readable summary of what was copied
      const copiedFilesList = results.map((r) => r.path)
      const missingFilesList = missing.filter((m) => !m.stub).map((m) => m.path)
      const stubFilesList = missing.filter((m) => m.stub).map((m) => m.path)

      const summaryParts: string[] = [`FILE ${fileNumber} — ${filePath}`]
      if (copiedFilesList.length > 0) {
        summaryParts.push(`✓ ${copiedFilesList.length} required file${copiedFilesList.length !== 1 ? 's' : ''} included: ${copiedFilesList.join(', ')}`)
      }
      if (stubFilesList.length > 0) {
        summaryParts.push(`~ ${stubFilesList.length} stub${stubFilesList.length !== 1 ? 's' : ''} from registry: ${stubFilesList.join(', ')}`)
      }
      if (missingFilesList.length > 0) {
        summaryParts.push(`⚠ ${missingFilesList.length} not found: ${missingFilesList.join(', ')}`)
      }
      if (dependentEntries.length > 0) {
        summaryParts.push(`↳ ${dependentEntries.length} dependent${dependentEntries.length !== 1 ? 's' : ''}: ${dependentEntries.map((d) => d.path).join(', ')}`)
      }
      const summaryLines: string[] = [
        `✓ GCD copied (phase-trimmed for phase ${filePhase})`,
        `✓ FSP copied — FILE ${fileNumber}: ${filePath}`,
        ...(copiedFilesList.length > 0 ? [`✓ Required files (${copiedFilesList.length}): ${copiedFilesList.join(', ')}`] : ['— No required files']),
        ...(stubFilesList.length > 0 ? [`~ Registry stubs (${stubFilesList.length}): ${stubFilesList.join(', ')}`] : []),
        ...(missingFilesList.length > 0 ? [`⚠ Not found (${missingFilesList.length}): ${missingFilesList.join(', ')}`] : []),
        ...(dependentEntries.length > 0 ? [`↳ Dependents (${dependentEntries.length}): ${dependentEntries.map((d) => d.path).join(', ')}`] : []),
      ]
      setCopySuccessMessage(summaryLines.join('\n'))
      setCopyState('done')
      setTimeout(() => { setCopyState('idle'); setCopySuccessMessage('') }, 5000)
    } catch {
      setCopyState('idle')
    }
  }, [nextFile, copyState, openFile, docData, files, projectId])

  if (!nextFile) {
    // All files complete
    return (
      <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-[var(--status-complete)]/20 bg-[var(--status-complete-bg)] px-3">
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-complete)]" />
        <span className="text-xs font-medium text-[var(--status-complete)]">
          All {totalCount} files complete!
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3">
      {/* Progress fraction */}
      <span className="text-[10px] font-mono text-[var(--text-tertiary)] flex-shrink-0 hidden sm:inline">
        {completedCount}/{totalCount}
      </span>

      {/* Thin progress bar */}
      <div className="hidden sm:block w-16 h-1 rounded-full bg-[var(--bg-quaternary)] flex-shrink-0 overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ChevronRight className="h-3 w-3 text-[var(--text-tertiary)] flex-shrink-0 hidden sm:block" />

      {/* Copy success details — shown inline after copying */}
      {copyState === 'done' && copySuccessMessage && (
        <div className="hidden lg:flex flex-col min-w-0 flex-shrink max-w-sm gap-0.5">
          {copySuccessMessage.split('\n').map((line, i) => (
            <span
              key={i}
              className={cn(
                'text-[10px] font-mono truncate leading-tight',
                line.startsWith('✓') ? 'text-[var(--status-complete)]' :
                line.startsWith('⚠') ? 'text-[var(--status-error)]' :
                line.startsWith('~') ? 'text-[var(--status-in-progress)]' :
                line.startsWith('↳') ? 'text-[var(--accent-primary)]' :
                'text-[var(--text-tertiary)]'
              )}
            >
              {line}
            </span>
          ))}
        </div>
      )}

      {/* Next file label */}
      <div className={cn('flex items-center gap-1.5 min-w-0 flex-1', copyState === 'done' ? 'hidden lg:flex' : 'flex')}>
        <span className="text-[10px] font-mono text-[var(--text-tertiary)] flex-shrink-0">
          Next:
        </span>
        <span className="text-xs font-mono text-[var(--text-primary)] truncate">
          <span className="text-[var(--text-tertiary)]">{nextFile.fileNumber}</span>
          {' — '}
          {nextFile.filePath}
        </span>
        {nextFile.filePrompt ? (
          <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent-primary)] flex-shrink-0">
            has prompt
          </span>
        ) : (
          <span className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] flex-shrink-0">
            no prompt
          </span>
        )}
      </div>

      {/* Main action button */}
      <button
        type="button"
        onClick={handleOpenAndCopy}
        disabled={copyState === 'loading'}
        className={cn(
          'flex-shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all duration-150',
          copyState === 'done'
            ? 'bg-[var(--status-complete-bg)] border border-[var(--status-complete)]/40 text-[var(--status-complete)]'
            : copyState === 'loading'
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white opacity-80 cursor-wait'
            : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-sm hover:shadow-md active:scale-95'
        )}
        title={copyState === 'done' && copySuccessMessage ? copySuccessMessage : 'Open this file in editor and copy GCD + prompt + required files to clipboard'}
      >
        {copyState === 'loading' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : copyState === 'done' ? (
          <Check className="h-3 w-3" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        {copyState === 'loading' ? 'Copying…' : copyState === 'done' ? 'Copied! File open' : 'Open + Copy Prompt'}
      </button>
    </div>
  )
}

// ─── Editor mode switcher bar ─────────────────────────────────────────────────
// Sits above the editor. Lets user toggle between DB files and local folder.

function GitPushButton({ projectId }: { projectId: string }): JSX.Element {
  const [commitMsg, setCommitMsg] = React.useState('')
  const [copyState, setCopyState] = React.useState<'idle' | 'done'>('idle')
  const [copiedPath, setCopiedPath] = React.useState(false)
  const [editingPath, setEditingPath] = React.useState(false)
  const [folderPath, setFolderPath] = React.useState<string>('')
  const pathInputRef = React.useRef<HTMLInputElement>(null)

  const { getLocalState: getGitLocalState } = useEditorStore()
  const { localFolderHandle } = getGitLocalState(projectId)

  // Load saved full path from localStorage; fall back to handle name
  React.useEffect(() => {
    if (!localFolderHandle) return
    const stored = localStorage.getItem(`devforge_folder_path_${projectId}`)
    setFolderPath(stored ?? localFolderHandle.name)
  }, [localFolderHandle, projectId])

  // Focus input when editing starts
  React.useEffect(() => {
    if (editingPath) pathInputRef.current?.focus()
  }, [editingPath])

  const savePath = React.useCallback((value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      localStorage.setItem(`devforge_folder_path_${projectId}`, trimmed)
      setFolderPath(trimmed)
    }
    setEditingPath(false)
  }, [projectId])

  const handleCopy = React.useCallback(async () => {
    const msg = commitMsg.trim() || 'update'
    const cmd = `git add . && git commit -m "${msg.replace(/"/g, "'")}" && git push`
    await navigator.clipboard.writeText(cmd)
    setCopyState('done')
    setTimeout(() => setCopyState('idle'), 2500)
  }, [commitMsg])

  return (
    <div className="flex items-center gap-1.5 border-t border-[var(--border-subtle)] px-3 py-2 bg-[var(--bg-primary)]">
      {localFolderHandle && (
        editingPath ? (
          <input
            ref={pathInputRef}
            type="text"
            defaultValue={folderPath}
            placeholder={`e.g. C:\\projects\\${localFolderHandle.name}`}
            onBlur={(e) => savePath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') savePath((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setEditingPath(false)
            }}
            className="flex-shrink-0 h-6 px-2 rounded text-[10px] font-mono border border-[var(--accent-border)] bg-[var(--bg-input)] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent-primary)] min-w-[160px] max-w-[260px]"
          />
        ) : (
          <div className="flex-shrink-0 flex items-center gap-0.5">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(folderPath)
                setCopiedPath(true)
                setTimeout(() => setCopiedPath(false), 2000)
              }}
              title={`Copy full path: ${folderPath}`}
              className={cn(
                'flex items-center gap-1 h-6 px-2 rounded-l text-[10px] font-mono font-medium transition-all duration-150 border-y border-l',
                copiedPath
                  ? 'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                  : 'bg-[var(--bg-quaternary)] border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
              )}
            >
              {copiedPath ? <><CheckCheck className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> <span className="max-w-[140px] truncate">{folderPath}</span></>}
            </button>
            <button
              type="button"
              onClick={() => setEditingPath(true)}
              title="Edit full folder path"
              className="flex items-center justify-center h-6 w-6 rounded-r border border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)] transition-all duration-150 text-[10px]"
            >
              ✎
            </button>
          </div>
        )
      )}
      <GitCommit className="h-3 w-3 text-[var(--text-tertiary)] flex-shrink-0" />
      <input
        type="text"
        value={commitMsg}
        onChange={(e) => setCommitMsg(e.target.value)}
        placeholder="commit message…"
        className="flex-1 min-w-0 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        onKeyDown={(e) => { if (e.key === 'Enter') handleCopy() }}
      />
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium transition-all duration-150',
          copyState === 'done'
            ? 'bg-[var(--status-complete-bg)] text-[var(--status-complete)]'
            : 'bg-[var(--bg-quaternary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-default)]'
        )}
        title="Copy git add && commit && push command"
      >
        {copyState === 'done' ? <><CheckCheck className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> git push</>}
      </button>
    </div>
  )
}

function EditorModeSwitcher({ projectId }: { projectId: string }): JSX.Element {
  const { isLocalMode, openLocalFolder, switchToDBMode, createProjectFolder } = useEditor(projectId)
  const { getLocalState } = useEditorStore()
  const { localFolderHandle } = getLocalState(projectId)
  const [copiedPath, setCopiedPath] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [mismatchInfo, setMismatchInfo] = React.useState<{
    matchPct: number
    matched: number
    total: number
  } | null>(null)

  // Auto-switch to local mode when a folder handle is already saved —
  // means the user previously linked a folder, so always default to it
  React.useEffect(() => {
    if (localFolderHandle && !isLocalMode) {
      // Folder is linked but store isn't in local mode yet (e.g. page refresh
      // before restoreLocalFolder has finished) — nothing to do here,
      // restoreLocalFolder in useEditor handles the actual switch.
      // This effect just ensures the UI reflects the correct active tab.
    }
  }, [localFolderHandle, isLocalMode])

  const handleCreate = React.useCallback(async () => {
    setCreating(true)
    await createProjectFolder()
    setCreating(false)
  }, [createProjectFolder])

  const handleOpenFolder = React.useCallback(async () => {
    setMismatchInfo(null)
    const result = await openLocalFolder()
    if (!result.success && result.reason === 'mismatch') {
      setMismatchInfo({
        matchPct: result.matchPct ?? 0,
        matched: result.matched ?? 0,
        total: result.total ?? 0,
      })
    }
  }, [openLocalFolder])

  return (
    <div className="flex h-9 flex-shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3">
      {/* Project Files (DB mode) — hidden when local folder is linked */}
      {!localFolderHandle && (
        <button
          type="button"
          onClick={switchToDBMode}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            !isLocalMode
              ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
          )}
        >
          Project Files
        </button>
      )}

      {/* If folder already linked — show activate button; else show open picker */}
      {localFolderHandle ? (
        <button
          type="button"
          onClick={() => {
            // User explicitly wants to use this folder — switch to local mode
            if (!isLocalMode) switchToDBMode().then(() => {
              // re-activate local mode for this project
              openLocalFolder()
            })
          }}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white"
          title={`Linked: ${localFolderHandle.name} — click to open in editor`}
        >
          <FolderOpen className="h-3 w-3" />
          📁 {localFolderHandle.name}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]"
          title="Open a local folder for this project"
        >
          <FolderOpen className="h-3 w-3" />
          Open Folder
        </button>
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        title="Auto-create all project files and folders on your laptop"
        className={cn(
          'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors',
          'border border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)]',
          'hover:bg-[var(--accent-primary)] hover:text-white disabled:opacity-50'
        )}
      >
        {creating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FolderDown className="h-3 w-3" />
        )}
        {creating ? 'Creating…' : 'Create Folder'}
      </button>

      {/* Disconnect button — only when folder is linked */}
      {localFolderHandle && (
        <button
          type="button"
          onClick={switchToDBMode}
          className="ml-auto text-xs text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"
          title="Disconnect local folder — switch back to cloud files"
        >
          Disconnect
        </button>
      )}
      <GitPushButton projectId={projectId} />
    {/* Mismatch warning — shown when opened folder doesn't match project */}
      {mismatchInfo && (
        <div className="flex items-center gap-3 px-3 py-2 bg-[var(--status-error-bg)] border-b border-[var(--status-error)]/20">
          <span className="text-xs text-[var(--status-error)] flex-1">
            Wrong folder — only {mismatchInfo.matched} of {mismatchInfo.total} project files found ({mismatchInfo.matchPct}% match). Need 60%+ to open. Try "Create Project Folder" instead.
          </span>
          <button
            type="button"
            onClick={() => setMismatchInfo(null)}
            className="text-[var(--status-error)] hover:opacity-70 text-lg leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Folder setup screen ──────────────────────────────────────────────────────
// Shown when local mode is active but no folder is linked yet.
// Two options: pick an existing folder, or auto-create the full project structure.

function FolderSetupScreen({ projectId }: { projectId: string }): JSX.Element {
  const { openLocalFolder, createProjectFolder } = useEditor(projectId)
  type CreateState = 'idle' | 'creating' | 'done' | 'error'
  const [createState, setCreateState] = React.useState<CreateState>('idle')
  const [progress, setProgress] = React.useState<{
    current: number
    total: number
    currentPath: string
  } | null>(null)
  const [createdFolderName, setCreatedFolderName] = React.useState<string | null>(null)

  const [mismatchError, setMismatchError] = React.useState<string | null>(null)

  const handleOpenExisting = React.useCallback(async () => {
    setMismatchError(null)
    const result = await openLocalFolder()
    if (!result.success && result.reason === 'mismatch') {
      setMismatchError(
        `Wrong folder — only ${result.matched} of ${result.total} project files matched (${result.matchPct}%). Need 60%+. Please choose the correct project folder or use "Create Project Folder".`
      )
    }
  }, [openLocalFolder])

  const handleCreate = React.useCallback(async () => {
    setCreateState('creating')
    setProgress(null)
    setMismatchError(null)

    const result = await createProjectFolder(
      (current, total, currentPath) => {
        setProgress({ current, total, currentPath })
      }
    )

    if (result.success) {
      setCreatedFolderName(result.folderName)
      setCreateState('done')
    } else {
      // User cancelled — go back to idle silently
      setCreateState('idle')
      setProgress(null)
    }
  }, [createProjectFolder])

  // Done state — folder created and linked, editor will load automatically
  if (createState === 'done') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
          <div className="h-16 w-16 rounded-2xl bg-[var(--status-complete-bg)] flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-[var(--status-complete)]" />
          </div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Project folder created
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-mono text-[var(--text-primary)]">{createdFolderName}/</span>
            {' '}has been created with all your project files. The editor is loading…
          </p>
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening editor…
          </div>
        </div>
      </div>
    )
  }

  // Creating state — show live progress
  if (createState === 'creating') {
    const pct = progress
      ? Math.round((progress.current / progress.total) * 100)
      : 0

    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-5 max-w-sm w-full text-center px-6">
          <div className="h-16 w-16 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-[var(--accent-primary)] animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Creating project folder…
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] font-mono truncate max-w-xs">
              {progress?.currentPath ?? 'Setting up directories…'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-1.5">
            <div className="w-full h-1.5 rounded-full bg-[var(--bg-quaternary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              {progress
                ? `${progress.current} / ${progress.total} files`
                : 'Starting…'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Idle state — two options
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-6 max-w-md w-full text-center px-6">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Set up local editing
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Choose how you want to connect this project to your laptop.
          </p>
        </div>

        {/* Option 1 — Create project folder (recommended) */}
        <div className="w-full rounded-xl border-2 border-[var(--accent-border)] bg-[var(--accent-light)] p-5 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center flex-shrink-0">
              <FolderDown className="h-5 w-5 text-white" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Create project folder
                <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-primary)] text-white">
                  Recommended
                </span>
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Pick a location on your laptop. DevForge will automatically
                create all {'{'}N{'}'} files and folders from your project structure.
                Files with existing code are written immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            className="w-full rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-medium py-2.5 px-4 text-sm transition-colors active:scale-95"
          >
            Choose location and create folder
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          <span className="text-xs text-[var(--text-tertiary)]">or</span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>

        {/* Option 2 — Open existing folder */}
        <div className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-5 text-left space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--bg-quaternary)] flex items-center justify-center flex-shrink-0">
              <FolderOpen className="h-5 w-5 text-[var(--text-secondary)]" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Open existing folder
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Already have the project folder on your laptop?
                Select it directly to link it to this project.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenExisting}
            className="w-full rounded-lg border border-[var(--border-default)] hover:border-[var(--border-emphasis)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium py-2.5 px-4 text-sm transition-colors active:scale-95"
          >
            Choose existing folder
          </button>
        </div>

        {/* Mismatch error */}
        {mismatchError && (
          <div className="w-full rounded-lg bg-[var(--status-error-bg)] border border-[var(--status-error)]/20 px-4 py-3 text-xs text-[var(--status-error)] leading-relaxed">
            {mismatchError}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Editor layout sub-component ─────────────────────────────────────────────
// Three-panel layout: file tree (left) | editor (center) | top bar (pinned top)

interface EditorLayoutProps {
  projectId: string
}

function EditorLayout({ projectId }: EditorLayoutProps): JSX.Element {
  const {
    openFile: openFileById,
    openFileId,
    onContentChange,
    saveFile,
    isLocalMode,
    openLocalPath,
  } = useEditor(projectId)
  const { files } = useFiles(projectId)
  const { getLocalState } = useEditorStore()
  const { localFolderHandle } = getLocalState(projectId)

  // Editor action refs — populated by MonacoEditorWrapper on mount
  const findReplaceRef = React.useRef<(() => void) | null>(null)
  const findRef = React.useRef<(() => void) | null>(null)

  // JSON modal state — opened automatically after code is pasted
  const [jsonModalOpen, setJsonModalOpen] = React.useState(false)
  const [jsonModalFilePath, setJsonModalFilePath] = React.useState('')

  // Apply Fixes panel state
  const [applyFixesOpen, setApplyFixesOpen] = React.useState(false)
  const [splitMode, setSplitMode] = React.useState(false)
  const [applyFixesHeight, setApplyFixesHeight] = React.useState(200)

  // Sidebar width — resizable via drag handle
  const [sidebarWidth, setSidebarWidth] = React.useState(240)

  const handleEditorMount = useCallback(
    (api: { runFindReplace: () => void; runFind: () => void }) => {
      findReplaceRef.current = api.runFindReplace
      findRef.current = api.runFind
    },
    []
  )

  // Derive the currently open DB file from useFiles (has full data including jsonSummary)
  const openFile = files.find((f) => f.id === openFileId) ?? null

  const handleContentChange = useCallback(
    (content: string) => {
      if (onContentChange) {
        onContentChange(content)
      }
    },
    [onContentChange]
  )

  const handleMarkComplete = useCallback(async () => {
    if (openFileId && saveFile) {
      await saveFile()
    }
  }, [openFileId, saveFile])

  // ── When openFileId is set (from NextFileBar), temporarily show DB file ──
  // If user explicitly opened a DB file via NextFileBar while in local mode,
  // show the DB editor view for that file so they can paste code and append JSON
  const showingDBFile = !isLocalMode || (!!openFileId && !isLocalMode)

  // ── Local folder not yet assigned — show assign prompt ───────────────────
  if (isLocalMode && !localFolderHandle && !openFileId) {
    return <FolderSetupScreen projectId={projectId} />
  }

  return (
    <>
    <JsonAppendModal
      open={jsonModalOpen}
      onClose={() => { setJsonModalOpen(false); setJsonModalFilePath('') }}
      projectId={projectId}
      prefilledFilePath={jsonModalFilePath}
    />
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: File tree + Apply Fixes panel — resizable + split mode */}
      <div
        style={{ width: sidebarWidth }}
        className="hidden shrink-0 border-r border-[var(--border-subtle)] md:flex md:flex-col relative bg-[var(--bg-secondary)] overflow-hidden h-full"
      >
        {/* Right-edge width resize handle */}
        <div
          onPointerDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startW = sidebarWidth
            const onMove = (ev: PointerEvent) => {
              const newW = Math.max(180, Math.min(600, startW + ev.clientX - startX))
              setSidebarWidth(newW)
            }
            const onUp = () => {
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
          className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize z-20 group"
          title="Drag to resize width"
        >
          <div className="w-full h-full opacity-0 group-hover:opacity-100 bg-[var(--accent-primary)]/50 transition-opacity duration-150" />
        </div>

        {splitMode ? (
          <div className="flex flex-col w-full h-full overflow-hidden" style={{ position: 'absolute', inset: 0 }}>
            <div
              className="flex flex-col overflow-hidden"
              style={{ height: `calc(100% - ${applyFixesHeight}px - 6px)`, minHeight: 120 }}
            >
              <EditorFileTree
                projectId={projectId}
                onFind={() => findRef.current?.()}
                onFindReplace={() => findReplaceRef.current?.()}
              />
            </div>
            <div
              onPointerDown={(e) => {
                e.preventDefault()
                const startY = e.clientY
                const startH = applyFixesHeight
                const onMove = (ev: PointerEvent) => {
                  const newH = Math.max(120, Math.min(700, startH - (ev.clientY - startY)))
                  setApplyFixesHeight(newH)
                }
                const onUp = () => {
                  window.removeEventListener('pointermove', onMove)
                  window.removeEventListener('pointerup', onUp)
                }
                window.addEventListener('pointermove', onMove)
                window.addEventListener('pointerup', onUp)
              }}
              className="flex-shrink-0 h-1.5 cursor-ns-resize bg-[var(--border-subtle)] hover:bg-[var(--accent-primary)]/40 transition-colors duration-150 flex items-center justify-center group"
            >
              <div className="w-10 h-0.5 rounded-full bg-[var(--border-emphasis)] group-hover:bg-[var(--accent-primary)] transition-colors duration-150" />
            </div>
            <div
              className="flex flex-col overflow-hidden border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]"
              style={{ height: applyFixesHeight }}
            >
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-primary)]">Auto Apply Fixes</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSplitMode(false)}
                  title="Exit split mode"
                  className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-all duration-150"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ApplyFixesView projectId={projectId} compact />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={cn('flex flex-col overflow-hidden', applyFixesOpen ? 'flex-1 min-h-0' : 'flex-1')}>
              <EditorFileTree
                projectId={projectId}
                onFind={() => findRef.current?.()}
                onFindReplace={() => findReplaceRef.current?.()}
              />
            </div>
            <div className="flex-shrink-0 border-t border-[var(--border-subtle)]">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setApplyFixesOpen((v) => !v)}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all duration-150',
                    applyFixesOpen
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
                  )}
                >
                  <FileEdit className="h-3 w-3 flex-shrink-0" />
                  <span className="flex-1 text-left">Auto Apply Fixes</span>
                  {applyFixesOpen
                    ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    : <ChevronRight className="h-3 w-3 flex-shrink-0 rotate-90" />
                  }
                </button>
                <button
                  type="button"
                  onClick={() => { setSplitMode(true); setApplyFixesOpen(false) }}
                  title="Split mode — file tree and fixes visible at once"
                  className="flex-shrink-0 flex items-center justify-center w-8 h-8 border-l border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-light)] transition-all duration-150"
                >
                  <PanelBottomOpen className="h-3.5 w-3.5" />
                </button>
              </div>
              {applyFixesOpen && (
                <div
                  className="flex flex-col bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]"
                  style={{ height: applyFixesHeight }}
                >
                  <div
                    onPointerDown={(e) => {
                      e.preventDefault()
                      const startY = e.clientY
                      const startH = applyFixesHeight
                      const onMove = (ev: PointerEvent) => {
                        const newH = Math.max(120, Math.min(700, startH - (ev.clientY - startY)))
                        setApplyFixesHeight(newH)
                      }
                      const onUp = () => {
                        window.removeEventListener('pointermove', onMove)
                        window.removeEventListener('pointerup', onUp)
                      }
                      window.addEventListener('pointermove', onMove)
                      window.addEventListener('pointerup', onUp)
                    }}
                    className="flex-shrink-0 h-2.5 cursor-ns-resize flex items-center justify-center group hover:bg-[var(--accent-primary)]/8 transition-colors duration-150"
                    title="Drag to resize height"
                  >
                    <div className="w-10 h-0.5 rounded-full bg-[var(--border-emphasis)] group-hover:bg-[var(--accent-primary)] transition-colors duration-150" />
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <ApplyFixesView projectId={projectId} compact />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Pinned top bar */}
        <EditorTopBar
          file={openFile as Parameters<typeof EditorTopBar>[0]['file']}
          onMarkComplete={handleMarkComplete}
          projectId={projectId}
          onOpenJsonModal={(filePath) => {
            setJsonModalFilePath(filePath)
            setJsonModalOpen(true)
          }}
        />

        {/* Monaco editor fills remaining height */}
        <div className="flex-1 overflow-hidden">
          <MonacoEditorWrapper
            file={openFile as FileWithContent | null}
            onContentChange={handleContentChange}
            isLocalMode={isLocalMode}
            openLocalPath={openLocalPath}
            onEditorMount={handleEditorMount}
            onCodePasted={(filePath) => {
              setJsonModalFilePath(filePath)
              setJsonModalOpen(true)
            }}
          />
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Apply Fixes View ─────────────────────────────────────────────────────────
// Paste Claude's structured fix response → DevForge auto-applies all changes
// to local files via FileSystemFileHandle without any manual search/replace.

interface FixEntry {
  file: string
  search: string
  replace: string
}

interface ApplyFixesResult {
  file: string
  status: 'applied' | 'not_found' | 'error' | 'no_handle'
  message: string
}

// Prompt templates that enforce Claude to always respond in parseable format
const GCD_FILE_REQUEST_PROMPT = `You are reviewing a codebase to identify which files need to be read before fixing the issues described.

Respond with ONLY a JSON object in this exact format — no prose, no explanation:

\`\`\`json
{
  "files": [
    "exact/path/from/project/root.ts",
    "another/file/path.tsx"
  ],
  "reason": "one sentence explaining why these files are needed"
}
\`\`\`

RULES:
- List ONLY files that are directly relevant to the fix
- Use exact paths as they appear in the project structure
- Maximum 10 files
- NO text before or after the JSON object

Here is the Global Context Document and the issue to fix:`

const FIX_PROMPTS = {
  bug: `You are fixing bugs in a codebase. Respond with ONLY a JSON array — no prose, no explanation, no markdown outside the array.

FORMAT (mandatory):
\`\`\`json
[
  {
    "file": "exact/path/from/project/root.ts",
    "search": "exact existing code to find",
    "replace": "exact replacement code"
  }
]
\`\`\`

FILE PATH RULES:
- Use forward slashes only: "src/hooks/useProject.ts" NOT "src\\hooks\\useProject.ts"
- No leading slash: "src/hooks/useProject.ts" NOT "/src/hooks/useProject.ts"
- No leading dot-slash: "src/hooks/useProject.ts" NOT "./src/hooks/useProject.ts"

CRITICAL RULES FOR search STRING:
- search must appear EXACTLY ONCE in the entire file — this is the most important rule
- Use enough lines to be unique — for large files (500+ lines) use 3-6 lines minimum
- Always include the full line(s) — never truncate, never use ellipsis, copy character for character including all whitespace and indentation
- Include surrounding context lines if the target line alone could appear elsewhere
- For a function: include the full function signature line as the anchor
- For JSX: include the full opening tag with all its props as the anchor
- replace can be ANY length — put the complete new code here, no limits

COMPLETENESS RULES — NEVER break anything:
- replace must be 100% complete — no placeholders, no '// ... existing code ...', no '// TODO'
- Every import, every function, every handler must be fully written
- Never guess types, props, or variable names — only use what you can see in the provided files
- If a function needs to stay unchanged, copy it exactly into replace
- Never omit closing brackets, braces, or tags

JSON ENCODING RULES:
- Backslashes in code must be doubled in JSON: \\\\ not \\
- Backticks, template literals, dollar signs are all safe in JSON strings
- Multi-line search/replace: keep each entry to a SINGLE LINE where possible
- If you must include multiple lines, use \\n to represent newlines inside the JSON string value
- NEVER include a literal line break inside a JSON string value — this makes the JSON invalid

SEARCH STRING UNIQUENESS RULE:
- If your single-line search might appear more than once in the file, add the line immediately before OR after it to make it unique
- The combined string must appear EXACTLY ONCE — test mentally before writing
- For large files like workspace/page.tsx (2000+ lines): always use at least 2 lines

Other rules:
- One object per change location — multiple objects for multiple files or spots
- NO text before or after the JSON array
- NO explanation of what you changed

IMPORTANT: JSON handles ALL special characters safely. Always use JSON array format only. Never any other format.

Now describe the bug:`,

  feature_modify: `You are modifying an existing feature. Respond with ONLY a JSON array.

FORMAT (mandatory):
\`\`\`json
[
  {
    "file": "exact/path/from/project/root.ts",
    "search": "exact existing code to replace",
    "replace": "new code"
  }
]
\`\`\`

FILE PATH RULES:
- Use forward slashes only: "src/hooks/useProject.ts" NOT "src\\hooks\\useProject.ts"
- No leading slash: "src/hooks/useProject.ts" NOT "/src/hooks/useProject.ts"
- No leading dot-slash: "src/hooks/useProject.ts" NOT "./src/hooks/useProject.ts"

CRITICAL RULES FOR search STRING:
- search must appear EXACTLY ONCE in the entire file — this is the most important rule
- Use enough lines to be unique — for large files (500+ lines) use 3-6 lines minimum
- Always include the full line(s) — never truncate, never use ellipsis, copy character for character including all whitespace and indentation
- Include surrounding context lines if the target line alone could appear elsewhere
- replace can be ANY length — put the complete new code here, no limits

COMPLETENESS RULES — NEVER break anything:
- replace must be 100% complete — no placeholders, no '// ... existing code ...', no '// TODO'
- Every import, every function, every handler must be fully written
- Never guess types, props, or variable names — only use what you can see in the provided files
- Never omit closing brackets, braces, or tags

JSON ENCODING RULES:
- Backslashes in code must be doubled in JSON: \\\\ not \\
- Backticks, template literals, dollar signs are all safe in JSON strings
- Multi-line search/replace: keep each entry to a SINGLE LINE where possible
- If you must include multiple lines, use \\n to represent newlines inside the JSON string value
- NEVER include a literal line break inside a JSON string value — this makes the JSON invalid

SEARCH STRING UNIQUENESS RULE:
- If your single-line search might appear more than once in the file, add the line immediately before OR after it to make it unique
- The combined string must appear EXACTLY ONCE — test mentally before writing
- For large files like workspace/page.tsx (2000+ lines): always use at least 2 lines

Other rules:
- One entry per change location — multiple entries for multiple files or spots
- NO prose, NO explanation — ONLY the JSON array

IMPORTANT: JSON handles ALL special characters safely. Always use JSON array format only. Never any other format.

Describe the feature modification:`,

  feature_add: `You are adding a new feature by modifying existing files. Respond with ONLY a JSON array.

FORMAT (mandatory):
\`\`\`json
[
  {
    "file": "exact/path/from/project/root.ts",
    "search": "existing anchor code to insert near",
    "replace": "anchor code + new code added"
  }
]
\`\`\`

FILE PATH RULES:
- Use forward slashes only: "src/hooks/useProject.ts" NOT "src\\hooks\\useProject.ts"
- No leading slash: "src/hooks/useProject.ts" NOT "/src/hooks/useProject.ts"
- No leading dot-slash: "src/hooks/useProject.ts" NOT "./src/hooks/useProject.ts"

CRITICAL RULES FOR search STRING:
- search must appear EXACTLY ONCE in the file — this is the most important rule
- Use enough lines to be unique — for large files (500+ lines) use 3-6 lines minimum
- Always include the full line(s) with exact whitespace and indentation
- NEVER use empty string for search
- replace can be ANY length — include the anchor line PLUS all the new code to insert
- Always include the original anchor line in replace so nothing is deleted accidentally

COMPLETENESS RULES — NEVER break anything:
- replace must be 100% complete — no placeholders, no '// ... existing code ...', no '// TODO'
- Every new function, handler, import must be fully written
- Never guess types or variable names — only use what you see in the provided files

JSON ENCODING RULES:
- Backslashes in code must be doubled in JSON: \\\\ not \\
- Backticks, template literals, dollar signs are all safe in JSON strings
- Multi-line search/replace: keep each entry to a SINGLE LINE where possible
- If you must include multiple lines, use \\n to represent newlines inside the JSON string value
- NEVER include a literal line break inside a JSON string value — this makes the JSON invalid

SEARCH STRING UNIQUENESS RULE:
- If your single-line search might appear more than once in the file, add the line immediately before OR after it to make it unique
- The combined string must appear EXACTLY ONCE — test mentally before writing
- For large files like workspace/page.tsx (2000+ lines): always use at least 2 lines

Other rules:
- NO explanation — ONLY the JSON array

IMPORTANT: JSON handles ALL special characters safely. Always use JSON array format only. Never any other format.

Describe the feature to add:`,

  refactor: `You are refactoring code. Respond with ONLY a JSON array of changes.

FORMAT (mandatory):
\`\`\`json
[
  {
    "file": "exact/path/from/project/root.ts",
    "search": "exact code to refactor",
    "replace": "refactored version"
  }
]
\`\`\`

FILE PATH RULES:
- Use forward slashes only: "src/hooks/useProject.ts" NOT "src\\hooks\\useProject.ts"
- No leading slash: "src/hooks/useProject.ts" NOT "/src/hooks/useProject.ts"
- No leading dot-slash: "src/hooks/useProject.ts" NOT "./src/hooks/useProject.ts"

CRITICAL RULES FOR search STRING:
- search must appear EXACTLY ONCE in the file — this is the most important rule
- Use enough lines to be unique — for large files (500+ lines) use 3-6 lines minimum
- Always include the full line(s) with exact whitespace and indentation — never truncate
- replace can be ANY length — write the complete refactored version

COMPLETENESS RULES — NEVER break anything:
- replace must be 100% complete — preserve all existing functionality
- No placeholders, no '// ... existing code ...', no '// TODO'
- Every function signature, every type annotation must be preserved or explicitly changed
- Never omit closing brackets, braces, or tags

JSON ENCODING RULES:
- Backslashes in code must be doubled in JSON: \\\\ not \\
- Backticks, template literals, dollar signs are all safe in JSON strings
- Multi-line search/replace: keep each entry to a SINGLE LINE where possible
- If you must include multiple lines, use \\n to represent newlines inside the JSON string value
- NEVER include a literal line break inside a JSON string value — this makes the JSON invalid

SEARCH STRING UNIQUENESS RULE:
- If your single-line search might appear more than once in the file, add the line immediately before OR after it to make it unique
- The combined string must appear EXACTLY ONCE — test mentally before writing
- For large files like workspace/page.tsx (2000+ lines): always use at least 2 lines

Other rules:
- NO explanation — ONLY the JSON array

IMPORTANT: JSON handles ALL special characters safely. Always use JSON array format only. Never any other format.

Describe what to refactor:`,

  typescript_fix: `You are fixing TypeScript errors. Respond with ONLY a JSON array.

FORMAT (mandatory):
\`\`\`json
[
  {
    "file": "exact/path/from/project/root.ts",
    "search": "exact line(s) with the type error",
    "replace": "corrected line(s) with proper types"
  }
]
\`\`\`

FILE PATH RULES:
- Use forward slashes only: "src/hooks/useProject.ts" NOT "src\\hooks\\useProject.ts"
- No leading slash: "src/hooks/useProject.ts" NOT "/src/hooks/useProject.ts"
- No leading dot-slash: "src/hooks/useProject.ts" NOT "./src/hooks/useProject.ts"

CRITICAL RULES FOR search STRING:
- search must appear EXACTLY ONCE in the file — this is the most important rule
- For TypeScript errors: include the full line reported in the error PLUS 1-2 surrounding lines for uniqueness
- Always copy exact whitespace and indentation — TypeScript files are indentation-sensitive
- For type annotation errors: include the full variable/function declaration line
- For import errors: include the full import statement line
- replace can be ANY length — write the complete fixed version

COMPLETENESS RULES — NEVER break anything:
- Fix the type error without changing runtime behavior
- replace must be 100% complete — no placeholders
- If fix requires a new import, add a separate entry targeting the existing import block
- Never guess types — only use types visible in the provided files

JSON ENCODING RULES:
- Backslashes in code must be doubled in JSON: \\\\ not \\
- Backticks, template literals, dollar signs are all safe in JSON strings
- Multi-line search/replace: keep each entry to a SINGLE LINE where possible
- If you must include multiple lines, use \\n to represent newlines inside the JSON string value
- NEVER include a literal line break inside a JSON string value — this makes the JSON invalid

SEARCH STRING UNIQUENESS RULE:
- If your single-line search might appear more than once in the file, add the line immediately before OR after it to make it unique
- The combined string must appear EXACTLY ONCE — test mentally before writing
- For large files like workspace/page.tsx (2000+ lines): always use at least 2 lines

Other rules:
- NO explanation — ONLY the JSON array

IMPORTANT: JSON handles ALL special characters safely. Always use JSON array format only. Never any other format.

Paste the TypeScript error output:`,
}

function ApplyFixesView({ projectId, compact = false }: { projectId: string; compact?: boolean }): JSX.Element {
  const { getLocalState } = useEditorStore()
  const { document: docData } = useDocument(projectId)
  const [input, setInput] = React.useState('')
  const [results, setResults] = React.useState<ApplyFixesResult[]>([])
  const [isApplying, setIsApplying] = React.useState(false)
  const [parsed, setParsed] = React.useState<FixEntry[] | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [copiedPrompt, setCopiedPrompt] = React.useState<string | null>(null)
  const [activePrompt, setActivePrompt] = React.useState<keyof typeof FIX_PROMPTS | null>(null)
  const [flashedFiles, setFlashedFiles] = React.useState<Set<string>>(new Set())
  const [fileListInput, setFileListInput] = React.useState('')
  const [parsedFileList, setParsedFileList] = React.useState<string[]>([])
  const [fileListParseError, setFileListParseError] = React.useState<string | null>(null)
const [copiedFiles, setCopiedFiles] = React.useState(false)
  const [activeStep, setActiveStep] = React.useState<1 | 2 | 3>(1)
  const [copiedGcd, setCopiedGcd] = React.useState(false)

const parsePlainText = React.useCallback((raw: string): FixEntry[] | null => {
    const entries: FixEntry[] = []
    const blocks = (raw.trimEnd() + '\n---').split(/^---[ \t]*$/m).map((b) => b.trim()).filter(Boolean)
    if (blocks.length === 0) return null
    for (const block of blocks) {
      const fileMatch = block.match(/^FILE:\s*(.+)$/m)
      const searchIdx = block.indexOf('SEARCH:\n')
      const replaceIdx = block.indexOf('REPLACE:\n')
      if (!fileMatch || searchIdx === -1 || replaceIdx === -1) return null
      const searchStart = searchIdx + 'SEARCH:\n'.length
      const searchEnd = replaceIdx
      const replaceStart = replaceIdx + 'REPLACE:\n'.length
      const file = fileMatch[1].trim()
      const search = block.slice(searchStart, searchEnd).trim()
      const replace = block.slice(replaceStart).trim()
      if (!file || !search) return null
      entries.push({ file, search, replace })
    }
    return entries.length > 0 ? entries : null
  }, [])

  // Parse input whenever it changes — tries JSON first, then plain-text format
  React.useEffect(() => {
    if (!input.trim()) {
      setParsed(null)
      setParseError(null)
      return
    }
    // ── Attempt 1: JSON format ──
    try {
      let jsonStr: string
      // Find the JSON array by locating the first [ and matching its closing ]
      // This is more robust than regex — handles nested backticks in replace values
      const firstBracket = input.indexOf('[')
      const lastBracket = input.lastIndexOf(']')
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        jsonStr = input.slice(firstBracket, lastBracket + 1).trim()
      } else {
        throw new Error('no JSON array found')
      }
      jsonStr = jsonStr.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      // Sanitize literal newlines inside JSON string values — Claude sometimes
      // writes multi-line strings without \n escaping, making the JSON invalid.
      // This regex replaces literal newlines that appear inside quoted strings
      // with the escaped \n sequence so JSON.parse succeeds.
      jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.|\n|\r)*)"/gm, (match) =>
        match.replace(/\r\n/g, '\\n').replace(/\r/g, '\\n').replace(/\n/g, '\\n')
      )
      const data = JSON.parse(jsonStr) as unknown
      if (!Array.isArray(data)) throw new Error('not an array')
      for (const entry of data) {
        if (typeof (entry as Record<string, unknown>).file !== 'string') throw new Error('missing file')
        if (typeof (entry as Record<string, unknown>).search !== 'string') throw new Error('missing search')
        if (typeof (entry as Record<string, unknown>).replace !== 'string') throw new Error('missing replace')
      }
      // Unescape \n sequences in search/replace so content.includes() works
      const entries = (data as FixEntry[]).map((e) => ({
        file: e.file,
        search: e.search.replace(/\\n/g, '\n').replace(/\\t/g, '\t'),
        replace: e.replace.replace(/\\n/g, '\n').replace(/\\t/g, '\t'),
      }))
      setParsed(entries)
      setParseError(null)
      return
    } catch {
      // JSON failed — try plain-text format
    }
    // ── Attempt 2: Plain-text format ──
    // Expected format:
    // FILE: path/to/file.ts
    // SEARCH:
    // exact code to find
    // REPLACE:
    // new code
    // ---
    if (input.includes('FILE:') && input.includes('SEARCH:') && input.includes('REPLACE:')) {
      const plainResult = parsePlainText(input)
      if (plainResult) {
        setParsed(plainResult)
        setParseError(null)
        return
      }
    }
    setParsed(null)
        setParseError('Could not parse — paste the JSON array exactly as Claude returned it. Make sure the response starts with [ and contains objects with "file", "search", and "replace" keys.')
  }, [input, parsePlainText])

  // Parse Claude's file list response
  const parseFileListResponse = React.useCallback((raw: string) => {
    if (!raw.trim()) {
      setParsedFileList([])
      setFileListParseError(null)
      return
    }
    try {
      const fenceStart2 = raw.indexOf('```')
      let jsonStr: string = raw.trim()
      if (fenceStart2 !== -1) {
        const afterFence2 = raw.indexOf('\n', fenceStart2) + 1
        const closeFence2 = raw.indexOf('```', afterFence2)
        jsonStr = closeFence2 !== -1 ? raw.slice(afterFence2, closeFence2).trim() : raw.slice(afterFence2).trim()
      }
      const data = JSON.parse(jsonStr) as unknown
      if (typeof data !== 'object' || data === null || !Array.isArray((data as Record<string, unknown>).files)) {
        throw new Error('Response must have a "files" array')
      }
      const files = (data as { files: unknown[] }).files
      if (!files.every((f) => typeof f === 'string')) {
        throw new Error('All entries in "files" must be strings')
      }
      setParsedFileList(files as string[])
      setFileListParseError(null)
    } catch (e) {
      setParsedFileList([])
      setFileListParseError(e instanceof Error ? e.message : 'Invalid format')
    }
  }, [])

  // Read all requested files from local folder and copy to clipboard
  const handleCopyRequestedFiles = React.useCallback(async () => {
    if (parsedFileList.length === 0) return
    const { localFileTree } = getLocalState(projectId)
    if (!localFileTree || localFileTree.length === 0) {
      alert('No local folder linked. Link your project folder in the Editor tab first.')
      return
    }

    const sep = '═'.repeat(60)
    const blocks: string[] = []
    const notFound: string[] = []

    for (const rawFilePath of parsedFileList) {
      const filePath = rawFilePath.replace(/^\.\//, '').replace(/\\/g, '/')
      const handle = findHandle(localFileTree, filePath)
      if (!handle) {
        notFound.push(filePath)
        blocks.push(`${sep}\nFILE: ${filePath}\n${sep}\n[FILE NOT FOUND IN LOCAL FOLDER]`)
        continue
      }
      try {
        const file = await handle.getFile()
        const content = await file.text()
        blocks.push(`${sep}\nFILE: ${filePath}\n${sep}\n${content}`)
      } catch {
        blocks.push(`${sep}\nFILE: ${filePath}\n${sep}\n[COULD NOT READ FILE]`)
      }
    }

    const fixInstruction = `\n\n${sep}\nNOW PROVIDE FIXES\n${sep}\n\nYou have read all the files above. Now provide ALL fixes as a JSON array:\n\n[\n  {\n    "file": "exact/path/from/project/root.ts",\n    "search": "exact unique line to find — must appear EXACTLY ONCE in the file",\n    "replace": "complete replacement code"\n  }\n]\n\nSEARCH STRING RULES:\n- Keep search to a SINGLE LINE where possible — most reliable\n- search must appear EXACTLY ONCE — add surrounding line if not unique\n- Copy exact whitespace and indentation character for character\n- If multi-line needed: use \\\\n inside the JSON string, NEVER literal line breaks\n- Forward slashes in file paths, no leading ./ or /\n\nONLY the JSON array in your response. No explanation before or after.`

    const combined = blocks.join('\n\n') + fixInstruction

    await navigator.clipboard.writeText(combined)
    setCopiedFiles(true)
    setActiveStep(3)
    setTimeout(() => setCopiedFiles(false), 2500)
  }, [parsedFileList, projectId, getLocalState])

  // Walk local file tree to find a handle by path
  function findHandle(
    nodes: import('@/store/editorStore').LocalFileNode[],
    targetPath: string
  ): FileSystemFileHandle | null {
    const norm = (p: string) => p.replace(/^\/+/, '').replace(/\\/g, '/')
    const target = norm(targetPath)
    for (const node of nodes) {
      if (node.type === 'file') {
        const nodePath = norm(node.path)
        if (nodePath === target || nodePath.endsWith('/' + target)) {
          return node.handle as FileSystemFileHandle
        }
      }
      if (node.type === 'folder' && node.children) {
        const found = findHandle(node.children, targetPath)
        if (found) return found
      }
    }
    return null
  }

  const handleApply = React.useCallback(async () => {
    if (!parsed || parsed.length === 0) return
    const { localFileTree } = getLocalState(projectId)

    if (!localFileTree || localFileTree.length === 0) {
      setResults([{
        file: 'all',
        status: 'no_handle',
        message: 'No local folder linked. Open the Editor tab and link your project folder first.',
      }])
      return
    }

    setIsApplying(true)
    setResults([])
    const newResults: ApplyFixesResult[] = []

    for (const entry of parsed) {
      const normalizedEntryFile = entry.file.replace(/^\.\//, '').replace(/\\/g, '/')
      const handle = findHandle(localFileTree, normalizedEntryFile)
      if (!handle) {
        newResults.push({
          file: normalizedEntryFile,
          status: 'no_handle',
          message: `File not found in linked folder: ${normalizedEntryFile}`,
        })
        continue
      }

      try {
        const file = await handle.getFile()
        const rawContent = await file.text()

        // Guard: never proceed if the file content is empty — this would wipe the file
        if (!rawContent.trim()) {
          newResults.push({
            file: normalizedEntryFile,
            status: 'error',
            message: `Skipped ${normalizedEntryFile} — file appears to be empty on disk. Cannot apply search/replace to an empty file.`,
          })
          continue
        }

        // Normalize line endings — fixes Windows CRLF vs Unix LF mismatch
        const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        const content = normalize(rawContent)
        const normalizedSearch = normalize(entry.search)
        const normalizedReplace = normalize(entry.replace)

        // Count occurrences — warn if ambiguous
        const occurrenceCount = content.split(normalizedSearch).length - 1
        if (occurrenceCount > 1) {
          // Ambiguous match — report clearly and skip WITHOUT touching the file
          newResults.push({
            file: normalizedEntryFile,
            status: 'error',
            message: `Ambiguous: search text found ${occurrenceCount} times in ${normalizedEntryFile} — file was NOT modified. Add 1-2 surrounding lines to make it unique.`,
          })
          continue
        }
        if (!content.includes(normalizedSearch)) {
          // Fallback: try matching with normalized indentation
          // Claude sometimes omits or wrong-guesses leading indentation
          const searchLines = normalizedSearch.split('\n')
          const contentLines = content.split('\n')
          let matchStartLine = -1
          const firstSearchTrimmed = searchLines[0].trim()
          if (firstSearchTrimmed) {
            for (let li = 0; li < contentLines.length; li++) {
              if ((contentLines[li] ?? '').trim() === firstSearchTrimmed) {
                let allMatch = true
                for (let si = 1; si < searchLines.length; si++) {
                  const contentLine = contentLines[li + si]
                  const searchLine = searchLines[si]
                  if (contentLine === undefined || contentLine.trim() !== (searchLine ?? '').trim()) {
                    allMatch = false
                    break
                  }
                }
                if (allMatch) { matchStartLine = li; break }
              }
            }
          }
          if (matchStartLine === -1) {
            newResults.push({
              file: normalizedEntryFile,
              status: 'not_found',
              message: `Search string not found in ${normalizedEntryFile}. Check that the search text matches the file content.`,
            })
            continue
          }
          // Rebuild search with correct indentation from the actual file
          const actualIndent = (contentLines[matchStartLine] ?? '').match(/^(\s*)/)?.[1] ?? ''
          const searchIndent = (searchLines[0] ?? '').match(/^(\s*)/)?.[1] ?? ''
          const reindentedSearch = searchLines
            .map((line, idx) => {
              if (idx === 0) return contentLines[matchStartLine] ?? line
              const withoutSearchIndent = line.startsWith(searchIndent) ? line.slice(searchIndent.length) : line.trim()
              return withoutSearchIndent ? actualIndent + withoutSearchIndent : line
            })
            .join('\n')
          if (!content.includes(reindentedSearch)) {
            newResults.push({
              file: normalizedEntryFile,
              status: 'not_found',
              message: `Search string not found in ${normalizedEntryFile}. Check that the search text matches the file content.`,
            })
            continue
          }
          const reindentedReplace = normalizedReplace.split('\n')
            .map((line, idx) => {
              if (idx === 0) return line.trim() ? actualIndent + line.trim() : line
              const withoutSearchIndent = line.startsWith(searchIndent) ? line.slice(searchIndent.length) : line.trim()
              return withoutSearchIndent ? actualIndent + withoutSearchIndent : line
            })
            .join('\n')
          const newContent = content.replace(reindentedSearch, reindentedReplace)
          // Guard against accidentally writing empty content
          if (!newContent.trim()) {
            newResults.push({
              file: normalizedEntryFile,
              status: 'error',
              message: `Aborted write to ${normalizedEntryFile} — replacement would have produced an empty file. File was NOT modified.`,
            })
            continue
          }
          const writable = await handle.createWritable()
          await writable.write(newContent)
          await writable.close()
          newResults.push({
            file: normalizedEntryFile,
            status: 'applied',
            message: `Applied to ${normalizedEntryFile} (indentation auto-corrected)`,
          })
          continue
        }

        // Replace and write back — guard against accidentally writing empty content
        const newContent = content.replace(normalizedSearch, normalizedReplace)
        if (!newContent.trim()) {
          newResults.push({
            file: normalizedEntryFile,
            status: 'error',
            message: `Aborted write to ${normalizedEntryFile} — replacement would have produced an empty file. File was NOT modified.`,
          })
          continue
        }
        const writable = await handle.createWritable()
        await writable.write(newContent)
        await writable.close()

        newResults.push({
          file: normalizedEntryFile,
          status: 'applied',
          message: `Applied to ${normalizedEntryFile}`,
        })
      } catch (e) {
        newResults.push({
          file: normalizedEntryFile,
          status: 'error',
          message: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`,
        })
      }
    }

    setResults(newResults)
    setIsApplying(false)

    // Flash applied files with color for 2.5 seconds
    const appliedFiles = new Set(
      newResults.filter((r) => r.status === 'applied').map((r) => r.file)
    )
    if (appliedFiles.size > 0) {
      setFlashedFiles(appliedFiles)
      setTimeout(() => setFlashedFiles(new Set()), 2500)
    }

    // Re-read changed files into editor if currently open
    const { openLocalHandle, openLocalPath } = getLocalState(projectId)
    if (openLocalHandle && openLocalPath) {
      const wasChanged = newResults.some(
        (r) => r.status === 'applied' &&
        (openLocalPath.endsWith(r.file) || r.file.endsWith(openLocalPath.replace(/^\/+/, '')))
      )
      if (wasChanged) {
        try {
          const f = await openLocalHandle.getFile()
          const text = await f.text()
          useEditorStore.getState().setContent(text)
        } catch { /* handle stale — skip */ }
      }
    }
  }, [parsed, projectId, getLocalState])

  const handleCopyPrompt = React.useCallback(async (key: keyof typeof FIX_PROMPTS) => {
    await navigator.clipboard.writeText(FIX_PROMPTS[key])
    setCopiedPrompt(key)
    setActivePrompt(key)
    setTimeout(() => setCopiedPrompt(null), 2000)
  }, [])

  const appliedCount = results.filter((r) => r.status === 'applied').length
  const failedCount = results.filter((r) => r.status !== 'applied').length

  return (
    <div className={cn('flex flex-col', compact ? 'gap-3 p-2' : 'gap-5 p-4 max-w-4xl mx-auto')}>
      {/* Header — hidden in compact mode (toggle button serves as header) */}
      {!compact && (
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-[var(--accent-primary)]" />
            Auto Apply Fixes
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Copy a prompt below → paste into Claude → copy Claude's response → paste here → DevForge applies all changes automatically to your local files.
          </p>
        </div>
      )}

      {/* ── FLOW A: GCD-based file review ── */}
      <div className={cn('rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] space-y-2', compact ? 'p-2' : 'p-4 space-y-3')}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {compact ? 'Flow A — GCD + errors' : 'Flow A — Paste GCD + errors → Claude tells you which files to review'}
        </p>

        {/* Step A1 — copy GCD + file-request prompt */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {compact ? 'A1. Copy GCD' : 'A1. Copy your Global Context Document — paste it into Claude first'}
          </p>
          <button
            type="button"
            onClick={async () => {
              const gcd = docData?.rawContent ?? ''
              if (!gcd) { alert('No GCD found. Import your Global Context Document first.'); return }
              await navigator.clipboard.writeText(gcd)
              setCopiedGcd(true)
              setTimeout(() => setCopiedGcd(false), 2500)
            }}
            className={cn(
              'w-full flex items-center justify-center gap-2 h-7 rounded-lg text-xs font-medium border transition-all duration-150',
              copiedGcd
                ? 'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                : docData?.rawContent
                ? 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] hover:bg-[var(--bg-quaternary)]'
                : 'border-[var(--border-subtle)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50'
            )}
            disabled={!docData?.rawContent}
          >
            {copiedGcd
              ? <><CheckCheck className="h-3 w-3" /> GCD Copied!</>
              : <><Copy className="h-3 w-3" /> {compact ? 'Copy GCD' : `Copy GCD${docData?.rawContent ? ` (~${Math.ceil((docData.rawContent.length / 1000))}k chars)` : ' — no doc found'}`}</>
            }
          </button>
        </div>

        {/* Step A1b — copy the file-request prompt */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {compact ? 'A1b. Copy prompt' : 'A1b. Copy this prompt → paste into Claude after the GCD with your error description'}
          </p>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(GCD_FILE_REQUEST_PROMPT)
              setCopiedPrompt('gcd_request')
              setTimeout(() => setCopiedPrompt(null), 2000)
            }}
            className={cn(
              'w-full flex items-center justify-center gap-2 h-7 rounded-lg text-xs font-medium border transition-all duration-150',
              copiedPrompt === 'gcd_request'
                ? 'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                : 'border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white'
            )}
          >
            {copiedPrompt === 'gcd_request'
              ? <><CheckCheck className="h-3 w-3" /> Copied!</>
              : <><Copy className="h-3 w-3" /> Copy File-Request Prompt</>
            }
          </button>
        </div>

        {/* Step A2 — paste Claude's file list response */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-[var(--text-tertiary)]">
            {compact ? 'A2. Paste file list' : 'A2. Paste Claude\'s response — DevForge will read those files and copy them for you'}
          </p>
          <textarea
            value={fileListInput}
            onChange={(e) => { setFileListInput(e.target.value); parseFileListResponse(e.target.value) }}
            placeholder={'Paste Claude\'s file list response here…'}
            rows={compact ? 3 : 4}
            spellCheck={false}
            className={cn(
              'w-full resize-y rounded-md border px-3 py-2 font-mono text-xs',
              'bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
              'outline-none transition-colors duration-150 focus:ring-1',
              fileListParseError && fileListInput.trim()
                ? 'border-[var(--status-error)] focus:ring-[var(--status-error)]'
                : parsedFileList.length > 0
                ? 'border-[var(--status-complete)] focus:ring-[var(--status-complete)]'
                : 'border-[var(--border-default)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-primary)]'
            )}
          />
          {fileListParseError && fileListInput.trim() && (
            <p className="flex items-center gap-1 text-[10px] text-[var(--status-error)]">
              <XCircle className="h-3 w-3 flex-shrink-0" />{fileListParseError}
            </p>
          )}
          {parsedFileList.length > 0 && (
            <div className="space-y-1">
              {parsedFileList.map((f, i) => (
                <p key={i} className="text-[10px] font-mono text-[var(--accent-primary)] truncate">
                  • {f}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Step A3 — copy all files + fix prompt */}
        {parsedFileList.length > 0 && (
          <button
            type="button"
            onClick={handleCopyRequestedFiles}
            className={cn(
              'w-full flex items-center justify-center gap-2 h-7 rounded-lg text-xs font-medium transition-all duration-150',
              copiedFiles
                ? 'bg-[var(--status-complete-bg)] border border-[var(--status-complete)]/40 text-[var(--status-complete)]'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white active:scale-95'
            )}
          >
            {copiedFiles
              ? <><CheckCheck className="h-3 w-3" /> Copied {parsedFileList.length} files!</>
              : <><Sparkles className="h-3 w-3" /> Copy {parsedFileList.length} file{parsedFileList.length !== 1 ? 's' : ''} + Fix Prompt</>
            }
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        <span className="text-[10px] text-[var(--text-tertiary)]">or use a quick prompt</span>
        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
      </div>

      {/* ── FLOW B: Quick prompt buttons ── */}
      <div className={cn('rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] space-y-2', compact ? 'p-2' : 'p-4 space-y-3')}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {compact ? 'Flow B — Quick prompt' : 'Flow B — Copy a quick prompt and describe the fix directly to Claude'}
        </p>
        <div className={cn('gap-1.5', compact ? 'flex flex-col' : 'grid grid-cols-2 md:grid-cols-3 gap-2')}>
          {(Object.keys(FIX_PROMPTS) as Array<keyof typeof FIX_PROMPTS>).map((key) => {
            const labels: Record<keyof typeof FIX_PROMPTS, { label: string; shortLabel: string; icon: JSX.Element; color: string }> = {
              bug: { label: 'Bug Fix', shortLabel: 'Bug Fix', icon: <Bug className="h-3 w-3" />, color: 'var(--status-error)' },
              feature_modify: { label: 'Modify Feature', shortLabel: 'Modify', icon: <GitBranch className="h-3 w-3" />, color: 'var(--accent-primary)' },
              feature_add: { label: 'Add Feature', shortLabel: 'Add Feature', icon: <Plus className="h-3 w-3" />, color: 'var(--status-complete)' },
              refactor: { label: 'Refactor', shortLabel: 'Refactor', icon: <Wand2 className="h-3 w-3" />, color: 'var(--status-in-progress)' },
              typescript_fix: { label: 'TypeScript Fix', shortLabel: 'TS Fix', icon: <AlertCircle className="h-3 w-3" />, color: '#60a5fa' },
            }
            const meta = labels[key]
            const isCopied = copiedPrompt === key
            const isActive = activePrompt === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleCopyPrompt(key)}
                style={{ borderColor: isActive ? meta.color : undefined, color: isActive ? meta.color : undefined }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-150',
                  isActive
                    ? 'bg-[var(--bg-quaternary)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] hover:bg-[var(--bg-quaternary)]'
                )}
              >
                <span style={{ color: meta.color }} className="flex-shrink-0">{meta.icon}</span>
                <span className="truncate">
                  {isCopied ? 'Copied!' : compact ? meta.shortLabel : meta.label}
                </span>
                {isCopied && <CheckCheck className="h-3 w-3 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
        {activePrompt && (
          <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2">
            <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
              <span className="font-semibold text-[var(--accent-primary)]">Prompt copied.</span>{' '}
              Paste it into Claude, add your question/error, and Claude will reply with a JSON array only. Copy Claude's entire response and paste it in Step 2 below.
            </p>
          </div>
        )}
      </div>

      {/* Paste area */}
      <div className={cn('rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] space-y-2', compact ? 'p-2' : 'p-4 space-y-3')}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          {compact ? 'Step 2 — Paste response' : 'Step 2 — Paste Claude\'s response here'}
        </p>
        <textarea
          value={input}
          onChange={(e) => { setInput(e.target.value); setResults([]) }}
          placeholder={compact ? 'Paste JSON or plain-text format here…' : `Paste Claude's JSON response OR plain-text format:\n\nJSON format:\n[\n  { "file": "src/Button.tsx", "search": "const x = 1", "replace": "const x = 2" }\n]\n\nPlain-text format (works with backticks and regex):\nFILE: src/Button.tsx\nSEARCH:\nconst x = 1\nREPLACE:\nconst x = 2\n---`}
          rows={compact ? 5 : 10}
          spellCheck={false}
          className={cn(
            'w-full resize-y rounded-md border px-3 py-2.5 font-mono text-xs',
            'bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'outline-none transition-colors duration-150 focus:ring-1',
            parseError && input.trim()
              ? 'border-[var(--status-error)] focus:ring-[var(--status-error)]'
              : parsed
              ? 'border-[var(--status-complete)] focus:ring-[var(--status-complete)]'
              : 'border-[var(--border-default)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-primary)]'
          )}
        />
        {/* Validation feedback */}
        {parseError && input.trim() && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--status-error)]">
            <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {parseError}
          </p>
        )}
        {parsed && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--status-complete)]">
            <CheckCheck className="h-3.5 w-3.5 flex-shrink-0" />
            {parsed.length} fix{parsed.length !== 1 ? 'es' : ''} parsed across{' '}
            {[...new Set(parsed.map((e) => e.file))].length} file{[...new Set(parsed.map((e) => e.file))].length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Preview of parsed fixes */}
      {parsed && parsed.length > 0 && (
        <div className={cn('rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] space-y-2', compact ? 'p-2' : 'p-4 space-y-3')}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {compact ? 'Step 3 — Apply' : 'Step 3 — Review and Apply'}
          </p>
          <div className={cn('space-y-1.5 overflow-y-auto', compact ? 'max-h-28' : 'max-h-48')}>
            {parsed.map((entry, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2">
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] flex-shrink-0 mt-0.5">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono font-semibold text-[var(--accent-primary)] truncate">{entry.file}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                    search: <span className="text-[var(--text-secondary)]">{entry.search.slice(0, 60)}{entry.search.length > 60 ? '…' : ''}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || !parsed}
            className={cn(
              'w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-all duration-150',
              'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]'
            )}
          >
            {isApplying ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Applying fixes…</>
            ) : (
              <><CheckCheck className="h-4 w-4" /> Apply {parsed.length} fix{parsed.length !== 1 ? 'es' : ''} to local files</>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className={cn('rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] space-y-2', compact ? 'p-2' : 'p-4 space-y-3')}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Results</p>
            <div className="flex items-center gap-3">
              {appliedCount > 0 && (
                <span className="text-xs font-medium text-[var(--status-complete)]">
                  ✓ {appliedCount} applied
                </span>
              )}
              {failedCount > 0 && (
                <span className="text-xs font-medium text-[var(--status-error)]">
                  ✗ {failedCount} failed
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2 text-xs border',
                  r.status === 'applied'
                    ? 'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/20 text-[var(--status-complete)]'
                    : r.status === 'not_found'
                    ? 'bg-[var(--status-in-progress-bg)] border-[var(--status-in-progress)]/20 text-[var(--status-in-progress)]'
                    : 'bg-[var(--status-error-bg)] border-[var(--status-error)]/20 text-[var(--status-error)]'
                )}
              >
                {r.status === 'applied'
                  ? <CheckCheck className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  : <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                <span className="leading-relaxed">{r.message}</span>
              </div>
            ))}
          </div>
          {failedCount > 0 && (
            <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
              For "not found" errors: the search string must exactly match the file content including whitespace and indentation. Ask Claude to re-check the exact text.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Setup tab sub-component ─────────────────────────────────────────────────
// Renders Section 14 (env vars, install commands, system prereqs) parsed from
// the GCD. All copy buttons follow the universal CopyButton pattern. No new
// files — entirely self-contained in this inline component.

interface SetupViewProps {
  projectId: string
}

function SetupView({ projectId }: SetupViewProps): JSX.Element {
  const { document: docData, isLoading } = useDocument(projectId)

  // Parse Section 14 lazily — only when the tab is rendered
  const section14 = React.useMemo(() => {
    if (!docData?.rawContent) return null
    try {
      // Dynamic import of parseSection14 — avoids adding to the initial bundle
      // We call it synchronously because documentParser is already loaded
      const { parseSection14 } = require('@/services/documentParser') as typeof import('@/services/documentParser')
      return parseSection14(docData.rawContent)
    } catch {
      return null
    }
  }, [docData?.rawContent])

  // Extract npm install command from Section 3.3 directly for maximum accuracy
  const npmInstallCmd = React.useMemo(() => {
    if (!docData?.rawContent) return null
    const match = docData.rawContent.match(/```[\s\S]*?npm install([\s\S]+?)```/i)
    if (match) return `npm install${match[1]}`
    // Fallback: if deps are parsed, build from those
    if (section14 && section14.dependencies.length > 0) {
      return `npm install ${section14.dependencies.slice(0, 10).join(' ')}`
    }
    return null
  }, [docData?.rawContent, section14])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    )
  }

  if (!docData) {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertTriangle}
          title="No document found"
          description="Import your Global Context Document first to see setup instructions."
        />
      </div>
    )
  }

  const envVars = section14?.envVars ?? []
  const postInstall = section14?.postInstallCommands ?? []
  const prereqs = section14?.systemPrerequisites ?? []
  const setupNotes = section14?.setupNotes ?? null

  return (
    <div className="flex flex-col gap-6 p-4 max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div>
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Project Setup</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Everything you need to run this project locally — parsed from your Global Context Document.
        </p>
      </div>

      {/* ── System prerequisites ── */}
      {prereqs.length > 0 && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Prerequisites</p>
          <ul className="space-y-1.5">
            {prereqs.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-[var(--accent-primary)] shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── npm install ── */}
      {npmInstallCmd && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Install Dependencies</p>
            <CopyButton value={npmInstallCmd} size="sm" label="Copy" />
          </div>
          <pre className="rounded-lg bg-[#1a1a1a] border border-[var(--border-subtle)] p-3 text-xs font-mono text-[var(--text-primary)] overflow-x-auto whitespace-pre-wrap break-all">
            {npmInstallCmd}
          </pre>
        </div>
      )}

      {/* ── Environment variables ── */}
      {envVars.length > 0 && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Environment Variables
            <span className="ml-2 font-normal normal-case text-[var(--text-tertiary)]">
              — copy each name into your .env file
            </span>
          </p>
          <div className="space-y-2">
            {envVars.map((v) => (
              <div
                key={v.name}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{v.name}</span>
                    {v.required && (
                      <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-[var(--status-error-bg)] text-[var(--status-error)] border border-[var(--status-error)]/20">
                        required
                      </span>
                    )}
                  </div>
                  {v.description && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{v.description}</p>
                  )}
                  {v.example && (
                    <p className="text-xs font-mono text-[var(--text-secondary)] mt-0.5 opacity-60">
                      e.g. {v.example}
                    </p>
                  )}
                </div>
                <CopyButton value={`${v.name}=`} size="sm" />
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            Create a <code className="font-mono bg-[var(--bg-quaternary)] px-1 rounded">.env.local</code> file at the project root and add the values above.
          </p>
        </div>
      )}

      {/* ── Post-install commands ── */}
      {postInstall.length > 0 && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Post-Install Commands</p>
          <div className="space-y-2">
            {postInstall.map((cmd, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-[#1a1a1a] border border-[var(--border-subtle)] px-3 py-2.5">
                <span className="text-xs font-mono text-[var(--text-primary)] flex-1 overflow-x-auto whitespace-nowrap">{cmd}</span>
                <CopyButton value={cmd} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Node/npm versions ── */}
      {(section14?.nodeVersion || section14?.npmVersion) && (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Required Versions</p>
          <div className="flex flex-wrap gap-3">
            {section14?.nodeVersion && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2">
                <span className="text-xs text-[var(--text-tertiary)]">Node.js</span>
                <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{section14.nodeVersion}</span>
                <CopyButton value={section14.nodeVersion} size="sm" />
              </div>
            )}
            {section14?.npmVersion && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2">
                <span className="text-xs text-[var(--text-tertiary)]">npm</span>
                <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{section14.npmVersion}</span>
                <CopyButton value={section14.npmVersion} size="sm" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Setup notes ── */}
      {setupNotes && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Additional Notes</p>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{setupNotes}</p>
        </div>
      )}

      {/* ── Fallback: no section 14 data parsed ── */}
      {!section14 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6 text-center space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">No Section 14 detected</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Ask Claude to add a{' '}
            <code className="font-mono bg-[var(--bg-quaternary)] px-1 rounded">## SECTION 14 — ENVIRONMENT AND SETUP</code>{' '}
            to your GCD with env vars, prerequisites, and post-install commands.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Document tab sub-component ───────────────────────────────────────────────
// Renders DocumentSection list from useDocument sections. Falls back gracefully
// if FILE 097 hasn't been generated yet.

interface DocumentTabProps {
  projectId: string
}

function DocumentTab({ projectId }: DocumentTabProps): JSX.Element {
  const [featureFlowOpen, setFeatureFlowOpen] = React.useState(false)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        }
      >
        <DocumentSection
          projectId={projectId}
          onAddFeature={() => setFeatureFlowOpen(true)}
        />
      </Suspense>

      {featureFlowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Add New Feature</h2>
              <button
                type="button"
                onClick={() => setFeatureFlowOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xl leading-none"
              >
                ×
              </button>
            </div>
            <NewFeatureFlow
              projectId={projectId}
              onComplete={() => setFeatureFlowOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Errors tab sub-component ─────────────────────────────────────────────────

interface ErrorsTabProps {
  projectId: string
}

function ErrorsTab({ projectId }: ErrorsTabProps): JSX.Element {
  const { sessions, isLoading, resolveSession } = useErrors(projectId)

  const handleResolve = useCallback(
    (sessionId: string, note: string) => {
      resolveSession(sessionId, note)
    },
    [resolveSession]
  )

  const handleAdded = useCallback(() => {
    // Query invalidation is handled inside useErrors — nothing extra needed here
  }, [])

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Add new error session */}
      <AddErrorSession projectId={projectId} onAdded={handleAdded} />

      {/* Error session list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No error sessions"
          description="Add an error session above to generate targeted fix prompts."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <ErrorSessionCard
              key={session.id}
              session={session}
              projectId={projectId}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main workspace page ──────────────────────────────────────────────────────

export default function WorkspacePage(): JSX.Element {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  // ── Derive projectId from route params ───────────────────────────────────
  const projectId = typeof params?.projectId === 'string' ? params.projectId : ''

  // ── Derive active tab from searchParam (default: 'overview') ────────────
  const tabParam = searchParams?.get('tab')
  const activeTab: WorkspaceTab = isValidTab(tabParam) ? tabParam : 'overview'

  // ── Project data + store sync ────────────────────────────────────────────
  const { project, isLoading, error } = useProject(projectId)
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProject)

  // Sync projectId into store on mount (project data synced inside useProject)
  useEffect(() => {
    if (project && projectId) {
      setCurrentProjectId(projectId, project)
    }
  }, [project, projectId, setCurrentProjectId])

  // ── Tab change handler — router.replace preserves browser history ────────
  const handleTabChange = useCallback(
    (tab: WorkspaceTab) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set('tab', tab)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // ── Editor: open file in editor tab from files table ────────────────────
  const handleOpenInEditor = useCallback(
    (fileId: string) => {
      // Switch to editor tab and let EditorLayout handle the file selection
      handleTabChange('editor')
      // The fileId selection is managed by useEditor / EditorFileTree's openFile action
    },
    [handleTabChange]
  )

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  // ── Error / not-found state ──────────────────────────────────────────────
  if (error || !project) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-8">
        <EmptyState
          icon={AlertTriangle}
          title={error ? 'Failed to load project' : 'Project not found'}
          description={
            error
              ? (error as Error).message ?? 'An unexpected error occurred. Please try again.'
              : 'This project does not exist or you do not have access to it.'
          }
        />
      </div>
    )
  }

  // ── Tab content ──────────────────────────────────────────────────────────
  const renderTabContent = (): JSX.Element => {
    // Kept for exhaustive tab guard only — actual rendering is always-mounted below
    switch (activeTab) {
      case 'overview':
        return (
          <div className="flex-1 overflow-y-auto">
            <WorkspaceOverview projectId={projectId} onTabChange={handleTabChange} />
          </div>
        )

      case 'document':
        return (
          <div className="flex flex-1 flex-col overflow-hidden">
            <DocumentTab projectId={projectId} />
          </div>
        )

      case 'files':
        return (
          <div className="flex flex-1 flex-col overflow-hidden">
            <FileSequenceTable
              projectId={projectId}
              onOpenInEditor={handleOpenInEditor}
            />
          </div>
        )

      case 'editor':
        return (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Next file workflow bar */}
            <NextFileBar projectId={projectId} />
            {/* Mode switcher bar */}
            <EditorModeSwitcher projectId={projectId} />
            <div className="flex flex-1 overflow-hidden">
              <EditorLayout projectId={projectId} />
            </div>
          </div>
        )

      case 'prompts':
        return (
          <div className="flex flex-1 flex-col overflow-hidden">
            <PromptsView projectId={projectId} />
          </div>
        )

      case 'errors':
        return (
          <div className="flex-1 overflow-y-auto">
            <ErrorsTab projectId={projectId} />
          </div>
        )

      case 'setup':
        return (
          <div className="flex-1 overflow-y-auto">
            <SetupView projectId={projectId} />
          </div>
        )

      case 'export':
        return (
          <div className="flex-1 overflow-y-auto p-4">
            <ExportView projectId={projectId} />
          </div>
        )

      default: {
        // Exhaustive guard — TypeScript will flag unhandled tabs
        const _exhaustive: never = activeTab
        void _exhaustive
        return (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={AlertTriangle}
              title="Unknown tab"
              description="This tab does not exist."
            />
          </div>
        )
      }
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Sticky workspace navigation */}
      <WorkspaceNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        projectId={projectId}
      />

      {/* Tab content area — fills remaining height */}
      <main className="flex flex-1 flex-col overflow-hidden" aria-label={`${activeTab} workspace panel`}>
        {/* Document tab — always mounted to preserve React Query cache across tab switches */}
        <div className={activeTab === 'document' ? 'flex flex-1 flex-col overflow-hidden' : 'hidden'}>
          <DocumentTab projectId={projectId} />
        </div>
        {/* All other tabs — only rendered when active */}
        {activeTab !== 'document' && renderTabContent()}
      </main>
    </div>
  )
}