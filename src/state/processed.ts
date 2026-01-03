/**
 * State management for tracking processed bookmarks.
 * Uses a simple JSON file for persistence.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { dirname } from "path"
import type { ProcessedEntry, ProcessedState } from "../types"

export class StateManager {
  private state: ProcessedState
  private filePath: string
  private dirty: boolean = false

  constructor(filePath: string) {
    this.filePath = filePath
    this.state = this.load()
  }

  private load(): ProcessedState {
    if (existsSync(this.filePath)) {
      try {
        const data = readFileSync(this.filePath, "utf-8")
        return JSON.parse(data)
      } catch (error) {
        console.error(`Failed to load state file: ${error}`)
      }
    }

    return {
      version: 1,
      lastRun: new Date().toISOString(),
      processed: {},
    }
  }

  isProcessed(id: string): boolean {
    return id in this.state.processed
  }

  getEntry(id: string): ProcessedEntry | undefined {
    return this.state.processed[id]
  }

  markProcessed(id: string, metadata: Partial<ProcessedEntry>): void {
    this.state.processed[id] = {
      id,
      processedAt: new Date().toISOString(),
      ...metadata,
    }
    this.dirty = true
  }

  markError(id: string, error: string, metadata?: Partial<ProcessedEntry>): void {
    this.state.processed[id] = {
      id,
      processedAt: new Date().toISOString(),
      error,
      ...metadata,
    }
    this.dirty = true
  }

  getProcessedCount(): number {
    return Object.keys(this.state.processed).length
  }

  getLastRun(): string {
    return this.state.lastRun
  }

  save(): void {
    if (!this.dirty) return

    // Ensure directory exists
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    this.state.lastRun = new Date().toISOString()
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2))
    this.dirty = false
    console.log(`State saved to ${this.filePath}`)
  }

  /**
   * Cleanup old entries to prevent unbounded growth.
   * @param maxAgeMs Maximum age in milliseconds (default: 30 days)
   */
  prune(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs
    let pruned = 0

    for (const [id, entry] of Object.entries(this.state.processed)) {
      if (new Date(entry.processedAt).getTime() < cutoff) {
        delete this.state.processed[id]
        this.dirty = true
        pruned++
      }
    }

    return pruned
  }

  /**
   * Get all processed IDs as a Set for efficient lookup.
   */
  getProcessedIds(): Set<string> {
    return new Set(Object.keys(this.state.processed))
  }

  /**
   * Get recent entries for debugging/inspection.
   */
  getRecentEntries(limit: number = 10): ProcessedEntry[] {
    return Object.values(this.state.processed)
      .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
      .slice(0, limit)
  }

  /**
   * Remove an entry from processed state (allows reprocessing).
   */
  removeEntry(id: string): boolean {
    if (id in this.state.processed) {
      delete this.state.processed[id]
      this.dirty = true
      return true
    }
    return false
  }

  /**
   * Get entry by index (0 = most recent, 1 = second most recent, etc.)
   */
  getEntryByIndex(index: number): ProcessedEntry | undefined {
    const entries = this.getRecentEntries(index + 1)
    return entries[index]
  }

  /**
   * Get all entries as array sorted by processedAt (newest first).
   */
  getAllEntries(): ProcessedEntry[] {
    return Object.values(this.state.processed)
      .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime())
  }
}
