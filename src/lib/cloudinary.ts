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
        // For avatars: overwrite the same public_id so each user has one avatar slot.
        // For assets: use a unique timestamp-based public_id.
        public_id: type === 'avatar' ? 'profile' : undefined,
        overwrite: type === 'avatar',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          // Auto-quality and auto-format for optimal delivery
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