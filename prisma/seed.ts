// prisma/seed.ts

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  DEFAULT_TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  type DefaultTemplateKey,
} from '../src/lib/constants'

const prisma = new PrismaClient()

// ─── Template metadata ────────────────────────────────────────────────────────

function formatTemplateName(key: DefaultTemplateKey): string {
  const names: Record<DefaultTemplateKey, string> = {
    global_context_generator: 'Global Context Document Generator Prompt',
    meta_prompt: 'Meta-Prompt (JSON Spec Array)',
    file_specific_prompt: 'File-Specific Prompt Template',
    error_identify: 'Error Fix — File Identification Prompt',
    error_replace: 'Error Fix — Line Replacement Prompt',
    tsc_error_identify: 'TSC Error Fix — File Identification Prompt',
    tsc_error_replace: 'TSC Error Fix — Line Replacement Prompt',
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
    tsc_error_identify:
      'Step 1 of the TSC-specific error workflow — parses npx tsc --noEmit output into grouped diagnostics and identifies root-cause files.',
    tsc_error_replace:
      'Step 2 of the TSC-specific error workflow — provides surgical line replacements using the exact TSC error codes and line numbers.',
    feature_delta:
      'Used when adding new features — instructs Claude to produce a JSON delta describing all required file and document changes.',
    json_registry_entry:
      'Template for the JSON summary appended to Section 11 after each file is generated.',
  }
  return descriptions[key]
}

// ─── Default template content ─────────────────────────────────────────────────

const DEFAULT_TEMPLATE_CONTENT: Record<DefaultTemplateKey, string> = {
  global_context_generator: `You are a world-class software architect and technical writer with deep expertise in production system design. Your task is to produce a complete, authoritative Global Context Document (GCD) for the following software project. This document will serve as the single source of truth for an AI-assisted development workflow — every architectural and structural decision you make here will directly govern how the entire codebase is built.

PROJECT NAME: {{PROJECT_NAME}}
PLATFORM TYPE: {{PLATFORM_TYPE}}
PREFERRED TECH STACK: {{TECH_STACK}}
ADDITIONAL NOTES: {{ADDITIONAL_NOTES}}

PROJECT DESCRIPTION:
{{PROJECT_DESCRIPTION}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARSER CONTRACT — NON-NEGOTIABLE FORMAT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This document is parsed by an automated platform. Any deviation from these rules causes silent data loss and generation failures. Follow them with zero exceptions.

RULE 1 — SECTION HEADERS must use this exact format:
  ## SECTION 1 — TITLE
  ## SECTION 1.1 — SUBTITLE
  - Two hashes, one space, SECTION, one space, number, one space, em dash (—), one space, title
  - No bold, no extra hashes, no trailing punctuation, no colon, no hyphen instead of em dash
  - Correct:   ## SECTION 4 — COMPLETE FILE STRUCTURE
  - Wrong:     ### Section 4: Complete File Structure
  - Wrong:     ## SECTION 4 - COMPLETE FILE STRUCTURE

RULE 2 — FILE ENTRIES IN SECTION 4 must use this exact format:
  FILE 001: src/app/page.tsx
  - Uppercase FILE, one space, 3-digit zero-padded number, colon, one space, path
  - Letter suffix directly after digits with no space: FILE 009a: path/to/file.ts
  - No markdown: no bold (**), no backticks (\`), no bullet points (-), no numbering (1.)
  - Nothing after the path — no comments, no annotations, no em dash descriptions
  - One file per line, no blank lines between entries
  - Correct:   FILE 027: src/services/promptGenerator.ts
  - Wrong:     - FILE 027: src/services/promptGenerator.ts
  - Wrong:     **FILE 027: src/services/promptGenerator.ts**
  - Wrong:     FILE 027: src/services/promptGenerator.ts — generates prompts
  - Wrong:     FILE 27: src/services/promptGenerator.ts

RULE 3 — SECTION 9 DEPENDENCY FORMAT — every file entry must follow this structure exactly:
  FILE 027: src/services/promptGenerator.ts
    Required: FILE 011: src/lib/constants.ts, FILE 026: src/services/documentParser.ts
    Exports: generateFilePrompt(input: FilePromptInput, userId?: string): Promise<string>
    Key logic: Fetches template from DB via getTemplate(), substitutes {{VARIABLE}} placeholders, returns assembled prompt string.
  - The Required line: two spaces, "Required: ", then comma-separated "FILE NNN: path" entries
  - If no dependencies: "  Required: None"
  - Every file entry must have a Required line — never omit it
  - Correct:   Required: FILE 011: src/lib/constants.ts, FILE 026: src/services/documentParser.ts
  - Wrong:     Required Files: FILE 011, FILE 026
  - Wrong:     Imports: FILE 011: src/lib/constants.ts
  - Wrong:     Dependencies: constants.ts, documentParser.ts

RULE 4 — NO MARKDOWN CODE BLOCKS: Never wrap the document or any section in triple backticks.

RULE 5 — SECTION 11 MUST BE EMPTY: Output only the header line. No placeholder rows, no pipe tables, no example entries.

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

STEP 1 — DEPENDENCY CHECK

REQUIRED DEPENDENCY FILES FOR THIS FILE:
{{REQUIRED_FILES}}

If the list above is not "None", your ONLY response right now must be:

"To generate FILE {{FILE_NUMBER}}: {{FILE_PATH}} correctly, please paste the full source code of these files:
[list each file]
I will not write any code until I have reviewed all of them."

Do NOT greet me. Do NOT explain what you are about to do. Do NOT start generating code.
Just ask for the files. Wait for me to paste them.

If the list says "None — this file has no dependencies on other project files", proceed directly to STEP 3.

STEP 2 — AFTER I PASTE THE DEPENDENCY FILES

State in one sentence what this file must do and which specific exports from the dependency files it will consume. If anything is missing or ambiguous — stop and ask. Never guess.

STEP 3 — GENERATE THE FILE

FILE {{FILE_NUMBER}}: {{FILE_PATH}}
Phase {{PHASE_NUMBER}} — {{PHASE_NAME}}

FILE SPECIFICATION:
{{FILE_SPEC}}

GLOBAL CONTEXT DOCUMENT:
{{GLOBAL_CONTEXT_DOCUMENT}}

STEP 4 — OUTPUT JSON SUMMARY

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

  tsc_error_identify: 'TSC error identification prompt — see templateService.ts for full content.',
  tsc_error_replace: 'TSC error replacement prompt — see templateService.ts for full content.',
}
// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Starting seed...')

  // No transaction — seed operations are independent and large templates exceed default timeout
    // ── 1. Admin user ──────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('devforge123', 12)

    const admin = await prisma.user.upsert({
      where: { email: 'admin@devforge.local' },
      update: {},
      create: {
        email: 'admin@devforge.local',
        name: 'Admin',
        passwordHash,
      },
    })

    console.log(`✅ Admin user: ${admin.email} (id: ${admin.id})`)

    // ── 2. Default prompt templates (userId = null → global) ──────────────────
    // Prisma v5 disallows null in upsert's unique where clause, so we
    // manually findFirst + update/create for global (userId = null) records.
    for (const key of DEFAULT_TEMPLATE_KEYS) {
      const typedKey = key as DefaultTemplateKey

      const data = {
        name: formatTemplateName(typedKey),
        description: getTemplateDescription(typedKey),
        content: DEFAULT_TEMPLATE_CONTENT[typedKey],
        variables: TEMPLATE_VARIABLES[typedKey] ?? [],
        isDefault: true,
        isActive: true,
      }

      const existing = await prisma.promptTemplate.findFirst({
        where: { key, userId: null },
      })

      const template = existing
        ? await prisma.promptTemplate.update({ where: { id: existing.id }, data })
        : await prisma.promptTemplate.create({ data: { ...data, key, userId: null } })

      console.log(`✅ Template: ${template.key}`)
    }

  console.log('🎉 Seed complete.')
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })