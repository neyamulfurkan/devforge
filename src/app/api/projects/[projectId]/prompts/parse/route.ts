// src/app/api/projects/[projectId]/prompts/parse/route.ts

// 1. Next.js imports
import { NextRequest, NextResponse } from 'next/server'

// 2. Internal imports — auth & database
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 3. Internal imports — types
import type { ApiResponse } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParseRequestBody {
  rawOutput: string
}

interface ParseResult {
  stored: number
  fileNumbers: string[]
}

// ─── Section 5.11 parsing contract ───────────────────────────────────────────
//
// The rawOutput coming in is Claude's response to the meta-prompt.
// It is a JSON array of per-file spec objects, each with a "fileNumber" field.
// This route:
//   1. Strips markdown code fences if present (Claude sometimes wraps in ```json)
//   2. Parses the JSON array
//   3. Extracts fileNumber → filePrompt text per entry
//   4. Bulk-upserts into ProjectFile.filePrompt for each file in this project
//
// The "prompt" stored per file is the assembled file_specific_prompt string,
// which promptGenerator.generateFilePrompt() produces. However this route
// receives the raw meta-prompt JSON output (spec array), so it stores the
// specSummary + keyLogic as the filePrompt seed — the workspace assembles the
// full prompt client-side from this data when the user clicks "Copy Prompt".
//
// Each item in the JSON array must have at minimum:
//   { fileNumber: string, filePath: string, specSummary: string, keyLogic: string,
//     phase: number, phaseName: string, requiredFiles: string[] }

interface SpecArrayItem {
  fileNumber: string
  filePath: string
  phase: number
  phaseName: string
  requiredFiles: string[]
  specSummary: string
  keyLogic: string
}

// ─── Helper: strip markdown fences ───────────────────────────────────────────

/**
 * Parse plain-text meta-prompt output where Claude separates files using headers like:
 *   FILE 001: src/app/page.tsx
 *   ---
 *   <prompt content>
 *
 *   FILE 002: src/lib/utils.ts
 *   ...
 */
function parseTextBasedOutput(raw: string): SpecArrayItem[] {
  const items: SpecArrayItem[] = []

  // Split on FILE NNN: headers (handles letter suffixes like 009b, 017b, 153b)
  const sections = raw.split(/(?=^FILE\s+\d+[a-zA-Z]?\s*:)/m)

  for (const section of sections) {
    const trimmed = section.trim()
    if (!trimmed) continue

    // Extract file number and path from header line
    const headerMatch = trimmed.match(/^FILE\s+(\d+[a-zA-Z]?)\s*:\s*(.+)$/m)
    if (!headerMatch) continue

    const rawNum = headerMatch[1]
    const numPart = rawNum.replace(/[a-zA-Z]$/i, '')
    const letterPart = rawNum.match(/[a-zA-Z]$/i)?.[0] ?? ''
    const fileNumber = numPart.padStart(3, '0') + letterPart
    const filePath = headerMatch[2].trim().split(/\s+[—–-]\s+/)[0]?.trim() ?? headerMatch[2].trim()

    // Everything after the header line is the prompt content
    const headerEnd = trimmed.indexOf('\n')
    const content = headerEnd >= 0 ? trimmed.slice(headerEnd + 1).trim() : ''

    items.push({
      fileNumber,
      filePath,
      phase: 0,
      phaseName: '',
      requiredFiles: [],
      specSummary: content.slice(0, 200),
      keyLogic: content,
    })
  }

  return items
}

function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

// ─── Helper: parse and validate the JSON array ───────────────────────────────

function parseSpecArray(raw: string): SpecArrayItem[] {
  const stripped = stripCodeFences(raw)

  // Try JSON array first
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    // Fall back to text-based parsing for plain-text meta-prompt output
    return parseTextBasedOutput(stripped)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Parsed JSON is not an array. Expected an array of file spec objects.')
  }

  const validated: SpecArrayItem[] = []
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown>

    if (typeof item.fileNumber !== 'string' || !item.fileNumber.trim()) {
      throw new Error(`Item at index ${i} is missing a valid "fileNumber" string.`)
    }
    if (typeof item.filePath !== 'string' || !item.filePath.trim()) {
      throw new Error(`Item at index ${i} (${item.fileNumber}) is missing a valid "filePath" string.`)
    }

    validated.push({
      fileNumber: item.fileNumber.trim(),
      filePath: item.filePath.trim(),
      phase: typeof item.phase === 'number' ? item.phase : 0,
      phaseName: typeof item.phaseName === 'string' ? item.phaseName : '',
      requiredFiles: Array.isArray(item.requiredFiles)
        ? (item.requiredFiles as unknown[]).filter((r): r is string => typeof r === 'string')
        : [],
      specSummary: typeof item.specSummary === 'string' ? item.specSummary : '',
      keyLogic: typeof item.keyLogic === 'string' ? item.keyLogic : '',
    })
  }

  return validated
}

// ─── Helper: build filePrompt text from a spec item ──────────────────────────
// Stored as the seed prompt — the workspace UI assembles the full prompt
// by calling generateFilePrompt() client-side or at copy time.

function buildFilePromptSeed(item: SpecArrayItem): string {
  const lines: string[] = [
    `FILE ${item.fileNumber}: ${item.filePath}`,
    `Phase ${item.phase} — ${item.phaseName}`,
    '',
    item.specSummary,
  ]

  if (item.keyLogic.trim()) {
    lines.push('', item.keyLogic)
  }

  if (item.requiredFiles.length > 0) {
    lines.push('', 'Required Files:', ...item.requiredFiles)
  }

  return lines.join('\n')
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
): Promise<NextResponse<ApiResponse<ParseResult>>> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { projectId } = await params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse request body
  let body: ParseRequestBody
  try {
    body = (await request.json()) as ParseRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { rawOutput } = body

  if (typeof rawOutput !== 'string' || !rawOutput.trim()) {
    return NextResponse.json(
      { error: 'rawOutput is required and must be a non-empty string' },
      { status: 400 }
    )
  }

  // Parse spec array
  let specs: SpecArrayItem[]
  try {
    specs = parseSpecArray(rawOutput)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse spec array'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  if (specs.length === 0) {
    return NextResponse.json(
      { error: 'Parsed spec array is empty — no files to store' },
      { status: 422 }
    )
  }

  // Fetch all existing project files in one query
  const existingFiles = await prisma.projectFile.findMany({
    where: { projectId },
    select: { id: true, fileNumber: true, filePath: true },
  })

  const fileByNumber = new Map(existingFiles.map((f) => [f.fileNumber, f]))
  const fileByPath = new Map(existingFiles.map((f) => [f.filePath, f]))

  // Build upsert operations
  const storedFileNumbers: string[] = []

  for (const spec of specs) {
    const filePrompt = buildFilePromptSeed(spec)

    const existing = fileByNumber.get(spec.fileNumber) ?? fileByPath.get(spec.filePath)

    if (existing) {
      await prisma.projectFile.update({
        where: { id: existing.id },
        data: {
          filePrompt,
          requiredFiles: spec.requiredFiles,
          updatedAt: new Date(),
        },
      })
      storedFileNumbers.push(spec.fileNumber)
    } else {
      await prisma.projectFile.create({
        data: {
          projectId,
          fileNumber: spec.fileNumber,
          filePath: spec.filePath,
          fileName: spec.filePath.split('/').pop() ?? spec.filePath,
          phase: spec.phase,
          phaseName: spec.phaseName,
          filePrompt,
          requiredFiles: spec.requiredFiles,
        },
      })
      storedFileNumbers.push(spec.fileNumber)
    }
  }

  const currentCount = await prisma.projectFile.count({ where: { projectId } })
  await prisma.project.update({
    where: { id: projectId },
    data: { totalFiles: currentCount, updatedAt: new Date() },
  })

  return NextResponse.json(
    {
      data: {
        stored: storedFileNumbers.length,
        fileNumbers: storedFileNumbers,
      },
    },
    { status: 200 }
  )
}