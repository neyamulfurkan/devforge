'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import {
  ChevronRight,
  ChevronLeft,
  Zap,
  AlertCircle,
  CheckSquare,
  Square,
  FileCode,
  FilePlus,
  FileEdit,
  BookOpen,
} from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

// 5. Internal imports — services, hooks, types
import { generateFeatureDeltaPrompt } from '@/services/promptGenerator'
import { useDocument } from '@/hooks/useDocument'
import { useProject } from '@/hooks/useProject'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'
import type { DeltaResult } from '@/types'

// 6. Local types
interface NewFeatureFlowProps {
  projectId: string
  onComplete: () => void
}

type Step = 1 | 2 | 3

interface NewFileSelection {
  filePath: string
  purpose: string
  phase: number
  phaseName: string
  selected: boolean
}

interface ModifiedFileSelection {
  filePath: string
  changeDescription: string
  changes: Array<{ findLine: string; replaceLine: string }>
  selected: boolean
}

// ─── Step indicator ──────────────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: Step
}

function StepIndicator({ currentStep }: StepIndicatorProps): JSX.Element {
  const steps = [
    { num: 1, label: 'Describe' },
    { num: 2, label: 'Generate' },
    { num: 3, label: 'Review' },
  ]

  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center">
          {/* Step circle */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200',
                currentStep === step.num
                  ? 'bg-[var(--accent-primary)] text-white shadow-[var(--shadow-glow)]'
                  : currentStep > step.num
                    ? 'bg-[var(--status-complete)] text-white'
                    : 'bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] border border-[var(--border-default)]'
              )}
            >
              {currentStep > step.num ? '✓' : step.num}
            </div>
            <span
              className={cn(
                'text-[10px] font-medium hidden sm:block',
                currentStep === step.num
                  ? 'text-[var(--accent-primary)]'
                  : currentStep > step.num
                    ? 'text-[var(--status-complete)]'
                    : 'text-[var(--text-tertiary)]'
              )}
            >
              {step.label}
            </span>
          </div>
          {/* Connector line */}
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'h-px w-12 sm:w-20 mx-1 transition-colors duration-200',
                currentStep > step.num
                  ? 'bg-[var(--status-complete)]'
                  : 'bg-[var(--border-default)]'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function NewFeatureFlow({ projectId, onComplete }: NewFeatureFlowProps): JSX.Element {
  // Step state
  const [step, setStep] = useState<Step>(1)

  // Step 1 state
  const [description, setDescription] = useState('')
  const [useAI, setUseAI] = useState(false)
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhancedDescription, setEnhancedDescription] = useState<string | null>(null)

  // Step 2 state
  const [deltaPrompt, setDeltaPrompt] = useState('')
  const [deltaJson, setDeltaJson] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false)

  // Step 3 state
  const [parsedDelta, setParsedDelta] = useState<DeltaResult | null>(null)
  const [newFileSelections, setNewFileSelections] = useState<NewFileSelection[]>([])
  const [modifiedFileSelections, setModifiedFileSelections] = useState<ModifiedFileSelection[]>([])
  const [isApplying, setIsApplying] = useState(false)

  // Hooks
  const { document: doc } = useDocument(projectId)
  const { project } = useProject(projectId)
  const { settings } = useSettings()

  const hasGroqKey = Boolean(settings?.groqApiKey)
  const wordCount = description.trim().split(/\s+/).filter(Boolean).length

  // ── Step 1: Enhance description ──────────────────────────────────────────
  const handleNext1 = useCallback(async () => {
    if (wordCount < 10) return

    const finalDescription = description.trim()
    let resolvedDescription: string | null = enhancedDescription  // may already be set

    if (useAI && hasGroqKey) {
      setIsEnhancing(true)
      try {
        const res = await fetch('/api/ai/enhance-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: finalDescription, type: 'feature' }),
        })
        const json = await res.json()
        if (json.data?.enhanced && !json.data?.fallback) {
          const enhanced = json.data.enhanced as string
          setEnhancedDescription(enhanced)
          resolvedDescription = enhanced  // ← capture before state flush
        } else {
          if (json.data?.fallback) {
            toast.warning('AI enhancement unavailable — using your description as-is', {
              duration: 4000,
            })
          }
          setEnhancedDescription(null)
        }
      } catch {
        toast.warning('AI enhancement unavailable — using your description as-is', {
          duration: 4000,
        })
        setEnhancedDescription(null)
      } finally {
        setIsEnhancing(false)
      }
    }

    // Generate the delta prompt
    setIsGeneratingPrompt(true)
    try {
      const descToUse = resolvedDescription ?? finalDescription
      const prompt = await generateFeatureDeltaPrompt({
        projectName: project?.name ?? '',
        featureDescription: descToUse,
        existingFeatures: '',
        fileRegistry: '',
        globalContextDocument: doc?.rawContent ?? '',
      })
      setDeltaPrompt(prompt)
      setStep(2)
    } catch {
      toast.error('Failed to generate feature prompt. Please try again.')
    } finally {
      setIsGeneratingPrompt(false)
    }
  }, [description, wordCount, useAI, hasGroqKey, enhancedDescription, doc])

  // ── Step 2: Parse delta JSON ──────────────────────────────────────────────
  const handleParseDelta = useCallback(() => {
    setParseError(null)

    const trimmed = deltaJson.trim()
    if (!trimmed) {
      setParseError('Please paste Claude\'s JSON delta response.')
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      setParseError('Invalid JSON — please check you pasted the complete JSON object.')
      return
    }

    // Validate shape matches DeltaResult
    if (typeof parsed !== 'object' || parsed === null) {
      setParseError('Expected a JSON object.')
      return
    }

    const delta = parsed as Record<string, unknown>

    if (typeof delta.featureTitle !== 'string') {
      setParseError('Missing required field: featureTitle')
      return
    }
    if (typeof delta.featureSummary !== 'string') {
      setParseError('Missing required field: featureSummary')
      return
    }
    if (!Array.isArray(delta.newFiles)) {
      setParseError('Missing required field: newFiles (must be an array)')
      return
    }
    if (!Array.isArray(delta.modifiedFiles)) {
      setParseError('Missing required field: modifiedFiles (must be an array)')
      return
    }
    if (!Array.isArray(delta.documentChanges)) {
      setParseError('Missing required field: documentChanges (must be an array)')
      return
    }

    const validated = delta as unknown as DeltaResult

    // Initialise selection state with all items selected by default
    setNewFileSelections(
      validated.newFiles.map((f) => ({ ...f, selected: true }))
    )
    setModifiedFileSelections(
      validated.modifiedFiles.map((f) => ({ ...f, selected: true }))
    )
    setParsedDelta(validated)
    setStep(3)
  }, [deltaJson])

  // ── Step 3: Apply changes ─────────────────────────────────────────────────
  const handleApply = useCallback(async () => {
    if (!parsedDelta) return

    const selectedNewFiles = newFileSelections.filter((f) => f.selected)
    const selectedModifiedFiles = modifiedFileSelections.filter((f) => f.selected)

    const payload = {
      description: description.trim(),
      enhancedDescription: enhancedDescription ?? undefined,
      deltaPrompt,
      deltaOutput: deltaJson,
      deltaParsed: {
        ...parsedDelta,
        newFiles: selectedNewFiles,
        modifiedFiles: selectedModifiedFiles,
      },
    }

    setIsApplying(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Failed to apply feature changes')
      }

      toast.success('Feature added successfully — Section 12 and file tracker updated.')
      onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply feature changes.')
    } finally {
      setIsApplying(false)
    }
  }, [parsedDelta, newFileSelections, modifiedFileSelections, description, enhancedDescription, deltaPrompt, deltaJson, projectId, onComplete])

  // ── Toggle helpers ────────────────────────────────────────────────────────
  const toggleNewFile = useCallback((idx: number) => {
    setNewFileSelections((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, selected: !f.selected } : f))
    )
  }, [])

  const toggleModifiedFile = useCallback((idx: number) => {
    setModifiedFileSelections((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, selected: !f.selected } : f))
    )
  }, [])

  const isLoading = isEnhancing || isGeneratingPrompt

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <StepIndicator currentStep={step} />

      {/* ── Step 1: Describe feature ── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <Label className="text-sm font-medium text-[var(--text-primary)] mb-1.5 block">
              Feature Description
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the new feature in plain language — what it does, how users interact with it, what data it needs, any edge cases to handle..."
              className={cn(
                'w-full min-h-[180px] resize-y rounded-md',
                'bg-[var(--bg-input)] border border-[var(--border-default)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                'text-sm leading-relaxed px-3 py-2.5',
                'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)]',
                'outline-none transition-colors duration-150',
                'font-[var(--font-mono,inherit)]'
              )}
              disabled={isLoading}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-[var(--text-tertiary)]">
                Minimum 10 words to continue
              </span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  wordCount >= 10 ? 'text-[var(--status-complete)]' : 'text-[var(--text-tertiary)]'
                )}
              >
                {wordCount} words
              </span>
            </div>
          </div>

          {/* AI Enhancement toggle */}
          {hasGroqKey && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
              <Zap className="h-4 w-4 text-[var(--accent-primary)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)]">AI Enhancement</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Groq will refine your description for completeness before generating the prompt
                </p>
              </div>
              <Switch
                checked={useAI}
                onCheckedChange={setUseAI}
                disabled={isLoading}
                aria-label="Enable AI enhancement"
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleNext1}
              disabled={wordCount < 10 || isLoading}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white gap-2"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  <span>{isEnhancing ? 'Enhancing…' : 'Generating Prompt…'}</span>
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Generated prompt + paste delta ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {/* Generated delta prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-sm font-medium text-[var(--text-primary)]">
                Feature Delta Prompt
              </Label>
              <CopyButton value={deltaPrompt} size="md" label="Copy Prompt" />
            </div>
            <div className="relative">
              <textarea
                readOnly
                value={deltaPrompt}
                className={cn(
                  'w-full min-h-[140px] max-h-[220px] resize-none rounded-md',
                  'bg-[var(--bg-secondary)] border border-[var(--border-subtle)]',
                  'text-[var(--text-secondary)] text-xs leading-relaxed px-3 py-2.5',
                  'font-mono outline-none overflow-y-auto'
                )}
              />
            </div>
            <ol className="mt-2 space-y-1">
              {[
                'Copy the prompt above',
                'Open Claude and paste it with your complete Global Context Document',
                'Claude will respond with a JSON delta object',
                'Paste the JSON delta below',
              ].map((instruction, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-tertiary)]">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)] flex items-center justify-center text-[10px] font-semibold mt-0.5">
                    {i + 1}
                  </span>
                  {instruction}
                </li>
              ))}
            </ol>
          </div>

          {/* Paste JSON delta */}
          <div>
            <Label className="text-sm font-medium text-[var(--text-primary)] mb-1.5 block">
              Paste Claude's JSON Delta Response
            </Label>
            <textarea
              value={deltaJson}
              onChange={(e) => {
                setDeltaJson(e.target.value)
                setParseError(null)
              }}
              placeholder={'{\n  "featureTitle": "...",\n  "featureSummary": "...",\n  "newFiles": [...],\n  "modifiedFiles": [...],\n  "documentChanges": [...]\n}'}
              className={cn(
                'w-full min-h-[160px] resize-y rounded-md font-mono',
                'bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                'text-xs leading-relaxed px-3 py-2.5 outline-none',
                'transition-colors duration-150',
                parseError
                  ? 'border border-[var(--status-error)] focus:ring-1 focus:ring-[var(--status-error)]'
                  : 'border border-[var(--border-default)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-light)]'
              )}
            />
            {parseError && (
              <div className="flex items-start gap-2 mt-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-[var(--status-error)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--status-error)]">{parseError}</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleParseDelta}
              disabled={!deltaJson.trim()}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white gap-2"
            >
              Parse Delta
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review & apply ── */}
      {step === 3 && parsedDelta && (
        <div className="flex flex-col gap-5">
          {/* Feature summary */}
          <div className="p-3 rounded-md bg-[var(--accent-light)] border border-[var(--accent-border)]">
            <p className="text-sm font-semibold text-[var(--accent-primary)] mb-0.5">
              {parsedDelta.featureTitle}
            </p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {parsedDelta.featureSummary}
            </p>
          </div>

          {/* New files */}
          {newFileSelections.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FilePlus className="h-4 w-4 text-[var(--status-complete)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  New Files
                </span>
                <Badge className="bg-[var(--status-complete-bg)] text-[var(--status-complete)] border-0 text-xs">
                  {newFileSelections.filter((f) => f.selected).length} selected
                </Badge>
              </div>
              <div className="space-y-1.5">
                {newFileSelections.map((file, idx) => (
                  <button
                    key={file.filePath}
                    type="button"
                    onClick={() => toggleNewFile(idx)}
                    className={cn(
                      'w-full flex items-start gap-3 p-2.5 rounded-md text-left',
                      'border transition-colors duration-150 cursor-pointer',
                      file.selected
                        ? 'bg-[var(--status-complete-bg)] border-[var(--status-complete)]/30'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] opacity-60'
                    )}
                  >
                    {file.selected ? (
                      <CheckSquare className="h-4 w-4 text-[var(--status-complete)] shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-4 w-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-[var(--text-primary)] truncate">
                        {file.filePath}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">
                        {file.purpose}
                      </p>
                    </div>
                    <Badge className="bg-[var(--bg-quaternary)] text-[var(--text-tertiary)] border-0 text-[10px] shrink-0">
                      Phase {file.phase}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modified files */}
          {modifiedFileSelections.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileEdit className="h-4 w-4 text-[var(--status-in-progress)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Files to Modify
                </span>
                <Badge className="bg-[var(--status-in-progress-bg)] text-[var(--status-in-progress)] border-0 text-xs">
                  {modifiedFileSelections.filter((f) => f.selected).length} selected
                </Badge>
              </div>
              <div className="space-y-1.5">
                {modifiedFileSelections.map((file, idx) => (
                  <button
                    key={file.filePath}
                    type="button"
                    onClick={() => toggleModifiedFile(idx)}
                    className={cn(
                      'w-full flex items-start gap-3 p-2.5 rounded-md text-left',
                      'border transition-colors duration-150 cursor-pointer',
                      file.selected
                        ? 'bg-[var(--status-in-progress-bg)] border-[var(--status-in-progress)]/30'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-subtle)] opacity-60'
                    )}
                  >
                    {file.selected ? (
                      <CheckSquare className="h-4 w-4 text-[var(--status-in-progress)] shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-4 w-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-[var(--text-primary)] truncate">
                        {file.filePath}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-1">
                        {file.changeDescription}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        {file.changes.length} {file.changes.length === 1 ? 'change' : 'changes'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Document changes */}
          {parsedDelta.documentChanges.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-[var(--accent-primary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Document Updates
                </span>
                <Badge className="bg-[var(--accent-light)] text-[var(--accent-primary)] border-0 text-xs">
                  {parsedDelta.documentChanges.length} sections
                </Badge>
              </div>
              <div className="space-y-1.5">
                {parsedDelta.documentChanges.map((change) => (
                  <div
                    key={change.sectionNumber}
                    className="flex items-start gap-3 p-2.5 rounded-md bg-[var(--accent-light)] border border-[var(--accent-border)]"
                  >
                    <FileCode className="h-4 w-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--accent-primary)]">
                        Section {change.sectionNumber}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {change.appendContent.slice(0, 120)}
                        {change.appendContent.length > 120 ? '…' : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              disabled={isApplying}
              className="border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleApply}
              disabled={isApplying || (newFileSelections.filter((f) => f.selected).length === 0 && modifiedFileSelections.filter((f) => f.selected).length === 0 && parsedDelta.documentChanges.length === 0)}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white gap-2"
            >
              {isApplying ? (
                <>
                  <LoadingSpinner />
                  Applying Changes…
                </>
              ) : (
                'Apply Selected Changes'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}