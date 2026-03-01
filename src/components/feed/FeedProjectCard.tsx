'use client'

// 1. React imports
import { useState } from 'react'

// 2. Next.js imports
import Image from 'next/image'
import Link from 'next/link'

// 3. Third-party library imports
import { Clock, Copy, Eye, ExternalLink, Files } from 'lucide-react'

// 4. Internal imports — UI components
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// 5. Internal imports — utils, types, constants
import { formatRelativeTime, cn } from '@/lib/utils'
import { MAX_TECH_STACK_BADGES } from '@/lib/constants'
import type { SharedProjectWithAuthor } from '@/types'

// 6. Local types
interface FeedProjectCardProps {
  project: SharedProjectWithAuthor
}

// 7. Helper — format large counts
function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// 8. Author initials fallback
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// 9. Component
export function FeedProjectCard({ project }: FeedProjectCardProps): JSX.Element {
  const [imgError, setImgError] = useState(false)

  const visibleStack = project.project.techStack.slice(0, MAX_TECH_STACK_BADGES)
  const extraStack = project.project.techStack.length - MAX_TECH_STACK_BADGES

  return (
    <div
      className={cn(
        'group flex flex-col rounded-xl border bg-[var(--bg-tertiary)]',
        'border-[var(--border-subtle)] transition-all duration-150',
        'hover:border-[var(--accent-border)] hover:shadow-[var(--shadow-md)]'
      )}
    >
      {/* Screenshot / placeholder */}
      <div className="relative h-40 w-full overflow-hidden rounded-t-xl bg-[var(--bg-quaternary)]">
        {project.screenshotUrl && !imgError ? (
          <Image
            src={project.screenshotUrl}
            alt={`${project.project.name} screenshot`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-gradient-to-br from-[var(--accent-light)] to-[var(--bg-secondary)]'
            )}
          >
            <span className="text-3xl font-bold text-[var(--accent-primary)] opacity-30 select-none">
              {project.project.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Demo link badge — absolute top-right */}
        {project.demoUrl && (
          <a
            href={project.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'absolute right-2 top-2 flex items-center gap-1 rounded-md px-2 py-1',
              'bg-[var(--bg-primary)]/80 backdrop-blur-sm text-xs text-[var(--text-secondary)]',
              'border border-[var(--border-subtle)] hover:text-[var(--text-primary)]',
              'transition-colors duration-150'
            )}
            aria-label="Open live demo"
          >
            <ExternalLink className="h-3 w-3" />
            Demo
          </a>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-5">

        {/* Title */}
        <h3 className="text-[16px] font-semibold leading-snug text-[var(--text-primary)] line-clamp-1">
          {project.project.name}
        </h3>

        {/* Description — 3-line clamp */}
        <p className="text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-3">
          {project.project.description}
        </p>

        {/* Tech stack badges */}
        {project.project.techStack.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {visibleStack.map((tech) => (
              <Badge
                key={tech}
                variant="outline"
                className="text-xs text-[var(--text-secondary)] border-[var(--border-default)] bg-[var(--bg-secondary)]"
              >
                {tech}
              </Badge>
            ))}
            {extraStack > 0 && (
              <span className="text-xs text-[var(--text-tertiary)]">+{extraStack} more</span>
            )}
          </div>
        )}

        {/* Meta badges row */}
        <div className="flex flex-wrap items-center gap-2">
          {project.buildTimeHours != null && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3.5 w-3.5" />
              ~{project.buildTimeHours}h build
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
            <Files className="h-3.5 w-3.5" />
            {project.project.totalFiles} files
          </span>
        </div>

        {/* Author row */}
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-[var(--accent-light)]">
            {project.author.profileImageUrl ? (
              <Image
                src={project.author.profileImageUrl}
                alt={project.author.name}
                fill
                className="object-cover"
                sizes="28px"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-[var(--accent-primary)]">
                {getInitials(project.author.name)}
              </span>
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-secondary)]">
            {project.author.name}
          </span>
          <span className="flex-shrink-0 text-xs text-[var(--text-tertiary)]">
            {formatRelativeTime(project.createdAt)}
          </span>
        </div>

        {/* Stats + CTA row */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatCount(project.viewCount)}
            </span>
            <span className="flex items-center gap-1">
              <Copy className="h-3.5 w-3.5" />
              {formatCount(project.copyCount)}
            </span>
          </div>

          <Button
            asChild
            size="sm"
            className={cn(
              'bg-[var(--accent-primary)] text-white text-xs',
              'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150'
            )}
          >
            <Link href={`/feed/${project.id}`}>View Project</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FeedProjectCard