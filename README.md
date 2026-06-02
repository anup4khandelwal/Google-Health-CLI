# Google Health CLI

A fast, scriptable CLI for the [Google Health API v4](https://health.googleapis.com) — built with Bun and TypeScript.

Query health data, manage webhooks, export TCX files, and pipe structured output directly into scripts or AI agents.

---

## Features

- **53 health data types** — steps, heart rate, sleep, ECG, nutrition, reproductive health, and more
- **16 OAuth 2.0 scopes** including `ecg.readonly` and `location.readonly`
- **26 REST operations** across users, devices, subscribers, and subscriptions
- **OAuth 2.0 + PKCE** — browser-based login with automatic token refresh
- **Named profiles** — manage multiple Google accounts side by side
- **Date shorthands** — `--last today`, `--last 7d`, `--last this-month`
- **Auto-pagination** — `--all` flag follows `nextPageToken` automatically
- **Retry with backoff** — exponential backoff on 429/5xx; non-idempotent calls only retry on 429
- **Multiple output formats** — `table`, `json`, `ndjson`, `csv`, `markdown`; auto-detects TTY vs pipe
- **Shell completions** — bash, zsh, fish
- **AI/agent-ready** — `ghealth agent manifest|capabilities|schema`

## Requirements

- [Bun](https://bun.sh) >= 1.0.0

## Installation

```bash
bun install -g google-health-cli
# or run without installing:
bunx google-health-cli --help
```

## Quick Start

```bash
# 1. Configure OAuth credentials (from Google Cloud Console)
ghealth config init          # Interactive wizard
# — or manually:
ghealth config set client-id     YOUR_CLIENT_ID
ghealth config set client-secret YOUR_CLIENT_SECRET
ghealth config set project       YOUR_PROJECT_ID

# 2. Authenticate
ghealth auth login            # Opens browser for OAuth2 login
ghealth auth login --no-browser  # Prints URL instead

# 3. Verify setup
ghealth doctor

# 4. Query data
ghealth data list steps --last 7d
ghealth data list heart-rate --last today --format json | jq '.dataPoints[].value'
```

## Commands

### Authentication

```bash
ghealth auth login                    # OAuth2 login (opens browser)
ghealth auth login --no-browser       # Print auth URL instead
ghealth auth login --write-scopes     # Include write scopes
ghealth auth status                   # Show token info
ghealth auth refresh                  # Force token refresh
ghealth auth revoke                   # Remove local token
ghealth auth revoke --remote          # Also revoke on Google servers
```

### Configuration

```bash
ghealth config init                   # Interactive setup wizard
ghealth config get                    # Show all settings
ghealth config get client-id          # Get one key
ghealth config set client-id <id>     # Set a value
ghealth config path                   # Print config file location
```

### Data Operations

```bash
ghealth data list steps --last 7d
ghealth data list heart-rate --start 2024-01-01 --end 2024-01-31
ghealth data list sleep --all                   # Auto-paginate all results
ghealth data list steps --page-size 50 --page-token <token>

ghealth data get steps <id>
ghealth data create steps < body.json
ghealth data patch  steps <id> < patch.json
ghealth data delete steps <id>

ghealth data batch-delete steps --ids id1,id2
ghealth data reconcile steps                    # Deduplicated view
ghealth data export-tcx <sessionId>             # Export as TCX
ghealth data export-tcx <sessionId> --output run.tcx

ghealth data import steps < records.ndjson      # Bulk import from NDJSON
ghealth data export steps --last 30d            # Stream all pages to stdout
ghealth data summarize steps --last 30d         # Aggregate stats
```

### Rollups

```bash
ghealth rollup daily   --last this-week
ghealth rollup physical --last this-month
ghealth rollup daily   --types steps,distance,calories --last 7d
```

### Profile & Settings

```bash
ghealth profile get
ghealth profile update < update.json
ghealth profile update --file update.json --update-mask displayName

ghealth settings get
ghealth settings update < settings.json
```

### Devices

```bash
ghealth devices list              # List paired trackers and smartwatches
ghealth devices get <deviceId>    # Get device details
```

### Subscribers & Subscriptions

```bash
ghealth subscribers list
ghealth subscribers create --name my-sub --topic projects/proj/topics/health
ghealth subscribers patch  <id> < patch.json
ghealth subscribers delete <id>

ghealth subscribers subscriptions-list   <subscriberId>
ghealth subscribers subscriptions-list   <subscriberId> --all   # auto-paginate
ghealth subscribers subscriptions-create <subscriberId> --user <userId>
ghealth subscribers subscriptions-patch  <subscriberId> <subscriptionId> < patch.json
ghealth subscribers subscriptions-delete <subscriberId> <subscriptionId>
```

### Identity & IRN

```bash
ghealth identity          # Retrieve current user identity
ghealth irn               # Irregular Rhythm Notification (AFib) profile
```

### Named Profiles

```bash
ghealth --profile work auth login
ghealth --profile work data list steps --last 7d
ghealth profiles list
ghealth profiles current
```

### Utilities

```bash
ghealth doctor                        # Validate config, auth, and API connectivity

ghealth types list                    # List all 53 data types
ghealth types list --record-type Sample
ghealth types get heart-rate

ghealth endpoints                     # List all 26 REST endpoints
ghealth endpoints --method GET
```

### Shell Completions

```bash
# Bash
source <(ghealth completion bash)
# Zsh
source <(ghealth completion zsh)
# Fish
ghealth completion fish > ~/.config/fish/completions/ghealth.fish
```

### Raw API Access

```bash
ghealth api GET  v4/users/me/steps
ghealth api GET  v4/users/me/steps -q "pageSize=10&startTime=2024-01-01T00:00:00Z"
ghealth api POST v4/users/me/steps < body.json
```

### AI / Agent Tooling

```bash
ghealth agent manifest       # JSON manifest describing the CLI (name, version, capabilities)
ghealth agent capabilities   # Flat list of all commands
ghealth agent schema         # Full schema: data types, scopes, REST operations
```

## Output Formats

| Flag | Description |
|---|---|
| `--format table` | Human-readable table (default in terminal) |
| `--format json` | JSON (default when piped) |
| `--format ndjson` | Newline-delimited JSON |
| `--format csv` | Comma-separated values |
| `--format markdown` | Markdown table |
| `--json` | Shorthand for `--format json` |
| `--pretty` | Pretty-print JSON |

Auto-detects TTY vs pipe. Override with `GHEALTH_OUTPUT` env var.

## Global Flags

```
--profile <name>     Use a named configuration profile
--base-url <url>     Override API base URL
--user <user>        Override user resource (default: me)
--project <project>  Override project ID
--retries <n>        Retry count for API calls (default: 3)
--format <fmt>       Output format
--json               Force JSON output
--pretty             Pretty-print JSON
```

## Environment Variables

| Variable | Description |
|---|---|
| `GHEALTH_PROFILE` | Active profile name (default: `default`) |
| `GHEALTH_BASE_URL` | API base URL |
| `GHEALTH_USER` | User resource (default: `me`) |
| `GHEALTH_PROJECT` | Project ID |
| `GHEALTH_RETRIES` | Default retry count |
| `GHEALTH_OUTPUT` | Default output format |
| `GHEALTH_CLIENT_ID` | OAuth client ID |
| `GHEALTH_CLIENT_SECRET` | OAuth client secret |
| `GHEALTH_SCOPES` | Comma-separated OAuth scopes |

## Development

```bash
git clone https://github.com/anup4khandelwal/google-health-cli
cd google-health-cli
bun install
bun run dev -- types list     # Run directly from source
bun run build                 # Bundle to dist/
bun test                      # Run test suite (41 tests)
bun run typecheck             # Type-check only
```

## License

MIT
