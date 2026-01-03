/**
 * Article content extraction.
 * Uses @extractus/article-extractor for parsing web pages.
 */

import { extract } from "@extractus/article-extractor"

export interface ArticleContent {
  title: string | null
  content: string | null
  author: string | null
  published: string | null
  description: string | null
  url: string
}

/**
 * Extract article content from a URL.
 * Returns null if extraction fails or URL is not an article.
 */
export async function extractArticle(
  url: string,
  timeoutMs: number = 30000
): Promise<ArticleContent | null> {
  try {
    // Race the extraction against a timeout
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeoutMs)
    )

    const article = await Promise.race([extract(url), timeoutPromise])

    if (!article) return null

    return {
      title: article.title || null,
      content: article.content || null,
      author: article.author || null,
      published: article.published || null,
      description: article.description || null,
      url: article.url || url,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Don't log timeout/abort errors as they're expected for some URLs
    if (!message.includes("abort")) {
      console.error(`Failed to extract article from ${url}: ${message}`)
    }
    return null
  }
}

/**
 * Truncate article content to a maximum length.
 * Tries to break at sentence boundaries.
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content

  // Try to break at a sentence boundary
  const truncated = content.slice(0, maxLength)
  const lastPeriod = truncated.lastIndexOf(". ")
  const lastNewline = truncated.lastIndexOf("\n")
  const breakPoint = Math.max(lastPeriod, lastNewline)

  if (breakPoint > maxLength * 0.7) {
    return truncated.slice(0, breakPoint + 1) + "..."
  }

  return truncated + "..."
}
