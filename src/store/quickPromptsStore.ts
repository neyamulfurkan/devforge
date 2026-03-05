import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PinnedPrompt {
  id: string
  title: string
  promptText: string
  aiTool: string | null
  category: string | null
  sourceType: 'library' | 'collection'
  sourceId: string
  pinnedAt: number
}

export interface QuickPanelPosition {
  x: number
  y: number
}

export type PanelDock = 'free' | 'left' | 'right'

interface QuickPromptsState {
  pinnedPrompts: PinnedPrompt[]
  panelVisible: boolean
  panelPosition: QuickPanelPosition
  panelDock: PanelDock
  panelCollapsed: boolean
  activePromptId: string | null
}

interface QuickPromptsActions {
  pinPrompt: (prompt: Omit<PinnedPrompt, 'pinnedAt'>) => void
  unpinPrompt: (id: string) => void
  isPinned: (id: string) => boolean
  togglePanel: () => void
  showPanel: () => void
  hidePanel: () => void
  setPanelPosition: (pos: QuickPanelPosition) => void
  setPanelDock: (dock: PanelDock) => void
  toggleCollapsed: () => void
  setActivePrompt: (id: string | null) => void
  reorderPins: (fromIndex: number, toIndex: number) => void
  clearAllPins: () => void
}

export const useQuickPromptsStore = create<QuickPromptsState & QuickPromptsActions>()(
  persist(
    (set, get) => ({
      pinnedPrompts: [],
      panelVisible: false,
      panelPosition: { x: 24, y: 120 },
      panelDock: 'free',
      panelCollapsed: false,
      activePromptId: null,

      pinPrompt: (prompt) => {
        const existing = get().pinnedPrompts.find((p) => p.id === prompt.id)
        if (existing) return
        set((state) => ({
          pinnedPrompts: [...state.pinnedPrompts, { ...prompt, pinnedAt: Date.now() }],
          panelVisible: true,
        }))
      },

      unpinPrompt: (id) =>
        set((state) => ({
          pinnedPrompts: state.pinnedPrompts.filter((p) => p.id !== id),
          activePromptId: state.activePromptId === id ? null : state.activePromptId,
        })),

      isPinned: (id) => get().pinnedPrompts.some((p) => p.id === id),

      togglePanel: () => set((state) => ({ panelVisible: !state.panelVisible })),

      showPanel: () => set({ panelVisible: true }),

      hidePanel: () => set({ panelVisible: false }),

      setPanelPosition: (pos) => set({ panelPosition: pos }),

      setPanelDock: (dock) => set({ panelDock: dock }),

      toggleCollapsed: () => set((state) => ({ panelCollapsed: !state.panelCollapsed })),

      setActivePrompt: (id) => set({ activePromptId: id }),

      reorderPins: (fromIndex, toIndex) =>
        set((state) => {
          const pins = [...state.pinnedPrompts]
          const [moved] = pins.splice(fromIndex, 1)
          pins.splice(toIndex, 0, moved)
          return { pinnedPrompts: pins }
        }),

      clearAllPins: () => set({ pinnedPrompts: [], activePromptId: null }),
    }),
    {
      name: 'devforge-quick-prompts',
      partialize: (state) => ({
        pinnedPrompts: state.pinnedPrompts,
        panelPosition: state.panelPosition,
        panelDock: state.panelDock,
        panelCollapsed: state.panelCollapsed,
        panelVisible: state.panelVisible,
      }),
    }
  )
)