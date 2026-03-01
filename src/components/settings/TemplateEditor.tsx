'use client'

// 1. React imports
import { useState, useCallback, useEffect } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import { Copy, RotateCcw, Eye, Save, X } from 'lucide-react'

// 3. Internal imports — UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { InlineSpinner } from '@/components/shared/LoadingSpinner'
import { ConfirmModal } from '@/components/shared/ConfirmModal'

// 5. Internal imports — feature components
import { TemplateVariables } from '@/components/settings/TemplateVariables'

// 6. Internal imports — services, hooks, utils, types
import { substituteVariables } from '@/lib/templateUtils'
import { TEMPLATE_VARIABLES, type DefaultTemplateKey } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { PromptTemplate, TemplateVariable } from '@/types'

// 7. Local types
interface TemplateEditorProps {
  template: PromptTemplate
  onSave: (content: string) => void
  onClose: () => void
}

// Build sample substitution map from a template key's variable examples
function buildSampleVars(key: string): Record<string, string> {
  const vars = TEMPLATE_VARIABLES[key as DefaultTemplateKey] ?? []
  const result: Record<string, string> = {}
  for (const v of vars as TemplateVariable[]) {
    result[v.name] = v.example
  }
  return result
}

// 8. Component definition
export function TemplateEditor({
  template,
  onSave,
  onClose,
}: TemplateEditorProps): JSX.Element {
  // 8a. State hooks
  const [content, setContent] = useState(template.content)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // 8b. Sync content if template changes externally
  useEffect(() => {
    setContent(template.content)
    setIsDirty(false)
  }, [template.id])

  // 8c. Event handlers
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      setContent(e.target.value)
      setIsDirty(true)
    },
    []
  )

  const handlePreview = useCallback((): void => {
    const sampleVars = buildSampleVars(template.key)
    const rendered = substituteVariables(content, sampleVars)
    setPreviewContent(rendered)
    setShowPreview(true)
  }, [content, template.key])

  const handleSave = useCallback(async (): Promise<void> => {
    setIsSaving(true)
    try {
      await onSave(content)
      toast.success('Template saved successfully')
      setIsDirty(false)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save template'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }, [content, onSave, onClose])

  const handleReset = useCallback(async (): Promise<void> => {
    // Reset to the default content that was originally provided in template.content
    // The parent (SettingsPage) handles the actual DB reset call before re-opening the editor
    // Here, we just revert local edits back to template.content from props
    setContent(template.content)
    setIsDirty(false)
    setShowResetConfirm(false)
    toast.success('Template reset to default')
  }, [template.content])

  const handleClose = useCallback((): void => {
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }, [isDirty, onClose])

  const hasVariables =
    (TEMPLATE_VARIABLES[template.key as DefaultTemplateKey]?.length ?? 0) > 0

  // 8f. JSX return
  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent
          className={cn(
            'max-w-5xl h-[90vh] flex flex-col gap-0 p-0',
            'border-[var(--border-default)] bg-[var(--bg-tertiary)]',
            'text-[var(--text-primary)]'
          )}
        >
          {/* Header */}
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold text-[var(--text-primary)] truncate">
                  {template.name}
                </DialogTitle>
                {template.description && (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)] leading-relaxed line-clamp-1">
                    {template.description}
                  </p>
                )}
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <CopyButton value={content} size="sm" label="Copy" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetConfirm(true)}
                  className={cn(
                    'gap-1.5 text-xs text-[var(--text-secondary)]',
                    'hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Default
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePreview}
                  className={cn(
                    'gap-1.5 text-xs text-[var(--text-secondary)]',
                    'hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
                  )}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Body — two-column layout */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left — template editor (60%) */}
            <div className="flex flex-col flex-[3] min-w-0 border-r border-[var(--border-subtle)]">
              {/* Editor label */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  Template Content
                </span>
                {isDirty && (
                  <span className="text-xs text-[var(--status-in-progress)]">
                    Unsaved changes
                  </span>
                )}
              </div>

              {/* Textarea */}
              <textarea
                value={content}
                onChange={handleContentChange}
                spellCheck={false}
                className={cn(
                  'flex-1 w-full resize-none p-4',
                  'bg-[var(--bg-tertiary)] text-[var(--text-primary)]',
                  'font-mono text-sm leading-relaxed',
                  'placeholder:text-[var(--text-tertiary)]',
                  'focus:outline-none',
                  'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--border-emphasis)]'
                )}
                placeholder="Enter template content..."
                aria-label="Template content editor"
              />
            </div>

            {/* Right — variables panel (40%) */}
            {hasVariables && (
              <div className="flex-[2] min-w-0 overflow-hidden flex flex-col">
                <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                  <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    Available Variables
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <TemplateVariables templateKey={template.key} />
                </div>
              </div>
            )}

            {/* No variables fallback */}
            {!hasVariables && (
              <div className="flex-[2] flex items-center justify-center p-8">
                <p className="text-sm text-[var(--text-tertiary)] text-center">
                  No variables available for this template.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between w-full">
              <p className="text-xs text-[var(--text-tertiary)]">
                Use <code className="font-mono text-[var(--accent-primary)] bg-[var(--accent-light)] px-1 py-0.5 rounded">{'{{VARIABLE_NAME}}'}</code> syntax to insert dynamic values
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSaving}
                  className={cn(
                    'border-[var(--border-default)] bg-transparent',
                    'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    'hover:border-[var(--border-emphasis)]'
                  )}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                  className={cn(
                    'gap-2 bg-[var(--accent-primary)] text-white min-w-[120px]',
                    'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150',
                    'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
                  )}
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <InlineSpinner />
                      Saving…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Save Template
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent
          className={cn(
            'max-w-3xl h-[80vh] flex flex-col gap-0 p-0',
            'border-[var(--border-default)] bg-[var(--bg-tertiary)]'
          )}
        >
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-semibold text-[var(--text-primary)]">
                Preview with Sample Data
              </DialogTitle>
              <div className="flex items-center gap-2">
                <CopyButton value={previewContent} size="sm" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <textarea
              readOnly
              value={previewContent}
              className={cn(
                'w-full h-full min-h-[300px] resize-none p-3 rounded-lg',
                'bg-[var(--bg-secondary)] border border-[var(--border-default)]',
                'font-mono text-sm leading-relaxed text-[var(--text-primary)]',
                'focus:outline-none'
              )}
            />
          </div>

          <DialogFooter className="flex-shrink-0 px-6 py-3 border-t border-[var(--border-subtle)]">
            <p className="text-xs text-[var(--text-tertiary)]">
              Variables replaced with example values from the variables panel
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <ConfirmModal
        open={showResetConfirm}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
        title="Reset to Default"
        description="This will discard your current edits and restore the original default template content. This action cannot be undone."
        confirmLabel="Reset"
        confirmVariant="destructive"
      />

      {/* Discard changes confirmation */}
      <ConfirmModal
        open={showDiscardConfirm}
        onConfirm={() => { setShowDiscardConfirm(false); onClose() }}
        onCancel={() => setShowDiscardConfirm(false)}
        title="Discard Changes?"
        description="You have unsaved changes. Are you sure you want to close without saving?"
        confirmLabel="Discard"
        confirmVariant="destructive"
      />
    </>
  )
}

export default TemplateEditor