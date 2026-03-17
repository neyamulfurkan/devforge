// src/hooks/useErrors.ts
// NOTE: This project also requires two new API route files:
//
// FILE: src/app/api/devprobe/ingest/route.ts
// (create this file with the content below)
//
// FILE: src/app/api/devprobe/ping/route.ts
// (create this file with the content below)

// 1. React imports
import { useMemo, useEffect, useRef, useState } from 'react'

// 2. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 3. Internal imports — types
import type { ErrorSession, TscDiagnostic, TscErrorGroup } from '@/types'
import { TSC_ERROR_PATTERNS } from '@/lib/constants'

// 4. Local types
interface AddErrorInput {
  errorType: 'TYPESCRIPT' | 'BUILD' | 'RUNTIME' | 'CONSOLE' | 'OTHER'
  errorOutput: string
  tscRawOutput?: string
}

interface UseErrorsReturn {
  sessions: ErrorSession[]
  pendingCount: number
  isLoading: boolean
  addSession: (data: AddErrorInput) => Promise<ErrorSession>
  addTscSession: (tscOutput: string) => Promise<ErrorSession>
  resolveSession: (errorId: string, note?: string) => Promise<void>
  updateIdentifiedFiles: (errorId: string, files: string[]) => Promise<void>
  parseTscOutput: (tscOutput: string) => TscErrorGroup[]
}

// ─── TSC output parser ────────────────────────────────────────────────────────

/**
 * Parse raw `npx tsc --noEmit` output into structured diagnostic groups.
 * Groups all diagnostics by file path so the UI can render per-file error counts.
 * Non-diagnostic lines (context, blank lines) are silently ignored.
 */
export function parseTscOutput(tscOutput: string): TscErrorGroup[] {
  const groupMap = new Map<string, TscDiagnostic[]>()

  for (const line of tscOutput.split('\n')) {
    const match = line.match(TSC_ERROR_PATTERNS.DIAGNOSTIC)
    if (!match) continue

    const [, filePath, lineStr, colStr, severity, code, message] = match
    if (!filePath || !lineStr || !colStr || !severity || !code || !message) continue

    const diagnostic: TscDiagnostic = {
      filePath: filePath.trim(),
      line: parseInt(lineStr, 10),
      column: parseInt(colStr, 10),
      severity: severity as TscDiagnostic['severity'],
      code: code.trim(),
      message: message.trim(),
    }

    const existing = groupMap.get(diagnostic.filePath) ?? []
    existing.push(diagnostic)
    groupMap.set(diagnostic.filePath, existing)
  }

  return Array.from(groupMap.entries()).map(([filePath, diagnostics]) => ({
    filePath,
    diagnostics,
    errorCount: diagnostics.filter((d) => d.severity === 'error').length,
    warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
  }))
}

/**
 * Format TscErrorGroup[] into a human-readable summary string for the
 * TSC identify prompt's {{ERROR_GROUPS}} variable.
 */
export function formatTscErrorGroups(groups: TscErrorGroup[]): string {
  if (groups.length === 0) return 'No structured errors detected.'

  return groups
    .sort((a, b) => b.errorCount - a.errorCount)
    .map((g) => {
      const codes = [...new Set(g.diagnostics.map((d) => d.code))].join(', ')
      const lines = g.diagnostics
        .filter((d) => d.severity === 'error')
        .map((d) => `  Line ${d.line}: ${d.code} — ${d.message}`)
        .join('\n')
      return `${g.filePath} — ${g.errorCount} error(s) [${codes}]\n${lines}`
    })
    .join('\n\n')
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchErrors(projectId: string): Promise<ErrorSession[]> {
  const res = await fetch(`/api/projects/${projectId}/errors`)
  if (!res.ok) throw new Error('Failed to fetch error sessions')
  const json = await res.json()
  return json.data ?? []
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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
    // Convenience wrapper: parse TSC output client-side, derive errorOutput
    // summary, then POST with tscRawOutput so the API can build the TSC prompt.
    addTscSession: (tscOutput: string) => {
      const groups = parseTscOutput(tscOutput)
      const totalErrors = groups.reduce((n, g) => n + g.errorCount, 0)
      const summary =
        totalErrors > 0
          ? `${totalErrors} TypeScript error(s) in ${groups.length} file(s):\n` +
            groups
              .slice(0, 5)
              .map((g) => `  ${g.filePath}: ${g.errorCount} error(s)`)
              .join('\n')
          : tscOutput.slice(0, 500)
      return addSessionMutation.mutateAsync({
        errorType: 'TYPESCRIPT',
        errorOutput: summary,
        tscRawOutput: tscOutput,
      })
    },
    resolveSession: (errorId, note) =>
      resolveSessionMutation.mutateAsync({ errorId, note }),
    updateIdentifiedFiles: (errorId, files) =>
      updateIdentifiedFilesMutation.mutateAsync({ errorId, files }),
    parseTscOutput,
  }
}

// ─── DevProbe bridge hook ─────────────────────────────────────────────────────
// Subscribes to the DevProbe→DevForge Pusher bridge channel and auto-creates
// error sessions whenever DevProbe sends APP_SEND_TO_DEVFORGE events.
// Uses the SAME error session system as manual errors — zero new UI needed.

interface DevProbeErrorPayload {
  type: 'error' | 'warning' | 'info'
  message: string
  filePath: string
  lineNumber?: number
  columnNumber?: number
  engine: string
  severity: string
  stackTrace?: string
  errorCode?: string
  source: 'devprobe'
  timestamp: string
}

interface UseDevProbeBridgeReturn {
  isDevProbeConnected: boolean
  pendingFromDevProbe: number
}

export function useDevProbeBridge(userId: string | undefined): UseDevProbeBridgeReturn {
  const [isDevProbeConnected, setIsDevProbeConnected] = useState(false)
  const [pendingFromDevProbe, setPendingFromDevProbe] = useState(0)
  const channelRef = useRef<any | null>(null)
  const pusherRef = useRef<any | null>(null)

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    if (!pusherKey || !pusherCluster) return

    // Initialize Pusher (client-only)
    const initPusher = async () => {
      try {
        const PusherModule = await import('pusher-js')
        const Pusher = PusherModule.default
        const pusher = new Pusher(pusherKey, { cluster: pusherCluster, forceTLS: true })
        pusherRef.current = pusher

      const channelName = `devprobe-devforge-${userId}`
      const channel = pusher.subscribe(channelName)
      channelRef.current = channel

      channel.bind('pusher:subscription_succeeded', () => {
        setIsDevProbeConnected(true)
      })

      channel.bind('pusher:subscription_error', () => {
        setIsDevProbeConnected(false)
      })

      // Listen for single error events from DevProbe
      channel.bind('APP_SEND_TO_DEVFORGE', (payload: DevProbeErrorPayload) => {
        if (!payload || payload.source !== 'devprobe') return
        setIsDevProbeConnected(true)

        const errorType = payload.engine === 'TYPESCRIPT' || payload.engine === 'BUILD'
          ? 'TYPESCRIPT'
          : payload.engine === 'RUNTIME' || payload.engine === 'CONSOLE'
          ? 'RUNTIME'
          : 'OTHER'

        const errorOutput = [
          `[DevProbe — ${payload.engine}] ${payload.severity}`,
          payload.errorCode ? `Code: ${payload.errorCode}` : null,
          `Message: ${payload.message}`,
          payload.filePath ? `File: ${payload.filePath}${payload.lineNumber ? `:${payload.lineNumber}` : ''}` : null,
          payload.stackTrace ? `\nStack:\n${payload.stackTrace}` : null,
        ].filter(Boolean).join('\n')

        // Auto-create error session via the existing API — no projectId needed
        // at this layer; the bridge fires globally and the active project picks it up
        fetch('/api/devprobe/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorType, errorOutput, source: 'devprobe', engine: payload.engine }),
        })
          .then(() => setPendingFromDevProbe((n) => n + 1))
          .catch(() => { /* fire-and-forget */ })
      })

      // Listen for error group events
      channel.bind('APP_SEND_TO_DEVFORGE_GROUP', (payload: {
        type: string
        rootCauseTitle: string
        rootCauseExplanation: string
        affectedErrors: DevProbeErrorPayload[]
        source: 'devprobe'
      }) => {
        if (!payload || payload.source !== 'devprobe') return
        setIsDevProbeConnected(true)

        const errorOutput = [
          `[DevProbe — Root Cause Group] ${payload.rootCauseTitle}`,
          `Explanation: ${payload.rootCauseExplanation}`,
          `Affected errors (${payload.affectedErrors.length}):`,
          ...payload.affectedErrors.map((e) =>
            `  • [${e.engine}] ${e.message}${e.filePath ? ` — ${e.filePath}` : ''}`
          ),
        ].join('\n')

        fetch('/api/devprobe/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorType: 'OTHER', errorOutput, source: 'devprobe', engine: 'GROUP' }),
        })
          .then(() => setPendingFromDevProbe((n) => n + 1))
          .catch(() => { /* fire-and-forget */ })
      })

        // Ping back to DevProbe so it detects DevForge as connected
        const pingInterval = setInterval(() => {
          fetch('/api/devprobe/ping', { method: 'POST' }).catch(() => { /* ignore */ })
        }, 30_000)

        return () => {
          clearInterval(pingInterval)
          if (channelRef.current) {
            channelRef.current.unbind_all()
          }
          if (pusherRef.current) {
            pusherRef.current.unsubscribe(channelName)
            pusherRef.current.disconnect()
          }
        }
      } catch (error) {
        console.error('Failed to initialize Pusher:', error)
        setIsDevProbeConnected(false)
        return () => {
          if (channelRef.current) channelRef.current.unbind_all()
          if (pusherRef.current) pusherRef.current.disconnect()
        }
      }
    }

    const cleanup = initPusher()
    return () => {
      cleanup.then((fn) => fn && fn()).catch(() => {})
    }
  }, [userId])

  return { isDevProbeConnected, pendingFromDevProbe }
}