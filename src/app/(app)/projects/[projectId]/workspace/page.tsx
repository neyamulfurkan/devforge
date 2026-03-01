'use client'

// 1. React imports
import React, { useEffect, useCallback, Suspense } from 'react'

// 2. Next.js imports
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// 3. Third-party library imports
import { AlertTriangle } from 'lucide-react'

// 4. Internal imports — shared components
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'

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

// ─── Editor layout sub-component ─────────────────────────────────────────────
// Three-panel layout: file tree (left) | editor (center) | top bar (pinned top)

interface EditorLayoutProps {
  projectId: string
}

function EditorLayout({ projectId }: EditorLayoutProps): JSX.Element {
  const { openFile: openFileById, openFileId, onContentChange, saveFile } = useEditor(projectId)
  const { project } = useProject(projectId)

  // Derive the currently open file from project files
  const openFile =
    (project as (typeof project & { files?: { id: string; [key: string]: unknown }[] }) | null)
      ?.files?.find((f) => f.id === openFileId) ?? null

  const handleContentChange = useCallback(
    (content: string) => {
      if (openFileId && onContentChange) {
        onContentChange(content)
      }
    },
    [openFileId, onContentChange]
  )

  const handleMarkComplete = useCallback(async () => {
    if (openFileId && saveFile) {
      await saveFile()
    }
  }, [openFileId, saveFile])

  const handleOpenInEditor = useCallback(
    (fileId: string) => {
      openFileById(fileId)
    },
    [openFileById]
  )

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
          <div className="flex flex-1 overflow-hidden">
            <EditorLayout projectId={projectId} />
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