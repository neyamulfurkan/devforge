// src/app/api/projects/[projectId]/files/[fileId]/code/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse, FileWithContent } from '@/types'

// ─── GET /api/projects/[projectId]/files/[fileId]/code ───────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
): Promise<NextResponse<ApiResponse<FileWithContent>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, fileId } = params

    const file = await prisma.projectFile.findUnique({
      where: { id: fileId },
      include: { project: { select: { userId: true } } },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.projectId !== projectId || file.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { project: _project, ...fileData } = file

    const result: FileWithContent = {
      ...fileData,
      status: fileData.status as FileWithContent['status'],
      jsonSummary: fileData.jsonSummary as Record<string, unknown> | null,
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/files/[fileId]/code]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── PUT /api/projects/[projectId]/files/[fileId]/code ───────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
): Promise<NextResponse<ApiResponse<FileWithContent>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, fileId } = params

    const existing = await prisma.projectFile.findUnique({
      where: { id: fileId },
      select: {
        projectId: true,
        status: true,
        codeAddedAt: true,
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

    if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).content !== 'string') {
      return NextResponse.json(
        { error: 'Request body must contain a "content" string' },
        { status: 400 }
      )
    }

    const content = (body as { content: string }).content
    const lineCount = content.split('\n').length

    const updateData: Record<string, unknown> = {
      codeContent: content,
      lineCount,
    }

    // First paste: transition EMPTY → CODE_PASTED and record timestamp
    if (existing.status === 'EMPTY') {
      updateData.status = 'CODE_PASTED'
      updateData.codeAddedAt = new Date()
    }

    // If no codeAddedAt yet (edge case), record it
    if (!existing.codeAddedAt && existing.status !== 'EMPTY') {
      updateData.codeAddedAt = new Date()
    }

    const updatedFile = await prisma.projectFile.findUnique({ where: { id: fileId } })
    await prisma.projectFile.update({ where: { id: fileId }, data: updateData })

    const finalFile = await prisma.projectFile.findUniqueOrThrow({ where: { id: fileId } })

    const result: FileWithContent = {
      id: finalFile.id,
      projectId: finalFile.projectId,
      fileNumber: finalFile.fileNumber,
      filePath: finalFile.filePath,
      fileName: finalFile.fileName,
      phase: finalFile.phase,
      phaseName: finalFile.phaseName,
      status: finalFile.status as FileWithContent['status'],
      codeContent: finalFile.codeContent,
      lineCount: finalFile.lineCount,
      filePrompt: finalFile.filePrompt,
      jsonSummary: finalFile.jsonSummary as Record<string, unknown> | null,
      requiredFiles: finalFile.requiredFiles,
      notes: finalFile.notes,
      codeAddedAt: finalFile.codeAddedAt,
      completedAt: finalFile.completedAt,
      createdAt: finalFile.createdAt,
      updatedAt: finalFile.updatedAt,
    }

    void updatedFile

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[PUT /api/projects/[projectId]/files/[fileId]/code]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}