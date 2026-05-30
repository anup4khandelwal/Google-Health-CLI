import { Command } from "commander";
import { DATA_TYPES, REST_OPERATIONS, SCOPES } from "../lib/registry.js";
import { print, type OutputOptions } from "../lib/output.js";

const CAPABILITIES = [
  // Auth
  "auth:login", "auth:status", "auth:revoke", "auth:refresh",
  // Config
  "config:get", "config:set", "config:path", "config:init",
  // Data points
  "data:list", "data:get", "data:create", "data:patch", "data:delete",
  "data:batch-delete", "data:reconcile", "data:export-tcx",
  "data:import", "data:export", "data:summarize",
  // Rollups
  "rollup:daily", "rollup:physical",
  // User resources
  "profile:get", "profile:update",
  "settings:get", "settings:update",
  "identity",
  "irn",
  // Devices
  "devices:list", "devices:get",
  // Subscribers & subscriptions
  "subscribers:list", "subscribers:create", "subscribers:patch", "subscribers:delete",
  "subscribers:subscriptions-list", "subscribers:subscriptions-create",
  "subscribers:subscriptions-patch", "subscribers:subscriptions-delete",
  // Utilities
  "types:list", "types:get",
  "endpoints",
  "doctor",
  "profiles:list", "profiles:current",
  // Agent / raw
  "agent:manifest", "agent:capabilities", "agent:schema",
  "api",
  // Shell completions
  "completion:bash", "completion:zsh", "completion:fish",
];

const AGENT_MANIFEST = {
  name: "ghealth",
  description: "Unofficial CLI for the Google Health API v4",
  version: "1.0.0",
  capabilities: CAPABILITIES,
  outputFormats: ["table", "json", "ndjson", "csv", "markdown"],
  globalFlags: [
    "--json", "--pretty", "--format", "--base-url", "--user",
    "--project", "--profile", "--retries",
  ],
  dateShorthands: [
    "today", "yesterday", "this-week", "last-week",
    "this-month", "last-month", "7d", "30d", "90d",
  ],
  dataTypes: DATA_TYPES.length,
  restOperations: REST_OPERATIONS.length,
  scopes: Object.values(SCOPES).length,
};

export function makeAgentCommand(outOpts: () => OutputOptions): Command {
  const agent = new Command("agent").description("Output structured metadata for agent/AI tooling");

  agent
    .command("manifest")
    .description("Print a JSON manifest describing this CLI tool")
    .action(() => {
      print(AGENT_MANIFEST, { ...outOpts(), format: "json", pretty: true });
    });

  agent
    .command("capabilities")
    .description("List all CLI capabilities as JSON")
    .action(() => {
      print(CAPABILITIES.map((c) => ({ capability: c })), outOpts());
    });

  agent
    .command("schema")
    .description("Print the full schema: data types, scopes, and REST operations")
    .action(() => {
      print(
        {
          dataTypes: DATA_TYPES,
          scopes: Object.entries(SCOPES).map(([k, v]) => ({ name: k, scope: v })),
          restOperations: REST_OPERATIONS,
        },
        { ...outOpts(), format: "json", pretty: true },
      );
    });

  return agent;
}
