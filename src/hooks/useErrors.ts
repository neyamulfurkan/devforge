// src/hooks/useErrors.ts

// 1. React imports
import { useMemo } from 'react'

// 2. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports — types
import type { ErrorSession } from '@/types'

// 4. Local types
interface AddErrorInput {
  errorType: 'TYPESCRIPT' | 'BUILD' | 'RUNTIME' | 'CONSOLE' | 'OTHER'
  errorOutput: string
}

interface UseErrorsReturn {
  sessions: ErrorSession[]
  pendingCount: number
  isLoading: boolean
  addSession: (data: AddErrorInput) => Promise<ErrorSession>
  resolveSession: (errorId: string, note?: string) => Promise<void>
  updateIdentifiedFiles: (errorId: string, files: string[]) => Promise<void>
}

async function fetchErrors(projectId: string): Promise<ErrorSession[]> {
  const res = await fetch(`/api/projects/${projectId}/errors`)
  if (!res.ok) throw new Error('Failed to fetch error sessions')
  const json = await res.json()
  return json.data ?? []
}

export function useErrors(projectId: string): UseErrorsReturn {
  const queryClient = useQueryClient()

  const { data: sessions = [], isLoading } = useQuery<ErrorSession[]>({
    queryKey: ['errors', projectId],
    queryFn: () => fetchErrors(projectId),
    enabled: Boolean(projectId),
  })

  const pendingCount = useMemo(
    () => sessions.filter((s) => s.status === 'PENDING').length,
    [sessions]
  )

  const addSessionMutation = useMutation<ErrorSession, Error, AddErrorInput>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/projects/${projectId}/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create error session')
      const json = await res.json()
      return json.data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['errors', projectId] })
    },
  })

  const resolveSessionMutation = useMutation<void, Error, { errorId: string; note?: string }>({
    mutationFn: async ({ errorId, note }) => {
      const res = await fetch(`/api/projects/${projectId}/errors/${errorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', resolutionNote: note }),
      })
      if (!res.ok) throw new Error('Failed to resolve error session')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['errors', projectId] })
    },
  })

  const updateIdentifiedFilesMutation = useMutation<void, Error, { errorId: string; files: string[] }>({
    mutationFn: async ({ errorId, files }) => {
      const res = await fetch(`/api/projects/${projectId}/errors/${errorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_files', identifiedFiles: files }),
      })
      if (!res.ok) throw new Error('Failed to update identified files')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['errors', projectId] })
    },
  })

  return {
    sessions,
    pendingCount,
    isLoading,
    addSession: (data) => addSessionMutation.mutateAsync(data),
    resolveSession: (errorId, note) =>
      resolveSessionMutation.mutateAsync({ errorId, note }),
    updateIdentifiedFiles: (errorId, files) =>
      updateIdentifiedFilesMutation.mutateAsync({ errorId, files }),
  }
}