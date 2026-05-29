import { Command } from "commander";
import { HealthClient } from "../lib/healthapi/client.js";
import { print, printError, type OutputOptions } from "../lib/output.js";
import { isNotLoggedIn } from "../lib/auth.js";
import { isAPIError } from "../lib/healthapi/client.js";

export function makeIrnCommand(outOpts: () => OutputOptions): Command {
  return new Command("irn")
    .description("Retrieve the Irregular Rhythm Notification (AFib) profile for the current user")
    .action(async () => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.getIrnProfile();
        print(result, o);
      } catch (err) {
        if (isNotLoggedIn(err)) {
          printError(
            {
              status: "auth_error",
              message: (err as Error).message,
              hint: "Run: ghealth auth login --scopes https://www.googleapis.com/auth/health.irn.readonly",
            },
            o,
          );
        } else if (isAPIError(err)) {
          printError({ status: "api_error", message: (err as Error).message }, o);
        } else {
          printError({ status: "error", message: String(err) }, o);
        }
        process.exit(1);
      }
    });
}
