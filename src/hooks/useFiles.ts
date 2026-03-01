// src/hooks/useFiles.ts

// 1. React imports
import { useCallback } from 'react'

// 2. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports — types
import type { FileWithContent, FileStatus } from '@/types'

// 4. Local types
interface FileFilters {
  status?: FileStatus
  search?: string
  phase?: number
}

interface UpdateFileStatusExtra {
  notes?: string
  filePrompt?: string
  requiredFiles?: string[]
}

export function useFiles(projectId: string) {
  const queryClient = useQueryClient()

  // ── Query ──────────────────────────────────────────────────────────────────
  const {
    data: files = [],
    isLoading,
    refetch,
  } = useQuery<FileWithContent[]>({
    queryKey: ['files', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/files`)
      if (!res.ok) throw new Error('Failed to fetch files')
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 10_000,
    enabled: !!projectId,
  })

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateFileStatusMutation = useMutation({
    mutationFn: async ({
      fileId,
      status,
      extra,
    }: {
      fileId: string
      status: FileStatus
      extra?: UpdateFileStatusExtra
    }) => {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      })
      if (!res.ok) throw new Error('Failed to update file status')
      const json = await res.json()
      return json.data as FileWithContent
    },
    onMutate: async ({ fileId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['files', projectId] })
      const previous = queryClient.getQueryData<FileWithContent[]>(['files', projectId])

      queryClient.setQueryData<FileWithContent[]>(['files', projectId], (old = []) =>
        old.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status,
                completedAt: status === 'COMPLETE' ? new Date() : f.completedAt,
              }
            : f
        )
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['files', projectId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    },
  })

  const saveFileCodeMutation = useMutation({
    mutationFn: async ({ fileId, content }: { fileId: string; content: string }) => {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}/code`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeContent: content }),
      })
      if (!res.ok) throw new Error('Failed to save file code')
      const json = await res.json()
      return json.data as FileWithContent
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<FileWithContent[]>(['files', projectId], (old = []) =>
        old.map((f) => (f.id === updated.id ? updated : f))
      )
    },
  })

  const appendJsonSummaryMutation = useMutation({
    mutationFn: async ({
      fileId,
      json,
    }: {
      fileId: string
      json: Record<string, unknown>
    }) => {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonSummary: json }),
      })
      if (!res.ok) throw new Error('Failed to append JSON summary')
      const data = await res.json()
      return data.data as FileWithContent
    },
    onMutate: async ({ fileId, json }) => {
      await queryClient.cancelQueries({ queryKey: ['files', projectId] })
      const previous = queryClient.getQueryData<FileWithContent[]>(['files', projectId])

      queryClient.setQueryData<FileWithContent[]>(['files', projectId], (old = []) =>
        old.map((f) => (f.id === fileId ? { ...f, jsonSummary: json } : f))
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['files', projectId], context.previous)
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<FileWithContent[]>(['files', projectId], (old = []) =>
        old.map((f) => (f.id === updated.id ? updated : f))
      )
    },
  })

  // ── Client-side filter ─────────────────────────────────────────────────────
  const filterFiles = useCallback(
    (filters: FileFilters): FileWithContent[] => {
      return files.filter((f) => {
        if (filters.status && f.status !== filters.status) return false
        if (filters.phase !== undefined && f.phase !== filters.phase) return false
        if (
          filters.search &&
          !f.filePath.toLowerCase().includes(filters.search.toLowerCase())
        )
          return false
        return true
      })
    },
    [files]
  )

  // ── Public API ─────────────────────────────────────────────────────────────
  const updateFileStatus = useCallback(
    (fileId: string, status: FileStatus, extra?: UpdateFileStatusExtra) =>
      updateFileStatusMutation.mutateAsync({ fileId, status, extra }),
    [updateFileStatusMutation]
  )

  const saveFileCode = useCallback(
    (fileId: string, content: string) =>
      saveFileCodeMutation.mutateAsync({ fileId, content }),
    [saveFileCodeMutation]
  )

  const appendJsonSummary = useCallback(
    (fileId: string, json: Record<string, unknown>) =>
      appendJsonSummaryMutation.mutateAsync({ fileId, json }),
    [appendJsonSummaryMutation]
  )

  return {
    files,
    isLoading,
    updateFileStatus,
    saveFileCode,
    appendJsonSummary,
    filterFiles,
    refetch,
  }
}