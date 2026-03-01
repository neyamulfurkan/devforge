'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Next.js imports
import { useRouter } from 'next/navigation'

// 3. Third-party library imports
import { Bell, ChevronDown, Search, User, Settings, LogOut, Menu } from 'lucide-react'

// 4. Internal imports — UI components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// 5. Internal imports — stores and hooks
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { useAuth } from '@/hooks/useAuth'

// 6. Internal imports — utils
import { cn } from '@/lib/utils'

export function TopBar(): JSX.Element {
  const router = useRouter()
  const { currentProjectData } = useProjectStore()
  const { toggleSidebar, toasts } = useUIStore()
  const { user, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const unreadCount = toasts.filter((t) => t.type === 'info' || t.type === 'warning').length

  const userInitial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'

  const handleLogout = useCallback(async (): Promise<void> => {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch {
      setIsLoggingOut(false)
    }
  }, [logout])

  return (
    <div className="h-[52px] w-full flex items-center px-4 gap-3 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
      {/* ─── Left: Sidebar toggle + project name ───────────────────── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Sidebar hamburger toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
            'transition-colors duration-150',
            'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] outline-none'
          )}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Project name / breadcrumb */}
        {currentProjectData ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[var(--text-tertiary)] text-[13px]">Projects</span>
            <span className="text-[var(--text-tertiary)] text-[13px]">/</span>
            <span className="text-[var(--text-primary)] text-[13px] font-medium truncate max-w-[200px]">
              {currentProjectData.name}
            </span>
          </div>
        ) : (
          <span className="text-[var(--text-secondary)] text-[13px] font-medium">
            DevForge
          </span>
        )}
      </div>

      {/* ─── Right: actions ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Search button */}
        <button
          type="button"
          onClick={() => router.push('/library')}
          aria-label="Search"
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-md',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
            'transition-colors duration-150',
            'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] outline-none'
          )}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications bell */}
        <button
          type="button"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className={cn(
            'relative flex items-center justify-center w-8 h-8 rounded-md',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
            'transition-colors duration-150',
            'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] outline-none'
          )}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[var(--status-error)] text-white text-[9px] font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="User menu"
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md',
                'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
                'transition-colors duration-150',
                'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] outline-none'
              )}
            >
              {/* Avatar circle */}
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-[11px] font-semibold flex-shrink-0">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={user.name ?? 'User avatar'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  userInitial
                )}
              </div>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            {/* User info header */}
            <div className="px-2 py-1.5 border-b border-[var(--border-subtle)] mb-1">
              <p className="text-[var(--text-primary)] text-[13px] font-medium truncate">
                {user?.name ?? 'User'}
              </p>
              <p className="text-[var(--text-tertiary)] text-[11px] truncate">
                {user?.email ?? ''}
              </p>
            </div>

            <DropdownMenuItem
              onClick={() => router.push('/settings')}
              className="flex items-center gap-2 text-[13px] cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              Profile
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/settings')}
              className="flex items-center gap-2 text-[13px] cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 text-[13px] text-[var(--status-error)] focus:text-[var(--status-error)] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {isLoggingOut ? 'Logging out…' : 'Logout'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export default TopBar