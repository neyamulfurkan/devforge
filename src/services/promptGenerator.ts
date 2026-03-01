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

  return substituteVariables(template.content, variables)
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