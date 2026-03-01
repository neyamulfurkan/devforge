// src/services/templateService.ts

// 1. External imports
import { prisma } from '@/lib/prisma'

// 2. Type imports
import type { PromptTemplate } from '@/types'
import type { Prisma } from '@prisma/client'

// Prisma separates JsonValue (read type — includes null) from InputJsonValue
// (write type — excludes null). Our variables arrays are always plain JSON
// arrays and never null, so casting through unknown for writes is always safe.
type InputJson = Prisma.InputJsonValue

// 3. Constants imports
import {
  DEFAULT_TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  type DefaultTemplateKey,
} from '@/lib/constants'

// ─── Hardcoded default template content ───────────────────────────────────────

const DEFAULT_TEMPLATE_CONTENT: Record<DefaultTemplateKey, string> = {
  global_context_generator: `You are a world-class software architect and technical writer with deep expertise in production system design. Your task is to produce a complete, authoritative Global Context Document (GCD) for the following software project. This document will serve as the single source of truth for an AI-assisted development workflow — every architectural and structural decision you make here will directly govern how the entire codebase is built.

PROJECT NAME: {{PROJECT_NAME}}
PLATFORM TYPE: {{PLATFORM_TYPE}}
PREFERRED TECH STACK: {{TECH_STACK}}
ADDITIONAL NOTES: {{ADDITIONAL_NOTES}}

PROJECT DESCRIPTION:
{{PROJECT_DESCRIPTION}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: FILE ARCHITECTURE PHILOSOPHY — READ BEFORE WRITING SECTION 4 OR 9
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This project uses an AI-assisted file-by-file generation workflow. Every file you list in Section 4 will be generated individually by an AI model. Unnecessary file proliferation is the single biggest source of quality degradation in this workflow. You must therefore apply strict architectural discipline when deciding the file structure.

PRIME DIRECTIVE: Produce the fewest files possible that still result in a fully production-grade, feature-complete system. File count is a cost, not a measure of quality.

FILE CREATION RULES — YOU MUST FOLLOW THESE:

✅ CREATE a new file ONLY when ONE OR MORE of the following is true:
  1. The file serves a fundamentally distinct runtime context (e.g. server-only vs client-only — Next.js API route vs React component)
  2. The code is genuinely reused by 3 or more other files — not just theoretically reusable, but concretely referenced by multiple consumers in this project
  3. The file is a required framework convention (e.g. layout.tsx, page.tsx, route.ts, middleware.ts, next.config.ts, prisma/schema.prisma)
  4. The file implements a distinct, bounded concern that would cause a maintainability problem if co-located (e.g. a 600-line Prisma schema mixed into application code)
  5. The file is a lazy-loading boundary required for performance (e.g. a heavy component loaded with next/dynamic)

❌ DO NOT create a separate file for:
  - Types or interfaces that are only used in one or two files → co-locate them at the top of the consuming file
  - A utility function used by only one other file → define it in that file
  - A single-export wrapper around a library (e.g. a prisma.ts that only does "export const prisma = new PrismaClient()" is fine, but a file that only re-exports something from another internal file is not)
  - Constants that are only referenced from one module → define them at the top of that module
  - A "service" that only wraps a single Prisma model with basic CRUD — put that logic in the API route handler
  - Barrel index.ts files that only re-export from sibling files — they add indirection without value
  - Splitting a large component into sub-components unless those sub-components are reused elsewhere or the single component would genuinely exceed ~500 lines

FILE SIZE PHILOSOPHY:
  - A well-structured 800-line file is far better than four 200-line files that are tightly coupled and only used together
  - File length alone is NEVER a reason to split — split only on concern boundaries and reuse
  - Large files are acceptable and expected: a complete feature's hook, its service logic, and its shared types may all belong together in one file
  - When in doubt, consolidate. The AI generation workflow handles large files better than it handles fragmented, interdependent small files

ANTI-PATTERNS TO ACTIVELY AVOID:
  ❌ types/index.ts that re-exports every interface in the project (scatter types into their consumers instead, or into a genuine shared types file only if 5+ files use the same types)
  ❌ utils/helpers.ts catch-all files (name utility files by domain: formatters.ts, validators.ts — and only create them if genuinely shared)
  ❌ services/userService.ts that only wraps prisma.user.findMany() (put this in the API route)
  ❌ components/shared/ dumping ground — only create a shared component if it is provably used in 3+ distinct routes or features
  ❌ Splitting context, hook, and provider into three files when they form one logical unit — one file per context is correct

SELF-CHECK BEFORE FINALIZING SECTION 4:
  Before listing each file, ask: "If I delete this file and merge its content into its primary consumer, does anything break architecturally?" If the answer is no — merge it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Now produce the Global Context Document with ALL of the following sections, clearly delimited with ## SECTION headers. Every section must be complete, specific, and production-ready. Do not use placeholders. A developer must be able to build the entire system from this document without asking a single follow-up question.

TOPOLOGICAL ORDER MANDATE — THIS OVERRIDES ALL OTHER ORDERING DECISIONS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The file numbers in Section 4 ARE the generation order. The AI model will generate FILE 001 first, FILE 002 second, and so on — in strict numerical sequence. This means:

RULE: If FILE A imports anything from FILE B, then FILE B must have a LOWER number than FILE A. No exceptions.

SELF-CHECK — before finalizing Section 4 and Section 9, you must verify:
  For every file, scan its Required dependencies in Section 9.
  Every listed dependency must have a file number LESS THAN the current file's number.
  If you find FILE 045 depends on FILE 091 — you have made an error. Either:
    (a) FILE 091 should be renumbered to come before FILE 045, OR
    (b) FILE 045 should be renumbered to come after FILE 091
  Fix it before outputting. Never output a GCD where a file's required dependency has a higher number.

PHASE ORDER IS ALSO STRICT:
  Phase 1 files (001–010): zero or minimal dependencies — foundational config only
  Phase 2 files (011–025): may depend on Phase 1 only
  Phase 3 files (026–033): may depend on Phase 1–2 only
  Phase 4 files (034–044): may depend on Phase 1–3 only
  Phase 5 files (045–070): may depend on Phase 1–4 only
  Phase 6 files (071–075): may depend on Phase 1–5 only
  Phase 7 files (076–085): may depend on Phase 1–6 only
  Phase 8 files (086–133): may depend on Phase 1–7 only
  Phase 9 files (134+):    may depend on any earlier phase
  A Phase 3 file CANNOT depend on a Phase 8 file. If it does, your architecture is wrong — restructure it.

COMMON MISTAKES TO AVOID:
  ❌ A service file (Phase 3) that imports a component's types (Phase 8) — extract those types into Phase 2 instead
  ❌ A hook (Phase 4) that imports from a page (Phase 9) — pages are always last
  ❌ A utility (Phase 2) that imports from a service (Phase 3) — utilities must be self-contained
  ❌ Two files that import from each other — circular dependencies are forbidden

SECTION 9 MANDATORY STANDARD — READ BEFORE WRITING ANY FILE ENTRY:
Section 9 is the most critical section. Every file entry MUST include ALL of the following — no exceptions:
  1. IMPORTS: Every other project file this file imports from, listed as "FILE NNN: path/to/file.ts"
  2. EXPORTS: Every named export with its full TypeScript signature (function name, params, return type)
  3. KEY LOGIC: Specific implementation details — not "handles auth" but "calls bcrypt.compare, returns null on failure, never throws"
  4. CONSTRAINTS: Any non-obvious requirements (e.g. "must be a Server Component", "no useState allowed", "must match Prisma schema field names exactly")
  5. EDGE CASES: Validation rules, error states, and null/empty handling that must be implemented

A vague Section 9 entry causes AI-generated code errors. Write entries that are self-contained: a developer reading only that entry and its listed dependency files must be able to implement the file correctly with zero follow-up questions.

## SECTION 1 — PROJECT OVERVIEW AND VISION
## SECTION 2 — COMPLETE FEATURE WALKTHROUGH AND USER FLOWS
## SECTION 3 — TECHNOLOGY STACK
## SECTION 4 — COMPLETE FILE STRUCTURE

SECTION 4 FORMAT CONTRACT — MANDATORY:
List every file exactly once using this format, one per line, no exceptions:
  FILE 001: src/app/page.tsx
  FILE 002: src/lib/utils.ts
Rules:
  - Zero-pad the file number to 3 digits (001, 012, 115)
  - Append a letter suffix for closely related variants (009a, 009b)
  - No markdown: no bold, no backticks, no bullet points, no table syntax
  - No inline comments after the path — the path must be the last token on the line
  - Every file listed here must have a corresponding entry in Section 9
## SECTION 5 — CODING STANDARDS AND CONVENTIONS
## SECTION 6 — DATABASE SCHEMA
## SECTION 7 — DESIGN SYSTEM AND STYLING
## SECTION 8 — PERFORMANCE AND OPTIMIZATION
## SECTION 9 — FILE GENERATION SEQUENCE
## SECTION 10 — ENVIRONMENT VARIABLES
## SECTION 11 — GENERATED FILE REGISTRY

Leave this section empty. Do not pre-fill any file list, pipe table, or placeholder rows. This section is populated automatically by the platform as files are generated. Output only the section header and nothing else.
## SECTION 12 — NEW FEATURES ADDED
## SECTION 13 — MODIFICATIONS AND DEVIATIONS
## SECTION 14 — WORKFLOW REFERENCE
## SECTION 15 — MANUAL TESTING CHECKLIST
## SECTION 16 — DEPLOYMENT CHECKLIST

CRITICAL OUTPUT INSTRUCTIONS — READ BEFORE RESPONDING:
Your response must be a plain text document. Do not write any code, scripts, or files. Do not wrap your response in markdown code blocks or triple backticks. Do not output JSON. Output only the document itself, starting directly with ## SECTION 1. Begin your response now.`,

  meta_prompt: `You are an expert developer working on {{PROJECT_NAME}}.

Your task is to read the Global Context Document below and produce a single JSON array — one entry per file listed in Section 4.

DO NOT output any text before or after the JSON array.
DO NOT output file-specific prompts, boilerplate, or explanations.
Output ONLY the raw JSON array. Start your response with [ and end with ].

TOTAL FILES: {{TOTAL_FILES}}

FILE LIST (from Section 4):
{{FILE_LIST}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT SCHEMA — one object per file
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[
  {
    "fileNumber": "001",
    "filePath": "src/app/page.tsx",
    "phase": 1,
    "phaseName": "Foundation",
    "requiredFiles": [
      "FILE 002: src/lib/utils.ts",
      "FILE 005: src/components/ui/button.tsx"
    ],
    "specSummary": "One-sentence description of what this file does and its role in the system.",
    "keyLogic": "Key exports, critical imports, implementation details, and any special notes from Section 9."
  }
]

FIELD RULES:
- fileNumber: zero-padded 3-digit string (e.g. "001", "012", "115") — append letter if present (e.g. "001a")
- filePath: exact path from Section 4, no leading slash
- phase: integer phase number from Section 9
- phaseName: exact phase name string from Section 9
- requiredFiles: array of "FILE NNN: path" strings from Section 9 dependencies. Use [] if this file has no project-file dependencies
- specSummary: 1–2 concise sentences describing the file's single responsibility
- keyLogic: the COMPLETE verbatim content of this file's entry in Section 9 — every import, export, function signature, implementation constraint, and edge case. Do NOT truncate, summarize, or paraphrase. A developer reading only this field and the requiredFiles list must be able to implement the file with zero ambiguity. If Section 9 is vague for this file, expand it yourself using the GCD context — never leave keyLogic as a one-liner.

JSON ESCAPING — CRITICAL:
- All string values must be valid JSON. If a value contains a double-quote character ("), you MUST escape it as \\"
- Example — WRONG:  "keyLogic": "Uses @id @default(\\"singleton\\") pattern."
- Example — RIGHT:  "keyLogic": "Uses @id @default(\\"singleton\\") pattern."
- This applies to ALL string fields: specSummary, keyLogic, phaseName, filePath, etc.
- Backslashes must also be escaped: write \\\\ not \\

DEPENDENCY DETECTION RULES — CRITICAL — READ BEFORE POPULATING requiredFiles:
For each file, requiredFiles must list every other project file (from the FILE LIST above) whose exports this file will import at runtime:
- Include file B if file A will call its functions, use its types/interfaces, import its constants, or reference any of its exports
- Include shared utility files, hook files, service files, type files, and config files that this file consumes
- Only include project files from the FILE LIST — never external packages (react, next, prisma, zod, etc.)
- When uncertain whether a dependency is needed, INCLUDE IT — a false positive is recoverable; a missing dependency causes generation failure
- Format every entry exactly as it appears in the FILE LIST: "FILE NNN: path/to/file.ts"
- Use [] ONLY when this file truly has zero imports from any other file in the project

QUALITY RULES:
- Every file in the FILE LIST above must have exactly one entry in the output array
- Preserve exact file numbers and paths — do not invent or rename
- requiredFiles must only reference other project files, never external packages
- Output all {{TOTAL_FILES}} entries in the order they appear in Section 4

GLOBAL CONTEXT DOCUMENT:
{{GLOBAL_CONTEXT_DOCUMENT}}`,

  file_specific_prompt: `You are an expert developer building {{PROJECT_NAME}}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DEPENDENCY GATE (READ THIS FIRST — DO NOT SKIP)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQUIRED DEPENDENCY FILES FOR THIS FILE:
{{REQUIRED_FILES}}

RULE: Before writing a single line of code, check whether every file listed above has been pasted into this conversation.

IF any required file is missing:
  Your ONLY response must be this exact format — nothing else:
  "Before I generate FILE {{FILE_NUMBER}}: {{FILE_PATH}}, please paste the full source of:
   - [missing file 1]
   - [missing file 2]"
  Then STOP. Do not explain. Do not start the file. Wait.

IF all required files are present (or the list says "None"):
  Proceed directly to STEP 2.

ABSOLUTE RULES — NO EXCEPTIONS:
  ✗ Never guess an import path, type shape, function signature, or prop name
  ✗ Never assume what a dependency exports — you must have seen its source code
  ✗ Never write placeholder code, stub implementations, or "// TODO" blocks
  ✗ If anything in the spec is ambiguous, ask one clarifying question before writing code

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CONFIRM UNDERSTANDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In two sentences maximum: state what this file does and which specific named exports from the dependency files it will consume. If anything is unclear — stop and ask now. Do not proceed to STEP 3 until you are certain.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — GENERATE THE FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE {{FILE_NUMBER}}: {{FILE_PATH}}
Phase {{PHASE_NUMBER}} — {{PHASE_NAME}}

FILE SPECIFICATION:
{{FILE_SPEC}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GLOBAL CONTEXT DOCUMENT:
{{GLOBAL_CONTEXT_DOCUMENT}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — OUTPUT JSON SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Immediately after the complete file code above — no commentary, no explanation — output this JSON block. It is mandatory. Do not skip it.

{
  "file": "{{FILE_PATH}}",
  "fileNumber": "{{FILE_NUMBER}}",
  "exports": ["every exported name from this file"],
  "imports": ["every import path used in this file"],
  "keyLogic": "One sentence: what this file does and its key implementation decisions.",
  "sideEffects": [],
  "dependents": [],
  "status": "complete",
  "generatedAt": "CURRENT_TIMESTAMP"
}`,

  error_identify: `You are an expert TypeScript/Next.js developer. A developer has encountered an error in their project and needs your help identifying which files to examine.

PROJECT: {{PROJECT_NAME}}
ERROR TYPE: {{ERROR_TYPE}}

ERROR OUTPUT:
{{ERROR_OUTPUT}}

FILE REGISTRY (Section 11 of the Global Context Document):
{{FILE_REGISTRY}}

GLOBAL CONTEXT DOCUMENT:
{{GLOBAL_CONTEXT_DOCUMENT}}

Based on the error output and your understanding of the project architecture, identify the minimal set of files that could be causing this error. List each file path on its own line. Explain briefly why each file is relevant. Do not suggest more than 5 files unless absolutely necessary.`,

  error_replace: `You are an expert TypeScript/Next.js developer performing a surgical fix.

ORIGINAL ERROR:
{{ERROR_OUTPUT}}

FILES IDENTIFIED FOR REVIEW:
{{IDENTIFIED_FILES}}

CURRENT FILE CONTENTS:
{{FILE_CONTENTS}}

GLOBAL CONTEXT DOCUMENT:
{{GLOBAL_CONTEXT_DOCUMENT}}

Provide exact line replacements to fix the error. For each change, use this format:
FILE: [file path]
FIND THIS EXACT LINE: [exact line with all whitespace/indentation]
REPLACE WITH: [exact replacement with all whitespace/indentation]

Do not rewrite entire files. Only provide surgical replacements for the specific lines that need to change. If multiple lines in a block must change, list each line change separately.`,

  feature_delta: `You are an expert software architect. A developer wants to add a new feature to their existing project.

PROJECT: {{PROJECT_NAME}}

NEW FEATURE TO ADD:
{{FEATURE_DESCRIPTION}}

EXISTING FEATURES (Section 12):
{{EXISTING_FEATURES}}

FILE REGISTRY (Section 11):
{{FILE_REGISTRY}}

GLOBAL CONTEXT DOCUMENT:
{{GLOBAL_CONTEXT_DOCUMENT}}

Analyze the feature request and produce a JSON delta in this exact structure:
{
  "featureTitle": "...",
  "featureSummary": "...",
  "newFiles": [{ "filePath": "...", "purpose": "...", "phase": N, "phaseName": "..." }],
  "modifiedFiles": [{ "filePath": "...", "changeDescription": "...", "changes": [{ "findLine": "...", "replaceLine": "..." }] }],
  "documentChanges": [{ "sectionNumber": N, "appendContent": "..." }]
}

Be precise with findLine — it must match the exact line in the file including all whitespace.`,

  json_registry_entry: `Generate a JSON registry entry for file {{FILE_NUMBER}}: {{FILE_PATH}}

The entry must follow this exact structure:
{
  "file": "{{FILE_PATH}}",
  "fileNumber": "{{FILE_NUMBER}}",
  "exports": [{{EXPORTS}}],
  "imports": [{{IMPORTS}}],
  "keyLogic": "{{KEY_LOGIC}}",
  "sideEffects": [{{SIDE_EFFECTS}}],
  "dependents": [{{DEPENDENTS}}],
  "status": "complete",
  "generatedAt": "TIMESTAMP"
}

Output only the JSON object, no additional text.`,
}

// ─── Variable substitution (also exported for promptGenerator.ts) ─────────────

/**
 * Replaces all {{VARIABLE_NAME}} placeholders in a template string.
 * Unknown variables are left intact so nothing is silently dropped.
 */
export function substituteVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match
  })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildDefaultTemplate(key: DefaultTemplateKey): PromptTemplate {
  const variables = TEMPLATE_VARIABLES[key] ?? []
  return {
    id: `default-${key}`,
    userId: null,
    key,
    name: formatTemplateName(key),
    description: getTemplateDescription(key),
    content: DEFAULT_TEMPLATE_CONTENT[key],
    // Cast through unknown: the array satisfies InputJsonValue for writes and
    // Prisma returns it as JsonValue on reads — both shapes are compatible.
    variables: variables as unknown as Prisma.JsonValue,
    isDefault: true,
    isActive: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

function formatTemplateName(key: DefaultTemplateKey): string {
  const names: Record<DefaultTemplateKey, string> = {
    global_context_generator: 'Global Context Document Generator Prompt',
    meta_prompt: 'Meta-Prompt (JSON Spec Array)',
    file_specific_prompt: 'File-Specific Prompt Template',
    error_identify: 'Error Fix — File Identification Prompt',
    error_replace: 'Error Fix — Line Replacement Prompt',
    feature_delta: 'New Feature Delta Prompt',
    json_registry_entry: 'JSON Registry Entry Template',
  }
  return names[key]
}

function getTemplateDescription(key: DefaultTemplateKey): string {
  const descriptions: Record<DefaultTemplateKey, string> = {
    global_context_generator:
      'Used in Step 3 of project creation to generate the master prompt that Claude uses to produce the complete Global Context Document.',
    meta_prompt:
      'Paste this with your GCD into Claude to receive a compact JSON array of per-file specs. The platform then assembles full file-specific prompts — Claude never outputs boilerplate.',
    file_specific_prompt:
      'Platform-assembled prompt for individual file generation. Injected with spec data from the JSON array Claude produces via the meta-prompt.',
    error_identify:
      'Step 1 of the error resolution workflow — shown to Claude with the error output to identify which files to examine.',
    error_replace:
      'Step 2 of the error resolution workflow — shown to Claude with the identified files to receive exact line replacements.',
    feature_delta:
      'Used when adding new features — instructs Claude to produce a JSON delta describing all required file and document changes.',
    json_registry_entry:
      'Template for the JSON summary appended to Section 11 after each file is generated.',
  }
  return descriptions[key]
}

// ─── Exported service functions ───────────────────────────────────────────────

/**
 * Retrieves a single template by key. User-specific override takes priority
 * over the global default. Falls back to hardcoded defaults when the database
 * is unavailable.
 */
export async function getTemplate(key: string, userId?: string): Promise<PromptTemplate> {
  try {
    if (userId) {
      const userTemplate = await prisma.promptTemplate.findUnique({
        where: { userId_key: { userId, key } },
      })
      if (userTemplate) return userTemplate
    }

    const globalTemplate = await prisma.promptTemplate.findFirst({
      where: { key, userId: null, isDefault: true },
    })
    if (globalTemplate) return globalTemplate
  } catch {
    // DB unavailable — fall through to hardcoded defaults
  }

  const typedKey = key as DefaultTemplateKey
  if (DEFAULT_TEMPLATE_KEYS.includes(typedKey)) {
    return buildDefaultTemplate(typedKey)
  }

  return {
    id: `fallback-${key}`,
    userId: null,
    key,
    name: key,
    description: '',
    content: '',
    variables: [] as unknown as Prisma.JsonValue,
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Returns all templates for a user, with user overrides merged over global
 * defaults. Falls back to hardcoded defaults when the database is unavailable.
 */
export async function getAllTemplates(userId?: string): Promise<PromptTemplate[]> {
  try {
    const globalTemplates = await prisma.promptTemplate.findMany({
      where: { userId: null, isDefault: true, isActive: true },
    })

    if (!userId) {
      return globalTemplates.length > 0 ? globalTemplates : getDefaultTemplates()
    }

    const userTemplates = await prisma.promptTemplate.findMany({
      where: { userId, isActive: true },
    })

    const baseTemplates = globalTemplates.length > 0 ? globalTemplates : getDefaultTemplates()
    const base = new Map<string, PromptTemplate>(baseTemplates.map((t) => [t.key, t]))

    for (const ut of userTemplates) {
      base.set(ut.key, ut)
    }

    return Array.from(base.values())
  } catch {
    return getDefaultTemplates()
  }
}

/**
 * Upserts a user-specific template override for the given key.
 */
export async function updateTemplate(
  key: string,
  userId: string,
  content: string
): Promise<PromptTemplate> {
  const defaultTemplate = await getTemplate(key)

  return prisma.promptTemplate.upsert({
    where: { userId_key: { userId, key } },
    update: { content, updatedAt: new Date() },
    create: {
      userId,
      key,
      name: defaultTemplate.name,
      description: defaultTemplate.description,
      content,
      // defaultTemplate.variables is JsonValue (read type); cast to InputJsonValue
      // for the write. The underlying data is always a plain JSON array.
      variables: (defaultTemplate.variables ?? []) as unknown as InputJson,
      isDefault: false,
      isActive: true,
    },
  })
}

/**
 * Deletes the user's override for a template key, restoring the global default.
 */
export async function resetToDefault(key: string, userId: string): Promise<void> {
  await prisma.promptTemplate.deleteMany({
    where: { key, userId },
  })
}

/**
 * Returns all hardcoded default templates without a database call.
 * Used for seeding and as a DB-unavailable fallback.
 */
export function getDefaultTemplates(): PromptTemplate[] {
  return DEFAULT_TEMPLATE_KEYS.map((key) => buildDefaultTemplate(key))
}