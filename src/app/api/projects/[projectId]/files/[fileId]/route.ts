// src/app/api/projects/[projectId]/files/[fileId]/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
// 4. Validation
import { fileStatusUpdateSchema } from '@/validations/project'
import { z } from 'zod'

// 5. Types
import type { ApiResponse } from '@/types'
import type { ProjectFile } from '@prisma/client'

// ─── GET /api/projects/[projectId]/files/[fileId] ────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
): Promise<NextResponse<ApiResponse<Omit<ProjectFile, 'codeContent'>>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, fileId } = params

    const file = await prisma.projectFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        projectId: true,
        fileNumber: true,
        filePath: true,
        fileName: true,
        phase: true,
        phaseName: true,
        status: true,
        // codeContent excluded for list performance
        lineCount: true,
        filePrompt: true,
        jsonSummary: true,
        requiredFiles: true,
        notes: true,
        codeAddedAt: true,
        completedAt: true,
        errorAddedAt: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { userId: true } },
      },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.projectId !== projectId || file.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { project: _project, ...fileData } = file
    return NextResponse.json({ data: fileData as unknown as Omit<ProjectFile, 'codeContent'> })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/files/[fileId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PATCH /api/projects/[projectId]/files/[fileId] ──────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
): Promise<NextResponse<ApiResponse<ProjectFile>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, fileId } = params

    // Fetch current file to check ownership and get current status
    const existing = await prisma.projectFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        projectId: true,
        status: true,
        completedAt: true,
        project: { select: { userId: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (existing.projectId !== projectId || existing.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await request.json()
    const parsed = fileStatusUpdateSchema.partial().safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { status, notes, filePrompt, requiredFiles } = parsed.data
    const prevStatus = existing.status

    // Build update payload
    const updateData: Record<string, unknown> = {}

    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (filePrompt !== undefined) updateData.filePrompt = filePrompt
    if (requiredFiles !== undefined) updateData.requiredFiles = requiredFiles

    // Status-specific timestamp logic
    if (status === 'COMPLETE' && prevStatus !== 'COMPLETE') {
      updateData.completedAt = new Date()
    }

    if (status === 'ERROR') {
      updateData.errorAddedAt = new Date()
    }

    // Clear completedAt when moving away from COMPLETE
    if (status !== undefined && status !== 'COMPLETE' && prevStatus === 'COMPLETE') {
      updateData.completedAt = null
    }

    const updatedFile = await prisma.projectFile.update({
      where: { id: fileId },
      data: updateData,
    })

    // Update denormalized completedFiles on Project
    if (status !== undefined && status !== prevStatus) {
      const wasComplete = prevStatus === 'COMPLETE'
      const isComplete = status === 'COMPLETE'

      if (!wasComplete && isComplete) {
        await prisma.project.update({
          where: { id: projectId },
          data: { completedFiles: { increment: 1 } },
        })
      } else if (wasComplete && !isComplete) {
        // Clamp to >= 0
        await prisma.$executeRaw`
          UPDATE "Project"
          SET "completedFiles" = GREATEST("completedFiles" - 1, 0)
          WHERE id = ${projectId}
        `
      }
    }

    return NextResponse.json({ data: updatedFile })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[PATCH /api/projects/[projectId]/files/[fileId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}