'use client'

// 1. React imports
import { useState, useEffect, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import { Globe, ImageIcon, Link, Clock, FileText, Share2, X } from 'lucide-react'

// 3. Internal imports — UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'

// 4. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 5. Internal imports — hooks, types, utils
import { useProject } from '@/hooks/useProject'
import { cn } from '@/lib/utils'
import type { Project, ParsedDocumentSection } from '@/types'

// 6. Local types
interface ShareProjectModalProps {
  open: boolean
  onClose: () => void
  projects: Project[]
}

interface SectionCheckItem {
  sectionNumber: string
  title: string
  checked: boolean
}

interface ShareFormState {
  projectId: string
  demoUrl: string
  buildTimeHours: string
  shareFilePrompts: boolean
  screenshotFile: File | null
  screenshotPreview: string | null
}

// 7. Helper — fetch document sections for a project
async function fetchProjectSections(projectId: string): Promise<ParsedDocumentSection[]> {
  const res = await fetch(`/api/projects/${projectId}/document/sections`)
  if (!res.ok) return []
  const json = (await res.json()) as { data?: ParsedDocumentSection[] }
  return json.data ?? []
}

// 8. Helper — upload screenshot and return URL
async function uploadScreenshot(file: File): Promise<string | null> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', 'assets')
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: { url: string } }
  return json.data?.url ?? null
}

// 9. SectionCheckRow sub-component
function SectionCheckRow({
  item,
  onToggle,
}: {
  item: SectionCheckItem
  onToggle: (sectionNumber: string) => void
}): JSX.Element {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5',
        'transition-all duration-150',
        item.checked
          ? 'border-[var(--accent-border)] bg-[var(--accent-light)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-default)]'
      )}
    >
      <Checkbox
        checked={item.checked}
        onCheckedChange={() => onToggle(item.sectionNumber)}
        className="shrink-0"
        aria-label={`Include section ${item.sectionNumber}`}
      />
      <div className="min-w-0 flex-1">
        <span className="mr-2 font-mono text-xs text-[var(--text-tertiary)]">
          §{item.sectionNumber}
        </span>
        <span className="text-sm text-[var(--text-primary)]">{item.title}</span>
      </div>
    </label>
  )
}

// 10. Component
export function ShareProjectModal({
  open,
  onClose,
  projects,
}: ShareProjectModalProps): JSX.Element {
  const [form, setForm] = useState<ShareFormState>({
    projectId: '',
    demoUrl: '',
    buildTimeHours: '',
    shareFilePrompts: false,
    screenshotFile: null,
    screenshotPreview: null,
  })
  const [sections, setSections] = useState<SectionCheckItem[]>([])
  const [isFetchingSections, setIsFetchingSections] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset fully when modal closes
  useEffect(() => {
    if (!open) {
      setForm({
        projectId: '',
        demoUrl: '',
        buildTimeHours: '',
        shareFilePrompts: false,
        screenshotFile: null,
        screenshotPreview: null,
      })
      setSections([])
    }
  }, [open])

  // When project changes, load its document sections
  useEffect(() => {
    if (!form.projectId) {
      setSections([])
      return
    }
    let cancelled = false
    setIsFetchingSections(true)
    fetchProjectSections(form.projectId).then((raw) => {
      if (cancelled) return
      // All sections checked by default, filter out append-only (11, 12, 13) since
      // those could be empty or sensitive — still include but pre-checked
      setSections(
        raw.map((s) => ({
          sectionNumber: s.sectionNumber,
          title: s.title,
          checked: true,
        }))
      )
      setIsFetchingSections(false)
    })
    return () => { cancelled = true }
  }, [form.projectId])

  const handleProjectChange = useCallback(
    (projectId: string) => {
      setForm((prev) => ({ ...prev, projectId }))
    },
    []
  )

  const handleToggleSection = useCallback((sectionNumber: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.sectionNumber === sectionNumber ? { ...s, checked: !s.checked } : s
      )
    )
  }, [])

  const handleSelectAll = useCallback(() => {
    setSections((prev) => prev.map((s) => ({ ...s, checked: true })))
  }, [])

  const handleDeselectAll = useCallback(() => {
    setSections((prev) => prev.map((s) => ({ ...s, checked: false })))
  }, [])

  const handleScreenshotChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Screenshot must be under 5MB')
        return
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Screenshot must be a JPEG, PNG, or WebP image')
        return
      }
      const preview = URL.createObjectURL(file)
      setForm((prev) => ({ ...prev, screenshotFile: file, screenshotPreview: preview }))
    },
    []
  )

  const clearScreenshot = useCallback(() => {
    if (form.screenshotPreview) {
      URL.revokeObjectURL(form.screenshotPreview)
    }
    setForm((prev) => ({ ...prev, screenshotFile: null, screenshotPreview: null }))
  }, [form.screenshotPreview])

  const handleSubmit = useCallback(async () => {
    if (!form.projectId) {
      toast.error('Please select a project to share')
      return
    }
    const checkedSections = sections.filter((s) => s.checked).map((s) => s.sectionNumber)
    if (checkedSections.length === 0) {
      toast.error('Please select at least one section to share')
      return
    }

    setIsSubmitting(true)
    try {
      // Upload screenshot if provided
      let screenshotUrl: string | null = null
      if (form.screenshotFile) {
        screenshotUrl = await uploadScreenshot(form.screenshotFile)
        if (!screenshotUrl) {
          toast.warning('Screenshot upload failed — sharing without image')
        }
      }

      const buildTimeHours = form.buildTimeHours
        ? parseInt(form.buildTimeHours, 10)
        : null

      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: form.projectId,
          screenshotUrl,
          demoUrl: form.demoUrl.trim() || null,
          buildTimeHours,
          sharedSections: checkedSections,
          shareFilePrompts: form.shareFilePrompts,
        }),
      })

      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Failed to share project')
      }

      toast.success('Project shared to the community feed!')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [form, sections, onClose])

  const selectedProject = projects.find((p) => p.id === form.projectId)
  const checkedCount = sections.filter((s) => s.checked).length

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className={cn(
          'max-w-2xl border-[var(--border-default)] bg-[var(--bg-tertiary)]',
          'text-[var(--text-primary)] max-h-[90vh] overflow-y-auto'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--text-primary)]">
            <Share2 className="h-5 w-5 text-[var(--accent-primary)]" />
            Share Project to Community Feed
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">

          {/* Project selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-[var(--text-secondary)]">
              Select Project <span className="text-[var(--status-error)]">*</span>
            </Label>
            <select
              value={form.projectId}
              onChange={(e) => handleProjectChange(e.target.value)}
              className={cn(
                'h-10 w-full rounded-md border px-3 py-2 text-sm appearance-none',
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
                'focus:ring-offset-2 focus:ring-offset-[var(--bg-tertiary)]',
                'transition-colors duration-150',
                !form.projectId && 'text-[var(--text-tertiary)]'
              )}
            >
              <option value="" className="bg-[var(--bg-secondary)]">Choose a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">
                  {p.name}
                </option>
              ))}
            </select>
            {selectedProject && (
              <p className="text-xs text-[var(--text-tertiary)]">
                {selectedProject.completedFiles} / {selectedProject.totalFiles} files complete
                {selectedProject.techStack.length > 0 && ` · ${selectedProject.techStack.slice(0, 3).join(', ')}`}
              </p>
            )}
          </div>

          {/* Document sections checklist */}
          {form.projectId && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-[var(--text-secondary)]">
                  Sections to Share
                  {sections.length > 0 && (
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">
                      ({checkedCount} of {sections.length} selected)
                    </span>
                  )}
                </Label>
                {sections.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs text-[var(--accent-primary)] hover:underline"
                    >
                      All
                    </button>
                    <span className="text-xs text-[var(--text-tertiary)]">·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:underline"
                    >
                      None
                    </button>
                  </div>
                )}
              </div>

              {isFetchingSections ? (
                <div className="flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-6">
                  <InlineSpinner className="mr-2" />
                  <span className="text-sm text-[var(--text-tertiary)]">Loading sections…</span>
                </div>
              ) : sections.length === 0 ? (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-4 text-center">
                  <p className="text-sm text-[var(--text-tertiary)]">No sections found in document</p>
                </div>
              ) : (
                <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
                  {sections.map((item) => (
                    <SectionCheckRow
                      key={item.sectionNumber}
                      item={item}
                      onToggle={handleToggleSection}
                    />
                  ))}
                </div>
              )}

              <p className="text-xs text-[var(--text-tertiary)]">
                Uncheck any sections you don't want to share publicly (e.g. sensitive API details, Section 10).
              </p>
            </div>
          )}

          {/* Screenshot upload */}
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
              <ImageIcon className="h-3.5 w-3.5" />
              Screenshot (optional)
            </Label>

            {form.screenshotPreview ? (
              <div className="relative w-full overflow-hidden rounded-lg border border-[var(--border-default)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.screenshotPreview}
                  alt="Screenshot preview"
                  className="h-32 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className={cn(
                    'absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full',
                    'bg-black/60 text-white hover:bg-black/80 transition-colors'
                  )}
                  aria-label="Remove screenshot"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed',
                  'border-[var(--border-default)] bg-[var(--bg-secondary)] py-6',
                  'hover:border-[var(--accent-border)] hover:bg-[var(--accent-light)]',
                  'transition-all duration-150'
                )}
              >
                <ImageIcon className="h-8 w-8 text-[var(--text-tertiary)]" />
                <div className="text-center">
                  <p className="text-sm text-[var(--text-secondary)]">Click to upload screenshot</p>
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">JPEG, PNG, WebP · Max 5MB</p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleScreenshotChange}
                />
              </label>
            )}
          </div>

          {/* Demo URL + Build time — side by side */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                <Link className="h-3.5 w-3.5" />
                Demo URL (optional)
              </Label>
              <Input
                type="url"
                placeholder="https://your-project.vercel.app"
                value={form.demoUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, demoUrl: e.target.value }))}
                className={cn(
                  'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                  'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]'
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                <Clock className="h-3.5 w-3.5" />
                Build Time (hours, optional)
              </Label>
              <Input
                type="number"
                placeholder="e.g. 48"
                min="1"
                max="9999"
                value={form.buildTimeHours}
                onChange={(e) => setForm((prev) => ({ ...prev, buildTimeHours: e.target.value }))}
                className={cn(
                  'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                  'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]'
                )}
              />
            </div>
          </div>

          {/* Share file prompts toggle */}
          <div
            className={cn(
              'flex items-center justify-between rounded-lg border px-4 py-3',
              'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
            )}
          >
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Share File-Specific Prompts</p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                  Expose the per-file prompts from Section 11 so others can regenerate files
                </p>
              </div>
            </div>
            <Switch
              checked={form.shareFilePrompts}
              onCheckedChange={(v) => setForm((prev) => ({ ...prev, shareFilePrompts: v }))}
              aria-label="Share file prompts"
            />
          </div>

          {/* Visibility notice */}
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
              'border-[var(--accent-border)] bg-[var(--accent-light)]'
            )}
          >
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              This project will be visible to everyone in the DevForge community feed. Only the sections
              you've checked above will be shared. You can remove it from your profile at any time.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !form.projectId || checkedCount === 0}
            onClick={handleSubmit}
            className={cn(
              'min-w-[110px] bg-[var(--accent-primary)] text-white',
              'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150'
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <InlineSpinner />
                Publishing…
              </span>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ShareProjectModal