'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useQuickPromptsStore } from '@/store/quickPromptsStore'
import type { PinnedPrompt } from '@/store/quickPromptsStore'

export function useQuickPrompts() {
  const {
    pinnedPrompts,
    panelVisible,
    panelPosition,
    panelDock,
    panelCollapsed,
    activePromptId,
    pinPrompt,
    unpinPrompt,
    isPinned,
    togglePanel,
    showPanel,
    hidePanel,
    setPanelPosition,
    setPanelDock,
    toggleCollapsed,
    setActivePrompt,
    reorderPins,
    clearAllPins,
  } = useQuickPromptsStore()

  const handlePin = useCallback(
    (prompt: Omit<PinnedPrompt, 'pinnedAt'>) => {
      if (isPinned(prompt.id)) {
        unpinPrompt(prompt.id)
        toast.success('Removed from Quick Prompts')
      } else {
        pinPrompt(prompt)
        toast.success('Added to Quick Prompts panel')
      }
    },
    [isPinned, pinPrompt, unpinPrompt]
  )

  const handleUnpin = useCallback(
    (id: string) => {
      unpinPrompt(id)
      toast.success('Removed from Quick Prompts')
    },
    [unpinPrompt]
  )

  const handleClearAll = useCallback(() => {
    clearAllPins()
    toast.success('Quick Prompts cleared')
  }, [clearAllPins])

  return {
    pinnedPrompts,
    panelVisible,
    panelPosition,
    panelDock,
    panelCollapsed,
    activePromptId,
    isPinned,
    handlePin,
    handleUnpin,
    handleClearAll,
    togglePanel,
    showPanel,
    hidePanel,
    setPanelPosition,
    setPanelDock,
    toggleCollapsed,
    setActivePrompt,
    reorderPins,
    pinnedCount: pinnedPrompts.length,
  }
}