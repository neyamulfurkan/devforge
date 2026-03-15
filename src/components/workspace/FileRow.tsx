'use client'

// 1. React imports
import { useState, useCallback, memo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// 2. Third-party imports
import { ChevronDown, ChevronRight, FileCode, Loader2, FolderOpen, Copy, Check, X, Upload, Download, Eye, Send, CloudOff, Cloud } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Internal imports — hooks
import { useFiles } from '@/hooks/useFiles'
import { useDocument } from '@/hooks/useDocument'
import { useEditor } from '@/hooks/useEditor'
import { useEditorStore } from '@/store/editorStore'

// 6. Internal imports — types
import type { FileWithContent, FileStatus } from '@/types'
import type { LocalFileNode } from '@/store/editorStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileRowProps {
  file: FileWithContent
  projectId: string
  isSelected: boolean
  onSelect: (fileId: string) => void
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CYCLE: FileStatus[] = ['EMPTY', 'CODE_PASTED', 'COMPLETE', 'ERROR']

function nextStatus(current: FileStatus): FileStatus {
  const idx = STATUS_CYCLE.indexOf(current)
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

const STATUS_CONFIG: Record<FileStatus, { dot: string; text: string; label: string }> = {
  EMPTY:       { dot: 'bg-[#3a3a3a]',                       text: 'text-[#606060]',                   label: 'Empty' },
  CODE_PASTED: { dot: 'bg-[var(--status-in-progress)]',     text: 'text-[var(--status-in-progress)]', label: 'Code Pasted' },
  COMPLETE:    { dot: 'bg-[var(--status-complete)]',        text: 'text-[var(--status-complete)]',    label: 'Complete' },
  ERROR:       { dot: 'bg-[var(--status-error)]',           text: 'text-[var(--status-error)]',       label: 'Error' },
}

// ─── Completion tick ──────────────────────────────────────────────────────────

function CompletionTick({
  status,
  isCycling,
  onClick,
}: {
  status: FileStatus
  isCycling: boolean
  onClick: (e: React.MouseEvent) => void
}): JSX.Element {
  const isComplete = status === 'COMPLETE'
  const isError    = status === 'ERROR'
  const isPasted   = status === 'CODE_PASTED'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCycling}
      title={`${STATUS_CONFIG[status].label} — click to cycle`}
      className={`
        relative flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center
        transition-all duration-150 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
        focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--bg-secondary)]
        ${isComplete
          ? 'border-[var(--status-complete)] bg-[var(--status-complete)] hover:opacity-80'
          : isError
          ? 'border-[var(--status-error)] bg-[var(--status-error)]/15 hover:bg-[var(--status-error)]/25'
          : isPasted
          ? 'border-[var(--status-in-progress)] bg-[var(--status-in-progress)]/10 hover:bg-[var(--status-in-progress)]/20'
          : 'border-[#3a3a3a] bg-transparent hover:border-[var(--status-complete)]/60 hover:bg-[var(--status-complete)]/8'
        }
      `}
    >
      {isCycling ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--text-tertiary)]" />
      ) : isComplete ? (
        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
      ) : isError ? (
        <X className="h-2.5 w-2.5 text-[var(--status-error)]" strokeWidth={3} />
      ) : isPasted ? (
        <div className="h-1.5 w-1.5 rounded-full bg-[var(--status-in-progress)]" />
      ) : null}
    </button>
  )
}

// ─── Required file copy chip ──────────────────────────────────────────────────

function RequiredFileChip({ dep }: { dep: string }): JSX.Element {
  const [copied, setCopied] = useState(false)

  const pathOnly = dep.replace(/^FILE\s+[\w]+:\s*/i, '')
  const label    = dep.match(/^(FILE\s+[\w]+)/i)?.[1] ?? pathOnly.split('/').pop() ?? dep

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(pathOnly).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => undefined)
  }, [pathOnly])

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Copy path: ${pathOnly}`}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
        text-[11px] font-mono font-medium border transition-all duration-150 select-none
        ${copied
          ? 'border-[var(--status-complete)]/40 bg-[var(--status-complete-bg)] text-[var(--status-complete)]'
          : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)]'
        }
      `}
    >
      {copied
        ? <Check className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
        : <Copy className="h-3 w-3 flex-shrink-0 opacity-50" />
      }
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ─── GCD trimmer — strips irrelevant sections based on file phase ─────────────
// Sections always kept: 1 (overview), 3 (stack), 4 (file structure),
// 5 (coding standards), 9 (generation sequence), 11 (JSON registry)
// Phase-specific additions:
//   Frontend components (phases 6-8): + 7 (design system), 8 (performance)
//   API routes (phase 9):             + 6 (DB schema), 10 (env vars)
//   Foundation/config (phases 1-2):  + 2 (features), 6 (DB schema), 10 (env)
//   Services/hooks (phases 3-5):     + 2 (features)

function trimGcdForPhase(gcdContent: string, phase: number): string {
  // Sections always included regardless of phase
  const alwaysInclude = new Set(['1', '3', '4', '5', '9', '11'])

  // Additional sections by phase group
  const phaseAdditional: Record<string, Set<string>> = {
    foundation: new Set(['2', '6', '10']),   // phases 1-2
    services:   new Set(['2']),               // phases 3-5
    frontend:   new Set(['7', '8']),          // phases 6-8
    api:        new Set(['6', '10']),          // phase 9
  }

  const getPhaseGroup = (p: number): string => {
    if (p <= 2) return 'foundation'
    if (p <= 5) return 'services'
    if (p <= 8) return 'frontend'
    return 'api'
  }

  const group = getPhaseGroup(phase)
  const allowed = new Set([
    ...alwaysInclude,
    ...(phaseAdditional[group] ?? new Set()),
  ])

  // Split GCD into sections by "## SECTION N" markers
  // Keep a section if its number is in the allowed set
  const lines = gcdContent.split('\n')
  const outputLines: string[] = []
  let currentSectionAllowed = true
  let currentSectionNum = ''

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+SECTION\s+(\d+(?:\.\d+)?)/i)
    if (sectionMatch) {
      const num = sectionMatch[1] ?? ''
      // Top-level section number (e.g. "6" from "6.1")
      currentSectionNum = num.split('.')[0] ?? num
      currentSectionAllowed = allowed.has(currentSectionNum)
    }
    if (currentSectionAllowed) {
      outputLines.push(line)
    }
  }

  return outputLines.join('\n')
}

// ─── Section 11 registry parser ───────────────────────────────────────────────
// Extracts a specific file's JSON registry entry from Section 11 of the GCD.
// Returns the raw registry block or null if not found.

function extractRegistryEntry(gcdContent: string, filePath: string): string | null {
  // Section 11 entries look like: FILE NNN: path\n{ ... json ... }
  // or wrapped in ```json blocks
  const lines = gcdContent.split('\n')
  let inSection11 = false
  let entryLines: string[] = []
  let capturing = false
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''

    if (/^##\s+SECTION\s+11/i.test(line)) {
      inSection11 = true
      continue
    }
    if (inSection11 && /^##\s+SECTION\s+\d+/i.test(line)) {
      inSection11 = false
      break
    }
    if (!inSection11) continue

    // Look for file path match
    if (!capturing && line.includes(filePath)) {
      capturing = true
      entryLines = [line]
      continue
    }

    if (capturing) {
      entryLines.push(line)
      // Count braces to detect end of JSON block
      for (const ch of line) {
        if (ch === '{') braceDepth++
        if (ch === '}') braceDepth--
      }
      // Once we've opened and closed a complete JSON object, stop
      if (braceDepth <= 0 && entryLines.some((l) => l.includes('{'))) {
        break
      }
    }
  }

  return entryLines.length > 1 ? entryLines.join('\n') : null
}

// ─── Build state calculator ───────────────────────────────────────────────────
// Returns a human-readable build state string for the prompt header.

function getBuildState(
  file: FileWithContent,
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

  // Files in the same phase that are complete
  const phaseComplete = completedFiles.filter((f) => f.phase === file.phase)
  const phaseTotal = allFiles.filter((f) => f.phase === file.phase)

  return `CURRENT BUILD STATE: Phase ${file.phase} — ${file.phaseName}. Files 001–${lastNum} are complete (${completedCount}/${totalCount} total). Phase ${file.phase} progress: ${phaseComplete.length}/${phaseTotal.length} files done. Last completed: ${lastPath}. FILE ${file.fileNumber} (${file.filePath}) is next.`
}

// ─── GCD + FSP + Code button ──────────────────────────────────────────────────
// Implements all 5 prompt quality improvements:
//   1. Phase-trimmed GCD — only relevant sections per phase
//   2. Dependent registry entries — tell Claude what interface dependents expect
//   3. CSS module auto-detection — include .module.css when generating .tsx
//   4. Section 11 stubs for missing files — no second message needed
//   5. Build state declaration — tell Claude what's done

function GcdPlusCodeButton({
  gcdContent,
  filePrompt,
  filePath,
  fileNumber,
  filePhase,
  filePhaseName,
  fileStatus,
  requiredFiles,
  projectId,
  compact = false,
}: {
  gcdContent: string
  filePrompt: string
  filePath: string
  fileNumber: string
  filePhase: number
  filePhaseName: string
  fileStatus: FileStatus
  requiredFiles: string[]
  projectId: string
  compact?: boolean
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [fetchedCount, setFetchedCount] = useState(0)

  const { isLocalMode } = useEditor(projectId)

  // ── Strip "FILE NNN: " prefix and normalise path ──────────────────────────
  const cleanPath = (raw: string): string =>
    raw.replace(/^FILE\s+[\w]+:\s*/i, '').trim()

  // ── Walk local tree nodes recursively, reading file handles at call time ──
  // CRITICAL: reads localFileTree from Zustand store at click time via
  // getState() — never from a stale render-time snapshot.
  // Matches by: exact path, suffix match, or filename match as last resort.
  const findInLocalTree = useCallback(
    async (
      nodes: LocalFileNode[],
      requiredPath: string
    ): Promise<string | null> => {
      // Normalise: remove leading slashes
      const normalised = requiredPath.replace(/^\/+/, '')
      // Get just the filename for last-resort matching
      const requiredFilename = normalised.split('/').pop() ?? ''

      for (const node of nodes) {
        if (node.type === 'file') {
          const nodePath = node.path.replace(/^\/+/, '')
          const nodeFilename = nodePath.split('/').pop() ?? ''

          const isMatch =
            // Exact match
            nodePath === normalised ||
            // Tree path ends with required path (root folder prefix case)
            nodePath.endsWith('/' + normalised) ||
            // Required path ends with node path (reverse prefix case)
            normalised.endsWith('/' + nodePath) ||
            // Filename match as last resort (only if filename is unique enough)
            (requiredFilename.length > 5 && nodeFilename === requiredFilename)

          if (isMatch) {
            try {
              // Always cast to FileSystemFileHandle — type: 'file' guarantees this
              const fsHandle = node.handle as FileSystemFileHandle
              const f = await fsHandle.getFile()
              const text = await f.text()
              if (text.trim()) return text
            } catch {
              // Handle stale or permission error — continue searching
            }
          }
        }

        if (node.type === 'folder' && node.children && node.children.length > 0) {
          const found = await findInLocalTree(node.children, requiredPath)
          if (found) return found
        }
      }
      return null
    },
    [] // no deps — reads store via getState() at call time
  )

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (state === 'loading') return
      setState('loading')
      setFetchedCount(0)

      try {
        const sep = '═'.repeat(60)
        const thinSep = '─'.repeat(60)

        // ── Read store state at click time — never stale ─────────────────────
        const {
          localFileTree: liveTree,
          fileContent: liveContent,
          openLocalPath: livePath,
          isLocalMode: liveLocalMode,
        } = useEditorStore.getState()

        // ── Fetch all project file metadata once (for DB fallback) ──────────
        let allProjectFiles: Array<{
          id: string
          filePath: string
          fileNumber: string
          status: string
          phase: number
          phaseName: string
          jsonSummary: Record<string, unknown> | null
        }> = []
        try {
          const listRes = await fetch(`/api/projects/${projectId}/files`)
          if (listRes.ok) {
            const listJson = await listRes.json()
            allProjectFiles = Array.isArray(listJson.data) ? listJson.data : []
          }
        } catch {
          // DB fallback won't work but local disk still will
        }

        // ── IMPROVEMENT 1: Phase-trim the GCD ────────────────────────────────
        const trimmedGcd = trimGcdForPhase(gcdContent, filePhase)

        // ── IMPROVEMENT 5: Build state ────────────────────────────────────────
        const buildState = getBuildState(
          { fileNumber, filePath, phase: filePhase, phaseName: filePhaseName, status: fileStatus } as FileWithContent,
          allProjectFiles
        )

        // ── Fetch each required file ──────────────────────────────────────────
        const results: Array<{ path: string; content: string; source: string; isCss: boolean }> = []
        const missing: Array<{ path: string; stub: string | null }> = []

        // ── IMPROVEMENT 3: Auto-detect CSS module for .tsx files ──────────────
        // If generating a .tsx file, check if a .module.css exists for it
        const cssModulePath = filePath.endsWith('.tsx')
          ? filePath.replace(/\.tsx$/, '.module.css')
          : null

        const allRequiredPaths = [...requiredFiles.map(cleanPath).filter(Boolean)]

        // Add CSS module to fetch list if it exists and isn't already required
        if (cssModulePath && !allRequiredPaths.includes(cssModulePath)) {
          const cssMatch = allProjectFiles.find((f) => {
            const fNorm = f.filePath.replace(/^\/+/, '')
            const cssNorm = cssModulePath.replace(/^\/+/, '')
            return fNorm === cssNorm || fNorm.endsWith('/' + cssNorm)
          })
          if (cssMatch) {
            allRequiredPaths.push(cssModulePath)
          }
        }

        for (const reqPath of allRequiredPaths) {
          if (!reqPath) continue

          let content: string | null = null
          let source = ''
          const isCss = reqPath.endsWith('.css') || reqPath.endsWith('.scss')

          // Source 1 — currently open file in editor (already in memory)
          if (livePath && liveContent?.trim()) {
            const livNorm = livePath.replace(/^\/+/, '')
            const reqNorm = reqPath.replace(/^\/+/, '')
            if (
              livNorm === reqNorm ||
              livNorm.endsWith('/' + reqNorm) ||
              reqNorm.endsWith('/' + livNorm)
            ) {
              content = liveContent
              source = 'editor'
            }
          }

          // Source 2 — local disk tree (live handles from store)
          if (!content && liveLocalMode && liveTree.length > 0) {
            const diskContent = await findInLocalTree(liveTree, reqPath)
            if (diskContent) {
              content = diskContent
              source = 'disk'
            }
          }

          // Source 3 — DB / Cloudinary via API
          if (!content) {
            const reqNorm = reqPath.replace(/^\/+/, '')
            const match = allProjectFiles.find((f) => {
              const fNorm = f.filePath.replace(/^\/+/, '')
              return (
                fNorm === reqNorm ||
                fNorm.endsWith('/' + reqNorm) ||
                reqNorm.endsWith('/' + fNorm)
              )
            })
            if (match) {
              try {
                const codeRes = await fetch(
                  `/api/projects/${projectId}/files/${match.id}/code`
                )
                if (codeRes.ok) {
                  const codeJson = await codeRes.json()
                  const fetched: string = codeJson.data?.codeContent ?? ''
                  if (fetched.trim()) {
                    content = fetched
                    source = 'cloud'
                  }
                }
              } catch {
                // Non-fatal
              }
            }
          }

          if (content) {
            results.push({ path: reqPath, content, source, isCss })
            setFetchedCount((n) => n + 1)
          } else {
            // ── IMPROVEMENT 4: Section 11 stub for missing files ───────────────
            const stub = extractRegistryEntry(gcdContent, reqPath)
            missing.push({ path: reqPath, stub })
          }
        }

        // ── IMPROVEMENT 2: Dependent registry entries ─────────────────────────
        // Find files that list filePath in their dependents field
        // Use Section 11 registry entries to tell Claude what interface they expect
        const dependentEntries: Array<{ fileNum: string; path: string; entry: string }> = []
        for (const pf of allProjectFiles) {
          if (pf.filePath === filePath) continue
          const summary = pf.jsonSummary as Record<string, unknown> | null
          if (!summary) continue
          const deps = summary['dependents']
          if (
            Array.isArray(deps) &&
            deps.some(
              (d) =>
                typeof d === 'string' &&
                (d === filePath || d.includes(filePath) || filePath.includes(d))
            )
          ) {
            const entry = extractRegistryEntry(gcdContent, pf.filePath)
            if (entry) {
              dependentEntries.push({
                fileNum: pf.fileNumber,
                path: pf.filePath,
                entry,
              })
            }
          }
        }

        // ── Assemble required files blocks — labeled, before the task ─────────
        const requiredFilesBlock = results
          .map((r) => {
            const label = r.isCss
              ? `REQUIRED FILE: ${r.path} — USE THESE EXACT CLASS NAMES IN YOUR JSX`
              : `REQUIRED FILE: ${r.path} — READ THIS BEFORE GENERATING`
            return `${sep}\n${label}\n${sep}\n\n${r.content}`
          })
          .join('\n\n')

        // Missing files with stubs
        const missingBlock = missing.length > 0
          ? missing.map(({ path, stub }) =>
              stub
                ? `${sep}\nREQUIRED FILE: ${path} — FULL CONTENTS NOT PROVIDED\nUse this registry entry as the interface reference:\n${thinSep}\n${stub}\n${thinSep}`
                : `${sep}\n⚠️ REQUIRED FILE: ${path} — NOT FOUND\nProceed without it. Do not guess its contents.`
            ).join('\n\n')
          : ''

        // Dependent interface block
        const dependentBlock = dependentEntries.length > 0
          ? `${sep}
DEPENDENT FILES — THESE IMPORT FROM THE FILE YOU ARE GENERATING
Their registry entries define exactly what interface they expect from you.
${sep}

${dependentEntries.map((d) =>
  `FILE ${d.fileNum} (${d.path}) expects from ${filePath}:\n${thinSep}\n${d.entry}`
).join('\n\n')}

${sep}`
          : ''

        // Note listing which files were provided
        const providedFilesNote = results.length > 0
          ? `NOTE: The following files have been provided above and you have read them:\n${results.map((r) => `  • ${r.path}${r.isCss ? ' (CSS module — use exact class names)' : ''}`).join('\n')}\nReference them directly for imports, types, hook names, store selectors, class names, and design patterns. Do not guess their shape.`
          : ''

        // ── Final single-prompt structure ─────────────────────────────────────
        const combined = `${trimmedGcd}

${results.length > 0 || missing.length > 0 ? `${requiredFilesBlock}

${missingBlock}` : ''}

${dependentBlock}

${results.length > 0 || missing.some((m) => m.stub) ? `${sep}
END REQUIRED FILES. CONTEXT CONFIRMED. GENERATE NOW.
${sep}` : ''}

${sep}
TASK: GENERATE FILE ${fileNumber} — ${filePath}
${sep}

${buildState}

${providedFilesNote ? `${providedFilesNote}\n\n` : ''}FILE-SPECIFIC PROMPT:

${filePrompt}

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
        setState('done')
        setTimeout(() => setState('idle'), 2500)
      } catch {
        setState('error')
        setTimeout(() => setState('idle'), 2000)
      }
    },
    [
      state,
      gcdContent,
      filePrompt,
      filePath,
      fileNumber,
      requiredFiles,
      projectId,
      isLocalMode,
      findInLocalTree,
    ]
  )

  // ── Always colorful — gradient indigo/purple so it stands out ────────────
  const baseStyle = `
    inline-flex items-center gap-1.5 transition-all duration-150
    select-none font-medium rounded-md whitespace-nowrap
    ${state === 'done'
      ? 'bg-[var(--status-complete-bg)] border border-[var(--status-complete)]/40 text-[var(--status-complete)]'
      : state === 'error'
      ? 'bg-[var(--status-error-bg)] border border-[var(--status-error)]/40 text-[var(--status-error)]'
      : state === 'loading'
      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border border-transparent text-white opacity-80'
      : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 border border-transparent text-white shadow-sm hover:shadow-md active:scale-95'
    }
  `

  const icon =
    state === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> :
    state === 'done'    ? <Check className="h-3 w-3" /> :
                          <Copy className="h-3 w-3" />

  const labelText =
    state === 'loading'
      ? `Reading ${fetchedCount}/${requiredFiles.length}…`
      : state === 'done'
      ? `Copied! (${fetchedCount} files)`
      : state === 'error'
      ? 'Error — retry'
      : compact
      ? 'GCD+Code'
      : 'Copy GCD + FSP + Code'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'loading'}
      title="Copy GCD + file-specific prompt + all required file codes (reads from local disk first)"
      className={`${baseStyle} ${compact ? 'h-7 px-2.5 text-[11px]' : 'h-7 px-3 text-xs'}`}
    >
      {icon}
      {labelText}
    </button>
  )
}

// ─── GCD + Prompt button ──────────────────────────────────────────────────────

function GcdPlusButton({
  gcdContent,
  filePrompt,
  filePath,
  fileNumber,
  requiredFiles,
  compact = false,
}: {
  gcdContent: string
  filePrompt: string
  filePath: string
  fileNumber: string
  requiredFiles: string[]
  compact?: boolean
}): JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    const sep = '═'.repeat(60)

    const requiredFilesSection = requiredFiles.length > 0
      ? `REQUIRED FILES — YOU MUST READ BEFORE WRITING ANY CODE:

The following files are required to generate this file correctly. If any of them have NOT been shared in this conversation, STOP and ask the user to provide them before writing a single line of code. Do NOT guess, assume, or infer their contents.

${requiredFiles.map((f) => `- ${f}`).join('\n')}

Only after every required file above has been shared and read may you begin code generation.`
      : ''

    const beforeYouBeginSection = requiredFiles.length > 0
      ? `IMPORTANT — BEFORE YOU BEGIN:

Check which required files have been shared in this conversation. Then respond using EXACTLY this structure — no variations:

---
## Ready to Generate FILE ${fileNumber}

### Required Files Status
[For each required file, show its status followed by the path in its own fenced code block on the next line, like this:]

✅ present
\`\`\`
path/to/file.ts
\`\`\`

❌ NOT shared — please provide this file
\`\`\`
path/to/missing-file.ts
\`\`\`

### Additional Context (optional)
Are there any other previously generated files you'd like me to review before I write:
\`\`\`
${filePath}
\`\`\`
These would be files that import from, or are imported by, this file.

If all required files are present and you have no additional files to share, send this to begin:
\`\`\`
proceed
\`\`\`

If any required file is missing, I cannot begin — please share the missing files shown above.
---

Wait for the user's reply before writing any code.`
      : `IMPORTANT — BEFORE YOU BEGIN:

Review the Global Context Document above, then respond using EXACTLY this structure — no variations:

---
## Ready to Generate FILE ${fileNumber}

### GCD Sections Reviewed
- ✅ Section 5 — Coding Standards and Conventions
- ✅ Section 7 — Design System
- ✅ Section 9 — File Generation Sequence (FILE ${fileNumber})

### File to be generated
\`\`\`
${filePath}
\`\`\`

### Suggested files that may be relevant
[List 2–4 files from the GCD's File Generation Sequence most likely to be imported by or to import this file. Show each as its own fenced code block so the user can copy the path with one click:]

\`\`\`
src/components/example/RelatedComponent.tsx
\`\`\`

\`\`\`
src/hooks/useRelatedHook.ts
\`\`\`

To begin immediately, send:
\`\`\`
proceed
\`\`\`
Or paste any files you'd like me to review first.
---

Wait for the user's reply before writing any code.`

    // ── Structure: GCD → required file list reminder → task → output format ─
    // GcdPlusButton has no actual file content (use GcdPlusCodeButton for that)
    // but it still follows the correct order: context before task.
    const requiredFilesReminder = requiredFiles.length > 0
      ? `${sep}
REQUIRED FILES FOR THIS TASK — YOU MUST OBTAIN THESE BEFORE GENERATING
${sep}

The following files are required to generate ${filePath} correctly.
They are listed here so you know exactly what context you need.
If any are not already in this conversation, ask for them before writing code.

${requiredFiles.map((f) => `  • ${f}`).join('\n')}

Once you have read all required files above, generate immediately without further prompting.
${sep}
CONTEXT CONFIRMED. PROCEED TO TASK.
${sep}`
      : ''

    const combined = `${gcdContent}

${requiredFilesReminder}

${sep}
TASK: GENERATE FILE ${fileNumber} — ${filePath}
${sep}

FILE-SPECIFIC PROMPT:

${filePrompt}

${sep}
OUTPUT FORMAT — YOU MUST FOLLOW THIS EXACTLY:
${sep}

Your entire response must contain ONLY two things in this exact order — nothing else:

1. The complete file code in a single fenced code block. Every function, every handler, every import fully written. No placeholders, no "// TODO", no truncation, no ellipsis.

2. Immediately after the closing fence of the code block, this JSON object — no introduction, no explanation before or after it:

\`\`\`json
{
  "file": "${filePath}",
  "fileNumber": "${fileNumber}",
  "exports": ["ExportName — max 3 word description"],
  "imports": ["package — one reason, omit React/Next/Node built-ins"],
  "keyLogic": "One sentence maximum. What this file actually does.",
  "sideEffects": ["one short phrase per side effect — omit array if none"],
  "dependents": ["top 3 files that import this one — omit if unknown"],
  "status": "complete",
  "generatedAt": "${new Date().toISOString()}"
}
\`\`\`

STRICT RULES — violations will break the automated parser:
- Do NOT repeat, summarise, or quote any part of the GCD or Section 9
- Do NOT add any text after the closing \`\`\` of the JSON block
- Do NOT add introductory text before the code block
- Do NOT add "I've implemented..." or any commentary anywhere
- If all required files are present in this conversation: generate immediately, do not ask to proceed
- If any required file is missing: ask for only the missing files, then generate immediately once received
- The JSON must be the absolute last thing in your response`

    navigator.clipboard.writeText(combined).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => undefined)
  }, [gcdContent, filePrompt, filePath, fileNumber, requiredFiles])

  const base = `
    inline-flex items-center gap-1.5 border transition-all duration-150 select-none font-medium
    ${copied
      ? 'border-[var(--status-complete)]/40 bg-[var(--status-complete-bg)] text-[var(--status-complete)]'
      : 'border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-primary)]'
    }
  `

  return compact ? (
    <button
      type="button"
      onClick={handleClick}
      title="Copy GCD + this file's prompt (with dependency check instructions)"
      className={`${base} h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? '✓' : 'GCD+'}
    </button>
  ) : (
    <button
      type="button"
      onClick={handleClick}
      className={`${base} h-7 px-3 rounded-md text-xs`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy GCD + Prompt'}
    </button>
  )
}

// ─── ExpandSection ────────────────────────────────────────────────────────────

function ExpandSection({
  label,
  action,
  children,
}: {
  label: string
  action?: React.ReactNode
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
          {label}
        </span>
        {action && (
          <div onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  )
}

// ─── CloudSyncButton ──────────────────────────────────────────────────────────
// Handles Push (laptop→cloud), Pull (cloud→laptop), View (mobile read-only),
// and Paste & Send (mobile write) in one self-contained component.

function CloudSyncButton({
  file,
  projectId,
}: {
  file: FileWithContent
  projectId: string
}): JSX.Element {
  const [cloudExists, setCloudExists] = useState<boolean | null>(null)
  const [pushState, setPushState]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [pullState, setPullState]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [viewOpen, setViewOpen]       = useState(false)
  const [viewContent, setViewContent] = useState('')
  const [pasteOpen, setPasteOpen]     = useState(false)
  const [pasteText, setPasteText]     = useState('')
  const [pasteState, setPasteState]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const { pushToCloudinary, pullFromCloudinary, checkCloudSync, isLocalMode } = useEditor(projectId)

  // Check cloud sync status on mount
  useEffect(() => {
    checkCloudSync(file.id).then(setCloudExists)
  }, [file.id, checkCloudSync])

  const handlePush = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setPushState('loading')
    try {
      await pushToCloudinary(file.id)
      setPushState('done')
      setCloudExists(true)
      setTimeout(() => setPushState('idle'), 2000)
    } catch {
      setPushState('error')
      setTimeout(() => setPushState('idle'), 2000)
    }
  }, [file.id, pushToCloudinary])

  const handlePull = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setPullState('loading')
    try {
      const code = await pullFromCloudinary(file.id)
      if (code) {
        setPullState('done')
        setCloudExists(false)
        setTimeout(() => setPullState('idle'), 2000)
      } else {
        setPullState('error')
        setTimeout(() => setPullState('idle'), 2000)
      }
    } catch {
      setPullState('error')
      setTimeout(() => setPullState('idle'), 2000)
    }
  }, [file.id, pullFromCloudinary])

  const handleView = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    setViewOpen(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${file.id}/code`)
      const json = await res.json()
      setViewContent(json.data?.codeContent ?? '(empty)')
    } catch {
      setViewContent('Failed to load code.')
    }
  }, [projectId, file.id])

  const handlePasteSubmit = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!pasteText.trim()) return
    setPasteState('loading')
    try {
      await fetch(`/api/projects/${projectId}/files/${file.id}/code`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: pasteText }),
      })
      setPasteState('done')
      setCloudExists(true)
      setPasteText('')
      setTimeout(() => { setPasteState('idle'); setPasteOpen(false) }, 1500)
    } catch {
      setPasteState('error')
      setTimeout(() => setPasteState('idle'), 2000)
    }
  }, [projectId, file.id, pasteText])

  return (
    <>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Cloud status dot */}
        {cloudExists === true && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] flex-shrink-0"
            title="Cloud version available"
          />
        )}

        {/* Push to cloud (laptop → Cloudinary) */}
        {isLocalMode && (
          <button
            type="button"
            onClick={handlePush}
            disabled={pushState === 'loading'}
            title="Push to cloud (share with mobile)"
            className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)] transition-all duration-150 disabled:opacity-50"
          >
            {pushState === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : pushState === 'done' ? (
              <Check className="h-3.5 w-3.5 text-[var(--status-complete)]" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* Pull from cloud (Cloudinary → local disk) — only when cloud version exists */}
        {cloudExists && isLocalMode && (
          <button
            type="button"
            onClick={handlePull}
            disabled={pullState === 'loading'}
            title="Pull from cloud to local disk"
            className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-all duration-150 disabled:opacity-50"
          >
            {pullState === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : pullState === 'done' ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        {/* View code (mobile read-only — fetches from cloud) */}
        <button
          type="button"
          onClick={handleView}
          title="View code (copy to clipboard for Claude)"
          className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] transition-all duration-150"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>

        {/* Paste & send (mobile — paste Claude output → Cloudinary) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setPasteOpen(true) }}
          title="Paste code from Claude → send to cloud"
          className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)] transition-all duration-150"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* View code modal — read-only, full content + copy */}
      {viewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setViewOpen(false)}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)] font-mono truncate">
                  {file.filePath}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  Read-only — copy to paste into Claude
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton value={viewContent} size="sm" label="Copy All" />
                <button
                  type="button"
                  onClick={() => setViewOpen(false)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words p-4 leading-relaxed">
                {viewContent || <Loader2 className="h-4 w-4 animate-spin" />}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Paste & send modal — mobile workflow */}
      {pasteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          onClick={() => setPasteOpen(false)}
        >
          <div
            className="w-full sm:max-w-2xl flex flex-col rounded-t-2xl sm:rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Paste Claude's output
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5 font-mono truncate">
                  {file.filePath}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasteOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste the complete file code here…"
                rows={12}
                className="w-full resize-none rounded-md px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-default)] text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                autoFocus
              />
              <button
                type="button"
                disabled={!pasteText.trim() || pasteState === 'loading'}
                onClick={handlePasteSubmit}
                className="w-full h-10 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {pasteState === 'loading' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                ) : pasteState === 'done' ? (
                  <><Check className="h-4 w-4" /> Sent to cloud ✓</>
                ) : (
                  <><Send className="h-4 w-4" /> Send to Cloud</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── FileRow ──────────────────────────────────────────────────────────────────

export const FileRow = memo(function FileRow({
  file,
  projectId,
  isSelected,
  onSelect,
}: FileRowProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCycling,  setIsCycling]  = useState(false)
  const [jsonInput,  setJsonInput]  = useState('')
  const [jsonState,  setJsonState]  = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [jsonError,  setJsonError]  = useState<string | null>(null)

  const { updateFileStatus, appendJsonSummary } = useFiles(projectId)
  const { document: docData } = useDocument(projectId)
  const queryClient = useQueryClient()

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded((prev) => !prev)
  }, [])

  const handleRowClick = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  const handleCycleStatus = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (isCycling) return
    setIsCycling(true)
    try {
      await updateFileStatus(file.id, nextStatus(file.status))
    } finally {
      setIsCycling(false)
    }
  }, [file.id, file.status, isCycling, updateFileStatus])

  // ── Derived ────────────────────────────────────────────────────────────────

  const hasPrompt        = Boolean(file.filePrompt?.trim())
  const hasCode          = Boolean(file.codeContent?.trim())
  const hasNotes         = Boolean(file.notes?.trim())
  const hasRequiredFiles = file.requiredFiles.length > 0
  const hasGcd           = Boolean(docData?.rawContent)
  const hasJsonSummary   = Boolean(file.jsonSummary)
  const statusCfg        = STATUS_CONFIG[file.status]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className={`
        group border-b border-[var(--border-subtle)] last:border-b-0 transition-colors duration-100
        ${isSelected ? 'bg-[var(--accent-light)]' : 'hover:bg-[var(--bg-tertiary)]'}
      `}
    >
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleRowClick() }}
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
        aria-expanded={isExpanded}
      >
        {/* Completion tick — stop propagation so it doesn't toggle expand */}
        <div onClick={(e) => e.stopPropagation()}>
          <CompletionTick
            status={file.status}
            isCycling={isCycling}
            onClick={handleCycleStatus}
          />
        </div>

        {/* Expand chevron */}
        <span className="flex-shrink-0 text-[var(--text-quaternary)]">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </span>

        {/* File number */}
        <span className="flex-shrink-0 w-10 text-[11px] font-mono text-[var(--text-quaternary)] select-none">
          {file.fileNumber}
        </span>

        {/* File icon + path */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <FileCode className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-quaternary)]" />
          <span className="text-sm text-[var(--text-primary)] truncate font-mono">
            {file.filePath}
          </span>
        </div>

        {/* Status pill — hidden on row hover, replaced by action buttons */}
        <span className={`
          hidden md:inline-flex items-center gap-1.5 flex-shrink-0 text-[11px] font-medium
          group-hover:hidden ${statusCfg.text}
        `}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
          {statusCfg.label}
        </span>

        {/* ── Hover action buttons — max 3, icon-only, well spaced ─────────── */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="hidden group-hover:flex items-center gap-3 flex-shrink-0"
        >
          {/* Copy FSP — most used single action */}
          {hasPrompt && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(file.filePrompt!).catch(() => undefined)
              }}
              title="Copy file-specific prompt"
              className="h-7 px-2.5 flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)] text-[11px] font-medium transition-all duration-150"
            >
              <Copy className="h-3 w-3" />
              FSP
            </button>
          )}

          {/* GCD + Prompt — primary generation button */}
          {hasPrompt && hasGcd && (
            <GcdPlusButton
              gcdContent={docData!.rawContent}
              filePrompt={file.filePrompt!}
              filePath={file.filePath}
              fileNumber={file.fileNumber}
              requiredFiles={file.requiredFiles}
              compact
            />
          )}

          {/* Open in editor */}
          <button
            type="button"
            onClick={() => onSelect?.(file.id)}
            title="Open in editor"
            className="h-7 w-7 flex items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)] transition-all duration-150"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Phase — far right, hidden on hover */}
        <span className="hidden lg:block group-hover:hidden flex-shrink-0 text-[11px] text-[var(--text-quaternary)] w-36 truncate text-right select-none">
          {file.phaseName}
        </span>
      </div>

      {/* ── Expanded panel ─────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="ml-[72px] mr-4 mb-4 mt-0 space-y-2.5 border-t border-[var(--border-subtle)] pt-3">

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="text-xs text-[var(--text-tertiary)]">
              Phase {file.phase} — {file.phaseName}
            </span>
            {file.lineCount != null && (
              <span className="text-xs text-[var(--text-tertiary)]">
                {file.lineCount.toLocaleString()} lines
              </span>
            )}
            {file.completedAt && (
              <span className="text-xs text-[var(--status-complete)]">
                ✓ Completed {new Date(file.completedAt).toLocaleDateString(undefined, {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* Required files — click chips to copy path */}
          {hasRequiredFiles && (
            <ExpandSection label="Required Files — click to copy path">
              <div className="flex flex-wrap gap-1.5 py-0.5">
                {file.requiredFiles.map((dep) => (
                  <RequiredFileChip key={dep} dep={dep} />
                ))}
              </div>
            </ExpandSection>
          )}

          {/* File prompt */}
          {hasPrompt && (
            <ExpandSection
              label="File Prompt"
              action={<CopyButton value={file.filePrompt!} size="sm" label="Copy" />}
            >
              <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-52 overflow-y-auto leading-relaxed">
                {file.filePrompt}
              </pre>
            </ExpandSection>
          )}

          {/* Code preview */}
          {hasCode && (
            <ExpandSection
              label={`Code Preview — ${file.codeContent!.split('\n').length} lines total`}
              action={<CopyButton value={file.codeContent!} size="sm" label="Copy All" />}
            >
              <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-52 overflow-y-auto leading-relaxed">
                {file.codeContent!.split('\n').slice(0, 20).join('\n')}
                {file.codeContent!.split('\n').length > 20 && (
                  <span className="text-[var(--text-quaternary)]">
                    {'\n'}… {file.codeContent!.split('\n').length - 20} more lines
                  </span>
                )}
              </pre>
            </ExpandSection>
          )}

          {/* Notes */}
          {hasNotes && (
            <ExpandSection label="Notes">
              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {file.notes}
              </p>
            </ExpandSection>
          )}

          {/* Action row — grouped with dividers */}
          <div className="flex flex-wrap items-center gap-y-2 pt-1">

            {/* Group 1 — Editor */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onSelect?.(file.id) }}
                className="h-7 px-3 text-xs gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)]"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open in Editor
              </Button>

              {/* Copy file path */}
              <CopyButton
                value={file.filePath}
                size="sm"
                label="Copy Path"
                className="h-7 px-3 rounded-md border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)] text-xs"
              />
            </div>

            {/* Divider */}
            {hasPrompt && (
              <div className="mx-3 h-5 w-px bg-[var(--border-subtle)] flex-shrink-0" />
            )}

            {/* Group 2 — Prompt copy actions */}
            {hasPrompt && (
              <div className="flex items-center gap-2">
                <CopyButton
                  value={file.filePrompt!}
                  size="sm"
                  label="Copy FSP"
                  className="h-7 px-3 rounded-md border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)] text-xs"
                />

                {hasGcd && (
                  <GcdPlusButton
                    gcdContent={docData!.rawContent}
                    filePrompt={file.filePrompt!}
                    filePath={file.filePath}
                    fileNumber={file.fileNumber}
                    requiredFiles={file.requiredFiles}
                  />
                )}

                {hasGcd && hasRequiredFiles && (
                  <GcdPlusCodeButton
                    gcdContent={docData!.rawContent}
                    filePrompt={file.filePrompt!}
                    filePath={file.filePath}
                    fileNumber={file.fileNumber}
                    filePhase={file.phase}
                    filePhaseName={file.phaseName}
                    fileStatus={file.status}
                    requiredFiles={file.requiredFiles}
                    projectId={projectId}
                  />
                )}
              </div>
            )}

            {/* Divider */}
            <div className="mx-3 h-5 w-px bg-[var(--border-subtle)] flex-shrink-0" />

            {/* Group 3 — Cloud sync */}
            <CloudSyncButton file={file} projectId={projectId} />
          </div>

          {/* JSON Registry Entry — paste Claude's output to append to Section 11 */}
          <ExpandSection
            label={hasJsonSummary ? '✓ JSON Registry Entry — appended to Section 11' : 'JSON Registry Entry — paste Claude\'s output'}
            action={
              hasJsonSummary ? (
                <span className="text-[10px] text-[var(--status-complete)] font-medium">Stored</span>
              ) : undefined
            }
          >
            {hasJsonSummary ? (
              <pre className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words max-h-32 overflow-y-auto leading-relaxed">
                {JSON.stringify(file.jsonSummary, null, 2)}
              </pre>
            ) : (
              <div className="space-y-2">
                {/* Instruction text */}
                <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                  After generating this file, Claude will automatically output a JSON registry entry at the end of its response. Paste the JSON object below — it will be automatically appended to{' '}
                  <span className="font-mono text-[var(--text-secondary)]">Section 11</span> of your GCD.
                </p>
                <textarea
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value)
                    if (jsonState !== 'idle') { setJsonState('idle'); setJsonError(null) }
                  }}
                  placeholder={'{\n  "file": "' + file.filePath + '",\n  "fileNumber": "' + file.fileNumber + '",\n  "exports": [...],\n  ...\n}'}
                  rows={5}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full resize-y rounded-md px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-default)] text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
                {jsonState === 'error' && jsonError && (
                  <p className="text-[11px] text-[var(--status-error)]">{jsonError}</p>
                )}
                <button
                  type="button"
                  disabled={!jsonInput.trim() || jsonState === 'submitting'}
                  onClick={async (e) => {
                    e.stopPropagation()
                    const trimmed = jsonInput.trim()
                    if (!trimmed) return
                    setJsonState('submitting')
                    setJsonError(null)
                    try {
                      const parsed = JSON.parse(trimmed)
                      await appendJsonSummary(file.id, parsed)
                      await queryClient.refetchQueries({ queryKey: ['document', projectId] })
                      await queryClient.refetchQueries({ queryKey: ['files', projectId] })
                      setJsonState('done')
                      setJsonInput('')
                    } catch (err) {
                      setJsonState('error')
                      setJsonError(
                        err instanceof SyntaxError
                          ? 'Invalid JSON — check Claude\'s output for syntax errors'
                          : err instanceof Error ? err.message : 'Failed to append'
                      )
                    }
                  }}
                  className={`
                    inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border
                    transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                    ${jsonState === 'submitting'
                      ? 'border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white'
                    }
                  `}
                >
                  {jsonState === 'submitting' ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Appending…</>
                  ) : jsonState === 'done' ? (
                    <><Check className="h-3 w-3" /> Appended ✓</>
                  ) : (
                    <><Check className="h-3 w-3" /> Append to Section 11</>
                  )}
                </button>
              </div>
            )}
          </ExpandSection>
        </div>
      )}
    </div>
  )
})