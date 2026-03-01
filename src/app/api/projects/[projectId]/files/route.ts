// src/app/api/projects/[projectId]/files/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse, ExtractedFile } from '@/types'
import type { ProjectFile } from '@prisma/client'

// ─── GET /api/projects/[projectId]/files ─────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<ProjectFile[]>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params

    // Verify ownership
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

    const files = await prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { fileNumber: 'asc' },
      select: {
        id: true,
        projectId: true,
        fileNumber: true,
        filePath: true,
        fileName: true,
        phase: true,
        phaseName: true,
        status: true,
        // codeContent intentionally excluded for performance
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
      },
    })

    return NextResponse.json({ data: files as unknown as ProjectFile[] })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/files]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/projects/[projectId]/files ────────────────────────────────────
// Bulk-create files from an ExtractedFile array (called after document import).
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{ count: number }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params

    // Verify ownership
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

    const body: unknown = await request.json()

    if (
      !body ||
      typeof body !== 'object' ||
      !Array.isArray((body as Record<string, unknown>).files)
    ) {
      return NextResponse.json(
        { error: 'Request body must contain a "files" array' },
        { status: 400 }
      )
    }

    const files = (body as { files: ExtractedFile[] }).files

    if (files.length === 0) {
      return NextResponse.json({ data: { count: 0 } })
    }

    // Bulk create new files — skipDuplicates prevents errors on re-import
    const result = await prisma.projectFile.createMany({
      data: files.map((file) => ({
        projectId,
        fileNumber: file.fileNumber,
        filePath: file.filePath,
        fileName: file.fileName,
        phase: file.phase,
        phaseName: file.phaseName,
        status: 'EMPTY' as const,
        requiredFiles: file.requiredFiles ?? [],
      })),
      skipDuplicates: true,
    })

    // Backfill requiredFiles on ALL existing rows — handles projects created
    // before requiredFiles parsing was implemented. updateMany is safe to run
    // on every import because it only touches the requiredFiles field and
    // never overwrites status or code content.
    await Promise.all(
      files.map((file) =>
        prisma.projectFile.updateMany({
          where: { projectId, fileNumber: file.fileNumber },
          data: { requiredFiles: file.requiredFiles ?? [] },
        })
      )
    )

    // Update project.totalFiles to reflect current actual file count
    const totalCount = await prisma.projectFile.count({ where: { projectId } })
    await prisma.project.update({
      where: { id: projectId },
      data: { totalFiles: totalCount },
    })

    return NextResponse.json({ data: { count: result.count } }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/[projectId]/files]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}