// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Services and types
import { generateFeatureDeltaPrompt } from '@/services/promptGenerator'
import type { ApiResponse } from '@/types'

interface GenerateFeaturePromptBody {
  featureDescription: string
  projectId: string
}

interface GenerateFeaturePromptResponse {
  deltaPrompt: string
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<GenerateFeaturePromptResponse>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as GenerateFeaturePromptBody
    const { featureDescription, projectId } = body

    if (
      !featureDescription ||
      typeof featureDescription !== 'string' ||
      featureDescription.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Validation failed', details: 'featureDescription is required' },
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
      select: { userId: true, name: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch document rawContent — the full GCD is required context for the delta prompt
    const document = await prisma.projectDocument.findUnique({
      where: { projectId },
      select: { rawContent: true },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'No document found for this project' },
        { status: 404 }
      )
    }

    // Generate the feature delta prompt using the full document as context
    const deltaPrompt = await generateFeatureDeltaPrompt({
      projectName: projectId,
      featureDescription,
      existingFeatures: '',
      fileRegistry: '',
      globalContextDocument: document.rawContent,
    })

    return NextResponse.json({
      data: { deltaPrompt },
    })
  } catch (error) {
    console.error('[POST /api/ai/generate-feature-prompt]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}