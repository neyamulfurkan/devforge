// 1. External imports
import Fuse, { type IFuseOptions } from 'fuse.js'

// 2. Type imports
import type { LibraryPrompt, ParsedDocumentSection, FileWithContent } from '@/types'

// 3. Fuse.js configuration constants

const LIBRARY_FUSE_OPTIONS: IFuseOptions<LibraryPrompt> = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'description', weight: 0.3 },
    { name: 'promptText', weight: 0.2 },
  ],
  threshold: 0.35,
  minMatchCharLength: 2,
  includeScore: true,
  useExtendedSearch: false,
  ignoreLocation: true,
}

const DOCUMENT_FUSE_OPTIONS: IFuseOptions<{ sectionNumber: string; content: string }> = {
  keys: [{ name: 'content', weight: 1.0 }],
  threshold: 0.2,
  minMatchCharLength: 3,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
}

// 4. Exported service functions

export function buildSearchIndex(items: LibraryPrompt[]): Fuse<LibraryPrompt> {
  return new Fuse(items, LIBRARY_FUSE_OPTIONS)
}

export function searchLibraryPrompts(prompts: LibraryPrompt[], query: string): LibraryPrompt[] {
  if (!query || query.trim().length < 2) {
    return prompts
  }

  const fuse = new Fuse(prompts, LIBRARY_FUSE_OPTIONS)
  const results = fuse.search(query.trim())
  return results.map((result) => result.item)
}

export function searchDocumentContent(
  sections: ParsedDocumentSection[],
  query: string
): Array<{ sectionNumber: string; matchCount: number; matchIndices: number[][] }> {
  if (!query || query.trim().length < 3) {
    return []
  }

  // Flatten sections and subsections into searchable items
  const searchableItems = flattenSections(sections).map((section) => ({
    sectionNumber: section.sectionNumber,
    content: section.rawContent,
  }))

  const fuse = new Fuse(searchableItems, DOCUMENT_FUSE_OPTIONS)
  const results = fuse.search(query.trim())

  return results
    .map((result) => {
      const matchIndices: number[][] = []

      if (result.matches) {
        for (const match of result.matches) {
          if (match.indices) {
            for (const [start, end] of match.indices) {
              matchIndices.push([start, end])
            }
          }
        }
      }

      return {
        sectionNumber: result.item.sectionNumber,
        matchCount: matchIndices.length,
        matchIndices,
      }
    })
    .sort((a, b) => b.matchCount - a.matchCount)
}

export function searchProjectFiles(files: FileWithContent[], query: string): FileWithContent[] {
  if (!query || query.trim().length === 0) {
    return files
  }

  const normalizedQuery = query.trim().toLowerCase()
  return files.filter((file) => file.filePath.toLowerCase().includes(normalizedQuery))
}

// 5. Non-exported helper functions

function flattenSections(sections: ParsedDocumentSection[]): ParsedDocumentSection[] {
  const flat: ParsedDocumentSection[] = []

  for (const section of sections) {
    flat.push(section)
    if (section.subsections.length > 0) {
      flat.push(...flattenSections(section.subsections))
    }
  }

  return flat
}