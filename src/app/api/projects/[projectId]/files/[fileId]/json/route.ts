// src/app/api/projects/[projectId]/files/[fileId]/json/route.ts

// 1. Next.js
import { NextRequest, NextResponse } from 'next/server'

// 2. Auth
import { getServerSession } from '@/lib/auth'
// 3. Database
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// 4. Services
import { validateJsonSummary, appendJsonToSection11 } from '@/services/jsonRegistryService'

// 5. Types
import type { ApiResponse, FileWithContent } from '@/types'

// ─── Import path normalizer ───────────────────────────────────────────────────

/**
 * Normalizes an import path from Claude's JSON output to match
 * the filePath format stored in ProjectFile (e.g. "src/lib/constants.ts").
 * Handles @/ alias and missing extensions.
 */
function normalizeImportPath(raw: string): string {
  // Strip @/ alias → src/
  const p = raw.startsWith('@/') ? 'src/' + raw.slice(2) : raw

  // If already has a file extension — return as-is
  if (/\.\w+$/.test(p)) return p

  // Otherwise return without extension — we'll do a startsWith match
  return p
}

// ─── POST /api/projects/[projectId]/files/[fileId]/json ──────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; fileId: string } }
): Promise<NextResponse<ApiResponse<{ file: FileWithContent }>>> {
  try {
 const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, fileId } = params

    // Verify file exists and user owns it
    const file = await prisma.projectFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        projectId: true,
        fileNumber: true,
        project: { select: { userId: true } },
      },
    })

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.projectId !== projectId || file.project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await request.json()

    if (!body || typeof body !== 'object' || !('jsonSummary' in (body as Record<string, unknown>))) {
      return NextResponse.json(
        { error: 'Request body must contain a "jsonSummary" field' },
        { status: 400 }
      )
    }

    const { jsonSummary } = body as { jsonSummary: unknown }

    // Validate the JSON summary shape
    const validation = validateJsonSummary(jsonSummary)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid JSON summary', details: validation.errors },
        { status: 400 }
      )
    }

    const validatedSummary = jsonSummary as Record<string, unknown>

    // Fetch the project document's raw content
    const projectDoc = await prisma.projectDocument.findUnique({
      where: { projectId },
      select: { id: true, rawContent: true, currentVersion: true, sections: true },
    })

    if (!projectDoc) {
      return NextResponse.json({ error: 'Project document not found' }, { status: 404 })
    }

    // Append JSON entry to Section 11 in raw content
    const updatedRawContent = appendJsonToSection11(projectDoc.rawContent, validatedSummary)

    const newVersion = projectDoc.currentVersion + 1

    // Re-parse sections from updated raw content so the sections JSON stays in sync
    const { parseGlobalDocument } = await import('@/services/documentParser')
    const updatedSections = parseGlobalDocument(updatedRawContent)
    const sectionsJson = updatedSections.map((s) => ({
      sectionNumber: s.sectionNumber,
      title: s.title,
      rawContent: s.rawContent,
      subsections: s.subsections,
      wordCount: s.wordCount,
      isAppendOnly: s.isAppendOnly,
    }))

    // Update document and create version snapshot in a transaction
    await prisma.$transaction([
      prisma.projectDocument.update({
        where: { id: projectDoc.id },
        data: {
          rawContent: updatedRawContent,
          sections: sectionsJson as unknown as Prisma.InputJsonValue,
          totalSections: updatedSections.length,
          currentVersion: newVersion,
          updatedAt: new Date(),
        },
      }),
      prisma.documentVersion.create({
        data: {
          documentId: projectDoc.id,
          versionNumber: newVersion,
          rawContent: updatedRawContent,
          sections: projectDoc.sections ?? [],
          triggerEvent: `json_appended_FILE_${file.fileNumber}`,
          changeSummary: `JSON registry entry appended for FILE ${file.fileNumber}`,
        },
      }),
    ])

    // Save jsonSummary on the file record
    const updatedFile = await prisma.projectFile.update({
      where: { id: fileId },
      data: { jsonSummary: validatedSummary as unknown as Prisma.InputJsonValue },
    })

    // ── Reconcile requiredFiles from real import data ──────────────────────
    // Claude's JSON summary contains an "imports" array of actual import paths
    // used in the generated file. We match these against all sibling project
    // files and update requiredFiles[] with verified entries — replacing the
    // earlier meta-prompt guess with ground truth.
    try {
      const rawImports = validatedSummary['imports']
      if (Array.isArray(rawImports) && rawImports.length > 0) {
        // Fetch all other files in this project
        const siblings = await prisma.projectFile.findMany({
          where: { projectId, id: { not: fileId } },
          select: { id: true, fileNumber: true, filePath: true },
        })

        // Normalize each import path and match against sibling filePaths
        const reconciledRequiredFiles: string[] = []

        for (const raw of rawImports) {
          if (typeof raw !== 'string') continue
          const normalized = normalizeImportPath(raw)

          const match = siblings.find((s) => {
            // Exact match first
            if (s.filePath === normalized) return true
            // Prefix match for extensionless normalized paths
            if (s.filePath.startsWith(normalized + '.')) return true
            return false
          })

          if (match) {
            reconciledRequiredFiles.push(`FILE ${match.fileNumber}: ${match.filePath}`)
          }
        }

        // Only update if we found at least one real match — avoid wiping a
        // correct existing list if Claude produced no recognisable project imports
        if (reconciledRequiredFiles.length > 0) {
          await prisma.projectFile.update({
            where: { id: fileId },
            data: { requiredFiles: reconciledRequiredFiles },
          })
          // Reflect reconciled list in the response
          updatedFile.requiredFiles = reconciledRequiredFiles
        }
      }
    } catch (reconcileError) {
      // Non-fatal — log and continue. The JSON was already saved successfully.
      console.warn('[json/route] requiredFiles reconciliation failed', reconcileError)
    }
    // ── End reconciliation ─────────────────────────────────────────────────

    const result: FileWithContent = {
      id: updatedFile.id,
      projectId: updatedFile.projectId,
      fileNumber: updatedFile.fileNumber,
      filePath: updatedFile.filePath,
      fileName: updatedFile.fileName,
      phase: updatedFile.phase,
      phaseName: updatedFile.phaseName,
      status: updatedFile.status as FileWithContent['status'],
      codeContent: updatedFile.codeContent,
      lineCount: updatedFile.lineCount,
      filePrompt: updatedFile.filePrompt,
      jsonSummary: updatedFile.jsonSummary as Record<string, unknown> | null,
      requiredFiles: updatedFile.requiredFiles,
      notes: updatedFile.notes,
      codeAddedAt: updatedFile.codeAddedAt,
      completedAt: updatedFile.completedAt,
      createdAt: updatedFile.createdAt,
      updatedAt: updatedFile.updatedAt,
    }

    return NextResponse.json({ data: { file: result } }, { status: 200 })
  } catch (error) {
    console.error('[POST /api/projects/[projectId]/files/[fileId]/json]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}