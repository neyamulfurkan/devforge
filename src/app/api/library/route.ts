// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// 4. Validation
import { createLibraryPromptSchema } from '@/validations/prompt'
import { z } from 'zod'

// 5. Services and types
import { searchLibraryPrompts } from '@/services/searchService'
import type { ApiResponse, PaginatedResult } from '@/types'
import type { LibraryPrompt } from '@prisma/client'

// ─── GET (public) ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResult<LibraryPrompt>>>> {
  try {
    const { searchParams } = new URL(request.url)

    const tool = searchParams.get('tool') ?? ''
    const category = searchParams.get('category') ?? ''
    const sort = searchParams.get('sort') ?? 'most_copied'
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? '20')))

    // Build where clause
    const where: Prisma.LibraryPromptWhereInput = {
      isApproved: true,
      isActive: true,
      ...(tool ? { aiTool: tool } : {}),
      ...(category ? { category } : {}),
    }

    // Determine orderBy
    let orderBy: Prisma.LibraryPromptOrderByWithRelationInput
    if (sort === 'newest') {
      orderBy = { createdAt: 'desc' }
    } else if (sort === 'highest_rated') {
      orderBy = { ratingSum: 'desc' }
    } else {
      // most_copied (default)
      orderBy = { copyCount: 'desc' }
    }

    // Fetch all matching records (needed for client-side Fuse search)
    // For non-search queries we paginate at DB level for efficiency
    if (search && search.trim().length >= 2) {
      // Fetch broader set, then apply Fuse search, then paginate
      const allPrompts = await prisma.libraryPrompt.findMany({
        where,
        orderBy,
        include: { author: { select: { name: true, profileImageUrl: true } } },
      })

      // searchLibraryPrompts works on LibraryPrompt[] — cast is safe as Prisma includes author
      const searched = searchLibraryPrompts(allPrompts as unknown as LibraryPrompt[], search)
      const total = searched.length
      const start = (page - 1) * pageSize
      const items = searched.slice(start, start + pageSize) as unknown as LibraryPrompt[]

      return NextResponse.json({
        data: {
          items,
          total,
          page,
          pageSize,
          hasMore: start + pageSize < total,
        },
      })
    }

    // Standard paginated query
    const [total, items] = await Promise.all([
      prisma.libraryPrompt.count({ where }),
      prisma.libraryPrompt.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { author: { select: { name: true, profileImageUrl: true } } },
      }),
    ])

    return NextResponse.json({
      data: {
        items: items as unknown as LibraryPrompt[],
        total,
        page,
        pageSize,
        hasMore: (page - 1) * pageSize + items.length < total,
      },
    })
  } catch (error) {
    console.error('[GET /api/library]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST (auth required) ─────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<LibraryPrompt>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = createLibraryPromptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.errors }, { status: 400 })
    }

    const { title, description, promptText, aiTool, category, makePublic } = parsed.data

    const prompt = await prisma.libraryPrompt.create({
      data: {
        authorId: session.user.id,
        title,
        description,
        promptText,
        aiTool,
        category,
        isApproved: true,
        isActive: makePublic,
      },
    })

    return NextResponse.json({ data: prompt }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    console.error('[POST /api/library]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}