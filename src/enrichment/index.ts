/**
 * Enrichment pipeline for bookmarks.
 *
 * Analyzes bookmark content and fetches additional context:
 * - Article content for linked URLs
 * - YouTube transcripts for video links
 * - Full thread content for tweet replies
 */

import { extractArticle, truncateContent } from "./article"
import { getYouTubeTranscript, isYouTubeUrl, formatDuration } from "./youtube"
import { expandTwitterThread, formatQuotedTweet, isLikelyThread } from "./twitter-thread"
import type { Bookmark, EnrichedBookmark, LinkInfo, BookmarkMetadata } from "../types"
import type { Config } from "../config"

/**
 * Extract URLs from tweet text, handling t.co shortened URLs.
 */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s)]+/g
  const matches = text.match(urlRegex) || []
  // Clean up trailing punctuation, backticks, quotes, and other common artifacts
  return matches.map((url) =>
    url
      .replace(/[.,;:!?`'"]+$/, "")  // Remove trailing punctuation
      .replace(/%60$/, "")            // Remove URL-encoded backtick
      .replace(/%27$/, "")            // Remove URL-encoded single quote
      .replace(/%22$/, "")            // Remove URL-encoded double quote
  )
}

/**
 * Resolve t.co shortened URLs by following redirects.
 */
async function resolveUrl(url: string, timeoutMs: number = 10000): Promise<string> {
  if (!url.includes("t.co/")) {
    return url
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return response.url
  } catch (error) {
    // If redirect fails, return original URL
    return url
  }
}

/**
 * Enrich a single link with content.
 */
async function enrichLink(url: string, config: Config): Promise<LinkInfo> {
  const resolvedUrl = await resolveUrl(url, config.enrichment.timeoutMs)

  // YouTube video
  if (isYouTubeUrl(resolvedUrl) && config.enrichment.fetchYouTube) {
    const transcript = await getYouTubeTranscript(resolvedUrl)
    if (transcript) {
      return {
        url: resolvedUrl,
        type: "youtube",
        title: transcript.title,
        content: truncateContent(transcript.text, config.enrichment.maxContentLength),
        duration: transcript.duration,
      }
    }
    return {
      url: resolvedUrl,
      type: "youtube",
      error: "Transcript unavailable",
    }
  }

  // Twitter/X link (don't try to extract as article)
  if (resolvedUrl.includes("twitter.com/") || resolvedUrl.includes("x.com/")) {
    return {
      url: resolvedUrl,
      type: "twitter",
    }
  }

  // Image links
  if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(resolvedUrl)) {
    return {
      url: resolvedUrl,
      type: "image",
    }
  }

  // Regular article
  if (config.enrichment.fetchArticles) {
    const article = await extractArticle(resolvedUrl, config.enrichment.timeoutMs)
    if (article && article.content) {
      return {
        url: resolvedUrl,
        type: "article",
        title: article.title,
        content: truncateContent(article.content, config.enrichment.maxContentLength),
        author: article.author,
        publishedDate: article.published,
      }
    }
  }

  return {
    url: resolvedUrl,
    type: "unknown",
  }
}

/**
 * Build metadata about the bookmark.
 */
function buildMetadata(bookmark: Bookmark, enrichedLinks: LinkInfo[]): BookmarkMetadata {
  const linkTypes = [...new Set(enrichedLinks.map((l) => l.type))]

  return {
    hasLinks: enrichedLinks.length > 0,
    hasMedia: (bookmark.media?.length ?? 0) > 0,
    isThread: isLikelyThread(bookmark),
    isQuote: !!bookmark.quotedTweet,
    linkTypes,
  }
}

/**
 * Build the source URL for a bookmark.
 */
function buildSourceUrl(bookmark: Bookmark): string {
  return `https://x.com/${bookmark.author.username}/status/${bookmark.id}`
}

/**
 * Enrich a bookmark with full content from linked resources.
 */
export async function enrichBookmark(bookmark: Bookmark, config: Config): Promise<EnrichedBookmark> {
  const urls = extractUrls(bookmark.text)
  const enrichedLinks: LinkInfo[] = []

  // Enrich each link (with concurrency limit)
  for (const url of urls) {
    try {
      const linkInfo = await enrichLink(url, config)
      enrichedLinks.push(linkInfo)
    } catch (error) {
      console.error(`Failed to enrich link ${url}: ${error}`)
      enrichedLinks.push({
        url,
        type: "unknown",
        error: String(error),
      })
    }
  }

  // Expand thread if applicable
  let threadContent: string | undefined
  if (config.enrichment.expandThreads && isLikelyThread(bookmark)) {
    const thread = await expandTwitterThread(bookmark, config.enrichment.timeoutMs)
    if (thread) {
      threadContent = thread.fullText
    }
  }

  // Format quoted tweet
  let quotedContent: string | undefined
  if (bookmark.quotedTweet) {
    quotedContent = formatQuotedTweet(bookmark.quotedTweet)
  }

  const metadata = buildMetadata(bookmark, enrichedLinks)

  return {
    ...bookmark,
    enrichedLinks,
    threadContent,
    quotedContent,
    metadata,
    sourceUrl: buildSourceUrl(bookmark),
  }
}

/**
 * Enrich multiple bookmarks with progress logging.
 */
export async function enrichBookmarks(bookmarks: Bookmark[], config: Config): Promise<EnrichedBookmark[]> {
  const results: EnrichedBookmark[] = []

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i]
    console.log(`Enriching bookmark ${i + 1}/${bookmarks.length}: @${bookmark.author.username}`)

    try {
      const enriched = await enrichBookmark(bookmark, config)
      results.push(enriched)
    } catch (error) {
      console.error(`Failed to enrich bookmark ${bookmark.id}: ${error}`)
      // Still include bookmark with minimal enrichment
      results.push({
        ...bookmark,
        enrichedLinks: [],
        metadata: {
          hasLinks: false,
          hasMedia: false,
          isThread: false,
          isQuote: false,
          linkTypes: [],
        },
        sourceUrl: buildSourceUrl(bookmark),
      })
    }
  }

  return results
}
