'use client'

// 1. React imports
import { useCallback } from 'react'

// 2. Next.js imports
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// 3. Third-party library imports
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Plus, FileCode, AlertCircle, Bookmark, Rocket } from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 5. Internal imports — shared/layout components
import { PageContainer } from '@/components/layout/PageContainer'

// 6. Internal imports — feature components
import { ProjectCard } from '@/components/dashboard/ProjectCard'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { WelcomeBanner } from '@/components/dashboard/WelcomeBanner'
import { QuickActions } from '@/components/dashboard/QuickActions'

// 7. Internal imports — hooks, utils, types
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { ApiResponse, Project, ActivityEntry } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  errorsResolved: number
  promptsSaved: number
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects')
  if (!res.ok) throw new Error('Failed to fetch projects')
  const body = (await res.json()) as ApiResponse<Project[]>
  return body.data ?? []
}

async function fetchStats(): Promise<DashboardStats> {
  return { errorsResolved: 0, promptsSaved: 0 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NewProjectCard(): JSX.Element {
  return (
    <Link
      href="/projects/new"
      className={cn(
        'group flex min-h-[180px] flex-col items-center justify-center gap-3',
        'rounded-xl border-2 border-dashed border-[var(--border-default)]',
        'bg-[var(--bg-tertiary)] transition-all duration-150',
        'hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)]',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[var(--bg-primary)]'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          'bg-[var(--bg-quaternary)] transition-colors duration-150',
          'group-hover:bg-[var(--accent-primary)]'
        )}
      >
        <Plus
          className={cn(
            'h-5 w-5 text-[var(--text-secondary)] transition-colors duration-150',
            'group-hover:text-white'
          )}
        />
      </div>
      <span
        className={cn(
          'text-sm font-medium text-[var(--text-secondary)] transition-colors duration-150',
          'group-hover:text-[var(--accent-primary)]'
        )}
      >
        New Project
      </span>
    </Link>
  )
}

function ContinueSessionCard({ project }: { project: Project }): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border',
        'border-[var(--accent-border)] bg-[var(--accent-light)] px-5 py-4'
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]">
          <FolderOpen className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
            Continue Where You Left Off
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">
            {project.name}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            {project.completedFiles} / {project.totalFiles} files complete
          </p>
        </div>
      </div>
      <Button
        asChild
        size="sm"
        className="flex-shrink-0 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
      >
        <Link href={`/projects/${project.id}/workspace`}>Continue</Link>
      </Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage(): JSX.Element {
  const router = useRouter()
  const { user } = useAuth()

  const { data: projects = [] } = useQuery<Project[], Error>({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    staleTime: 30_000,
  })

  const { data: stats } = useQuery<DashboardStats, Error>({
    queryKey: ['dashboard-stats'],
    queryFn: fetchStats,
    staleTime: 60_000,
  })

  const handleOpenProject = useCallback(
    (projectId: string) => {
      router.push(`/projects/${projectId}/workspace`)
    },
    [router]
  )

  // Last opened project for Continue Session card — sort desc by lastOpenedAt
  const lastProject =
    projects.length > 0
      ? [...projects].sort(
          (a, b) =>
            new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
        )[0] ?? null
      : null

  // Derived cumulative stats from project list
  const filesGenerated = projects.reduce((sum, p) => sum + p.completedFiles, 0)

  // No dedicated activity API yet — empty feed (populated once real endpoint exists)
  const activities: ActivityEntry[] = []

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">

        {/* Welcome banner — only visible when no projects exist */}
        <WelcomeBanner
          userName={user?.name ?? 'there'}
          hasProjects={projects.length > 0}
        />

        {/* Continue Last Session — only visible once at least one project exists */}
        {lastProject !== null && projects.length > 0 && (
          <ContinueSessionCard project={lastProject} />
        )}

        {/* Quick stats row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard
            label="Total Projects"
            value={projects.length}
            icon={FolderOpen}
          />
          <StatsCard
            label="Files Generated"
            value={filesGenerated}
            icon={FileCode}
          />
          <StatsCard
            label="Errors Resolved"
            value={stats?.errorsResolved ?? 0}
            icon={AlertCircle}
          />
          <StatsCard
            label="Prompts Saved"
            value={stats?.promptsSaved ?? 0}
            icon={Bookmark}
          />
        </div>

        {/* Main layout: projects grid left, activity panel right */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* Left — projects grid */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {projects.length > 0 && (
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Active Projects
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Link href="/projects/deployed" className="flex items-center gap-1.5">
                      <Rocket className="h-3.5 w-3.5" />
                      Deployed
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Link href="/projects">View all</Link>
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={handleOpenProject}
                />
              ))}
              {/* New Project card always appears at end of grid */}
              <NewProjectCard />
            </div>
          </div>

          {/* Right panel — quick actions + activity feed */}
          <div className="flex flex-shrink-0 flex-col gap-4 lg:w-80 xl:w-96">
            <QuickActions lastOpenedProjectId={lastProject?.id} />
            <ActivityFeed activities={activities} maxItems={10} />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}