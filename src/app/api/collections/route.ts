// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse } from '@/types'
import type { Collection } from '@prisma/client'

type CollectionWithCount = Collection & { _count: { prompts: number } }

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<CollectionWithCount[]>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const collections = await prisma.collection.findMany({
      where: { userId: session.user.id },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { prompts: true } } },
    })

    return NextResponse.json({ data: collections })
  } catch (error) {
    console.error('[GET /api/collections]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<CollectionWithCount>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await request.json()
    const name = typeof body === 'object' && body !== null && 'name' in body
      ? String((body as Record<string, unknown>).name ?? '').trim()
      : ''

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or fewer' }, { status: 400 })
    }

    // Determine next sortOrder
    const maxResult = await prisma.collection.aggregate({
      where: { userId: session.user.id },
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxResult._max.sortOrder ?? -1) + 1

    const collection = await prisma.collection.create({
      data: {
        userId: session.user.id,
        name,
        sortOrder: nextSortOrder,
      },
      include: { _count: { select: { prompts: true } } },
    })

    return NextResponse.json({ data: collection }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/collections]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}