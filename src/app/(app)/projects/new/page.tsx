'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Next.js imports
import { useRouter } from 'next/navigation'

// 3. Third-party library imports
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'

// 4. Internal imports — layout components
import { PageContainer } from '@/components/layout/PageContainer'

// 5. Internal imports — project creation step components
import { ProjectCreationStepper } from '@/components/project/ProjectCreationStepper'
import { DescribeProjectStep } from '@/components/project/DescribeProjectStep'
import { ConfigureProjectStep } from '@/components/project/ConfigureProjectStep'
import { GenerateDocumentStep } from '@/components/project/GenerateDocumentStep'

// 6. Internal imports — types
import type { ProjectConfig } from '@/types'

// 7. Local types
type Step = 1 | 2 | 3

interface StepDefinition {
  label: string
  description: string
}

// 8. Step definitions for the stepper
const STEPS: StepDefinition[] = [
  {
    label: 'Describe',
    description: 'Tell us about your project',
  },
  {
    label: 'Configure',
    description: 'Set project details',
  },
  {
    label: 'Generate',
    description: 'Create your context document',
  },
]

// 9. Page component
export default function NewProjectPage(): JSX.Element {
  // 9a. State hooks
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [description, setDescription] = useState<string>('')
  const [useAI, setUseAI] = useState<boolean>(false)
  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isImporting, setIsImporting] = useState<boolean>(false)

  // 9b. External hooks
  const router = useRouter()

  // 9c. Step 1 → Step 2: optionally enhance description with Groq, then generate the document prompt
  const handleStep1Next = useCallback(
    async (rawDescription: string, requestAI: boolean): Promise<void> => {
      setIsLoading(true)
      setDescription(rawDescription)
      setUseAI(requestAI)

      try {
        let finalDescription = rawDescription

        // If AI enhancement requested, call the enhancement endpoint
        if (requestAI) {
          try {
            const enhanceRes = await fetch('/api/ai/enhance-description', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ description: rawDescription }),
            })

            if (enhanceRes.ok) {
              const enhanceData = (await enhanceRes.json()) as {
                enhanced: string | null
                fallback: boolean
              }

              if (enhanceData.fallback || enhanceData.enhanced === null) {
                // Section 3.4: non-blocking amber warning, continue with original
                toast.warning('AI enhancement unavailable — using your description as-is', {
                  duration: 4000,
                })
              } else {
                finalDescription = enhanceData.enhanced
              }
            } else {
              toast.warning('AI enhancement unavailable — using your description as-is', {
                duration: 4000,
              })
            }
          } catch {
            // Silent fallback per Section 3.4 — enhancement failure must never block the user
            toast.warning('AI enhancement unavailable — using your description as-is', {
              duration: 4000,
            })
          }
        }

        // Store the (possibly enhanced) description for use in Step 3
        setDescription(finalDescription)
        setCurrentStep(2)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 9d. Step 2 → Step 3: store config, generate the GCD master prompt
  const handleStep2Next = useCallback(
    async (projectConfig: ProjectConfig): Promise<void> => {
      setIsLoading(true)
      setConfig(projectConfig)

      try {
        const res = await fetch('/api/ai/generate-document-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            config: projectConfig,
            useAI,
          }),
        })

        if (!res.ok) {
          const errorData = (await res.json()) as { error?: string }
          throw new Error(errorData.error ?? 'Failed to generate document prompt')
        }

        const json = (await res.json()) as { data: { prompt: string; enhanced: boolean } }
setGeneratedPrompt(json.data.prompt)
        setCurrentStep(3)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate prompt'
        toast.error(message)
      } finally {
        setIsLoading(false)
      }
    },
    [description, useAI]
  )

  // 9e. Step 2 ← back to Step 1
  const handleStep2Back = useCallback((): void => {
    setCurrentStep(1)
  }, [])

  // 9f. Step 3: import pasted GCD → create project → redirect to workspace
  const handleImport = useCallback(
    async (rawContent: string): Promise<void> => {
      if (!config) {
        toast.error('Project configuration is missing. Please go back and try again.')
        return
      }

      setIsImporting(true)

      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: config.name,
            description,
            platformType: config.platformType,
            visibility: config.visibility,
            techStack: config.techStack,
            additionalNotes: config.additionalNotes,
            rawContent,
          }),
        })

        if (!res.ok) {
          const errorData = (await res.json()) as { error?: string }
          throw new Error(errorData.error ?? 'Failed to create project')
        }

        const data = (await res.json()) as { data?: { id: string }; id?: string }
        // Support both ApiResponse<Project> envelope and bare project
        const projectId = data.data?.id ?? (data as { id?: string }).id

        if (!projectId) {
          throw new Error('Project created but no ID was returned')
        }

        toast.success('Project created! Opening workspace…')
        router.push(`/projects/${projectId}/workspace`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create project'
        toast.error(message)
      } finally {
        setIsImporting(false)
      }
    },
    [config, description, router]
  )

  // 9g. Step 3 ← back to Step 2
  const handleStep3Back = useCallback((): void => {
    setCurrentStep(2)
  }, [])

  // 9h. JSX return
  return (
    <PageContainer>
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">New Project</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Follow the steps below to create your project and generate your Global Context Document.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-10">
        <ProjectCreationStepper currentStep={currentStep} steps={STEPS} />
      </div>

      {/* Step content — AnimatePresence with keyed motion.div for smooth transitions */}
      <div className="max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <DescribeProjectStep
                onNext={handleStep1Next}
                isLoading={isLoading}
              />
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <ConfigureProjectStep
                description={description}
                onNext={handleStep2Next}
                onBack={handleStep2Back}
              />
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <GenerateDocumentStep
                generatedPrompt={generatedPrompt}
                onImport={handleImport}
                isImporting={isImporting}
                onBack={handleStep3Back}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageContainer>
  )
}