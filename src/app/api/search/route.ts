// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse } from '@/types'

const MIN_QUERY_LENGTH = 2
const RESULTS_PER_CATEGORY = 5

interface SearchResults {
  files: Array<{ id: string; filePath: string; projectId: string; projectName: string; status: string }>
  prompts: Array<{ id: string; title: string; collectionId: string; collectionName: string }>
  libraryPrompts: Array<{ id: string; title: string; description: string; aiTool: string; category: string }>
  collections: Array<{ id: string; name: string; promptCount: number }>
  total: number
}

// ─── GET: Global search across files, prompts, collections ───────────────────

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<SearchResults>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() ?? ''

    if (q.length < MIN_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query must be at least ${MIN_QUERY_LENGTH} characters` },
        { status: 400 }
      )
    }

    // Run all queries in parallel for performance
    const [files, collectionPrompts, libraryPrompts, collections] = await Promise.all([
      // Project files — match by path
      prisma.projectFile.findMany({
        where: {
          project: { userId: session.user.id },
          filePath: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          filePath: true,
          projectId: true,
          status: true,
          project: { select: { name: true } },
        },
        take: RESULTS_PER_CATEGORY,
        orderBy: { filePath: 'asc' },
      }),

      // Collection prompts — match by title
      prisma.collectionPrompt.findMany({
        where: {
          collection: { userId: session.user.id },
          title: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          collectionId: true,
          collection: { select: { name: true } },
        },
        take: RESULTS_PER_CATEGORY,
        orderBy: { title: 'asc' },
      }),

      // Library prompts — match by title or description (public, active)
      prisma.libraryPrompt.findMany({
        where: {
          isApproved: true,
          isActive: true,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          aiTool: true,
          category: true,
        },
        take: RESULTS_PER_CATEGORY,
        orderBy: { copyCount: 'desc' },
      }),

      // Collections — match by name
      prisma.collection.findMany({
        where: {
          userId: session.user.id,
          name: { contains: q, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          _count: { select: { prompts: true } },
        },
        take: RESULTS_PER_CATEGORY,
        orderBy: { name: 'asc' },
      }),
    ])

    const results: SearchResults = {
      files: files.map((f) => ({
        id: f.id,
        filePath: f.filePath,
        projectId: f.projectId,
        projectName: f.project.name,
        status: f.status,
      })),
      prompts: collectionPrompts.map((p) => ({
        id: p.id,
        title: p.title,
        collectionId: p.collectionId,
        collectionName: p.collection.name,
      })),
      libraryPrompts: libraryPrompts.map((lp) => ({
        id: lp.id,
        title: lp.title,
        description: lp.description,
        aiTool: lp.aiTool,
        category: lp.category,
      })),
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        promptCount: c._count.prompts,
      })),
      total:
        files.length +
        collectionPrompts.length +
        libraryPrompts.length +
        collections.length,
    }

    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('[GET /api/search]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}