/**
 * Shared type definitions for the bookmark processor.
 */

export interface Author {
  username: string
  name: string
  id?: string
}

export interface Bookmark {
  id: string
  text: string
  createdAt: string
  author: Author
  authorId?: string
  replyCount?: number
  retweetCount?: number
  likeCount?: number
  conversationId?: string
  inReplyToId?: string
  quotedTweet?: Bookmark
  media?: Array<{
    type: string
    url: string
  }>
}

export interface LinkInfo {
  url: string
  type: "article" | "youtube" | "twitter" | "image" | "unknown"
  title?: string | null
  content?: string | null
  author?: string | null
  publishedDate?: string | null
  duration?: number | null
  error?: string
}

export interface BookmarkMetadata {
  hasLinks: boolean
  hasMedia: boolean
  isThread: boolean
  isQuote: boolean
  linkTypes: string[]
  estimatedReadTime?: number
}

export interface EnrichedBookmark extends Bookmark {
  enrichedLinks: LinkInfo[]
  threadContent?: string
  quotedContent?: string
  metadata: BookmarkMetadata
  sourceUrl: string
}

export interface ProcessedEntry {
  id: string
  processedAt: string
  author?: string
  destination?: string
  action?: string
  error?: string
  // Store the original bookmark so we don't need to refetch
  bookmark?: Bookmark
}

export interface ProcessedState {
  version: number
  lastRun: string
  processed: Record<string, ProcessedEntry>
}

export interface DestinationResult {
  success: boolean
  message: string
  id?: string
  error?: string
}
