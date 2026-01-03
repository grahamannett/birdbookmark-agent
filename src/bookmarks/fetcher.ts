/**
 * Fetch bookmarks via bird CLI.
 */

import { spawn } from "child_process"
import type { Bookmark } from "../types"

export interface FetchOptions {
  count?: number
  timeoutMs?: number
}

/**
 * Fetch bookmarks from Twitter/X using bird CLI.
 * Requires AUTH_TOKEN and CT0 environment variables to be set.
 */
export async function fetchBookmarks(options: FetchOptions = {}): Promise<Bookmark[]> {
  const { count = 20, timeoutMs = 60000 } = options

  return new Promise((resolve, reject) => {
    const args = ["bookmarks", "-n", String(count), "--json"]
    const bird = spawn("bird", args, {
      env: process.env,
      timeout: timeoutMs,
    })

    let stdout = ""
    let stderr = ""

    bird.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    bird.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    bird.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`bird exited with code ${code}: ${stderr}`))
        return
      }

      try {
        const bookmarks = JSON.parse(stdout) as Bookmark[]
        resolve(bookmarks)
      } catch (error) {
        reject(new Error(`Failed to parse bird output: ${error}`))
      }
    })

    bird.on("error", (error) => {
      reject(new Error(`Failed to spawn bird: ${error.message}`))
    })
  })
}

/**
 * Read a specific tweet by ID or URL.
 */
export async function readTweet(idOrUrl: string, timeoutMs: number = 30000): Promise<Bookmark | null> {
  return new Promise((resolve, reject) => {
    const args = ["read", idOrUrl, "--json"]
    const bird = spawn("bird", args, {
      env: process.env,
      timeout: timeoutMs,
    })

    let stdout = ""
    let stderr = ""

    bird.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    bird.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    bird.on("close", (code) => {
      if (code !== 0) {
        console.error(`bird read failed: ${stderr}`)
        resolve(null)
        return
      }

      try {
        const tweet = JSON.parse(stdout) as Bookmark
        resolve(tweet)
      } catch (error) {
        console.error(`Failed to parse tweet: ${error}`)
        resolve(null)
      }
    })

    bird.on("error", (error) => {
      console.error(`Failed to spawn bird: ${error.message}`)
      resolve(null)
    })
  })
}

/**
 * Get thread/conversation for a tweet.
 */
export async function getThread(idOrUrl: string, timeoutMs: number = 30000): Promise<Bookmark[]> {
  return new Promise((resolve, reject) => {
    const args = ["thread", idOrUrl, "--json"]
    const bird = spawn("bird", args, {
      env: process.env,
      timeout: timeoutMs,
    })

    let stdout = ""
    let stderr = ""

    bird.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    bird.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    bird.on("close", (code) => {
      if (code !== 0) {
        console.error(`bird thread failed: ${stderr}`)
        resolve([])
        return
      }

      try {
        const thread = JSON.parse(stdout) as Bookmark[]
        resolve(thread)
      } catch (error) {
        console.error(`Failed to parse thread: ${error}`)
        resolve([])
      }
    })

    bird.on("error", (error) => {
      console.error(`Failed to spawn bird: ${error.message}`)
      resolve([])
    })
  })
}
