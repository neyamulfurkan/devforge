import Groq from 'groq-sdk'
import { createGroqClient, defaultGroqClient } from '@/lib/groq'

type ChatParams = {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  max_tokens: number
  temperature?: number
}

const DEFAULT_MODEL = process.env.GROQ_DEFAULT_MODEL ?? 'llama3-70b-8192'

async function safeGroqCall(
  client: Groq,
  params: ChatParams
): Promise<string | null> {
  try {
    const response = await client.chat.completions.create(params)
    return response.choices[0]?.message?.content ?? null
  } catch (err) {
    // Log internally — never expose API key or raw error to callers
    const message = err instanceof Error ? err.message : 'Unknown Groq error'
    console.error('[groqService] safeGroqCall failed:', message)
    return null
  }
}

function resolveClient(apiKey?: string): Groq | null {
  if (apiKey) return createGroqClient(apiKey)
  if (defaultGroqClient) return defaultGroqClient
  return null
}

export async function enhanceProjectDescription(
  description: string,
  apiKey?: string
): Promise<string | null> {
  const client = resolveClient(apiKey)
  if (!client) return null

  const model = DEFAULT_MODEL

  return safeGroqCall(client, {
    model,
    max_tokens: 4096,
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'You are a technical product analyst. Enhance the provided project description by adding technical specifics, implementation details, and clarifying intent — while preserving every requirement the user stated. Return only the enhanced description text, no preamble.',
      },
      {
        role: 'user',
        content: description,
      },
    ],
  })
}

export async function generateWithTemplate(
  template: string,
  variables: Record<string, string>,
  apiKey?: string
): Promise<string | null> {
  const client = resolveClient(apiKey)
  if (!client) return null

  // Substitute {{VARIABLE}} placeholders
  const prompt = template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return variables[key] ?? `{{${key}}}`
  })

  return safeGroqCall(client, {
    model: DEFAULT_MODEL,
    max_tokens: 8192,
    temperature: 0.5,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })
}

export async function testGroqConnection(
  apiKey: string
): Promise<{ connected: boolean; error?: string }> {
  const client = createGroqClient(apiKey)

  const result = await safeGroqCall(client, {
    model: DEFAULT_MODEL,
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Hi' }],
  })

  if (result !== null) {
    return { connected: true }
  }

  // safeGroqCall swallowed the real error; return a safe generic message
  return { connected: false, error: 'Connection failed — check your API key and try again.' }
}