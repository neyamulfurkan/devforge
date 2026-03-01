// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// 4. Validation
import { z } from 'zod'

// 5. Services and types
import { generateFeatureDeltaPrompt } from '@/services/promptGenerator'
import { enhanceProjectDescription } from '@/services/groqService'
import type { ApiResponse } from '@/types'

// ─── Request schema ───────────────────────────────────────────────────────────

const createFeatureSchema = z.object({
  description: z.string().min(10, 'Feature description must be at least 10 characters'),
  enhancedDescription: z.string().optional(),
  deltaPrompt: z.string().optional(),
  deltaOutput: z.string().optional(),
  deltaParsed: z.record(z.unknown()).optional(),
})

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

    const features = await prisma.projectFeature.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: features })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/features]', error)
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

    // Verify ownership, fetch document and user Groq key in one query
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        document: {
          select: { rawContent: true },
        },
        user: {
          select: {
            settings: {
              select: { groqApiKey: true },
            },
          },
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
    const validated = createFeatureSchema.parse(body)

    const feature = await prisma.projectFeature.create({
      data: {
        projectId,
        description: validated.description,
        enhancedDescription: validated.enhancedDescription ?? null,
        deltaPrompt: validated.deltaPrompt ?? null,
        deltaOutput: validated.deltaOutput ?? null,
        deltaParsed: validated.deltaParsed !== undefined
          ? (validated.deltaParsed as Prisma.InputJsonValue)
          : undefined,
      },
    })

    return NextResponse.json({ data: feature }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/projects/[projectId]/features]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}