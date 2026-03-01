// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Services and types
import {
  generateErrorIdentifyPrompt,
  generateErrorReplacePrompt,
} from '@/services/promptGenerator'
import type { ApiResponse } from '@/types'

interface GenerateErrorPromptsBody {
  errorOutput: string
  errorType: string
  projectId: string
}

interface GenerateErrorPromptsResponse {
  identifyPrompt: string
  replacePrompt: string
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<GenerateErrorPromptsResponse>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as GenerateErrorPromptsBody
    const { errorOutput, errorType, projectId } = body

    if (!errorOutput || typeof errorOutput !== 'string' || errorOutput.trim().length < 10) {
      return NextResponse.json(
        { error: 'Validation failed', details: 'errorOutput must be at least 10 characters' },
        { status: 400 }
      )
    }

    if (!errorType || typeof errorType !== 'string') {
      return NextResponse.json(
        { error: 'Validation failed', details: 'errorType is required' },
        { status: 400 }
      )
    }

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        { error: 'Validation failed', details: 'projectId is required' },
        { status: 400 }
      )
    }

    // Verify project ownership
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

    // Fetch document rawContent for context — section summaries help Claude pinpoint files
    const document = await prisma.projectDocument.findUnique({
      where: { projectId },
      select: { rawContent: true },
    })

    const documentSummary = document?.rawContent ?? ''

    // Generate both prompts in parallel for performance
    const [identifyPrompt, replacePrompt] = await Promise.all([
      generateErrorIdentifyPrompt(errorOutput, errorType),
      generateErrorReplacePrompt(errorOutput, []),
    ])

    return NextResponse.json({
      data: { identifyPrompt, replacePrompt },
    })
  } catch (error) {
    console.error('[POST /api/ai/generate-error-prompts]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}