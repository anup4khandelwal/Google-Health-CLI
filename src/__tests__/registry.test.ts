import { describe, it, expect } from "bun:test";
import {
  DATA_TYPES,
  REST_OPERATIONS,
  SCOPES,
  getTypes,
  lookupType,
  readOnlyScopes,
  writeScopes,
  allScopes,
} from "../lib/registry.js";

describe("DATA_TYPES", () => {
  it("has 53 entries", () => {
    expect(DATA_TYPES).toHaveLength(53);
  });

  it("all entries have required fields", () => {
    for (const dt of DATA_TYPES) {
      expect(dt.name).toBeTruthy();
      expect(dt.endpoint).toBeTruthy();
      expect(dt.filterName).toBeTruthy();
      expect(["Interval", "Sample", "Session", "Daily"]).toContain(dt.recordType);
      expect(dt.operations.length).toBeGreaterThan(0);
      expect(dt.scope).toBeTruthy();
      expect(dt.timeField).toBeTruthy();
    }
  });

  it("all names are unique", () => {
    const names = DATA_TYPES.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all endpoints are unique", () => {
    const endpoints = DATA_TYPES.map((d) => d.endpoint);
    expect(new Set(endpoints).size).toBe(endpoints.length);
  });
});

describe("REST_OPERATIONS", () => {
  it("has 19 entries", () => {
    expect(REST_OPERATIONS).toHaveLength(26);
  });

  it("all entries have method, path, and description", () => {
    for (const op of REST_OPERATIONS) {
      expect(["GET", "POST", "PATCH", "DELETE"]).toContain(op.method);
      expect(op.path).toBeTruthy();
      expect(op.description).toBeTruthy();
    }
  });
});

describe("getTypes", () => {
  it("returns types sorted by endpoint", () => {
    const types = getTypes();
    const endpoints = types.map((t) => t.endpoint);
    expect(endpoints).toEqual([...endpoints].sort());
  });
});

describe("lookupType", () => {
  it("finds by name", () => {
    expect(lookupType("steps")?.name).toBe("steps");
    expect(lookupType("heart-rate")?.name).toBe("heart-rate");
  });

  it("finds by endpoint", () => {
    expect(lookupType("heartRate")?.name).toBe("heart-rate");
    expect(lookupType("sleepSessions")?.name).toBe("sleep");
  });

  it("finds by filterName", () => {
    expect(lookupType("StepsRecord")?.name).toBe("steps");
  });

  it("is case-insensitive", () => {
    expect(lookupType("STEPS")?.name).toBe("steps");
    expect(lookupType("HeartRate")?.name).toBe("heart-rate");
  });

  it("returns undefined for unknown types", () => {
    expect(lookupType("notatype")).toBeUndefined();
  });
});

describe("scope helpers", () => {
  it("readOnlyScopes returns only .read or .readonly scopes", () => {
    const scopes = readOnlyScopes();
    expect(scopes.every((s) => s.endsWith(".read") || s.endsWith(".readonly"))).toBe(true);
    expect(scopes.length).toBeGreaterThan(0);
  });

  it("writeScopes returns only .write scopes", () => {
    const scopes = writeScopes();
    expect(scopes.every((s) => s.endsWith(".write"))).toBe(true);
    expect(scopes.length).toBeGreaterThan(0);
  });

  it("allScopes returns all scopes", () => {
    expect(allScopes()).toHaveLength(Object.keys(SCOPES).length);
  });

  it("read + write = all scopes", () => {
    // IRN_READ, DEVICES_READ, ECG_READ, LOCATION_READ use .readonly suffix
    expect(readOnlyScopes().length + writeScopes().length).toBe(allScopes().length);
  });
});
