// src/types/index.ts

// 1. Prisma type re-exports
export type {
  User,
  Project,
  ProjectDocument,
  DocumentVersion,
  ProjectFile,
  ErrorSession,
  ProjectFeature,
  Collection,
  CollectionPrompt,
  LibraryPrompt,
  PromptTemplate,
  SharedProject,
  UserSettings,
  FileStatus as PrismaFileStatus,
  ProjectStatus as PrismaProjectStatus,
  ErrorType as PrismaErrorType,
  ErrorSessionStatus,
  CollectionVisibility,
  PromptVisibility,
} from '@prisma/client'

// 2. Enum-style type aliases (string unions matching Prisma enums)
export type FileStatus = 'EMPTY' | 'CODE_PASTED' | 'COMPLETE' | 'ERROR'
export type ProjectStatus = 'IN_PROGRESS' | 'COMPLETE' | 'PAUSED' | 'ARCHIVED'
export type ErrorType = 'TYPESCRIPT' | 'BUILD' | 'RUNTIME' | 'CONSOLE' | 'OTHER'
export type WorkspaceTab = 'overview' | 'document' | 'files' | 'editor' | 'prompts' | 'errors' | 'export'

// 3. Core API response types (Section 5.12)
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  details?: unknown
  meta?: Partial<{
    total: number
    page: number
    pageSize: number
    hasMore: boolean
    fallback: boolean
  }> & Record<string, unknown>
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// 4. Document parsing types (Section 5.11 canonical definitions)
export interface ParsedDocumentSection {
  sectionNumber: string        // e.g. "1", "1.1", "11"
  title: string                // e.g. "PROJECT OVERVIEW AND VISION"
  rawContent: string           // Full raw text of this section including subsections
  subsections: ParsedDocumentSection[]  // Nested subsections (### SECTION level)
  wordCount: number            // Word count of rawContent
  isAppendOnly: boolean        // true for sections 11, 12, 13
}

export interface ExtractedFile {
  fileNumber: string
  filePath: string
  fileName: string
  phase: number
  phaseName: string
  requiredFiles: string[]
}
// 5. Terminal script generation options (Section 5.12)
export interface TerminalScriptOptions {
  platform: 'windows' | 'unix'
  includeFileCreation: boolean   // true = create empty files; false = folders only
  includeNpmInstall: boolean     // true = append npm install command at end
  rootPrefix: string             // e.g. "" (empty) or "my-project/" — prepended to all paths
}

// 6. File with code content for editor (Section 5.12)
export interface FileWithContent {
  id: string
  projectId: string
  fileNumber: string
  filePath: string
  fileName: string
  phase: number
  phaseName: string
  status: FileStatus
  codeContent: string | null
  lineCount: number | null
  filePrompt: string | null
  jsonSummary: Record<string, unknown> | null
  requiredFiles: string[]
  notes: string | null
  codeAddedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// 7. Feature delta result (Section 5.12)
export interface DeltaResult {
  featureTitle: string
  featureSummary: string
  newFiles: Array<{
    filePath: string
    purpose: string
    phase: number
    phaseName: string
  }>
  modifiedFiles: Array<{
    filePath: string
    changeDescription: string
    changes: Array<{
      findLine: string       // Exact line including whitespace/indentation
      replaceLine: string    // Exact replacement line including whitespace/indentation
    }>
  }>
  documentChanges: Array<{
    sectionNumber: number
    appendContent: string    // Full markdown text to append to that section
  }>
}

// 8. Activity feed entry
export type ActivityType =
  | 'file_complete'
  | 'error_added'
  | 'json_appended'
  | 'feature_added'
  | 'error_resolved'

export interface ActivityEntry {
  id: string
  type: ActivityType
  projectId: string
  projectName: string
  description: string
  createdAt: Date
}

// 9. Project creation step 2 config
export interface ProjectConfig {
  name: string
  platformType: string
  visibility: 'private' | 'public'
  techStack: string[]
  additionalNotes?: string
}

// 10. JSON registry entry shape (for validation in jsonRegistryService)
export interface JsonRegistryEntry {
  file: string
  fileNumber: string
  exports: string[]
  imports: string[]
  keyLogic: string
  sideEffects: string[]
  dependents: string[]
  status: string
  generatedAt: string
}

// 11. Version history entry (subset of DocumentVersion for display)
export interface VersionSummary {
  id: string
  versionNumber: number
  triggerEvent: string
  changeSummary: string | null
  createdAt: Date
}

// 12. Global search result shape
export interface PinnedPrompt {
  id: string
  title: string
  promptText: string
  aiTool: string | null
  category: string | null
  sourceType: 'library' | 'collection'
  sourceId: string
  pinnedAt: number
}

export interface QuickPanelPosition {
  x: number
  y: number
}

export type PanelDock = 'free' | 'left' | 'right'

export interface SearchResult {
  files: Array<{ id: string; filePath: string; fileName: string; projectId: string }>
  collections: Array<{ id: string; name: string }>
  collectionPrompts: Array<{ id: string; title: string; collectionId: string }>
  libraryPrompts: Array<{ id: string; title: string; description: string }>
}

// 13. Editor cursor position
export interface CursorPosition {
  lineNumber: number
  column: number
}

// 14. Template variable definition (matches TEMPLATE_VARIABLES in constants)
export interface TemplateVariable {
  name: string
  description: string
  example: string
}

// 15. Shared project with author (used in feed)
export interface SharedProjectWithAuthor {
  id: string
  projectId: string
  authorId: string
  screenshotUrl: string | null
  demoUrl: string | null
  buildTimeHours: number | null
  sharedSections: string[]
  shareFilePrompts: boolean
  viewCount: number
  copyCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  author: {
    name: string
    profileImageUrl: string | null
  }
  project: {
    name: string
    description: string
    techStack: string[]
    totalFiles: number
  }
}