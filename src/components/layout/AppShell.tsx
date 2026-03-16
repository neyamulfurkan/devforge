'use client'

// 1. React imports
import { useEffect, useRef, useCallback } from 'react'

// 2. Third-party library imports
import { AnimatePresence, motion } from 'framer-motion'

// 3. Internal imports — layout components
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

// 4. Internal imports — stores
import { useUIStore } from '@/store/uiStore'

// 5. Local types
interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps): JSX.Element {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, sidebarWidth, setSidebarWidth } = useUIStore()
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const delta = ev.clientX - startX.current
      const newWidth = Math.max(180, Math.min(480, startWidth.current + delta))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [sidebarWidth, setSidebarWidth])

  // Close sidebar on mobile when navigating
  useEffect(() => {
    const handleResize = (): void => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }

    // Set initial state
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setSidebarOpen])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-primary)]">
      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: sidebarCollapsed ? 56 : sidebarWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="hidden md:flex flex-col flex-shrink-0 overflow-hidden relative"
            style={{ width: sidebarCollapsed ? 56 : sidebarWidth }}
          >
            <Sidebar collapsed={sidebarCollapsed} />
            {/* Resize handle — only when not collapsed */}
            {!sidebarCollapsed && (
              <div
                onMouseDown={handleResizeStart}
                className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 group"
                title="Drag to resize sidebar"
              >
                <div className="w-full h-full opacity-0 group-hover:opacity-100 bg-[var(--accent-primary)] transition-opacity duration-150" />
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Main area (top bar + content) ──────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar — fixed height 52px */}
        <header className="h-[52px] flex-shrink-0 z-20">
          <TopBar />
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>

        {/* Mobile bottom navigation — only below md breakpoint */}
        <nav className="md:hidden flex-shrink-0">
          <MobileBottomNav />
        </nav>
      </div>

      {/* ─── Mobile sidebar overlay ──────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Mobile sidebar drawer */}
            <motion.aside
              key="sidebar-mobile"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-40 w-[240px]"
            >
              <Sidebar />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}