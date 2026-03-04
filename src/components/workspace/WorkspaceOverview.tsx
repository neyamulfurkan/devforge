'use client'

// 1. React imports
import React, { useCallback, useState, useEffect } from 'react'

// 2. Third-party library imports
import { Copy, FileText, Terminal, Download, AlertCircle, ChevronRight, Globe, ExternalLink, Check } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// 4. Internal imports — workspace components
import { ProgressRing } from '@/components/workspace/ProgressRing'
import { TerminalScriptModal } from '@/components/workspace/TerminalScriptModal'

// 5. Internal imports — dashboard components
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

// 6. Internal imports — hooks, utils, types
import { useProject } from '@/hooks/useProject'
import { useFiles } from '@/hooks/useFiles'
import { useErrors } from '@/hooks/useErrors'
import { useDocument } from '@/hooks/useDocument'
import { copyToClipboard, calculateProgress, cn } from '@/lib/utils'
import { PHASE_NAMES } from '@/lib/constants'
import type { WorkspaceTab, ActivityEntry, ExtractedFile } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceOverviewProps {
  projectId: string
  onTabChange: (tab: WorkspaceTab) => void
}

// ─── Phase progress helper ────────────────────────────────────────────────────

interface PhaseProgress {
  phase: number
  name: string
  complete: number
  total: number
  pct: number
}

// ─── Sub-component: mini progress bar ────────────────────────────────────────

function MiniProgressBar({ pct }: { pct: number }): JSX.Element {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
      <div
        className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── Sub-component: quick action button ──────────────────────────────────────

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  isLoading,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  variant?: 'default' | 'accent'
  isLoading?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border p-4 transition-all duration-150 disabled:opacity-50',
        variant === 'accent'
          ? 'border-[var(--accent-border)] bg-[var(--accent-light)] text-[var(--accent-primary)] hover:bg-[var(--accent-light)] hover:border-[var(--accent-primary)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--bg-quaternary)] hover:text-[var(--text-primary)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:outline-none active:scale-95'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center text-xs font-medium leading-tight">{label}</span>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WorkspaceOverview({
  projectId,
  onTabChange,
}: WorkspaceOverviewProps): JSX.Element {
  const [scriptModalOpen, setScriptModalOpen] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [deploymentUrl, setDeploymentUrl] = useState('')
  const [isSavingUrl, setIsSavingUrl] = useState(false)
  const [urlSaved, setUrlSaved] = useState(false)
  const [urlError, setUrlError] = useState('')

  const { project, refetch } = useProject(projectId)
  const { files } = useFiles(projectId)
  const { pendingCount } = useErrors(projectId)
  const { document: projectDocument } = useDocument(projectId)

  // ── Sync deploymentUrl from project into local state on load ─────────────
  useEffect(() => {
    if (project?.deploymentUrl) {
      setDeploymentUrl(project.deploymentUrl)
    }
  }, [project?.deploymentUrl])

  // ── Derived data ──────────────────────────────────────────────────────────

  const totalFiles = project?.totalFiles ?? 0
  const completedFiles = project?.completedFiles ?? 0
  const progressPct = calculateProgress(completedFiles, totalFiles)

  // Build per-phase progress from the live files list
  const phaseProgress: PhaseProgress[] = Object.entries(PHASE_NAMES).map(([phaseStr, name]) => {
    const phaseNum = Number(phaseStr)
    const phaseFiles = files.filter((f) => f.phase === phaseNum)
    const phaseComplete = phaseFiles.filter((f) => f.status === 'COMPLETE').length
    return {
      phase: phaseNum,
      name,
      complete: phaseComplete,
      total: phaseFiles.length,
      pct: calculateProgress(phaseComplete, phaseFiles.length),
    }
  }).filter((p) => p.total > 0)

  // Build project-scoped activities (last 10)
  // Activities are derived from files with completedAt, etc.
  // The ActivityFeed expects ActivityEntry[] — we build a minimal list from files
  const recentActivities: ActivityEntry[] = files
    .filter((f) => f.completedAt)
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bTime - aTime
    })
    .slice(0, 10)
    .map((f) => ({
      id: f.id,
      type: 'file_complete' as const,
      projectId,
      projectName: project?.name ?? '',
      description: `${f.fileName} marked complete`,
      createdAt: f.completedAt!,
    }))

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCopyDocument = useCallback(async () => {
    if (!projectDocument?.rawContent) return
    setIsCopying(true)
    await copyToClipboard(projectDocument.rawContent)
    setTimeout(() => setIsCopying(false), 1500)
  }, [projectDocument?.rawContent])

  const handleViewFiles = useCallback(() => {
    onTabChange('files')
  }, [onTabChange])

  const handleExportZip = useCallback(() => {
    onTabChange('export')
  }, [onTabChange])

  const handleSaveDeploymentUrl = useCallback(async () => {
    setUrlError('')
    const trimmed = deploymentUrl.trim()
    if (trimmed && !/^https?:\/\/.+/.test(trimmed)) {
      setUrlError('URL must start with http:// or https://')
      return
    }
    setIsSavingUrl(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentUrl: trimmed || null }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setUrlSaved(true)
      refetch?.()
      setTimeout(() => setUrlSaved(false), 2000)
    } catch {
      setUrlError('Failed to save URL. Please try again.')
    } finally {
      setIsSavingUrl(false)
    }
  }, [deploymentUrl, projectId, refetch])

  // Files for terminal script modal
  const extractedFiles: ExtractedFile[] = files.map((f) => ({
    fileNumber: f.fileNumber,
    filePath: f.filePath,
    fileName: f.fileName,
    phase: f.phase,
    phaseName: f.phaseName,
    requiredFiles: f.requiredFiles ?? [],
  }))

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Row 1: Project summary + Progress ring ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Project summary card */}
        <Card className="col-span-2 border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    {project?.name ?? '—'}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                    {project?.description ?? ''}
                  </p>
                </div>
                {/* Status badge */}
                <span
                  className={cn(
                    'flex-shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                    project?.status === 'COMPLETE'
                      ? 'border-[var(--status-complete)]/20 bg-[var(--status-complete-bg)] text-[var(--status-complete)]'
                      : project?.status === 'PAUSED'
                        ? 'border-[var(--status-empty)]/20 bg-[var(--status-empty-bg)] text-[var(--status-empty)]'
                        : 'border-[var(--status-in-progress)]/20 bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)]'
                  )}
                >
                  {project?.status?.toLowerCase().replace('_', ' ') ?? 'loading'}
                </span>
              </div>

              {/* Tech stack tags */}
              {project?.techStack && project.techStack.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {project.techStack.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-[var(--border-default)] bg-[var(--bg-quaternary)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta row */}
              <p className="text-xs text-[var(--text-tertiary)]">
                {totalFiles} total files &middot;{' '}
                {completedFiles} complete
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Progress ring card */}
        <Card className="flex items-center justify-center border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6">
          <ProgressRing
            percentage={progressPct}
            size={160}
            strokeWidth={10}
            label="Files"
            sublabel={`${completedFiles} of ${totalFiles} complete`}
          />
        </Card>
      </div>

      {/* ── Row 2: Phase progress ──────────────────────────────────────── */}
      {phaseProgress.length > 0 && (
        <Card className="border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <CardHeader className="border-b border-[var(--border-subtle)] px-5 py-3">
            <CardTitle className="text-sm font-semibold text-[var(--text-primary)]">
              Phase Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {phaseProgress.map((p) => (
                <div key={p.phase} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-[var(--text-secondary)]">
                      Phase {p.phase} — {p.name}
                    </span>
                    <span className="flex-shrink-0 text-xs text-[var(--text-tertiary)]">
                      {p.complete}/{p.total}
                    </span>
                  </div>
                  <MiniProgressBar pct={p.pct} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Row 3: Quick actions ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <QuickActionButton
          icon={Copy}
          label={isCopying ? 'Copied!' : 'Copy Full Document'}
          onClick={handleCopyDocument}
          variant="accent"
          isLoading={isCopying}
        />
        <QuickActionButton
          icon={FileText}
          label="View Files"
          onClick={handleViewFiles}
        />
        <QuickActionButton
          icon={Terminal}
          label="Generate Script"
          onClick={() => setScriptModalOpen(true)}
        />
        <QuickActionButton
          icon={Download}
          label="Export ZIP"
          onClick={handleExportZip}
        />
      </div>

      {/* ── Deployment URL ────────────────────────────────────────────── */}
      <Card className="border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
        <CardHeader className="border-b border-[var(--border-subtle)] px-5 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Globe className="h-4 w-4 text-[var(--accent-primary)]" />
            Live Deployment
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {project?.deploymentUrl ? (
            <div className="flex flex-col gap-3">
              <a
                href={project.deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-light)] px-4 py-3 text-sm font-medium text-[var(--accent-primary)] transition-colors hover:underline"
              >
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{project.deploymentUrl}</span>
              </a>
              <button
                type="button"
                onClick={() => setDeploymentUrl(project.deploymentUrl ?? '')}
                className="self-start text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline"
              >
                Change URL
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--text-secondary)]">
                Paste your deployed project URL (e.g. Vercel, Netlify, Railway).
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={deploymentUrl}
                  onChange={(e) => { setDeploymentUrl(e.target.value); setUrlError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveDeploymentUrl()}
                  placeholder="https://your-app.vercel.app"
                  className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveDeploymentUrl}
                  disabled={isSavingUrl || !deploymentUrl.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--accent-hover)] disabled:opacity-50 active:scale-95"
                >
                  {urlSaved ? <Check className="h-4 w-4" /> : isSavingUrl ? '…' : 'Save'}
                </button>
              </div>
              {urlError && <p className="text-xs text-[var(--status-error)]">{urlError}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 4: Pending errors card (conditional) ───────────────────── */}
      {pendingCount > 0 && (
        <Card className="border-[var(--status-error)]/30 bg-[var(--status-error-bg)]">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-[var(--status-error)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--status-error)]">
                  {pendingCount} pending error{pendingCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Unresolved issues need attention
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => onTabChange('errors')}
              className="flex-shrink-0 border-[var(--status-error)]/30 bg-[var(--status-error)] text-white hover:bg-[var(--status-error)]/90"
            >
              View Errors
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Row 5: Recent activity ─────────────────────────────────────── */}
      <ActivityFeed activities={recentActivities} maxItems={10} />

      {/* ── Terminal Script Modal ──────────────────────────────────────── */}
      {scriptModalOpen && (
        <TerminalScriptModal
          open={scriptModalOpen}
          onClose={() => setScriptModalOpen(false)}
          files={extractedFiles}
          npmInstallCmd={projectDocument?.rawContent ? extractNpmInstall(projectDocument.rawContent) : ''}
        />
      )}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extracts the npm install command from the document's Section 3.3 */
function extractNpmInstall(rawContent: string): string {
  const section33Match = rawContent.match(
    /## SECTION 3\.3[^\n]*\n([\s\S]*?)(?=## SECTION|$)/
  )
  if (!section33Match) return 'npm install'
  const lines = section33Match[1]
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const deps: string[] = []
  const devDeps: string[] = []
  let inDev = false

  for (const line of lines) {
    if (line.toLowerCase().startsWith('devdependencies')) {
      inDev = true
      continue
    }
    // Lines like "next@14.2.5"
    if (/^[\w@/-]+@[\d]/.test(line)) {
      if (inDev) devDeps.push(line)
      else deps.push(line)
    }
  }

  const parts: string[] = []
  if (deps.length) parts.push(`npm install ${deps.join(' ')}`)
  if (devDeps.length) parts.push(`npm install -D ${devDeps.join(' ')}`)
  return parts.join('\n') || 'npm install'
}

export default WorkspaceOverview