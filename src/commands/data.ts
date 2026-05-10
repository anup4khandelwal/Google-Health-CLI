import { Command } from "commander";
import { readFileSync } from "node:fs";
import { stdin as stdinStream } from "node:process";
import { HealthClient } from "../lib/healthapi/client.js";
import { lookupType } from "../lib/registry.js";
import { print, printError, printSuccess, type OutputOptions } from "../lib/output.js";
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

async function readJSON(file?: string): Promise<Record<string, unknown>> {
  if (file) {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  }
  // Read from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of stdinStream) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function resolveType(typeArg: string): string {
  const dt = lookupType(typeArg);
  return dt ? dt.endpoint : typeArg;
}

export function makeDataCommand(outOpts: () => OutputOptions): Command {
  const data = new Command("data").description("Read and write health data points");

  data
    .command("list <type>")
    .description("List data points for a given data type")
    .option("--start <time>", "Start time (ISO 8601 or YYYY-MM-DD)")
    .option("--end <time>", "End time (ISO 8601 or YYYY-MM-DD)")
    .option("--page-size <n>", "Max results per page", "50")
    .option("--page-token <token>", "Pagination token")
    .option("--filter <expr>", "Additional filter expression")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const endpoint = resolveType(type);
        const result = await client.listDataPoints(endpoint, {
          startTime: opts.start,
          endTime: opts.end,
          pageSize: opts.pageSize ? parseInt(opts.pageSize as string, 10) : undefined,
          pageToken: opts.pageToken,
          filter: opts.filter,
        });
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("get <type> <id>")
    .description("Get a single data point by ID")
    .action(async (type: string, id: string) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const endpoint = resolveType(type);
        const result = await client.getDataPoint(endpoint, id);
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("create <type>")
    .description("Create a new data point (reads JSON from stdin or --file)")
    .option("--file <path>", "JSON file to use as the request body")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const body = await readJSON(opts.file);
        const client = await HealthClient.create();
        const endpoint = resolveType(type);
        const result = await client.createDataPoint(endpoint, body);
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("patch <type> <id>")
    .description("Patch an existing data point (reads JSON from stdin or --file)")
    .option("--file <path>", "JSON file to use as the request body")
    .option("--update-mask <mask>", "Comma-separated field mask")
    .action(async (type: string, id: string, opts) => {
      const o = outOpts();
      try {
        const body = await readJSON(opts.file);
        const client = await HealthClient.create();
        const endpoint = resolveType(type);
        const result = await client.patchDataPoint(endpoint, id, body, {
          updateMask: opts.updateMask,
        });
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("delete <type> <id>")
    .description("Delete a data point by ID")
    .action(async (type: string, id: string) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const endpoint = resolveType(type);
        await client.deleteDataPoint(endpoint, id);
        printSuccess(`Deleted ${endpoint}/${id}`, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("batch-delete <type>")
    .description("Batch delete data points by IDs (comma-separated)")
    .requiredOption("--ids <ids>", "Comma-separated list of data point IDs")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const ids = (opts.ids as string).split(",").map((s: string) => s.trim());
        const client = await HealthClient.create();
        const endpoint = resolveType(type);
        const result = await client.batchDeleteDataPoints(endpoint, ids);
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("reconcile <type>")
    .description("Reconcile data for a given data type")
    .action(async (type: string) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const endpoint = resolveType(type);
        const result = await client.reconcileDataPoints(endpoint);
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("export-tcx <sessionId>")
    .description("Export an exercise session as TCX file")
    .option("--output <file>", "Write TCX to file instead of stdout")
    .action(async (sessionId: string, opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const buf = await client.exportExerciseTCX(sessionId);
        if (opts.output) {
          const { writeFileSync } = await import("node:fs");
          writeFileSync(opts.output as string, buf);
          printSuccess(`Exported TCX to ${opts.output}`, o);
        } else {
          process.stdout.write(buf);
        }
      } catch (err) {
        handleError(err, o);
      }
    });

  return data;
}
