'use client'

// 3. Third-party library imports
import {
  CheckSquare,
  AlertCircle,
  Braces,
  Plus,
  CheckCircle,
  Clock,
} from 'lucide-react'

// 4. Internal imports — UI components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

// 6. Internal imports — utils, types
import { formatRelativeTime, cn } from '@/lib/utils'
import type { ActivityEntry, ActivityType } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  activities: ActivityEntry[]
  maxItems?: number
}

// ─── Icon + color config per activity type ────────────────────────────────────

const ACTIVITY_CONFIG: Record<
  ActivityType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  file_complete: {
    icon: CheckSquare,
    color: 'text-[var(--status-complete)]',
    bg: 'bg-[var(--status-complete-bg)]',
  },
  error_added: {
    icon: AlertCircle,
    color: 'text-[var(--status-error)]',
    bg: 'bg-[var(--status-error-bg)]',
  },
  json_appended: {
    icon: Braces,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  feature_added: {
    icon: Plus,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  error_resolved: {
    icon: CheckCircle,
    color: 'text-[var(--status-complete)]',
    bg: 'bg-[var(--status-complete-bg)]',
  },
}

// ─── Sub-component: activity row ─────────────────────────────────────────────

function ActivityRow({ entry }: { entry: ActivityEntry }): JSX.Element {
  const config = ACTIVITY_CONFIG[entry.type]
  const Icon = config.icon

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Icon */}
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
          config.bg
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm leading-snug text-[var(--text-secondary)]">
          {entry.description}
        </p>
        <div className="flex items-center gap-2">
          <Badge className="h-4 border-0 bg-[var(--bg-quaternary)] px-1.5 py-0 text-[10px] font-medium text-[var(--text-tertiary)]">
            {entry.projectName}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(entry.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ActivityFeed({ activities, maxItems = 10 }: ActivityFeedProps): JSX.Element {
  const visible = activities.slice(0, maxItems)

  return (
    <Card className="border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
      <CardHeader className="border-b border-[var(--border-subtle)] px-5 py-4">
        <CardTitle className="text-sm font-semibold text-[var(--text-primary)]">
          Recent Activity
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Clock className="h-6 w-6 text-[var(--text-tertiary)]" />
            <p className="text-sm text-[var(--text-secondary)]">No recent activity</p>
          </div>
        ) : (
          <ScrollArea className={cn(visible.length > 5 ? 'h-[320px]' : 'h-auto')}>
            <div className="divide-y divide-[var(--border-subtle)] px-5">
              {visible.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}