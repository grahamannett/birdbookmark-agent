/**
 * Configuration management.
 * Loads from config.json with environment variable overrides.
 */

import { existsSync, readFileSync } from "fs"
import { join } from "path"

export interface Config {
  // Agent settings
  model: string
  maxTokens: number

  // AWS Bedrock settings
  aws?: {
    accessKeyId?: string
    secretAccessKey?: string
    region?: string
  }

  // Bookmark fetching
  bookmarkCount: number

  // State management
  statePath: string

  // Destination configs
  omnifocus?: {
    enabled: boolean
    defaultProject?: string
    defaultTags?: string[]
  }

  instapaper?: {
    enabled: boolean
    username?: string
    password?: string
  }

  knowledgeBase?: {
    enabled: boolean
    path: string
    format: "markdown" | "json"
  }

  // Processing options
  enrichment: {
    fetchArticles: boolean
    fetchYouTube: boolean
    expandThreads: boolean
    maxContentLength: number
    timeoutMs: number
  }

  // Dry run mode
  dryRun: boolean
}

const DEFAULT_CONFIG: Config = {
  // Bedrock model ID format
  model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
  maxTokens: 1024,
  bookmarkCount: 20,
  statePath: "./data/processed.json",
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
  const resolvedPath = configPath ?? join(process.cwd(), "config.json")

  let fileConfig: Partial<Config> = {}
  if (existsSync(resolvedPath)) {
    try {
      const content = readFileSync(resolvedPath, "utf-8")
      fileConfig = JSON.parse(content)
    } catch (error) {
      console.error(`Failed to parse config file: ${error}`)
    }
  }

  // Environment variable overrides
  const envOverrides: Partial<Config> = {}

  if (process.env.ANTHROPIC_MODEL) {
    envOverrides.model = process.env.ANTHROPIC_MODEL
  }

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
    enrichment: {
      ...DEFAULT_CONFIG.enrichment,
      ...fileConfig.enrichment,
    },
  }

  return config
}
