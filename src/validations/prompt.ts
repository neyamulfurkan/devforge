import { z } from 'zod'
import { PromptVisibility } from '@prisma/client'

// ======================== LIBRARY PROMPT ========================

export const createLibraryPromptSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title must be 100 characters or fewer'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(300, 'Description must be 300 characters or fewer'),
  promptText: z.string().min(20, 'Prompt text must be at least 20 characters'),
  aiTool: z.string().min(1, 'AI tool is required'),
  category: z.string().min(1, 'Category is required'),
  makePublic: z.boolean().default(true),
})

export type CreateLibraryPromptInput = z.infer<typeof createLibraryPromptSchema>

// ======================== COLLECTION PROMPT ========================

export const createCollectionPromptSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100, 'Title must be 100 characters or fewer'),
  promptText: z.string().min(1, 'Prompt text is required'),
  aiTool: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  visibility: z.nativeEnum(PromptVisibility).default(PromptVisibility.PRIVATE),
})

export type CreateCollectionPromptInput = z.infer<typeof createCollectionPromptSchema>

export const updateCollectionPromptSchema = createCollectionPromptSchema.partial()

export type UpdateCollectionPromptInput = z.infer<typeof updateCollectionPromptSchema>