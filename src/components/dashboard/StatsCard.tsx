'use client'

// 3. Third-party library imports
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react'

// 4. Internal imports — UI components
import { Card, CardContent } from '@/components/ui/card'

// 6. Internal imports — utils
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatsCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
}: StatsCardProps): JSX.Element {
  return (
    <Card className="relative border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5 transition-colors hover:border-[var(--border-default)]">
      <CardContent className="p-0">
        {/* Icon — absolute top right */}
        <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-light)]">
          <Icon className="h-4 w-4 text-[var(--accent-primary)]" />
        </div>

        {/* Value */}
        <p className="text-3xl font-bold text-[var(--text-primary)]">{value}</p>

        {/* Label */}
        <p className="mt-1 pr-12 text-sm text-[var(--text-secondary)]">{label}</p>

        {/* Optional trend */}
        {trend !== undefined && trendUp !== undefined && (
          <div
            className={cn(
              'mt-2 flex items-center gap-1 text-xs font-medium',
              trendUp ? 'text-[var(--status-complete)]' : 'text-[var(--status-error)]'
            )}
          >
            {trendUp ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}