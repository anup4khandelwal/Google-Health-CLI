import { Command } from "commander";
import { createInterface } from "node:readline";
import {
  loadConfig,
  getConfigKey,
  setConfigKey,
  getConfigPath,
  saveConfig,
  type Config,
} from "../lib/config.js";
import { readOnlyScopes } from "../lib/registry.js";
import { print, printError, printSuccess, type OutputOptions } from "../lib/output.js";

const VALID_KEYS: (keyof Config)[] = [
  "baseUrl",
  "clientId",
  "clientSecret",
  "user",
  "project",
  "scopes",
  "redirectUrl",
];

function toConfigKey(input: string): keyof Config | null {
  // Support both camelCase and kebab-case
  const map: Record<string, keyof Config> = {
    "base-url": "baseUrl",
    baseurl: "baseUrl",
    "baseUrl": "baseUrl",
    "client-id": "clientId",
    clientid: "clientId",
    "clientId": "clientId",
    "client-secret": "clientSecret",
    clientsecret: "clientSecret",
    "clientSecret": "clientSecret",
    user: "user",
    project: "project",
    scopes: "scopes",
    "redirect-url": "redirectUrl",
    redirecturl: "redirectUrl",
    "redirectUrl": "redirectUrl",
  };
  return map[input.toLowerCase()] ?? (VALID_KEYS.includes(input as keyof Config) ? (input as keyof Config) : null);
}

export function makeConfigCommand(outOpts: () => OutputOptions): Command {
  const cfg = new Command("config").description("Manage local configuration");

  cfg
    .command("get [key]")
    .description("Get configuration value(s). Omit key to show all settings.")
    .action((key?: string) => {
      const o = outOpts();
      if (!key) {
        const config = loadConfig();
        const safe = { ...config, clientSecret: config.clientSecret ? "***" : "" };
        print(safe, o);
        return;
      }

      const cfgKey = toConfigKey(key);
      if (!cfgKey) {
        printError({ status: "error", message: `Unknown config key: ${key}`, hint: `Valid keys: ${VALID_KEYS.join(", ")}` }, o);
        process.exit(1);
      }

      const value = getConfigKey(cfgKey);
      print({ [cfgKey]: value }, o);
    });

  cfg
    .command("set <key> <value>")
    .description("Set a configuration value")
    .action((key: string, value: string) => {
      const o = outOpts();
      const cfgKey = toConfigKey(key);
      if (!cfgKey) {
        printError({ status: "error", message: `Unknown config key: ${key}`, hint: `Valid keys: ${VALID_KEYS.join(", ")}` }, o);
        process.exit(1);
      }

      let parsed: Config[keyof Config];
      if (cfgKey === "scopes") {
        parsed = value.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        parsed = value;
      }

      setConfigKey(cfgKey, parsed);
      printSuccess(`Set ${cfgKey} = ${cfgKey === "clientSecret" ? "***" : String(parsed)}`, o);
    });

  cfg
    .command("path")
    .description("Print path to the configuration file")
    .action(() => {
      const o = outOpts();
      const p = getConfigPath();
      print({ path: p }, o);
    });

  cfg
    .command("init")
    .description("Interactive setup wizard — configure OAuth credentials and scopes")
    .action(async () => {
      const o = outOpts();
      const current = loadConfig();
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const ask = (q: string): Promise<string> =>
        new Promise((resolve) => rl.question(q, resolve));

      process.stdout.write("ghealth setup wizard\n\n");

      const clientId = (await ask(`Client ID [${current.clientId || "none"}]: `)).trim() || current.clientId;
      const clientSecret = (await ask("Client Secret [keep existing]: ")).trim() || current.clientSecret;
      const project = (await ask(`Project ID [${current.project || "none"}]: `)).trim() || current.project;
      const defaultScopes = readOnlyScopes().join(",");
      const scopesInput = (await ask(`Scopes (comma-separated) [read-only defaults]: `)).trim();
      const scopes = scopesInput ? scopesInput.split(",").map((s) => s.trim()) : readOnlyScopes();

      rl.close();

      saveConfig({ clientId, clientSecret, project, scopes });
      printSuccess("Configuration saved. Run: ghealth auth login", o);
      print({ clientId, project, scopes }, o);
      void defaultScopes;
    });

  return cfg;
}
