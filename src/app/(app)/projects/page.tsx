'use client'

import { useRouter } from 'next/navigation'
import { Plus, FolderOpen, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Project, ApiResponse } from '@/types'

function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const json: ApiResponse<Project[]> = await res.json()
      return json.data ?? []
    },
    staleTime: 30_000,
  })
}

export default function ProjectsPage(): JSX.Element {
  const router = useRouter()
  const { data: projects, isLoading } = useProjects()
  const queryClient = useQueryClient()

  const { mutate: deleteProject } = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete project')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  })

  const handleDelete = (e: React.MouseEvent, projectId: string): void => {
    e.stopPropagation()
    if (!confirm('Delete this project? This cannot be undone.')) return
    deleteProject(projectId)
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Projects</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage all your AI-assisted builds
          </p>
        </div>
        <Button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="gap-2 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150"
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size={32} />
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to get started."
          action={{ label: 'New Project', onClick: () => router.push('/dashboard') }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/projects/${project.id}/workspace`)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(`/projects/${project.id}/workspace`) }}
              className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5 text-left transition-all duration-150 hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-md)] cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-[var(--text-primary)] line-clamp-2">
                  {project.name}
                </h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  project.status === 'COMPLETE'
                    ? 'bg-green-500/10 text-green-400'
                    : project.status === 'IN_PROGRESS'
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)]'
                }`}>
                  {project.status?.replace('_', ' ') ?? 'Draft'}
                </span>
              </div>
              {project.description && (
                <p className="mt-1.5 text-xs text-[var(--text-secondary)] line-clamp-2">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[var(--text-tertiary)]">
                  {project.totalFiles ?? 0} files
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, project.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-400/10 transition-colors duration-150"
                  aria-label="Delete project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}