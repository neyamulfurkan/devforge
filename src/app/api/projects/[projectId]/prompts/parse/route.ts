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

interface SpecArrayItem {
  fileNumber: string
  filePath: string
  phase: number
  phaseName: string
  requiredFiles: string[]
  specSummary: string
  keyLogic: string
}

// ─── Helper: parse plain-text FILE NNN: output ───────────────────────────────

function parseTextBasedOutput(raw: string): SpecArrayItem[] {
  const items: SpecArrayItem[] = []

  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^#+\s*/gm, '')
    .replace(/^\*\*(FILE)/gm, '$1')
    .replace(/\*\*\s*$/gm, '')
    .replace(/^`(FILE)/gm, '$1')
    .replace(/`\s*$/gm, '')

  const sections = normalized.split(/(?=^FILE\s+\d+[a-zA-Z]?\s*[:\-–])/m)

  for (const section of sections) {
    const trimmed = section.trim()
    if (!trimmed) continue

    const headerMatch = trimmed.match(/^FILE\s+(\d+[a-zA-Z]?)\s*:\s*(.+)$/m)
    if (!headerMatch) continue

    const rawNum = headerMatch[1]
    const numPart = rawNum.replace(/[a-zA-Z]$/i, '')
    const letterPart = rawNum.match(/[a-zA-Z]$/i)?.[0] ?? ''
    const fileNumber = numPart.padStart(3, '0') + letterPart
    const filePath = headerMatch[2].trim().split(/\s+[—–-]\s+/)[0]?.trim() ?? headerMatch[2].trim()

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

// ─── Helper: strip markdown fences ───────────────────────────────────────────

function stripCodeFences(raw: string): string {
  let text = raw.trim()

  // Strip any leading markdown code fence (```json, ```typescript, ``` etc.)
  text = text.replace(/^```[\w]*\s*/i, '').replace(/\s*```$/i, '').trim()

  // If it already starts with [ or {, return as-is — do NOT re-slice by bracket
  // because nested [] inside values (e.g. "requiredFiles": []) corrupt the slice
  if (text.startsWith('[') || text.startsWith('{')) {
    return text
  }

  // Only extract by bracket search if there's leading prose before the JSON
  const arrayStart = text.indexOf('[')
  const arrayEnd = text.lastIndexOf(']')
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    return text.slice(arrayStart, arrayEnd + 1).trim()
  }

  const objStart = text.indexOf('{')
  const objEnd = text.lastIndexOf('}')
  if (objStart !== -1 && objEnd > objStart) {
    return text.slice(objStart, objEnd + 1).trim()
  }

  return text
}

// ─── Helper: parse and validate the JSON array ───────────────────────────────

function parseSpecArray(raw: string): SpecArrayItem[] {
  const stripped = stripCodeFences(raw)

  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    return parseTextBasedOutput(stripped)
  }

  let parsedArray: unknown[]

  if (Array.isArray(parsed)) {
    parsedArray = parsed
  } else if (parsed !== null && typeof parsed === 'object') {
    const wrapper = parsed as Record<string, unknown>
    const arrayVal = Object.values(wrapper).find((v) => Array.isArray(v))
    if (arrayVal) {
      parsedArray = arrayVal as unknown[]
    } else {
      throw new Error('Parsed JSON is not an array and contains no array field.')
    }
  } else {
    throw new Error('Parsed JSON is not an array. Expected an array of file spec objects.')
  }

  const validated: SpecArrayItem[] = []
  for (let i = 0; i < parsedArray.length; i++) {
    const item = parsedArray[i] as Record<string, unknown>

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

// ─── Helper: build filePrompt seed ───────────────────────────────────────────

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

  let specs: SpecArrayItem[]
  try {
    specs = parseSpecArray(rawOutput)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse spec array'
    return NextResponse.json({ error: message }, { status: 422 })
  }

  if (specs.length === 0) {
    return NextResponse.json(
      { error: 'No file prompts could be detected. Ensure you pasted a JSON array or FILE NNN: formatted output.' },
      { status: 422 }
    )
  }

  const existingFiles = await prisma.projectFile.findMany({
    where: { projectId },
    select: { id: true, fileNumber: true, filePath: true },
  })

  const fileByNumber = new Map(existingFiles.map((f) => [f.fileNumber, f]))
  const fileByPath = new Map(existingFiles.map((f) => [f.filePath, f]))

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