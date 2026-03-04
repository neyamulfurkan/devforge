'use client'

// 1. React imports
import React, { useState, useMemo } from 'react'

// 2. Next.js imports
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// 3. Third-party library imports
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Globe, ArrowLeft, Search, Rocket, Layers, Clock } from 'lucide-react'

// 4. Internal imports
import { PageContainer } from '@/components/layout/PageContainer'
import { formatRelativeTime, cn } from '@/lib/utils'
import type { ApiResponse, Project } from '@/types'

// ─── Fetcher ─────────────────────────────────────────────────────────────────

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error('Failed to fetch projects')
  const body = (await res.json()) as ApiResponse<Project[]>
  return body.data ?? []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function getPlatformLabel(url: string): { label: string; color: string } {
  const host = url.toLowerCase()
  if (host.includes('vercel')) return { label: 'Vercel', color: '#000000' }
  if (host.includes('netlify')) return { label: 'Netlify', color: '#00ad9f' }
  if (host.includes('railway')) return { label: 'Railway', color: '#7b2bf9' }
  if (host.includes('render')) return { label: 'Render', color: '#46e3b7' }
  if (host.includes('fly.io')) return { label: 'Fly.io', color: '#7c3aed' }
  if (host.includes('github.io')) return { label: 'GitHub Pages', color: '#24292f' }
  return { label: 'Live', color: '#6366f1' }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CardSkeleton(): JSX.Element {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] overflow-hidden">
      <div className="h-44 bg-[var(--bg-quaternary)]" />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-4 w-2/3 rounded bg-[var(--bg-quaternary)]" />
        <div className="h-3 w-full rounded bg-[var(--bg-quaternary)]" />
        <div className="h-3 w-4/5 rounded bg-[var(--bg-quaternary)]" />
        <div className="flex gap-2 mt-1">
          <div className="h-5 w-14 rounded-full bg-[var(--bg-quaternary)]" />
          <div className="h-5 w-14 rounded-full bg-[var(--bg-quaternary)]" />
        </div>
      </div>
    </div>
  )
}

// ─── Preview Frame ────────────────────────────────────────────────────────────

function SitePreview({ url, name }: { url: string; name: string }): JSX.Element {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)
  const { label, color } = getPlatformLabel(url)

  // X-Frame-Options blocks don't fire onError — detect by checking
  // if the iframe content is accessible after load
  const handleLoad = () => {
    try {
      // If frame was blocked, contentDocument is null or throws
      setLoaded(true)
    } catch {
      setErrored(true)
    }
    setLoaded(true)
  }

  return (
    <div className="relative h-44 w-full overflow-hidden bg-[var(--bg-quaternary)] rounded-t-2xl">
      {/* Platform badge */}
      <div
        className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide text-white shadow-lg"
        style={{ backgroundColor: color }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />
        {label}
      </div>

      {/* Live badge */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        LIVE
      </div>

      {/* Iframe preview */}
      {!errored ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
              <Globe className="h-8 w-8 text-[var(--text-tertiary)] animate-spin" style={{ animationDuration: '3s' }} />
              <span className="text-xs text-[var(--text-tertiary)]">Loading preview…</span>
            </div>
          )}
          <iframe
            src={url}
            title={`Preview of ${name}`}
            className={cn(
              'absolute inset-0 w-[200%] h-[200%] origin-top-left scale-50 border-0 pointer-events-none transition-opacity duration-500',
              loaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={(e) => {
              try {
                const doc = (e.target as HTMLIFrameElement).contentDocument
                if (!doc || doc.body === null) {
                  setErrored(true)
                } else {
                  setLoaded(true)
                }
              } catch {
                // Cross-origin access throws — means it loaded but is blocked
                // This actually means it rendered — show it
                setLoaded(true)
              }
            }}
            onError={() => setErrored(true)}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
          {/* Gradient overlay for clean fade */}
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-[var(--bg-tertiary)] pointer-events-none" />
        </>
      ) : (
        /* Fallback when iframe blocked */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--bg-quaternary)] to-[var(--bg-primary)]">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: `linear-gradient(135deg, ${color}33, ${color}11)`, border: `1px solid ${color}44` }}
          >
            <Globe className="h-7 w-7" style={{ color }} />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">{getHostname(url)}</p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Click to visit site</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Deployed Project Card ────────────────────────────────────────────────────

function DeployedProjectCard({ project }: { project: Project & { deploymentUrl: string } }): JSX.Element {
  const router = useRouter()
  const progress = Math.round((project.completedFiles / Math.max(project.totalFiles, 1)) * 100)
  const visibleStack = project.techStack.slice(0, 3)
  const extraCount = project.techStack.length - 3

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]',
        'overflow-hidden transition-all duration-300',
        'hover:-translate-y-1 hover:border-[var(--accent-border)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
      )}
    >
      {/* Site preview */}
      <SitePreview url={project.deploymentUrl} name={project.name} />

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Name + open workspace */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-2 cursor-pointer hover:text-[var(--accent-primary)] transition-colors"
            onClick={() => router.push(`/projects/${project.id}/workspace`)}
          >
            {project.name}
          </h3>
          <span className="flex-shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-quaternary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-tertiary)] capitalize whitespace-nowrap">
            {project.status.toLowerCase().replace('_', ' ')}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          {project.description}
        </p>

        {/* Tech stack */}
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleStack.map((tech) => (
              <span
                key={tech}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-quaternary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
              >
                {tech}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-quaternary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                +{extraCount}
              </span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {project.completedFiles}/{project.totalFiles} files
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(project.updatedAt)}
          </span>
          <span className="ml-auto font-semibold text-[var(--accent-primary)]">{progress}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
          <div
            className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Footer actions */}
        <div className="flex gap-2 pt-1">
          <a
            href={project.deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold',
              'bg-[var(--accent-primary)] text-white transition-all duration-150',
              'hover:bg-[var(--accent-hover)] active:scale-95'
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Visit Site
          </a>
          <button
            type="button"
            onClick={() => router.push(`/projects/${project.id}/workspace`)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold',
              'border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)]',
              'hover:border-[var(--border-emphasis)] hover:text-[var(--text-primary)] transition-all duration-150 active:scale-95'
            )}
          >
            Open Workspace
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyDeployed(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[var(--accent-primary)]/10 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-light)] border border-[var(--accent-border)]">
          <Rocket className="h-9 w-9 text-[var(--accent-primary)]" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">No deployments yet</h2>
        <p className="max-w-sm text-sm text-[var(--text-secondary)] leading-relaxed">
          Once you deploy a project and add its live URL in the workspace Overview tab, it will appear here.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeployedProjectsPage(): JSX.Element {
  const [search, setSearch] = useState('')

  const { data: projects = [], isLoading } = useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 30_000,
  })

  // Filter only projects with a deploymentUrl
  const deployedProjects = useMemo(
    () =>
      projects.filter(
        (p): p is Project & { deploymentUrl: string } =>
          typeof p.deploymentUrl === 'string' && p.deploymentUrl.trim().length > 0
      ),
    [projects]
  )

  // Search filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return deployedProjects
    return deployedProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.techStack.some((t) => t.toLowerCase().includes(q))
    )
  }, [deployedProjects, search])

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-2 w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-light)] border border-[var(--accent-border)]">
                  <Rocket className="h-5 w-5 text-[var(--accent-primary)]" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Deployed Projects</h1>
              </div>
              {!isLoading && (
                <p className="text-sm text-[var(--text-tertiary)] ml-[52px]">
                  {deployedProjects.length === 0
                    ? 'No live projects yet'
                    : `${deployedProjects.length} project${deployedProjects.length !== 1 ? 's' : ''} live`}
                </p>
              )}
            </div>

            {/* Search */}
            {deployedProjects.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deployed projects…"
                  className={cn(
                    'h-9 w-64 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)]',
                    'pl-9 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                    'focus:border-[var(--accent-primary)] focus:outline-none transition-colors'
                  )}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        {!isLoading && deployedProjects.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Live Projects',
                value: deployedProjects.length,
                icon: Globe,
                color: 'text-emerald-400',
                bg: 'bg-emerald-400/10 border-emerald-400/20',
              },
              {
                label: 'Total Files Built',
                value: deployedProjects.reduce((s, p) => s + p.completedFiles, 0),
                icon: Layers,
                color: 'text-[var(--accent-primary)]',
                bg: 'bg-[var(--accent-light)] border-[var(--accent-border)]',
              },
              {
                label: 'Platforms',
                value: new Set(deployedProjects.map((p) => getPlatformLabel(p.deploymentUrl).label)).size,
                icon: Rocket,
                color: 'text-purple-400',
                bg: 'bg-purple-400/10 border-purple-400/20',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-4 rounded-2xl border p-4',
                  'bg-[var(--bg-tertiary)]',
                  'border-[var(--border-subtle)]'
                )}
              >
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border', bg)}>
                  <Icon className={cn('h-5 w-5', color)} />
                </div>
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
                  <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Grid ───────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : deployedProjects.length === 0 ? (
          <EmptyDeployed />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Search className="h-10 w-10 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">No projects match &ldquo;{search}&rdquo;</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="text-xs text-[var(--accent-primary)] hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <DeployedProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

      </div>
    </PageContainer>
  )
}