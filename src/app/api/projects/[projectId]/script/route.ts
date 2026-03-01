// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Services and types
import { extractFileTree } from '@/services/documentParser'
import {
  generateScriptForOS,
  generateNpmInstallCommand,
} from '@/services/scriptGenerator'
import type { ApiResponse } from '@/types'

interface ScriptResponse {
  script: string
  npmInstallCmd: string
  platform: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<ScriptResponse>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = params
    const { searchParams } = new URL(request.url)
    const rawPlatform = searchParams.get('platform') ?? 'unix'
    const platform = rawPlatform === 'windows' ? 'windows' : 'unix'

    // Verify ownership
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

    // Fetch document rawContent
    const document = await prisma.projectDocument.findUnique({
      where: { projectId },
      select: { rawContent: true },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found for this project' },
        { status: 404 }
      )
    }

    // Extract file tree using Section 5.11 parser
    const files = extractFileTree(document.rawContent)

    // Generate the terminal script
    const script = generateScriptForOS(files, {
      platform,
      includeFileCreation: true,
      includeNpmInstall: false,
      rootPrefix: '',
    })

    // Extract npm install command from Section 3.3 of the document
    const npmInstallCmd = generateNpmInstallCommand(document.rawContent)

    return NextResponse.json({
      data: {
        script,
        npmInstallCmd,
        platform,
      },
    })
  } catch (error) {
    console.error('[GET /api/projects/[projectId]/script]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}