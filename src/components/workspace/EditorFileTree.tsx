'use client'

// 1. React imports
import { useState, useCallback, useMemo, useRef } from 'react'

// 2. Third-party library imports
import { ChevronRight, ChevronDown, Folder, FolderOpen, File } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'

// 3. Internal imports — UI components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// 4. Internal imports — shared components
import { SearchInput } from '@/components/shared/SearchInput'

// 5. Internal imports — services, hooks, stores, types, utils
import { useEditor } from '@/hooks/useEditor'
import { useFiles } from '@/hooks/useFiles'
import { useEditorStore } from '@/store/editorStore'
import { copyToClipboard } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { VIRTUALIZATION_THRESHOLD } from '@/lib/constants'
import type { FileWithContent, FileStatus } from '@/types'
import type { LocalFileNode } from '@/store/editorStore'

// 6. Local types
interface EditorFileTreeProps {
  projectId: string
}

interface FolderNode {
  type: 'folder'
  name: string
  path: string
  children: TreeNode[]
}

interface FileNode {
  type: 'file'
  name: string
  path: string
  file: FileWithContent
}

type TreeNode = FolderNode | FileNode

interface ContextMenuState {
  x: number
  y: number
  file: FileWithContent
}

// 7. Helper functions

/** Maps FileStatus to Tailwind color class for file icon */
function getFileIconColor(status: FileStatus): string {
  switch (status) {
    case 'COMPLETE':
      return 'text-[var(--status-complete)]'
    case 'CODE_PASTED':
      return 'text-[var(--status-in-progress)]'
    case 'ERROR':
      return 'text-[var(--status-error)]'
    case 'EMPTY':
    default:
      return 'text-[var(--text-tertiary)]'
  }
}

/** Builds a tree structure from a flat file list */
function buildFileTree(files: FileWithContent[]): TreeNode[] {
  const root: Map<string, FolderNode> = new Map()

  // Helper to get-or-create a folder node
  function getOrCreateFolder(
    parts: string[],
    nodes: TreeNode[],
    folderMap: Map<string, FolderNode>
  ): TreeNode[] {
    if (parts.length === 0) return nodes
    const key = parts.join('/')
    if (!folderMap.has(key)) {
      const node: FolderNode = {
        type: 'folder',
        name: parts[parts.length - 1]!,
        path: key,
        children: [],
      }
      folderMap.set(key, node)
      // Find parent
      if (parts.length === 1) {
        nodes.push(node)
      } else {
        const parentKey = parts.slice(0, -1).join('/')
        const parent = folderMap.get(parentKey)
        if (parent) {
          parent.children.push(node)
        } else {
          nodes.push(node)
        }
      }
    }
    return nodes
  }

  const topLevel: TreeNode[] = []

  // Sort files by path for stable tree order
  const sorted = [...files].sort((a, b) => a.filePath.localeCompare(b.filePath))

  for (const file of sorted) {
    const parts = file.filePath.split('/')
    if (parts.length === 1) {
      // Root-level file
      topLevel.push({ type: 'file', name: file.fileName, path: file.filePath, file })
    } else {
      // Build all ancestor folders
      for (let i = 1; i < parts.length; i++) {
        getOrCreateFolder(parts.slice(0, i), topLevel, root)
      }
      const parentKey = parts.slice(0, -1).join('/')
      const parentFolder = root.get(parentKey)
      const fileNode: FileNode = {
        type: 'file',
        name: file.fileName,
        path: file.filePath,
        file,
      }
      if (parentFolder) {
        parentFolder.children.push(fileNode)
      } else {
        topLevel.push(fileNode)
      }
    }
  }

  return topLevel
}

/** Flattens tree into ordered list of renderable rows for virtualization */
interface FlatRow {
  type: 'folder' | 'file'
  depth: number
  name: string
  path: string
  file?: FileWithContent
  hasChildren?: boolean
}

function flattenTree(
  nodes: TreeNode[],
  expandedFolders: Set<string>,
  depth = 0
): FlatRow[] {
  const rows: FlatRow[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      const isOpen = expandedFolders.has(node.path)
      rows.push({
        type: 'folder',
        depth,
        name: node.name,
        path: node.path,
        hasChildren: node.children.length > 0,
      })
      if (isOpen) {
        rows.push(...flattenTree(node.children, expandedFolders, depth + 1))
      }
    } else {
      rows.push({
        type: 'file',
        depth,
        name: node.name,
        path: node.path,
        file: node.file,
      })
    }
  }
  return rows
}

/** Collects all folder paths from a tree (for initial expand/collapse) */
function collectFolderPaths(nodes: TreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path)
      paths.push(...collectFolderPaths(node.children))
    }
  }
  return paths
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

// ─── Local-mode tree builder from LocalFileNode[] ─────────────────────────────

function buildLocalFileTree(nodes: LocalFileNode[]): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      result.push({
        type: 'folder',
        name: node.name,
        path: node.path,
        children: buildLocalFileTree(node.children ?? []),
      })
    } else {
      // Create a minimal FileWithContent shell so renderRow can work uniformly
      const shell: FileWithContent = {
        id: node.path,           // use path as stable id in local mode
        projectId: '',
        fileNumber: '',
        filePath: node.path,
        fileName: node.name,
        phase: 0,
        phaseName: '',
        status: 'EMPTY',
        codeContent: null,
        lineCount: null,
        filePrompt: null,
        jsonSummary: null,
        requiredFiles: [],
        notes: null,
        codeAddedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      result.push({
        type: 'file',
        name: node.name,
        path: node.path,
        file: shell,
      })
    }
  }
  return result
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EditorFileTree({ projectId }: EditorFileTreeProps): JSX.Element {
  const { files, updateFileStatus } = useFiles(projectId)
  const { openFileId, openFile, isLocalMode, openLocalFile } = useEditor(projectId)
  const { localFileTree, openLocalPath } = useEditorStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // ── Tree construction (DB mode vs local mode) ────────────────────────────

  // In local mode, build tree from localFileTree. In DB mode, build from files.
  const filteredFiles = useMemo(() => {
    if (isLocalMode) return []          // not used in local mode
    if (!searchQuery) return files
    return files.filter((f) =>
      f.filePath.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [isLocalMode, files, searchQuery])

  const tree = useMemo(() => {
    if (isLocalMode) {
      const baseTree = buildLocalFileTree(localFileTree)
      if (!searchQuery) return baseTree
      // Filter local tree by flattening, filtering, then rebuilding
      const filterNodes = (nodes: TreeNode[]): TreeNode[] =>
        nodes.reduce<TreeNode[]>((acc, node) => {
          if (node.type === 'folder') {
            const filteredChildren = filterNodes(node.children)
            if (filteredChildren.length > 0) {
              acc.push({ ...node, children: filteredChildren })
            }
          } else if (node.path.toLowerCase().includes(searchQuery.toLowerCase())) {
            acc.push(node)
          }
          return acc
        }, [])
      return filterNodes(baseTree)
    }
    return buildFileTree(filteredFiles)
  }, [isLocalMode, localFileTree, filteredFiles, searchQuery])

  // When searching, expand all folders automatically
  const effectiveExpanded = useMemo(() => {
    if (searchQuery) {
      return new Set(collectFolderPaths(tree))
    }
    return expandedFolders
  }, [searchQuery, tree, expandedFolders])

  const flatRows = useMemo(
    () => flattenTree(tree, effectiveExpanded),
    [tree, effectiveExpanded]
  )

  // ── Virtualization (only when > VIRTUALIZATION_THRESHOLD files) ────────────

  const shouldVirtualize = files.length > VIRTUALIZATION_THRESHOLD

  // ── Handlers ────────────────────────────────────────────────────────────

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }, [])

  const handleFileClick = useCallback(
    (fileId: string) => {
      if (isLocalMode) {
        // In local mode, fileId is the file path — find the handle in localFileTree
        const findHandle = (
          nodes: LocalFileNode[],
          targetPath: string
        ): FileSystemFileHandle | null => {
          for (const node of nodes) {
            if (node.type === 'file' && node.path === targetPath) {
              return node.handle as FileSystemFileHandle
            }
            if (node.type === 'folder' && node.children) {
              const found = findHandle(node.children, targetPath)
              if (found) return found
            }
          }
          return null
        }
        const handle = findHandle(localFileTree, fileId)
        if (handle) {
          openLocalFile(handle, fileId)
        }
      } else {
        openFile(fileId)
      }
    },
    [isLocalMode, localFileTree, openLocalFile, openFile]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: FileWithContent) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, file })
    },
    []
  )

  const handleCopyPath = useCallback((filePath: string) => {
    copyToClipboard(filePath)
    setContextMenu(null)
  }, [])

  const handleMarkComplete = useCallback(
    async (fileId: string) => {
      await updateFileStatus(fileId, 'COMPLETE')
      setContextMenu(null)
    },
    [updateFileStatus]
  )

  // ── Row renderer ─────────────────────────────────────────────────────────

  const renderRow = useCallback(
    (row: FlatRow, index: number) => {
      const indentPx = row.depth * 16

      if (row.type === 'folder') {
        const isOpen = effectiveExpanded.has(row.path)
        return (
          <button
            key={`folder-${row.path}-${index}`}
            type="button"
            onClick={() => toggleFolder(row.path)}
            style={{ paddingLeft: `${8 + indentPx}px` }}
            className={cn(
              'flex w-full items-center gap-1.5 py-1 pr-2 text-left text-sm',
              'rounded-md transition-colors duration-100',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]'
            )}
            aria-expanded={isOpen}
          >
            {/* Chevron */}
            <span className="flex-shrink-0 text-[var(--text-tertiary)]">
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>

            {/* Folder icon */}
            <span className="flex-shrink-0 text-[var(--text-secondary)]">
              {isOpen ? (
                <FolderOpen className="h-4 w-4" />
              ) : (
                <Folder className="h-4 w-4" />
              )}
            </span>

            {/* Folder name */}
            <span className="truncate font-medium">{row.name}</span>
          </button>
        )
      }

      // File row
      const file = row.file!
      // In local mode, active file is tracked by path; in DB mode by id
      const isActive = isLocalMode
        ? row.path === openLocalPath
        : file.id === openFileId
      // In local mode all files show as neutral (no DB status)
      const iconColor = isLocalMode ? 'text-[var(--text-tertiary)]' : getFileIconColor(file.status)

      return (
        <DropdownMenu
          key={`file-${file.id}`}
          open={contextMenu?.file.id === file.id}
          onOpenChange={(open) => {
            if (!open) setContextMenu(null)
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={() => handleFileClick(file.id)}
              onContextMenu={(e) => handleContextMenu(e, file)}
              style={{ paddingLeft: `${8 + indentPx}px` }}
              className={cn(
                'group flex w-full items-center gap-1.5 py-1 pr-2 text-left text-sm',
                'rounded-md transition-colors duration-100 outline-none',
                'focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]',
                isActive
                  ? 'border-l-2 border-[var(--accent-primary)] bg-[var(--accent-light)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]'
              )}
              aria-current={isActive ? 'true' : undefined}
              title={file.filePath}
            >
              {/* Spacer to account for chevron width */}
              <span className="flex-shrink-0 w-3.5" aria-hidden="true" />

              {/* File icon colored by status */}
              <File className={cn('h-4 w-4 flex-shrink-0', iconColor)} />

              {/* File name — truncated */}
              <span className="truncate">{row.name}</span>
            </button>
          </DropdownMenuTrigger>

          {/* Context menu — shown on right-click */}
          {contextMenu?.file.id === file.id && (
            <DropdownMenuContent
              style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
              className="w-44 bg-[var(--bg-tertiary)] border-[var(--border-default)]"
            >
              <DropdownMenuItem
                onClick={() => handleFileClick(file.id)}
                className="text-[var(--text-primary)] focus:bg-[var(--bg-quaternary)] cursor-pointer text-sm"
              >
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleCopyPath(file.filePath)}
                className="text-[var(--text-primary)] focus:bg-[var(--bg-quaternary)] cursor-pointer text-sm"
              >
                Copy Path
              </DropdownMenuItem>
              {/* DB-only actions — hidden in local mode */}
              {!isLocalMode && (
                <>
                  <DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
                  <DropdownMenuItem
                    onClick={() => handleMarkComplete(file.id)}
                    className="text-[var(--status-complete)] focus:bg-[var(--bg-quaternary)] cursor-pointer text-sm"
                  >
                    Mark Complete
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setContextMenu(null)}
                    className="text-[var(--text-secondary)] focus:bg-[var(--bg-quaternary)] cursor-pointer text-sm"
                  >
                    View Prompt
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      )
    },
    [
      openFileId,
      openLocalPath,
      isLocalMode,
      effectiveExpanded,
      contextMenu,
      toggleFolder,
      handleFileClick,
      handleContextMenu,
      handleCopyPath,
      handleMarkComplete,
    ]
  )

  // ── Virtualized list wrapper (for large projects) ─────────────────────────

  function VirtualList() {
    const parentRef = useRef<HTMLDivElement | null>(null)

    const rowVirtualizer = useVirtualizer({
      count: flatRows.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 28,
      overscan: 10,
    })

    return (
      <div
        ref={parentRef}
        className="overflow-y-auto flex-1"
        style={{ height: '100%' }}
      >
        <div
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = flatRows[virtualRow.index]!
            return (
              <div
                key={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                }}
              >
                {renderRow(row, virtualRow.index)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-secondary)]">
      {/* Search bar */}
      <div className="flex-shrink-0 p-2 border-b border-[var(--border-subtle)]">
        <SearchInput
          onSearch={setSearchQuery}
          placeholder="Filter files…"
          debounceMs={150}
          className="w-full"
        />
      </div>

      {/* File count + mode indicator */}
      <div className="flex-shrink-0 px-3 py-1.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <span className="text-xs text-[var(--text-tertiary)]">
          {isLocalMode
            ? `local folder`
            : `${filteredFiles.length} ${filteredFiles.length === 1 ? 'file' : 'files'}${
                searchQuery && files.length !== filteredFiles.length
                  ? ` of ${files.length}`
                  : ''
              }`}
        </span>
        {isLocalMode && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent-primary)]">
            LOCAL
          </span>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-1">
        {flatRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <File className="h-8 w-8 text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--text-tertiary)]">
              {searchQuery ? 'No files match your search' : 'No files yet'}
            </p>
          </div>
        ) : shouldVirtualize ? (
          <VirtualList />
        ) : (
          <div className="space-y-0.5">
            {flatRows.map((row, i) => renderRow(row, i))}
          </div>
        )}
      </div>
    </div>
  )
}