// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Validation
import { z } from 'zod'
import {
  appearanceSettingsSchema,
  aiIntegrationSettingsSchema,
  notificationPrefsSchema,
} from '@/validations/settings'

// 5. Services and types
import { testGroqConnection } from '@/services/groqService'
import type { ApiResponse } from '@/types'
import type { UserSettings } from '@/types'

// ─── GET: Fetch or create UserSettings for authenticated user ─────────────────

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<UserSettings>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })
    if (!userExists) {
      return NextResponse.json({ error: 'User not found. Please log in again.' }, { status: 404 })
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id },
    })

    return NextResponse.json({ data: settings as unknown as UserSettings })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[GET /api/settings]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ─── PATCH: Update settings by tab ───────────────────────────────────────────

const patchBodySchema = z.discriminatedUnion('tab', [
  z.object({ tab: z.literal('appearance'), data: appearanceSettingsSchema }),
  z.object({ tab: z.literal('ai_integration'), data: aiIntegrationSettingsSchema }),
  z.object({ tab: z.literal('notifications'), data: notificationPrefsSchema }),
])

export async function PATCH(
  request: NextRequest
): Promise<NextResponse<ApiResponse<UserSettings>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = patchBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { tab, data } = parsed.data

    let updateData: Record<string, unknown> = {}

    if (tab === 'appearance') {
      updateData = {
        theme: data.theme,
        accentColor: data.accentColor,
        sidebarColor: data.sidebarColor,
        fontFamily: data.fontFamily,
        editorFontSize: data.editorFontSize,
        editorTheme: data.editorTheme,
      }
    } else if (tab === 'ai_integration') {
      updateData = {}
      if (data.groqApiKey !== undefined) updateData.groqApiKey = data.groqApiKey || null
      if (data.groqDefaultModel !== undefined) updateData.groqDefaultModel = data.groqDefaultModel
      if (data.anthropicApiKey !== undefined) updateData.anthropicApiKey = data.anthropicApiKey || null
      if (data.customApiEndpoint !== undefined) updateData.customApiEndpoint = data.customApiEndpoint || null
      if (data.customApiKey !== undefined) updateData.customApiKey = data.customApiKey || null
      if (data.customApiModel !== undefined) updateData.customApiModel = data.customApiModel || null
    } else if (tab === 'notifications') {
      updateData = {
        notificationPrefs: data,
      }
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: { userId: session.user.id, ...updateData },
    })

    return NextResponse.json({ data: settings as unknown as UserSettings })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[PATCH /api/settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST: Actions (test_groq, export) ───────────────────────────────────────

const postBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('test_groq'),
    apiKey: z.string().optional(),
  }),
  z.object({
    action: z.literal('export'),
  }),
])

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = postBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }

    // ── test_groq ──
    if (parsed.data.action === 'test_groq') {
      const { apiKey } = parsed.data

      // Resolve API key: body → UserSettings → env
      let resolvedKey = apiKey
      if (!resolvedKey) {
        const settings = await prisma.userSettings.findUnique({
          where: { userId: session.user.id },
          select: { groqApiKey: true },
        })
        resolvedKey = settings?.groqApiKey ?? process.env.GROQ_API_KEY
      }

      if (!resolvedKey) {
        return NextResponse.json({
          data: { connected: false, error: 'No Groq API key configured.' },
        })
      }

      const result = await testGroqConnection(resolvedKey)
      return NextResponse.json({ data: result })
    }

    // ── export ──
    if (parsed.data.action === 'export') {
      const [projects, collections, settings] = await Promise.all([
        prisma.project.findMany({
          where: { userId: session.user.id },
          include: {
            document: { select: { rawContent: true } },
            files: { select: { filePath: true, status: true, filePrompt: true } },
          },
        }),
        prisma.collection.findMany({
          where: { userId: session.user.id },
          include: { prompts: true },
        }),
        prisma.userSettings.findUnique({
          where: { userId: session.user.id },
        }),
      ])

      const exportData = {
        exportedAt: new Date().toISOString(),
        userId: session.user.id,
        projects,
        collections,
        settings: settings
          ? { ...settings, groqApiKey: undefined, anthropicApiKey: undefined }
          : null,
      }

      return NextResponse.json({ data: exportData })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/settings]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}