// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Validation
import { addErrorSessionSchema } from '@/validations/error'
import { z } from 'zod'

// 5. Services and types
import {
  generateErrorIdentifyPrompt,
  generateErrorReplacePrompt,
} from '@/services/promptGenerator'
import type { ApiResponse } from '@/types'

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sessions = await prisma.errorSession.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: sessions })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/errors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params

    // Verify ownership and fetch document + project name for prompt context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        userId: true,
        name: true,
        document: { select: { rawContent: true } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await request.json()
    const validated = addErrorSessionSchema.parse(body)

    const documentContent = project.document?.rawContent ?? ''
    const tscRawOutput = validated.tscRawOutput ?? null

    let identifyPrompt: string
    let replacePrompt: string

    if (tscRawOutput && validated.errorType === 'TYPESCRIPT') {
      // ── TSC-specific prompt path ──────────────────────────────────────
      // Import lazily to avoid pulling into every API route at cold-start
      const { generateTscErrorIdentifyPrompt, generateTscErrorReplacePrompt } =
        await import('@/services/promptGenerator')
      const { parseTscOutput, formatTscErrorGroups } =
        await import('@/hooks/useErrors')
      const { TSC_REQUIRED_GCD_SECTIONS } = await import('@/lib/constants')

      // Parse the raw TSC output into structured groups for the prompt
      const groups = parseTscOutput(tscRawOutput)
      const errorGroupsSummary = formatTscErrorGroups(groups)

      // Extract only the GCD sections Claude needs for error fixing
      // (1, 3, 4, 5, 9, 11) — avoids sending the full 10k-word document
      const relevantSections = extractRelevantGcdSections(
        documentContent,
        TSC_REQUIRED_GCD_SECTIONS as unknown as string[]
      )

      ;[identifyPrompt, replacePrompt] = await Promise.all([
        generateTscErrorIdentifyPrompt({
          projectName: project.name,
          tscOutput: tscRawOutput,
          errorGroups: errorGroupsSummary,
          gcdSections: relevantSections,
        }),
        generateTscErrorReplacePrompt({
          tscOutput: tscRawOutput,
          identifiedFiles: '',
          fileContents: '',
          gcdSections: relevantSections,
        }),
      ])
    } else {
      // ── Standard error prompt path (unchanged) ────────────────────────
      ;[identifyPrompt, replacePrompt] = await Promise.all([
        generateErrorIdentifyPrompt({
          projectName: project.name,
          errorType: validated.errorType,
          errorOutput: validated.errorOutput,
          fileRegistry: '',
          globalContextDocument: documentContent,
        }),
        generateErrorReplacePrompt({
          errorOutput: validated.errorOutput,
          identifiedFiles: '',
          fileContents: '',
          globalContextDocument: documentContent,
        }),
      ])
    }

    const errorSession = await prisma.errorSession.create({
      data: {
        projectId,
        errorType: validated.errorType,
        errorOutput: validated.errorOutput,
        tscRawOutput,
        identifyPrompt,
        replacePrompt,
      },
    })

    return NextResponse.json({ data: errorSession }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[POST /api/projects/[projectId]/errors]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── GCD section extractor (server-side only) ─────────────────────────────────

/**
 * Extract specific sections from the GCD raw text by section number.
 * Used to send only the sections Claude needs rather than the full document.
 */
function extractRelevantGcdSections(rawContent: string, sectionNumbers: string[]): string {
  if (!rawContent) return ''
  const lines = rawContent.split('\n')
  const outputLines: string[] = []
  const allowed = new Set(sectionNumbers)

  let currentSectionAllowed = false
  let currentSectionNum = ''

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+SECTION\s+(\d+(?:\.\d+)?)/i)
    if (sectionMatch) {
      const num = sectionMatch[1] ?? ''
      currentSectionNum = num.split('.')[0] ?? num
      currentSectionAllowed = allowed.has(currentSectionNum)
    }
    if (currentSectionAllowed) outputLines.push(line)
  }

  return outputLines.join('\n')
}