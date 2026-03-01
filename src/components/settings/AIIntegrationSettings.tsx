'use client'

// 1. React imports
import { useState, useEffect, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import {
  Eye,
  EyeOff,
  Save,
  Check,
  Wifi,
  WifiOff,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// 4. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 5. Internal imports — hooks, constants, utils, validation
import { useSettings } from '@/hooks/useSettings'
import { GROQ_MODELS } from '@/lib/constants'
import type { AIIntegrationSettingsInput } from '@/validations/settings'
import { cn } from '@/lib/utils'

// 6. Local types
type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'failed'

interface ProviderSectionProps {
  title: string
  badge?: string
  badgeVariant?: 'default' | 'secondary' | 'outline'
  description: string
  children: React.ReactNode
  defaultOpen?: boolean
  docUrl?: string
}

// 7. Masked key display helper — shows only last 4 chars
function maskApiKey(key: string): string {
  if (key.length <= 4) return '•'.repeat(key.length)
  return `${'•'.repeat(Math.min(key.length - 4, 20))}${key.slice(-4)}`
}

// 8. SecretInput sub-component — toggleable password/text input
function SecretInput({
  value,
  onChange,
  placeholder,
  id,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
  disabled?: boolean
}): JSX.Element {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'pr-10 font-mono text-sm',
          'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
          'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]'
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        className={cn(
          'absolute right-2.5 top-1/2 -translate-y-1/2',
          'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
          'transition-colors duration-150 focus:outline-none',
          'disabled:pointer-events-none disabled:opacity-50'
        )}
        aria-label={visible ? 'Hide key' : 'Reveal key'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

// 9. ConnectionBadge sub-component
function ConnectionBadge({ status }: { status: ConnectionStatus }): JSX.Element {
  if (status === 'idle') return <></>

  if (status === 'testing') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Testing…
      </span>
    )
  }

  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--status-success,#22c55e)]">
        <Wifi className="h-3.5 w-3.5" />
        Connected
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--status-error,#ef4444)]">
      <WifiOff className="h-3.5 w-3.5" />
      Failed
    </span>
  )
}

// 10. ProviderSection sub-component — collapsible card
function ProviderSection({
  title,
  badge,
  badgeVariant = 'secondary',
  description,
  children,
  defaultOpen = false,
  docUrl,
}: ProviderSectionProps): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        open
          ? 'border-[var(--border-emphasis)] bg-[var(--bg-secondary)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-default)]'
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3.5',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
          'rounded-xl'
        )}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
          {badge && (
            <Badge
              variant={badgeVariant}
              className="text-[10px] leading-none px-1.5 py-0.5"
            >
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex items-center gap-1 text-xs text-[var(--text-tertiary)]',
                'hover:text-[var(--accent-primary)] transition-colors duration-150'
              )}
            >
              Docs
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-[var(--border-subtle)] px-4 pb-4 pt-3.5">
          <p className="mb-4 text-xs leading-relaxed text-[var(--text-tertiary)]">{description}</p>
          {children}
        </div>
      )}
    </div>
  )
}

// 11. FormField helper sub-component
function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  )
}

// 12. Main component
export function AIIntegrationSettings(): JSX.Element {
  const { settings, isLoading, updateAIIntegration, testGroqKey } = useSettings()
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [groqTestStatus, setGroqTestStatus] = useState<ConnectionStatus>('idle')
  const [groqTestError, setGroqTestError] = useState<string | null>(null)

  // Local form state
  const [form, setForm] = useState<AIIntegrationSettingsInput>({
    groqApiKey: '',
    groqDefaultModel: 'llama3-70b-8192',
    anthropicApiKey: '',
    customApiEndpoint: '',
    customApiKey: '',
    customApiModel: '',
  })

  // Hydrate from fetched settings
  useEffect(() => {
    if (!settings) return
    setForm({
      groqApiKey: settings.groqApiKey ?? '',
      groqDefaultModel: settings.groqDefaultModel ?? 'llama3-70b-8192',
      anthropicApiKey: settings.anthropicApiKey ?? '',
      customApiEndpoint: settings.customApiEndpoint ?? '',
      customApiKey: settings.customApiKey ?? '',
      customApiModel: settings.customApiModel ?? '',
    })
  }, [settings])

  const setField = useCallback(
    <K extends keyof AIIntegrationSettingsInput>(field: K, value: AIIntegrationSettingsInput[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      // Reset Groq connection status if they change the key
      if (field === 'groqApiKey') {
        setGroqTestStatus('idle')
        setGroqTestError(null)
      }
    },
    []
  )

  const handleTestGroq = useCallback(async () => {
    if (!form.groqApiKey?.trim()) {
      toast.error('Enter a Groq API key before testing')
      return
    }
    setGroqTestStatus('testing')
    setGroqTestError(null)
    const result = await testGroqKey(form.groqApiKey.trim())
    if (result.connected) {
      setGroqTestStatus('connected')
    } else {
      setGroqTestStatus('failed')
      setGroqTestError(result.error ?? 'Connection test failed')
    }
  }, [form.groqApiKey, testGroqKey])

  const handleSave = useCallback(async () => {
    // Basic URL validation for custom endpoint
    if (form.customApiEndpoint && form.customApiEndpoint !== '') {
      try {
        new URL(form.customApiEndpoint)
      } catch {
        toast.error('Custom API endpoint must be a valid URL')
        return
      }
    }

    setIsSaving(true)
    try {
      await updateAIIntegration(form)
      setSaved(true)
      toast.success('AI integration settings saved')
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }, [form, updateAIIntegration])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <InlineSpinner className="h-5 w-5" />
        <span className="ml-2 text-sm text-[var(--text-tertiary)]">Loading settings…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Info banner */}
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
          'border-[var(--accent-border)] bg-[var(--accent-light)]'
        )}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          API keys are encrypted at rest and never sent to third parties. Keys stored here are used
          only for DevForge's AI-powered features such as prompt generation, error analysis, and
          feature delta suggestions.
        </p>
      </div>

      {/* ── Groq ── */}
      <ProviderSection
        title="Groq"
        badge="Primary"
        badgeVariant="default"
        description="Groq powers DevForge's core AI features including prompt generation and error resolution. Required for AI-assisted features to work."
        defaultOpen
        docUrl="https://console.groq.com/keys"
      >
        <div className="flex flex-col gap-4">
          {/* API Key */}
          <FormField label="API Key" htmlFor="groq-key">
            <div className="flex gap-2">
              <div className="flex-1">
                <SecretInput
                  id="groq-key"
                  value={form.groqApiKey ?? ''}
                  onChange={(v) => setField('groqApiKey', v)}
                  placeholder="gsk_…"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestGroq}
                disabled={groqTestStatus === 'testing' || !form.groqApiKey?.trim()}
                className={cn(
                  'shrink-0 border-[var(--border-default)] text-[var(--text-secondary)]',
                  'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]',
                  'min-w-[90px]'
                )}
              >
                {groqTestStatus === 'testing' ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Testing
                  </span>
                ) : (
                  'Test Key'
                )}
              </Button>
            </div>

            {/* Connection status line */}
            {groqTestStatus !== 'idle' && (
              <div className="mt-1.5 flex items-center gap-2">
                <ConnectionBadge status={groqTestStatus} />
                {groqTestError && (
                  <span className="text-xs text-[var(--status-error,#ef4444)]">
                    — {groqTestError}
                  </span>
                )}
              </div>
            )}

            {/* Masked current saved key */}
            {settings?.groqApiKey && (
              <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
                Saved: {maskApiKey(settings.groqApiKey)}
              </p>
            )}
          </FormField>

          {/* Default model */}
          <FormField
            label="Default Model"
            htmlFor="groq-model"
            hint="The model used for all AI-powered DevForge features unless overridden."
          >
            <select
              id="groq-model"
              value={form.groqDefaultModel ?? 'llama3-70b-8192'}
              onChange={(e) => setField('groqDefaultModel', e.target.value)}
              className={cn(
                'h-10 w-full rounded-md border px-3 py-2 text-sm appearance-none',
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
                'focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
                'transition-colors duration-150'
              )}
            >
              {GROQ_MODELS.map((m) => (
                <option key={m.value} value={m.value} className="bg-[var(--bg-secondary)]">
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </ProviderSection>

      {/* ── Anthropic ── */}
      <ProviderSection
        title="Anthropic"
        badge="Optional"
        badgeVariant="secondary"
        description="Connect your Anthropic API key to use Claude models as an alternative to Groq for prompt generation and document analysis."
        docUrl="https://console.anthropic.com/settings/keys"
      >
        <FormField
          label="API Key"
          htmlFor="anthropic-key"
          hint="Starts with sk-ant-…"
        >
          <SecretInput
            id="anthropic-key"
            value={form.anthropicApiKey ?? ''}
            onChange={(v) => setField('anthropicApiKey', v)}
            placeholder="sk-ant-…"
          />
          {settings?.anthropicApiKey && (
            <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">
              Saved: {maskApiKey(settings.anthropicApiKey)}
            </p>
          )}
        </FormField>
      </ProviderSection>

      {/* ── Custom API ── */}
      <ProviderSection
        title="Custom API Endpoint"
        badge="Advanced"
        badgeVariant="outline"
        description="Connect any OpenAI-compatible API endpoint. Useful for self-hosted models, LM Studio, Ollama, or other inference providers."
      >
        <div className="flex flex-col gap-4">
          <FormField
            label="Endpoint URL"
            htmlFor="custom-endpoint"
            hint="Must be an OpenAI-compatible /v1/chat/completions endpoint."
          >
            <Input
              id="custom-endpoint"
              type="url"
              value={form.customApiEndpoint ?? ''}
              onChange={(e) => setField('customApiEndpoint', e.target.value)}
              placeholder="https://your-server.com/v1"
              className={cn(
                'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]'
              )}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="API Key" htmlFor="custom-key">
              <SecretInput
                id="custom-key"
                value={form.customApiKey ?? ''}
                onChange={(v) => setField('customApiKey', v)}
                placeholder="Optional"
              />
            </FormField>

            <FormField
              label="Model Name"
              htmlFor="custom-model"
              hint="e.g. mistral-7b-instruct"
            >
              <Input
                id="custom-model"
                value={form.customApiModel ?? ''}
                onChange={(e) => setField('customApiModel', e.target.value)}
                placeholder="e.g. llama3"
                className={cn(
                  'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
                  'placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]'
                )}
              />
            </FormField>
          </div>
        </div>
      </ProviderSection>

      {/* Save action */}
      <div className="flex justify-end border-t border-[var(--border-subtle)] pt-5">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'min-w-[150px] gap-2 bg-[var(--accent-primary)] text-white',
            'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150'
          )}
        >
          {isSaving ? (
            <>
              <InlineSpinner />
              Saving…
            </>
          ) : saved ? (
            <>
              <Check className="h-4 w-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save AI Settings
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default AIIntegrationSettings