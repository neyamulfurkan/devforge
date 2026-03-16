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
import { FolderOpen, FolderDown, Loader2, CheckCircle2, ChevronRight, Sparkles, Check } from 'lucide-react'

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

// ─── Constants ───────────────────────────────────────────────────────────────

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
                nodePath.endsWith('/' + target) ||
                target.endsWith('/' + nodePath)
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
              normalised.endsWith('/' + nodePath) ||
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
      setCopyState('done')
      setTimeout(() => setCopyState('idle'), 3000)
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

      {/* Next file label */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
        title="Open this file in editor and copy GCD + prompt + required files to clipboard"
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

function EditorModeSwitcher({ projectId }: { projectId: string }): JSX.Element {
  const { isLocalMode, openLocalFolder, switchToDBMode, createProjectFolder } = useEditor(projectId)
  const { getLocalState } = useEditorStore()
  const { localFolderHandle } = getLocalState(projectId)
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
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: File tree */}
      <div className="hidden w-60 shrink-0 border-r border-[var(--border-subtle)] md:flex md:flex-col">
        <EditorFileTree projectId={projectId} />
      </div>

      {/* Center + Top: Editor with pinned top bar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Pinned top bar */}
        <EditorTopBar
          file={openFile as Parameters<typeof EditorTopBar>[0]['file']}
          onMarkComplete={handleMarkComplete}
          projectId={projectId}
          onFind={() => findRef.current?.()}
          onFindReplace={() => findReplaceRef.current?.()}
        />

        {/* Monaco editor fills remaining height */}
        <div className="flex-1 overflow-hidden">
          <MonacoEditorWrapper
            file={openFile as FileWithContent | null}
            onContentChange={handleContentChange}
            isLocalMode={isLocalMode}
            openLocalPath={openLocalPath}
            onEditorMount={handleEditorMount}
          />
        </div>
      </div>
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