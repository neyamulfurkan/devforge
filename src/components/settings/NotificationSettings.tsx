'use client'

// 1. React imports
import { useState, useEffect, useCallback } from 'react'

// 2. Third-party library imports
import { toast } from 'sonner'
import { Bell, Mail, Zap, AlertCircle, Users } from 'lucide-react'

// 3. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'

// 4. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 5. Internal imports — hooks, utils
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'

// 6. Local types
interface NotificationChannel {
  projectActivity: boolean
  errorAlerts: boolean
  communityInteractions: boolean
}

interface NotificationPrefs {
  email: NotificationChannel
  inApp: NotificationChannel
  frequency: 'realtime' | 'daily' | 'weekly'
}

const DEFAULT_PREFS: NotificationPrefs = {
  email: {
    projectActivity: true,
    errorAlerts: true,
    communityInteractions: false,
  },
  inApp: {
    projectActivity: true,
    errorAlerts: true,
    communityInteractions: true,
  },
  frequency: 'realtime',
}

// Notification toggle row
interface NotificationRowProps {
  icon: React.ElementType
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id: string
}

function NotificationRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  id,
}: NotificationRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--bg-quaternary)]">
          <Icon className="h-4 w-4 text-[var(--text-secondary)]" />
        </div>
        <div>
          <Label
            htmlFor={id}
            className="text-sm font-medium text-[var(--text-primary)] cursor-pointer"
          >
            {label}
          </Label>
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed mt-0.5">
            {description}
          </p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="ml-4 flex-shrink-0"
        aria-label={label}
      />
    </div>
  )
}

// Section header
interface SectionHeaderProps {
  icon: React.ElementType
  title: string
  description: string
}

function SectionHeader({ icon: Icon, title, description }: SectionHeaderProps): JSX.Element {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-light)] border border-[var(--accent-border)]">
        <Icon className="h-4.5 w-4.5 text-[var(--accent-primary)]" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
    </div>
  )
}

// 7. Component definition
export function NotificationSettings(): JSX.Element {
  // 8a. State hooks
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // 8b. External hooks
  const { settings } = useSettings()

  // 8c. Sync prefs from settings on load
  useEffect(() => {
    if (settings?.notificationPrefs) {
      const stored = settings.notificationPrefs as Partial<NotificationPrefs>
      setPrefs({
        email: { ...DEFAULT_PREFS.email, ...(stored.email ?? {}) },
        inApp: { ...DEFAULT_PREFS.inApp, ...(stored.inApp ?? {}) },
        frequency: stored.frequency ?? 'realtime',
      })
    }
  }, [settings?.notificationPrefs])

  // 8d. Event handlers
  const updateEmailPref = useCallback(
    (key: keyof NotificationChannel, value: boolean): void => {
      setPrefs((prev) => ({
        ...prev,
        email: { ...prev.email, [key]: value },
      }))
      setIsDirty(true)
    },
    []
  )

  const updateInAppPref = useCallback(
    (key: keyof NotificationChannel, value: boolean): void => {
      setPrefs((prev) => ({
        ...prev,
        inApp: { ...prev.inApp, [key]: value },
      }))
      setIsDirty(true)
    },
    []
  )

  const updateFrequency = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      setPrefs((prev) => ({
        ...prev,
        frequency: e.target.value as NotificationPrefs['frequency'],
      }))
      setIsDirty(true)
    },
    []
  )

  const handleSave = useCallback(async (): Promise<void> => {
    setIsSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'notifications', notificationPrefs: prefs }),
      })
      setIsDirty(false)
      toast.success('Notification preferences saved')
    } catch {
      toast.error('Failed to save notification preferences')
    } finally {
      setIsSaving(false)
    }
  }, [prefs])

  // 8f. JSX return
  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* Email Notifications */}
      <section
        className={cn(
          'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6'
        )}
      >
        <SectionHeader
          icon={Mail}
          title="Email Notifications"
          description="Receive notifications via email"
        />

        <div className="mt-4 flex flex-col divide-y divide-[var(--border-subtle)]">
          <NotificationRow
            id="email-project-activity"
            icon={Zap}
            label="Project Activity"
            description="File completions, document updates, and milestone progress"
            checked={prefs.email.projectActivity}
            onCheckedChange={(v) => updateEmailPref('projectActivity', v)}
          />
          <NotificationRow
            id="email-error-alerts"
            icon={AlertCircle}
            label="Error Alerts"
            description="When new error sessions are created or errors are resolved"
            checked={prefs.email.errorAlerts}
            onCheckedChange={(v) => updateEmailPref('errorAlerts', v)}
          />
          <NotificationRow
            id="email-community"
            icon={Users}
            label="Community Interactions"
            description="When someone copies your prompt or comments on your shared project"
            checked={prefs.email.communityInteractions}
            onCheckedChange={(v) => updateEmailPref('communityInteractions', v)}
          />
        </div>
      </section>

      {/* In-App Notifications */}
      <section
        className={cn(
          'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6'
        )}
      >
        <SectionHeader
          icon={Bell}
          title="In-App Notifications"
          description="Receive notifications within the DevForge interface"
        />

        <div className="mt-4 flex flex-col divide-y divide-[var(--border-subtle)]">
          <NotificationRow
            id="inapp-project-activity"
            icon={Zap}
            label="Project Activity"
            description="Real-time updates as files are generated and checked off"
            checked={prefs.inApp.projectActivity}
            onCheckedChange={(v) => updateInAppPref('projectActivity', v)}
          />
          <NotificationRow
            id="inapp-error-alerts"
            icon={AlertCircle}
            label="Error Alerts"
            description="Badge count on the Errors tab for unresolved sessions"
            checked={prefs.inApp.errorAlerts}
            onCheckedChange={(v) => updateInAppPref('errorAlerts', v)}
          />
          <NotificationRow
            id="inapp-community"
            icon={Users}
            label="Community Interactions"
            description="Copy counts and feedback on your library prompts and shared projects"
            checked={prefs.inApp.communityInteractions}
            onCheckedChange={(v) => updateInAppPref('communityInteractions', v)}
          />
        </div>
      </section>

      <Separator className="bg-[var(--border-subtle)]" />

      {/* Notification Frequency */}
      <section className="flex flex-col gap-3">
        <div>
          <Label className="text-sm font-semibold text-[var(--text-primary)]">
            Notification Frequency
          </Label>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            How often to send email digests (applies to email notifications only)
          </p>
        </div>

        <select
          value={prefs.frequency}
          onChange={updateFrequency}
          className={cn(
            'h-10 w-full max-w-xs rounded-md border px-3 py-2 text-sm appearance-none',
            'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]',
            'focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]',
            'transition-colors duration-150'
          )}
          aria-label="Notification frequency"
        >
          <option value="realtime" className="bg-[var(--bg-secondary)]">
            Realtime — send immediately
          </option>
          <option value="daily" className="bg-[var(--bg-secondary)]">
            Daily digest — once per day
          </option>
          <option value="weekly" className="bg-[var(--bg-secondary)]">
            Weekly digest — once per week
          </option>
        </select>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className={cn(
            'gap-2 bg-[var(--accent-primary)] text-white min-w-[160px]',
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
            'Save Preferences'
          )}
        </Button>

        {isDirty && (
          <span className="text-xs text-[var(--status-in-progress)]">
            You have unsaved changes
          </span>
        )}
      </div>
    </div>
  )
}

export default NotificationSettings