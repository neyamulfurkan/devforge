// =============================================================================
// DevForge — src/app/api/public/devforge-projects/route.ts
// Returns all projects for Zymbiq admin to link to orders.
// =============================================================================

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization')
  const expectedKey = process.env.DEVFORGE_PUBLIC_API_KEY

  if (!expectedKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        totalFiles: true,
        completedFiles: true,
      },
    })

    return NextResponse.json(
      { projects },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[GET /api/public/devforge-projects]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}