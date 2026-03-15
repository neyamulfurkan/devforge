// src/hooks/useEditor.ts

// 1. React imports
import { useEffect, useCallback, useRef } from 'react'

// 2. Internal imports — stores and hooks
import { useEditorStore } from '@/store/editorStore'
import { useFiles } from '@/hooks/useFiles'

// 3. Internal imports — types
import type { FileWithContent } from '@/types'
import type { LocalFileNode } from '@/store/editorStore'

// ─── IndexedDB helpers — persist FileSystemDirectoryHandle per project ────────
// FileSystemDirectoryHandle is a live browser object — it cannot be stored in
// localStorage or Zustand. IndexedDB is the only web storage that accepts it.

const IDB_NAME = 'devforge-local-folders'
const IDB_STORE = 'handles'
const IDB_VERSION = 1

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveHandleForProject(
  projectId: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(handle, projectId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadHandleForProject(
  projectId: string
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(projectId)
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function clearHandleForProject(projectId: string): Promise<void> {
  const db = await openIDB()
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(projectId)
    tx.oncomplete = () => resolve()
  })
}

// ─── Local helper — walk a FileSystemDirectoryHandle recursively ─────────────
async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  prefix = ''
): Promise<LocalFileNode[]> {
  const nodes: LocalFileNode[] = []

  for await (const [name, handle] of dirHandle as unknown as AsyncIterable <
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >) {
    // Skip hidden files/folders (e.g. .git, .next, node_modules)
    if (name.startsWith('.') || name === 'node_modules') continue

    const path = prefix ? `${prefix}/${name}` : name

    if (handle.kind === 'directory') {
      const children = await walkDirectory(
        handle as FileSystemDirectoryHandle,
        path
      )
      nodes.push({
        type: 'folder',
        name,
        path,
        handle,
        children,
      })
    } else {
      nodes.push({
        type: 'file',
        name,
        path,
        handle,
      })
    }
  }

  // Sort: folders first, then files, both alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useEditor(projectId: string) {
  const {
    openFileId,
    fileContent,
    isDirty,
    isReadOnly,
    isLocalMode,
    openLocalHandle,
    openLocalPath,
    openFile: storeOpenFile,
    openLocalFile: storeOpenLocalFile,
    setContent,
    markDirty,
    markClean,
    toggleReadOnly,
    closeFile,
    setLocalFolderHandle,
    setLocalFileTree,
    switchToLocalMode,
    switchToDBMode,
  } = useEditorStore()

  const { files, updateFileStatus } = useFiles(projectId)

  const currentFile: FileWithContent | null =
    files.find((f) => f.id === openFileId) ?? null

  // Track save in progress to prevent concurrent saves
  const isSavingRef = useRef(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── DB-mode: open file ────────────────────────────────────────────────────

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

  // ── DB-mode: save file ────────────────────────────────────────────────────

  const saveCurrentFile = useCallback(async () => {
    if (isLocalMode) {
      // Local save is handled by saveLocalFile below
      return
    }
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
  }, [isLocalMode, openFileId, projectId, fileContent, markClean])

  // ── DB-mode: mark complete ────────────────────────────────────────────────

  const markComplete = useCallback(async () => {
    if (!openFileId) return
    await updateFileStatus(openFileId, 'COMPLETE')
  }, [openFileId, updateFileStatus])

  // ── Local-mode: open folder picker ───────────────────────────────────────

  const openLocalFolder = useCallback(async () => {
    // showDirectoryPicker is Chrome/Edge only — guard gracefully
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      console.warn('File System Access API not supported in this browser.')
      return
    }

    try {
      const dirHandle = await (
        window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker()

      // Persist handle to IndexedDB so it survives page reloads
      await saveHandleForProject(projectId, dirHandle)

      setLocalFolderHandle(dirHandle)
      switchToLocalMode()

      const tree = await walkDirectory(dirHandle)
      setLocalFileTree(tree)
    } catch (err) {
      // User cancelled the picker — not an error
      if ((err as DOMException).name !== 'AbortError') {
        console.error('openLocalFolder error:', err)
      }
    }
  }, [projectId, setLocalFolderHandle, setLocalFileTree, switchToLocalMode])

  // ── Local-mode: restore saved folder on mount ─────────────────────────────
  // Runs once when the editor tab mounts for this projectId.
  // Silently restores the previously chosen folder — if the browser still has
  // permission, the tree loads with no user interaction at all.
  // If permission was revoked, queryPermission returns 'prompt' and we call
  // requestPermission() which shows a one-click browser prompt (no picker).

  const restoreLocalFolder = useCallback(async () => {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) return

    const savedHandle = await loadHandleForProject(projectId)
    if (!savedHandle) return

    try {
      // Check current permission state
      const permission = await (
        savedHandle as FileSystemDirectoryHandle & {
          queryPermission: (desc: { mode: string }) => Promise<PermissionState>
          requestPermission: (desc: { mode: string }) => Promise<PermissionState>
        }
      ).queryPermission({ mode: 'readwrite' })

      let finalPermission = permission

      if (permission === 'prompt') {
        // Ask for permission with a simple browser prompt — no folder picker
        finalPermission = await (
          savedHandle as FileSystemDirectoryHandle & {
            requestPermission: (desc: { mode: string }) => Promise<PermissionState>
          }
        ).requestPermission({ mode: 'readwrite' })
      }

      if (finalPermission !== 'granted') {
        // Permission denied — clear the stale handle
        await clearHandleForProject(projectId)
        return
      }

      // Permission granted — restore the tree silently
      setLocalFolderHandle(savedHandle)
      switchToLocalMode()
      const tree = await walkDirectory(savedHandle)
      setLocalFileTree(tree)
    } catch {
      // Handle may be stale (folder deleted/moved) — clear it
      await clearHandleForProject(projectId)
    }
  }, [projectId, setLocalFolderHandle, setLocalFileTree, switchToLocalMode])

  // ── Local-mode: open a specific file from the tree ───────────────────────

  const openLocalFile = useCallback(
    async (handle: FileSystemFileHandle, path: string) => {
      storeOpenLocalFile(handle, path)

      try {
        const file = await handle.getFile()
        const text = await file.text()
        setContent(text)
        markClean()
      } catch {
        setContent('')
        markClean()
      }
    },
    [storeOpenLocalFile, setContent, markClean]
  )

  // ── Local-mode: save current file to disk ────────────────────────────────

  const saveLocalFile = useCallback(async () => {
    if (!openLocalHandle || isSavingRef.current) return

    isSavingRef.current = true
    try {
      const writable = await openLocalHandle.createWritable()
      await writable.write(fileContent)
      await writable.close()
      markClean()
    } finally {
      isSavingRef.current = false
    }
  }, [openLocalHandle, fileContent, markClean])

  // ── Unified save (respects current mode) ─────────────────────────────────

  const save = useCallback(async () => {
    if (isLocalMode) {
      await saveLocalFile()
    } else {
      await saveCurrentFile()
    }
  }, [isLocalMode, saveLocalFile, saveCurrentFile])

  // ── Expose setContent wrapped to also mark dirty ──────────────────────────

  const handleContentChange = useCallback(
    (content: string) => {
      setContent(content)
      markDirty()
    },
    [setContent, markDirty]
  )

  // ── Restore saved folder on mount ────────────────────────────────────────
  // Only runs once per projectId. If already in local mode (store already has
  // a handle from this session), skip to avoid redundant re-walks.

  useEffect(() => {
    if (!isLocalMode) {
      restoreLocalFolder()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]) // projectId change = different project = re-check its saved folder

  // ── Auto-save on dirty ────────────────────────────────────────────────────

  useEffect(() => {
    const hasOpenTarget = isLocalMode ? !!openLocalHandle : !!openFileId
    if (!isDirty || !hasOpenTarget) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      save()
    }, 500)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [isDirty, isLocalMode, openLocalHandle, openFileId, fileContent, save])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  return {
    // State
    openFileId,
    fileContent,
    isDirty,
    isReadOnly,
    isLocalMode,
    openLocalPath,
    currentFile,

    // DB-mode actions
    openFile,
    saveCurrentFile,
    saveFile: markComplete,       // alias expected by workspace page
    markComplete,

    // Local-mode actions
    openLocalFolder,
    openLocalFile,
    saveLocalFile,

    // Unified
    save,
    toggleReadOnly,
    closeFile,
    switchToDBMode: async () => {
      await clearHandleForProject(projectId)
      switchToDBMode()
    },
    onContentChange: handleContentChange,
  }
}