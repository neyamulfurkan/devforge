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

// ─── Step 1: Strip wrapper noise ─────────────────────────────────────────────
//
// AI models sometimes wrap JSON in markdown code fences, add preamble prose,
// or append trailing notes. This step removes all of that before parsing.

function stripWrapperNoise(raw: string): string {
  let text = raw.trim()

  // Remove markdown code fences: ```json ... ``` or ``` ... ```
  // Handles multiline fences with any language tag
  text = text.replace(/^```[\w]*\r?\n?([\s\S]*?)\r?\n?```$/m, '$1').trim()

  // If the text now starts with [ or {, it's clean — return immediately.
  // Do NOT attempt bracket-search re-slicing because nested [] or {} inside
  // string values will produce a corrupt slice.
  if (text.startsWith('[') || text.startsWith('{')) {
    return text
  }

  // The text has leading prose before the JSON (e.g. "Here is the output:\n[...")
  // Find the first [ or { that starts a JSON structure.
  const firstBracket = text.indexOf('[')
  const firstBrace = text.indexOf('{')

  let jsonStart = -1
  if (firstBracket !== -1 && firstBrace !== -1) {
    jsonStart = Math.min(firstBracket, firstBrace)
  } else if (firstBracket !== -1) {
    jsonStart = firstBracket
  } else if (firstBrace !== -1) {
    jsonStart = firstBrace
  }

  if (jsonStart !== -1) {
    // Extract from the first structural character to the end
    // and let the JSON parser handle the rest — don't use lastIndexOf
    // because it will match inner brackets, not the outer closing bracket.
    return text.slice(jsonStart).trim()
  }

  return text
}

// ─── Step 2: Sanitize invalid escape sequences ───────────────────────────────
//
// AI models frequently produce invalid JSON by including regex patterns,
// Windows paths, or LaTeX inside string values with unescaped backslashes.
//
// Valid JSON escape sequences: \" \\ \/ \b \f \n \r \t \uXXXX
// Everything else (e.g. \s \d \w \+ \. \( \) \1 \p \S) is illegal.
//
// This function doubles any backslash NOT followed by a valid escape character,
// turning illegal \s into \\s (a literal backslash + s), which is valid JSON.

function sanitizeBackslashes(text: string): string {
  // Regex: match a backslash NOT followed by valid JSON escape chars
  // Valid: " \ / b f n r t u (and then 4 hex digits for \uXXXX)
  return text.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
}

// ─── Step 3: Sanitize unescaped control characters ───────────────────────────
//
// JSON strings must not contain raw control characters (0x00–0x1F).
// AI outputs sometimes include raw tab (\t) or newline (\n) characters
// inside string values instead of their escaped forms.
// NOTE: We only fix characters that are INSIDE strings, not structural whitespace.
// The safest approach: replace literal control chars that appear inside JSON strings.

function sanitizeControlCharacters(text: string): string {
  // Replace literal newlines/tabs/carriage returns inside JSON string values
  // by escaping them. We do a global replace of chars that are illegal in JSON strings.
  // This is safe because structural JSON newlines appear between values (outside strings).
  return text
    .replace(/\t/g, '\\t')   // literal tab → \t
    .replace(/\r\n/g, '\\n') // Windows CRLF inside strings → \n
    .replace(/\r/g, '\\n')   // bare CR → \n
    // Do NOT replace \n globally — they are structural JSON whitespace between keys
}

// ─── Step 4: Attempt progressive JSON repair ─────────────────────────────────
//
// If standard JSON.parse fails after sanitization, try progressive repairs:
// 1. Remove trailing commas before ] or } (common AI mistake)
// 2. Attempt to extract a valid JSON array substring
// 3. Fall back to line-by-line object extraction

function removeTrailingCommas(text: string): string {
  // Remove trailing commas before closing brackets/braces
  // e.g. [1, 2, 3,] → [1, 2, 3]  and  {"a":1,} → {"a":1}
  return text.replace(/,(\s*[}\]])/g, '$1')
}

function tryExtractJsonArray(text: string): string | null {
  // Find the outermost [ ... ] by counting bracket depth
  const start = text.indexOf('[')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

// ─── Step 5: Object-by-object extraction (last resort) ───────────────────────
//
// If the entire array cannot be parsed (e.g. one corrupt entry breaks the whole
// thing), extract valid objects one by one and skip the broken ones.

function extractObjectsOneByOne(text: string): SpecArrayItem[] {
  const results: SpecArrayItem[] = []
  let pos = 0

  while (pos < text.length) {
    const start = text.indexOf('{', pos)
    if (start === -1) break

    let depth = 0
    let inString = false
    let escape = false
    let end = -1

    for (let i = start; i < text.length; i++) {
      const ch = text[i]

      if (escape) { escape = false; continue }
      if (ch === '\\' && inString) { escape = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue

      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }

    if (end === -1) break

    const chunk = text.slice(start, end + 1)
    try {
      const sanitized = sanitizeBackslashes(chunk)
      const obj = JSON.parse(sanitized) as Record<string, unknown>
      if (typeof obj.fileNumber === 'string' && typeof obj.filePath === 'string') {
        results.push(normalizeSpecItem(obj, results.length))
      }
    } catch {
      // Skip this object, continue to next
    }

    pos = end + 1
  }

  return results
}

// ─── Step 6: Plain-text FILE NNN: format parser ──────────────────────────────
//
// Handles Claude's alternative output format where files are separated by headers:
//   FILE 001: src/app/page.tsx
//   ---
//   <prompt content>

function parseTextBasedOutput(raw: string): SpecArrayItem[] {
  const items: SpecArrayItem[] = []

  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^#+\s*/gm, '')          // strip markdown headers
    .replace(/^\*\*(FILE)/gm, '$1')   // strip bold markers from FILE lines
    .replace(/\*\*\s*$/gm, '')
    .replace(/^`(FILE)/gm, '$1')      // strip backtick markers
    .replace(/`\s*$/gm, '')

  // Split on FILE NNN: headers (handles letter suffixes like 009b)
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

// ─── Normalize a raw parsed object into a SpecArrayItem ──────────────────────

function normalizeSpecItem(item: Record<string, unknown>, index: number): SpecArrayItem {
  // fileNumber: accept number or string, zero-pad to 3 digits
  let fileNumber = ''
  if (typeof item.fileNumber === 'string') {
    fileNumber = item.fileNumber.trim()
  } else if (typeof item.fileNumber === 'number') {
    fileNumber = String(item.fileNumber).padStart(3, '0')
  }

  // filePath: strip any leading FILE NNN: prefix that AI sometimes adds
  let filePath = ''
  if (typeof item.filePath === 'string') {
    filePath = item.filePath.trim().replace(/^FILE\s+\d+[a-zA-Z]?\s*:\s*/i, '')
  }

  if (!fileNumber) throw new Error(`Item at index ${index} is missing fileNumber`)
  if (!filePath) throw new Error(`Item at index ${index} (${fileNumber}) is missing filePath`)

  return {
    fileNumber,
    filePath,
    phase: typeof item.phase === 'number' ? item.phase : 0,
    phaseName: typeof item.phaseName === 'string' ? item.phaseName : '',
    requiredFiles: Array.isArray(item.requiredFiles)
      ? (item.requiredFiles as unknown[]).filter((r): r is string => typeof r === 'string')
      : [],
    specSummary: typeof item.specSummary === 'string' ? item.specSummary : '',
    keyLogic: typeof item.keyLogic === 'string' ? item.keyLogic : '',
  }
}

// ─── Master parse pipeline ────────────────────────────────────────────────────
//
// Tries multiple strategies in order, returning the first successful result.
// Never throws — always returns an array (possibly empty).

function parseSpecArray(raw: string): SpecArrayItem[] {
  // ── Strategy 1: Strip noise, sanitize, parse ──────────────────────────────
  const stripped = stripWrapperNoise(raw)
  const sanitized = sanitizeBackslashes(stripped)

  try {
    const parsed = JSON.parse(sanitized)
    const arr = extractArray(parsed)
    if (arr && arr.length > 0) {
      return arr.map((item, i) => normalizeSpecItem(item as Record<string, unknown>, i))
    }
  } catch {
    // fall through to next strategy
  }

  // ── Strategy 2: Remove trailing commas, then parse ────────────────────────
  try {
    const cleaned = removeTrailingCommas(sanitized)
    const parsed = JSON.parse(cleaned)
    const arr = extractArray(parsed)
    if (arr && arr.length > 0) {
      return arr.map((item, i) => normalizeSpecItem(item as Record<string, unknown>, i))
    }
  } catch {
    // fall through
  }

  // ── Strategy 3: Extract outermost array by bracket counting ───────────────
  try {
    const extracted = tryExtractJsonArray(sanitized)
    if (extracted) {
      const cleaned = removeTrailingCommas(extracted)
      const parsed = JSON.parse(cleaned)
      const arr = extractArray(parsed)
      if (arr && arr.length > 0) {
        return arr.map((item, i) => normalizeSpecItem(item as Record<string, unknown>, i))
      }
    }
  } catch {
    // fall through
  }

  // ── Strategy 4: Object-by-object extraction (tolerates corrupt entries) ───
  const objects = extractObjectsOneByOne(sanitized)
  if (objects.length > 0) {
    return objects
  }

  // ── Strategy 5: Plain-text FILE NNN: format ───────────────────────────────
  const textBased = parseTextBasedOutput(raw)
  if (textBased.length > 0) {
    return textBased
  }

  // All strategies exhausted
  return []
}

// ─── Helper: extract array from parsed value ─────────────────────────────────

function extractArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed

  if (parsed !== null && typeof parsed === 'object') {
    // Handle wrapped formats: { files: [...] }, { data: [...] }, { prompts: [...] }, etc.
    const wrapper = parsed as Record<string, unknown>
    const arrayVal = Object.values(wrapper).find((v) => Array.isArray(v))
    if (arrayVal) return arrayVal as unknown[]
  }

  return null
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

  // Cap input size at 10MB to prevent abuse
  if (rawOutput.length > 10_000_000) {
    return NextResponse.json(
      { error: 'rawOutput exceeds maximum allowed size of 10MB' },
      { status: 413 }
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
      {
        error:
          'No file prompts could be detected. The input must be either:\n' +
          '(1) A JSON array of objects with fileNumber and filePath fields, or\n' +
          '(2) Plain text with FILE NNN: path headers.\n' +
          'Make sure you pasted Claude\'s complete, unmodified response.',
      },
      { status: 422 }
    )
  }

  // Fetch all existing project files
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