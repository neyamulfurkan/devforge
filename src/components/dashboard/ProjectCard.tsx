'use client'

// 3. Third-party library imports
import { Folder, ArrowRight, ExternalLink } from 'lucide-react'

// 4. Internal imports — UI components
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

// 6. Internal imports — utils, types
import { formatRelativeTime, calculateProgress, cn } from '@/lib/utils'
import type { Project } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project
  onOpen: (projectId: string) => void
}

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: {
    label: 'In Progress',
    className:
      'bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)] border-[var(--status-in-progress)]/20',
  },
  COMPLETE: {
    label: 'Complete',
    className:
      'bg-[var(--status-complete-bg)] text-[var(--status-complete)] border-[var(--status-complete)]/20',
  },
  PAUSED: {
    label: 'Paused',
    className:
      'bg-[var(--status-empty-bg)] text-[var(--status-empty)] border-[var(--status-empty)]/20',
  },
  ARCHIVED: {
    label: 'Archived',
    className:
      'bg-[var(--status-empty-bg)] text-[var(--status-empty)] border-[var(--status-empty)]/20',
  },
}

const MAX_VISIBLE_BADGES = 3

// ─── Component ───────────────────────────────────────────────────────────────

export function ProjectCard({ project, onOpen }: ProjectCardProps): JSX.Element {
  const progress = calculateProgress(project.completedFiles, project.totalFiles)
  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.IN_PROGRESS

  const visibleStack = project.techStack.slice(0, MAX_VISIBLE_BADGES)
  const extraCount = project.techStack.length - MAX_VISIBLE_BADGES

  return (
    <Card
      className={cn(
        'flex flex-col gap-0 border border-[var(--border-subtle)] bg-[var(--bg-tertiary)]',
        'cursor-pointer rounded-xl transition-all duration-150',
        'hover:-translate-y-0.5 hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)]'
      )}
      onClick={() => onOpen(project.id)}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Top row: icon + status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--accent-light)]">
              <Folder className="h-4 w-4 text-[var(--accent-primary)]" />
            </div>
            <h3 className="line-clamp-2 text-base font-semibold leading-tight text-[var(--text-primary)]">
              {project.name}
            </h3>
          </div>
          <Badge
            className={cn(
              'flex-shrink-0 border text-[10px] font-medium',
              statusConfig.className
            )}
          >
            {statusConfig.label}
          </Badge>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">
              {project.completedFiles} / {project.totalFiles} files
            </span>
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {progress}%
            </span>
          </div>
          <Progress
            value={progress}
            className="h-1.5 bg-[var(--bg-quaternary)]"
          />
        </div>

        {/* Tech stack badges */}
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleStack.map((tech) => (
              <span
                key={tech}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-quaternary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]"
              >
                {tech}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-quaternary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                +{extraCount} more
              </span>
            )}
          </div>
        )}

        {/* Deployment link (if set) */}
        {project.deploymentUrl && (
          <a
            href={project.deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 truncate rounded-md border border-[var(--accent-border)] bg-[var(--accent-light)] px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Live Site</span>
          </a>
        )}

        {/* Footer: last modified + open button */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-xs text-[var(--text-tertiary)]">
            {formatRelativeTime(project.updatedAt)}
          </span>
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(project.id)
            }}
            className="h-7 gap-1 bg-[var(--accent-primary)] px-3 text-xs font-medium text-white hover:bg-[var(--accent-hover)] active:scale-95"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}