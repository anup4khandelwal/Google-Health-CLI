import { Command } from "commander";
import { readFileSync } from "node:fs";
import { HealthClient } from "../lib/healthapi/client.js";
import { print, printError, type OutputOptions } from "../lib/output.js";
import { isNotLoggedIn } from "../lib/auth.js";
import { isAPIError } from "../lib/healthapi/client.js";

function handleError(err: unknown, o: OutputOptions): never {
  if (isNotLoggedIn(err)) {
    printError({ status: "auth_error", message: (err as Error).message, hint: "Run: ghealth auth login" }, o);
  } else if (isAPIError(err)) {
    printError({ status: "api_error", message: (err as Error).message }, o);
  } else {
    printError({ status: "error", message: String(err) }, o);
  }
  process.exit(1);
}

export function makeProfileCommand(outOpts: () => OutputOptions): Command {
  const profile = new Command("profile").description("Manage user profile");

  profile
    .command("get")
    .description("Retrieve the current user profile")
    .action(async () => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.getProfile();
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  profile
    .command("update")
    .description("Update the user profile (reads JSON from stdin or --file)")
    .option("--file <path>", "JSON file to use as the request body")
    .option("--update-mask <mask>", "Comma-separated field mask")
    .action(async (opts) => {
      const o = outOpts();
      try {
        let body: Record<string, unknown>;
        if (opts.file) {
          body = JSON.parse(readFileSync(opts.file as string, "utf8")) as Record<string, unknown>;
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
        }
        const client = await HealthClient.create();
        const result = await client.updateProfile(body, opts.updateMask as string | undefined);
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  return profile;
}
