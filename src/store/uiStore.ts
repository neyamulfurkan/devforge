// src/store/uiStore.ts
import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
}

interface UIState {
  sidebarOpen: boolean
  activeModal: string | null
  toasts: Toast[]
  mobileNavVisible: boolean
  quickPanelVisible: boolean
}

interface UIActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openModal: (id: string) => void
  closeModal: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  toggleQuickPanel: () => void
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  toasts: [],
  mobileNavVisible: true,
  quickPanelVisible: false,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open: boolean) =>
    set({ sidebarOpen: open }),

  openModal: (id: string) =>
    set({ activeModal: id }),

  closeModal: () =>
    set({ activeModal: null }),

  addToast: (toast: Omit<Toast, 'id'>) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: crypto.randomUUID() },
      ],
    })),

  removeToast: (id: string) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  toggleQuickPanel: () =>
    set((state) => ({ quickPanelVisible: !state.quickPanelVisible })),
}))