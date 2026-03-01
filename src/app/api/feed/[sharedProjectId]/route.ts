// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Database
import { prisma } from '@/lib/prisma'

// 3. Types
import type { ApiResponse } from '@/types'
import type { SharedProject } from '@prisma/client'

type SharedProjectDetail = SharedProject & {
  author: { name: string; profileImageUrl: string | null }
  project: {
    name: string
    description: string
    techStack: string[]
    platformType: string
    totalFiles: number
    completedFiles: number
  }
  filteredSections: Array<{ sectionNumber: string; title: string; rawContent: string }>
  filePrompts?: Array<{ fileNumber: string; filePath: string; filePrompt: string | null }>
}

// ─── GET (intentionally public — no auth required) ────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { sharedProjectId: string } }
): Promise<NextResponse<ApiResponse<SharedProjectDetail>>> {
  try {
    const sharedProject = await prisma.sharedProject.findFirst({
      where: { id: params.sharedProjectId, isActive: true },
      include: {
        author: { select: { name: true, profileImageUrl: true } },
        project: {
          select: {
            name: true,
            description: true,
            techStack: true,
            platformType: true,
            totalFiles: true,
            completedFiles: true,
          },
        },
      },
    })

    if (!sharedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch document and filter to only shared sections
    const document = await prisma.projectDocument.findUnique({
      where: { projectId: sharedProject.projectId },
      select: { sections: true },
    })

    const allSections = (document?.sections ?? []) as Array<{
      sectionNumber: string
      title: string
      rawContent: string
    }>

    const sharedSectionNumbers = new Set(sharedProject.sharedSections)
    const filteredSections = sharedSectionNumbers.size > 0
      ? allSections.filter((s) => sharedSectionNumbers.has(s.sectionNumber))
      : allSections

    // Optionally include file prompts
    let filePrompts: SharedProjectDetail['filePrompts']
    if (sharedProject.shareFilePrompts) {
      const files = await prisma.projectFile.findMany({
        where: { projectId: sharedProject.projectId },
        select: { fileNumber: true, filePath: true, filePrompt: true },
        orderBy: { fileNumber: 'asc' },
      })
      filePrompts = files
    }

    // Increment viewCount (fire-and-forget — never block the response)
    prisma.sharedProject
      .update({
        where: { id: params.sharedProjectId },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err: unknown) => {
        console.error('[viewCount increment failed]', err)
      })

    const response: SharedProjectDetail = {
      ...(sharedProject as unknown as SharedProject & {
        author: { name: string; profileImageUrl: string | null }
        project: {
          name: string
          description: string
          techStack: string[]
          platformType: string
          totalFiles: number
          completedFiles: number
        }
      }),
      filteredSections,
      ...(filePrompts !== undefined ? { filePrompts } : {}),
    }

    return NextResponse.json({ data: response })
  } catch (error) {
    console.error('[GET /api/feed/[sharedProjectId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}