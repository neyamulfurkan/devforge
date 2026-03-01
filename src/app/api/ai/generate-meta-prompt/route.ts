// src/app/api/ai/generate-meta-prompt/route.ts

// 1. Next.js imports
import { NextRequest, NextResponse } from 'next/server'

// 2. Internal imports — auth & database
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 3. Internal imports — services
import { generateMetaPrompt } from '@/services/promptGenerator'

// 4. Internal imports — types
import type { ApiResponse } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  projectId: string
}

interface MetaPromptResult {
  prompt: string
  projectName: string
  totalFiles: number
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<MetaPromptResult>>> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { projectId } = body

  if (typeof projectId !== 'string' || !projectId.trim()) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    )
  }

  // Fetch project + document with ownership check
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      userId: true,
      name: true,
      totalFiles: true,
      document: {
        select: {
          rawContent: true,
          sections: true,
        },
      },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (project.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!project.document?.rawContent) {
    return NextResponse.json(
      { error: 'This project has no Global Context Document yet. Generate one first.' },
      { status: 422 }
    )
  }

  // Extract the file list from Section 4 of the GCD
  // Section 4 contains "## SECTION 4 — COMPLETE FILE STRUCTURE"
  // We extract every "FILE NNN:" line to build the FILE_LIST variable
  const fileList = extractFileListFromDocument(project.document.rawContent)

  if (!fileList) {
    return NextResponse.json(
      {
        error:
          'Could not extract file list from Section 4 of the Global Context Document. ' +
          'Ensure Section 4 contains lines matching the pattern "FILE NNN: path".',
      },
      { status: 422 }
    )
  }

  const { list: fileListText, count: parsedCount } = fileList

  // Use parsedCount as authoritative totalFiles when available
  const totalFiles = parsedCount > 0 ? parsedCount : (project.totalFiles ?? 0)

  // Generate the meta-prompt using the template service (with user overrides)
  const prompt = await generateMetaPrompt(
    {
      projectName: project.name,
      totalFiles,
      fileList: fileListText,
      globalContextDocument: project.document.rawContent,
    },
    session.user.id
  )

  return NextResponse.json(
    {
      data: {
        prompt,
        projectName: project.name,
        totalFiles,
      },
    },
    { status: 200 }
  )
}

// ─── Helper: extract FILE NNN: lines from GCD ────────────────────────────────

interface ExtractedFileList {
  list: string   // newline-separated "FILE NNN: path/to/file.ts" entries
  count: number  // number of files found
}

/**
 * Scans the raw GCD content for lines matching the Section 4 file tree pattern.
 * Supports entries like:
 *   FILE 001: package.json
 *   FILE 001a: some-variant.ts
 *
 * Returns null if no matching lines are found.
 */
function extractFileListFromDocument(rawContent: string): ExtractedFileList | null {
  // Match lines containing "FILE NNN:" (3+ digit with optional letter suffix)
  // Handles: "FILE 001: path", "001. path", "001: path", "1. path", "FILE 009b: path"
  // Scope to Section 4 only — prevent Section 9 FILE NNN: lines from being double-counted
  const section4Match = rawContent.match(
    /^(?:## )?SECTION 4[^]*?(?=\n(?:## )?SECTION 5)/m
  )
  const searchText = section4Match ? section4Match[0] : rawContent

  const fileLineRegex = /^(?:FILE\s+(\d+[a-zA-Z]?)\s*:\s*(.+)|(\d{3}[a-zA-Z]?)[.:]\s+(.+))$/gm

  const entries: string[] = []
  let match: RegExpExecArray | null

  while ((match = fileLineRegex.exec(searchText)) !== null) {
    const rawNum = (match[1] ?? match[3]).trim()
    const filePath = (match[2] ?? match[4]).trim()
    // Normalise to zero-padded 3-digit format: "1" → "001", "009b" stays "009b"
    const letterSuffix = rawNum.match(/[a-zA-Z]$/)?.[0] ?? ''
    const numericPart = rawNum.replace(/[a-zA-Z]$/, '')
    const fileNumber = numericPart.padStart(3, '0') + letterSuffix
    entries.push(`FILE ${fileNumber}: ${filePath}`)
  }

  if (entries.length === 0) return null

  // Deduplicate by fileNumber — keeps first occurrence
  const seen = new Set<string>()
  const deduped = entries.filter((entry) => {
    const key = entry.split(':')[0].trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return {
    list: deduped.join('\n'),
    count: deduped.length,
  }
}