// src/lib/groq.ts

import Groq from 'groq-sdk'

/**
 * Use createGroqClient for user-provided keys, defaultGroqClient for server default.
 */

export function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey })
}

export const defaultGroqClient: Groq | undefined =
  process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : undefined