import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { ErrorType } from '@prisma/client'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json() as {
      projectId: string
      errorType: string
      errorOutput: string
      source?: string
      engine?: string
      identifiedFiles?: string[]
    }

    // Verify user owns the project
    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
    })

    if (!project || project.userId !== userId) {
      return NextResponse.json({ message: 'Project not found or unauthorized' }, { status: 404 })
    }

    // Map to valid ErrorType enum
    const validErrorTypes: ErrorType[] = ['TYPESCRIPT', 'BUILD', 'RUNTIME', 'CONSOLE', 'OTHER']
    const errorType = (validErrorTypes.includes(body.errorType as ErrorType) 
      ? body.errorType 
      : 'OTHER') as ErrorType

    // Create error session
    const errorSession = await prisma.errorSession.create({
      data: {
        projectId: project.id,
        errorType,
        errorOutput: `[DevProbe${body.engine ? ` — ${body.engine}` : ''}]\n${body.errorOutput}`,
        status: 'PENDING',
        identifiedFiles: body.identifiedFiles ?? [],
      },
    })

    return NextResponse.json(
      { 
        data: errorSession,
        message: 'Error session created successfully'
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/devprobe/ingest failed:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}