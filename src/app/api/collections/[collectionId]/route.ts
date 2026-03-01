// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse } from '@/types'
import type { Collection, CollectionVisibility } from '@prisma/client'

// ─── Helper — verify ownership ────────────────────────────────────────────────
async function getOwnedCollection(collectionId: string, userId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, userId: true },
  })

  if (!collection) return { collection: null, error: 'not_found' as const }
  if (collection.userId !== userId) return { collection: null, error: 'forbidden' as const }
  return { collection, error: null }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { collectionId: string } }
): Promise<NextResponse<ApiResponse<Collection>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { collection, error } = await getOwnedCollection(params.collectionId, session.user.id)
    if (error === 'not_found') return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    if (error === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

    const body = (await request.json()) as {
      name?: string
      description?: string
      visibility?: CollectionVisibility
      sortOrder?: number
    }

    const updated = await prisma.collection.update({
      where: { id: params.collectionId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PATCH /api/collections/[collectionId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { collectionId: string } }
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { collection, error } = await getOwnedCollection(params.collectionId, session.user.id)
    if (error === 'not_found') return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    if (error === 'forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

    // Cascades to CollectionPrompt via Prisma schema rules
    await prisma.collection.delete({ where: { id: params.collectionId } })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/collections/[collectionId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}