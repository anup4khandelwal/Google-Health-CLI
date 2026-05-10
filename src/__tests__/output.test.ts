import { describe, it, expect } from "bun:test";
import { Writable } from "node:stream";
import { print, printError, printSuccess, defaultFormat } from "../lib/output.js";

function captureStream(): { stream: Writable; output: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { stream, output: () => chunks.join("") };
}

describe("print", () => {
  it("outputs JSON when format is json", () => {
    const { stream, output } = captureStream();
    print({ foo: "bar" }, { format: "json", out: stream });
    expect(output()).toBe('{"foo":"bar"}\n');
  });

  it("outputs pretty JSON when pretty is true", () => {
    const { stream, output } = captureStream();
    print({ foo: "bar" }, { format: "json", pretty: true, out: stream });
    expect(output()).toBe('{\n  "foo": "bar"\n}\n');
  });

  it("outputs NDJSON with one line per array element", () => {
    const { stream, output } = captureStream();
    print([{ a: 1 }, { a: 2 }], { format: "ndjson", out: stream });
    expect(output()).toBe('{"a":1}\n{"a":2}\n');
  });

  it("outputs CSV with header row", () => {
    const { stream, output } = captureStream();
    print([{ name: "Alice", age: 30 }], { format: "csv", out: stream });
    const lines = output().trim().split("\n");
    expect(lines[0]).toContain("age");
    expect(lines[0]).toContain("name");
    expect(lines[1]).toContain("Alice");
    expect(lines[1]).toContain("30");
  });

  it("outputs markdown table", () => {
    const { stream, output } = captureStream();
    print([{ x: 1, y: 2 }], { format: "markdown", out: stream });
    const text = output();
    expect(text).toContain("| x | y |");
    expect(text).toContain("| --- | --- |");
    expect(text).toContain("| 1 | 2 |");
  });

  it("falls back to JSON for non-object arrays in NDJSON", () => {
    const { stream, output } = captureStream();
    print("just a string", { format: "ndjson", out: stream });
    expect(output()).toBe('"just a string"\n');
  });
});

describe("printError", () => {
  it("outputs JSON error when format is json", () => {
    const { stream, output } = captureStream();
    printError({ status: "error", message: "oops", hint: "try again" }, { format: "json", out: stream });
    const parsed = JSON.parse(output());
    expect(parsed.status).toBe("error");
    expect(parsed.message).toBe("oops");
    expect(parsed.hint).toBe("try again");
  });
});

describe("printSuccess", () => {
  it("outputs JSON success when format is json", () => {
    const { stream, output } = captureStream();
    printSuccess("done", { format: "json", out: stream });
    const parsed = JSON.parse(output());
    expect(parsed.status).toBe("ok");
    expect(parsed.message).toBe("done");
  });
});

describe("defaultFormat", () => {
  it("returns json when GHEALTH_OUTPUT=json", () => {
    process.env["GHEALTH_OUTPUT"] = "json";
    expect(defaultFormat()).toBe("json");
    delete process.env["GHEALTH_OUTPUT"];
  });
});
