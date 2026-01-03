# Birdbookmark Agent

Automatically process your Twitter/X bookmarks using AI-powered routing with the Claude Agent SDK.

## What it does

1. Fetches your recent Twitter/X bookmarks using [bird CLI](https://github.com/steipete/bird)
2. Enriches each bookmark with full content (articles, YouTube transcripts, threads)
3. Uses Claude Agent SDK with MCP servers to route each bookmark:
   - **OmniFocus** - Tasks, tools to try, things to do (via `omnifocus-mcp`)
   - **Instapaper** - Articles to read later (MCP not yet configured)
   - **Obsidian** - Reference material to preserve (MCP not yet configured)
   - **Skip** - Content not worth saving

## Prerequisites

- [Bun](https://bun.sh/) - JavaScript runtime
- [Claude Code CLI](https://www.npmjs.com/package/@anthropic-ai/claude-code) - Required by Agent SDK
- [mise](https://mise.jdx.dev/) - Task runner
- [jq](https://jqlang.github.io/jq/) - JSON processor (for state inspection)
- AWS credentials for Bedrock (or `ANTHROPIC_API_KEY` for direct API)
- A Twitter/X account logged in via Chrome, Safari, or Firefox

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/grahamannett/birdbookmark-agent
cd birdbookmark-agent

# 2. Install dependencies
bun install

# 3. Install Claude Code CLI (required by Agent SDK)
npm install -g @anthropic-ai/claude-code

# 4. Extract your Twitter cookies (requires browser login)
mise cookies:extract

# 5. Run in dry-run mode to test
mise test

# 6. When ready, run for real
mise run
```

## Mise Tasks

All operations are available as mise tasks:

```bash
# Main workflow
mise run              # Process bookmarks
mise run:dry          # Dry run (no actions taken)
mise run:list         # List processed bookmarks
mise run:reprocess    # Reprocess a bookmark: mise run:reprocess -- -1

# Setup & testing
mise setup            # Initial setup and test
mise test             # Quick dry-run test
mise cookies:extract  # Extract browser cookies

# Debug utilities
mise bird:bookmarks   # Test bird CLI
mise state:show       # View full state
mise state:recent     # Show recent entries
mise state:reset      # Clear all state

# Docker (for deployment)
mise docker:build     # Build processor image
mise docker:run       # Run in Docker
mise docker:run:dry   # Dry run in Docker
```

## Configuration

Edit `config.toml` to customize behavior:

```toml
# Number of bookmarks to fetch per run
bookmarkCount = 20

# Enrichment settings
[enrichment]
fetchArticles = true
fetchYouTube = true
expandThreads = true
maxContentLength = 50000
timeoutMs = 30000

# MCP Servers for Agent SDK
[mcpServers.omnifocus]
command = "npx"
args = ["-y", "omnifocus-mcp"]

# Destinations
[omnifocus]
enabled = true
defaultProject = "Twitter Bookmarks"
defaultTags = ["twitter"]

[instapaper]
enabled = false

[obsidian]
enabled = false
# vaultPath = "/path/to/vault"
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_USE_BEDROCK` | Set to `1` to use AWS Bedrock |
| `AWS_ACCESS_KEY_ID` | AWS credentials for Bedrock |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials for Bedrock |
| `AWS_REGION` | AWS region (e.g., `us-east-2`) |
| `ANTHROPIC_API_KEY` | Alternative: direct Anthropic API |
| `AUTH_TOKEN` | Twitter auth_token cookie |
| `CT0` | Twitter ct0 cookie |
| `DRY_RUN` | Set to `true` to skip actions |

## Project Structure

```
birdbookmark-agent/
├── scripts/
│   ├── extract-bird-cookies.ts   # Cookie extraction
│   └── process-bookmarks.ts      # Main entry point
├── src/
│   ├── types.ts                  # Type definitions
│   ├── config.ts                 # TOML config loader
│   ├── bookmarks/fetcher.ts      # Bird CLI wrapper
│   ├── state/processed.ts        # State manager
│   ├── enrichment/               # Content enrichment
│   │   ├── index.ts
│   │   ├── article.ts
│   │   ├── youtube.ts
│   │   └── twitter-thread.ts
│   └── agent/                    # Agent SDK integration
│       ├── index.ts              # Agent orchestrator
│       └── prompts.ts            # System/user prompts
├── docker/
│   ├── Dockerfile.processor
│   └── .bird.env                 # Twitter cookies (gitignored)
├── data/
│   └── processed.json            # Processed bookmark state
├── config.toml                   # Runtime configuration
└── mise.toml                     # Task definitions
```

## How It Works

The agent uses the Claude Agent SDK with MCP (Model Context Protocol) servers:

1. **Enrichment**: Each bookmark is enriched with article content, YouTube transcripts, and thread context
2. **Agent Analysis**: Claude analyzes the enriched content and decides the best destination
3. **MCP Tool Execution**: The agent calls MCP tools (e.g., `mcp__omnifocus__add_omnifocus_task`)
4. **State Tracking**: Processed bookmarks are tracked to avoid reprocessing

## Adding More Destinations

To add new destinations, configure additional MCP servers in `config.toml`:

```toml
# Example: Add Obsidian
[mcpServers.obsidian]
command = "npx"
args = ["-y", "obsidian-mcp-server"]
[mcpServers.obsidian.env]
OBSIDIAN_VAULT_PATH = "/path/to/your/vault"

[obsidian]
enabled = true
vaultPath = "/path/to/your/vault"
```

## Troubleshooting

### "Could not find required cookies"

- Make sure you're logged into Twitter/X in your browser
- Try a different browser: `--browsers chrome` or `--browsers safari`
- For Safari, grant Full Disk Access to your terminal

### "Failed to fetch bookmarks"

- Verify cookies are fresh: `mise cookies:extract`
- Check that `AUTH_TOKEN` and `CT0` are set in `docker/.bird.env`

### Agent SDK errors

- Ensure Claude Code CLI is installed: `npm install -g @anthropic-ai/claude-code`
- Check `CLAUDE_CODE_USE_BEDROCK=1` is set for AWS Bedrock
- Verify AWS credentials are configured

### State file issues

- Reset state: `mise state:reset`
- View state: `mise state:show`

## License

MIT
