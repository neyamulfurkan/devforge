// 1. React imports
import { useCallback } from 'react'

// 3. Third-party library imports
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// 6. Internal imports — types
import type { UserSettings, PromptTemplate } from '@/types'
import type {
  AppearanceSettingsInput,
  AIIntegrationSettingsInput,
} from '@/validations/settings'

// 7. Local types
interface SettingsQueryData {
  settings: UserSettings | null
}

interface TemplatesQueryData {
  templates: PromptTemplate[]
}

interface TestGroqResult {
  connected: boolean
  error?: string
}

interface UseSettingsReturn {
  settings: UserSettings | null
  templates: PromptTemplate[]
  isLoading: boolean
  isTemplatesLoading: boolean
  updateAppearance: (data: AppearanceSettingsInput) => Promise<void>
  updateAIIntegration: (data: AIIntegrationSettingsInput) => Promise<void>
  updateTemplate: (templateId: string, content: string) => Promise<void>
  resetTemplate: (templateId: string) => Promise<void>
  testGroqKey: (apiKey: string) => Promise<TestGroqResult>
  exportData: () => Promise<void>
}

// Helper: apply appearance settings to CSS custom properties immediately in the browser
function applyAppearanceToCssVars(data: AppearanceSettingsInput): void {
  const root = document.documentElement

  // Accent color and derived opacity variants
  root.style.setProperty('--accent-primary', data.accentColor)
  root.style.setProperty('--accent-hover', data.accentColor)
  root.style.setProperty('--accent-light', `${data.accentColor}1f`) // ~12% opacity
  root.style.setProperty('--accent-border', `${data.accentColor}4d`) // ~30% opacity
  root.style.setProperty('--shadow-glow', `0 0 20px ${data.accentColor}33`)

  // Sidebar background
  root.style.setProperty('--bg-secondary', data.sidebarColor)

  // Theme class on <html>
  if (data.theme === 'dark') {
    root.classList.remove('light')
    root.classList.add('dark')
  } else if (data.theme === 'light') {
    root.classList.remove('dark')
    root.classList.add('light')
  } else {
    // 'system': defer to prefers-color-scheme
    root.classList.remove('dark', 'light')
  }

  // Font family CSS variable (consumed by Tailwind font-sans token)
  root.style.setProperty('--font-sans', data.fontFamily)
}

// 8. Hook definition
export function useSettings(): UseSettingsReturn {
  const queryClient = useQueryClient()

  // Settings query — session-level cache (staleTime: Infinity)
  const { data: settingsData, isLoading: isSettingsLoading } =
    useQuery<SettingsQueryData>({
      queryKey: ['settings'],
      queryFn: async () => {
        const res = await fetch('/api/settings')
        if (!res.ok) throw new Error('Failed to fetch settings')
        const json = await res.json()
        return { settings: (json.data as UserSettings) ?? null }
      },
      staleTime: Infinity,
    })

  // Templates query — session-level cache
  const { data: templatesData, isLoading: isTemplatesLoading } =
    useQuery<TemplatesQueryData>({
      queryKey: ['settings-templates'],
      queryFn: async () => {
        const res = await fetch('/api/settings/templates')
        if (!res.ok) throw new Error('Failed to fetch templates')
        const json = await res.json()
        const raw = json.data?.templates ?? json.templates ?? []
        return { templates: Array.isArray(raw) ? raw : [] }
      },
      staleTime: Infinity,
    })

  // updateAppearance: PATCH /api/settings + real-time CSS var application via onMutate
  const updateAppearanceMutation = useMutation({
    mutationFn: async (data: AppearanceSettingsInput) => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: 'appearance', data }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to update appearance settings')
      }
      return res.json()
    },
    onMutate: (data) => {
      // Apply CSS changes immediately — no need to wait for server confirmation
      if (typeof window !== 'undefined') {
        applyAppearanceToCssVars(data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  // updateAIIntegration: PATCH /api/settings
  const updateAIIntegrationMutation = useMutation({
    mutationFn: async (data: AIIntegrationSettingsInput) => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab: 'ai_integration', data }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to update AI integration settings')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  // updateTemplate: PATCH /api/settings/templates/[templateId]
  const updateTemplateMutation = useMutation({
    mutationFn: async ({
      templateId,
      content,
    }: {
      templateId: string
      content: string
    }) => {
      const res = await fetch(`/api/settings/templates/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to update template')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-templates'] })
    },
  })

  // resetTemplate: POST /api/settings/templates/[templateId] with { action: 'reset' }
  const resetTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/settings/templates/${templateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error((json.error as string) ?? 'Failed to reset template')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-templates'] })
    },
  })

  // Stable callback wrappers
  const updateAppearance = useCallback(
    async (data: AppearanceSettingsInput): Promise<void> => {
      await updateAppearanceMutation.mutateAsync(data)
    },
    [updateAppearanceMutation]
  )

  const updateAIIntegration = useCallback(
    async (data: AIIntegrationSettingsInput): Promise<void> => {
      await updateAIIntegrationMutation.mutateAsync(data)
    },
    [updateAIIntegrationMutation]
  )

  const updateTemplate = useCallback(
    async (templateId: string, content: string): Promise<void> => {
      await updateTemplateMutation.mutateAsync({ templateId, content })
    },
    [updateTemplateMutation]
  )

  const resetTemplate = useCallback(
    async (templateId: string): Promise<void> => {
      await resetTemplateMutation.mutateAsync(templateId)
    },
    [resetTemplateMutation]
  )

  // testGroqKey — never throws, returns { connected: false, error } on any failure
  const testGroqKey = useCallback(
    async (apiKey: string): Promise<TestGroqResult> => {
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test_groq', apiKey }),
        })
        const json = await res.json()
        if (!res.ok) {
          return {
            connected: false,
            error: (json.error as string) ?? 'Connection test failed',
          }
        }
        return json.data as TestGroqResult
      } catch {
        return { connected: false, error: 'Network error — could not reach server' }
      }
    },
    []
  )

  // exportData: triggers browser download of full data JSON export
  const exportData = useCallback(async (): Promise<void> => {
    const res = await fetch('/api/settings?action=export')
    if (!res.ok) throw new Error('Failed to export data')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().split('T')[0]
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `devforge-export-${date}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [])

  return {
    settings: settingsData?.settings ?? null,
    templates: templatesData?.templates ?? [],
    isLoading: isSettingsLoading,
    isTemplatesLoading,
    updateAppearance,
    updateAIIntegration,
    updateTemplate,
    resetTemplate,
    testGroqKey,
    exportData,
  }
}