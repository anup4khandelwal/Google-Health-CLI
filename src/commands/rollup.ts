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

export function makeRollupCommand(outOpts: () => OutputOptions): Command {
  const rollup = new Command("rollup").description("Query health data rollups");

  rollup
    .command("daily")
    .description("Retrieve daily aggregated health metrics")
    .option("--start <time>", "Start time (ISO 8601 or YYYY-MM-DD)")
    .option("--end <time>", "End time (ISO 8601 or YYYY-MM-DD)")
    .option("--types <types>", "Comma-separated list of data types to include")
    .action(async (opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.dailyRollup({
          startTime: opts.start,
          endTime: opts.end,
          dataTypes: opts.types ? (opts.types as string).split(",").map((s: string) => s.trim()) : undefined,
        });
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  rollup
    .command("physical")
    .description("Retrieve physical activity rollup metrics")
    .option("--start <time>", "Start time (ISO 8601 or YYYY-MM-DD)")
    .option("--end <time>", "End time (ISO 8601 or YYYY-MM-DD)")
    .option("--types <types>", "Comma-separated list of data types to include")
    .action(async (opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.physicalRollup({
          startTime: opts.start,
          endTime: opts.end,
          dataTypes: opts.types ? (opts.types as string).split(",").map((s: string) => s.trim()) : undefined,
        });
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  return rollup;
}
