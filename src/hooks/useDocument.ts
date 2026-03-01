// 1. React imports
import { useCallback } from 'react'

// 2. Next.js imports
// (none required)

// 3. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 4. Internal imports — types
import type {
  ProjectDocument,
  ParsedDocumentSection,
  VersionSummary,
  ApiResponse,
} from '@/types'

// ─── Types ─────────────────────────────────────────────────────────────────

interface DocumentResponse {
  id: string
  projectId: string
  rawContent: string
  sections: ParsedDocumentSection[]
  totalSections: number
  totalWords: number
  currentVersion: number
  createdAt: Date
  updatedAt: Date
}

interface UseDocumentReturn {
  document: DocumentResponse | null
  sections: ParsedDocumentSection[]
  versions: VersionSummary[]
  isLoading: boolean
  isVersionsLoading: boolean
  updateSection: (sectionNumber: string, content: string) => Promise<void>
  appendToSection: (sectionNumber: string, content: string) => Promise<void>
  createVersion: (triggerEvent: string, changeSummary?: string) => Promise<void>
  restoreVersion: (versionNumber: number) => Promise<void>
  importDocument: (rawContent: string) => Promise<void>
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useDocument(projectId: string): UseDocumentReturn {
  const queryClient = useQueryClient()

  // ── Document query (always fresh — staleTime: 0) ────────────────────────
// ── Document query (always fresh — staleTime: 0) ────────────────────────
    const {
      data: documentData,
      isLoading,
    } = useQuery<ApiResponse<DocumentResponse>>({
      queryKey: ['document', projectId],
      queryFn: async () => {
        const res = await fetch(`/api/projects/${projectId}/document`)
        if (!res.ok) {
          throw new Error(`Failed to fetch document: ${res.statusText}`)
        }
        return res.json() as Promise<ApiResponse<DocumentResponse>>
      },
      enabled: Boolean(projectId),
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
    })

  // ── Versions query ───────────────────────────────────────────────────────
  const {
    data: versionsData,
    isLoading: isVersionsLoading,
  } = useQuery<ApiResponse<VersionSummary[]>>({
    queryKey: ['document-versions', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/document/versions`)
      if (!res.ok) {
        throw new Error(`Failed to fetch versions: ${res.statusText}`)
      }
      return res.json() as Promise<ApiResponse<VersionSummary[]>>
    },
    enabled: Boolean(projectId),
    staleTime: 30_000,
  })

  // ── Invalidation helper ──────────────────────────────────────────────────
  const invalidateDocument = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ['document', projectId],
      refetchType: 'all',
    })
    await queryClient.invalidateQueries({
      queryKey: ['document-versions', projectId],
      refetchType: 'all',
    })
  }, [queryClient, projectId])

  // ── updateSection mutation ───────────────────────────────────────────────
  const updateSectionMutation = useMutation({
    mutationFn: async ({
      sectionNumber,
      content,
    }: {
      sectionNumber: string
      content: string
    }) => {
      const res = await fetch(
        `/api/projects/${projectId}/document/sections/${encodeURIComponent(sectionNumber)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Failed to update section: ${res.statusText}`)
      }
    },
    onSuccess: invalidateDocument,
  })

  const updateSection = useCallback(
    async (sectionNumber: string, content: string): Promise<void> => {
      await updateSectionMutation.mutateAsync({ sectionNumber, content })
    },
    [updateSectionMutation]
  )

  // ── appendToSection mutation ─────────────────────────────────────────────
  const appendToSectionMutation = useMutation({
    mutationFn: async ({
      sectionNumber,
      content,
    }: {
      sectionNumber: string
      content: string
    }) => {
      const res = await fetch(
        `/api/projects/${projectId}/document/sections/${encodeURIComponent(sectionNumber)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, append: true }),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Failed to append to section: ${res.statusText}`)
      }
    },
    onSuccess: invalidateDocument,
  })

  const appendToSectionMutateAsync = appendToSectionMutation.mutateAsync
  const appendToSection = useCallback(
    async (sectionNumber: string, content: string): Promise<void> => {
      await appendToSectionMutateAsync({ sectionNumber, content })
    },
    [appendToSectionMutateAsync]
  )

  // ── createVersion mutation ───────────────────────────────────────────────
  const createVersionMutation = useMutation({
    mutationFn: async ({
      triggerEvent,
      changeSummary,
    }: {
      triggerEvent: string
      changeSummary?: string
    }) => {
      const res = await fetch(`/api/projects/${projectId}/document/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', triggerEvent, changeSummary }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Failed to create version: ${res.statusText}`)
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['document-versions', projectId] }),
  })

  const createVersion = useCallback(
    async (triggerEvent: string, changeSummary?: string): Promise<void> => {
      await createVersionMutation.mutateAsync({ triggerEvent, changeSummary })
    },
    [createVersionMutation]
  )

  // ── restoreVersion mutation ──────────────────────────────────────────────
  const restoreVersionMutation = useMutation({
    mutationFn: async ({ versionNumber }: { versionNumber: number }) => {
      const res = await fetch(`/api/projects/${projectId}/document/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', versionNumber }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Failed to restore version: ${res.statusText}`)
      }
    },
    onSuccess: invalidateDocument,
  })

  const restoreVersion = useCallback(
    async (versionNumber: number): Promise<void> => {
      await restoreVersionMutation.mutateAsync({ versionNumber })
    },
    [restoreVersionMutation]
  )

  // ── importDocument mutation ──────────────────────────────────────────────
  const importDocumentMutation = useMutation({
    mutationFn: async ({ rawContent }: { rawContent: string }) => {
      const res = await fetch(`/api/projects/${projectId}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawContent }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Failed to import document: ${res.statusText}`)
      }
    },
    onSuccess: invalidateDocument,
  })

  const importDocument = useCallback(
    async (rawContent: string): Promise<void> => {
      await importDocumentMutation.mutateAsync({ rawContent })
    },
    [importDocumentMutation]
  )

  // ── Derived values ───────────────────────────────────────────────────────
  const document = documentData?.data ?? null
  const sections: ParsedDocumentSection[] = document?.sections ?? []
  // Note: sections are populated from DB JSON; rawContent is the source of truth.
  // Components needing live section data after appends should use rawContent directly.
  const versions: VersionSummary[] = versionsData?.data ?? []

  return {
    document,
    sections,
    versions,
    isLoading,
    isVersionsLoading,
    updateSection,
    appendToSection,
    createVersion,
    restoreVersion,
    importDocument,
  }
}