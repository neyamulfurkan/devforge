// 1. Type imports
import type { ExtractedFile, TerminalScriptOptions } from '@/types'

// 2. Constants
const PHASE_NAMES: Record<number, string> = {
  1: 'Foundation and Configuration',
  2: 'Core Infrastructure',
  3: 'Services Layer',
  4: 'Custom Hooks',
  5: 'shadcn/ui Components',
  6: 'Layout Components',
  7: 'Shared Components',
  8: 'Feature Components',
  9: 'Pages, API Routes, and Config Files',
}

// 3. Exported service functions

/**
 * Sorts ExtractedFile array: numerically first, then by full fileNumber string as tiebreaker.
 * This ensures: 009 → 009b → 010
 */
function sortFiles(files: ExtractedFile[]): ExtractedFile[] {
  return [...files].sort((a, b) => {
    const numA = parseInt(a.fileNumber, 10)
    const numB = parseInt(b.fileNumber, 10)
    if (numA !== numB) return numA - numB
    // Same numeric prefix — sort by full string (e.g. "009" < "009b")
    return a.fileNumber < b.fileNumber ? -1 : a.fileNumber > b.fileNumber ? 1 : 0
  })
}

/**
 * Derives unique directory paths from a list of file paths.
 * Returns paths in order such that parent directories appear before children.
 */
function extractDirectories(filePaths: string[]): string[] {
  const dirs = new Set<string>()
  for (const fp of filePaths) {
    const segments = fp.split('/')
    // Build each ancestor directory path
    for (let i = 1; i < segments.length; i++) {
      dirs.add(segments.slice(0, i).join('/'))
    }
  }
  // Sort so parents come before children
  return Array.from(dirs).sort((a, b) => a.localeCompare(b))
}

/**
 * Generates a Windows CMD script (.cmd / batch) that creates all project directories
 * and optionally empty files, plus an optional npm install command.
 */
export function generateWindowsCmdScript(
  files: ExtractedFile[],
  opts: TerminalScriptOptions
): string {
  const sorted = sortFiles(files)
  const prefix = opts.rootPrefix ?? ''

  const lines: string[] = [
    '@echo off',
    'REM DevForge — Windows CMD Setup Script',
    'REM Run this script in your project root directory.',
    '',
  ]

  // Create directories
  const allPaths = sorted.map((f) => f.filePath)
  const dirs = extractDirectories(allPaths)

  lines.push('REM Create directories')
  for (const dir of dirs) {
    const winPath = (prefix + dir).replace(/\//g, '\\')
    lines.push(`if not exist "${winPath}" mkdir "${winPath}"`)
  }

  // Optionally create empty files
  if (opts.includeFileCreation) {
    lines.push('')
    lines.push('REM Create empty files')
    for (const file of sorted) {
      const winPath = (prefix + file.filePath).replace(/\//g, '\\')
      lines.push(`type nul > "${winPath}"`)
    }
  }

  // Optionally append npm install
  if (opts.includeNpmInstall) {
    lines.push('')
    lines.push('REM Install dependencies')
    lines.push('npm install')
  }

  lines.push('')
  lines.push('echo Setup complete.')

  return lines.join('\r\n')
}

/**
 * Generates a Bash script (Mac/Linux) that creates all project directories
 * and optionally empty files, plus an optional npm install command.
 */
export function generateBashScript(
  files: ExtractedFile[],
  opts: TerminalScriptOptions
): string {
  const sorted = sortFiles(files)
  const prefix = opts.rootPrefix ?? ''

  const lines: string[] = [
    '#!/usr/bin/env bash',
    '# DevForge — Mac/Linux Bash Setup Script',
    '# Run this script in your project root directory.',
    '',
  ]

  // Create directories (mkdir -p handles nesting in one pass)
  const allPaths = sorted.map((f) => f.filePath)
  const dirs = extractDirectories(allPaths)

  lines.push('# Create directories')
  for (const dir of dirs) {
    lines.push(`mkdir -p "${prefix}${dir}"`)
  }

  // Optionally create empty files
  if (opts.includeFileCreation) {
    lines.push('')
    lines.push('# Create empty files')
    for (const file of sorted) {
      lines.push(`touch "${prefix}${file.filePath}"`)
    }
  }

  // Optionally append npm install
  if (opts.includeNpmInstall) {
    lines.push('')
    lines.push('# Install dependencies')
    lines.push('npm install')
  }

  lines.push('')
  lines.push('echo "Setup complete."')

  return lines.join('\n')
}

/**
 * Delegates to the correct OS-specific generator based on opts.platform.
 */
export function generateScriptForOS(
  files: ExtractedFile[],
  opts: TerminalScriptOptions
): string {
  if (opts.platform === 'windows') {
    return generateWindowsCmdScript(files, opts)
  }
  return generateBashScript(files, opts)
}

/**
 * Extracts the npm install command from the Global Context Document's tech stack section.
 * Searches Section 3.3 for the pinned dependency list and assembles the install command.
 * Falls back to "npm install" if the section cannot be parsed.
 */
export function generateNpmInstallCommand(documentContent: string): string {
  // Locate Section 3.3 which contains the npm package list
  const section33Match = documentContent.match(
    /## SECTION 3\.3[^\n]*\n([\s\S]*?)(?=\n## SECTION |\n### SECTION |$)/
  )

  if (!section33Match) {
    return 'npm install'
  }

  const section33Content = section33Match[1] ?? ''

  // Split at "devDependencies:" to get only runtime deps for the base install command
  const [depsBlock, devDepsBlock] = section33Content.split(/devDependencies:/i)

  const runtimePackages = extractPackageList(depsBlock ?? '')
  const devPackages = extractPackageList(devDepsBlock ?? '')

  if (runtimePackages.length === 0 && devPackages.length === 0) {
    return 'npm install'
  }

  const parts: string[] = ['npm install']

  if (runtimePackages.length > 0) {
    parts.push(runtimePackages.join(' '))
  }

  if (devPackages.length > 0) {
    parts.push('&&')
    parts.push('npm install --save-dev')
    parts.push(devPackages.join(' '))
  }

  return parts.join(' ')
}

// 4. Non-exported helpers

/**
 * Parses a block of text and extracts "packageName@version" entries.
 * Handles lines like "next@14.2.5" and ignores comment lines, blank lines, and headers.
 */
function extractPackageList(block: string): string[] {
  const packageLineRegex = /^([\w@][\w@/.-]+@[\w.^~*-]+)\s*$/m
  const packages: string[] = []

  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim()
    // Skip blank lines, headers (dependencies:), and comment lines
    if (
      !line ||
      line.startsWith('#') ||
      line.startsWith('//') ||
      line === 'dependencies:' ||
      line.startsWith('Note')
    ) {
      continue
    }
    if (packageLineRegex.test(line)) {
      packages.push(line)
    }
  }

  return packages
}