// src/hooks/useEditor.ts

// 1. React imports
import { useEffect, useCallback, useRef } from 'react'

// 2. Internal imports — stores and hooks
import { useEditorStore, getProjectLocalState } from '@/store/editorStore'
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
    openFile: storeOpenFile,
    setContent,
    markDirty,
    markClean,
    toggleReadOnly,
    closeFile,
    setLocalFolderHandle,
    setLocalFileTree,
    openLocalFile: storeOpenLocalFile,
    switchToLocalMode,
    switchToDBMode,
    getLocalState,
  } = useEditorStore()

  const {
    isLocalMode,
    localFolderHandle: _localFolderHandle,
    localFileTree: _localFileTree,
    openLocalPath,
    openLocalHandle,
  } = getLocalState(projectId)

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

  const openLocalFolder = useCallback(async (): Promise<{
    success: boolean
    reason?: 'cancelled' | 'mismatch' | 'error'
    matchPct?: number
    matched?: number
    total?: number
  }> => {
    // showDirectoryPicker is Chrome/Edge only — guard gracefully
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      console.warn('File System Access API not supported in this browser.')
      return { success: false, reason: 'error' }
    }

    try {
      const dirHandle = await (
        window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker()

      // ── Walk the folder to get all file paths ──────────────────────────────
      const tree = await walkDirectory(dirHandle)

      // ── Flatten tree to a set of all file paths in the folder ──────────────
      function flattenPaths(nodes: LocalFileNode[]): Set<string> {
        const paths = new Set<string>()
        for (const node of nodes) {
          if (node.type === 'file') {
            // Normalise: store both the full path and just the filename
            paths.add(node.path.replace(/^\/+/, ''))
            paths.add(node.name)
          }
          if (node.type === 'folder' && node.children) {
            for (const p of flattenPaths(node.children)) {
              paths.add(p)
            }
          }
        }
        return paths
      }

      const localPaths = flattenPaths(tree)

      // ── Validate against project files if we have them ────────────────────
      // Only validate when project has files loaded. Skip validation if no
      // project files exist yet (new project, files not generated yet).
      if (files.length > 0) {
        let matchCount = 0

        for (const projectFile of files) {
          const projNorm = projectFile.filePath.replace(/^\/+/, '')
          const projFilename = projNorm.split('/').pop() ?? ''

          const isMatch =
            // Exact path match
            localPaths.has(projNorm) ||
            // Filename match (catches root prefix differences)
            (projFilename.length > 3 && localPaths.has(projFilename)) ||
            // Suffix match — local tree has "university-club/src/lib/utils.ts"
            // project has "src/lib/utils.ts"
            [...localPaths].some(
              (lp) =>
                lp === projNorm ||
                lp.endsWith('/' + projNorm) ||
                projNorm.endsWith('/' + lp)
            )

          if (isMatch) matchCount++
        }

        const matchPct = Math.round((matchCount / files.length) * 100)
        const MATCH_THRESHOLD = 60

        if (matchPct < MATCH_THRESHOLD) {
          // Folder doesn't match this project — reject it
          return {
            success: false,
            reason: 'mismatch',
            matchPct,
            matched: matchCount,
            total: files.length,
          }
        }
      }

      // ── Validation passed — link the folder ───────────────────────────────
      await saveHandleForProject(projectId, dirHandle)
      setLocalFolderHandle(projectId, dirHandle)
      switchToLocalMode(projectId)
      setLocalFileTree(projectId, tree)

      return { success: true, matchPct: 100 }
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') {
        return { success: false, reason: 'cancelled' }
      }
      console.error('openLocalFolder error:', err)
      return { success: false, reason: 'error' }
    }
  }, [projectId, files, setLocalFolderHandle, setLocalFileTree, switchToLocalMode])

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
      setLocalFolderHandle(projectId, savedHandle)
      switchToLocalMode(projectId)
      const tree = await walkDirectory(savedHandle)
      setLocalFileTree(projectId, tree)
    } catch {
      // Handle may be stale (folder deleted/moved) — clear it
      await clearHandleForProject(projectId)
    }
  }, [projectId, setLocalFolderHandle, setLocalFileTree, switchToLocalMode])

  // ── Local-mode: open a specific file from the tree ───────────────────────

  const openLocalFile = useCallback(
    async (handle: FileSystemFileHandle, path: string) => {
      storeOpenLocalFile(projectId, handle, path)

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
    // Always attempt restore when projectId changes — each project has independent state
    restoreLocalFolder()
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

  // ── Create project folder on disk ────────────────────────────────────────
  // Asks user to pick a location, then automatically creates every file and
  // folder from the project's file tree inside a new named subfolder.
  // Files that have code in Cloudinary get their content written immediately.
  // Empty files are created as blank files ready to fill.
  // The created folder is auto-linked to this project in IndexedDB.

  const createProjectFolder = useCallback(
    async (
      onProgress?: (current: number, total: number, currentPath: string) => void
    ): Promise<{ success: boolean; folderName: string | null }> => {
      if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
        console.warn('File System Access API not supported in this browser.')
        return { success: false, folderName: null }
      }

      try {
        // Step 1 — let user pick WHERE to create the project folder
        const parentHandle = await (
          window as Window & {
            showDirectoryPicker: (opts?: {
              mode?: string
            }) => Promise<FileSystemDirectoryHandle>
          }
        ).showDirectoryPicker({ mode: 'readwrite' })

        // Step 2 — derive a safe folder name from the project files
        // Use the first file's root segment as the project folder name,
        // falling back to projectId if files aren't loaded yet
        const rootName =
          files.length > 0
            ? (files[0]?.filePath.split('/')[0] ?? `project-${projectId.slice(0, 8)}`)
            : `project-${projectId.slice(0, 8)}`

        // Step 3 — create the root project folder inside the chosen location
        const projectDirHandle = await parentHandle.getDirectoryHandle(rootName, {
          create: true,
        })

        // Step 4 — helper: get or create nested directory from a path like
        // "src/components/workspace" → creates src/, src/components/, src/components/workspace/
        async function getOrCreateDir(
          root: FileSystemDirectoryHandle,
          relativePath: string
        ): Promise<FileSystemDirectoryHandle> {
          const parts = relativePath.split('/').filter(Boolean)
          let current = root
          for (const part of parts) {
            current = await current.getDirectoryHandle(part, { create: true })
          }
          return current
        }

        // Step 5 — collect all unique directory paths from file list
        const dirPaths = new Set<string>()
        for (const f of files) {
          const segments = f.filePath.split('/')
          // Build every ancestor path e.g. src, src/app, src/app/components
          for (let i = 1; i < segments.length; i++) {
            dirPaths.add(segments.slice(0, i).join('/'))
          }
        }

        // Step 6 — create all directories first
        for (const dirPath of dirPaths) {
          await getOrCreateDir(projectDirHandle, dirPath)
        }

        // Step 7 — create all files, writing cloud content where available
        const total = files.length
        let current = 0

        for (const f of files) {
          current++
          onProgress?.(current, total, f.filePath)

          // Split path into directory part and filename
          const segments = f.filePath.split('/')
          const fileName = segments[segments.length - 1] ?? f.fileName
          const dirPath = segments.slice(0, -1).join('/')

          // Get the parent directory handle
          const dirHandle =
            dirPath
              ? await getOrCreateDir(projectDirHandle, dirPath)
              : projectDirHandle

          // Create the file
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })

          // Try to fetch existing code from Cloudinary / DB
          let content = ''
          try {
            const res = await fetch(
              `/api/projects/${projectId}/files/${f.id}/code`
            )
            if (res.ok) {
              const json = await res.json()
              content = json.data?.codeContent ?? ''
            }
          } catch {
            // No content available — file stays empty, that's fine
          }

          // Write content (empty string creates a valid empty file)
          const writable = await fileHandle.createWritable()
          await writable.write(content)
          await writable.close()
        }

        // Step 8 — auto-link folder to this project exactly like openLocalFolder
        await saveHandleForProject(projectId, projectDirHandle)
        setLocalFolderHandle(projectId, projectDirHandle)
        switchToLocalMode(projectId)

        // Step 9 — walk the created folder to build the file tree
        const tree = await walkDirectory(projectDirHandle)
        setLocalFileTree(projectId, tree)

        return { success: true, folderName: rootName }
      } catch (err) {
        // User cancelled the picker — not an error
        if ((err as DOMException).name === 'AbortError') {
          return { success: false, folderName: null }
        }
        console.error('createProjectFolder error:', err)
        return { success: false, folderName: null }
      }
    },
    [projectId, files, setLocalFolderHandle, setLocalFileTree, switchToLocalMode]
  )

  // ── Cloudinary: push local file to cloud ─────────────────────────────────
  // Reads the local file from disk and uploads it to Cloudinary so mobile
  // can access it. Works in both local mode (reads from disk handle) and
  // DB mode (reads from fileContent store).

  const pushToCloudinary = useCallback(
    async (fileId: string): Promise<void> => {
      // Get content: in local mode read from disk; in DB mode use store content
      let content = fileContent

      if (isLocalMode && openLocalHandle) {
        try {
          const f = await openLocalHandle.getFile()
          content = await f.text()
        } catch {
          // Fall back to store content
        }
      }

      if (!content) return

      await fetch(`/api/projects/${projectId}/files/${fileId}/code`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
    },
    [projectId, fileContent, isLocalMode, openLocalHandle]
  )

  // ── Cloudinary: pull cloud file to local disk ─────────────────────────────
  // Fetches code from Cloudinary and writes it directly to the local disk
  // file via FileSystemFileHandle.createWritable(). After successful write,
  // deletes the cloud copy to free Cloudinary storage.

  const pullFromCloudinary = useCallback(
    async (fileId: string): Promise<string | null> => {
      try {
        // Fetch the code content from Cloudinary via our API
        const res = await fetch(`/api/projects/${projectId}/files/${fileId}/code`)
        if (!res.ok) return null
        const json = await res.json()
        const code: string = json.data?.codeContent ?? ''
        if (!code) return null

        if (isLocalMode) {
          // In local mode — find the file handle and write to disk
          const { localFileTree } = getProjectLocalState(projectId)

          const findHandle = (
            nodes: LocalFileNode[],
            targetId: string
          ): FileSystemFileHandle | null => {
            for (const node of nodes) {
              if (node.type === 'file' && node.path === targetId) {
                return node.handle as FileSystemFileHandle
              }
              if (node.type === 'folder' && node.children) {
                const found = findHandle(node.children, targetId)
                if (found) return found
              }
            }
            return null
          }

          // Try matching by fileId first, then by filePath from files list
          const targetFile = files.find((f) => f.id === fileId)
          const handle = targetFile
            ? findHandle(localFileTree, targetFile.filePath)
            : null

          if (handle) {
            const writable = await handle.createWritable()
            await writable.write(code)
            await writable.close()
          }
        }

        // Delete from Cloudinary after successful pull to free storage
        await fetch(`/api/projects/${projectId}/files/${fileId}/code`, {
          method: 'DELETE',
        })

        return code
      } catch {
        return null
      }
    },
    [projectId, isLocalMode, files]
  )

  // ── Cloudinary: check if cloud version exists ─────────────────────────────
  // Lightweight HEAD check — no content download. Used by sync badges.

  const checkCloudSync = useCallback(
    async (fileId: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/files/${fileId}/code`,
          { method: 'HEAD' }
        )
        return res.ok
      } catch {
        return false
      }
    },
    [projectId]
  )

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
    createProjectFolder,

    // Cloudinary sync actions
    pushToCloudinary,
    pullFromCloudinary,
    checkCloudSync,

    // Unified
    save,
    toggleReadOnly,
    closeFile,
    switchToDBMode: async () => {
      await clearHandleForProject(projectId)
      switchToDBMode(projectId)
    },
    onContentChange: handleContentChange,
  }
}