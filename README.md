# Google Health CLI (TypeScript)

Unofficial TypeScript CLI for the [Google Health API v4](https://health.googleapis.com). Provides OAuth2 setup, data queries, rollups, profile and settings access, webhook subscriber management, and predictable JSON output for scripts and agents.

> **TypeScript rewrite** of [rudrankriyam/Google-Health-CLI](https://github.com/rudrankriyam/Google-Health-CLI) using Bun, Commander v12, and native `fetch`.

---

## Features

- 31 health data types (steps, heart rate, sleep, nutrition, and more)
- 19 REST API operations
- OAuth2 with PKCE authentication flow
- Multiple output formats: `table`, `json`, `ndjson`, `csv`, `markdown`
- Agent/AI-ready: `ghealth agent manifest|capabilities|schema`
- Configuration via file or environment variables
- Pagination, filtering, batch operations, TCX export

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
# 1. Set OAuth credentials
ghealth config set client-id YOUR_CLIENT_ID
ghealth config set client-secret YOUR_CLIENT_SECRET

# 2. Set required scopes
ghealth config set scopes "https://www.googleapis.com/auth/health.activity.read,https://www.googleapis.com/auth/health.metrics.read"

# 3. Authenticate
ghealth auth login

# 4. Verify setup
ghealth doctor

# 5. Query data
ghealth data list steps --start 2024-01-01 --end 2024-01-31
```

## Commands

### Authentication

```bash
ghealth auth login                   # Open browser for OAuth2 login
ghealth auth login --no-browser      # Print auth URL instead
ghealth auth login --write-scopes    # Include write scopes
ghealth auth status                  # Check auth status
ghealth auth revoke                  # Remove local token
ghealth auth revoke --remote         # Also revoke on Google servers
```

### Configuration

```bash
ghealth config get                   # Show all settings
ghealth config get client-id         # Get a specific key
ghealth config set client-id <id>    # Set a value
ghealth config set client-secret <s>
ghealth config set base-url <url>
ghealth config set user <user>
ghealth config set project <project>
ghealth config set scopes <scope1,scope2>
ghealth config path                  # Print config file path
```

### Data Operations

```bash
ghealth data list steps              # List steps data
ghealth data list steps --start 2024-01-01 --end 2024-01-31
ghealth data list heart-rate --page-size 20

ghealth data get steps <id>          # Get a single record
ghealth data create steps < body.json
ghealth data patch steps <id> < patch.json
ghealth data delete steps <id>
ghealth data batch-delete steps --ids id1,id2,id3
ghealth data reconcile steps
ghealth data export-tcx <sessionId>  # Export exercise as TCX
ghealth data export-tcx <sessionId> --output run.tcx
```

### Rollups

```bash
ghealth rollup daily --start 2024-01-01 --end 2024-01-07
ghealth rollup physical --start 2024-01-01
ghealth rollup daily --types steps,distance,calories
```

### Profile & Settings

```bash
ghealth profile get
ghealth profile update < update.json
ghealth profile update --file update.json --update-mask displayName

ghealth settings get
ghealth settings update < settings.json
```

### Identity & Subscribers

```bash
ghealth identity

ghealth subscribers list
ghealth subscribers create --name my-sub --topic projects/my-proj/topics/health
ghealth subscribers patch <id> < patch.json
ghealth subscribers delete <id>
```

### Utilities

```bash
ghealth doctor                       # Validate configuration

ghealth types list                   # List all 31 data types
ghealth types list --record-type Sample
ghealth types get heart-rate

ghealth endpoints                    # List all REST endpoints
ghealth endpoints --method GET
```

### Raw API Access

```bash
ghealth api GET v4/users/me/steps
ghealth api GET v4/users/me/steps -q "pageSize=10,startTime=2024-01-01T00:00:00Z"
ghealth api POST v4/users/me/steps < body.json
```

### Agent / AI Tooling

```bash
ghealth agent manifest               # JSON manifest for AI tools
ghealth agent capabilities           # List capabilities
ghealth agent schema                 # Full schema (data types, scopes, endpoints)
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

Auto-detection: table when stdout is a TTY, JSON otherwise. Override with `GHEALTH_OUTPUT` env var.

## Environment Variables

| Variable | Description |
|---|---|
| `GHEALTH_CONFIG_DIR` | Override config directory |
| `GHEALTH_TOKEN_FILE` | Override token file path |
| `GHEALTH_CLIENT_ID` | OAuth client ID |
| `GHEALTH_CLIENT_SECRET` | OAuth client secret |
| `GHEALTH_BASE_URL` | API base URL |
| `GHEALTH_USER` | User resource (default: `me`) |
| `GHEALTH_PROJECT` | Project ID |
| `GHEALTH_SCOPES` | Comma-separated OAuth scopes |
| `GHEALTH_REDIRECT_URL` | OAuth redirect URL |
| `GHEALTH_OUTPUT` | Default output format |

## Global Flags

```
--base-url <url>     Override API base URL
--user <user>        Override user resource
--project <project>  Override project ID
--format <fmt>       Set output format
--json               Force JSON output
--pretty             Pretty-print JSON
```

## Development

```bash
git clone https://github.com/anup4khandelwal/google-health-cli
cd google-health-cli
bun install
bun run dev -- types list        # Run directly (no build needed)
bun run build                    # Bundle to dist/ (~33ms)
bun test                         # Run tests
bun run typecheck                # Type-check only
```

## License

MIT
