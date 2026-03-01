// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Validation
import { addErrorSessionSchema } from '@/validations/error'
import { z } from 'zod'

// 5. Services and types
import {
  generateErrorIdentifyPrompt,
  generateErrorReplacePrompt,
} from '@/services/promptGenerator'
import type { ApiResponse } from '@/types'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sessions = await prisma.errorSession.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: sessions })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/errors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params

    // Verify ownership and fetch document for prompt generation context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        document: {
          select: { rawContent: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await request.json()
    const validated = addErrorSessionSchema.parse(body)

    const documentContent = project.document?.rawContent ?? ''

    // Generate both prompts — these never throw (promptGenerator handles fallbacks)
    const [identifyPrompt, replacePrompt] = await Promise.all([
      generateErrorIdentifyPrompt(
        validated.errorOutput,
        validated.errorType,
        documentContent
      ),
      generateErrorReplacePrompt(validated.errorOutput, []),
    ])

    const errorSession = await prisma.errorSession.create({
      data: {
        projectId,
        errorType: validated.errorType,
        errorOutput: validated.errorOutput,
        identifyPrompt,
        replacePrompt,
      },
    })

    return NextResponse.json({ data: errorSession }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/projects/[projectId]/errors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}