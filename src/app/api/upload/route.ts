// src/app/api/upload/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'

// 3. Cloudinary helper
import { uploadToCloudinary, type UploadType } from '@/lib/cloudinary'

// 4. Types
import type { ApiResponse } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** 10 MB — Cloudinary's free tier supports up to 10 MB per upload. */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

// ─── POST: Upload image to Cloudinary ────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ url: string }>>> {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMimeType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10 MB.' },
        { status: 400 }
      )
    }

    // Resolve upload type from query param
    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get('type') ?? 'asset'
    const uploadType: UploadType = typeParam === 'avatar' ? 'avatar' : 'asset'

    // Convert File → Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Cloudinary
    let publicUrl: string
    try {
      publicUrl = await uploadToCloudinary(buffer, uploadType, session.user.id)
    } catch (uploadError) {
      console.error('[POST /api/upload] Cloudinary upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { url: publicUrl } }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/upload]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}