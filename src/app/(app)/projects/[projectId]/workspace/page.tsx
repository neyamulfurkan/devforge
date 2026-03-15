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
import { FolderOpen, FolderDown, Loader2, CheckCircle2 } from 'lucide-react'

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
import { useProjectStore } from '@/store/projectStore'
import { useEditorStore } from '@/store/editorStore'
import type { WorkspaceTab, FileWithContent } from '@/types'

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

// ─── Editor mode switcher bar ─────────────────────────────────────────────────
// Sits above the editor. Lets user toggle between DB files and local folder.

function EditorModeSwitcher({ projectId }: { projectId: string }): JSX.Element {
  const { isLocalMode, openLocalFolder, switchToDBMode, createProjectFolder } = useEditor(projectId)
  const { localFolderHandle } = useEditorStore()
  const [creating, setCreating] = React.useState(false)
  const [mismatchInfo, setMismatchInfo] = React.useState<{
    matchPct: number
    matched: number
    total: number
  } | null>(null)

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
      {/* Project Files (DB mode) */}
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

      {/* Local folder — shows folder name when linked */}
      <button
        type="button"
        onClick={isLocalMode && localFolderHandle ? undefined : handleOpenFolder}
        className={cn(
          'rounded px-2.5 py-1 text-xs font-medium transition-colors',
          isLocalMode && localFolderHandle
            ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
        )}
      >
        {isLocalMode && localFolderHandle
          ? `📁 ${localFolderHandle.name}`
          : 'Open Existing Folder'}
      </button>

      {/* Create project folder — always visible, most important action */}
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
        {creating ? 'Creating…' : 'Create Project Folder'}
      </button>

      {/* Change folder — only when a folder is already linked */}
      {isLocalMode && localFolderHandle && (
        <button
          type="button"
          onClick={openLocalFolder}
          className="ml-auto text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          title="Link a different folder"
        >
          Change
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
    openLocalFolder,
  } = useEditor(projectId)
  const { project } = useProject(projectId)
  const { localFolderHandle } = useEditorStore()

  // Derive the currently open DB file from project files
  const openFile =
    (project as (typeof project & { files?: { id: string; [key: string]: unknown }[] }) | null)
      ?.files?.find((f) => f.id === openFileId) ?? null

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

  // ── Local folder not yet assigned — show assign prompt ───────────────────
  if (isLocalMode && !localFolderHandle) {
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
        />

        {/* Monaco editor fills remaining height */}
        <div className="flex-1 overflow-hidden">
          <MonacoEditorWrapper
            file={openFile as FileWithContent | null}
            onContentChange={handleContentChange}
            isLocalMode={isLocalMode}
          />
        </div>
      </div>
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