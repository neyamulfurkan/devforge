'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react'
import {
  Pin,
  PinOff,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  GripHorizontal,
  Trash2,
  Layers,
  ArrowLeftToLine,
  ArrowRightToLine,
  Maximize2,
} from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { toast } from 'sonner'
import { useQuickPromptsStore } from '@/store/quickPromptsStore'
import { AI_TOOL_COLOR_MAP } from '@/lib/constants'
import { copyToClipboard, cn } from '@/lib/utils'
import type { PinnedPrompt } from '@/store/quickPromptsStore'

const PANEL_WIDTH = 320
const PANEL_COLLAPSED_WIDTH = 56
const SNAP_THRESHOLD = 80

function PromptPill({
  prompt,
  isActive,
  onActivate,
  onUnpin,
}: {
  prompt: PinnedPrompt
  isActive: boolean
  onActivate: () => void
  onUnpin: () => void
}) {
  const [copied, setCopied] = useState(false)
  const toolColor = prompt.aiTool
    ? (AI_TOOL_COLOR_MAP[prompt.aiTool] ?? '')
    : ''

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      await copyToClipboard(prompt.promptText)
      setCopied(true)
      toast.success(`Copied: ${prompt.title}`)
      setTimeout(() => setCopied(false), 2000)
    },
    [prompt.promptText, prompt.title]
  )

  const handleUnpin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onUnpin()
    },
    [onUnpin]
  )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 12, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={onActivate}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer',
        'border transition-all duration-150 select-none',
        isActive
          ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]'
          : 'bg-[rgba(255,255,255,0.03)] border-[var(--border-subtle)] hover:border-[var(--border-default)] hover:bg-[rgba(255,255,255,0.06)]'
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 w-1.5 h-1.5 rounded-full',
          isActive ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-emphasis)]'
        )}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-xs font-semibold leading-tight truncate transition-colors duration-150',
            isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
          )}
        >
          {prompt.title}
        </p>
        {prompt.aiTool && (
          <span
            className={cn(
              'mt-0.5 inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
              toolColor
            )}
          >
            {prompt.aiTool}
          </span>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy prompt"
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md transition-all duration-150',
            copied
              ? 'text-green-400 bg-green-400/10'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
          )}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={handleUnpin}
          aria-label="Unpin prompt"
          className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  )
}

function ExpandedPromptView({
  prompt,
  onClose,
}: {
  prompt: PinnedPrompt
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await copyToClipboard(prompt.promptText)
    setCopied(true)
    toast.success('Prompt copied!')
    setTimeout(() => setCopied(false), 2000)
  }, [prompt.promptText])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="mt-2 rounded-xl border border-[var(--accent-border)] bg-[var(--bg-secondary)] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
        <p className="text-[11px] font-semibold text-[var(--accent-primary)] truncate max-w-[180px]">
          {prompt.title}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors duration-150"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="p-3 max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-default)] scrollbar-track-transparent">
        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {prompt.promptText}
        </pre>
      </div>

      <div className="px-3 py-2.5 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95',
            copied
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy Prompt
            </>
          )}
        </button>
      </div>
    </motion.div>
  )
}

export function QuickPromptsPanel() {
  const {
    pinnedPrompts,
    panelVisible,
    panelPosition,
    panelDock,
    panelCollapsed,
    activePromptId,
    togglePanel,
    toggleCollapsed,
    setPanelPosition,
    setPanelDock,
    setActivePrompt,
    unpinPrompt,
    clearAllPins,
  } = useQuickPromptsStore()

  const panelRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })
  const dragStartPanelPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const [draggingNow, setDraggingNow] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const update = () =>
      setViewportSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const clampPos = useCallback(
    (x: number, y: number) => {
      const w = viewportSize.w || window.innerWidth
      const h = viewportSize.h || window.innerHeight
      const maxX = w - PANEL_WIDTH - 8
      const maxY = h - 120
      return {
        x: Math.max(8, Math.min(x, maxX)),
        y: Math.max(8, Math.min(y, maxY)),
      }
    },
    [viewportSize]
  )

  const snapToDock = useCallback(
    (x: number) => {
      const w = viewportSize.w || window.innerWidth
      if (x < SNAP_THRESHOLD) return 'left' as const
      if (x > w - PANEL_WIDTH - SNAP_THRESHOLD) return 'right' as const
      return 'free' as const
    },
    [viewportSize]
  )

  const onDragStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      isDragging.current = true
      setDraggingNow(true)
      dragStartPos.current = { x: e.clientX, y: e.clientY }
      dragStartPanelPos.current = { ...panelPosition }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [panelPosition]
  )

  const onDragMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      const dx = e.clientX - dragStartPos.current.x
      const dy = e.clientY - dragStartPos.current.y
      const raw = {
        x: dragStartPanelPos.current.x + dx,
        y: dragStartPanelPos.current.y + dy,
      }
      const clamped = clampPos(raw.x, raw.y)
      setPanelPosition(clamped)
      setPanelDock('free')
    },
    [clampPos, setPanelPosition, setPanelDock]
  )

  const onDragEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      isDragging.current = false
      setDraggingNow(false)
      const dock = snapToDock(panelPosition.x)
      setPanelDock(dock)
    },
    [panelPosition.x, snapToDock, setPanelDock]
  )

  const resolvedX =
    panelDock === 'left'
      ? 12
      : panelDock === 'right'
      ? (viewportSize.w || window.innerWidth) - PANEL_WIDTH - 12
      : panelPosition.x

  const resolvedY = panelPosition.y

  const activePrompt = pinnedPrompts.find((p) => p.id === activePromptId) ?? null

  const handleActivate = useCallback(
    (id: string) => {
      setActivePrompt(activePromptId === id ? null : id)
    },
    [activePromptId, setActivePrompt]
  )

  if (!panelVisible && pinnedPrompts.length === 0) return null

  return (
    <>
      <AnimatePresence>
        {!panelVisible && pinnedPrompts.length > 0 && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            onClick={togglePanel}
            style={{ position: 'fixed', right: 20, bottom: 24, zIndex: 9999 }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-sm',
              'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white',
              'shadow-[0_4px_24px_rgba(99,102,241,0.45)] hover:shadow-[0_6px_32px_rgba(99,102,241,0.6)]',
              'transition-all duration-200 active:scale-95 border border-[var(--accent-primary)]'
            )}
            aria-label="Show Quick Prompts"
          >
            <Zap className="w-4 h-4" />
            <span>{pinnedPrompts.length}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panelVisible && (
          <motion.div
            key="panel"
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            style={{
              position: 'fixed',
              left: resolvedX,
              top: resolvedY,
              zIndex: 9998,
              width: panelCollapsed ? PANEL_COLLAPSED_WIDTH : PANEL_WIDTH,
              willChange: 'transform',
            }}
            className={cn(
              'rounded-2xl border border-[var(--border-default)]',
              'bg-[rgba(10,10,10,0.88)] backdrop-blur-xl',
              'shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(99,102,241,0.08)]',
              draggingNow && 'shadow-[0_16px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(99,102,241,0.2)]',
              'overflow-hidden transition-[width] duration-200'
            )}
          >
            <div
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className={cn(
                'flex items-center justify-between px-3 py-2.5',
                'border-b border-[var(--border-subtle)]',
                'cursor-grab active:cursor-grabbing select-none',
                'bg-[rgba(255,255,255,0.02)]'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--accent-primary)]/15">
                  <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                </div>
                {!panelCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex items-center gap-1.5 overflow-hidden"
                  >
                    <span className="text-xs font-bold text-[var(--text-primary)] whitespace-nowrap">
                      Quick Prompts
                    </span>
                    {pinnedPrompts.length > 0 && (
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent-primary)] text-white text-[9px] font-bold flex-shrink-0">
                        {pinnedPrompts.length}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {!panelCollapsed && (
                <div
                  className="flex items-center gap-0.5"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const w = viewportSize.w || window.innerWidth
                      setPanelPosition({ x: 12, y: resolvedY })
                      setPanelDock('left')
                    }}
                    aria-label="Dock left"
                    className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                  >
                    <ArrowLeftToLine className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const w = viewportSize.w || window.innerWidth
                      setPanelPosition({ x: w - PANEL_WIDTH - 12, y: resolvedY })
                      setPanelDock('right')
                    }}
                    aria-label="Dock right"
                    className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                  >
                    <ArrowRightToLine className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePanel}
                    aria-label="Hide panel"
                    className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleCollapsed()
                }}
                aria-label={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-150',
                  'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
                  panelCollapsed && 'ml-0'
                )}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {panelCollapsed ? (
                  <Maximize2 className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            </div>

            {!panelCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {pinnedPrompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[var(--accent-primary)]/8 border border-[var(--accent-border)]">
                      <Pin className="w-4 h-4 text-[var(--accent-primary)]/60" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        No prompts pinned
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                        Pin prompts from the Library or Collections to access them instantly here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="px-3 pt-3 pb-1 flex flex-col gap-1.5 max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-default)] scrollbar-track-transparent">
                      <AnimatePresence mode="popLayout">
                        {pinnedPrompts.map((prompt) => (
                          <div key={prompt.id}>
                            <PromptPill
                              prompt={prompt}
                              isActive={activePromptId === prompt.id}
                              onActivate={() => handleActivate(prompt.id)}
                              onUnpin={() => unpinPrompt(prompt.id)}
                            />
                            <AnimatePresence>
                              {activePromptId === prompt.id && (
                                <ExpandedPromptView
                                  prompt={prompt}
                                  onClose={() => setActivePrompt(null)}
                                />
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </AnimatePresence>
                    </div>

                    <div className="px-3 py-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                        {pinnedPrompts.length} pinned prompt{pinnedPrompts.length !== 1 ? 's' : ''}
                      </span>
                      {!showClearConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-red-400 transition-colors duration-150 px-1.5 py-1 rounded-md hover:bg-red-400/8"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear all
                        </button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1"
                        >
                          <span className="text-[10px] text-[var(--text-tertiary)]">Sure?</span>
                          <button
                            type="button"
                            onClick={() => {
                              clearAllPins()
                              setShowClearConfirm(false)
                              toast.success('Quick Prompts cleared')
                            }}
                            className="text-[10px] font-semibold text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded-md hover:bg-red-400/10 transition-colors duration-150"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowClearConfirm(false)}
                            className="text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-1.5 py-0.5 rounded-md hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                          >
                            No
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {panelCollapsed && pinnedPrompts.length > 0 && (
              <div className="flex flex-col items-center gap-1 py-2 px-1">
                {pinnedPrompts.slice(0, 5).map((prompt) => (
                  <motion.button
                    key={prompt.id}
                    layout
                    type="button"
                    onClick={() => {
                      toggleCollapsed()
                      setActivePrompt(prompt.id)
                    }}
                    aria-label={prompt.title}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150',
                      'text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]',
                      'hover:bg-[var(--accent-primary)]/10 border border-transparent',
                      'hover:border-[var(--accent-border)]'
                    )}
                    title={prompt.title}
                  >
                    <span className="text-[11px] font-bold uppercase">
                      {prompt.title.slice(0, 2)}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default QuickPromptsPanel