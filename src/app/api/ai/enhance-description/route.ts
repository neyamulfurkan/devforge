// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Database
import { prisma } from '@/lib/prisma'

// 4. Services and types
import { enhanceProjectDescription } from '@/services/groqService'
import type { ApiResponse } from '@/types'

interface EnhanceDescriptionBody {
  description: string
  apiKey?: string
}

interface EnhanceDescriptionResponse {
  enhanced: string
  fallback: boolean
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<EnhanceDescriptionResponse>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as EnhanceDescriptionBody
    const { description, apiKey: bodyApiKey } = body

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: 'description is required' },
        { status: 400 }
      )
    }

    // Resolve API key: body takes priority, then user settings, then server env
    let resolvedApiKey: string | undefined = bodyApiKey?.trim() || undefined

    if (!resolvedApiKey) {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId: session.user.id },
        select: { groqApiKey: true },
      })
      resolvedApiKey = userSettings?.groqApiKey ?? undefined
    }

    // enhanceProjectDescription uses safeGroqCall internally — returns null on any failure
    const result = await enhanceProjectDescription(description, resolvedApiKey)

    if (result === null) {
      // Fallback: return original description unchanged
      return NextResponse.json({
        data: {
          enhanced: description,
          fallback: true,
        },
      })
    }

    return NextResponse.json({
      data: {
        enhanced: result,
        fallback: false,
      },
    })
  } catch (error) {
    console.error('[POST /api/ai/enhance-description]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}