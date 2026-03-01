// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse } from '@/types'
import type { LibraryPrompt } from '@prisma/client'

// ─── GET (public) ─────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: { promptId: string } }
): Promise<NextResponse<ApiResponse<LibraryPrompt & { author: { name: string; profileImageUrl: string | null } }>>> {
  try {
    const prompt = await prisma.libraryPrompt.findFirst({
      where: {
        id: params.promptId,
        isActive: true,
        isApproved: true,
      },
      include: {
        author: {
          select: { name: true, profileImageUrl: true },
        },
      },
    })

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    return NextResponse.json({ data: prompt as unknown as LibraryPrompt & { author: { name: string; profileImageUrl: string | null } } })
  } catch (error) {
    console.error('[GET /api/library/[promptId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE (auth required — author only) ────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { promptId: string } }
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prompt = await prisma.libraryPrompt.findUnique({
      where: { id: params.promptId },
      select: { id: true, authorId: true, isActive: true },
    })

    if (!prompt || !prompt.isActive) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    if (prompt.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Soft delete — preserves community data integrity
    await prisma.libraryPrompt.update({
      where: { id: params.promptId },
      data: { isActive: false },
    })

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('[DELETE /api/library/[promptId]]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}