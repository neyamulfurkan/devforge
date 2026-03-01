// src/services/exportService.ts

// 1. Third-party imports
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

// 2. Internal imports
import type { FileWithContent } from '@/types'
import { downloadFile, slugify } from '@/lib/utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildDateSuffix(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildBaseFilename(projectName: string, ext: string): string {
  return `devforge-${slugify(projectName)}-${buildDateSuffix()}.${ext}`
}

// ─── Exported service functions ──────────────────────────────────────────────

/**
 * Generates a ZIP archive containing all project files that have code content,
 * preserving the full folder structure from each file's filePath, then triggers
 * a browser download.
 */
export async function exportProjectAsZip(
  projectName: string,
  files: FileWithContent[]
): Promise<void> {
  const zip = new JSZip()

  const exportableFiles = files.filter((f) => f.codeContent !== null)

  for (const file of exportableFiles) {
    // codeContent is guaranteed non-null by the filter above
    zip.file(file.filePath, file.codeContent as string)
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  saveAs(blob, buildBaseFilename(projectName, 'zip'))
}

/**
 * Triggers a browser download of the Global Context Document as a Markdown file.
 */
export function exportDocumentAsMarkdown(
  projectName: string,
  rawContent: string
): void {
  downloadFile(
    rawContent,
    buildBaseFilename(projectName, 'md'),
    'text/markdown;charset=utf-8'
  )
}

/**
 * Triggers a browser download of the Global Context Document as a plain text file.
 */
export function exportDocumentAsText(
  projectName: string,
  rawContent: string
): void {
  downloadFile(
    rawContent,
    buildBaseFilename(projectName, 'txt'),
    'text/plain;charset=utf-8'
  )
}