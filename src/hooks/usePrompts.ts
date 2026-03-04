// src/hooks/usePrompts.ts

// 1. React imports
import { useCallback } from 'react'

// 2. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports — services, hooks, stores, types, utils
import type { ApiResponse } from '@/types'

// 4. Local types
interface PromptMap {
  [fileNumber: string]: string
}

interface ParsePromptResult {
  count: number
  fileNumbers: string[]
}

interface UseProjectPromptsReturn {
  prompts: PromptMap
  isLoading: boolean
  error: Error | null
  storeFilePrompt: (fileNumber: string, promptText: string) => Promise<void>
  storeAllPrompts: (promptMap: PromptMap) => Promise<void>
  parseAndStore: (rawOutput: string) => Promise<ParsePromptResult>
}

async function fetchPrompts(projectId: string): Promise<PromptMap> {
  const res = await fetch(`/api/projects/${projectId}/prompts`)
  if (!res.ok) throw new Error('Failed to fetch prompts')
  const json: ApiResponse<PromptMap> = await res.json()
  return json.data ?? {}
}

export function useProjectPrompts(projectId: string): UseProjectPromptsReturn {
  const queryClient = useQueryClient()

  // 1. Fetch all file prompts
  const {
    data: prompts = {},
    isLoading,
    error,
  } = useQuery<PromptMap, Error>({
    queryKey: ['prompts', projectId],
    queryFn: () => fetchPrompts(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })

  // 2. Store a single file prompt
  const storeFilePromptMutation = useMutation({
    mutationFn: async ({
      fileNumber,
      promptText,
    }: {
      fileNumber: string
      promptText: string
    }) => {
      const res = await fetch(`/api/projects/${projectId}/prompts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fileNumber]: promptText }),
      })
      if (!res.ok) throw new Error('Failed to store prompt')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts', projectId] })
    },
  })

  // 3. Store all prompts (bulk)
  const storeAllPromptsMutation = useMutation({
    mutationFn: async (promptMap: PromptMap) => {
      const res = await fetch(`/api/projects/${projectId}/prompts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptMap),
      })
      if (!res.ok) throw new Error('Failed to store prompts')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts', projectId] })
    },
  })

  // 4. Parse Claude's raw all-prompts output and store
  const parseAndStoreMutation = useMutation({
    mutationFn: async (rawOutput: string): Promise<ParsePromptResult> => {
      const res = await fetch(`/api/projects/${projectId}/prompts/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawOutput }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? 'Failed to parse prompts')
      }
      const typed = json as ApiResponse<{ stored: number; fileNumbers: string[] }>
      return { count: typed.data?.stored ?? 0, fileNumbers: typed.data?.fileNumbers ?? [] }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts', projectId] })
    },
  })

  const storeFilePrompt = useCallback(
    async (fileNumber: string, promptText: string) => {
      await storeFilePromptMutation.mutateAsync({ fileNumber, promptText })
    },
    [storeFilePromptMutation]
  )

  const storeAllPrompts = useCallback(
    async (promptMap: PromptMap) => {
      await storeAllPromptsMutation.mutateAsync(promptMap)
    },
    [storeAllPromptsMutation]
  )

  const parseAndStore = useCallback(
    async (rawOutput: string): Promise<ParsePromptResult> => {
      return parseAndStoreMutation.mutateAsync(rawOutput)
    },
    [parseAndStoreMutation]
  )

  return {
    prompts,
    isLoading,
    error,
    storeFilePrompt,
    storeAllPrompts,
    parseAndStore,
  }
}