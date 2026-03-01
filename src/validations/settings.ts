import { z } from 'zod'

// ======================== APPEARANCE ========================

export const appearanceSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  accentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color (e.g. #6366f1)'),
  sidebarColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color'),
  fontFamily: z.string().min(1, 'Font family is required'),
  editorFontSize: z
    .number()
    .int()
    .min(10, 'Font size must be at least 10px')
    .max(20, 'Font size must be at most 20px'),
  editorTheme: z.string().min(1, 'Editor theme is required'),
})

export type AppearanceSettingsInput = z.infer<typeof appearanceSettingsSchema>

// ======================== AI INTEGRATION ========================

export const aiIntegrationSettingsSchema = z.object({
  groqApiKey: z.string().optional(),
  groqDefaultModel: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  customApiEndpoint: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),
  customApiKey: z.string().optional(),
  customApiModel: z.string().optional(),
})

export type AIIntegrationSettingsInput = z.infer<typeof aiIntegrationSettingsSchema>

// ======================== TEMPLATE ========================

export const templateUpdateSchema = z.object({
  content: z.string().min(1, 'Template content cannot be empty'),
})

export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>

// ======================== NOTIFICATIONS ========================

const notificationChannelSchema = z.object({
  projectActivity: z.boolean(),
  errorAlerts: z.boolean(),
  communityInteractions: z.boolean(),
})

export const notificationPrefsSchema = z.object({
  email: notificationChannelSchema,
  inApp: notificationChannelSchema,
  frequency: z.enum(['realtime', 'daily', 'weekly']),
})

export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>