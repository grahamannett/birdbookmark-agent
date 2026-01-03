/**
 * Agent orchestrator using Claude Agent SDK with MCP servers.
 *
 * Runs the agent to analyze and route each enriched bookmark.
 * Uses OmniFocus MCP and other MCP servers for destinations.
 */

import { query } from "@anthropic-ai/claude-agent-sdk"
import { getSystemPrompt, getUserPrompt } from "./prompts"
import type { EnrichedBookmark } from "../types"
import type { Config } from "../config"

export interface AgentResult {
  success: boolean
  toolsUsed: string[]
  result: string
  error?: string
}

/**
 * Run the agent to process a single bookmark.
 *
 * The agent will analyze the bookmark and use MCP tools to route it
 * to the appropriate destination (OmniFocus, Instapaper, Obsidian, etc.)
 */
export async function runAgent(
  bookmark: EnrichedBookmark,
  config: Config
): Promise<AgentResult> {
  const systemPrompt = getSystemPrompt(config)
  const userPrompt = getUserPrompt(bookmark)

  const toolsUsed: string[] = []
  let finalResult = ""
  let success = false
  let errorMessage: string | undefined

  try {
    // Build allowed tools list based on enabled destinations
    const allowedTools: string[] = []

    // Add MCP tools for enabled destinations
    if (config.omnifocus.enabled) {
      allowedTools.push("mcp__omnifocus__add_omnifocus_task")
      allowedTools.push("mcp__omnifocus__query_omnifocus")
    }

    // Note: Instapaper and Obsidian MCP tools would be added here when configured
    // For now, we'll start with OmniFocus only

    // Log what we're doing
    console.log(`    Agent: Using MCP servers: ${Object.keys(config.mcpServers).join(", ")}`)
    console.log(`    Agent: Allowed tools: ${allowedTools.join(", ")}`)

    // Run the agent with MCP servers
    for await (const message of query({
      prompt: userPrompt,
      options: {
        systemPrompt,
        mcpServers: config.mcpServers,
        allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
        // In dry-run mode, we still want to see what the agent would do
        // but we might want to use a permission callback to block actual execution
        permissionMode: config.dryRun ? "default" : "bypassPermissions",
      },
    })) {
      // Track tool usage
      if (message.type === "assistant" && "message" in message && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            toolsUsed.push(block.name)
            console.log(`    Agent: Using tool: ${block.name}`)
          }
        }
      }

      // Track text responses
      if (message.type === "assistant" && "message" in message && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "text") {
            console.log(`    Agent: ${block.text.slice(0, 100)}${block.text.length > 100 ? "..." : ""}`)
          }
        }
      }

      // Capture final result
      if (message.type === "result") {
        if (message.subtype === "success") {
          finalResult = typeof message.result === "string" ? message.result : JSON.stringify(message.result)
          success = true
        } else if (message.subtype.startsWith("error")) {
          // Error subtypes: error_during_execution, error_max_turns, error_max_budget_usd, etc.
          errorMessage = message.subtype
        }
      }
    }

    // If no tools were used but we got a result, the agent may have decided to skip
    if (toolsUsed.length === 0 && success) {
      toolsUsed.push("skip_bookmark")
    }

    return {
      success,
      toolsUsed,
      result: finalResult,
      error: errorMessage,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      toolsUsed,
      result: "",
      error: `Agent error: ${message}`,
    }
  }
}
