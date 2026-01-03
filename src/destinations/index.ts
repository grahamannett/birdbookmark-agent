/**
 * Destination plugin interface and registry.
 *
 * Provides clean abstraction for adding new destinations.
 * Each destination implements the Destination interface.
 */

import type { Config } from "../config"
import type { DestinationResult } from "../types"
import { OmniFocusDestination } from "./omnifocus"
import { InstapaperDestination } from "./instapaper"
import { KnowledgeBaseDestination } from "./knowledge-base"

/**
 * Interface that all destinations must implement.
 */
export interface Destination<T = unknown> {
  /** Unique name for this destination */
  name: string

  /** Check if this destination is properly configured */
  isConfigured(): boolean

  /** Send data to this destination */
  send(input: T): Promise<DestinationResult>
}

/**
 * Registry for managing destination plugins.
 */
export class DestinationRegistry {
  private destinations: Map<string, Destination> = new Map()

  constructor(config: Config) {
    // Register all available destinations
    this.register(new OmniFocusDestination(config))
    this.register(new InstapaperDestination(config))
    this.register(new KnowledgeBaseDestination(config))
  }

  /**
   * Register a destination plugin.
   */
  register(destination: Destination): void {
    this.destinations.set(destination.name, destination)
  }

  /**
   * Get a destination by name.
   * Throws if destination doesn't exist.
   */
  getDestination(name: string): Destination {
    const dest = this.destinations.get(name)
    if (!dest) {
      throw new Error(`Unknown destination: ${name}`)
    }
    return dest
  }

  /**
   * Get list of configured destination names.
   */
  getConfiguredDestinations(): string[] {
    return Array.from(this.destinations.values())
      .filter((d) => d.isConfigured())
      .map((d) => d.name)
  }

  /**
   * Get all registered destination names.
   */
  getAllDestinations(): string[] {
    return Array.from(this.destinations.keys())
  }

  /**
   * Check if a destination exists and is configured.
   */
  hasDestination(name: string): boolean {
    const dest = this.destinations.get(name)
    return dest ? dest.isConfigured() : false
  }
}
