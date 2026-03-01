// src/app/api/projects/[projectId]/document/sections/[sectionId]/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// 4. Validation
import { z } from 'zod'

// 5. Services and types
import {
  parseGlobalDocument,
  updateSectionContent,
  appendToSection,
  findSectionByNumber,
  normalizeRawContent,
} from '@/services/documentParser'
import type { ApiResponse, ParsedDocumentSection } from '@/types'

const patchSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  append: z.boolean().optional().default(false),
})

// ─── PATCH /api/projects/[projectId]/document/sections/[sectionId] ────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; sectionId: string } }
): Promise<NextResponse<ApiResponse<ParsedDocumentSection>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
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
    const { content, append } = patchSchema.parse(body)

    // Fetch current document
    const document = await prisma.projectDocument.findUnique({
      where: { projectId: params.projectId },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Apply the mutation — all CPU work done BEFORE opening the transaction
    const normalizedExisting = normalizeRawContent(document.rawContent)
    const updatedRaw = append
      ? appendToSection(normalizedExisting, params.sectionId, content)
      : updateSectionContent(normalizedExisting, params.sectionId, content)

    // Re-parse sections from updated raw content, then deduplicate
    const parsedSections = parseGlobalDocument(updatedRaw)
    const dedupeMap = new Map<string, ParsedDocumentSection>()
    for (const s of parsedSections) {
      dedupeMap.set(s.sectionNumber, s)
    }
    const updatedSections = Array.from(dedupeMap.values())
    const totalWords = updatedSections.reduce((sum, s) => sum + s.wordCount, 0)

    const sectionsJson = updatedSections.map((s) => ({
      sectionNumber: s.sectionNumber,
      title: s.title,
      rawContent: s.rawContent,
      subsections: s.subsections,
      wordCount: s.wordCount,
      isAppendOnly: s.isAppendOnly,
    }))

    const nextVersion = document.currentVersion + 1
    const triggerEvent = append ? 'section_appended' : 'manual_edit'
    const changeSummary = `Section ${params.sectionId} ${append ? 'appended' : 'updated'}`
    const now = new Date()

    // Only DB writes inside the transaction — no CPU work here
    await prisma.$transaction([
      prisma.projectDocument.update({
        where: { projectId: params.projectId },
        data: {
          rawContent: updatedRaw,
          sections: sectionsJson as unknown as Prisma.InputJsonValue,
          totalSections: updatedSections.length,
          totalWords,
          currentVersion: nextVersion,
          updatedAt: now,
        },
      }),
      prisma.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: nextVersion,
          rawContent: updatedRaw,
          sections: sectionsJson as unknown as Prisma.InputJsonValue,
          triggerEvent,
          changeSummary,
        },
      }),
    ])

    // Return the updated section
    const updatedSection = findSectionByNumber(updatedSections, params.sectionId)

    if (!updatedSection) {
      return NextResponse.json({ error: 'Section not found after update' }, { status: 404 })
    }

    return NextResponse.json({ data: updatedSection })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[PATCH section]', errorMessage, errorStack)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}