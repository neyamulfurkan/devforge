'use client'

// 1. React imports
import { useState, useEffect, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import { RotateCcw, Save, Check } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 4. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 5. Internal imports — hooks, constants, validation, utils
import { useSettings } from '@/hooks/useSettings'
import {
  FONT_FAMILIES,
  MONACO_THEMES,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_EDITOR_FONT_SIZE,
  DEFAULT_EDITOR_THEME,
} from '@/lib/constants'
import type { AppearanceSettingsInput } from '@/validations/settings'
import { cn } from '@/lib/utils'

// 6. Default values
const DEFAULTS: AppearanceSettingsInput = {
  theme: 'dark',
  accentColor: DEFAULT_ACCENT_COLOR,
  sidebarColor: '#111111',
  fontFamily: 'Inter',
  editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
  editorTheme: DEFAULT_EDITOR_THEME,
}

// 7. Theme option config
const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', description: 'Dark backgrounds, less eye strain at night' },
  { value: 'light', label: 'Light', description: 'Light backgrounds, great for bright environments' },
  { value: 'system', label: 'System', description: 'Follows your OS preference automatically' },
] as const

// 8. ColorPickerField sub-component
function ColorPickerField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}): JSX.Element {
  const [hex, setHex] = useState(value)

  // Keep local hex in sync when parent changes (e.g. reset)
  useEffect(() => {
    setHex(value)
  }, [value])

  const handleHexChange = (raw: string): void => {
    setHex(raw)
    const cleaned = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cleaned)) {
      onChange(cleaned)
    }
  }

  const handlePickerChange = (raw: string): void => {
    setHex(raw)
    onChange(raw)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-[var(--text-secondary)]">{label}</Label>
      <div className="flex items-center gap-2">
        {/* Native color picker */}
        <label
          className={cn(
            'relative h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md border',
            'border-[var(--border-default)] transition-colors hover:border-[var(--border-emphasis)]'
          )}
          style={{ backgroundColor: value }}
          aria-label={`Color picker for ${label}`}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => handlePickerChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        {/* Hex text input */}
        <Input
          value={hex}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#6366f1"
          maxLength={7}
          className={cn(
            'font-mono uppercase bg-[var(--bg-input)] border-[var(--border-default)]',
            'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
            'focus-visible:ring-[var(--accent-primary)]',
            error && 'border-[var(--status-error)]'
          )}
        />
      </div>
      {error && <p className="text-xs text-[var(--status-error)]">{error}</p>}
    </div>
  )
}

// 9. SliderField sub-component
function SliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}): JSX.Element {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-[var(--text-secondary)]">{label}</Label>
        <span
          className={cn(
            'min-w-[40px] rounded-md border border-[var(--border-default)]',
            'bg-[var(--bg-input)] px-2 py-0.5 text-center font-mono text-sm text-[var(--text-primary)]'
          )}
        >
          {value}px
        </span>
      </div>
      <div className="relative flex h-10 items-center">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-quaternary)]">
          <div
            className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
        {/* Thumb indicator */}
        <div
          className={cn(
            'pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full border-2',
            'border-[var(--accent-primary)] bg-white shadow-sm transition-all duration-100'
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// 10. SelectField sub-component
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-[var(--text-secondary)]">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 w-full rounded-md border px-3 py-2 text-sm appearance-none',
          'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
          'focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
          'transition-colors duration-150'
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--bg-secondary)]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// 11. Main component
export function AppearanceSettings(): JSX.Element {
  const { settings, isLoading, updateAppearance } = useSettings()
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Local form state — hydrated from settings on load
  const [form, setForm] = useState<AppearanceSettingsInput>(DEFAULTS)
  const [errors, setErrors] = useState<Partial<Record<keyof AppearanceSettingsInput, string>>>({})

  // Hydrate form from fetched settings
  useEffect(() => {
    if (!settings) return
    setForm({
      theme: (settings.theme as AppearanceSettingsInput['theme']) ?? DEFAULTS.theme,
      accentColor: settings.accentColor ?? DEFAULTS.accentColor,
      sidebarColor: settings.sidebarColor ?? DEFAULTS.sidebarColor,
      fontFamily: settings.fontFamily ?? DEFAULTS.fontFamily,
      editorFontSize: settings.editorFontSize ?? DEFAULTS.editorFontSize,
      editorTheme: settings.editorTheme ?? DEFAULTS.editorTheme,
    })
  }, [settings])

  // Apply changes to CSS in real-time on any form field change
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    root.style.setProperty('--accent-primary', form.accentColor)
    root.style.setProperty('--accent-hover', form.accentColor)
    root.style.setProperty('--accent-light', `${form.accentColor}1f`)
    root.style.setProperty('--accent-border', `${form.accentColor}4d`)
    root.style.setProperty('--shadow-glow', `0 0 20px ${form.accentColor}33`)
    root.style.setProperty('--bg-secondary', form.sidebarColor)
    root.style.setProperty('--font-sans', form.fontFamily)

    if (form.theme === 'dark') {
      root.classList.remove('light')
      root.classList.add('dark')
    } else if (form.theme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.classList.remove('dark', 'light')
    }
  }, [form])

  const validateHex = useCallback((val: string, field: keyof AppearanceSettingsInput): boolean => {
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
      setErrors((prev) => ({ ...prev, [field]: 'Must be a valid hex color (e.g. #6366f1)' }))
      return false
    }
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    return true
  }, [])

  const handleSave = useCallback(async () => {
    // Validate colors before saving
    const accentOk = validateHex(form.accentColor, 'accentColor')
    const sidebarOk = validateHex(form.sidebarColor, 'sidebarColor')
    if (!accentOk || !sidebarOk) return

    setIsSaving(true)
    try {
      await updateAppearance(form)
      setSaved(true)
      toast.success('Appearance settings saved')
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }, [form, updateAppearance, validateHex])

  const handleReset = useCallback(async () => {
    setForm(DEFAULTS)
    setErrors({})
    setIsSaving(true)
    try {
      await updateAppearance(DEFAULTS)
      toast.success('Appearance reset to defaults')
    } catch {
      toast.error('Failed to reset settings')
    } finally {
      setIsSaving(false)
    }
  }, [updateAppearance])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <InlineSpinner className="h-5 w-5" />
        <span className="ml-2 text-sm text-[var(--text-tertiary)]">Loading settings…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Theme */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Theme</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Choose your preferred color scheme</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, theme: opt.value }))}
              className={cn(
                'flex flex-col gap-1 rounded-xl border p-4 text-left transition-all duration-150',
                'hover:border-[var(--border-emphasis)]',
                form.theme === opt.value
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-light)] ring-1 ring-[var(--accent-primary)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{opt.label}</span>
                {form.theme === opt.value && (
                  <Check className="h-4 w-4 text-[var(--accent-primary)]" />
                )}
              </div>
              <span className="text-xs text-[var(--text-tertiary)]">{opt.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Colors */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Colors</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
            Changes apply instantly across the entire interface
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorPickerField
            label="Accent Color"
            value={form.accentColor}
            onChange={(v) => setForm((prev) => ({ ...prev, accentColor: v }))}
            error={errors.accentColor}
          />
          <ColorPickerField
            label="Sidebar Color"
            value={form.sidebarColor}
            onChange={(v) => setForm((prev) => ({ ...prev, sidebarColor: v }))}
            error={errors.sidebarColor}
          />
        </div>
      </section>

      {/* Typography */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Typography</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Interface and editor font preferences</p>
        </div>
        <SelectField
          label="Interface Font"
          value={form.fontFamily}
          options={FONT_FAMILIES}
          onChange={(v) => setForm((prev) => ({ ...prev, fontFamily: v }))}
        />
      </section>

      {/* Code Editor */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Code Editor</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Monaco editor appearance settings</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SliderField
            label="Editor Font Size"
            value={form.editorFontSize}
            min={10}
            max={20}
            onChange={(v) => setForm((prev) => ({ ...prev, editorFontSize: v }))}
          />
          <SelectField
            label="Editor Theme"
            value={form.editorTheme}
            options={MONACO_THEMES}
            onChange={(v) => setForm((prev) => ({ ...prev, editorTheme: v }))}
          />
        </div>

        {/* Editor preview strip */}
        <div
          className="rounded-lg border border-[var(--border-default)] p-4 font-mono"
          style={{ fontSize: `${form.editorFontSize}px`, background: '#1e1e1e' }}
          aria-hidden="true"
        >
          <div className="text-blue-400">{'import'} <span className="text-yellow-300">{'{ useState }'}</span> <span className="text-blue-400">from</span> <span className="text-green-300">{`'react'`}</span></div>
          <div className="mt-1 text-gray-300">
            <span className="text-blue-400">export function</span>{' '}
            <span className="text-yellow-300">Component</span>
            <span className="text-gray-400">{'() {'}</span>
          </div>
          <div className="ml-4 text-gray-400">
            {'// '}
            <span className="text-green-500">preview at {form.editorFontSize}px</span>
          </div>
          <div className="text-gray-400">{'}'}</div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isSaving}
          className={cn(
            'gap-2 border-[var(--border-default)] text-[var(--text-secondary)]',
            'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
          )}
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'min-w-[130px] gap-2 bg-[var(--accent-primary)] text-white',
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
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default AppearanceSettings