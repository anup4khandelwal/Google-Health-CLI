import { Command } from "commander";
import { readFileSync } from "node:fs";
import { HealthClient } from "../lib/healthapi/client.js";
import { print, printError, type OutputOptions } from "../lib/output.js";
import { isNotLoggedIn } from "../lib/auth.js";
import { isAPIError } from "../lib/healthapi/client.js";

export function makeAPICommand(outOpts: () => OutputOptions): Command {
  return new Command("api")
    .description("Make raw API requests to the Google Health API")
    .argument("<method>", "HTTP method (GET, POST, PATCH, DELETE)")
    .argument("<path>", "API path (e.g. v4/users/me/steps)")
    .option("--file <path>", "JSON file to use as the request body")
    .option("-q, --query <params>", "Query parameters as key=value pairs (comma-separated)")
    .option("--pretty", "Pretty-print JSON output")
    .action(async (method: string, path: string, opts) => {
      const o = outOpts();
      try {
        let body: Record<string, unknown> | undefined;

        if (opts.file) {
          body = JSON.parse(readFileSync(opts.file as string, "utf8")) as Record<string, unknown>;
        } else if (["POST", "PATCH", "PUT"].includes(method.toUpperCase())) {
          // Try reading from stdin if it's not a TTY
          if (!process.stdin.isTTY) {
            const chunks: Buffer[] = [];
            for await (const chunk of process.stdin) {
              chunks.push(chunk as Buffer);
            }
            const raw = Buffer.concat(chunks).toString("utf8").trim();
            if (raw) body = JSON.parse(raw) as Record<string, unknown>;
          }
        }

        let params: Record<string, string> | undefined;
        if (opts.query) {
          params = {};
          for (const pair of (opts.query as string).split(",")) {
            const [k, ...rest] = pair.split("=");
            if (k) params[k.trim()] = rest.join("=").trim();
          }
        }

        const client = await HealthClient.create();
        const result = await client.rawRequest(method, path, body, params);
        print(result, { ...o, pretty: opts.pretty ?? o.pretty });
      } catch (err) {
        if (isNotLoggedIn(err)) {
          printError({ status: "auth_error", message: (err as Error).message, hint: "Run: ghealth auth login" }, o);
        } else if (isAPIError(err)) {
          printError({ status: "api_error", message: (err as Error).message }, o);
        } else {
          printError({ status: "error", message: String(err) }, o);
        }
        process.exit(1);
      }
    });
}
