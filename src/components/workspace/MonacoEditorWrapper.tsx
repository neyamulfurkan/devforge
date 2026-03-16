'use client'

// 1. React imports
import { useRef, useEffect, useCallback } from 'react'

// 2. Next.js imports
import dynamic from 'next/dynamic'

// 3. Third-party library imports
import { FileCode } from 'lucide-react'

// 4. Internal imports — shared components
import { EmptyState } from '@/components/shared/EmptyState'

// 5. Internal imports — hooks, stores, utils, types
import { useEditorStore } from '@/store/editorStore'
import { useSettings } from '@/hooks/useSettings'
import { getFileLanguage } from '@/lib/utils'
import { debounce } from '@/lib/utils'
import {
  DEFAULT_EDITOR_THEME,
  DEFAULT_EDITOR_FONT_SIZE,
  EDITOR_AUTOSAVE_DEBOUNCE_MS,
} from '@/lib/constants'
import type { FileWithContent } from '@/types'

// ─── EditorSkeleton ──────────────────────────────────────────────────────────
// Animated placeholder shown while Monaco loads
function EditorSkeleton(): JSX.Element {
  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e] animate-pulse">
      {/* Fake gutter + line area */}
      <div className="flex h-full overflow-hidden">
        {/* Line number gutter */}
        <div className="flex w-12 flex-col gap-2 border-r border-[#2a2a2a] px-2 py-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-[#2a2a2a]"
              style={{ width: `${Math.random() * 20 + 14}px` }}
            />
          ))}
        </div>
        {/* Code area */}
        <div className="flex flex-1 flex-col gap-2 px-4 py-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-[#2a2a2a]"
              style={{ width: `${Math.random() * 50 + 20}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Monaco dynamic import ───────────────────────────────────────────────────
// CRITICAL: ssr: false is non-negotiable — Monaco requires browser DOM APIs
// and will throw ReferenceError on server render.
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react'),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  }
)

// ─── Props ───────────────────────────────────────────────────────────────────
interface MonacoEditorWrapperProps {
  file: FileWithContent | null
  onContentChange: (content: string) => void
  isLocalMode?: boolean
  openLocalPath?: string | null
  onEditorMount?: (editor: { runFindReplace: () => void; runFind: () => void }) => void
  onCodePasted?: (filePath: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function MonacoEditorWrapper({
  file,
  onContentChange,
  isLocalMode: isLocalModeProp,
  openLocalPath: openLocalPathProp,
  onEditorMount,
  onCodePasted,
}: MonacoEditorWrapperProps): JSX.Element {
  const { isReadOnly, fileContent } = useEditorStore()
  const isLocalMode = isLocalModeProp ?? false
  const { settings } = useSettings()

  // Ref to the live Monaco editor instance — typed as unknown, cast at call site
  const editorInstanceRef = useRef<unknown>(null)

  // Stable ref for debounced callback to avoid stale closures
  const onContentChangeRef = useRef(onContentChange)
  useEffect(() => {
    onContentChangeRef.current = onContentChange
  }, [onContentChange])

  // Debounced handler — fires 500ms after last keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedChange = useCallback(
    debounce((...args: unknown[]) => {
      onContentChangeRef.current(args[0] as string)
    }, EDITOR_AUTOSAVE_DEBOUNCE_MS),
    [] // stable — debounce wraps the ref-based callback
  )

  // Resolve editor settings from user preferences with fallbacks
  const editorTheme = settings?.editorTheme ?? DEFAULT_EDITOR_THEME
  const editorFontSize = settings?.editorFontSize ?? DEFAULT_EDITOR_FONT_SIZE

  // Resolve active path — local mode uses openLocalPath prop, DB mode uses file.filePath
  const activePath = isLocalMode ? (openLocalPathProp ?? '') : (file?.filePath ?? '')
  const language = activePath ? getFileLanguage(activePath) : 'plaintext'
  const hasLocalFileOpen = isLocalMode && !!openLocalPathProp

  // Detect mobile to disable minimap (improves perf on small screens)
  const isMobile =
    typeof window !== 'undefined' && window.innerWidth < 768

  // ── Empty state when no file is selected ──
  if (!file && !hasLocalFileOpen) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]">
        <EmptyState
          icon={FileCode}
          title="No file selected"
          description="Select a file from the file tree to begin editing."
        />
      </div>
    )
  }

  // ── Monaco editor ──
  // In local mode, content lives in editorStore.fileContent (loaded from disk).
  // In DB mode, content is seeded from file.codeContent on first open, then
  // kept in sync via onContentChange / auto-save.
  const editorValue = isLocalMode ? fileContent : (file?.codeContent ?? fileContent)

  return (
    <div className="h-full w-full overflow-hidden">
      <MonacoEditor
        height="100%"
        width="100%"
        language={language}
        theme={editorTheme}
        value={editorValue}
        beforeMount={(monaco) => {
          // Enable semantic validation so TypeScript errors show as red squiggles,
          // matching VS Code behaviour. We suppress only the "cannot find module"
          // errors that Monaco raises because it has no access to node_modules —
          // those are noise, not real errors in the user's code.
          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            // Suppress: "Cannot find module '...'" (2307)
            //           "Could not find declaration file" (7016)
            //           "Cannot find name 'React'" etc when no lib (2304)
            //           "Module ... has no exported member" from missing @types (2305)
            diagnosticCodesToIgnore: [2307, 7016, 2304, 2305, 2339, 2769],
          })
          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            diagnosticCodesToIgnore: [2307, 7016, 2304, 2305, 2339, 2769],
          })
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            baseUrl: '.',
            paths: { '@/*': ['src/*'] },
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            strict: true,
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            lib: ['esnext', 'dom', 'dom.iterable'],
            noEmit: true,
          })
          // Also apply to JS
          monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            baseUrl: '.',
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            target: monaco.languages.typescript.ScriptTarget.ESNext,
            lib: ['esnext', 'dom', 'dom.iterable'],
          })
        }}
        onMount={(editor) => {
          editorInstanceRef.current = editor
          if (onEditorMount) {
            onEditorMount({
              runFindReplace: () => {
                editor.focus()
                editor.getAction('editor.action.startFindReplaceAction')?.run()
              },
              runFind: () => {
                editor.focus()
                editor.getAction('actions.find')?.run()
              },
            })
          }
          // Detect paste events — fire onCodePasted so parent can open JSON modal
          editor.onDidPaste(() => {
            if (onCodePasted && !isLocalMode) {
              const path = file?.filePath ?? ''
              if (path) onCodePasted(path)
            }
          })
        }}
        onChange={(value) => {
          if (value !== undefined) {
            debouncedChange(value)
          }
        }}
        options={{
          // Font
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: editorFontSize,
          fontLigatures: true,

          // Layout
          minimap: { enabled: !isMobile },
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          lineDecorationsWidth: 4,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'gutter',
          folding: true,
          glyphMargin: false,

          // Scrollbar
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false,
          },

          // Editing
          readOnly: isReadOnly,
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: false,
          find: {
            addExtraSpaceOnTop: false,
            seedSearchStringFromSelection: 'selection',
          },
          // Keep the find widget inside the editor scroll container
          fixedOverflowWidgets: false,

          // Accessibility
          accessibilitySupport: 'auto',
        }}
      />
    </div>
  )
}