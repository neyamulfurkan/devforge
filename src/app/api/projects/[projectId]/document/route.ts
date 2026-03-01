// src/app/api/projects/[projectId]/document/route.ts

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

// 5. Services and types
import { parseGlobalDocument, extractFileTree, countWords, normalizeRawContent } from '@/services/documentParser'
import type { ApiResponse } from '@/types'
import type { ProjectDocument } from '@prisma/client'

const importSchema = z.object({
  rawContent: z.string().min(100, 'Document must be at least 100 characters'),
})

// ─── Helper: verify ownership ─────────────────────────────────────────────────
async function verifyOwnership(
  projectId: string,
  userId: string
): Promise<{ owned: boolean; exists: boolean }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!project) return { owned: false, exists: false }
  return { owned: project.userId === userId, exists: true }
}

// ─── GET /api/projects/[projectId]/document ───────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<ProjectDocument>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owned, exists } = await verifyOwnership(params.projectId, session.user.id)
    if (!exists) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const document = await prisma.projectDocument.findUnique({
      where: { projectId: params.projectId },
      select: {
        id: true,
        projectId: true,
        rawContent: true,
        sections: true,
        totalSections: true,
        totalWords: true,
        currentVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ data: document })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/document]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/projects/[projectId]/document ──────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<ProjectDocument>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owned, exists } = await verifyOwnership(params.projectId, session.user.id)
    if (!exists) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body: unknown = await request.json()
    const { rawContent: rawInput } = importSchema.parse(body)
    const rawContent = normalizeRawContent(rawInput)

    const parsedSections = parseGlobalDocument(rawContent)
    const extractedFiles = extractFileTree(rawContent)
    const totalWords = parsedSections.reduce((sum, s) => sum + s.wordCount, 0)

    // Development guard: surface parse failures immediately rather than silently
    // creating a project with 0 files. A valid GCD must have ≥ 4 sections and
    // at least 1 file. Log details so mismatches are diagnosable.
    if (parsedSections.length < 4) {
      console.error('[document/route] Suspiciously few sections parsed:', parsedSections.length, '— first 200 chars:', rawContent.substring(0, 200))
    }
    if (extractedFiles.length === 0) {
      console.error('[document/route] No files extracted from Section 4 — rawContent length:', rawContent.length, 'sections found:', parsedSections.map(s => s.sectionNumber).join(', '))
    }

    const sectionsJson = parsedSections.map((s) => ({
      sectionNumber: s.sectionNumber,
      title: s.title,
      rawContent: s.rawContent,
      subsections: s.subsections,
      wordCount: s.wordCount,
      isAppendOnly: s.isAppendOnly,
    }))

    const result = await prisma.$transaction(async (tx) => {
      // Upsert the document
      const existing = await tx.projectDocument.findUnique({
        where: { projectId: params.projectId },
        select: { id: true, currentVersion: true },
      })

      let doc: ProjectDocument

      if (existing) {
        const nextVersion = existing.currentVersion + 1

        doc = await tx.projectDocument.update({
          where: { projectId: params.projectId },
          data: {
            rawContent,
            sections: sectionsJson as unknown as Prisma.InputJsonValue,
            totalSections: parsedSections.length,
            totalWords,
            currentVersion: nextVersion,
            updatedAt: new Date(),
          },
        })

        await tx.documentVersion.create({
          data: {
            documentId: existing.id,
            versionNumber: nextVersion,
            rawContent,
            sections: sectionsJson as unknown as Prisma.InputJsonValue,
            triggerEvent: 'reimport',
            changeSummary: 'Document re-imported',
          },
        })
      } else {
        doc = await tx.projectDocument.create({
          data: {
            projectId: params.projectId,
            rawContent,
            sections: sectionsJson as unknown as Prisma.InputJsonValue,
            totalSections: parsedSections.length,
            totalWords,
            currentVersion: 1,
          },
        })

        await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            versionNumber: 1,
            rawContent,
            sections: sectionsJson as unknown as Prisma.InputJsonValue,
            triggerEvent: 'initial_import',
            changeSummary: 'Initial document import',
          },
        })
      }

      // Update project file count and sync files
      await tx.project.update({
        where: { id: params.projectId },
        data: {
          totalFiles: extractedFiles.length,
          updatedAt: new Date(),
        },
      })

      // Bulk-create files (skip existing duplicates)
      if (extractedFiles.length > 0) {
        await tx.projectFile.createMany({
          data: extractedFiles.map((f) => ({
            projectId: params.projectId,
            fileNumber: f.fileNumber,
            filePath: f.filePath,
            fileName: f.fileName,
            phase: f.phase,
            phaseName: f.phaseName,
            status: 'EMPTY' as const,
          })),
          skipDuplicates: true,
        })
      }

      return doc
    })

    return NextResponse.json({ data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/projects/[projectId]/document]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}