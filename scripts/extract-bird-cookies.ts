#!/usr/bin/env bun
/**
 * Extract Twitter/X cookies for use with bird CLI on remote machines.
 *
 * Run with: bun scripts/extract-bird-cookies.ts [format] [output-file] [--browsers <list>]
 * Or just:  ./scripts/extract-bird-cookies.ts [format] [output-file] [--browsers <list>]
 *
 * Formats:
 *   env     - KEY=value (default, docker --env-file compatible)
 *   export  - export KEY="value" (for sourcing in shell)
 *   mise    - [env] section for mise.toml
 *   json    - JSON object
 *   docker  - Outputs docker run flags: -e AUTH_TOKEN=... -e CT0=...
 *
 * Examples:
 *   ./extract-bird-cookies.ts env .bird.env        # Write to file for docker --env-file
 *   ./extract-bird-cookies.ts env .bird.env --browsers safari
 *   ./extract-bird-cookies.ts mise >> mise.toml    # Append to mise config
 *   ./extract-bird-cookies.ts export > ~/.bird-env && source ~/.bird-env
 *   docker run --env-file .bird.env -it birdapp bird bookmarks -n 1
 */

import { parseArgs } from "node:util"
import { getCookies, type BrowserName, type Cookie } from "@steipete/sweet-cookie"
import { writeFileSync } from "fs"

const VALID_BROWSERS: readonly BrowserName[] = ["chrome", "safari", "firefox", "edge"] as const
const DEFAULT_BROWSERS: BrowserName[] = ["chrome", "safari", "firefox"]

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    browsers: { type: "string", short: "b" },
  },
  allowPositionals: true,
})

function parseBrowserList(raw: string | undefined): BrowserName[] {
  if (!raw) return DEFAULT_BROWSERS
  const result: BrowserName[] = []
  for (const token of raw.split(",")) {
    const b = token.trim().toLowerCase()
    if (!b) continue
    if (!VALID_BROWSERS.includes(b as BrowserName)) {
      console.error(`Unknown browser: ${b}. Valid: ${VALID_BROWSERS.join(", ")}`)
      process.exit(1)
    }
    if (!result.includes(b as BrowserName)) result.push(b as BrowserName)
  }
  return result.length ? result : DEFAULT_BROWSERS
}

const browsers = parseBrowserList(values.browsers)

const { cookies, warnings } = await getCookies({
  url: "https://x.com/",
  origins: ["https://x.com/", "https://twitter.com/"],
  names: ["auth_token", "ct0"],
  browsers,
  mode: "merge",
})

if (warnings?.length) {
  for (const w of warnings) {
    console.error(`[warn] ${w}`)
  }
}

function formatCookieSource(cookie: Cookie): string {
  const browser = cookie.source?.browser ?? "unknown"
  const profile = cookie.source?.profile ? ` (${cookie.source.profile})` : ""
  const host =
    cookie.domain?.replace(/^\./, "") ??
    (cookie.url ? new URL(cookie.url).host : "unknown-host")
  return `${browser}${profile} / ${host}`
}

// Find the cookie, preferring x.com domain
function pickCookie(name: string): Cookie | null {
  const matches = cookies.filter((c) => c?.name === name && c.value)
  const preferred = matches.find((c) => (c.domain ?? "").endsWith("x.com"))
  if (preferred?.value) return preferred
  const twitter = matches.find((c) => (c.domain ?? "").endsWith("twitter.com"))
  if (twitter?.value) return twitter
  return matches[0] ?? null
}

const authTokenCookie = pickCookie("auth_token")
const ct0Cookie = pickCookie("ct0")

if (authTokenCookie) {
  console.error(`[cookie] auth_token <- ${formatCookieSource(authTokenCookie)}`)
}
if (ct0Cookie) {
  console.error(`[cookie] ct0 <- ${formatCookieSource(ct0Cookie)}`)
}

const authToken = authTokenCookie?.value ?? null
const ct0 = ct0Cookie?.value ?? null

if (!authToken || !ct0) {
  console.error("Could not find required cookies.")
  console.error(
    "Found cookie names:",
    cookies.map((c) => c.name)
  )
  process.exit(1)
}

const format = positionals[0] || "env"
const outputFile = positionals[1]

let output = ""
switch (format) {
  case "env":
    output = `AUTH_TOKEN=${authToken}\nCT0=${ct0}\n`
    break
  case "mise":
    output = `[env]\nAUTH_TOKEN = "${authToken}"\nCT0 = "${ct0}"\n`
    break
  case "json":
    output = JSON.stringify({ AUTH_TOKEN: authToken, CT0: ct0 }, null, 2) + "\n"
    break
  case "export":
    output = `export AUTH_TOKEN="${authToken}"\nexport CT0="${ct0}"\n`
    break
  case "docker":
    output = `-e AUTH_TOKEN="${authToken}" -e CT0="${ct0}"`
    break
  default:
    console.error(`Unknown format: ${format}`)
    console.error("Valid formats: env, mise, json, export, docker")
    process.exit(1)
}

if (outputFile) {
  writeFileSync(outputFile, output)
  console.error(`Wrote cookies to ${outputFile}`)
} else {
  process.stdout.write(output)
}
