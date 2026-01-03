/**
 * OmniFocus destination.
 *
 * TODO: Implement actual OmniFocus integration.
 * Options:
 * - AppleScript via osascript
 * - Shortcuts app integration
 * - OmniFocus Mail Drop
 * - OmniFocus Automation API
 */

import type { Config } from "../config"
import type { DestinationResult } from "../types"
import type { Destination } from "./index"
import type { OmniFocusInput } from "../agent/tools"

export class OmniFocusDestination implements Destination<OmniFocusInput> {
  name = "omnifocus"

  constructor(private config: Config) {}

  isConfigured(): boolean {
    return this.config.omnifocus?.enabled ?? false
  }

  async send(input: OmniFocusInput): Promise<DestinationResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: "OmniFocus destination is not configured",
      }
    }

    // Log what would be created
    console.log(`[OmniFocus] Creating task:`)
    console.log(`  Title: ${input.title}`)
    if (input.note) console.log(`  Note: ${input.note}`)
    if (input.project) console.log(`  Project: ${input.project}`)
    if (input.tags?.length) console.log(`  Tags: ${input.tags.join(", ")}`)
    if (input.dueDate) console.log(`  Due: ${input.dueDate}`)
    console.log(`  Source: ${input.sourceUrl}`)

    // TODO: Implement actual OmniFocus integration
    // Example AppleScript approach:
    // const script = `
    //   tell application "OmniFocus"
    //     tell default document
    //       set newTask to make new inbox task with properties {name:"${input.title}"}
    //       set note of newTask to "${input.note || ''}"
    //     end tell
    //   end tell
    // `
    // await exec(`osascript -e '${script}'`)

    return {
      success: true,
      message: `[STUB] Would create OmniFocus task: ${input.title}`,
    }
  }
}
