// src/hooks/useRealtime.ts
//
// Replaces Supabase Realtime subscriptions with TanStack Query polling.
// The hook interface is identical to the previous version — consuming
// components (e.g. WorkspacePage) require no changes.

// 1. React imports
import { useEffect, useRef } from 'react'

// 2. TanStack Query
import { useQueryClient } from '@tanstack/react-query'

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often (ms) to re-fetch when a realtime hook is mounted. */
const POLL_INTERVAL_MS = 10_000

// ─── useDocumentRealtime ───────────────────────────────────────────────────────

/**
 * Triggers `onUpdate` every POLL_INTERVAL_MS while mounted, and also
 * immediately invalidates the project document query so TanStack Query
 * refetches in the background.
 */
export function useDocumentRealtime(
  projectId: string,
  onUpdate: () => void
): void {
  const queryClient = useQueryClient()
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!projectId) return

    const tick = () => {
      try {
        onUpdateRef.current()
      } catch (err) {
        console.error('[useDocumentRealtime] onUpdate callback error:', err)
      }
      // Also invalidate so any useQuery for this document refetches.
      queryClient.invalidateQueries({ queryKey: ['document', projectId] })
    }

    const intervalId = setInterval(tick, POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [projectId, queryClient])
}

// ─── useFilesRealtime ──────────────────────────────────────────────────────────

/**
 * Triggers `onUpdate` every POLL_INTERVAL_MS while mounted, and also
 * immediately invalidates the project files query so TanStack Query
 * refetches in the background.
 */
export function useFilesRealtime(
  projectId: string,
  onUpdate: () => void
): void {
  const queryClient = useQueryClient()
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!projectId) return

    const tick = () => {
      try {
        onUpdateRef.current()
      } catch (err) {
        console.error('[useFilesRealtime] onUpdate callback error:', err)
      }
      queryClient.invalidateQueries({ queryKey: ['files', projectId] })
    }

    const intervalId = setInterval(tick, POLL_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [projectId, queryClient])
}