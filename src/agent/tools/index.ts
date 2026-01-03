/**
 * Tool definitions for bookmark routing destinations.
 * Uses Zod schemas for input validation.
 */

import { z } from "zod"
import type { Config } from "../../config"
import type { DestinationRegistry } from "../../destinations"

// Tool input schemas
export const sendToOmniFocusSchema = z.object({
  title: z.string().describe("Task title - should be actionable and start with a verb"),
  note: z.string().optional().describe("Additional notes, context, or details"),
  project: z.string().optional().describe("OmniFocus project name"),
  tags: z.array(z.string()).optional().describe("Tags to apply (e.g., 'tool', 'article', 'idea')"),
  dueDate: z.string().optional().describe("Due date in ISO format if time-sensitive"),
  sourceUrl: z.string().describe("Original tweet URL for reference"),
})

export const sendToInstapaperSchema = z.object({
  url: z.string().describe("URL of the article to save (the actual article, not the tweet)"),
  title: z.string().optional().describe("Article title"),
  description: z.string().optional().describe("Brief description of why this is worth reading"),
  folder: z.string().optional().describe("Instapaper folder name"),
})

export const sendToKnowledgeBaseSchema = z.object({
  title: z.string().describe("Descriptive title for the knowledge entry"),
  content: z.string().describe("Main content - summary, key points, or full content"),
  category: z.string().describe("Category or topic area (e.g., 'programming', 'design', 'productivity')"),
  tags: z.array(z.string()).optional().describe("Tags for organization and searchability"),
  sourceUrl: z.string().describe("Original tweet URL"),
  sourceAuthor: z.string().optional().describe("Tweet author username"),
})

export const skipBookmarkSchema = z.object({
  reason: z.string().describe("Brief reason for skipping this bookmark"),
})

// Tool type definitions for Anthropic API
export type OmniFocusInput = z.infer<typeof sendToOmniFocusSchema>
export type InstapaperInput = z.infer<typeof sendToInstapaperSchema>
export type KnowledgeBaseInput = z.infer<typeof sendToKnowledgeBaseSchema>
export type SkipInput = z.infer<typeof skipBookmarkSchema>

export type ToolInput = OmniFocusInput | InstapaperInput | KnowledgeBaseInput | SkipInput

export interface ToolDefinition {
  name: string
  description: string
  input_schema: object
}

/**
 * Convert Zod schema to JSON Schema format for Anthropic API.
 */
function zodToJsonSchema(schema: z.ZodObject<any>): object {
  const shape = schema.shape
  const properties: Record<string, any> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as z.ZodTypeAny
    const description = zodType._def.description

    // Handle optional wrapper
    let innerType = zodType
    let isOptional = false
    if (zodType instanceof z.ZodOptional) {
      innerType = zodType.unwrap()
      isOptional = true
    }

    // Determine JSON Schema type
    let jsonType: any = { type: "string" }

    if (innerType instanceof z.ZodString) {
      jsonType = { type: "string" }
    } else if (innerType instanceof z.ZodArray) {
      jsonType = {
        type: "array",
        items: { type: "string" },
      }
    }

    if (description) {
      jsonType.description = description
    }

    properties[key] = jsonType

    if (!isOptional) {
      required.push(key)
    }
  }

  return {
    type: "object",
    properties,
    required,
  }
}

/**
 * Get all tool definitions for the Anthropic API.
 */
export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: "send_to_omnifocus",
      description:
        "Send a task or todo item to OmniFocus. Use for actionable items, things to try, tools to check out, reminders, or tasks mentioned in the tweet.",
      input_schema: zodToJsonSchema(sendToOmniFocusSchema),
    },
    {
      name: "send_to_instapaper",
      description:
        "Save an article to Instapaper for later reading. Use for links to articles, blog posts, essays, or long-form content worth reading later.",
      input_schema: zodToJsonSchema(sendToInstapaperSchema),
    },
    {
      name: "send_to_knowledge_base",
      description:
        "Save to knowledge base as reference material. Use for informative content, facts, code snippets, techniques, insights, or reference information worth preserving and searching later.",
      input_schema: zodToJsonSchema(sendToKnowledgeBaseSchema),
    },
    {
      name: "skip_bookmark",
      description:
        "Skip this bookmark without saving anywhere. Use for casual content, jokes, memes, personal updates, time-sensitive content that's now stale, or content that doesn't warrant saving.",
      input_schema: zodToJsonSchema(skipBookmarkSchema),
    },
  ]
}

/**
 * Validate and parse tool input based on tool name.
 */
export function parseToolInput(
  toolName: string,
  input: unknown
): { valid: true; data: ToolInput } | { valid: false; error: string } {
  try {
    switch (toolName) {
      case "send_to_omnifocus":
        return { valid: true, data: sendToOmniFocusSchema.parse(input) }
      case "send_to_instapaper":
        return { valid: true, data: sendToInstapaperSchema.parse(input) }
      case "send_to_knowledge_base":
        return { valid: true, data: sendToKnowledgeBaseSchema.parse(input) }
      case "skip_bookmark":
        return { valid: true, data: skipBookmarkSchema.parse(input) }
      default:
        return { valid: false, error: `Unknown tool: ${toolName}` }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors.map((e) => e.message).join(", ") }
    }
    return { valid: false, error: String(error) }
  }
}
