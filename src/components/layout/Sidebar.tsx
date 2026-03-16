'use client'

// 1. React imports
import { useState } from 'react'

// 2. Next.js imports
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 3. Third-party library imports
import {
  LayoutDashboard,
  FolderOpen,
  BookOpen,
  Bookmark,
  Settings,
  HelpCircle,
  LogOut,
  Zap,
  ChevronRight,
  Rocket,
} from 'lucide-react'

// 4. Internal imports — hooks
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'

// 5. Internal imports — utils
import { cn } from '@/lib/utils'

// 6. Local types
export interface SidebarProps {
  collapsed?: boolean
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/projects/deployed', label: 'Deployed', icon: Rocket },
  { href: '/library', label: 'Prompt Library', icon: BookOpen },
  { href: '/collections', label: 'My Collections', icon: Bookmark },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help / Docs', icon: HelpCircle },
]

export function Sidebar({ collapsed = false }: SidebarProps): JSX.Element {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { setSidebarOpen, toggleSidebarCollapsed } = useUIStore()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async (): Promise<void> => {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch {
      setIsLoggingOut(false)
    }
  }

  const isActive = (href: string): boolean => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/projects') return pathname === '/projects' || (pathname.startsWith('/projects') && !pathname.startsWith('/projects/deployed'))
    return pathname.startsWith(href)
  }

  const userInitial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)]">
      {/* ─── Logo ─────────────────────────────────────────────────────── */}
      <div className="flex items-center h-[52px] border-b border-[var(--border-subtle)] flex-shrink-0 px-3 gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--accent-primary)] flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-[var(--text-primary)] font-semibold text-[15px] tracking-tight truncate flex-1">
            DevForge
          </span>
        )}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] transition-colors duration-150 flex-shrink-0 ml-auto"
        >
          <ChevronRight
            className={collapsed ? 'w-3.5 h-3.5 transition-transform duration-200' : 'w-3.5 h-3.5 transition-transform duration-200 rotate-180'}
          />
        </button>
      </div>

      {/* ─── Navigation ───────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => {
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false)
                    }
                  }}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'flex items-center rounded-md text-sm font-medium transition-all duration-150 group',
                    collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2',
                    active
                      ? 'bg-[var(--accent-light)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-150 flex-shrink-0',
                      active
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>

                  {!collapsed && (
                    <>
                      <span className="flex-1">{label}</span>
                      {active && (
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--accent-primary)] opacity-60" />
                      )}
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ─── User profile section ─────────────────────────────────────── */}
      <div className="flex-shrink-0 p-2 border-t border-[var(--border-subtle)]">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent-primary)] text-white text-[13px] font-semibold flex-shrink-0"
              title={user?.name ?? 'User'}
            >
              {userInitial}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Log out"
              title="Log out"
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-tertiary)] transition-colors duration-150',
                'hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)]',
                'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] outline-none',
                isLoggingOut && 'opacity-50 cursor-not-allowed'
              )}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-2 py-2 rounded-md">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent-primary)] text-white text-[13px] font-semibold flex-shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text-primary)] text-[13px] font-medium truncate leading-tight">
                {user?.name ?? 'User'}
              </p>
              <p className="text-[var(--text-tertiary)] text-[11px] truncate leading-tight">
                {user?.email ?? ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Log out"
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-tertiary)] transition-colors duration-150',
                'hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)]',
                'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] outline-none',
                isLoggingOut && 'opacity-50 cursor-not-allowed'
              )}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar