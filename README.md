# BirdBookmarkAgent

Automatically process your Twitter/X bookmarks using AI-powered routing.

## What it does

1. Fetches your recent Twitter/X bookmarks using [bird CLI](https://github.com/steipete/bird)
2. Enriches each bookmark with full content (articles, YouTube transcripts, threads)
3. Uses Claude to analyze and route each bookmark to the appropriate destination:
   - **OmniFocus** - Tasks, tools to try, things to do
   - **Instapaper** - Articles to read later
   - **Knowledge Base** - Reference material to preserve
   - **Skip** - Content not worth saving

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime
- [Docker](https://www.docker.com/) - For containerized execution
- [mise](https://mise.jdx.dev/) - Task runner
- [jq](https://jqlang.github.io/jq/) - JSON processor (for state inspection)
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- A Twitter/X account logged in via Chrome, Safari, or Firefox

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/grahamannett/birdbookmark-agent
cd birdbookmark-agent

# 2. Extract your Twitter cookies (requires browser login)
mise cookies:extract
# Or: bun scripts/extract-bird-cookies.ts env docker/.bird.env

# 3. Build the processor Docker image
mise processor:build

# 4. Run in dry-run mode to test (no actual destinations)
export ANTHROPIC_API_KEY=your-key-here
mise processor:dry-run

# 5. When ready, run for real
mise processor:run
```

## Cookie Extraction

The processor needs your Twitter/X session cookies to fetch bookmarks. These are extracted from your local browser.

```bash
# Extract from Chrome (default tries chrome, safari, firefox)
bun scripts/extract-bird-cookies.ts env docker/.bird.env

# Extract from specific browser
bun scripts/extract-bird-cookies.ts env docker/.bird.env --browsers safari

# Output formats
bun scripts/extract-bird-cookies.ts env      # KEY=value (docker --env-file)
bun scripts/extract-bird-cookies.ts export   # export KEY="value" (shell)
bun scripts/extract-bird-cookies.ts json     # JSON object
bun scripts/extract-bird-cookies.ts mise     # [env] section for mise.toml
```

**Note:** Safari requires Full Disk Access permission for your terminal app (System Settings > Privacy & Security > Full Disk Access).

## Mise Tasks

All operations are available as mise tasks:

### Cookie Management

```bash
mise cookies:extract      # Extract cookies to docker/.bird.env
```

### Bird CLI (Twitter/X access)

```bash
mise docker:build         # Build bird Docker image
mise docker:run           # Run bird interactively
mise docker:shell         # Open shell in bird container
mise bird:bookmarks       # Fetch your latest 5 bookmarks
```

### Bookmark Processor

```bash
mise processor:build      # Build processor Docker image
mise processor:run        # Process bookmarks (live mode)
mise processor:dry-run    # Process without sending to destinations
mise processor:local      # Run locally with bun (development)
mise processor:local-dry  # Run locally in dry-run mode
```

### State Management

```bash
mise state:show           # View full state file
mise state:recent         # Show 10 most recently processed
mise state:reset          # Clear all processed history
```

## Configuration

Edit `config.json` to customize behavior:

```json
{
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 1024,
  "bookmarkCount": 20,
  "statePath": "./data/processed.json",

  "enrichment": {
    "fetchArticles": true,
    "fetchYouTube": true,
    "expandThreads": true,
    "maxContentLength": 50000,
    "timeoutMs": 30000
  },

  "omnifocus": {
    "enabled": true,
    "defaultProject": "Twitter Bookmarks",
    "defaultTags": ["twitter"]
  },

  "instapaper": {
    "enabled": true
  },

  "knowledgeBase": {
    "enabled": true,
    "path": "./data/knowledge",
    "format": "markdown"
  }
}
```

### Environment Variables

| Variable            | Description                               |
| ------------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required)         |
| `AUTH_TOKEN`        | Twitter auth_token cookie                 |
| `CT0`               | Twitter ct0 cookie                        |
| `DRY_RUN`           | Set to `true` to skip destination actions |
| `BOOKMARK_COUNT`    | Override number of bookmarks to fetch     |
| `STATE_PATH`        | Override state file location              |

## Project Structure

```
birdbookmark-agent/
├── scripts/
│   ├── extract-bird-cookies.ts   # Cookie extraction script
│   └── process-bookmarks.ts      # Main processor entry point
├── src/
│   ├── types.ts                  # Shared type definitions
│   ├── config.ts                 # Configuration loader
│   ├── bookmarks/
│   │   └── fetcher.ts            # Bird CLI wrapper
│   ├── state/
│   │   └── processed.ts          # JSON state manager
│   ├── enrichment/
│   │   ├── index.ts              # Pipeline orchestrator
│   │   ├── article.ts            # Article content extraction
│   │   ├── youtube.ts            # YouTube transcript extraction
│   │   └── twitter-thread.ts     # Thread expansion
│   ├── agent/
│   │   ├── index.ts              # Agent orchestrator
│   │   ├── prompts.ts            # System/user prompts
│   │   └── tools/index.ts        # Tool definitions (Zod schemas)
│   └── destinations/
│       ├── index.ts              # Plugin interface + registry
│       ├── omnifocus.ts          # OmniFocus destination (stub)
│       ├── instapaper.ts         # Instapaper destination (stub)
│       └── knowledge-base.ts     # Knowledge base destination (stub)
├── docker/
│   ├── Dockerfile                # Bird CLI container
│   ├── Dockerfile.processor      # Processor container
│   └── .bird.env                 # Twitter cookies (gitignored)
├── data/
│   └── processed.json            # Processed bookmark state
├── config.json                   # Runtime configuration
└── mise.toml                     # Task definitions
```

## Implementing Destinations

The destinations are currently stubs that log what would happen. To implement actual integrations, edit the files in `src/destinations/`:

### OmniFocus (`src/destinations/omnifocus.ts`)

Options for implementation:

- **AppleScript** via `osascript` command
- **Shortcuts** app integration
- **OmniFocus Mail Drop**
- **OmniFocus Automation API**

### Instapaper (`src/destinations/instapaper.ts`)

Use the [Instapaper Simple API](https://www.instapaper.com/api/simple):

```typescript
const response = await fetch("https://www.instapaper.com/api/add", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    username: config.instapaper.username,
    password: config.instapaper.password,
    url: input.url,
    title: input.title || "",
  }),
})
```

### Knowledge Base (`src/destinations/knowledge-base.ts`)

Options for implementation:

- **Local markdown files** (Obsidian-compatible)
- **Notion API**
- **SQLite database**
- **JSON file storage**

## Running as a Cron Job

To process bookmarks automatically, add to your crontab:

```bash
# Run every 6 hours
0 */6 * * * cd /path/to/birdbookomni && ANTHROPIC_API_KEY=your-key mise processor:run >> /var/log/bookmark-processor.log 2>&1
```

Or use a systemd timer, launchd plist, or Docker scheduler.

## How the Agent Routes Bookmarks

The Claude agent analyzes each bookmark and its enriched content, then decides:

| Destination        | Use Cases                                                  |
| ------------------ | ---------------------------------------------------------- |
| **OmniFocus**      | Tasks, tools to try, things to check out, actionable items |
| **Instapaper**     | Articles, blog posts, long-form content to read later      |
| **Knowledge Base** | Facts, code snippets, techniques, reference material       |
| **Skip**           | Jokes, memes, casual content, stale time-sensitive posts   |

The agent receives:

- Tweet text and metadata
- Quoted tweet content (if any)
- Full thread context (if part of thread)
- Extracted article content from links
- YouTube video transcripts

## Troubleshooting

### "Could not find required cookies"

- Make sure you're logged into Twitter/X in your browser
- Try a different browser: `--browsers chrome` or `--browsers safari`
- For Safari, grant Full Disk Access to your terminal

### "Failed to fetch bookmarks"

- Verify cookies are fresh: `mise cookies:extract`
- Check that `AUTH_TOKEN` and `CT0` are set in `docker/.bird.env`

### Agent not using tools

- Check your `ANTHROPIC_API_KEY` is valid
- Ensure the model specified in `config.json` supports tool use

### State file issues

- Reset state: `mise state:reset`
- View state: `mise state:show`

## License

MIT
