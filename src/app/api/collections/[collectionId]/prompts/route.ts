// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Validation
import { createCollectionPromptSchema } from '@/validations/prompt'
import { z } from 'zod'

// 5. Types
import type { ApiResponse } from '@/types'
import type { CollectionPrompt } from '@prisma/client'
import { PromptVisibility } from '@prisma/client'

// ─── Helper — verify collection ownership ─────────────────────────────────────
async function getOwnedCollection(collectionId: string, userId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, userId: true },
  })
  if (!collection) return { ok: false, status: 404, message: 'Collection not found' }
  if (collection.userId !== userId) return { ok: false, status: 403, message: 'Forbidden' }
  return { ok: true, status: 200, message: '' }
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { collectionId: string } }
): Promise<NextResponse<ApiResponse<CollectionPrompt[]>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const check = await getOwnedCollection(params.collectionId, session.user.id)
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status })
    }

    const prompts = await prisma.collectionPrompt.findMany({
      where: { collectionId: params.collectionId },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ data: prompts })
  } catch (error) {
    console.error('[GET /api/collections/[collectionId]/prompts]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { collectionId: string } }
): Promise<NextResponse<ApiResponse<CollectionPrompt>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const check = await getOwnedCollection(params.collectionId, session.user.id)
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status })
    }

    const body: unknown = await request.json()
    const parsed = createCollectionPromptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.errors }, { status: 400 })
    }

    const { title, promptText, aiTool, category, notes, visibility } = parsed.data

    // Determine next sortOrder within this collection
    const maxResult = await prisma.collectionPrompt.aggregate({
      where: { collectionId: params.collectionId },
      _max: { sortOrder: true },
    })
    const nextSortOrder = (maxResult._max.sortOrder ?? -1) + 1

    // If public: create the LibraryPrompt first
    let libraryPromptId: string | null = null
    if (visibility === PromptVisibility.PUBLIC) {
      const libraryPrompt = await prisma.libraryPrompt.create({
        data: {
          authorId: session.user.id,
          title,
          description: promptText.slice(0, 150), // brief auto-description from prompt text
          promptText,
          aiTool: aiTool ?? 'other',
          category: category ?? 'other',
          isApproved: true,
          isActive: true,
        },
        select: { id: true },
      })
      libraryPromptId = libraryPrompt.id
    }

    const collectionPrompt = await prisma.collectionPrompt.create({
      data: {
        collectionId: params.collectionId,
        title,
        promptText,
        aiTool: aiTool ?? null,
        category: category ?? null,
        notes: notes ?? null,
        visibility: visibility ?? PromptVisibility.PRIVATE,
        sortOrder: nextSortOrder,
        libraryPromptId,
      },
    })

    return NextResponse.json({ data: collectionPrompt }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    console.error('[POST /api/collections/[collectionId]/prompts]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}