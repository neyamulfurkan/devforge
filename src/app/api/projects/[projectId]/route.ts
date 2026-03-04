// src/app/api/projects/[projectId]/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Validation
import { updateProjectSchema } from '@/validations/project'
import { z } from 'zod'

// 5. Types
import type { ApiResponse } from '@/types'
import type { Project } from '@prisma/client'

// ─── GET /api/projects/[projectId] ───────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<Project & { _count: { files: number } }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        _count: {
          select: { files: true, errorSessions: true, features: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Update lastOpenedAt
    await prisma.project.update({
      where: { id: params.projectId },
      data: { lastOpenedAt: new Date() },
    })

    return NextResponse.json({ data: project })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/projects/[projectId] ─────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<Project>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { userId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await request.json()
    const validated = updateProjectSchema.parse(body)

    const updated = await prisma.project.update({
      where: { id: params.projectId },
      data: {
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.platformType !== undefined && { platformType: validated.platformType }),
        ...(validated.status !== undefined && { status: validated.status }),
        ...(validated.techStack !== undefined && { techStack: validated.techStack }),
        ...(validated.additionalNotes !== undefined && { additionalNotes: validated.additionalNotes }),
        ...(validated.deploymentUrl !== undefined && { deploymentUrl: validated.deploymentUrl }),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[PATCH /api/projects/[projectId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/projects/[projectId] ────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { userId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cascade delete handled by Prisma schema onDelete: Cascade
    await prisma.project.delete({
      where: { id: params.projectId },
    })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/projects/[projectId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}