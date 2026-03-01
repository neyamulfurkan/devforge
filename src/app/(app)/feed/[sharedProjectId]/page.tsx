'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Next.js imports
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// 3. Third-party library imports
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  Copy,
  User,
  Loader2,
  AlertCircle,
  Layers,
} from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// 5. Internal imports — shared components
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import { CopyButton } from '@/components/shared/CopyButton'

// 6. Internal imports — utils
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharedSection {
  id: string
  title: string
  content: string
  order: number
}

interface SharedFilePrompt {
  id: string
  filePath: string
  prompt: string
}

interface SharedProjectData {
  id: string
  projectName: string
  description: string | null
  techStack: string[]
  demoUrl: string | null
  shareFilePrompts: boolean
  views: number
  copies: number
  author: {
    id: string
    name: string | null
    image: string | null
  }
  sections: SharedSection[]
  filePrompts: SharedFilePrompt[]
  rawContent: string
}

// ─── CollapsibleSection ───────────────────────────────────────────────────────

function CollapsibleSection({ section }: { section: SharedSection }): JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-5 py-3.5',
          'hover:bg-[var(--bg-quaternary)] transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
        )}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-[var(--text-primary)]">{section.title}</span>
        <div className="flex items-center gap-2">
          <CopyButton value={section.content} size="sm" />
          {open ? (
            <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4">
          <MarkdownRenderer content={section.content} enableCopyPerElement />
        </div>
      )}
    </div>
  )
}

// ─── FilePromptRow ────────────────────────────────────────────────────────────

function FilePromptRow({ prompt }: { prompt: SharedFilePrompt }): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3',
          'hover:bg-[var(--bg-quaternary)] transition-colors duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
        )}
      >
        <span className="font-mono text-xs text-[var(--accent-primary)] truncate max-w-[70%]">
          {prompt.filePath}
        </span>
        <div className="flex items-center gap-2">
          <CopyButton value={prompt.prompt} size="sm" />
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          <pre className="whitespace-pre-wrap text-xs text-[var(--text-secondary)] leading-relaxed font-mono">
            {prompt.prompt}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SharedProjectFeedPage(): JSX.Element {
  const { sharedProjectId } = useParams<{ sharedProjectId: string }>()
  const router = useRouter()
  const [isUsingAsTemplate, setIsUsingAsTemplate] = useState(false)

  // Fetch shared project data
  const { data, isLoading, isError } = useQuery<SharedProjectData>({
    queryKey: ['feed', sharedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/feed/${sharedProjectId}`)
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to load shared project')
      }
      const json = await res.json()
      return json.data as SharedProjectData
    },
    enabled: !!sharedProjectId,
    staleTime: 5 * 60 * 1000,
  })

  // Use as Template handler
  const handleUseAsTemplate = useCallback(async (): Promise<void> => {
    if (!data) return
    setIsUsingAsTemplate(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent: data.rawContent,
          name: `${data.projectName} (copy)`,
          fromSharedId: sharedProjectId,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to create project')
      }
      const json = await res.json()
      const newProjectId = (json.data as { id: string }).id
      toast.success('Project created from template!')
      router.push(`/projects/${newProjectId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to use as template'
      toast.error(message)
    } finally {
      setIsUsingAsTemplate(false)
    }
  }, [data, sharedProjectId, router])

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-primary)]" />
        <span className="ml-2 text-sm text-[var(--text-tertiary)]">Loading project…</span>
      </div>
    )
  }

  // ── Error state ──
  if (isError || !data) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-[var(--status-error)]" />
        <p className="text-sm font-medium text-[var(--text-primary)]">
          This shared project could not be found.
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          It may have been removed or the link is invalid.
        </p>
        <Button variant="outline" onClick={() => router.back()} className="mt-2">
          Go Back
        </Button>
      </div>
    )
  }

  const authorInitials = data.author.name
    ? data.author.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-8">

      {/* ── Project Header ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
              {data.projectName}
            </h1>
            {data.description && (
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                {data.description}
              </p>
            )}
          </div>

          {/* Demo link */}
          {data.demoUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className={cn(
                'shrink-0 gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)]',
                'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
              )}
            >
              <a href={data.demoUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Live Demo
              </a>
            </Button>
          )}
        </div>

        {/* Tech stack badges */}
        {data.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.techStack.map((tech) => (
              <Badge
                key={tech}
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-[var(--bg-quaternary)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
              >
                {tech}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {data.views.toLocaleString()} views
          </span>
          <span className="flex items-center gap-1">
            <Copy className="h-3.5 w-3.5" />
            {data.copies.toLocaleString()} copies
          </span>
        </div>
      </div>

      {/* ── Author Card ── */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-[var(--border-default)]">
            <AvatarImage src={data.author.image ?? undefined} alt={data.author.name ?? 'Author'} />
            <AvatarFallback className="bg-[var(--accent-light)] text-[var(--accent-primary)] text-sm font-semibold">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {data.author.name ?? 'Anonymous'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">Author</p>
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-1.5 border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <Link href={`/profile/${data.author.id}`}>
            <User className="h-3.5 w-3.5" />
            View Profile
          </Link>
        </Button>
      </div>

      {/* ── Sections ── */}
      {data.sections.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Sections</h2>
          <div className="flex flex-col gap-3">
            {data.sections
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((section) => (
                <CollapsibleSection key={section.id} section={section} />
              ))}
          </div>
        </section>
      )}

      {/* ── File Prompts ── */}
      {data.shareFilePrompts && data.filePrompts.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--text-secondary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">File Prompts</h2>
            <Badge variant="secondary" className="text-xs">
              {data.filePrompts.length}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {data.filePrompts.map((fp) => (
              <FilePromptRow key={fp.id} prompt={fp} />
            ))}
          </div>
        </section>
      )}

      {/* ── Use as Template CTA ── */}
      <div className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-[var(--accent-border)]',
        'bg-[var(--accent-light)] px-6 py-6 text-center'
      )}>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Want to build something similar?
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          Use this project as a starting template — all sections and prompts will be copied to a new project in your workspace.
        </p>
        <Button
          onClick={handleUseAsTemplate}
          disabled={isUsingAsTemplate}
          className={cn(
            'gap-2 bg-[var(--accent-primary)] text-white min-w-[180px]',
            'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150',
            'disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100'
          )}
        >
          {isUsingAsTemplate ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Project…
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Use as Template
            </>
          )}
        </Button>
      </div>

    </div>
  )
}