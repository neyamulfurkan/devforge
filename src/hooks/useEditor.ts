// src/hooks/useEditor.ts

// 1. React imports
import { useEffect, useCallback, useRef } from 'react'

// 2. Internal imports — stores and hooks
import { useEditorStore } from '@/store/editorStore'
import { useFiles } from '@/hooks/useFiles'

// 3. Internal imports — types
import type { FileWithContent } from '@/types'

export function useEditor(projectId: string) {
  const {
    openFileId,
    fileContent,
    isDirty,
    isReadOnly,
    openFile: storeOpenFile,
    setContent,
    markDirty,
    markClean,
    toggleReadOnly,
    closeFile,
  } = useEditorStore()

  const { files, updateFileStatus } = useFiles(projectId)

  const currentFile: FileWithContent | null =
    files.find((f) => f.id === openFileId) ?? null

  // Track save in progress to prevent concurrent saves
  const isSavingRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Core actions ─────────────────────────────────────────────────────────

  const openFile = useCallback(
    async (fileId: string) => {
      storeOpenFile(fileId)

      try {
        const res = await fetch(
          `/api/projects/${projectId}/files/${fileId}/code`
        )
        if (!res.ok) throw new Error('Failed to fetch file code')
        const json = await res.json()
        const fetched: FileWithContent = json.data
        setContent(fetched.codeContent ?? '')
        markClean()
      } catch {
        setContent('')
        markClean()
      }
    },
    [projectId, storeOpenFile, setContent, markClean]
  )

  const saveCurrentFile = useCallback(async () => {
    if (!openFileId || isSavingRef.current) return

    isSavingRef.current = true
    try {
      const res = await fetch(
        `/api/projects/${projectId}/files/${openFileId}/code`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codeContent: fileContent }),
        }
      )
      if (!res.ok) throw new Error('Failed to save file')
      markClean()
    } finally {
      isSavingRef.current = false
    }
  }, [openFileId, projectId, fileContent, markClean])

  const markComplete = useCallback(async () => {
    if (!openFileId) return
    await updateFileStatus(openFileId, 'COMPLETE')
  }, [openFileId, updateFileStatus])

  // Expose setContent wrapped to also mark dirty
  const handleContentChange = useCallback(
    (content: string) => {
      setContent(content)
      markDirty()
    },
    [setContent, markDirty]
  )

  // ── Auto-save on dirty ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isDirty || !openFileId) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveCurrentFile()
    }, 500)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [isDirty, openFileId, fileContent, saveCurrentFile])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  return {
    openFileId,
    fileContent,
    isDirty,
    isReadOnly,
    currentFile,
    openFile,
    saveCurrentFile,
    saveFile: markComplete,   // alias expected by workspace page
    markComplete,
    toggleReadOnly,
    closeFile,
    onContentChange: handleContentChange,
  }
}