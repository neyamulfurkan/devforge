// src/lib/cloudinary.ts

// 1. External imports
import { v2 as cloudinary } from 'cloudinary'

// 2. Environment variable validation (server-side only)
const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

if (!cloudName || !apiKey || !apiSecret) {
  // Throw only on the server; Next.js will surface this clearly at startup.
  if (typeof window === 'undefined') {
    throw new Error(
      '[cloudinary] Missing one or more required environment variables: ' +
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET'
    )
  }
}

// 3. Configure the Cloudinary SDK singleton
cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true, // Always use https:// URLs
})

// 4. Export the configured client
export { cloudinary }

// 5. Upload helper — centralises folder strategy and default options
export type UploadType = 'avatar' | 'asset'

export async function uploadToCloudinary(
  buffer: Buffer,
  type: UploadType,
  userId: string
): Promise<string> {
  const folder = type === 'avatar' ? `devforge/avatars/${userId}` : `devforge/assets/${userId}`

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: type === 'avatar' ? 'profile' : undefined,
        overwrite: type === 'avatar',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload returned no result'))
          return
        }
        resolve(result.secure_url)
      }
    )

    uploadStream.end(buffer)
  })
}

// ─── Raw code helpers (server-side only) ─────────────────────────────────────
// Stores actual source code files in Cloudinary as raw text assets.
// public_id format: devforge/code/{projectId}/{fileId}
// resource_type: 'raw' — stores file as-is, no image processing.
// Zero Neon storage used for code content.

function codePublicId(projectId: string, fileId: string): string {
  return `devforge/code/${projectId}/${fileId}`
}

/**
 * Upload source code text to Cloudinary.
 * Returns the secure URL of the stored raw file.
 */
export async function uploadRawCode(
  content: string,
  projectId: string,
  fileId: string
): Promise<string> {
  const buffer = Buffer.from(content, 'utf-8')
  const publicId = codePublicId(projectId, fileId)

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: 'raw',
        overwrite: true,
        // Invalidate CDN cache so fresh content is always served
        invalidate: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary raw upload returned no result'))
          return
        }
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}

/**
 * Fetch source code text from Cloudinary.
 * Returns null if the file does not exist.
 */
export async function fetchRawCode(
  projectId: string,
  fileId: string
): Promise<string | null> {
  try {
    // Build the raw delivery URL directly — faster than an API call
    const publicId = codePublicId(projectId, fileId)
    const url = `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/**
 * Check if a code file exists in Cloudinary without downloading it.
 * Returns metadata object if found, null if not.
 */
export async function checkCodeExists(
  projectId: string,
  fileId: string
): Promise<{ uploadedAt: string; bytes: number } | null> {
  try {
    const publicId = codePublicId(projectId, fileId)
    const result = await cloudinary.api.resource(publicId, {
      resource_type: 'raw',
    })
    return {
      uploadedAt: result.created_at as string,
      bytes: result.bytes as number,
    }
  } catch {
    // resource() throws if not found
    return null
  }
}

/**
 * Delete a code file from Cloudinary.
 * Used after a successful pull-to-local to free storage.
 */
export async function deleteRawCode(
  projectId: string,
  fileId: string
): Promise<void> {
  try {
    const publicId = codePublicId(projectId, fileId)
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
  } catch {
    // Non-fatal — file may already be gone
  }
}