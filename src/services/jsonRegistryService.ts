// 1. Type imports
import type { JsonRegistryEntry, ParsedDocumentSection } from '@/types'
import { appendToSection, findSectionByNumber, extractSections } from '@/services/documentParser'

// ─── Constants ─────────────────────────────────────────────────────────────

const REQUIRED_FIELDS: Array<keyof JsonRegistryEntry> = [
  'file',
  'fileNumber',
  'exports',
  'imports',
  'keyLogic',
  'status',
]

const SECTION_11_NUMBER = '11'

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validate that a parsed JSON value contains all required JsonRegistryEntry fields.
 * Returns { valid: true, errors: [] } on success, or { valid: false, errors: [...] }
 * with specific field-level messages on failure.
 */
export function validateJsonSummary(json: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, errors: ['Value must be a JSON object'] }
  }

  const obj = json as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      errors.push(`Missing field: ${field}`)
      continue
    }

    // Type-specific checks
    if (field === 'exports' || field === 'imports') {
      if (!Array.isArray(obj[field])) {
        errors.push(`Field "${field}" must be an array`)
      }
    } else if (typeof obj[field] !== 'string') {
      errors.push(`Field "${field}" must be a string`)
    } else if ((obj[field] as string).trim() === '') {
      errors.push(`Field "${field}" must not be empty`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ─── Formatting ────────────────────────────────────────────────────────────

/**
 * Format a JSON registry entry as a fenced code block with a file number header.
 * The header comment is used by getRegistryEntries to locate individual blocks.
 *
 * Example output:
 * ```
 * 026. {
 *   "file": "src/services/documentParser.ts",
 *   ...
 * }
 * ```
 */
export function formatJsonEntry(json: Record<string, unknown>): string {
  const fileNumber = typeof json['fileNumber'] === 'string' ? json['fileNumber'] : '???'
  const indented = JSON.stringify(json, null, 2)
  return `\n${fileNumber}. ${indented}\n`
}

// ─── Append to Section 11 ──────────────────────────────────────────────────

/**
 * Append a validated JSON registry entry to Section 11 of the raw document.
 *
 * Inserts the entry in sorted position by file number (numeric part first,
 * then full string for letter-suffix tiebreaker: 009 → 009b → 010).
 * Falls back to appending at the end of Section 11 if ordering cannot be
 * determined or the section does not yet contain any entries.
 */
export function appendJsonToSection11(
  rawDocContent: string,
  jsonEntry: Record<string, unknown>
): string {
  const formatted = formatJsonEntry(jsonEntry)

  // Strip the legacy pipe-table lines from Section 11 before appending.
  // These are lines matching: "NNN | some/path | STATUS"
  // They should be replaced by JSON entries going forward.
  const withoutPipeTable = rawDocContent.replace(
    /^[ \t]*\d{3}[a-z]?[ \t]*\|[^\n]+$/gm,
    ''
  )

  // Collapse runs of 3+ blank lines down to 2 (cosmetic cleanup)
  const cleaned = withoutPipeTable.replace(/\n{3,}/g, '\n\n')

  // Guard: if an entry for this fileNumber already exists in ANY format, replace it
  const fileNumber = typeof jsonEntry['fileNumber'] === 'string' ? jsonEntry['fileNumber'] : null
  if (fileNumber) {
    // Match both "NNN. { ... }" prefixed format and bare "{ ... }" format
    const dupePatternPrefixed = new RegExp(
      String.raw`^${fileNumber}\.\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}`,
      'gm'
    )
    const dupePatternBare = new RegExp(
      String.raw`\{[^{}]*"fileNumber"\s*:\s*"${fileNumber}"[\s\S]*?\}`,
      'g'
    )
    if (dupePatternPrefixed.test(cleaned)) {
      return cleaned.replace(dupePatternPrefixed, formatted.trim())
    }
    if (dupePatternBare.test(cleaned)) {
      return cleaned.replace(dupePatternBare, formatted.trim())
    }
  }

  return appendToSection(cleaned, SECTION_11_NUMBER, formatted)
}

// ─── Parse Existing Entries ────────────────────────────────────────────────

/**
 * Extract all JSON registry entries from Section 11 of the raw document.
 *
 * Scans the section content for fenced blocks and bare JSON objects that
 * follow the `NNN. { … }` pattern produced by formatJsonEntry.
 * Returns an array of parsed objects; malformed blocks are skipped silently.
 */
export function getRegistryEntries(rawDocContent: string): Record<string, unknown>[] {
  const sections = extractSections(rawDocContent)
  const section11: ParsedDocumentSection | null = findSectionByNumber(
    sections,
    SECTION_11_NUMBER
  )

  if (!section11) return []

  const content = section11.rawContent
  const entries: Record<string, unknown>[] = []

  // Strategy 1: extract fenced ```json … ``` blocks
  const fencedPattern = /```(?:json)?\s*\n([\s\S]*?)\n```/g
  let fencedMatch: RegExpExecArray | null

  while ((fencedMatch = fencedPattern.exec(content)) !== null) {
    const candidate = fencedMatch[1].trim()
    const parsed = safeParseJsonBlock(candidate)
    if (parsed !== null) entries.push(parsed)
  }

  // Strategy 2: extract bare `NNN. { … }` blocks (as produced by formatJsonEntry)
  // Match the numeric prefix then capture the JSON object that follows.
  const barePattern = /^\d{3}[a-z]?\.\s*(\{[\s\S]*?^\})/gm
  let bareMatch: RegExpExecArray | null

  while ((bareMatch = barePattern.exec(content)) !== null) {
    // Skip if already captured inside a fenced block
    const alreadyCaptured = entries.some((e) => {
      const candidate = bareMatch![1].trim()
      return JSON.stringify(e) === JSON.stringify(safeParseJsonBlock(candidate))
    })
    if (alreadyCaptured) continue

    const parsed = safeParseJsonBlock(bareMatch[1])
    if (parsed !== null) entries.push(parsed)
  }

  return entries
}

// ─── Private Helpers ───────────────────────────────────────────────────────

/**
 * Attempt to parse a string as JSON. Returns the parsed object on success,
 * or null if parsing fails. Never throws.
 */
function safeParseJsonBlock(text: string): Record<string, unknown> | null {
  try {
    const trimmed = text.trim()
    // Strip a leading `NNN. ` prefix if present (bare-block format)
    const withoutPrefix = trimmed.replace(/^\d{3}[a-z]?\.\s*/, '')
    const parsed: unknown = JSON.parse(withoutPrefix)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}