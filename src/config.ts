/**
 * Configuration management.
 * Loads from config.toml with environment variable overrides.
 *
 * Agent SDK authentication is handled via environment variables:
 * - ANTHROPIC_API_KEY for direct API
 * - CLAUDE_CODE_USE_BEDROCK=1 + AWS credentials for Bedrock
 */

import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { parse as parseToml } from "smol-toml"

/**
 * MCP server configuration for Agent SDK.
 */
export interface McpServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface Config {
  // Bookmark fetching
  bookmarkCount: number

  // State management
  statePath: string

  // MCP server configurations (passed to Agent SDK)
  mcpServers: Record<string, McpServerConfig>

  // Destination enabled flags
  omnifocus: {
    enabled: boolean
    defaultProject?: string
    defaultTags?: string[]
  }

  instapaper: {
    enabled: boolean
  }

  obsidian: {
    enabled: boolean
    vaultPath?: string
  }

  // Processing options
  enrichment: {
    fetchArticles: boolean
    fetchYouTube: boolean
    expandThreads: boolean
    maxContentLength: number
    timeoutMs: number
  }

  // Dry run mode (agent will analyze but not execute tools)
  dryRun: boolean
}

const DEFAULT_CONFIG: Config = {
  bookmarkCount: 20,
  statePath: "./data/processed.json",
  mcpServers: {
    omnifocus: {
      command: "npx",
      args: ["-y", "omnifocus-mcp"],
    },
  },
  omnifocus: {
    enabled: true,
  },
  instapaper: {
    enabled: false,
  },
  obsidian: {
    enabled: false,
  },
  enrichment: {
    fetchArticles: true,
    fetchYouTube: true,
    expandThreads: true,
    maxContentLength: 50000,
    timeoutMs: 30000,
  },
  dryRun: false,
}

export function loadConfig(configPath?: string): Config {
  const resolvedPath = configPath ?? join(process.cwd(), "config.toml")

  let fileConfig: Partial<Config> = {}
  if (existsSync(resolvedPath)) {
    try {
      const content = readFileSync(resolvedPath, "utf-8")
      fileConfig = parseToml(content) as Partial<Config>
    } catch (error) {
      console.error(`Failed to parse config file: ${error}`)
    }
  }

  // Environment variable overrides
  const envOverrides: Partial<Config> = {}

  if (process.env.BOOKMARK_COUNT) {
    envOverrides.bookmarkCount = parseInt(process.env.BOOKMARK_COUNT, 10)
  }

  if (process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1") {
    envOverrides.dryRun = true
  }

  if (process.env.STATE_PATH) {
    envOverrides.statePath = process.env.STATE_PATH
  }

  // Merge configs: defaults < file < env
  const config: Config = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envOverrides,
    mcpServers: {
      ...DEFAULT_CONFIG.mcpServers,
      ...fileConfig.mcpServers,
    },
    omnifocus: {
      ...DEFAULT_CONFIG.omnifocus,
      ...fileConfig.omnifocus,
    },
    instapaper: {
      ...DEFAULT_CONFIG.instapaper,
      ...fileConfig.instapaper,
    },
    obsidian: {
      ...DEFAULT_CONFIG.obsidian,
      ...fileConfig.obsidian,
    },
    enrichment: {
      ...DEFAULT_CONFIG.enrichment,
      ...fileConfig.enrichment,
    },
  }

  // Add Obsidian MCP server if enabled and vault path is set
  if (config.obsidian.enabled && config.obsidian.vaultPath) {
    config.mcpServers.obsidian = {
      command: "npx",
      args: ["-y", "obsidian-mcp-server"],
      env: {
        OBSIDIAN_VAULT_PATH: config.obsidian.vaultPath,
      },
    }
  }

  return config
}
