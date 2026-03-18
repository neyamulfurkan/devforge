// 1. React imports
import { useEffect } from 'react'

// 2. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports — stores, types
import { useProjectStore } from '@/store/projectStore'
import type { Project, FileStatus, ApiResponse } from '@/types'

// 4. Local types
interface UpdateStatusParams {
  status: import('@/types').ProjectStatus
}

interface UpdateFileParams {
  fileId: string
  updates: {
    status?: FileStatus
    notes?: string
    filePrompt?: string
    requiredFiles?: string[]
  }
}

async function fetchProject(projectId: string): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiResponse
    throw new Error(body.error ?? 'Failed to fetch project')
  }
  const body = (await res.json()) as ApiResponse<Project>
  if (!body.data) throw new Error('No project data returned')
  return body.data
}

async function patchProject(projectId: string, updates: UpdateStatusParams): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiResponse
    throw new Error(body.error ?? 'Failed to update project')
  }
  const body = (await res.json()) as ApiResponse<Project>
  if (!body.data) throw new Error('No project data returned')
  return body.data
}

async function patchFile(
  projectId: string,
  fileId: string,
  updates: UpdateFileParams['updates']
): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiResponse
    throw new Error(body.error ?? 'Failed to update file')
  }
}

export function useProject(projectId: string) {
  const queryClient = useQueryClient()
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject)
  const updateFileStatusInStore = useProjectStore((s) => s.updateFileStatus)

  const {
    data: project,
    isLoading,
    error,
    refetch,
  } = useQuery<Project, Error>({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 10_000,
  })

  // Sync fetched project into global store
  useEffect(() => {
    if (project) {
      setCurrentProject(project.id, project)
    }
  }, [project, setCurrentProject])

  const updateStatusMutation = useMutation<Project, Error, UpdateStatusParams>({
    mutationFn: (params) => patchProject(projectId, params),
    onSuccess: (updatedProject) => {
      queryClient.setQueryData<Project>(['project', projectId], updatedProject)
      setCurrentProject(updatedProject.id, updatedProject)
    },
  })

  const updateFileMutation = useMutation<void, Error, UpdateFileParams>({
    mutationFn: ({ fileId, updates }) => patchFile(projectId, fileId, updates),
    onMutate: ({ fileId, updates }) => {
      // Optimistic update for file status changes
      if (updates.status) {
        updateFileStatusInStore(fileId, updates.status)
      }
    },
    onSettled: () => {
      // Revalidate file list after mutation settles
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    },
  })

  return {
    project: project ?? null,
    isLoading,
    error,
    refetch,
    updateStatus: (params: UpdateStatusParams) => updateStatusMutation.mutate(params),
    updateFile: (params: UpdateFileParams) => updateFileMutation.mutate(params),
    isUpdatingStatus: updateStatusMutation.isPending,
    isUpdatingFile: updateFileMutation.isPending,
  }
}