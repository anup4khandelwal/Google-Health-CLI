import Conf from "conf";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { z } from "zod";

const ConfigSchema = z.object({
  baseUrl: z.string().default("https://health.googleapis.com"),
  clientId: z.string().default(""),
  clientSecret: z.string().default(""),
  user: z.string().default("me"),
  project: z.string().default(""),
  scopes: z.array(z.string()).default([]),
  redirectUrl: z.string().default("http://localhost:9876/callback"),
});

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: Config = {
  baseUrl: "https://health.googleapis.com",
  clientId: "",
  clientSecret: "",
  user: "me",
  project: "",
  scopes: [],
  redirectUrl: "http://localhost:9876/callback",
};

export function getActiveProfile(): string {
  return process.env["GHEALTH_PROFILE"] ?? "default";
}

function getBaseConfigDir(): string {
  const envDir = process.env["GHEALTH_CONFIG_DIR"];
  if (envDir) return envDir;

  const platform = process.platform;
  if (platform === "win32") {
    return join(process.env["APPDATA"] ?? homedir(), "ghealth");
  }
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "ghealth");
  }
  return join(process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config"), "ghealth");
}

function getConfigDir(): string {
  const base = getBaseConfigDir();
  const profile = getActiveProfile();
  return profile === "default" ? base : join(base, "profiles", profile);
}

function getTokenFile(): string {
  return process.env["GHEALTH_TOKEN_FILE"] ?? join(getConfigDir(), "token.json");
}

export function listProfiles(): string[] {
  const base = getBaseConfigDir();
  const profilesDir = join(base, "profiles");
  const profiles = ["default"];
  try {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    for (const entry of readdirSync(profilesDir)) {
      if (statSync(join(profilesDir, entry)).isDirectory()) {
        profiles.push(entry);
      }
    }
  } catch {
    // profiles dir doesn't exist yet
  }
  return profiles;
}

let store: Conf<Config> | null = null;
let storeProfile: string | null = null;

function getStore(): Conf<Config> {
  const profile = getActiveProfile();
  if (!store || storeProfile !== profile) {
    const configDir = getConfigDir();
    if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
    store = new Conf<Config>({
      projectName: "ghealth",
      cwd: configDir,
      defaults: DEFAULT_CONFIG,
    });
    storeProfile = profile;
  }
  return store;
}

export function loadConfig(): Config {
  const s = getStore();
  const cfg: Config = {
    baseUrl: process.env["GHEALTH_BASE_URL"] ?? s.get("baseUrl"),
    clientId: process.env["GHEALTH_CLIENT_ID"] ?? s.get("clientId"),
    clientSecret: process.env["GHEALTH_CLIENT_SECRET"] ?? s.get("clientSecret"),
    user: process.env["GHEALTH_USER"] ?? s.get("user"),
    project: process.env["GHEALTH_PROJECT"] ?? s.get("project"),
    scopes: parseEnvScopes() ?? s.get("scopes"),
    redirectUrl: process.env["GHEALTH_REDIRECT_URL"] ?? s.get("redirectUrl"),
  };
  return normalize(cfg);
}

function parseEnvScopes(): string[] | null {
  const raw = process.env["GHEALTH_SCOPES"];
  if (!raw) return null;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function normalize(cfg: Config): Config {
  return {
    ...cfg,
    baseUrl: cfg.baseUrl.trim() || DEFAULT_CONFIG.baseUrl,
    user: cfg.user.trim() || DEFAULT_CONFIG.user,
    redirectUrl: cfg.redirectUrl.trim() || DEFAULT_CONFIG.redirectUrl,
  };
}

export function saveConfig(updates: Partial<Config>): void {
  const s = getStore();
  for (const [key, value] of Object.entries(updates)) {
    s.set(key as keyof Config, value as Config[keyof Config]);
  }
}

export function getConfigKey(key: keyof Config): Config[keyof Config] {
  return getStore().get(key);
}

export function setConfigKey(key: keyof Config, value: Config[keyof Config]): void {
  getStore().set(key, value);
}

export function getConfigPath(): string {
  return getStore().path;
}

export function getTokenFilePath(): string {
  return getTokenFile();
}
