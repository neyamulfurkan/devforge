// src/app/api/projects/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// 4. Validation
import { createProjectSchema } from '@/validations/project'
import { z } from 'zod'

// 5. Services and types
import { parseGlobalDocument, extractFileTree } from '@/services/documentParser'
import type { ApiResponse } from '@/types'
import type { Project } from '@prisma/client'

// ─── GET /api/projects ────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<Project[]>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { lastOpenedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        description: true,
        platformType: true,
        status: true,
        techStack: true,
        totalFiles: true,
        completedFiles: true,
        additionalNotes: true,
        deploymentUrl: true,
        createdAt: true,
        updatedAt: true,
        lastOpenedAt: true,
        // Exclude: document.rawContent and file.codeContent for performance
      },
    })

    return NextResponse.json({ data: projects as Project[] })
  } catch (error) {
    console.error('[GET /api/projects]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST /api/projects ───────────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<Project>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const validated = createProjectSchema.parse(body)

    // Check if rawContent was provided alongside project data
    const rawContent =
      typeof body === 'object' && body !== null && 'rawContent' in body
        ? (body as Record<string, unknown>).rawContent
        : undefined

    const hasDocument = typeof rawContent === 'string' && rawContent.trim().length >= 100

    // Parse document and extract file tree if rawContent provided
    let parsedSections: ReturnType<typeof parseGlobalDocument> = []
    let extractedFiles: ReturnType<typeof extractFileTree> = []

    if (hasDocument) {
      parsedSections = parseGlobalDocument(rawContent as string)
      extractedFiles = extractFileTree(rawContent as string)
    }

    // Create project + optional document + optional files in a transaction
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })
    if (!userExists) {
      return NextResponse.json({ error: 'User not found. Please log in again.' }, { status: 404 })
    }

    // Neon serverless Pool adapter does not support interactive transactions.
    // Run sequential writes instead — project creation failure is caught by try/catch above.
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: validated.name,
        description: validated.description,
        platformType: validated.platformType,
        status: 'IN_PROGRESS',
        techStack: validated.techStack ?? [],
        additionalNotes: validated.additionalNotes ?? null,
        totalFiles: hasDocument ? extractedFiles.length : 0,
        completedFiles: 0,
      },
    })

    if (hasDocument) {
      const sectionsJson = parsedSections.map((s) => ({
        sectionNumber: s.sectionNumber,
        title: s.title,
        rawContent: s.rawContent,
        subsections: s.subsections,
        wordCount: s.wordCount,
        isAppendOnly: s.isAppendOnly,
      }))

      const totalWords = parsedSections.reduce((sum, s) => sum + s.wordCount, 0)

      // Create the project document
      const doc = await prisma.projectDocument.create({
        data: {
          projectId: project.id,
          rawContent: rawContent as string,
          sections: sectionsJson as unknown as Prisma.InputJsonValue,
          totalSections: parsedSections.length,
          totalWords,
          currentVersion: 1,
        },
      })

      // Create initial document version
      await prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          rawContent: rawContent as string,
          sections: sectionsJson as unknown as Prisma.InputJsonValue,
          triggerEvent: 'initial_import',
          changeSummary: 'Initial document import',
        },
      })

      // Bulk-create project files from the extracted file tree
      if (extractedFiles.length > 0) {
        await prisma.projectFile.createMany({
          data: extractedFiles.map((f) => ({
            projectId: project.id,
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
    }

    return NextResponse.json({ data: project }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/projects]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}