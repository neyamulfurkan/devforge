// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Services and types
import { getAllTemplates } from '@/services/templateService'
import type { ApiResponse, PromptTemplate } from '@/types'

// ─── GET: All templates for authenticated user (user overrides merged over globals) ──

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest
): Promise<NextResponse<ApiResponse<{ templates: PromptTemplate[] }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await getAllTemplates(session.user.id)

    return NextResponse.json({ data: { templates } })
  } catch (error) {
    console.error('[GET /api/settings/templates]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}