// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { auth as getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Services and types
import { generateGlobalContextPrompt } from '@/services/promptGenerator'
import { enhanceProjectDescription } from '@/services/groqService'
import type { ApiResponse, ProjectConfig } from '@/types'

interface GenerateDocumentPromptBody {
  description: string
  config: ProjectConfig
  useAI?: boolean
}

interface GenerateDocumentPromptResponse {
  prompt: string
  enhanced: boolean
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<GenerateDocumentPromptResponse>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as GenerateDocumentPromptBody
    const { description, config, useAI = false } = body

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: 'description is required' },
        { status: 400 }
      )
    }

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Validation failed', details: 'config is required' },
        { status: 400 }
      )
    }

    // Generate the base document prompt — promptGenerator handles templateService internally
    const basePrompt = await generateGlobalContextPrompt({
  projectName: config.name,
  platformType: config.platformType,
  techStack: config.techStack.join(', '),
  additionalNotes: config.additionalNotes ?? '',
  projectDescription: description,
})

    if (!useAI) {
      return NextResponse.json({
        data: {
          prompt: basePrompt,
          enhanced: false,
        },
      })
    }

    // Attempt AI enhancement — resolve Groq API key from user settings
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { groqApiKey: true },
    })

    const resolvedApiKey = userSettings?.groqApiKey ?? undefined

    // enhanceProjectDescription uses safeGroqCall internally — returns null on any
    // failure per Section 3.4. Apply it to the base prompt to add technical detail.
    const enhanced = await enhanceProjectDescription(basePrompt, resolvedApiKey)

    if (enhanced === null) {
      // Groq unavailable — return the base prompt unmodified, non-blocking
      return NextResponse.json({
        data: {
          prompt: basePrompt,
          enhanced: false,
        },
      })
    }

    return NextResponse.json({
      data: {
        prompt: enhanced,
        enhanced: true,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/ai/generate-document-prompt]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}