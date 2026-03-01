// 1. Type imports
import type { ParsedDocumentSection, ExtractedFile } from '@/types'
import { APPEND_ONLY_SECTIONS, PHASE_NAMES } from '@/lib/constants'

// ─── Parsing Regexes ───────────────────────────────────────────────────────
//
// FIX: Accept any dash variant between the section number and title:
//   em dash  — (U+2014)  ← original contract
//   en dash  – (U+2013)  ← common paste artefact
//   hyphen   -            ← fallback
//   double-hyphen --
//
// The `m` flag is intentionally kept so ^ and $ match per-line when the
// regex is used against the full raw text in updateSectionContent /
// appendToSection.

const DASH = String.raw`[ \t]*[—–\-]+[ \t]*`

// Matches: ## SECTION 1 — TITLE  or  ## SECTION 1.2 — SUBTITLE
const SECTION_REGEX = new RegExp(
  String.raw`^## SECTION (\d+(?:\.\d+)?)${DASH}(.+)$`,
  'm'
)

// Matches: ### SECTION 1.1 — SUBTITLE
const SUBSECTION_REGEX = new RegExp(
  String.raw`^(?:#{1,3} )?SECTION (\d+\.\d+)${DASH}(.+)$`,
  'm'
)

// Matches all common Claude output formats:
//   FILE 001: path/to/file.ts
//   FILE 009b: path/to/file.ts
//   001. path/to/file.ts
//   001: path/to/file.ts
//   1. path/to/file.ts
const FILE_ENTRY_REGEX = /^(?:FILE\s+(\d+[a-zA-Z]?)\s*:\s*(.+)|(\d{3}[a-zA-Z]?)[.:]\s+(.+))$/

// ─── Line normalisation ────────────────────────────────────────────────────

/**
 * Strip Windows carriage returns so `\r\n` becomes `\n`.
 * Without this every line ends with `\r`, causing the `$` anchor in
 * SECTION_REGEX to never match and the parser to return [].
 */
function normalise(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Count the number of words in a string. */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Determine whether a section number is append-only (11, 12, 13). */
function isAppendOnlySection(sectionNumber: string): boolean {
  return (APPEND_ONLY_SECTIONS as readonly string[]).includes(sectionNumber)
}

/**
 * Derive a phase number from a file number string.
 * Uses the phase groupings defined in Section 9 of the GCD.
 */
function derivePhaseFromFileNumber(fileNumber: string): number {
  const n = parseInt(fileNumber, 10)
  if (n >= 1 && n <= 10) return 1
  if (n >= 11 && n <= 25) return 2
  if (n >= 26 && n <= 33) return 3
  if (n >= 34 && n <= 44) return 4
  if (n >= 45 && n <= 70) return 5
  if (n >= 71 && n <= 75) return 6
  if (n >= 76 && n <= 85) return 7
  if (n >= 86 && n <= 133) return 8
  return 9
}

// ─── Core Parsing ──────────────────────────────────────────────────────────

/**
 * Parse a raw Global Context Document string into a structured array of
 * top-level ParsedDocumentSection objects, each containing nested subsections.
 */
export function parseGlobalDocument(rawText: string): ParsedDocumentSection[] {
  return extractSections(rawText)
}

/**
 * Split the raw document on `## SECTION` delimiters and build the section
 * hierarchy. Each top-level section may contain `### SECTION` subsections.
 */
export function extractSections(rawText: string): ParsedDocumentSection[] {
  // Normalise line endings before splitting
  const lines = normalise(rawText).split('\n')
  const sections: ParsedDocumentSection[] = []

  const sectionStartIndices: Array<{ index: number; number: string; title: string }> = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SECTION_REGEX)
    if (match) {
      sectionStartIndices.push({
        index: i,
        number: match[1],
        title: match[2].trim(),
      })
    }
  }

  for (let s = 0; s < sectionStartIndices.length; s++) {
    const current = sectionStartIndices[s]
    const nextIndex =
      s + 1 < sectionStartIndices.length
        ? sectionStartIndices[s + 1].index
        : lines.length

    const sectionLines = lines.slice(current.index, nextIndex)
    const rawContent = sectionLines.join('\n')
    const subsections = extractSubsections(sectionLines, current.number)

    sections.push({
      sectionNumber: current.number,
      title: current.title,
      rawContent,
      subsections,
      wordCount: countWords(rawContent),
      isAppendOnly: isAppendOnlySection(current.number),
    })
  }

  return sections
}

/**
 * Extract subsections (### SECTION …) from a slice of lines belonging to a
 * parent section. Returns them as ParsedDocumentSection objects (two levels deep).
 */
function extractSubsections(
  lines: string[],
  parentNumber: string
): ParsedDocumentSection[] {
  void parentNumber

  const subsections: ParsedDocumentSection[] = []
  const subsectionStarts: Array<{ index: number; number: string; title: string }> = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SUBSECTION_REGEX)
    if (match) {
      subsectionStarts.push({ index: i, number: match[1], title: match[2].trim() })
    }
  }

  for (let s = 0; s < subsectionStarts.length; s++) {
    const current = subsectionStarts[s]
    const nextIndex =
      s + 1 < subsectionStarts.length ? subsectionStarts[s + 1].index : lines.length

    const subLines = lines.slice(current.index, nextIndex)
    const rawContent = subLines.join('\n')

    subsections.push({
      sectionNumber: current.number,
      title: current.title,
      rawContent,
      subsections: [],
      wordCount: countWords(rawContent),
      isAppendOnly: isAppendOnlySection(current.number),
    })
  }

  return subsections
}

// ─── Section 9 Dependency Parsing ─────────────────────────────────────────

/**
 * Extract all FILE NNN references from an arbitrary string.
 * Returns an array of zero-padded three-digit strings e.g. ["078", "079"].
 * Handles: "FILE 078", "FILE 079", "FILE 009b" (letter suffix preserved).
 */
function extractFileRefs(text: string): string[] {
  const matches = text.match(/FILE\s+(\d{3}[a-z]?)/gi) ?? []
  return matches.map((m) => {
    const raw = m.replace(/^FILE\s+/i, '')
    // Preserve letter suffix; zero-pad the numeric part only
    const numPart = raw.replace(/[a-z]$/i, '')
    const letterPart = raw.match(/[a-z]$/i)?.[0] ?? ''
    return numPart.padStart(3, '0') + letterPart
  })
}

/**
 * Expand a numeric range into zero-padded file number keys.
 * e.g. expandRange(59, 76) → ["059", "060", ..., "076"]
 */
function expandRange(from: number, to: number): string[] {
  const keys: string[] = []
  for (let n = from; n <= to; n++) {
    keys.push(String(n).padStart(3, '0'))
  }
  return keys
}

/**
 * Parse Section 9 of the GCD and return a map of fileNumber → requiredFiles[].
 *
 * Handles all formats found in real GCDs:
 *
 * 1. Exact file header with deps on next line(s):
 *      FILE 083: src/lib/pdf.ts
 *        Required: FILE 085
 *
 * 2. Exact file header with multiple deps:
 *      FILE 046: src/app/api/orders/create/route.ts
 *        Required: FILE 078, FILE 079, FILE 081, FILE 084, FILE 085
 *
 * 3. Exact file header with "Required: None":
 *      FILE 080: src/lib/ai.ts
 *        Required: None
 *
 * 4. Range block header with shared deps:
 *      FILE 059–076: src/app/api/admin/ * /route.ts
 *        Required: FILE 078, FILE 079, FILE 082, FILE 083, FILE 081, FILE 084
 *
 * 5. Prose range with inline deps:
 *      All page.tsx files (FILE 006–038) — Phase 10
 *      Required: Phase 9 layouts + Phase 8 components + Phase 5-7 API routes
 *        (FILE refs extracted wherever found)
 *
 * 6. Phase 8 inline parenthetical deps:
 *      FILE 091: src/components/storefront/ProductCard.tsx — Phase 8 (requires FILE 086, 087, 085)
 *
 * 7. Multi-line dep lists with bullet/dash prefixes:
 *      Required dependencies:
 *        - FILE 011: src/lib/constants.ts
 *        - FILE 012: src/types/index.ts
 */
function extractSection9Dependencies(rawText: string): Map<string, string[]> {
  const depMap = new Map<string, string[]>()

  const sections = extractSections(rawText)
  const section9 = sections.find((s) => s.sectionNumber === '9')
  if (!section9) return depMap

  const lines = section9.rawContent.split('\n')

  // currentKeys holds all file number keys the current block applies to.
  // A single exact FILE NNN line → one key. A range → many keys.
  let currentKeys: string[] = []
  let inDepsBlock = false

  /**
   * Write dep entries to every key in currentKeys.
   */
  const addDeps = (refs: string[]): void => {
    for (const key of currentKeys) {
      const existing = depMap.get(key) ?? []
      const toAdd = refs.filter((r) => !existing.includes(r))
      if (toAdd.length > 0) {
        depMap.set(key, [...existing, ...toAdd])
      }
    }
  }

  /**
   * Ensure every key in currentKeys has an entry (even if empty),
   * so files with no deps still appear in the map.
   */
  const ensureKeys = (keys: string[]): void => {
    for (const key of keys) {
      if (!depMap.has(key)) depMap.set(key, [])
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // ── 1. Exact file header: "FILE 083: src/lib/pdf.ts ..."
    const exactMatch = trimmed.match(/^FILE (\d{3}[a-z]?):/i)
    if (exactMatch) {
      const raw = exactMatch[1]
      const numPart = raw.replace(/[a-z]$/i, '')
      const letterPart = raw.match(/[a-z]$/i)?.[0] ?? ''
      const key = numPart.padStart(3, '0') + letterPart

      currentKeys = [key]
      inDepsBlock = false
      ensureKeys(currentKeys)

      // Handle parenthetical inline deps: "(requires FILE 086, 087, 085)"
      const parenMatch = trimmed.match(/\(requires\s+([^)]+)\)/i)
      if (parenMatch) {
        const refs = extractFileRefs(parenMatch[1])
        if (refs.length > 0) addDeps(refs)
      }
      continue
    }

    // ── 2. Range header: "FILE 059–076: ..." or "files (FILE 006–038)"
    const rangeMatch = trimmed.match(/FILE\s+(\d{3})[a-z]?\s*[–—\-~]+\s*(\d{3})[a-z]?/i)
    if (rangeMatch) {
      const from = parseInt(rangeMatch[1], 10)
      const to = parseInt(rangeMatch[2], 10)
      currentKeys = expandRange(from, to)
      inDepsBlock = false
      ensureKeys(currentKeys)
      continue
    }

    // Nothing parsed yet — skip
    if (currentKeys.length === 0) continue

    // ── 3. Required line (all variants):
    //    "Required: FILE 078"
    //    "Required: FILE 078, FILE 079"
    //    "Required dependencies: FILE 078"
    //    "Required dependencies:"  (deps follow on next lines)
    //    "Required: None"
    //    "Required: Phase 9 layouts + Phase 8 components (FILE 004, FILE 005)"
    if (/^\s*required(\s+dependencies)?:/i.test(line)) {
      inDepsBlock = true

      const colonIdx = trimmed.indexOf(':')
      const inline = trimmed.slice(colonIdx + 1).trim()

      // "None" → no deps, close block
      if (!inline || /^none/i.test(inline)) {
        inDepsBlock = false
        continue
      }

      // Extract any FILE NNN references from the inline text
      const refs = extractFileRefs(inline)
      if (refs.length > 0) {
        addDeps(refs)
        // If all deps were inline, no continuation needed
        inDepsBlock = false
      }
      // If inline text exists but has no FILE refs (e.g. "Phase 9 layouts + ..."),
      // keep inDepsBlock = true to catch any refs on continuation lines
      continue
    }

    // ── 4. Inside a deps block — collect continuation lines
    if (inDepsBlock) {
      // A label line ending with ":" (e.g. "Imports:", "Exports:", "Key logic:") ends the block
      if (trimmed && /^[A-Za-z][\w\s]*:/.test(trimmed) && !/^FILE/i.test(trimmed)) {
        inDepsBlock = false
        // Fall through — this line might be "Imports: ..." which we don't need
        continue
      }

      // Blank line ends the block
      if (!trimmed) {
        inDepsBlock = false
        continue
      }

      // Collect all FILE NNN refs from this continuation line
      const refs = extractFileRefs(trimmed)
      if (refs.length > 0) addDeps(refs)
    }
  }

  return depMap
}

// ─── File Tree Extraction ──────────────────────────────────────────────────

/**
 * Extract the ordered file tree from Section 4 of the Global Context Document.
 * Also reads Section 9 to populate requiredFiles for each file.
 */
export function extractFileTree(rawText: string): ExtractedFile[] {
  const sections = extractSections(rawText)
  const section4 = sections.find((s) => s.sectionNumber === '4')

  if (!section4) return []

  const depMap = extractSection9Dependencies(rawText)
  const lines = section4.rawContent.split('\n')
  const files: ExtractedFile[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    // Strip common markdown decorators Claude applies to file entries:
    //   - Leading bullet/dash:  "- FILE 001: ..."  →  "FILE 001: ..."
    //   - Surrounding bold:    "**FILE 001: ...**" →  "FILE 001: ..."
    //   - Surrounding backtick: "`FILE 001: ...`"  →  "FILE 001: ..."
    const deduped = trimmed
      .replace(/^[-•*]\s+/, '')
      .replace(/^\*\*(.+)\*\*$/, '$1')
      .replace(/^`(.+)`$/, '$1')
      .trim()

    const match = deduped.match(FILE_ENTRY_REGEX)
    if (!match) continue

    const fileNumber = (match[1] ?? match[3]).replace(/^0+/, '').padStart(3, '0')
    const filePath = (match[2] ?? match[4]).trim()

    // Strip inline comments after " — " so filePath is clean
    const cleanFilePath = filePath.split(/\s+[—–-]\s+/)[0]?.trim() ?? filePath

    const segments = cleanFilePath.split('/')
    const fileName = segments[segments.length - 1] ?? cleanFilePath
    const phase = derivePhaseFromFileNumber(fileNumber)
    const phaseName = PHASE_NAMES[phase] ?? 'Pages, API Routes, and Config Files'

    // Zero-pad for dep map lookup (handles letter suffix e.g. "009b")
    const numPart = fileNumber.replace(/[a-z]$/i, '')
    const letterPart = fileNumber.match(/[a-z]$/i)?.[0] ?? ''
    const paddedKey = numPart.padStart(3, '0') + letterPart

    const allDeps = depMap.get(paddedKey) ?? []
    const currentNum = parseInt(fileNumber, 10)
    const filteredDeps = allDeps.filter((dep) => {
      const numPart = dep.replace(/[a-z]$/i, '')
      return parseInt(numPart, 10) < currentNum
    })

    files.push({
      fileNumber,
      filePath: cleanFilePath,
      fileName,
      phase,
      phaseName,
      requiredFiles: filteredDeps,
    })
  }

  // Deduplicate by fileNumber — keeps last occurrence
  const seen = new Map<string, ExtractedFile>()
  for (const file of files) {
    seen.set(file.fileNumber, file)
  }
  const deduped = Array.from(seen.values())

  deduped.sort((a, b) => {
    const numA = parseInt(a.fileNumber, 10)
    const numB = parseInt(b.fileNumber, 10)
    if (numA !== numB) return numA - numB
    return a.fileNumber < b.fileNumber ? -1 : a.fileNumber > b.fileNumber ? 1 : 0
  })

  return deduped
}

// ─── Section Lookup ────────────────────────────────────────────────────────

/** Find a section (or subsection) by its section number string. */
export function findSectionByNumber(
  sections: ParsedDocumentSection[],
  number: string
): ParsedDocumentSection | null {
  for (const section of sections) {
    if (section.sectionNumber === number) return section
    const found = findSectionByNumber(section.subsections, number)
    if (found) return found
  }
  return null
}

// ─── Document Mutation ─────────────────────────────────────────────────────

/**
 * Return a new rawText string with the content of the given section replaced.
 */
export function updateSectionContent(
  rawText: string,
  sectionNumber: string,
  newContent: string
): string {
  const lines = normalise(rawText).split('\n')

  let sectionStartLine = -1
  let sectionEndLine = lines.length
  let foundHeader = false

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SECTION_REGEX)
    if (match) {
      if (match[1] === sectionNumber) {
        sectionStartLine = i
        foundHeader = true
      } else if (foundHeader) {
        sectionEndLine = i
        break
      }
    }
  }

  if (sectionStartLine === -1) return rawText

  const before = lines.slice(0, sectionStartLine + 1)
  const after = lines.slice(sectionEndLine)

  return [...before, newContent.trimEnd(), ...after].join('\n')
}

/**
 * Append content to the end of the specified section in rawText.
 */
export function appendToSection(
  rawText: string,
  sectionNumber: string,
  appendContent: string
): string {
  const lines = normalise(rawText).split('\n')

  let sectionStartLine = -1
  let sectionEndLine = lines.length
  let foundHeader = false

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SECTION_REGEX)
    if (match) {
      if (match[1] === sectionNumber) {
        sectionStartLine = i
        foundHeader = true
      } else if (foundHeader) {
        sectionEndLine = i
        break
      }
    }
  }

  if (sectionStartLine === -1) {
    return rawText.trimEnd() + '\n\n' + appendContent.trim()
  }

  let insertAt = sectionEndLine
  for (let i = sectionEndLine - 1; i > sectionStartLine; i--) {
    if (lines[i].trim() !== '') {
      insertAt = i + 1
      break
    }
  }

  const before = lines.slice(0, insertAt)
  const after = lines.slice(insertAt)

  return [...before, '', appendContent.trim(), ...after].join('\n')
}

// ─── Raw Content Normalizer ────────────────────────────────────────────────

/**
 * Normalize a raw document string to ensure:
 * 1. Section headers have the required "## " prefix
 * 2. Flat pipe-separated Section 11 entries are split onto individual lines
 *
 * Safe to run on already-normalized content — idempotent.
 */
export function normalizeRawContent(raw: string): string {
  let result = normalise(raw)

  // 1. Add "## " before bare "SECTION N — ..." headers
  result = result.replace(
    /^(SECTION \d+(?:\.\d+)?\s*[—–\-]+\s*.+)$/gm,
    (match) => (match.startsWith('#') ? match : `## ${match}`)
  )

  // 2. Fix flat pipe-separated entries: "001 | x | PENDING 002 | y | PENDING"
  // Insert a newline between adjacent entries
  result = result.replace(
    /(\d{3}[a-z]? \| [^|]+ \| \w+) (?=\d{3}[a-z]? \|)/g,
    '$1\n'
  )

  // 3. Strip bold/backtick wrappers from FILE NNN: lines so the parser
  //    never has to handle decorated entries.
  //    "**FILE 001: src/app/page.tsx**"  →  "FILE 001: src/app/page.tsx"
  //    "`FILE 001: src/app/page.tsx`"    →  "FILE 001: src/app/page.tsx"
  result = result.replace(
    /^(?:\*\*|`)((FILE\s+\d+[a-zA-Z]?\s*:.+?))(?:\*\*|`)$/gm,
    '$1'
  )

  // 4. Strip leading bullet/dash from FILE NNN: lines
  //    "- FILE 001: src/app/page.tsx"  →  "FILE 001: src/app/page.tsx"
  result = result.replace(
    /^[-•]\s+(FILE\s+\d+[a-zA-Z]?\s*:.+)$/gm,
    '$1'
  )

  return result
}