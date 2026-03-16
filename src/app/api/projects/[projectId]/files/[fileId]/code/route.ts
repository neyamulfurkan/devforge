// src/app/api/projects/[projectId]/files/[fileId]/code/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Cloudinary — raw code storage (zero Neon storage for code content)
import { uploadRawCode, fetchRawCode, checkCodeExists, deleteRawCode } from '@/lib/cloudinary'

// 5. Types
import type { ApiResponse, FileWithContent } from '@/types'

// ─── GET /api/projects/[projectId]/files/[fileId]/code ───────────────────────
// Fetches file metadata from Neon + code content from Cloudinary.
// Falls back to DB codeContent for legacy files created before Cloudinary migration.
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

    // Try Cloudinary first — primary storage for all code content
    let codeContent: string | null = await fetchRawCode(projectId, fileId)

    // Fall back to DB codeContent for legacy files (pre-Cloudinary migration)
    if (codeContent === null && file.codeContent) {
      codeContent = file.codeContent
    }

    const { project: _project, ...fileData } = file

    const result: FileWithContent = {
      ...fileData,
      codeContent,
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
// Saves code to Cloudinary (not Neon). Only metadata (status, lineCount,
// codeAddedAt) is written to Neon — keeping DB rows tiny.
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

    const bodyObj = body as Record<string, unknown>
    // Accept both "content" (Cloudinary path) and "codeContent" (legacy DB field name)
    const rawContent = bodyObj.codeContent ?? bodyObj.content

    if (
      !body ||
      typeof body !== 'object' ||
      typeof rawContent !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Request body must contain a "codeContent" or "content" string' },
        { status: 400 }
      )
    }

    const content = rawContent as string
    const lineCount = content.split('\n').length

    // Upload code to Cloudinary — primary storage, zero Neon column usage
    await uploadRawCode(content, projectId, fileId)

    // Only metadata goes to Neon — no codeContent column written
    const updateData: Record<string, unknown> = {
      lineCount,
      // Clear any legacy codeContent to free Neon space
      codeContent: null,
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
      // Return the content we just uploaded — no need to re-fetch from Cloudinary
      codeContent: content,
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

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('[PUT /api/projects/[projectId]/files/[fileId]/code]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE /api/projects/[projectId]/files/[fileId]/code ────────────────────
// Removes code from Cloudinary after a successful pull-to-local.
// Frees Cloudinary storage once the file is safely on disk.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, fileId } = params

    const file = await prisma.projectFile.findUnique({
      where: { id: fileId },
      select: { projectId: true, project: { select: { userId: true } } },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.projectId !== projectId || file.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await deleteRawCode(projectId, fileId)

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/projects/[projectId]/files/[fileId]/code]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── HEAD /api/projects/[projectId]/files/[fileId]/code ──────────────────────
// Lightweight check — returns 200 if cloud code exists, 404 if not.
// Used by FileRow sync badge without downloading the full content.
export async function HEAD(
  _request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
): Promise<NextResponse> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return new NextResponse(null, { status: 401 })
    }

    const { projectId, fileId } = params

    const file = await prisma.projectFile.findUnique({
      where: { id: fileId },
      select: { projectId: true, project: { select: { userId: true } } },
    })

    if (!file || file.projectId !== projectId || file.project.userId !== session.user.id) {
      return new NextResponse(null, { status: 404 })
    }

    const exists = await checkCodeExists(projectId, fileId)
    return new NextResponse(null, { status: exists ? 200 : 404 })
  } catch {
    return new NextResponse(null, { status: 500 })
  }
}