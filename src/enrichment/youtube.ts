/**
 * YouTube transcript extraction.
 */

import { YoutubeTranscript } from "youtube-transcript"

export interface YouTubeContent {
  videoId: string
  title: string | null
  text: string
  duration: number | null
}

/**
 * Extract video ID from various YouTube URL formats.
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtube\.com\/v\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

/**
 * Check if a URL is a YouTube video.
 */
export function isYouTubeUrl(url: string): boolean {
  return (
    url.includes("youtube.com/watch") ||
    url.includes("youtu.be/") ||
    url.includes("youtube.com/embed") ||
    url.includes("youtube.com/shorts")
  )
}

/**
 * Fetch transcript for a YouTube video.
 * Returns null if transcript is unavailable.
 */
export async function getYouTubeTranscript(url: string): Promise<YouTubeContent | null> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    console.error(`Could not extract video ID from: ${url}`)
    return null
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)

    if (!transcript || transcript.length === 0) {
      return null
    }

    // Combine transcript segments into full text
    const fullText = transcript.map((segment) => segment.text).join(" ")

    // Calculate approximate duration from last segment
    const lastSegment = transcript[transcript.length - 1]
    const duration = lastSegment ? Math.round((lastSegment.offset + lastSegment.duration) / 1000) : null

    return {
      videoId,
      title: null, // Would need YouTube Data API for title
      text: fullText,
      duration,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Transcripts aren't always available, so don't treat as error
    if (!message.includes("Transcript is disabled") && !message.includes("No transcript")) {
      console.error(`Failed to get YouTube transcript for ${url}: ${message}`)
    }
    return null
  }
}

/**
 * Format duration in seconds to human-readable string.
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}
