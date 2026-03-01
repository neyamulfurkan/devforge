'use client'

// 1. React imports
import { useState, useRef, useCallback } from 'react'

// 2. Next.js imports
import Image from 'next/image'

// 3. Third-party library imports
import { toast } from 'sonner'
import { Camera, Loader2, Save, Eye, EyeOff, Check } from 'lucide-react'

// 4. Internal imports — UI components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// 5. Internal imports — settings components
import { AppearanceSettings } from '@/components/settings/AppearanceSettings'
import { AIIntegrationSettings } from '@/components/settings/AIIntegrationSettings'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { DataSettings } from '@/components/settings/DataSettings'
import { TemplateEditor } from '@/components/settings/TemplateEditor'

// 6. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 7. Internal imports — hooks, utils
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

// 8. Internal imports — types
import type { PromptTemplate } from '@/types'

// ─── PageContainer ────────────────────────────────────────────────────────────

function PageContainer({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {children}
    </div>
  )
}

// ─── AccountTab ───────────────────────────────────────────────────────────────

function AccountTab(): JSX.Element {
  const { user } = useAuth()

  // Profile fields
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Avatar upload
  const [avatarSrc, setAvatarSrc] = useState(user?.image ?? '')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (email?.[0] ?? '?').toUpperCase()

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const json = await res.json()
      setAvatarSrc((json.data as { url: string }).url)
      toast.success('Profile picture updated')
    } catch {
      toast.error('Failed to upload image')
    } finally {
      setIsUploadingAvatar(false)
    }
  }, [])

  const handleSaveProfile = useCallback(async (): Promise<void> => {
    setIsSavingProfile(true)
    try {
      const res = await fetch('/api/settings/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to save profile')
      }
      setProfileSaved(true)
      toast.success('Profile updated')
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setIsSavingProfile(false)
    }
  }, [name, email])

  const handleChangePassword = useCallback(async (): Promise<void> => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    setIsSavingPassword(true)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to change password')
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password changed successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setIsSavingPassword(false)
    }
  }, [currentPassword, newPassword, confirmPassword])

  return (
    <div className="flex flex-col gap-8">

      {/* ── Profile Picture ── */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Profile Picture</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Click the avatar to upload a new photo</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              className="h-[100px] w-[100px] cursor-pointer border-2 border-[var(--border-default)] hover:border-[var(--accent-primary)] transition-colors duration-150"
              onClick={() => fileInputRef.current?.click()}
            >
              <AvatarImage src={avatarSrc || undefined} alt={name} />
              <AvatarFallback className="bg-[var(--accent-light)] text-[var(--accent-primary)] text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Camera overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className={cn(
                'absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center',
                'rounded-full border-2 border-[var(--bg-primary)] bg-[var(--accent-primary)]',
                'text-white shadow-sm transition-all hover:scale-105',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
              aria-label="Change profile picture"
            >
              {isUploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              aria-label="Upload profile picture"
            />
          </div>

          <div className="text-xs text-[var(--text-tertiary)] space-y-1">
            <p>Recommended: square image, at least 200×200px</p>
            <p>Accepted formats: JPG, PNG, WebP (max 5 MB)</p>
          </div>
        </div>
      </section>

      {/* ── Profile Info ── */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Profile Information</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Update your name and email address</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name" className="text-sm font-medium text-[var(--text-secondary)]">
              Full Name
            </Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email" className="text-sm font-medium text-[var(--text-secondary)]">
              Email Address
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className={cn(
              'min-w-[140px] gap-2 bg-[var(--accent-primary)] text-white',
              'hover:bg-[var(--accent-hover)] active:scale-95 transition-all duration-150'
            )}
          >
            {isSavingProfile ? (
              <><InlineSpinner /> Saving…</>
            ) : profileSaved ? (
              <><Check className="h-4 w-4" /> Saved!</>
            ) : (
              <><Save className="h-4 w-4" /> Save Profile</>
            )}
          </Button>
        </div>
      </section>

      {/* ── Change Password ── */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Change Password</h3>
          <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">Leave blank if you signed in with Google</p>
        </div>

        <div className="flex flex-col gap-3 max-w-md">
          {/* Current password */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password" className="text-sm font-medium text-[var(--text-secondary)]">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-10 bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password" className="text-sm font-medium text-[var(--text-secondary)]">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
                className="pr-10 bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-[var(--text-secondary)]">
              Confirm New Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
              className="bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-[var(--accent-primary)]"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={isSavingPassword || !currentPassword || !newPassword || !confirmPassword}
              variant="outline"
              className={cn(
                'gap-2 border-[var(--border-default)] text-[var(--text-secondary)]',
                'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSavingPassword ? (
                <><InlineSpinner /> Changing…</>
              ) : (
                'Change Password'
              )}
            </Button>
          </div>
        </div>
      </section>

    </div>
  )
}

// ─── TemplatesTab ─────────────────────────────────────────────────────────────

function TemplatesTab(): JSX.Element {
  const { templates, isTemplatesLoading, updateTemplate, resetTemplate } = useSettings()
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)

  const handleSave = useCallback(async (content: string): Promise<void> => {
    if (!editingTemplate) return
    await updateTemplate(editingTemplate.id, content)
  }, [editingTemplate, updateTemplate])

  const handleClose = useCallback((): void => {
    setEditingTemplate(null)
  }, [])

  if (isTemplatesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent-primary)]" />
        <span className="ml-2 text-sm text-[var(--text-tertiary)]">Loading templates…</span>
      </div>
    )
  }

  if (!Array.isArray(templates) || templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">No templates found</p>
        <p className="text-xs text-[var(--text-tertiary)]">Templates will appear here once available.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {(Array.isArray(templates) ? templates : []).map((template) => (
          <div
            key={template.id}
            className={cn(
              'flex items-center justify-between rounded-xl border px-5 py-4',
              'border-[var(--border-subtle)] bg-[var(--bg-secondary)]',
              'hover:border-[var(--border-default)] transition-colors duration-150'
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{template.name}</p>
              {template.description && (
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)] line-clamp-1">{template.description}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingTemplate(template)}
              className={cn(
                'ml-4 shrink-0 border-[var(--border-default)] text-[var(--text-secondary)]',
                'hover:text-[var(--text-primary)] hover:border-[var(--border-emphasis)]'
              )}
            >
              Edit
            </Button>
          </div>
        ))}
      </div>

      {/* TemplateEditor Dialog */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────

const TABS = [
  { value: 'account', label: 'Account' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'ai', label: 'AI Integration' },
  { value: 'templates', label: 'Templates' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'data', label: 'Data' },
] as const

export default function SettingsPage(): JSX.Element {
  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Manage your account, appearance, integrations, and data.
        </p>
      </div>

      <Tabs defaultValue="account" className="flex flex-col gap-0">
        {/* Tab navigation */}
        <TabsList className={cn(
          'mb-6 flex h-auto w-full flex-wrap gap-1 rounded-xl p-1',
          'bg-[var(--bg-secondary)] border border-[var(--border-subtle)]'
        )}>
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150',
                'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                'data-[state=active]:bg-[var(--bg-primary)] data-[state=active]:text-[var(--text-primary)]',
                'data-[state=active]:shadow-sm'
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab content panels */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6">
          <TabsContent value="account" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <AccountTab />
          </TabsContent>

          <TabsContent value="appearance" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <AppearanceSettings />
          </TabsContent>

          <TabsContent value="ai" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <AIIntegrationSettings />
          </TabsContent>

          <TabsContent value="templates" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="data" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <DataSettings />
          </TabsContent>
        </div>
      </Tabs>
    </PageContainer>
  )
}