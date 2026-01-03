/**
 * Agent orchestrator using Anthropic SDK with AWS Bedrock.
 *
 * Runs the agent to analyze and route each enriched bookmark.
 */

import AnthropicBedrock from "@anthropic-ai/bedrock-sdk"
import { getToolDefinitions, parseToolInput } from "./tools"
import { getSystemPrompt, getUserPrompt } from "./prompts"
import type { EnrichedBookmark, DestinationResult } from "../types"
import type { Config } from "../config"
import type { DestinationRegistry } from "../destinations"

export interface AgentResult {
  success: boolean
  toolUsed: string | null
  toolInput: unknown
  destinationResult: DestinationResult | null
  error?: string
}

/**
 * Create the Anthropic Bedrock client with AWS credentials.
 */
function createClient(config: Config): AnthropicBedrock {
  return new AnthropicBedrock({
    awsAccessKey: config.aws?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: config.aws?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
    awsRegion: config.aws?.region || process.env.AWS_REGION || "us-east-1",
  })
}

/**
 * Run the agent to process a single bookmark.
 */
export async function runAgent(
  bookmark: EnrichedBookmark,
  config: Config,
  destinations: DestinationRegistry
): Promise<AgentResult> {
  const client = createClient(config)

  const systemPrompt = getSystemPrompt()
  const userPrompt = getUserPrompt(bookmark)
  const tools = getToolDefinitions()

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: tools as any,
    })

    // Find tool use in response
    const toolUseBlock = response.content.find((block) => block.type === "tool_use")

    if (!toolUseBlock || toolUseBlock.type !== "tool_use") {
      // Agent didn't use a tool - might have responded with text
      const textBlock = response.content.find((block) => block.type === "text")
      const text = textBlock?.type === "text" ? textBlock.text : "No response"

      return {
        success: false,
        toolUsed: null,
        toolInput: null,
        destinationResult: null,
        error: `Agent did not use a tool. Response: ${text}`,
      }
    }

    const toolName = toolUseBlock.name
    const toolInput = toolUseBlock.input

    // Validate tool input
    const parsed = parseToolInput(toolName, toolInput)
    if (!parsed.valid) {
      return {
        success: false,
        toolUsed: toolName,
        toolInput,
        destinationResult: null,
        error: `Invalid tool input: ${parsed.error}`,
      }
    }

    // Execute destination action
    let destinationResult: DestinationResult

    if (config.dryRun) {
      console.log(`[DRY RUN] Would call ${toolName} with:`, JSON.stringify(toolInput, null, 2))
      destinationResult = {
        success: true,
        message: `[DRY RUN] Would send to ${toolName}`,
      }
    } else {
      destinationResult = await executeDestination(toolName, parsed.data, destinations)
    }

    return {
      success: destinationResult.success,
      toolUsed: toolName,
      toolInput: parsed.data,
      destinationResult,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      toolUsed: null,
      toolInput: null,
      destinationResult: null,
      error: `Agent error: ${message}`,
    }
  }
}

/**
 * Execute the destination action based on tool name.
 */
async function executeDestination(
  toolName: string,
  input: unknown,
  destinations: DestinationRegistry
): Promise<DestinationResult> {
  switch (toolName) {
    case "send_to_omnifocus":
      return destinations.getDestination("omnifocus").send(input)

    case "send_to_instapaper":
      return destinations.getDestination("instapaper").send(input)

    case "send_to_knowledge_base":
      return destinations.getDestination("knowledge-base").send(input)

    case "skip_bookmark":
      const skipInput = input as { reason: string }
      console.log(`Skipping bookmark: ${skipInput.reason}`)
      return {
        success: true,
        message: `Skipped: ${skipInput.reason}`,
      }

    default:
      return {
        success: false,
        message: `Unknown tool: ${toolName}`,
      }
  }
}
