import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { resolveDate, resolveDateRange, applyDateFlags } from "../lib/dates.js";

// Pin "now" to a known Monday: 2024-03-11T12:00:00Z
const FIXED_NOW = new Date("2024-03-11T12:00:00.000Z");

let originalDateNow: typeof Date.now;

beforeEach(() => {
  originalDateNow = Date.now;
  // @ts-expect-error — override for testing
  globalThis.Date = class extends Date {
    constructor(...args: ConstructorParameters<typeof Date>) {
      if (args.length === 0) {
        super(FIXED_NOW.getTime());
      } else {
        // @ts-expect-error spread
        super(...args);
      }
    }
    static now() { return FIXED_NOW.getTime(); }
  };
});

afterEach(() => {
  globalThis.Date = (class extends Date {}) as typeof Date;
  Date.now = originalDateNow;
  // Restore original
  globalThis.Date = Date;
});

describe("resolveDate", () => {
  it("passes ISO 8601 strings through unchanged", () => {
    const iso = "2024-01-15T08:30:00.000Z";
    expect(resolveDate(iso, "start")).toBe(iso);
    expect(resolveDate(iso, "end")).toBe(iso);
  });

  it("expands YYYY-MM-DD to start-of-day for 'start'", () => {
    const result = resolveDate("2024-01-15", "start");
    expect(result).toContain("2024-01-15");
    expect(result).toContain("T00:00:00");
  });

  it("expands YYYY-MM-DD to end-of-day for 'end'", () => {
    const result = resolveDate("2024-01-15", "end");
    expect(result).toContain("2024-01-15");
    expect(result).toContain("T23:59:59");
  });

  it("Nd shorthand resolves to N days ago", () => {
    const result = resolveDate("7d", "start");
    expect(new Date(result).getTime()).toBeLessThan(FIXED_NOW.getTime());
  });

  it("last-Nd is equivalent to Nd", () => {
    expect(resolveDate("last-7d", "start")).toBe(resolveDate("7d", "start"));
  });
});

describe("resolveDateRange", () => {
  it("returns start before end", () => {
    const { start, end } = resolveDateRange("7d");
    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
  });

  it("this-week start is earlier than end", () => {
    const { start, end } = resolveDateRange("this-week");
    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
  });
});

describe("applyDateFlags", () => {
  it("returns undefined when no flags", () => {
    const result = applyDateFlags({});
    expect(result.startTime).toBeUndefined();
    expect(result.endTime).toBeUndefined();
  });

  it("--last overrides --start/--end", () => {
    const withLast = applyDateFlags({ start: "2023-01-01", end: "2023-12-31", last: "7d" });
    const withoutLast = applyDateFlags({ start: "2023-01-01", end: "2023-12-31" });
    expect(withLast.startTime).not.toBe(withoutLast.startTime);
  });

  it("passes --start/--end through when no --last", () => {
    const result = applyDateFlags({ start: "2024-01-01", end: "2024-01-31" });
    expect(result.startTime).toContain("2024-01-01");
    expect(result.endTime).toContain("2024-01-31");
  });
});
