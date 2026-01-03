/**
 * Instapaper destination.
 *
 * TODO: Implement actual Instapaper integration.
 * Options:
 * - Instapaper Simple API (add URL)
 * - Instapaper Full API (requires OAuth)
 */

import type { Config } from "../config"
import type { DestinationResult } from "../types"
import type { Destination } from "./index"
import type { InstapaperInput } from "../agent/tools"

export class InstapaperDestination implements Destination<InstapaperInput> {
  name = "instapaper"

  constructor(private config: Config) {}

  isConfigured(): boolean {
    return this.config.instapaper?.enabled ?? false
  }

  async send(input: InstapaperInput): Promise<DestinationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: "Instapaper destination is not configured",
      }
    }

    // Log what would be saved
    console.log(`[Instapaper] Saving article:`)
    console.log(`  URL: ${input.url}`)
    if (input.title) console.log(`  Title: ${input.title}`)
    if (input.description) console.log(`  Description: ${input.description}`)
    if (input.folder) console.log(`  Folder: ${input.folder}`)

    // TODO: Implement actual Instapaper integration
    // Simple API example:
    // const response = await fetch('https://www.instapaper.com/api/add', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    //   body: new URLSearchParams({
    //     username: this.config.instapaper.username,
    //     password: this.config.instapaper.password,
    //     url: input.url,
    //     title: input.title || '',
    //     selection: input.description || '',
    //   }),
    // })

    return {
      success: true,
      message: `[STUB] Would save to Instapaper: ${input.url}`,
    }
  }
}
