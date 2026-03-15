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

  // ── Local-mode state ───────────────────────────────────────────────────
  isLocalMode: boolean
  localFolderHandle: FileSystemDirectoryHandle | null
  localFileTree: LocalFileNode[]
  /** Path of the currently open local file, e.g. "src/app/page.tsx" */
  openLocalPath: string | null
  /** The FileSystemFileHandle for the currently open local file */
  openLocalHandle: FileSystemFileHandle | null

  // ── DB-mode actions ────────────────────────────────────────────────────
  openFile: (fileId: string) => void
  setContent: (content: string) => void
  markDirty: () => void
  markClean: () => void
  toggleReadOnly: () => void
  setCursorPosition: (pos: CursorPosition) => void
  closeFile: () => void

  // ── Local-mode actions ─────────────────────────────────────────────────
  setLocalFolderHandle: (handle: FileSystemDirectoryHandle) => void
  setLocalFileTree: (tree: LocalFileNode[]) => void
  openLocalFile: (handle: FileSystemFileHandle, path: string) => void
  switchToLocalMode: () => void
  switchToDBMode: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  // ── DB-mode initial state ──────────────────────────────────────────────
  openFileId: null,
  fileContent: '',
  isDirty: false,
  isReadOnly: false,
  cursorPosition: null,

  // ── Local-mode initial state ───────────────────────────────────────────
  isLocalMode: false,
  localFolderHandle: null,
  localFileTree: [],
  openLocalPath: null,
  openLocalHandle: null,

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
  setLocalFolderHandle: (handle: FileSystemDirectoryHandle) =>
    set({ localFolderHandle: handle }),

  setLocalFileTree: (tree: LocalFileNode[]) =>
    set({ localFileTree: tree }),

  openLocalFile: (handle: FileSystemFileHandle, path: string) =>
    set({
      openLocalHandle: handle,
      openLocalPath: path,
      fileContent: '',
      isDirty: false,
      isReadOnly: false,
      cursorPosition: null,
    }),

  switchToLocalMode: () =>
    set({
      isLocalMode: true,
      // Reset DB state so nothing bleeds across
      openFileId: null,
      fileContent: '',
      isDirty: false,
    }),

  switchToDBMode: () =>
    set({
      isLocalMode: false,
      localFolderHandle: null,
      localFileTree: [],
      openLocalPath: null,
      openLocalHandle: null,
      fileContent: '',
      isDirty: false,
    }),
}))