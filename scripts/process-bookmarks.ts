#!/usr/bin/env bun
/**
 * Main entry point for bookmark processing.
 *
 * Flow:
 * 1. Load configuration
 * 2. Fetch recent bookmarks via bird CLI (or use cached)
 * 3. Filter out already-processed bookmarks
 * 4. Enrich each bookmark with full content
 * 5. Run agent to route each bookmark
 * 6. Update processed state (including bookmark data for reprocessing)
 *
 * Usage:
 *   bun scripts/process-bookmarks.ts [options]
 *
 * Options:
 *   --dry-run         Don't send to destinations, just log what would happen
 *   --count N         Number of bookmarks to fetch (default: 20)
 *   --config PATH     Path to config file (default: ./config.toml)
 *   --reprocess ID    Reprocess a specific bookmark by ID
 *   --reprocess last  Reprocess the most recently processed bookmark
 *   --reprocess -N    Reprocess the Nth most recent (e.g., -1 = most recent, -2 = second most recent)
 *   --list            List recent processed bookmarks and exit
 */

import { parseArgs } from "node:util"
import { loadConfig } from "../src/config"
import { fetchBookmarks, readTweet } from "../src/bookmarks/fetcher"
import { StateManager } from "../src/state/processed"
import { enrichBookmark } from "../src/enrichment"
import { runAgent } from "../src/agent"
import type { Bookmark } from "../src/types"

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "dry-run": { type: "boolean", default: false },
    count: { type: "string" },
    config: { type: "string" },
    reprocess: { type: "string" },
    list: { type: "boolean", default: false },
  },
})

async function processBookmark(
  bookmark: Bookmark,
  config: ReturnType<typeof loadConfig>,
  state: StateManager,
  index: string = ""
): Promise<boolean> {
  const prefix = index ? `${index} ` : ""
  console.log(`\n${prefix}Processing bookmark from @${bookmark.author.username}`)
  console.log(`  ID: ${bookmark.id}`)
  console.log(`  Text: ${bookmark.text.slice(0, 80)}${bookmark.text.length > 80 ? "..." : ""}`)

  try {
    // Enrich bookmark
    console.log(`  Enriching...`)
    const enriched = await enrichBookmark(bookmark, config)

    const enrichmentInfo = []
    if (enriched.enrichedLinks.length) {
      enrichmentInfo.push(`${enriched.enrichedLinks.length} links`)
    }
    if (enriched.threadContent) {
      enrichmentInfo.push("thread")
    }
    if (enriched.quotedContent) {
      enrichmentInfo.push("quote")
    }
    if (enrichmentInfo.length) {
      console.log(`  Enrichment: ${enrichmentInfo.join(", ")}`)
    }

    // Run agent (Agent SDK with MCP)
    console.log(`  Running agent...`)
    const result = await runAgent(enriched, config)

    if (result.success) {
      const toolsStr = result.toolsUsed.length > 0 ? result.toolsUsed.join(", ") : "skipped"
      console.log(`  ✓ Tools used: ${toolsStr}`)
      if (result.result) {
        console.log(`  Result: ${result.result.slice(0, 100)}${result.result.length > 100 ? "..." : ""}`)
      }
      state.markProcessed(bookmark.id, {
        author: bookmark.author.username,
        destination: result.toolsUsed[0] || "skipped",
        action: result.toolsUsed[0] || "skipped",
        bookmark: bookmark, // Store the bookmark for future reprocessing
      })
      return true
    } else {
      console.error(`  ✗ Error: ${result.error}`)
      state.markError(bookmark.id, result.error || "Unknown error", {
        author: bookmark.author.username,
        bookmark: bookmark,
      })
      return false
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`  ✗ Failed: ${message}`)
    state.markError(bookmark.id, message, {
      author: bookmark.author.username,
      bookmark: bookmark,
    })
    return false
  }
}

async function listProcessed(state: StateManager): Promise<void> {
  const entries = state.getRecentEntries(20)
  console.log("=== Recent Processed Bookmarks ===\n")
  console.log("Index | ID                  | Author          | Destination         | Date")
  console.log("------|---------------------|-----------------|---------------------|---------------------")

  entries.forEach((entry, index) => {
    const id = entry.id.padEnd(19)
    const author = (entry.author || "unknown").padEnd(15)
    const dest = (entry.destination || entry.error?.slice(0, 17) || "unknown").padEnd(19)
    const date = new Date(entry.processedAt).toLocaleString()
    console.log(`  -${index + 1} | ${id} | @${author} | ${dest} | ${date}`)
  })

  console.log(`\nTotal: ${state.getProcessedCount()} processed bookmarks`)
  console.log("\nTo reprocess: bun scripts/process-bookmarks.ts --reprocess -1  (for most recent)")
  console.log("              bun scripts/process-bookmarks.ts --reprocess <ID>")
}

async function reprocessBookmark(
  reprocessArg: string,
  config: ReturnType<typeof loadConfig>,
  state: StateManager
): Promise<void> {
  let bookmarkId: string
  let cachedBookmark: Bookmark | undefined

  // Parse the reprocess argument
  if (reprocessArg === "last" || reprocessArg === "-1") {
    const entry = state.getEntryByIndex(0)
    if (!entry) {
      console.error("No processed bookmarks found")
      process.exit(1)
    }
    bookmarkId = entry.id
    cachedBookmark = entry.bookmark
    console.log(`Reprocessing most recent: ${bookmarkId} (@${entry.author})`)
  } else if (reprocessArg.startsWith("-")) {
    // Negative index (e.g., -2 for second most recent)
    const index = Math.abs(parseInt(reprocessArg, 10)) - 1
    const entry = state.getEntryByIndex(index)
    if (!entry) {
      console.error(`No bookmark found at index ${reprocessArg}`)
      process.exit(1)
    }
    bookmarkId = entry.id
    cachedBookmark = entry.bookmark
    console.log(`Reprocessing index ${reprocessArg}: ${bookmarkId} (@${entry.author})`)
  } else {
    // Direct ID
    bookmarkId = reprocessArg
    const entry = state.getEntry(bookmarkId)
    cachedBookmark = entry?.bookmark
    console.log(`Reprocessing ID: ${bookmarkId}`)
  }

  // Remove from processed state so it can be reprocessed
  state.removeEntry(bookmarkId)

  // Get the bookmark (from cache or fetch)
  let bookmark: Bookmark | null = cachedBookmark || null

  if (!bookmark) {
    console.log("  Bookmark not in cache, fetching from Twitter...")
    bookmark = await readTweet(bookmarkId)
    if (!bookmark) {
      console.error(`  Failed to fetch bookmark ${bookmarkId}`)
      process.exit(1)
    }
  } else {
    console.log("  Using cached bookmark data")
  }

  // Process it
  const success = await processBookmark(bookmark, config, state)

  state.save()

  if (success) {
    console.log("\n✓ Reprocessing complete")
  } else {
    console.log("\n✗ Reprocessing failed")
    process.exit(1)
  }
}

async function main() {
  // Load configuration
  const config = loadConfig(values.config)

  // Apply CLI overrides
  if (values["dry-run"]) {
    config.dryRun = true
  }
  if (values.count) {
    config.bookmarkCount = parseInt(values.count, 10)
  }

  // Initialize state manager
  const state = new StateManager(config.statePath)

  // Handle --list command
  if (values.list) {
    await listProcessed(state)
    return
  }

  // Build list of enabled destinations
  const enabledDestinations: string[] = []
  if (config.omnifocus.enabled) enabledDestinations.push("OmniFocus")
  if (config.instapaper.enabled) enabledDestinations.push("Instapaper")
  if (config.obsidian.enabled) enabledDestinations.push("Obsidian")

  // Handle --reprocess command
  if (values.reprocess) {
    console.log("=== Bookmark Reprocessor ===\n")
    console.log(`Mode: ${config.dryRun ? "DRY RUN" : "LIVE"}`)
    console.log(`MCP Servers: ${Object.keys(config.mcpServers).join(", ")}`)
    console.log("")
    await reprocessBookmark(values.reprocess, config, state)
    return
  }

  // Normal processing flow
  console.log("=== Bookmark Processor (Agent SDK) ===\n")
  console.log(`Mode: ${config.dryRun ? "DRY RUN" : "LIVE"}`)
  console.log(`Bookmark count: ${config.bookmarkCount}`)
  console.log(`MCP Servers: ${Object.keys(config.mcpServers).join(", ")}`)
  console.log("")

  console.log(`State file: ${config.statePath}`)
  console.log(`Previously processed: ${state.getProcessedCount()} bookmarks`)
  console.log(`Last run: ${state.getLastRun()}`)
  console.log("")

  // Prune old entries (older than 30 days)
  const pruned = state.prune()
  if (pruned > 0) {
    console.log(`Pruned ${pruned} old entries from state`)
  }

  console.log(`Enabled destinations: ${enabledDestinations.join(", ") || "none"}`)
  console.log("")

  // Fetch bookmarks
  console.log(`Fetching ${config.bookmarkCount} bookmarks...`)
  let bookmarks
  try {
    bookmarks = await fetchBookmarks({ count: config.bookmarkCount })
    console.log(`Fetched ${bookmarks.length} bookmarks`)
  } catch (error) {
    console.error(`Failed to fetch bookmarks: ${error}`)
    console.error("Make sure AUTH_TOKEN and CT0 environment variables are set")
    process.exit(1)
  }

  // Filter out already-processed bookmarks
  const processedIds = state.getProcessedIds()
  const unprocessed = bookmarks.filter((b) => !processedIds.has(b.id))
  console.log(`New bookmarks to process: ${unprocessed.length}`)
  console.log("")

  if (unprocessed.length === 0) {
    console.log("No new bookmarks to process. Exiting.")
    state.save()
    return
  }

  // Process each bookmark
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < unprocessed.length; i++) {
    const bookmark = unprocessed[i]
    const progress = `[${i + 1}/${unprocessed.length}]`

    const success = await processBookmark(bookmark, config, state, progress)
    if (success) {
      successCount++
    } else {
      errorCount++
    }
  }

  // Save state
  state.save()

  // Summary
  console.log("\n=== Summary ===")
  console.log(`Processed: ${unprocessed.length} bookmarks`)
  console.log(`Success: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`Total in state: ${state.getProcessedCount()}`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
