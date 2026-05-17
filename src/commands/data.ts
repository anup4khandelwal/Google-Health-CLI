import { Command } from "commander";
import { readFileSync, createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { stdin as stdinStream } from "node:process";
import { HealthClient, extractItems } from "../lib/healthapi/client.js";
import { lookupType } from "../lib/registry.js";
import { print, printError, printSuccess, type OutputOptions } from "../lib/output.js";
import { isNotLoggedIn } from "../lib/auth.js";
import { isAPIError } from "../lib/healthapi/client.js";
import { applyDateFlags } from "../lib/dates.js";

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
  const chunks: Buffer[] = [];
  for await (const chunk of stdinStream) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

/** Read a JSON array file or NDJSON file into an array of records. */
async function readRecordsFile(file: string): Promise<Record<string, unknown>[]> {
  const content = readFileSync(file, "utf8").trim();
  // Try JSON array first
  if (content.startsWith("[")) {
    return JSON.parse(content) as Record<string, unknown>[];
  }
  // Fall back to NDJSON
  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function resolveType(typeArg: string): string {
  const dt = lookupType(typeArg);
  return dt ? dt.endpoint : typeArg;
}

function parseRetries(val: string | undefined): number | undefined {
  if (val === undefined) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

/** Compute min/max/avg/count over all numeric leaf values in an array of records. */
function summarizeRecords(records: Record<string, unknown>[]): Record<string, unknown> {
  if (records.length === 0) return { count: 0 };

  const sums: Record<string, number> = {};
  const mins: Record<string, number> = {};
  const maxs: Record<string, number> = {};
  const counts: Record<string, number> = {};

  function walk(obj: unknown, prefix: string) {
    if (typeof obj === "number") {
      if (!isNaN(obj)) {
        sums[prefix] = (sums[prefix] ?? 0) + obj;
        mins[prefix] = Math.min(mins[prefix] ?? Infinity, obj);
        maxs[prefix] = Math.max(maxs[prefix] ?? -Infinity, obj);
        counts[prefix] = (counts[prefix] ?? 0) + 1;
      }
    } else if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        walk(v, prefix ? `${prefix}.${k}` : k);
      }
    }
  }

  for (const rec of records) walk(rec, "");

  const result: Record<string, unknown> = { count: records.length, fields: {} };
  for (const field of Object.keys(sums)) {
    const n = counts[field]!;
    (result["fields"] as Record<string, unknown>)[field] = {
      min: mins[field],
      max: maxs[field],
      avg: Number((sums[field]! / n).toFixed(6)),
      count: n,
    };
  }
  return result;
}

export function makeDataCommand(outOpts: () => OutputOptions): Command {
  const data = new Command("data").description("Read and write health data points");

  data
    .command("list <type>")
    .description("List data points for a given data type")
    .option("--start <time>", "Start time (ISO 8601, YYYY-MM-DD, or shorthand like 'today')")
    .option("--end <time>", "End time (ISO 8601, YYYY-MM-DD, or shorthand like 'today')")
    .option("--last <range>", "Date shorthand: today|yesterday|7d|30d|this-week|last-week|this-month|last-month")
    .option("--page-size <n>", "Max results per page", "50")
    .option("--page-token <token>", "Pagination token")
    .option("--filter <expr>", "Additional filter expression")
    .option("--all", "Fetch all pages automatically")
    .option("--retries <n>", "Number of retries on transient errors (default: 3)")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const retries = parseRetries(opts.retries);
        const client = await HealthClient.create(retries !== undefined ? { retries } : undefined);
        const endpoint = resolveType(type);
        const { startTime, endTime } = applyDateFlags({ start: opts.start, end: opts.end, last: opts.last });
        const listOpts = {
          startTime,
          endTime,
          pageSize: opts.pageSize ? parseInt(opts.pageSize as string, 10) : undefined,
          filter: opts.filter,
        };

        if (opts.all) {
          const allItems: Record<string, unknown>[] = [];
          for await (const page of client.listAllDataPoints(endpoint, listOpts)) {
            allItems.push(...page);
          }
          print(allItems, o);
        } else {
          const result = await client.listDataPoints(endpoint, { ...listOpts, pageToken: opts.pageToken });
          print(result, o);
        }
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("get <type> <id>")
    .description("Get a single data point by ID")
    .option("--retries <n>", "Number of retries on transient errors")
    .action(async (type: string, id: string, opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create(parseRetries(opts.retries) !== undefined ? { retries: parseRetries(opts.retries) } : undefined);
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
    .option("--retries <n>", "Number of retries on transient errors")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const body = await readJSON(opts.file);
        const client = await HealthClient.create(parseRetries(opts.retries) !== undefined ? { retries: parseRetries(opts.retries) } : undefined);
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
    .option("--retries <n>", "Number of retries on transient errors")
    .action(async (type: string, id: string, opts) => {
      const o = outOpts();
      try {
        const body = await readJSON(opts.file);
        const client = await HealthClient.create(parseRetries(opts.retries) !== undefined ? { retries: parseRetries(opts.retries) } : undefined);
        const endpoint = resolveType(type);
        const result = await client.patchDataPoint(endpoint, id, body, { updateMask: opts.updateMask });
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

  data
    .command("import <type>")
    .description("Bulk-create data points from a JSON array or NDJSON file")
    .requiredOption("--file <path>", "JSON array or NDJSON file to import")
    .option("--retries <n>", "Number of retries on transient errors")
    .option("--stop-on-error", "Stop importing on first error (default: continue)")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const records = await readRecordsFile(opts.file as string);
        const client = await HealthClient.create(parseRetries(opts.retries) !== undefined ? { retries: parseRetries(opts.retries) } : undefined);
        const endpoint = resolveType(type);

        let created = 0;
        let failed = 0;
        for (const record of records) {
          try {
            await client.createDataPoint(endpoint, record);
            created++;
          } catch (err) {
            failed++;
            if (opts.stopOnError) throw err;
            process.stderr.write(`Warning: failed to import record: ${String(err)}\n`);
          }
        }
        print({ imported: created, failed, total: records.length }, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("export <type>")
    .description("Export all data points for a type to a file or stdout")
    .option("--start <time>", "Start time (ISO 8601, YYYY-MM-DD, or shorthand)")
    .option("--end <time>", "End time")
    .option("--last <range>", "Date shorthand: 7d|30d|this-week|this-month etc.")
    .option("--filter <expr>", "Additional filter expression")
    .option("--output <file>", "Output file path (default: stdout)")
    .option("--export-format <fmt>", "Format for file output: json|ndjson (default: ndjson)")
    .option("--retries <n>", "Number of retries on transient errors")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create(parseRetries(opts.retries) !== undefined ? { retries: parseRetries(opts.retries) } : undefined);
        const endpoint = resolveType(type);
        const { startTime, endTime } = applyDateFlags({ start: opts.start, end: opts.end, last: opts.last });
        const fmt = (opts.exportFormat as string | undefined) ?? "ndjson";

        const out = opts.output
          ? createWriteStream(opts.output as string, { encoding: "utf8" })
          : process.stdout;

        const allItems: Record<string, unknown>[] = [];

        for await (const page of client.listAllDataPoints(endpoint, { startTime, endTime, filter: opts.filter })) {
          if (fmt === "ndjson") {
            for (const item of page) out.write(JSON.stringify(item) + "\n");
          } else {
            allItems.push(...page);
          }
        }

        if (fmt === "json") out.write(JSON.stringify(allItems, null, 2) + "\n");

        if (opts.output) {
          printSuccess(`Exported ${endpoint} to ${opts.output}`, o);
        }
      } catch (err) {
        handleError(err, o);
      }
    });

  data
    .command("summarize <type>")
    .description("Compute min/max/avg/count for numeric fields of a data type")
    .option("--start <time>", "Start time (ISO 8601, YYYY-MM-DD, or shorthand)")
    .option("--end <time>", "End time")
    .option("--last <range>", "Date shorthand: 7d|30d|this-week|this-month etc.")
    .option("--filter <expr>", "Additional filter expression")
    .option("--retries <n>", "Number of retries on transient errors")
    .action(async (type: string, opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create(parseRetries(opts.retries) !== undefined ? { retries: parseRetries(opts.retries) } : undefined);
        const endpoint = resolveType(type);
        const { startTime, endTime } = applyDateFlags({ start: opts.start, end: opts.end, last: opts.last });

        const allItems: Record<string, unknown>[] = [];
        for await (const page of client.listAllDataPoints(endpoint, { startTime, endTime, filter: opts.filter })) {
          allItems.push(...page);
        }

        const summary = summarizeRecords(allItems);
        print(summary, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  return data;
}
