// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
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

    // Fetch all files WITH codeContent — this is the one route where we include it
    const files = await prisma.projectFile.findMany({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        fileNumber: true,
        filePath: true,
        fileName: true,
        phase: true,
        phaseName: true,
        status: true,
        codeContent: true,
        lineCount: true,
        filePrompt: true,
        jsonSummary: true,
        requiredFiles: true,
        notes: true,
        codeAddedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { fileNumber: 'asc' },
    })

    // Fetch document rawContent for document export
    const document = await prisma.projectDocument.findUnique({
      where: { projectId },
      select: { rawContent: true },
    })

    return NextResponse.json({
      data: {
        files,
        document: {
          rawContent: document?.rawContent ?? null,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/export]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}