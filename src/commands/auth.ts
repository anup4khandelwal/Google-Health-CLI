import { Command } from "commander";
import {
  login,
  currentStatus,
  revokeLocal,
  revokeRemote,
  loadToken,
  buildAuthUrl,
  forceRefresh,
} from "../lib/auth.js";
import { loadConfig } from "../lib/config.js";
import { readOnlyScopes, writeScopes, allScopes } from "../lib/registry.js";
import { print, printError, printSuccess, type OutputOptions } from "../lib/output.js";

export function makeAuthCommand(outOpts: () => OutputOptions): Command {
  const auth = new Command("auth").description("Manage OAuth authentication");

  auth
    .command("login")
    .description("Authenticate with Google Health API using OAuth2")
    .option("--scopes <scopes>", "Comma-separated OAuth scopes (default: all read scopes)")
    .option("--write-scopes", "Include write scopes")
    .option("--no-browser", "Print auth URL instead of opening a browser")
    .option("--redirect-url <url>", "Custom redirect URL")
    .action(async (opts) => {
      const cfg = loadConfig();
      const o = outOpts();

      if (!cfg.clientId || !cfg.clientSecret) {
        printError(
          {
            status: "error",
            message: "Client ID and secret are not configured.",
            hint: "Run: ghealth config set client-id <id> && ghealth config set client-secret <secret>",
          },
          o,
        );
        process.exit(1);
      }

      let scopes: string[];
      if (opts.scopes) {
        scopes = (opts.scopes as string).split(",").map((s: string) => s.trim());
      } else if (opts.writeScopes) {
        scopes = allScopes();
      } else {
        scopes = cfg.scopes.length ? cfg.scopes : readOnlyScopes();
      }

      try {
        if (opts.noBrowser) {
          const { challenge } = { challenge: "preview_only" };
          const state = "preview";
          const url = buildAuthUrl(cfg.clientId, opts.redirectUrl ?? cfg.redirectUrl, scopes, state, challenge);
          print({ authUrl: url, note: "Open this URL in your browser to authenticate" }, o);
        } else {
          const token = await login(cfg.clientId, cfg.clientSecret, {
            scopes,
            noBrowser: opts.noBrowser,
            redirectUrl: opts.redirectUrl,
          });
          print(
            {
              status: "ok",
              message: "Authenticated successfully",
              scope: token.scope,
              expiresAt: token.expires_at ? new Date(token.expires_at * 1000).toISOString() : undefined,
            },
            o,
          );
        }
      } catch (err) {
        printError({ status: "error", message: String(err) }, o);
        process.exit(1);
      }
    });

  auth
    .command("status")
    .description("Check current authentication status")
    .action(() => {
      const o = outOpts();
      const status = currentStatus();
      print(
        {
          loggedIn: status.loggedIn,
          scopes: status.scopes ?? [],
          expiresAt: status.expiresAt?.toISOString() ?? null,
        },
        o,
      );
    });

  auth
    .command("revoke")
    .description("Revoke OAuth token and remove local credentials")
    .option("--remote", "Also revoke the token on Google's servers")
    .action(async (opts) => {
      const o = outOpts();
      const token = loadToken();

      if (!token) {
        printError({ status: "error", message: "Not currently logged in" }, o);
        process.exit(1);
      }

      try {
        if (opts.remote) {
          await revokeRemote(token);
        }
        revokeLocal();
        printSuccess("Token revoked and local credentials removed", o);
      } catch (err) {
        printError({ status: "error", message: `Revoke failed: ${String(err)}` }, o);
        process.exit(1);
      }
    });

  auth
    .command("refresh")
    .description("Force-refresh the access token using the stored refresh token")
    .action(async () => {
      const o = outOpts();
      try {
        const token = await forceRefresh();
        print(
          {
            status: "ok",
            message: "Token refreshed",
            expiresAt: token.expires_at ? new Date(token.expires_at * 1000).toISOString() : undefined,
          },
          o,
        );
      } catch (err) {
        printError({ status: "error", message: String(err), hint: "Run: ghealth auth login" }, o);
        process.exit(1);
      }
    });

  return auth;
}
