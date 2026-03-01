// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// 4. Types
import type { ApiResponse, PaginatedResult } from '@/types'
import type { SharedProject } from '@prisma/client'

type SharedProjectWithMeta = SharedProject & {
  author: { name: string; profileImageUrl: string | null }
  project: { name: string; techStack: string[]; platformType: string }
}

// ─── GET (public) ─────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<PaginatedResult<SharedProjectWithMeta>>>> {
  try {
    const { searchParams } = new URL(request.url)

    const projectType = searchParams.get('projectType') ?? ''
    const techStack = searchParams.get('techStack') ?? ''
    const sort = searchParams.get('sort') ?? 'newest'
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(20, Math.max(1, Number(searchParams.get('pageSize') ?? '10')))

    // Build where
    const where: Record<string, unknown> = {
      isActive: true,
      ...(projectType
        ? { project: { platformType: projectType } }
        : {}),
      ...(techStack
        ? { project: { techStack: { has: techStack } } }
        : {}),
    }

    // Determine orderBy
    let orderBy: Prisma.SharedProjectOrderByWithRelationInput
    if (sort === 'most_viewed') {
      orderBy = { viewCount: 'desc' }
    } else if (sort === 'most_copied') {
      orderBy = { copyCount: 'desc' }
    } else {
      orderBy = { createdAt: 'desc' }
    }

    const [total, items] = await Promise.all([
      prisma.sharedProject.count({ where }),
      prisma.sharedProject.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          author: { select: { name: true, profileImageUrl: true } },
          project: { select: { name: true, techStack: true, platformType: true } },
        },
      }),
    ])

    return NextResponse.json({
      data: {
        items: items as unknown as SharedProjectWithMeta[],
        total,
        page,
        pageSize,
        hasMore: (page - 1) * pageSize + items.length < total,
      },
    })
  } catch (error) {
    console.error('[GET /api/feed]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST (auth required) ─────────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<SharedProject>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as {
      projectId: string
      screenshotUrl?: string
      demoUrl?: string
      buildTimeHours?: number
      sharedSections?: string[]
      shareFilePrompts?: boolean
    }

    if (!body.projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Verify ownership
    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Upsert — project can only be shared once
    const shared = await prisma.sharedProject.upsert({
      where: { projectId: body.projectId },
      create: {
        projectId: body.projectId,
        authorId: session.user.id,
        screenshotUrl: body.screenshotUrl ?? null,
        demoUrl: body.demoUrl ?? null,
        buildTimeHours: body.buildTimeHours ?? null,
        sharedSections: body.sharedSections ?? [],
        shareFilePrompts: body.shareFilePrompts ?? false,
        isActive: true,
      },
      update: {
        screenshotUrl: body.screenshotUrl ?? null,
        demoUrl: body.demoUrl ?? null,
        buildTimeHours: body.buildTimeHours ?? null,
        sharedSections: body.sharedSections ?? [],
        shareFilePrompts: body.shareFilePrompts ?? false,
        isActive: true,
      },
    })

    return NextResponse.json({ data: shared }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/feed]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}