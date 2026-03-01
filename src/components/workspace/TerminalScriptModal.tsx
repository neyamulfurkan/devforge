'use client'

// 1. React imports
import { useState, useEffect } from 'react'

// 2. Third-party library imports
import { Terminal } from 'lucide-react'

// 3. Internal imports — UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// 4. Internal imports — shared components
import { CopyButton } from '@/components/shared/CopyButton'

// 5. Internal imports — services, types
import { generateScriptForOS } from '@/services/scriptGenerator'
import type { ExtractedFile } from '@/types'

// 6. Internal imports — utils
import { cn } from '@/lib/utils'

// Local types
interface TerminalScriptModalProps {
  open: boolean
  onClose: () => void
  files: ExtractedFile[]
  npmInstallCmd: string
}

type Platform = 'windows' | 'unix'

export function TerminalScriptModal({
  open,
  onClose,
  files,
  npmInstallCmd,
}: TerminalScriptModalProps): JSX.Element {
  const [activePlatform, setActivePlatform] = useState<Platform>('unix')
  const [script, setScript] = useState('')

  // Regenerate script whenever platform or files change
  useEffect(() => {
    const generated = generateScriptForOS(files, {
      platform: activePlatform,
      includeFileCreation: true,
      includeNpmInstall: false,
      rootPrefix: '',
    })
    setScript(generated)
  }, [activePlatform, files])

  const handleTabChange = (value: string): void => {
    setActivePlatform(value as Platform)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'max-w-3xl bg-[var(--bg-tertiary)] border-[var(--border-default)]',
          'flex flex-col max-h-[85vh]'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--text-primary)]">
            <Terminal className="h-5 w-5 text-[var(--accent-primary)]" />
            Terminal Setup Script
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Platform tabs */}
          <Tabs
            value={activePlatform}
            onValueChange={handleTabChange}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shrink-0 w-fit">
              <TabsTrigger
                value="unix"
                className="data-[state=active]:bg-[var(--accent-primary)] data-[state=active]:text-white text-[var(--text-secondary)]"
              >
                Mac / Linux Bash
              </TabsTrigger>
              <TabsTrigger
                value="windows"
                className="data-[state=active]:bg-[var(--accent-primary)] data-[state=active]:text-white text-[var(--text-secondary)]"
              >
                Windows CMD
              </TabsTrigger>
            </TabsList>

            {/* Script content — same for both tabs since script state updates on tab change */}
            <TabsContent value="unix" className="flex-1 overflow-hidden mt-2">
              <ScriptBlock script={script} />
            </TabsContent>
            <TabsContent value="windows" className="flex-1 overflow-hidden mt-2">
              <ScriptBlock script={script} />
            </TabsContent>
          </Tabs>

          <Separator className="bg-[var(--border-subtle)] shrink-0" />

          {/* npm install section */}
          <div className="shrink-0 space-y-2">
            <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              Install Dependencies
            </p>
            <div className="relative flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-md px-4 py-3">
              <code className="flex-1 font-mono text-xs text-[var(--text-primary)] break-all">
                {npmInstallCmd || 'npm install'}
              </code>
              <CopyButton value={npmInstallCmd || 'npm install'} size="sm" />
            </div>
          </div>

          {/* Instruction text */}
          <p className="text-xs text-[var(--text-tertiary)] shrink-0">
            Run this script in your project root directory to create all folders and empty files.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Internal sub-component for the script display block
interface ScriptBlockProps {
  script: string
}

function ScriptBlock({ script }: ScriptBlockProps): JSX.Element {
  return (
    <div className="relative rounded-md overflow-hidden border border-[var(--border-subtle)] h-full">
      {/* Copy button — top right overlay */}
      <div className="absolute top-2 right-2 z-10">
        <CopyButton value={script} size="sm" />
      </div>

      <ScrollArea className="h-[400px] w-full">
        <pre
          className={cn(
            'p-4 text-xs font-mono leading-relaxed',
            'text-[var(--text-secondary)] bg-[var(--bg-secondary)]',
            'whitespace-pre overflow-x-auto min-h-full'
          )}
        >
          {script}
        </pre>
      </ScrollArea>
    </div>
  )
}