/**
 * System and user prompts for the bookmark routing agent.
 * Updated for Agent SDK with MCP tools.
 */

import type { EnrichedBookmark } from "../types"
import type { Config } from "../config"

export function getSystemPrompt(config: Config): string {
  const tools: string[] = []

  if (config.omnifocus.enabled) {
    tools.push(`- mcp__omnifocus__add_omnifocus_task: Create a task in OmniFocus
    - Use for actionable items, tasks, todos, reminders, things to try, tools to check out
    - Parameters: name (required), note, projectName, tags, dueDate, flagged`)
  }

  if (config.instapaper.enabled) {
    tools.push(`- mcp__instapaper__save_article: Save an article to Instapaper
    - Use for articles, blog posts, long-form content to read later
    - Parameters: url (required), title, description`)
  }

  if (config.obsidian.enabled) {
    tools.push(`- mcp__obsidian__create_note: Create a note in Obsidian
    - Use for reference material, facts, code snippets, techniques, insights worth preserving
    - Parameters: title (required), content, folder, tags`)
  }

  const toolList = tools.length > 0 ? tools.join("\n") : "No destination tools configured"

  return `You are a bookmark organization assistant. Your job is to analyze Twitter/X bookmarks and route them to the appropriate destination using MCP tools.

## Available Tools

${toolList}

## Guidelines

1. Analyze the tweet content, any linked content, and context carefully
2. Determine the PRIMARY purpose of the bookmark - what did the user likely want to remember?
3. Call exactly ONE tool to process the bookmark
4. If content could go multiple places, use this priority: Task/Tool > Article > Knowledge > Skip
5. If no tool is appropriate (casual content, jokes, memes), respond with a brief explanation of why you're skipping it

## Routing Heuristics

**OmniFocus (Tasks/Todos):**
- "I should try this" / "Check this out" type content
- Tools, libraries, apps, repos to explore
- Ideas to implement
- Things with a clear action ("read this book", "watch this talk")
- Create clear, actionable titles starting with a verb
- Include the source URL in the note field

**Instapaper (Read Later):**
- Links to articles, blog posts, essays
- Long-form content that requires focused reading
- News stories, opinion pieces, tutorials
- Use the actual article URL (not the tweet URL)

**Obsidian (Knowledge Base):**
- Informative content, facts, statistics
- Code snippets, technical techniques
- Quotes, insights, mental models
- Things you'd want to search for later
- Create a descriptive title and include the key information

**Skip (No Tool Call):**
- Casual social content, jokes, memes
- Personal updates from friends
- Content that's time-sensitive and now stale
- Things bookmarked by accident
- Just respond with a brief explanation

## Important

When creating OmniFocus tasks:
- The "name" field is the task title - make it actionable (e.g., "Try Claude Agent SDK for automation")
- Put the tweet URL and any relevant context in the "note" field
- Use appropriate tags like "tool", "article", "idea", "learn"`
}

export function getUserPrompt(bookmark: EnrichedBookmark): string {
  const parts: string[] = []

  // Main tweet
  parts.push(`## Tweet`)
  parts.push(`**Author:** @${bookmark.author.username} (${bookmark.author.name})`)
  parts.push(`**Date:** ${bookmark.createdAt}`)
  parts.push(`**URL:** ${bookmark.sourceUrl}`)
  parts.push(`**Content:**`)
  parts.push(bookmark.text)

  // Engagement stats if available
  if (bookmark.likeCount || bookmark.retweetCount || bookmark.replyCount) {
    const stats = []
    if (bookmark.likeCount) stats.push(`${bookmark.likeCount} likes`)
    if (bookmark.retweetCount) stats.push(`${bookmark.retweetCount} retweets`)
    if (bookmark.replyCount) stats.push(`${bookmark.replyCount} replies`)
    parts.push(`**Engagement:** ${stats.join(", ")}`)
  }

  // Quoted tweet
  if (bookmark.quotedContent) {
    parts.push(`\n## Quoted Tweet`)
    parts.push(bookmark.quotedContent)
  }

  // Thread context
  if (bookmark.threadContent) {
    parts.push(`\n## Thread Context`)
    parts.push(bookmark.threadContent)
  }

  // Linked content
  if (bookmark.enrichedLinks?.length) {
    parts.push(`\n## Linked Content`)

    for (const link of bookmark.enrichedLinks) {
      parts.push(`\n### ${link.type.toUpperCase()}: ${link.url}`)

      if (link.error) {
        parts.push(`*Error: ${link.error}*`)
        continue
      }

      if (link.title) {
        parts.push(`**Title:** ${link.title}`)
      }
      if (link.author) {
        parts.push(`**Author:** ${link.author}`)
      }
      if (link.duration) {
        const mins = Math.floor(link.duration / 60)
        parts.push(`**Duration:** ${mins} minutes`)
      }
      if (link.content) {
        // Truncate very long content for the prompt
        const truncated = link.content.slice(0, 3000)
        const suffix = link.content.length > 3000 ? "\n[Content truncated...]" : ""
        parts.push(`**Content:**\n${truncated}${suffix}`)
      }
    }
  }

  // Metadata summary
  parts.push(`\n## Metadata`)
  const flags = []
  if (bookmark.metadata.hasLinks) flags.push(`${bookmark.enrichedLinks.length} link(s)`)
  if (bookmark.metadata.hasMedia) flags.push("has media")
  if (bookmark.metadata.isThread) flags.push("part of thread")
  if (bookmark.metadata.isQuote) flags.push("quote tweet")
  parts.push(flags.length ? flags.join(", ") : "Simple tweet")

  parts.push(`\n---`)
  parts.push(`Analyze this bookmark and route it to the appropriate destination using one of the available tools.`)

  return parts.join("\n")
}
