// src/services/promptGenerator.ts

// 1. Internal imports — constants
import {
  DEFAULT_TEMPLATE_KEYS,
  TEMPLATE_VARIABLES,
  PHASE_NAMES,
  type DefaultTemplateKey,
} from '@/lib/constants'

// 2. Internal imports — services
import { getTemplate } from '@/services/templateService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilePromptInput {
  fileNumber: string        // e.g. "027"
  filePath: string          // e.g. "src/services/promptGenerator.ts"
  fileName: string          // e.g. "promptGenerator.ts"
  phase: number             // e.g. 3
  requiredFiles: string[]   // e.g. ["FILE 011: src/lib/constants.ts"]
  specSummary: string       // one-sentence description
  keyLogic: string          // full spec content from Section 9
  globalContextDocument: string
  projectName: string
}

export interface MetaPromptInput {
  projectName: string
  totalFiles: number
  fileList: string          // newline-separated "FILE NNN: path" list
  globalContextDocument: string
}

export interface GlobalContextPromptInput {
  projectName: string
  platformType: string
  techStack: string         // comma-separated or empty string
  additionalNotes: string
  projectDescription: string
}

export interface ErrorIdentifyInput {
  projectName: string
  errorType: string
  errorOutput: string
  fileRegistry: string
  globalContextDocument: string
}

export interface ErrorReplaceInput {
  errorOutput: string
  identifiedFiles: string
  fileContents: string
  globalContextDocument: string
}

export interface FeatureDeltaInput {
  projectName: string
  featureDescription: string
  existingFeatures: string
  fileRegistry: string
  globalContextDocument: string
}

export interface JsonRegistryEntryInput {
  fileNumber: string
  filePath: string
  exports: string           // comma-separated
  imports: string           // comma-separated
  keyLogic: string
  sideEffects: string       // comma-separated or "None"
  dependents: string        // comma-separated or "None"
}

// ─── Variable substitution ────────────────────────────────────────────────────

/**
 * Replaces all {{VARIABLE_NAME}} placeholders in a template string.
 * Unknown variables are left as-is so nothing is silently dropped.
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

// ─── Phase name helper ────────────────────────────────────────────────────────

function getPhaseName(phase: number): string {
  return PHASE_NAMES[phase] ?? `Phase ${phase}`
}

// ─── Required files formatter ─────────────────────────────────────────────────

function formatRequiredFiles(requiredFiles: string[]): string {
  if (requiredFiles.length === 0) {
    return 'None — this file has no dependencies on other project files'
  }
  return requiredFiles.join('\n')
}

// ─── File spec builder ────────────────────────────────────────────────────────

function buildFileSpec(input: FilePromptInput): string {
  const phaseName = getPhaseName(input.phase)
  return [
    `FILE ${input.fileNumber}: ${input.filePath}`,
    `Phase ${input.phase} — ${phaseName}`,
    '',
    input.specSummary,
    '',
    input.keyLogic,
  ].join('\n')
}

// ─── Core generator functions ─────────────────────────────────────────────────

/**
 * Generates the file-specific prompt for a single file.
 * Fetches the template from DB (with user override support), then substitutes
 * all variables including the assembled REQUIRED_FILES and FILE_SPEC blocks.
 */
export async function generateFilePrompt(
  input: FilePromptInput,
  userId?: string
): Promise<string> {
  const template = await getTemplate('file_specific_prompt', userId)
  const phaseName = getPhaseName(input.phase)

  const variables: Record<string, string> = {
    PROJECT_NAME: input.projectName,
    FILE_NUMBER: input.fileNumber,
    FILE_PATH: input.filePath,
    FILE_NAME: input.fileName,
    PHASE_NUMBER: String(input.phase),
    PHASE_NAME: phaseName,
    REQUIRED_FILES: formatRequiredFiles(input.requiredFiles),
    FILE_SPEC: buildFileSpec(input),
    GLOBAL_CONTEXT_DOCUMENT: input.globalContextDocument,
  }

  return substituteVariables(template.content, variables)
}

/**
 * Generates the meta-prompt that asks Claude to produce the JSON spec array.
 */
export async function generateMetaPrompt(
  input: MetaPromptInput,
  userId?: string
): Promise<string> {
  const template = await getTemplate('meta_prompt', userId)

  const variables: Record<string, string> = {
    PROJECT_NAME: input.projectName,
    TOTAL_FILES: String(input.totalFiles),
    FILE_LIST: input.fileList,
    GLOBAL_CONTEXT_DOCUMENT: input.globalContextDocument,
  }

  return substituteVariables(template.content, variables)
}

/**
 * Generates the global context document prompt for Step 3 of project creation.
 */
export async function generateGlobalContextPrompt(
  input: GlobalContextPromptInput,
  userId?: string
): Promise<string> {
  const template = await getTemplate('global_context_generator', userId)

  const variables: Record<string, string> = {
    PROJECT_NAME: input.projectName,
    PLATFORM_TYPE: input.platformType,
    TECH_STACK: input.techStack || 'Not specified',
    ADDITIONAL_NOTES: input.additionalNotes || 'None',
    PROJECT_DESCRIPTION: input.projectDescription,
  }

  const basePrompt = substituteVariables(template.content, variables)

  // ─── Dependency ordering rule — always appended to every GCD prompt ───────
  // This instruction is non-negotiable and must survive any template changes.
  // It enforces backward-only dependencies in Section 9 so the file sequence
  // can always be followed top-to-bottom with no forward references.
  const dependencyRule = `
${'═'.repeat(70)}
CRITICAL RULE — DEPENDENCY ORDERING (NON-NEGOTIABLE):
${'═'.repeat(70)}

When generating Section 4 (File Structure) and Section 9 (File Generation Sequence), you MUST enforce the following rule without exception:

BACKWARD DEPENDENCIES ONLY — A file may only depend on files with a LOWER file number than itself.

This means:
- FILE 045 may only list files 001–044 as required dependencies
- FILE 001 may have NO dependencies (it is always first)
- NO file may ever reference a file with a higher number than itself
- Forward dependencies (e.g. FILE 030 requiring FILE 080) are STRICTLY FORBIDDEN

WHY THIS MATTERS:
The file sequence must be executable top-to-bottom. A developer generating files in order must never encounter a situation where FILE N requires FILE M where M > N. This would make the sequence impossible to follow without jumping ahead.

HOW TO SEQUENCE FILES:
1. Pure config and foundation files always come first (package.json, tsconfig, env, schema)
2. Types and constants come before anything that uses them
3. Utilities and lib helpers come before services that use them
4. Services come before hooks that call them
5. Hooks come before components that use them
6. Shared/base components come before feature components that compose them
7. Page files and API routes come last — they depend on everything else
8. If two files would naturally depend on each other, extract their shared logic into a third earlier file that both can depend on

REQUIRED FILES field in Section 9:
- List ONLY files with lower numbers than the current file
- If a file has no backward dependencies, write: "None"
- Never leave this field empty — always explicitly state "None" or list the actual lower-numbered files
- Format: "FILE NNN: path/to/file.ts" — one per line

DESIGN CONSISTENCY DEPENDENCIES — MANDATORY:
Every file that renders UI must list its closest design siblings as required files. This ensures Claude reads real implemented patterns before writing new code, preventing style drift across the project.

The rule: before generating any component, page, or UI file, Claude must read at least one already-generated file of the same type from the same layer. Specifically:

- A new component in src/components/dashboard/ must list an existing dashboard component as a required file
- A new component in src/components/workspace/ must list an existing workspace component
- A new page file must list an existing page file from the same route group
- A new API route must list an existing API route from the same resource or a similar one
- A new hook must list an existing hook that follows the same pattern
- A new service must list an existing service
- A new CSS module must list an existing CSS module from the same component family
- A new store must list an existing store file

WHY THIS IS REQUIRED:
Without reading a sibling file first, Claude invents its own patterns — different className conventions, different state management shapes, different error handling styles, different spacing values. Reading one real sibling file before writing forces Claude to match the exact patterns already established in the codebase.

HOW TO IDENTIFY DESIGN SIBLINGS:
1. Same folder = strongest sibling (always prefer)
2. Same phase = strong sibling (same layer of the architecture)
3. Same file type/extension and similar purpose = valid sibling
4. For the very first file in a folder with no siblings yet, use the closest file from the parent folder or equivalent layer

This sibling dependency must appear in the REQUIRED FILES list even if the file does not directly import from the sibling. The purpose is context and consistency, not just import resolution.

This ordering rule applies to EVERY file in the sequence. Review the complete file list before assigning numbers to ensure no circular or forward dependencies exist.`

  return `${basePrompt}\n${dependencyRule}`
}

/**
 * Generates Step 1 of the error resolution workflow — file identification prompt.
 */
export async function generateErrorIdentifyPrompt(
  input: ErrorIdentifyInput,
  userId?: string
): Promise<string> {
  const template = await getTemplate('error_identify', userId)

  const variables: Record<string, string> = {
    PROJECT_NAME: input.projectName,
    ERROR_TYPE: input.errorType,
    ERROR_OUTPUT: input.errorOutput,
    FILE_REGISTRY: input.fileRegistry,
    GLOBAL_CONTEXT_DOCUMENT: input.globalContextDocument,
  }

  return substituteVariables(template.content, variables)
}

/**
 * Generates Step 2 of the error resolution workflow — line replacement prompt.
 */
export async function generateErrorReplacePrompt(
  input: ErrorReplaceInput,
  userId?: string
): Promise<string> {
  const template = await getTemplate('error_replace', userId)

  const variables: Record<string, string> = {
    ERROR_OUTPUT: input.errorOutput,
    IDENTIFIED_FILES: input.identifiedFiles,
    FILE_CONTENTS: input.fileContents,
    GLOBAL_CONTEXT_DOCUMENT: input.globalContextDocument,
  }

  return substituteVariables(template.content, variables)
}

/**
 * Generates the feature delta prompt for adding new features to an existing project.
 */
export async function generateFeatureDeltaPrompt(
  input: FeatureDeltaInput,
  userId?: string
): Promise<string> {
  const template = await getTemplate('feature_delta', userId)

  const variables: Record<string, string> = {
    PROJECT_NAME: input.projectName,
    FEATURE_DESCRIPTION: input.featureDescription,
    EXISTING_FEATURES: input.existingFeatures,
    FILE_REGISTRY: input.fileRegistry,
    GLOBAL_CONTEXT_DOCUMENT: input.globalContextDocument,
  }

  return substituteVariables(template.content, variables)
}

/**
 * Generates the JSON registry entry template for appending to Section 11.
 */
export async function generateJsonRegistryEntry(
  input: JsonRegistryEntryInput,
  userId?: string
): Promise<string> {
  const template = await getTemplate('json_registry_entry', userId)

  const variables: Record<string, string> = {
    FILE_NUMBER: input.fileNumber,
    FILE_PATH: input.filePath,
    EXPORTS: input.exports,
    IMPORTS: input.imports,
    KEY_LOGIC: input.keyLogic,
    SIDE_EFFECTS: input.sideEffects,
    DEPENDENTS: input.dependents,
  }

  return substituteVariables(template.content, variables)
}

// ─── Variable introspection helpers ──────────────────────────────────────────

/**
 * Returns all variables defined for a given template key.
 * Used by the template editor UI to render variable reference cards.
 */
export function getVariablesForTemplate(key: string): typeof TEMPLATE_VARIABLES[DefaultTemplateKey] {
  const typedKey = key as DefaultTemplateKey
  if (DEFAULT_TEMPLATE_KEYS.includes(typedKey)) {
    return TEMPLATE_VARIABLES[typedKey]
  }
  return []
}

/**
 * Extracts all {{VARIABLE}} placeholders found in a template string.
 * Used to validate that all variables are present before substitution.
 */
export function extractVariablePlaceholders(template: string): string[] {
  const matches = template.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)
  const seen = new Set<string>()
  for (const match of matches) {
    seen.add(match[1])
  }
  return Array.from(seen)
}

/**
 * Validates that all placeholders in a template have corresponding values.
 * Returns an array of missing variable names (empty = all present).
 */
export function validateVariables(
  template: string,
  variables: Record<string, string>
): string[] {
  const placeholders = extractVariablePlaceholders(template)
  return placeholders.filter(
    (p) => !Object.prototype.hasOwnProperty.call(variables, p)
  )
}