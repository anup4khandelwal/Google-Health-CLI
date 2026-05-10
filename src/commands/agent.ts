import { Command } from "commander";
import { DATA_TYPES, REST_OPERATIONS, SCOPES } from "../lib/registry.js";
import { print, type OutputOptions } from "../lib/output.js";

const AGENT_MANIFEST = {
  name: "ghealth",
  description: "Unofficial CLI for the Google Health API v4",
  version: "1.0.0",
  capabilities: [
    "auth",
    "data:list",
    "data:get",
    "data:create",
    "data:patch",
    "data:delete",
    "data:batch-delete",
    "data:reconcile",
    "data:export-tcx",
    "rollup:daily",
    "rollup:physical",
    "profile:get",
    "profile:update",
    "settings:get",
    "settings:update",
    "identity",
    "subscribers:list",
    "subscribers:create",
    "subscribers:patch",
    "subscribers:delete",
    "config",
    "doctor",
    "types",
    "endpoints",
    "api",
  ],
  outputFormats: ["table", "json", "ndjson", "csv", "markdown"],
  dataTypes: DATA_TYPES.length,
  restOperations: REST_OPERATIONS.length,
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
      print(AGENT_MANIFEST.capabilities.map((c) => ({ capability: c })), outOpts());
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
