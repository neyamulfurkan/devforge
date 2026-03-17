import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function POST(): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/devprobe/ping failed:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}