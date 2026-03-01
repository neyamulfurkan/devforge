// 1. React imports
import { useCallback } from 'react'

// 2. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports — types
import type {
  Collection,
  CollectionPrompt,
  ApiResponse,
  PaginatedResult,
} from '@/types'

// 4. Local types
interface CreateCollectionInput {
  name: string
  description?: string
}

interface UpdateCollectionInput {
  name?: string
  description?: string
  visibility?: 'PRIVATE' | 'PUBLIC'
  sortOrder?: number
}

interface CreatePromptInput {
  title: string
  promptText: string
  aiTool?: string
  category?: string
  notes?: string
  visibility?: 'PRIVATE' | 'PUBLIC'
}

interface UpdatePromptInput {
  title?: string
  promptText?: string
  aiTool?: string
  category?: string
  notes?: string
  visibility?: 'PRIVATE' | 'PUBLIC'
  sortOrder?: number
}

interface CollectionWithCount extends Collection {
  _count?: { prompts: number }
}

interface UseCollectionsReturn {
  collections: CollectionWithCount[]
  isLoading: boolean
  error: Error | null
  createCollection: (name: string, description?: string) => Promise<Collection>
  updateCollection: (id: string, data: UpdateCollectionInput) => Promise<Collection>
  deleteCollection: (id: string) => Promise<void>
  reorderCollections: (orderedIds: string[]) => Promise<void>
  createPrompt: (collectionId: string, data: CreatePromptInput) => Promise<CollectionPrompt>
  updatePrompt: (collectionId: string, promptId: string, data: UpdatePromptInput) => Promise<CollectionPrompt>
  deletePrompt: (collectionId: string, promptId: string) => Promise<void>
  getCollectionPrompts: (collectionId: string | null) => {
    prompts: CollectionPrompt[]
    isLoading: boolean
    error: Error | null
  }
}

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiResponse
    throw new Error(body.error ?? `Request failed with status ${response.status}`)
  }

  const json = await response.json() as ApiResponse<T>
  return json.data as T
}

export function useCollections(): UseCollectionsReturn {
  const queryClient = useQueryClient()

  // ─── Collections list query ───────────────────────────────────────────────
  const {
    data: collections = [],
    isLoading,
    error,
  } = useQuery<CollectionWithCount[], Error>({
    queryKey: ['collections'],
    queryFn: () => apiFetch<CollectionWithCount[]>('/api/collections'),
    staleTime: 30_000,
  })

  // ─── Create collection ────────────────────────────────────────────────────
  const createCollectionMutation = useMutation<Collection, Error, CreateCollectionInput>({
    mutationFn: (input) =>
      apiFetch<Collection>('/api/collections', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const createCollection = useCallback(
    (name: string, description?: string): Promise<Collection> =>
      createCollectionMutation.mutateAsync({ name, description }),
    [createCollectionMutation]
  )

  // ─── Update collection ────────────────────────────────────────────────────
  const updateCollectionMutation = useMutation<
    Collection,
    Error,
    { id: string; data: UpdateCollectionInput }
  >({
    mutationFn: ({ id, data }) =>
      apiFetch<Collection>(`/api/collections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const updateCollection = useCallback(
    (id: string, data: UpdateCollectionInput): Promise<Collection> =>
      updateCollectionMutation.mutateAsync({ id, data }),
    [updateCollectionMutation]
  )

  // ─── Delete collection ────────────────────────────────────────────────────
  const deleteCollectionMutation = useMutation<void, Error, string>({
    mutationFn: (id) =>
      apiFetch<void>(`/api/collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
      // Invalidate any open collection-prompts queries
      void queryClient.invalidateQueries({ queryKey: ['collection-prompts'] })
    },
  })

  const deleteCollection = useCallback(
    (id: string): Promise<void> => deleteCollectionMutation.mutateAsync(id),
    [deleteCollectionMutation]
  )

  // ─── Reorder collections ──────────────────────────────────────────────────
  const reorderCollectionsMutation = useMutation<void, Error, string[]>({
    mutationFn: async (orderedIds) => {
      // Fire individual PATCH requests with new sortOrder values
      await Promise.all(
        orderedIds.map((id, index) =>
          apiFetch<Collection>(`/api/collections/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ sortOrder: index }),
          })
        )
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const reorderCollections = useCallback(
    (orderedIds: string[]): Promise<void> =>
      reorderCollectionsMutation.mutateAsync(orderedIds),
    [reorderCollectionsMutation]
  )

  // ─── Create prompt ────────────────────────────────────────────────────────
  const createPromptMutation = useMutation<
    CollectionPrompt,
    Error,
    { collectionId: string; data: CreatePromptInput }
  >({
    mutationFn: ({ collectionId, data }) =>
      apiFetch<CollectionPrompt>(`/api/collections/${collectionId}/prompts`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { collectionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['collection-prompts', collectionId] })
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const createPrompt = useCallback(
    (collectionId: string, data: CreatePromptInput): Promise<CollectionPrompt> =>
      createPromptMutation.mutateAsync({ collectionId, data }),
    [createPromptMutation]
  )

  // ─── Update prompt ────────────────────────────────────────────────────────
  const updatePromptMutation = useMutation<
    CollectionPrompt,
    Error,
    { collectionId: string; promptId: string; data: UpdatePromptInput }
  >({
    mutationFn: ({ collectionId, promptId, data }) =>
      apiFetch<CollectionPrompt>(
        `/api/collections/${collectionId}/prompts/${promptId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (_result, { collectionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['collection-prompts', collectionId] })
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const updatePrompt = useCallback(
    (
      collectionId: string,
      promptId: string,
      data: UpdatePromptInput
    ): Promise<CollectionPrompt> =>
      updatePromptMutation.mutateAsync({ collectionId, promptId, data }),
    [updatePromptMutation]
  )

  // ─── Delete prompt ────────────────────────────────────────────────────────
  const deletePromptMutation = useMutation<
    void,
    Error,
    { collectionId: string; promptId: string }
  >({
    mutationFn: ({ collectionId, promptId }) =>
      apiFetch<void>(
        `/api/collections/${collectionId}/prompts/${promptId}`,
        { method: 'DELETE' }
      ),
    onSuccess: (_result, { collectionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['collection-prompts', collectionId] })
      void queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })

  const deletePrompt = useCallback(
    (collectionId: string, promptId: string): Promise<void> =>
      deletePromptMutation.mutateAsync({ collectionId, promptId }),
    [deletePromptMutation]
  )

  // ─── Get collection prompts (returns a hook-like object) ──────────────────
  const getCollectionPrompts = useCallback(
    (collectionId: string | null) => {
      // This must be called consistently — callers must not conditionally call this.
      // Internal query is enabled only when collectionId is non-null.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const result = useQuery<CollectionPrompt[], Error>({
        queryKey: ['collection-prompts', collectionId],
        queryFn: () =>
          apiFetch<CollectionPrompt[]>(
            `/api/collections/${collectionId!}/prompts`
          ),
        enabled: collectionId !== null,
        staleTime: 30_000,
      })

      return {
        prompts: result.data ?? [],
        isLoading: result.isLoading,
        error: result.error,
      }
    },
    []
  )

  return {
    collections,
    isLoading,
    error,
    createCollection,
    updateCollection,
    deleteCollection,
    reorderCollections,
    createPrompt,
    updatePrompt,
    deletePrompt,
    getCollectionPrompts,
  }
}