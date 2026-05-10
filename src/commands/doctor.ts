import { Command } from "commander";
import { loadConfig } from "../lib/config.js";
import { currentStatus } from "../lib/auth.js";
import { print, type OutputOptions } from "../lib/output.js";
import chalk from "chalk";

interface CheckResult {
  check: string;
  status: "ok" | "warn" | "error";
  detail: string;
}

function icon(status: CheckResult["status"]): string {
  if (status === "ok") return chalk.green("✓");
  if (status === "warn") return chalk.yellow("!");
  return chalk.red("✗");
}

export function makeDoctorCommand(outOpts: () => OutputOptions): Command {
  return new Command("doctor")
    .description("Verify local configuration and authentication")
    .action(() => {
      const o = outOpts();
      const cfg = loadConfig();
      const auth = currentStatus();

      const checks: CheckResult[] = [
        {
          check: "client_id",
          status: cfg.clientId ? "ok" : "error",
          detail: cfg.clientId ? "Client ID is set" : "Client ID is missing — run: ghealth config set client-id <id>",
        },
        {
          check: "client_secret",
          status: cfg.clientSecret ? "ok" : "error",
          detail: cfg.clientSecret
            ? "Client secret is set"
            : "Client secret is missing — run: ghealth config set client-secret <secret>",
        },
        {
          check: "base_url",
          status: "ok",
          detail: `Base URL: ${cfg.baseUrl}`,
        },
        {
          check: "user",
          status: cfg.user ? "ok" : "warn",
          detail: cfg.user ? `User: ${cfg.user}` : "User not set, defaulting to 'me'",
        },
        {
          check: "authentication",
          status: auth.loggedIn ? "ok" : "error",
          detail: auth.loggedIn
            ? `Authenticated (expires: ${auth.expiresAt?.toISOString() ?? "unknown"})`
            : "Not authenticated — run: ghealth auth login",
        },
        {
          check: "scopes",
          status: auth.scopes?.length ? "ok" : "warn",
          detail: auth.scopes?.length
            ? `Scopes: ${auth.scopes.join(", ")}`
            : "No scopes found in token",
        },
      ];

      const isJSON =
        o.format === "json" || o.format === "ndjson" || (!o.format && !process.stdout.isTTY);

      if (isJSON) {
        print(checks, o);
      } else {
        for (const c of checks) {
          process.stdout.write(`${icon(c.status)} [${c.check}] ${c.detail}\n`);
        }
        const allOk = checks.every((c) => c.status === "ok");
        const summary = allOk ? chalk.green("\nAll checks passed.") : chalk.yellow("\nSome checks failed. See above.");
        process.stdout.write(summary + "\n");
      }
    });
}
