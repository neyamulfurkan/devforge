'use client'

import {
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from 'react'
import {
  Pin,
  Copy,
  Check,
  ChevronRight,
  X,
  Zap,
  Trash2,
  ArrowLeftToLine,
  ArrowRightToLine,
  Maximize2,
  ChevronDown,
  LayoutGrid,
  List,
  Plus,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { useQuickPromptsStore } from '@/store/quickPromptsStore'
import { AI_TOOL_COLOR_MAP } from '@/lib/constants'
import { copyToClipboard, cn } from '@/lib/utils'
import type { PinnedPrompt } from '@/store/quickPromptsStore'

const PANEL_WIDTH = 340
const PANEL_COLLAPSED_WIDTH = 52
const SNAP_THRESHOLD = 80

function PromptRow({
  prompt,
  isExpanded,
  onToggleExpand,
  onUnpin,
}: {
  prompt: PinnedPrompt
  isExpanded: boolean
  onToggleExpand: () => void
  onUnpin: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await copyToClipboard(prompt.promptText)
    setCopied(true)
    toast.success(`Copied: ${prompt.title}`)
    setTimeout(() => setCopied(false), 2000)
  }, [prompt.promptText, prompt.title])

  const handleUnpin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onUnpin()
    },
    [onUnpin]
  )

  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleExpand()
    },
    [onToggleExpand]
  )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 16, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={cn(
        'group rounded-xl border overflow-hidden transition-all duration-150',
        isExpanded
          ? 'border-[var(--accent-primary)]/30 shadow-[0_0_16px_rgba(99,102,241,0.1)]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
      )}
    >
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 transition-all duration-150 active:scale-[0.99]',
          copied
            ? 'bg-green-500/10'
            : isExpanded
            ? 'bg-[var(--accent-primary)]/6'
            : 'bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)]'
        )}
        aria-label={`Copy: ${prompt.title}`}
      >
        <div
          className={cn(
            'flex-shrink-0 w-1.5 h-1.5 rounded-full transition-colors duration-150',
            copied
              ? 'bg-green-400'
              : isExpanded
              ? 'bg-[var(--accent-primary)]'
              : 'bg-[var(--border-emphasis)]'
          )}
        />

        <div className="min-w-0 flex-1 text-left">
          <p
            className={cn(
              'text-xs font-semibold leading-tight truncate transition-colors duration-150',
              copied
                ? 'text-green-400'
                : isExpanded
                ? 'text-[var(--accent-primary)]'
                : 'text-[var(--text-primary)]'
            )}
          >
            {prompt.title}
          </p>
          {prompt.aiTool && (
            <span
              className={cn(
                'mt-0.5 inline-flex text-[9px] font-semibold px-1.5 py-0.5 rounded-full border',
                AI_TOOL_COLOR_MAP[prompt.aiTool] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20'
              )}
            >
              {prompt.aiTool}
            </span>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-1">
          <span
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded-md transition-all duration-150',
              copied ? 'text-green-400' : 'text-[var(--text-tertiary)]'
            )}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </span>

          <button
            type="button"
            onClick={handleExpand}
            aria-label="Expand prompt"
            className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)] transition-all duration-150"
          >
            <ChevronRight
              className={cn(
                'w-3 h-3 transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
            />
          </button>

          <button
            type="button"
            onClick={handleUnpin}
            aria-label="Unpin"
            className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-[var(--accent-primary)]/15">
              <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-[var(--text-tertiary)] max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-default)] scrollbar-track-transparent">
                {prompt.promptText}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PromptButton({
  prompt,
  onUnpin,
}: {
  prompt: PinnedPrompt
  onUnpin: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await copyToClipboard(prompt.promptText)
    setCopied(true)
    toast.success(`Copied: ${prompt.title}`)
    setTimeout(() => setCopied(false), 1800)
  }, [prompt.promptText, prompt.title])

  const handleUnpin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onUnpin()
    },
    [onUnpin]
  )

  const short = prompt.title.length > 18 ? prompt.title.slice(0, 16) + '…' : prompt.title

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="group relative"
    >
      <button
        type="button"
        onClick={handleCopy}
        title={prompt.title}
        className={cn(
          'relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold',
          'border transition-all duration-150 active:scale-95 w-full',
          copied
            ? 'bg-green-500/15 border-green-500/30 text-green-400'
            : 'bg-[rgba(255,255,255,0.04)] border-[var(--border-subtle)] text-[var(--text-secondary)]',
          'hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/8',
          'shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
        )}
      >
        {copied ? (
          <Check className="w-3 h-3 flex-shrink-0" />
        ) : (
          <Copy className="w-3 h-3 flex-shrink-0 opacity-60" />
        )}
        <span className="truncate">{short}</span>
      </button>

      <button
        type="button"
        onClick={handleUnpin}
        aria-label="Unpin"
        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-red-400 hover:border-red-400/40 transition-all duration-150 z-10"
      >
        <X className="w-2.5 h-2.5" />
      </button>
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
  const [viewMode, setViewMode] = useState<'list' | 'buttons'>('list')
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
      return {
        x: Math.max(8, Math.min(x, w - PANEL_WIDTH - 8)),
        y: Math.max(8, Math.min(y, h - 120)),
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
      const clamped = clampPos(
        dragStartPanelPos.current.x + dx,
        dragStartPanelPos.current.y + dy
      )
      setPanelPosition(clamped)
      setPanelDock('free')
    },
    [clampPos, setPanelPosition, setPanelDock]
  )

  const onDragEnd = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      isDragging.current = false
      setDraggingNow(false)
      setPanelDock(snapToDock(panelPosition.x))
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
              'shadow-[0_4px_24px_rgba(99,102,241,0.5)] hover:shadow-[0_6px_32px_rgba(99,102,241,0.65)]',
              'transition-all duration-200 active:scale-95'
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
            initial={{ opacity: 0, scale: 0.93, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.91, y: 12 }}
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
              'bg-[rgba(10,10,10,0.92)] backdrop-blur-2xl',
              draggingNow
                ? 'shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_0_1px_rgba(99,102,241,0.25)]'
                : 'shadow-[0_8px_40px_rgba(0,0,0,0.65),0_0_0_1px_rgba(99,102,241,0.07)]',
              'overflow-hidden transition-[width,box-shadow] duration-200'
            )}
          >
            <div
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 gap-2',
                'border-b border-[var(--border-subtle)]',
                'cursor-grab active:cursor-grabbing select-none',
                'bg-[rgba(255,255,255,0.025)]'
              )}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md bg-[var(--accent-primary)]/15">
                  <Zap className="w-3 h-3 text-[var(--accent-primary)]" />
                </div>
                {!panelCollapsed && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] whitespace-nowrap tracking-wide">
                      QUICK PROMPTS
                    </span>
                    {pinnedPrompts.length > 0 && (
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent-primary)] text-white text-[9px] font-bold flex-shrink-0">
                        {pinnedPrompts.length}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!panelCollapsed && (
                <div
                  className="flex items-center gap-0.5 flex-shrink-0"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === 'list' ? 'buttons' : 'list')}
                    aria-label="Toggle view mode"
                    title={viewMode === 'list' ? 'Switch to button view' : 'Switch to list view'}
                    className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                  >
                    {viewMode === 'list' ? (
                      <LayoutGrid className="w-3 h-3" />
                    ) : (
                      <List className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelPosition({ x: 12, y: resolvedY })
                      setPanelDock('left')
                    }}
                    aria-label="Dock left"
                    className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                  >
                    <ArrowLeftToLine className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelPosition({ x: (viewportSize.w || window.innerWidth) - PANEL_WIDTH - 12, y: resolvedY })
                      setPanelDock('right')
                    }}
                    aria-label="Dock right"
                    className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                  >
                    <ArrowRightToLine className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePanel}
                    aria-label="Hide panel"
                    className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleCollapsed() }}
                aria-label={panelCollapsed ? 'Expand panel' : 'Collapse panel'}
                className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150"
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
                transition={{ duration: 0.12 }}
              >
                {pinnedPrompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 px-5 gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent-primary)]/8 border border-[var(--accent-border)]">
                      <Pin className="w-4 h-4 text-[var(--accent-primary)]/50" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        No prompts pinned
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--text-tertiary)] leading-relaxed max-w-[220px]">
                        Pin prompts from the Library or Collections using the
                        <Pin className="inline w-2.5 h-2.5 mx-1 text-[var(--accent-primary)]" />
                        icon on any prompt card.
                      </p>
                    </div>
                  </div>
                ) : viewMode === 'list' ? (
                  <div className="flex flex-col">
                    <div className="px-3 pt-2.5 pb-1 flex flex-col gap-1.5 max-h-[440px] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-default)] scrollbar-track-transparent">
                      <AnimatePresence mode="popLayout">
                        {pinnedPrompts.map((prompt) => (
                          <PromptRow
                            key={prompt.id}
                            prompt={prompt}
                            isExpanded={activePromptId === prompt.id}
                            onToggleExpand={() =>
                              setActivePrompt(activePromptId === prompt.id ? null : prompt.id)
                            }
                            onUnpin={() => unpinPrompt(prompt.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>

                    <div className="px-3 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                        {pinnedPrompts.length} prompt{pinnedPrompts.length !== 1 ? 's' : ''}
                      </span>
                      {!showClearConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-red-400 transition-colors duration-150 px-1.5 py-0.5 rounded-md hover:bg-red-400/8"
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
                            onClick={() => { clearAllPins(); setShowClearConfirm(false) }}
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
                ) : (
                  <div className="flex flex-col">
                    <div className="px-3 pt-2.5 pb-1 grid grid-cols-2 gap-1.5 max-h-[440px] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--border-default)] scrollbar-track-transparent">
                      <AnimatePresence mode="popLayout">
                        {pinnedPrompts.map((prompt) => (
                          <PromptButton
                            key={prompt.id}
                            prompt={prompt}
                            onUnpin={() => unpinPrompt(prompt.id)}
                          />
                        ))}
                      </AnimatePresence>
                    </div>

                    <div className="px-3 py-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
                        {pinnedPrompts.length} prompt{pinnedPrompts.length !== 1 ? 's' : ''}
                      </span>
                      {!showClearConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirm(true)}
                          className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-red-400 transition-colors duration-150 px-1.5 py-0.5 rounded-md hover:bg-red-400/8"
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
                            onClick={() => { clearAllPins(); setShowClearConfirm(false) }}
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
                {pinnedPrompts.slice(0, 6).map((prompt) => (
                  <motion.button
                    key={prompt.id}
                    layout
                    type="button"
                    onClick={() => { toggleCollapsed(); setActivePrompt(prompt.id) }}
                    aria-label={prompt.title}
                    title={prompt.title}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150',
                      'text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]',
                      'hover:bg-[var(--accent-primary)]/10 border border-transparent hover:border-[var(--accent-border)]'
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wide">
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