export const FILE_STATUS = {
  EMPTY: 'EMPTY',
  CODE_PASTED: 'CODE_PASTED',
  COMPLETE: 'COMPLETE',
  ERROR: 'ERROR',
} as const

export const PROJECT_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETE',
  PAUSED: 'PAUSED',
  ARCHIVED: 'ARCHIVED',
} as const

export const ERROR_TYPE = {
  TYPESCRIPT: 'TYPESCRIPT',
  BUILD: 'BUILD',
  RUNTIME: 'RUNTIME',
  CONSOLE: 'CONSOLE',
  OTHER: 'OTHER',
} as const

export const AI_TOOLS = [
  { value: 'claude', label: 'Claude', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  { value: 'chatgpt', label: 'ChatGPT', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  { value: 'gemini', label: 'Gemini', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  { value: 'grok', label: 'Grok', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  { value: 'midjourney', label: 'Midjourney', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  { value: 'dalle', label: 'DALL-E', color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
  { value: 'stable_diffusion', label: 'Stable Diffusion', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  { value: 'other', label: 'Other', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
] as const

export const PROMPT_CATEGORIES = [
  { value: 'development', label: 'Development' },
  { value: 'design_image', label: 'Design & Image' },
  { value: 'writing', label: 'Writing' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'business', label: 'Business' },
  { value: 'data', label: 'Data' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
] as const

export const PHASE_NAMES: Record<number, string> = {
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

export const ITEMS_PER_PAGE = 20

// Maps file extensions to Monaco Editor language IDs
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.prisma': 'prisma',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.env': 'plaintext',
  '.gitignore': 'plaintext',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
  '.txt': 'plaintext',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.toml': 'ini',
  '.xml': 'xml',
  '.svg': 'xml',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'cpp',
  '.cs': 'csharp',
  '.dockerfile': 'dockerfile',
  '': 'plaintext',
}

export const DEFAULT_TEMPLATE_KEYS = [
  'global_context_generator',
  'meta_prompt',
  'file_specific_prompt',
  'error_identify',
  'error_replace',
  'feature_delta',
  'json_registry_entry',
] as const

export type DefaultTemplateKey = typeof DEFAULT_TEMPLATE_KEYS[number]

export const TEMPLATE_VARIABLES: Record<DefaultTemplateKey, Array<{ name: string; description: string; example: string }>> = {
  global_context_generator: [
    {
      name: 'PROJECT_DESCRIPTION',
      description: 'The full project description provided by the user in Step 1',
      example: 'A restaurant management platform with real-time orders, payments, and staff scheduling...',
    },
    {
      name: 'PROJECT_NAME',
      description: 'The name of the project configured in Step 2',
      example: 'RestaurantOS',
    },
    {
      name: 'PLATFORM_TYPE',
      description: 'The platform type selected by the user',
      example: 'Web App',
    },
    {
      name: 'TECH_STACK',
      description: 'Comma-separated list of preferred technologies (may be empty)',
      example: 'Next.js, TypeScript, PostgreSQL, Prisma',
    },
    {
      name: 'ADDITIONAL_NOTES',
      description: 'Any additional notes provided during project configuration',
      example: 'Must support offline mode and PWA installation',
    },
  ],
  meta_prompt: [
    {
      name: 'GLOBAL_CONTEXT_DOCUMENT',
      description: 'The complete Global Context Document for this project',
      example: '## SECTION 1 — PROJECT OVERVIEW...',
    },
    {
      name: 'PROJECT_NAME',
      description: 'The name of the project',
      example: 'DevForge',
    },
    {
      name: 'TOTAL_FILES',
      description: 'Total number of files in the project',
      example: '192',
    },
    {
      name: 'FILE_LIST',
      description: 'Numbered list of all files extracted from Section 4',
      example: 'FILE 001: package.json\nFILE 002: tsconfig.json\n...',
    },
  ],
  file_specific_prompt: [
    {
      name: 'FILE_NUMBER',
      description: 'The three-digit file number (with optional letter suffix)',
      example: '026',
    },
    {
      name: 'FILE_PATH',
      description: 'The full file path relative to project root',
      example: 'src/services/documentParser.ts',
    },
    {
      name: 'FILE_NAME',
      description: 'Just the filename with extension',
      example: 'documentParser.ts',
    },
    {
      name: 'PHASE_NUMBER',
      description: 'The phase number this file belongs to',
      example: '3',
    },
    {
      name: 'PHASE_NAME',
      description: 'The name of the phase',
      example: 'Services Layer',
    },
    {
      name: 'GLOBAL_CONTEXT_DOCUMENT',
      description: 'The complete Global Context Document',
      example: '## SECTION 1 — PROJECT OVERVIEW...',
    },
    {
      name: 'REQUIRED_FILES',
      description: 'List of dependency file numbers and paths that must be provided as context before generating this file',
      example: 'FILE 011: src/lib/constants.ts\nFILE 012: src/types/index.ts\nFILE 009: src/lib/prisma.ts',
    },
    {
      name: 'REQUIRED_FILES_CONTENT',
      description: 'Full source content of the required dependency files, formatted as fenced code blocks',
      example: '// FILE 011: src/lib/constants.ts\n```typescript\nexport const FILE_STATUS = {...}\n```',
    },
    {
      name: 'DEPENDENCY_GATE',
      description: 'Instruction block that forces Claude to list required files before writing any code',
      example: 'Before writing any code, list the files I need to provide. Do NOT write code yet.',
    },
    {
      name: 'FILE_SPEC',
      description: 'The file specification from Section 9 of the Global Context Document',
      example: 'FILE 026: src/services/documentParser.ts\n- Imports: types, constants\n- Exports: parseGlobalDocument...',
    },
  ],
  error_identify: [
    {
      name: 'ERROR_OUTPUT',
      description: 'The complete error output pasted by the developer',
      example: 'TypeError: Cannot read properties of undefined (reading \'map\')\n  at FileRow.tsx:47:23',
    },
    {
      name: 'ERROR_TYPE',
      description: 'The category of error selected by the developer',
      example: 'TypeScript',
    },
    {
      name: 'GLOBAL_CONTEXT_DOCUMENT',
      description: 'The complete Global Context Document for context',
      example: '## SECTION 1 — PROJECT OVERVIEW...',
    },
    {
      name: 'PROJECT_NAME',
      description: 'The name of the project',
      example: 'DevForge',
    },
    {
      name: 'FILE_REGISTRY',
      description: 'Section 11 of the Global Context Document (Generated File Registry)',
      example: '001. {"file": "package.json", "fileNumber": "001", ...}',
    },
  ],
  error_replace: [
    {
      name: 'ERROR_OUTPUT',
      description: 'The original error output for reference',
      example: 'TypeError: Cannot read properties of undefined (reading \'map\')',
    },
    {
      name: 'IDENTIFIED_FILES',
      description: 'The list of files Claude identified in Step 1',
      example: 'src/components/workspace/FileRow.tsx\nsrc/hooks/useFiles.ts',
    },
    {
      name: 'FILE_CONTENTS',
      description: 'The full contents of each identified file',
      example: '// src/components/workspace/FileRow.tsx\nexport function FileRow(...) {...}',
    },
    {
      name: 'GLOBAL_CONTEXT_DOCUMENT',
      description: 'The complete Global Context Document for context',
      example: '## SECTION 1 — PROJECT OVERVIEW...',
    },
  ],
  feature_delta: [
    {
      name: 'FEATURE_DESCRIPTION',
      description: 'The description of the new feature to add (possibly AI-enhanced)',
      example: 'Add a dark/light mode toggle button to the TopBar that persists to UserSettings...',
    },
    {
      name: 'GLOBAL_CONTEXT_DOCUMENT',
      description: 'The complete Global Context Document',
      example: '## SECTION 1 — PROJECT OVERVIEW...',
    },
    {
      name: 'FILE_REGISTRY',
      description: 'Section 11 of the Global Context Document',
      example: '001. {"file": "package.json", ...}',
    },
    {
      name: 'EXISTING_FEATURES',
      description: 'Section 12 of the Global Context Document (features already added)',
      example: '**Feature Added: Export CSV** (added 2026-02-01)...',
    },
    {
      name: 'PROJECT_NAME',
      description: 'The name of the project',
      example: 'DevForge',
    },
  ],
  json_registry_entry: [
    {
      name: 'FILE_NUMBER',
      description: 'The three-digit file number',
      example: '026',
    },
    {
      name: 'FILE_PATH',
      description: 'The full file path',
      example: 'src/services/documentParser.ts',
    },
    {
      name: 'EXPORTS',
      description: 'Comma-separated list of exported identifiers',
      example: 'parseGlobalDocument, extractSections, extractFileTree',
    },
    {
      name: 'IMPORTS',
      description: 'Comma-separated list of import paths',
      example: 'src/types/index.ts, src/lib/constants.ts',
    },
    {
      name: 'KEY_LOGIC',
      description: 'One-sentence summary of what the file does',
      example: 'Parses raw Global Context Document text into structured section objects',
    },
    {
      name: 'SIDE_EFFECTS',
      description: 'Any side effects (database writes, file I/O, etc.)',
      example: 'None',
    },
    {
      name: 'DEPENDENTS',
      description: 'Files that import from this file',
      example: 'src/hooks/useDocument.ts, src/app/api/projects/[projectId]/document/route.ts',
    },
  ],
}

// AI tool color map for quick lookup by value
export const AI_TOOL_COLOR_MAP: Record<string, string> = Object.fromEntries(
  AI_TOOLS.map((tool) => [tool.value, tool.color])
)

// File status display labels
export const FILE_STATUS_LABELS: Record<string, string> = {
  EMPTY: 'Empty',
  CODE_PASTED: 'Code Pasted',
  COMPLETE: 'Complete',
  ERROR: 'Error',
}

// Project status display labels
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  COMPLETE: 'Complete',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
}

// Error type display labels
export const ERROR_TYPE_LABELS: Record<string, string> = {
  TYPESCRIPT: 'TypeScript',
  BUILD: 'Build',
  RUNTIME: 'Runtime',
  CONSOLE: 'Console',
  OTHER: 'Other',
}

// Workspace tab definitions
export const WORKSPACE_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'document', label: 'Document' },
  { value: 'files', label: 'Files' },
  { value: 'editor', label: 'Code Editor' },
  { value: 'prompts', label: 'Prompts' },
  { value: 'errors', label: 'Errors' },
  { value: 'export', label: 'Export' },
] as const

// Section numbers that are append-only (no inline editing)
export const APPEND_ONLY_SECTIONS = ['11', '12', '13'] as const

// Groq model options
export const GROQ_MODELS = [
  { value: 'llama3-70b-8192', label: 'LLaMA 3 70B (8192 ctx)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (32768 ctx)' },
  { value: 'gemma-7b-it', label: 'Gemma 7B Instruct' },
] as const

// Monaco editor theme options
export const MONACO_THEMES = [
  { value: 'vs-dark', label: 'VS Dark' },
  { value: 'hc-black', label: 'High Contrast Black' },
] as const

// Font family options for settings
export const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter (System)' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Fira Code', label: 'Fira Code' },
  { value: 'system-ui', label: 'System UI' },
] as const

// Max file upload size (5MB)
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024

// Allowed image MIME types for avatar upload
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// Copy button tooltip duration in milliseconds
export const COPY_TOOLTIP_DURATION_MS = 1500

// Debounce delay for editor auto-save
export const EDITOR_AUTOSAVE_DEBOUNCE_MS = 500

// Debounce delay for search inputs
export const SEARCH_DEBOUNCE_MS = 300

// Minimum word count required to proceed in Step 1 of project creation
export const MIN_PROJECT_DESCRIPTION_WORDS = 50

// Activity entry types for the feed
export const ACTIVITY_TYPES = {
  FILE_COMPLETE: 'file_complete',
  ERROR_ADDED: 'error_added',
  JSON_APPENDED: 'json_appended',
  FEATURE_ADDED: 'feature_added',
  ERROR_RESOLVED: 'error_resolved',
} as const

// Default accent color
export const DEFAULT_ACCENT_COLOR = '#6366f1'

// Default editor font size
export const DEFAULT_EDITOR_FONT_SIZE = 14

// Default editor theme
export const DEFAULT_EDITOR_THEME = 'vs-dark'

// Maximum tech stack badges shown in project cards before "+N more"
export const MAX_TECH_STACK_BADGES = 3

// Maximum activity feed items shown on dashboard
export const MAX_DASHBOARD_ACTIVITY_ITEMS = 10

// Maximum search results per category in global search
export const MAX_SEARCH_RESULTS_PER_CATEGORY = 5

// Number of recent saved prompts shown on dashboard
export const DASHBOARD_RECENT_PROMPTS_COUNT = 4

// Virtualization threshold — use react-virtual when list exceeds this count
export const VIRTUALIZATION_THRESHOLD = 100