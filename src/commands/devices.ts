import { Command } from "commander";
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

export function makeDevicesCommand(outOpts: () => OutputOptions): Command {
  const devices = new Command("devices").description("List and inspect paired trackers and smartwatches");

  devices
    .command("list")
    .description("List all paired devices for the current user")
    .option("--page-size <n>", "Max results per page", "100")
    .option("--page-token <token>", "Pagination token")
    .action(async (opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.listPairedDevices({
          pageSize: opts.pageSize ? parseInt(opts.pageSize as string, 10) : undefined,
          pageToken: opts.pageToken,
        });
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  devices
    .command("get <deviceId>")
    .description("Get details of a specific paired device by ID")
    .action(async (deviceId: string) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.getPairedDevice(deviceId);
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  return devices;
}
