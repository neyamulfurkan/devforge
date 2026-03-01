import { type NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { ZodError } from 'zod'

import { prisma } from '@/lib/prisma'
import { registerSchema } from '@/validations/auth'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse body
    const body: unknown = await request.json()

    // 2. Validate with registerSchema
    const { name, email, password } = registerSchema.parse(body)

    // 3. Check for existing account
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // 4. Hash password
    const passwordHash = await hash(password, 12)

    // 5. Create user — never expose passwordHash in response
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    // 6. Return 201 with safe user data
    return NextResponse.json({ data: user }, { status: 201 })
  } catch (err) {
    // Zod validation errors → 400
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    // Database / unexpected errors → 500
    console.error('[register] Unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}