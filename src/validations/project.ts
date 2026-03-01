// src/validations/project.ts

// 1. External imports
import { z } from 'zod'

// 2. createProjectSchema
export const createProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be 100 characters or less'),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  platformType: z.enum(['web_app', 'mobile_app', 'desktop_app', 'api_backend', 'game', 'other']),
  visibility: z.enum(['public', 'private']),
  techStack: z.array(z.string()).optional().default([]),
  additionalNotes: z.string().optional(),
})

// 3. updateProjectSchema
export const updateProjectSchema = createProjectSchema
  .partial()
  .extend({
    status: z.enum(['IN_PROGRESS', 'COMPLETE', 'PAUSED', 'ARCHIVED']).optional(),
  })

// 4. importDocumentSchema
export const importDocumentSchema = z.object({
  rawContent: z.string().min(100, 'Document must be at least 100 characters'),
})

// 5. fileStatusUpdateSchema
export const fileStatusUpdateSchema = z.object({
  status: z.enum(['EMPTY', 'CODE_PASTED', 'COMPLETE', 'ERROR']),
  notes: z.string().optional(),
  filePrompt: z.string().optional(),
  requiredFiles: z.array(z.string()).optional(),
})

// 6. Inferred types
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type ImportDocumentInput = z.infer<typeof importDocumentSchema>
export type FileStatusUpdateInput = z.infer<typeof fileStatusUpdateSchema>