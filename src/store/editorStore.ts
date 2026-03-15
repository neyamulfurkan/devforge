// src/store/editorStore.ts

// 1. Third-party imports
import { create } from 'zustand'

// 2. Internal imports
import type { CursorPosition } from '@/types'

// 3. Local types

/** Represents a node in the local filesystem tree */
export interface LocalFileNode {
  type: 'file' | 'folder'
  name: string
  /** Relative path from the root folder, e.g. "src/components/Button.tsx" */
  path: string
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
  children?: LocalFileNode[]
}

interface EditorStore {
  // ── DB-mode state ──────────────────────────────────────────────────────
  openFileId: string | null
  fileContent: string
  isDirty: boolean
  isReadOnly: boolean
  cursorPosition: CursorPosition | null

  // ── Local-mode state (keyed by projectId) ─────────────────────────────
  localModeByProject: Record<string, {
    isLocalMode: boolean
    localFolderHandle: FileSystemDirectoryHandle | null
    localFileTree: LocalFileNode[]
    openLocalPath: string | null
    openLocalHandle: FileSystemFileHandle | null
  }>

  // ── DB-mode actions ────────────────────────────────────────────────────
  openFile: (fileId: string) => void
  setContent: (content: string) => void
  markDirty: () => void
  markClean: () => void
  toggleReadOnly: () => void
  setCursorPosition: (pos: CursorPosition) => void
  closeFile: () => void

  // ── Local-mode actions ─────────────────────────────────────────────────
  setLocalFolderHandle: (projectId: string, handle: FileSystemDirectoryHandle) => void
  setLocalFileTree: (projectId: string, tree: LocalFileNode[]) => void
  openLocalFile: (projectId: string, handle: FileSystemFileHandle, path: string) => void
  switchToLocalMode: (projectId: string) => void
  switchToDBMode: (projectId: string) => void
  getLocalState: (projectId: string) => {
    isLocalMode: boolean
    localFolderHandle: FileSystemDirectoryHandle | null
    localFileTree: LocalFileNode[]
    openLocalPath: string | null
    openLocalHandle: FileSystemFileHandle | null
  }
}

/** Standalone helper — reads per-project local state without circular self-reference */
export function getProjectLocalState(projectId: string): {
  isLocalMode: boolean
  localFolderHandle: FileSystemDirectoryHandle | null
  localFileTree: LocalFileNode[]
  openLocalPath: string | null
  openLocalHandle: FileSystemFileHandle | null
} {
  const store = useEditorStore.getState()
  return store.localModeByProject[projectId] ?? {
    isLocalMode: false,
    localFolderHandle: null,
    localFileTree: [],
    openLocalPath: null,
    openLocalHandle: null,
  }
}

export const useEditorStore = create<EditorStore>((set) => ({
  // ── DB-mode initial state ──────────────────────────────────────────────
  openFileId: null,
  fileContent: '',
  isDirty: false,
  isReadOnly: false,
  cursorPosition: null,

  // ── Local-mode initial state ───────────────────────────────────────────
  localModeByProject: {},

  // ── DB-mode actions ────────────────────────────────────────────────────
  openFile: (fileId: string) =>
    set({
      openFileId: fileId,
      fileContent: '',
      isDirty: false,
      isReadOnly: false,
      cursorPosition: null,
    }),

  setContent: (content: string) =>
    set({ fileContent: content }),

  markDirty: () => set({ isDirty: true }),

  markClean: () => set({ isDirty: false }),

  toggleReadOnly: () => set((state) => ({ isReadOnly: !state.isReadOnly })),

  setCursorPosition: (pos: CursorPosition) =>
    set({ cursorPosition: pos }),

  closeFile: () =>
    set({
      openFileId: null,
      fileContent: '',
      isDirty: false,
      isReadOnly: false,
      cursorPosition: null,
    }),

  // ── Local-mode actions ─────────────────────────────────────────────────
  getLocalState: (projectId: string) => {
    return getProjectLocalState(projectId)
  },

  setLocalFolderHandle: (projectId: string, handle: FileSystemDirectoryHandle) =>
    set((state) => ({
      localModeByProject: {
        ...state.localModeByProject,
        [projectId]: {
          ...(state.localModeByProject[projectId] ?? {
            isLocalMode: false,
            localFileTree: [],
            openLocalPath: null,
            openLocalHandle: null,
          }),
          localFolderHandle: handle,
        },
      },
    })),

  setLocalFileTree: (projectId: string, tree: LocalFileNode[]) =>
    set((state) => ({
      localModeByProject: {
        ...state.localModeByProject,
        [projectId]: {
          ...(state.localModeByProject[projectId] ?? {
            isLocalMode: false,
            localFolderHandle: null,
            openLocalPath: null,
            openLocalHandle: null,
          }),
          localFileTree: tree,
        },
      },
    })),

  openLocalFile: (projectId: string, handle: FileSystemFileHandle, path: string) =>
    set((state) => ({
      localModeByProject: {
        ...state.localModeByProject,
        [projectId]: {
          ...(state.localModeByProject[projectId] ?? {
            isLocalMode: true,
            localFolderHandle: null,
            localFileTree: [],
          }),
          openLocalHandle: handle,
          openLocalPath: path,
        },
      },
      fileContent: '',
      isDirty: false,
      isReadOnly: false,
      cursorPosition: null,
    })),

  switchToLocalMode: (projectId: string) =>
    set((state) => ({
      localModeByProject: {
        ...state.localModeByProject,
        [projectId]: {
          ...(state.localModeByProject[projectId] ?? {
            localFolderHandle: null,
            localFileTree: [],
            openLocalPath: null,
            openLocalHandle: null,
          }),
          isLocalMode: true,
        },
      },
      openFileId: null,
      fileContent: '',
      isDirty: false,
    })),

  switchToDBMode: (projectId: string) =>
    set((state) => {
      const next = { ...state.localModeByProject }
      delete next[projectId]
      return {
        localModeByProject: next,
        fileContent: '',
        isDirty: false,
      }
    }),
}))