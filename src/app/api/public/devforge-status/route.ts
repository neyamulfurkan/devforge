// =============================================================================
// DevForge — src/app/api/public/devforge-status/route.ts
// Public endpoint consumed by Zymbiq to display live build activity.
// No auth required. Returns active project progress or last completed project.
// =============================================================================

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request): Promise<NextResponse> {
  // ── Bearer token verification ──────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization')
  const expectedKey = process.env.DEVFORGE_PUBLIC_API_KEY

  if (!expectedKey) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── Active project: IN_PROGRESS, most recently opened ──────────────────
    const activeProject = await prisma.project.findFirst({
      where: { status: 'IN_PROGRESS' },
      orderBy: { lastOpenedAt: 'desc' },
      select: {
        name: true,
        totalFiles: true,
        completedFiles: true,
        updatedAt: true,
        files: {
          where: { status: { not: 'EMPTY' } },
          orderBy: { phase: 'desc' },
          take: 1,
          select: { phaseName: true },
        },
      },
    })

    if (activeProject) {
      const totalFiles = activeProject.totalFiles ?? 0
      const completedFiles = activeProject.completedFiles ?? 0
      const percentComplete =
        totalFiles === 0
          ? 0
          : Math.round((completedFiles / totalFiles) * 100)

      // Rough estimate: assume ~5 min per remaining file
      const remainingFiles = totalFiles - completedFiles
      const estimatedMs = remainingFiles * 5 * 60 * 1000
      const estimatedDate = new Date(Date.now() + estimatedMs)
      const estimatedCompletion = estimatedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      const currentPhase =
        activeProject.files[0]?.phaseName ?? 'Setting up project'

      return NextResponse.json(
        {
          activeProject: {
            name: activeProject.name,
            currentPhase,
            completedFiles,
            totalFiles,
            percentComplete,
            estimatedCompletion,
          },
          lastCompletedProject: null,
        },
        {
          headers: { 'Cache-Control': 'no-store' },
        }
      )
    }

    // ── No active project — return last completed ──────────────────────────
    const lastCompleted = await prisma.project.findFirst({
      where: { status: 'COMPLETE' },
      orderBy: { updatedAt: 'desc' },
      select: {
        name: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(
      {
        activeProject: null,
        lastCompletedProject: lastCompleted
          ? {
              name: lastCompleted.name,
              completedAt: lastCompleted.updatedAt.toISOString(),
            }
          : null,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error) {
    console.error('[GET /api/public/devforge-status]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}