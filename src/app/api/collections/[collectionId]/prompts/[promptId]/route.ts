// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Validation
import { updateCollectionPromptSchema } from '@/validations/prompt'

// 5. Types
import type { ApiResponse } from '@/types'
import type { CollectionPrompt } from '@prisma/client'
import { PromptVisibility } from '@prisma/client'

// ─── Helper — verify collection ownership ─────────────────────────────────────
async function verifyOwnership(collectionId: string, userId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { id: true, userId: true },
  })
  if (!collection) return { ok: false, status: 404, message: 'Collection not found' }
  if (collection.userId !== userId) return { ok: false, status: 403, message: 'Forbidden' }
  return { ok: true, status: 200, message: '' }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: { collectionId: string; promptId: string } }
): Promise<NextResponse<ApiResponse<CollectionPrompt>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const check = await verifyOwnership(params.collectionId, session.user.id)
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status })
    }

    // Ensure prompt belongs to this collection
    const existing = await prisma.collectionPrompt.findFirst({
      where: { id: params.promptId, collectionId: params.collectionId },
      select: { id: true, visibility: true, libraryPromptId: true, title: true, promptText: true, aiTool: true, category: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    const body: unknown = await request.json()
    const parsed = updateCollectionPromptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.errors }, { status: 400 })
    }

    const updates = parsed.data
    const visibilityChanging = updates.visibility !== undefined && updates.visibility !== existing.visibility

    // Handle visibility transitions
    if (visibilityChanging) {
      if (updates.visibility === PromptVisibility.PUBLIC && !existing.libraryPromptId) {
        // Going PUBLIC — create LibraryPrompt
        const libraryPrompt = await prisma.libraryPrompt.create({
          data: {
            authorId: session.user.id,
            title: updates.title ?? existing.title,
            description: (updates.promptText ?? existing.promptText).slice(0, 150),
            promptText: updates.promptText ?? existing.promptText,
            aiTool: updates.aiTool ?? existing.aiTool ?? 'other',
            category: updates.category ?? existing.category ?? 'other',
            isApproved: true,
            isActive: true,
          },
          select: { id: true },
        })
        // Attach to collection prompt
        await prisma.collectionPrompt.update({
          where: { id: params.promptId },
          data: { libraryPromptId: libraryPrompt.id },
        })
      } else if (updates.visibility === PromptVisibility.PRIVATE && existing.libraryPromptId) {
        // Going PRIVATE — soft-delete linked LibraryPrompt
        await prisma.libraryPrompt.update({
          where: { id: existing.libraryPromptId },
          data: { isActive: false },
        })
      }
    }

    const updated = await prisma.collectionPrompt.update({
      where: { id: params.promptId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.promptText !== undefined ? { promptText: updates.promptText } : {}),
        ...(updates.aiTool !== undefined ? { aiTool: updates.aiTool } : {}),
        ...(updates.category !== undefined ? { category: updates.category } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
        ...(updates.visibility !== undefined ? { visibility: updates.visibility } : {}),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('[PATCH /api/collections/[collectionId]/prompts/[promptId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { collectionId: string; promptId: string } }
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const check = await verifyOwnership(params.collectionId, session.user.id)
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: check.status })
    }

    const existing = await prisma.collectionPrompt.findFirst({
      where: { id: params.promptId, collectionId: params.collectionId },
      select: { id: true, libraryPromptId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    // Soft-delete linked LibraryPrompt to preserve community integrity
    if (existing.libraryPromptId) {
      await prisma.libraryPrompt.update({
        where: { id: existing.libraryPromptId },
        data: { isActive: false },
      })
    }

    await prisma.collectionPrompt.delete({ where: { id: params.promptId } })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/collections/[collectionId]/prompts/[promptId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}