'use client'

// 1. React imports
import { useCallback } from 'react'

// 2. Third-party imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports
import { useProjectStore } from '@/store/projectStore'
import type { Project, FileStatus, ProjectStatus } from '@/types'

// ─── Local return type ────────────────────────────────────────────────────────

interface UseProjectReturn {
  project: Project | null
  isLoading: boolean
  error: Error | null
  updateStatus: (status: ProjectStatus) => Promise<void>
  updateFile: (fileId: string, status: FileStatus) => Promise<void>
  refetch: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProject(projectId: string): UseProjectReturn {
  const queryClient = useQueryClient()
  const { setCurrentProject } = useProjectStore()

  // ── Fetch project ──────────────────────────────────────────────────────────
  const {
    data: project,
    isLoading,
    error,
    refetch,
  } = useQuery<Project, Error>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error ??
            `Failed to fetch project (${res.status})`
        )
      }
      const json = await res.json() as { data: Project }
      return json.data
    },
    enabled: !!projectId,
    staleTime: 10_000,
  })

  // Sync into projectStore whenever fresh data arrives
  const { setCurrentProject: syncStore } = useProjectStore()
  if (project) {
    syncStore(projectId, project)
  }

  // ── Update project status ──────────────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: async (status: ProjectStatus) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error ?? 'Failed to update project status'
        )
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  // ── Update file status ─────────────────────────────────────────────────────
  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, status }: { fileId: string; status: FileStatus }) => { 
      const res = await fetch(
        `/api/projects/${projectId}/files/${fileId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(
          (body as { error?: string }).error ?? 'Failed to update file status'
        )
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['files', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  // ── Stable callbacks ───────────────────────────────────────────────────────
  const updateStatus = useCallback(
    async (status: ProjectStatus): Promise<void> => {
      await updateStatusMutation.mutateAsync(status)
    },
    [updateStatusMutation]
  )

  const updateFile = useCallback(
    async (fileId: string, status: FileStatus): Promise<void> => {
      await updateFileMutation.mutateAsync({ fileId, status })
    },
    [updateFileMutation]
  )

  return {
    project: project ?? null,
    isLoading,
    error: error ?? null,
    updateStatus,
    updateFile,
    refetch,
  }
}