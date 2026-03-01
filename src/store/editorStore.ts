// src/store/editorStore.ts

// 1. Third-party imports
import { create } from 'zustand'

// 2. Internal imports
import type { CursorPosition } from '@/types'

// 3. Local types
interface EditorStore {
  // State
  openFileId: string | null
  fileContent: string
  isDirty: boolean
  isReadOnly: boolean
  cursorPosition: CursorPosition | null

  // Actions
  openFile: (fileId: string) => void
  setContent: (content: string) => void
  markDirty: () => void
  markClean: () => void
  toggleReadOnly: () => void
  setCursorPosition: (pos: CursorPosition) => void
  closeFile: () => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  // Initial state
  openFileId: null,
  fileContent: '',
  isDirty: false,
  isReadOnly: false,
  cursorPosition: null,

  // Actions
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
}))