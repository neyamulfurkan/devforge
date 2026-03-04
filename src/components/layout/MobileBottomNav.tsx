'use client'

// 1. Next.js imports
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 2. Third-party library imports
import {
  LayoutDashboard,
  FolderOpen,
  BookOpen,
  Bookmark,
  Settings,
} from 'lucide-react'

// 3. Internal imports — utils
import { cn } from '@/lib/utils'

// 4. Local types
interface BottomNavItem {
  href: string
  label: string
  icon: React.ElementType
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/library', label: 'Library', icon: BookOpen },
  { href: '/collections', label: 'Collections', icon: Bookmark },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MobileBottomNav(): JSX.Element {
  const pathname = usePathname()

  const isActive = (href: string): boolean => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/projects') return pathname === '/projects' || (pathname.startsWith('/projects') && !pathname.startsWith('/projects/deployed'))
    return pathname.startsWith(href)
  }

  return (
    <div className="flex items-center justify-around h-[60px] bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] safe-area-bottom">
      {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href)
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // Min 44x44px touch target
              'flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-2 gap-0.5',
              'transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)] outline-none rounded-md',
              active
                ? 'text-[var(--accent-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
          >
            <Icon
              className={cn(
                'w-5 h-5 transition-transform duration-150',
                active && 'scale-110'
              )}
            />
            <span
              className={cn(
                'text-[10px] font-medium leading-none tracking-tight',
                active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
              )}
            >
              {label}
            </span>

            {/* Active indicator dot */}
            {active && (
              <span className="absolute -top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-[var(--accent-primary)]" />
            )}
          </Link>
        )
      })}
    </div>
  )
}

export default MobileBottomNav