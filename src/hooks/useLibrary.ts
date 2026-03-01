// 1. React imports
import { useCallback, useMemo } from 'react'

// 2. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports — services, types
import { searchLibraryPrompts } from '@/services/searchService'
import type { LibraryPrompt, PaginatedResult, ApiResponse } from '@/types'

// 4. Local types
interface LibraryFilters {
  tool?: string
  category?: string
  sort?: 'most_copied' | 'highest_rated' | 'newest' | 'trending'
  search?: string
  page?: number
}

interface UseLibraryReturn {
  prompts: LibraryPrompt[]
  isLoading: boolean
  hasMore: boolean
  total: number
  submitPrompt: (data: SubmitPromptData) => Promise<void>
  copyPrompt: (promptId: string) => Promise<void>
  deletePrompt: (promptId: string) => Promise<void>
  saveToCollection: (promptId: string, collectionId: string) => Promise<void>
}

interface SubmitPromptData {
  title: string
  description: string
  promptText: string
  aiTool: string
  category: string
  makePublic: boolean
}

// 5. Hook definition
export function useLibrary(filters: LibraryFilters = {}): UseLibraryReturn {
  const queryClient = useQueryClient()
  const { tool, category, sort, search, page = 1 } = filters

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (tool && tool !== 'all') params.set('tool', tool)
    if (category && category !== 'all') params.set('category', category)
    if (sort) params.set('sort', sort)
    if (page > 1) params.set('page', String(page))
    params.set('pageSize', '20')
    return params.toString()
  }, [tool, category, sort, page])

  // Fetch library prompts from API
  const { data, isLoading } = useQuery({
    queryKey: ['library', { tool, category, sort, page }],
    queryFn: async (): Promise<PaginatedResult<LibraryPrompt>> => {
      const res = await fetch(`/api/library?${queryParams}`)
      if (!res.ok) throw new Error('Failed to fetch library prompts')
      const json: ApiResponse<PaginatedResult<LibraryPrompt>> = await res.json()
      if (!json.data) throw new Error(json.error ?? 'Unknown error')
      return json.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes per Section 8.2
  })

  // Apply client-side search filtering via searchService if search query provided
  const filteredPrompts = useMemo(() => {
    const allPrompts = data?.items ?? []
    if (!search || search.trim().length < 2) return allPrompts
    return searchLibraryPrompts(allPrompts, search)
  }, [data?.items, search])

  // Copy prompt mutation — POST /api/library/[id]/copy
  const copyMutation = useMutation({
    mutationFn: async (promptId: string): Promise<void> => {
      const res = await fetch(`/api/library/${promptId}/copy`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to record copy')
    },
    onSuccess: (_data, promptId) => {
      // Optimistically update copy count in cached data
      queryClient.setQueryData(
        ['library', { tool, category, sort, page }],
        (old: PaginatedResult<LibraryPrompt> | undefined) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((p) =>
              p.id === promptId ? { ...p, copyCount: p.copyCount + 1 } : p
            ),
          }
        }
      )
    },
  })

  // Submit prompt mutation — POST /api/library
  const submitMutation = useMutation({
    mutationFn: async (data: SubmitPromptData): Promise<void> => {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to submit prompt')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
  })

  // Delete prompt mutation
  const deleteMutation = useMutation({
    mutationFn: async (promptId: string): Promise<void> => {
      const res = await fetch(`/api/library/${promptId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to delete prompt')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
    },
  })
  const saveToCollectionMutation = useMutation({
    mutationFn: async ({
      promptId,
      collectionId,
    }: {
      promptId: string
      collectionId: string
    }): Promise<void> => {
      // First fetch the prompt details to copy into the collection
      const promptRes = await fetch(`/api/library/${promptId}`)
      if (!promptRes.ok) throw new Error('Failed to fetch prompt details')
      const promptJson: ApiResponse<LibraryPrompt> = await promptRes.json()
      const prompt = promptJson.data
      if (!prompt) throw new Error('Prompt not found')

      const res = await fetch(`/api/collections/${collectionId}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prompt.title,
          promptText: prompt.promptText,
          aiTool: prompt.aiTool,
          category: prompt.category,
          visibility: 'PRIVATE',
          libraryPromptId: promptId,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to save to collection')
      }
    },
    onSuccess: (_data, { collectionId }) => {
      queryClient.invalidateQueries({ queryKey: ['collection-prompts', collectionId] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  // Stable callback wrappers
  const copyPrompt = useCallback(
    async (promptId: string): Promise<void> => {
      await copyMutation.mutateAsync(promptId)
    },
    [copyMutation]
  )

  const submitPrompt = useCallback(
    async (data: SubmitPromptData): Promise<void> => {
      await submitMutation.mutateAsync(data)
    },
    [submitMutation]
  )

  const saveToCollection = useCallback(
    async (promptId: string, collectionId: string): Promise<void> => {
      await saveToCollectionMutation.mutateAsync({ promptId, collectionId })
    },
    [saveToCollectionMutation]
  )

  const deletePrompt = useCallback(
    async (promptId: string): Promise<void> => {
      await deleteMutation.mutateAsync(promptId)
    },
    [deleteMutation]
  )

  return {
    prompts: filteredPrompts,
    isLoading,
    hasMore: data?.hasMore ?? false,
    total: data?.total ?? 0,
    submitPrompt,
    copyPrompt,
    deletePrompt,
    saveToCollection,
  }
}