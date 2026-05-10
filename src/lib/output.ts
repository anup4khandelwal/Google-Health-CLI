import { createWriteStream, type WriteStream } from "node:fs";
import { stdout, stderr } from "node:process";
import Table from "cli-table3";
import chalk from "chalk";
import { stringify as csvStringify } from "csv-stringify/sync";

export type OutputFormat = "auto" | "table" | "json" | "ndjson" | "csv" | "markdown";

export interface OutputOptions {
  format?: OutputFormat;
  pretty?: boolean;
  out?: NodeJS.WritableStream;
}

function isTerminal(stream: NodeJS.WritableStream): boolean {
  return (stream as typeof stdout).isTTY === true;
}

export function defaultFormat(out: NodeJS.WritableStream = stdout): OutputFormat {
  const env = process.env["GHEALTH_OUTPUT"];
  if (env) return env as OutputFormat;
  return isTerminal(out) ? "table" : "json";
}

function sanitize(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Strip control characters
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function extractRows(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "object" && v !== null) as Array<Record<string, unknown>>;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    // Look for common array-containing keys
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        return (obj[key] as unknown[]).filter((v) => typeof v === "object" && v !== null) as Array<Record<string, unknown>>;
      }
    }
    return [obj];
  }
  return [];
}

function getHeaders(rows: Array<Record<string, unknown>>): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

function toTable(value: unknown, out: NodeJS.WritableStream): void {
  const rows = extractRows(value);
  if (rows.length === 0) {
    out.write(JSON.stringify(value, null, 2) + "\n");
    return;
  }
  const headers = getHeaders(rows);
  const table = new Table({ head: headers.map((h) => chalk.bold(h)) });
  for (const row of rows) {
    table.push(headers.map((h) => sanitize(row[h])));
  }
  out.write(table.toString() + "\n");
}

function toMarkdown(value: unknown, out: NodeJS.WritableStream): void {
  const rows = extractRows(value);
  if (rows.length === 0) {
    out.write("```json\n" + JSON.stringify(value, null, 2) + "\n```\n");
    return;
  }
  const headers = getHeaders(rows);
  const escape = (s: string) => s.replace(/\|/g, "\\|");

  out.write("| " + headers.map(escape).join(" | ") + " |\n");
  out.write("| " + headers.map(() => "---").join(" | ") + " |\n");
  for (const row of rows) {
    out.write("| " + headers.map((h) => escape(sanitize(row[h]))).join(" | ") + " |\n");
  }
}

function toCSV(value: unknown, out: NodeJS.WritableStream): void {
  const rows = extractRows(value);
  if (rows.length === 0) {
    out.write(JSON.stringify(value) + "\n");
    return;
  }
  const headers = getHeaders(rows);
  const data = rows.map((row) => headers.map((h) => sanitize(row[h])));
  const csv = csvStringify([headers, ...data]);
  out.write(csv);
}

function toNDJSON(value: unknown, out: NodeJS.WritableStream): void {
  const rows = extractRows(value);
  if (rows.length === 0) {
    out.write(JSON.stringify(value) + "\n");
    return;
  }
  for (const row of rows) {
    out.write(JSON.stringify(row) + "\n");
  }
}

function toJSON(value: unknown, pretty: boolean, out: NodeJS.WritableStream): void {
  const json = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  out.write(json + "\n");
}

export function print(value: unknown, opts: OutputOptions = {}): void {
  const out = opts.out ?? stdout;
  const fmt = opts.format === "auto" || !opts.format ? defaultFormat(out) : opts.format;

  switch (fmt) {
    case "table":
      toTable(value, out);
      break;
    case "markdown":
      toMarkdown(value, out);
      break;
    case "csv":
      toCSV(value, out);
      break;
    case "ndjson":
      toNDJSON(value, out);
      break;
    case "json":
    default:
      toJSON(value, opts.pretty ?? false, out);
      break;
  }
}

export interface ErrorOutput {
  status: string;
  message: string;
  hint?: string;
}

export function printError(err: ErrorOutput, opts: OutputOptions = {}): void {
  const out = opts.out ?? stderr;
  const fmt = opts.format === "auto" || !opts.format ? defaultFormat(opts.out ?? stdout) : opts.format;

  if (fmt === "json" || fmt === "ndjson") {
    out.write(JSON.stringify(err) + "\n");
  } else {
    const msg = chalk.red(`Error: ${err.message}`);
    const hint = err.hint ? chalk.dim(`Hint: ${err.hint}`) : "";
    out.write(msg + (hint ? "\n" + hint : "") + "\n");
  }
}

export function printSuccess(message: string, opts: OutputOptions = {}): void {
  const out = opts.out ?? stdout;
  const fmt = opts.format === "auto" || !opts.format ? defaultFormat(out) : opts.format;
  if (fmt === "json" || fmt === "ndjson") {
    out.write(JSON.stringify({ status: "ok", message }) + "\n");
  } else {
    out.write(chalk.green("✓ ") + message + "\n");
  }
}
