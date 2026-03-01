// 4. Internal imports — UI components
import { Skeleton } from '@/components/ui/skeleton'

// ─── Skeleton sub-components — match the exact structure of the real dashboard ─

function StatsCardSkeleton(): JSX.Element {
  return (
    <div className="relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5">
      {/* Icon circle — top right */}
      <Skeleton className="absolute right-4 top-4 h-9 w-9 rounded-full" />
      {/* Value */}
      <Skeleton className="h-8 w-14 rounded" />
      {/* Label */}
      <Skeleton className="mt-2 h-4 w-28 rounded" />
    </div>
  )
}

function ProjectCardSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-5">
      {/* Top row: icon + badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 flex-shrink-0 rounded-md" />
          <Skeleton className="h-5 w-36 rounded" />
        </div>
        <Skeleton className="h-5 w-20 flex-shrink-0 rounded-full" />
      </div>
      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3.5 w-8 rounded" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      {/* Tech stack badges */}
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-7 w-16 rounded-md" />
      </div>
    </div>
  )
}

function QuickActionsSkeleton(): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-4"
        >
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-3.5 w-28 rounded" />
        </div>
      ))}
    </div>
  )
}

function ActivityFeedSkeleton(): JSX.Element {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] px-5 py-4">
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      {/* Rows */}
      <div className="divide-y divide-[var(--border-subtle)] px-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <Skeleton className="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full rounded" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3.5 w-16 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Loading page ─────────────────────────────────────────────────────────────

export default function DashboardLoading(): JSX.Element {
  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Main layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

        {/* Left — projects grid */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Section header */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </div>
          {/* 3 project cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-shrink-0 flex-col gap-4 lg:w-80 xl:w-96">
          <QuickActionsSkeleton />
          <ActivityFeedSkeleton />
        </div>
      </div>
    </div>
  )
}