// src/store/projectStore.ts

// 1. Third-party imports
import { create } from 'zustand'

// 2. Internal imports
import type { Project, WorkspaceTab, FileStatus } from '@/types'

// 3. Store state and actions interface
interface ProjectStoreState {
  currentProjectId: string | null
  currentProjectData: Project | null
  currentTab: WorkspaceTab

  setCurrentProject: (id: string, data: Project) => void
  setCurrentTab: (tab: WorkspaceTab) => void
  clearCurrentProject: () => void
  updateFileStatus: (fileId: string, status: FileStatus) => void
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  // Initial state
  currentProjectId: null,
  currentProjectData: null,
  currentTab: 'overview',

  // Actions
  setCurrentProject: (id, data) =>
    set({
      currentProjectId: id,
      currentProjectData: data,
    }),

  setCurrentTab: (tab) => set({ currentTab: tab }),

  clearCurrentProject: () =>
    set({
      currentProjectId: null,
      currentProjectData: null,
      currentTab: 'overview',
    }),

  updateFileStatus: (fileId, status) =>
    set((state) => {
      if (!state.currentProjectData) return state

      // Optimistically update completedFiles count
      const files = (state.currentProjectData as Project & { files?: Array<{ id: string; status: FileStatus }> }).files
      if (!files) return state

      const prevFile = files.find((f) => f.id === fileId)
      const wasComplete = prevFile?.status === 'COMPLETE'
      const isNowComplete = status === 'COMPLETE'

      let completedFilesDelta = 0
      if (!wasComplete && isNowComplete) completedFilesDelta = 1
      if (wasComplete && !isNowComplete) completedFilesDelta = -1

      return {
        currentProjectData: {
          ...state.currentProjectData,
          completedFiles: Math.max(
            0,
            state.currentProjectData.completedFiles + completedFilesDelta
          ),
          files: files.map((f) =>
            f.id === fileId ? { ...f, status } : f
          ),
        },
      }
    }),
}))