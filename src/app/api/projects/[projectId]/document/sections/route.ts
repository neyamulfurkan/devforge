// src/app/api/projects/[projectId]/document/sections/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
// 4. Types
import type { ApiResponse, ParsedDocumentSection } from '@/types'

// ─── GET /api/projects/[projectId]/document/sections ─────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<ParsedDocumentSection[]>>> {
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
      select: { sections: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const rawSections = (document.sections ?? []) as unknown as ParsedDocumentSection[]

    // Deduplicate by sectionNumber — keep last occurrence (highest content)
    const seen = new Map<string, ParsedDocumentSection>()
    for (const s of rawSections) {
      seen.set(s.sectionNumber, s)
    }
    const sections = Array.from(seen.values())

    return NextResponse.json({ data: sections })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/document/sections]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}