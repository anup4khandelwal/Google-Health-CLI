# AGENT.md

Guidelines for AI agents and automated tools working with `ghealth` — the unofficial TypeScript CLI for the Google Health API v4.

## Discovering the Interface

Always use `--help` to discover commands rather than assuming structure:

```bash
node dist/index.js --help
node dist/index.js data --help
node dist/index.js auth --help
```

Or use the built-in agent commands:

```bash
ghealth agent manifest       # JSON summary of the tool
ghealth agent capabilities   # flat list of capability tokens
ghealth agent schema         # full schema: data types, scopes, REST ops
```

## Core Principles

1. **Long-form flags** — use `--format`, `--start`, `--end`, `--page-size` in all examples and scripts. Never rely on short aliases.

2. **TTY-aware output** — `table` format in interactive terminals; `json` (or `ndjson`) when piping to scripts or CI. Override with `--format` or `GHEALTH_OUTPUT`.

3. **Stable JSON contracts** — JSON field names are stable once released. Prefer additive changes; never rename or remove fields in a minor version.

4. **No interactive prompts** — the CLI never blocks waiting for user input during data operations. Destructive operations (delete, batch-delete, revoke) must be explicit and unambiguous.

5. **Preserve raw API access** — `ghealth api METHOD PATH` is the escape hatch for endpoints not yet modeled. Keep it working.

## Output Formats

| Format | When to use |
|---|---|
| `table` | Interactive terminals, human review |
| `json` | Scripting, piping, CI pipelines |
| `ndjson` | Streaming large result sets line-by-line |
| `csv` | Spreadsheet import / data analysis |
| `markdown` | Reports, GitHub comments |

Force a format globally: `ghealth --format json <command>` or `export GHEALTH_OUTPUT=json`.

## Environment Variables

| Variable | Purpose |
|---|---|
| `GHEALTH_CLIENT_ID` | OAuth client ID (overrides config file) |
| `GHEALTH_CLIENT_SECRET` | OAuth client secret |
| `GHEALTH_BASE_URL` | API base URL (default: `https://health.googleapis.com`) |
| `GHEALTH_USER` | User resource (default: `me`) |
| `GHEALTH_PROJECT` | Project ID for subscriber operations |
| `GHEALTH_SCOPES` | Comma-separated OAuth scopes |
| `GHEALTH_REDIRECT_URL` | OAuth redirect URL |
| `GHEALTH_OUTPUT` | Default output format |
| `GHEALTH_CONFIG_DIR` | Override config directory |
| `GHEALTH_TOKEN_FILE` | Override token file path |

## Build & Test

```bash
npm install          # install dependencies
npm run build        # compile TypeScript → dist/ via tsup
npm test             # run unit tests (vitest)
npm run typecheck    # type-check without emitting
npm run dev -- <cmd> # run without building (tsx)
```

The compiled binary is `dist/index.js` (ESM, shebang included). After build:

```bash
node dist/index.js --help
```

Or link globally:

```bash
npm link
ghealth --help
```

## Repository Layout

```
src/
├── index.ts                  # CLI entry point, global flags, command registration
├── lib/
│   ├── config.ts             # Conf-based config, env var overrides
│   ├── auth.ts               # OAuth2 + PKCE flow, token storage, refresh
│   ├── registry.ts           # Data type definitions, scopes, REST operations
│   ├── output.ts             # Multi-format printer (table/json/ndjson/csv/md)
│   └── healthapi/client.ts   # Typed HTTP client for Google Health API v4
├── commands/                 # One file per command group
└── __tests__/                # Vitest unit tests
```

Key modules to read before modifying:

- `src/lib/registry.ts` — authoritative list of data types and scopes; update here when the API adds new types
- `src/lib/healthapi/client.ts` — all HTTP calls go through here; maintain typed signatures
- `src/lib/output.ts` — all output goes through `print()` / `printError()` / `printSuccess()`; do not write to stdout/stderr directly from commands

## Adding a New Data Type

1. Add an entry to `DATA_TYPES` in `src/lib/registry.ts` with all required fields.
2. If a new scope is needed, add it to the `SCOPES` constant in the same file.
3. No other changes required — the `data` command resolves types via `lookupType()` at runtime.
4. Add a test in `src/__tests__/registry.test.ts` to cover the new entry.

## Adding a New Command

1. Create `src/commands/<name>.ts` exporting a `make<Name>Command(outOpts)` factory function.
2. Register it in `src/index.ts` with `program.addCommand(make<Name>Command(getOutputOpts))`.
3. Always pass output through the `outOpts()` callback — never use `process.stdout` directly.
4. Handle `NotLoggedInError` and `APIError` with `printError()` and `process.exit(1)`.

## Error Handling Pattern

```typescript
try {
  const result = await client.someOperation();
  print(result, o);
} catch (err) {
  if (isNotLoggedIn(err)) {
    printError({ status: "auth_error", message: err.message, hint: "Run: ghealth auth login" }, o);
  } else if (isAPIError(err)) {
    printError({ status: "api_error", message: err.message }, o);
  } else {
    printError({ status: "error", message: String(err) }, o);
  }
  process.exit(1);
}
```

## Definition of Done

- [ ] `npm run build` succeeds with no errors
- [ ] `npm run typecheck` passes with zero diagnostics
- [ ] `npm test` — all tests pass; new behaviour has test coverage
- [ ] `--help` output for new/changed commands is accurate
- [ ] README examples match actual flag names
- [ ] JSON output fields are documented if publicly consumed
- [ ] No `process.stdout.write` / `console.log` calls outside `src/lib/output.ts`
