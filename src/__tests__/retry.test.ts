import { describe, it, expect } from "bun:test";
import { withRetry } from "../lib/retry.js";
import { APIError } from "../lib/healthapi/client.js";

describe("withRetry", () => {
  it("resolves immediately on success", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return "ok";
    }, { retries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries on a retryable status code and eventually resolves", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new APIError(503, "Service Unavailable", "retry");
        return "recovered";
      },
      { retries: 3, baseDelayMs: 1 },
    );
    expect(result).toBe("recovered");
    expect(calls).toBe(3);
  });

  it("throws immediately on non-retryable status code", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new APIError(400, "Bad Request", "invalid");
        },
        { retries: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("400");
    expect(calls).toBe(1);
  });

  it("exhausts all retries and rethrows", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new APIError(429, "Too Many Requests", "rate limited");
        },
        { retries: 2, baseDelayMs: 1 },
      ),
    ).rejects.toThrow("429");
    expect(calls).toBe(3); // 1 initial + 2 retries
  });

  it("respects custom retryOn list", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new APIError(503, "Service Unavailable", "down");
        },
        { retries: 2, baseDelayMs: 1, retryOn: [429] }, // 503 not in list
      ),
    ).rejects.toThrow("503");
    expect(calls).toBe(1);
  });

  it("safe:false only retries on 429, not on 500/503", async () => {
    let calls500 = 0;
    await expect(
      withRetry(
        async () => { calls500++; throw new APIError(500, "Internal Server Error", "oops"); },
        { retries: 3, baseDelayMs: 1, safe: false },
      ),
    ).rejects.toThrow("500");
    expect(calls500).toBe(1); // no retries on 500 when safe:false

    let calls429 = 0;
    await expect(
      withRetry(
        async () => { calls429++; throw new APIError(429, "Too Many Requests", "rate"); },
        { retries: 2, baseDelayMs: 1, safe: false },
      ),
    ).rejects.toThrow("429");
    expect(calls429).toBe(3); // 429 still retried
  });
});
