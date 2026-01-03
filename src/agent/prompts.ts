/**
 * System and user prompts for the bookmark routing agent.
 */

import type { EnrichedBookmark } from "../types"

export function getSystemPrompt(): string {
  return `You are a bookmark organization assistant. Your job is to analyze Twitter/X bookmarks and route them to the appropriate destination.

You have access to these tools:
- send_to_omnifocus: For actionable items, tasks, todos, reminders, things to try, tools to check out
- send_to_instapaper: For articles, blog posts, long-form content to read later
- send_to_knowledge_base: For reference material, facts, code snippets, techniques, insights worth preserving
- skip_bookmark: For casual content, jokes, memes, personal updates, or content not worth saving

## Guidelines

1. Analyze the tweet content, any linked content, and context carefully
2. Determine the PRIMARY purpose of the bookmark - what did the user likely want to remember?
3. Call exactly ONE tool to process the bookmark
4. If content could go multiple places, use this priority: Task/Tool > Article > Knowledge > Skip

## Routing Heuristics

**OmniFocus (Tasks/Todos):**
- "I should try this" / "Check this out" type content
- Tools, libraries, apps to explore
- Ideas to implement
- Things with a clear action ("read this book", "watch this talk")
- Create clear, actionable titles starting with a verb
- Include the source URL and relevant context in notes

**Instapaper (Read Later):**
- Links to articles, blog posts, essays
- Long-form content that requires focused reading
- News stories, opinion pieces, tutorials
- Use the actual article URL (not the tweet URL)
- Add a brief description of why it's worth reading

**Knowledge Base (Reference):**
- Informative content, facts, statistics
- Code snippets, technical techniques
- Quotes, insights, mental models
- Things you'd want to search for later
- Create a descriptive title and summarize the key information

**Skip:**
- Casual social content, jokes, memes
- Personal updates from friends
- Content that's time-sensitive and now stale
- Things bookmarked by accident
- Provide a brief reason for skipping

## Output Format

Always respond with a tool call. Do not include explanatory text outside of the tool call.`
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
