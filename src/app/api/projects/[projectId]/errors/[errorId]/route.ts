// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Validation
import { resolveErrorSessionSchema, updateIdentifiedFilesSchema } from '@/validations/error'
import { z } from 'zod'

// 5. Types
import type { ApiResponse } from '@/types'

// ─── Discriminated union for PATCH body ──────────────────────────────────────

const patchBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update_files'),
    identifiedFiles: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal('resolve'),
    resolutionNote: z.string().optional(),
  }),
])

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; errorId: string } }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, errorId } = params

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

    // Verify session belongs to the project
    const existing = await prisma.errorSession.findUnique({
      where: { id: errorId },
      select: { id: true, projectId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Error session not found' }, { status: 404 })
    }

    if (existing.projectId !== projectId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await request.json()
    const validated = patchBodySchema.parse(body)

    let updatedSession: unknown

    if (validated.action === 'update_files') {
      // Validate the files list separately for the error message shape
      updateIdentifiedFilesSchema.parse({ identifiedFiles: validated.identifiedFiles })

      updatedSession = await prisma.errorSession.update({
        where: { id: errorId },
        data: {
          identifiedFiles: validated.identifiedFiles,
          updatedAt: new Date(),
        },
      })
    } else {
      // action === 'resolve'
      resolveErrorSessionSchema.parse({ resolutionNote: validated.resolutionNote })

      updatedSession = await prisma.errorSession.update({
        where: { id: errorId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolutionNote: validated.resolutionNote ?? null,
          updatedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ data: updatedSession })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[PATCH /api/projects/[projectId]/errors/[errorId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}