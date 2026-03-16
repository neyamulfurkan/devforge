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
  sidebarCollapsed: boolean
  sidebarWidth: number
  activeModal: string | null
  toasts: Toast[]
  mobileNavVisible: boolean
  quickPanelVisible: boolean
}

interface UIActions {
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
  setSidebarWidth: (width: number) => void
  openModal: (id: string) => void
  closeModal: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  toggleQuickPanel: () => void
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  sidebarOpen: true,
  sidebarCollapsed: false,
  sidebarWidth: 240,
  activeModal: null,
  toasts: [],
  mobileNavVisible: true,
  quickPanelVisible: false,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open: boolean) =>
    set({ sidebarOpen: open }),

  toggleSidebarCollapsed: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
      sidebarWidth: !state.sidebarCollapsed ? 56 : 240,
    })),

  setSidebarWidth: (width: number) =>
    set({ sidebarWidth: width }),

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