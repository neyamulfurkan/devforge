'use client'

// 3. Third-party library imports
import {
  LayoutDashboard,
  FileText,
  List,
  Code,
  MessageSquare,
  AlertCircle,
  Terminal,
  Download,
} from 'lucide-react'

// 6. Internal imports — hooks, utils, types
import { useErrors, useDevProbeBridge } from '@/hooks/useErrors'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import type { WorkspaceTab } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WorkspaceNavProps {
  activeTab: WorkspaceTab
  onTabChange: (tab: WorkspaceTab) => void
  projectId: string
}

interface TabConfig {
  id: WorkspaceTab
  label: string
  icon: React.ElementType
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'files', label: 'Files', icon: List },
  { id: 'editor', label: 'Editor', icon: Code },
  { id: 'prompts', label: 'Prompts', icon: MessageSquare },
  { id: 'errors', label: 'Errors', icon: AlertCircle },
  { id: 'setup', label: 'Setup', icon: Terminal },
  { id: 'export', label: 'Export', icon: Download },
]

// ─── Component ───────────────────────────────────────────────────────────────

export function WorkspaceNav({
  activeTab,
  onTabChange,
  projectId,
}: WorkspaceNavProps): JSX.Element {
  const { pendingCount } = useErrors(projectId)
  const { user } = useAuth()
  const { pendingFromDevProbe } = useDevProbeBridge(user?.id)
  const totalPending = pendingCount + pendingFromDevProbe

  return (
    <nav
      aria-label="Workspace tabs"
      className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
    >
      <div
        className="flex items-end overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          const Icon = tab.icon
          const isErrorsTab = tab.id === 'errors'

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-selected={isActive}
              role="tab"
              className={cn(
                'relative flex min-w-max flex-shrink-0 items-center gap-2 px-4 py-3',
                'text-sm font-medium transition-colors duration-150',
                'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                'focus-visible:ring-inset outline-none',
                isActive
                  ? 'text-[var(--text-primary)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[var(--accent-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{tab.label}</span>

              {isErrorsTab && totalPending > 0 && (
                <span
                  className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--status-error)] px-1 text-[10px] font-bold text-white"
                  aria-label={`${totalPending} pending error${totalPending !== 1 ? 's' : ''}`}
                >
                  {totalPending > 99 ? '99+' : totalPending}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}