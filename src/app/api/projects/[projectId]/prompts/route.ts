// src/app/api/projects/[projectId]/prompts/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse } from '@/types'

// ─── GET /api/projects/[projectId]/prompts ───────────────────────────────────
// Returns a map of fileNumber → filePrompt for all files in the project.
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{ prompts: Record<string, string> }>>> {
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

    const files = await prisma.projectFile.findMany({
      where: { projectId },
      select: { fileNumber: true, filePrompt: true },
      orderBy: { fileNumber: 'asc' },
    })

    const prompts: Record<string, string> = {}
    for (const file of files) {
      if (file.filePrompt) {
        prompts[file.fileNumber] = file.filePrompt
      }
    }

    return NextResponse.json({ data: { prompts } })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/prompts]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PUT /api/projects/[projectId]/prompts ───────────────────────────────────
// Bulk-update file prompts. Accepts { prompts: Record<string,string>, requiredFiles?: Record<string,string[]> }
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{ updated: number }>>> {
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

    const body: unknown = await request.json()

    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).prompts !== 'object' ||
      (body as Record<string, unknown>).prompts === null
    ) {
      return NextResponse.json(
        { error: 'Request body must contain a "prompts" object' },
        { status: 400 }
      )
    }

    const { prompts, requiredFiles } = body as {
      prompts: Record<string, string>
      requiredFiles?: Record<string, string[]>
    }

    const fileNumbers = Object.keys(prompts)

    if (fileNumbers.length === 0) {
      return NextResponse.json({ data: { updated: 0 } })
    }

    // Update each file's prompt individually (updateMany doesn't support per-record values)
    const updates = fileNumbers.map((fileNumber) =>
      prisma.projectFile.updateMany({
        where: { projectId, fileNumber },
        data: {
          filePrompt: prompts[fileNumber],
          ...(requiredFiles?.[fileNumber] !== undefined
            ? { requiredFiles: requiredFiles[fileNumber] }
            : {}),
        },
      })
    )

    const results = await prisma.$transaction(updates)
    const totalUpdated = results.reduce((sum, r) => sum + r.count, 0)

    return NextResponse.json({ data: { updated: totalUpdated } })
  } catch (error) {
    console.error('[PUT /api/projects/[projectId]/prompts]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}