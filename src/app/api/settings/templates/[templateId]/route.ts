// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 4. Validation
import { z } from 'zod'
import { templateUpdateSchema } from '@/validations/settings'

// 5. Services and types
import { updateTemplate, resetToDefault, getTemplate } from '@/services/templateService'
import type { ApiResponse, PromptTemplate } from '@/types'

// ─── PATCH: Save user's custom content for a template ────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { templateId: string } }
): Promise<NextResponse<ApiResponse<PromptTemplate>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = templateUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }

    // templateId param is the template key string (e.g. 'global_context_generator')
    const templateKey = params.templateId

    const updated = await updateTemplate(templateKey, session.user.id, parsed.data.content)

    return NextResponse.json({ data: updated as unknown as PromptTemplate })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[PATCH /api/settings/templates/[templateId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST: Reset user's template override back to global default ──────────────

const postBodySchema = z.object({
  action: z.literal('reset'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
): Promise<NextResponse<ApiResponse<PromptTemplate>>> {
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

    const templateKey = params.templateId

    // Delete user's override — restores the global default
    await resetToDefault(templateKey, session.user.id)

    // Return the now-active default template
    const defaultTemplate = await getTemplate(templateKey)

    return NextResponse.json({ data: defaultTemplate as unknown as PromptTemplate })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/settings/templates/[templateId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}