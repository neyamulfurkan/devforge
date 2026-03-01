// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Types
import type { ApiResponse } from '@/types'

// ─── POST (auth required — any authenticated user) ───────────────────────────
export async function POST(
  _request: NextRequest,
  { params }: { params: { promptId: string } }
): Promise<NextResponse<ApiResponse<{ copyCount: number }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify prompt exists and is active before incrementing
    const existing = await prisma.libraryPrompt.findFirst({
      where: { id: params.promptId, isActive: true },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Prompt not found' }, { status: 404 })
    }

    const updated = await prisma.libraryPrompt.update({
      where: { id: params.promptId },
      data: { copyCount: { increment: 1 } },
      select: { copyCount: true },
    })

    return NextResponse.json({ data: { copyCount: updated.copyCount } })
  } catch (error) {
    console.error('[POST /api/library/[promptId]/copy]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}