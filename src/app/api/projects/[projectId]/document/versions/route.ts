// src/app/api/projects/[projectId]/document/versions/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
// 4. Validation
import { z } from 'zod'

// 5. Types
import type { ApiResponse, VersionSummary } from '@/types'

const restoreSchema = z.object({
  versionNumber: z.number().int().positive(),
})

// ─── GET /api/projects/[projectId]/document/versions ─────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<VersionSummary[]>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const document = await prisma.projectDocument.findUnique({
      where: { projectId: params.projectId },
      select: { id: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: document.id },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        triggerEvent: true,
        changeSummary: true,
        createdAt: true,
        // rawContent intentionally excluded — too large for list view
      },
    })

    return NextResponse.json({ data: versions as VersionSummary[] })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/document/versions]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/projects/[projectId]/document/versions ────────────────────────
// Restores a specific version as the current document content
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<{ restored: boolean; newVersionNumber: number }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await request.json()
    const { versionNumber } = restoreSchema.parse(body)

    const document = await prisma.projectDocument.findUnique({
      where: { projectId: params.projectId },
      select: { id: true, currentVersion: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Fetch the target version (full content needed for restore)
    const targetVersion = await prisma.documentVersion.findUnique({
      where: {
        documentId_versionNumber: {
          documentId: document.id,
          versionNumber,
        },
      },
    })

    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    const nextVersion = document.currentVersion + 1

    await prisma.$transaction(async (tx) => {
      // Update document to restored content
      await tx.projectDocument.update({
        where: { id: document.id },
        data: {
          rawContent: targetVersion.rawContent,
          sections: (targetVersion.sections ?? null) as unknown as Prisma.InputJsonValue,
          currentVersion: nextVersion,
          updatedAt: new Date(),
        },
      })

      // Record the restore as a new version
      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: nextVersion,
          rawContent: targetVersion.rawContent,
          sections: (targetVersion.sections ?? null) as unknown as Prisma.InputJsonValue,
          triggerEvent: `restore_from_v${versionNumber}`,
          changeSummary: `Restored from version ${versionNumber}`,
        },
      })
    })

    return NextResponse.json({ data: { restored: true, newVersionNumber: nextVersion } })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/projects/[projectId]/document/versions]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}