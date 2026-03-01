import { z } from 'zod'

export const addErrorSessionSchema = z.object({
  errorType: z.enum(['TYPESCRIPT', 'BUILD', 'RUNTIME', 'CONSOLE', 'OTHER']),
  errorOutput: z.string().min(10, 'Error output must be at least 10 characters'),
})

export const resolveErrorSessionSchema = z.object({
  resolutionNote: z.string().optional(),
})

export const updateIdentifiedFilesSchema = z.object({
  identifiedFiles: z.array(z.string()).min(1, 'At least one file must be identified'),
})

export type AddErrorSessionInput = z.infer<typeof addErrorSessionSchema>
export type ResolveErrorSessionInput = z.infer<typeof resolveErrorSessionSchema>
export type UpdateIdentifiedFilesInput = z.infer<typeof updateIdentifiedFilesSchema>