/**
 * Twitter thread expansion using bird CLI.
 */

import { getThread } from "../bookmarks/fetcher"
import type { Bookmark } from "../types"

export interface ThreadContent {
  tweets: Bookmark[]
  fullText: string
  tweetCount: number
}

/**
 * Expand a Twitter thread by fetching all tweets in the conversation.
 */
export async function expandTwitterThread(
  bookmark: Bookmark,
  timeoutMs: number = 30000
): Promise<ThreadContent | null> {
  try {
    const thread = await getThread(bookmark.id, timeoutMs)

    if (!thread || thread.length <= 1) {
      return null
    }

    // Format thread as readable text
    const fullText = thread
      .map((tweet, index) => {
        const author = `@${tweet.author.username}`
        return `[${index + 1}/${thread.length}] ${author}: ${tweet.text}`
      })
      .join("\n\n")

    return {
      tweets: thread,
      fullText,
      tweetCount: thread.length,
    }
  } catch (error) {
    console.error(`Failed to expand thread for ${bookmark.id}: ${error}`)
    return null
  }
}

/**
 * Format a quoted tweet for display.
 */
export function formatQuotedTweet(quoted: Bookmark): string {
  const author = `@${quoted.author.username}`
  const date = quoted.createdAt
  return `Quoted: ${author} (${date}):\n${quoted.text}`
}

/**
 * Check if a bookmark is likely part of a thread.
 */
export function isLikelyThread(bookmark: Bookmark): boolean {
  // If it's a reply to something, it might be part of a thread
  if (bookmark.inReplyToId) return true

  // If the conversation ID differs from the tweet ID, it's part of a conversation
  if (bookmark.conversationId && bookmark.conversationId !== bookmark.id) return true

  // Check for thread indicators in text
  const threadPatterns = [/\d+\/\d+/, /thread:/i, /🧵/, /a thread/i]
  return threadPatterns.some((pattern) => pattern.test(bookmark.text))
}
