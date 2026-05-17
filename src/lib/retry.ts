export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Base delay in ms before first retry (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 16000) */
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry (default: 429, 500, 502, 503, 504) */
  retryOn?: number[];
}

const DEFAULT_RETRY_ON = [429, 500, 502, 503, 504];

export class RetryableError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly attempt: number,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * ms * 0.2);
}

/**
 * Wraps an async operation with exponential backoff retry logic.
 * The operation receives the current attempt number (0-indexed).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 16000,
    retryOn = DEFAULT_RETRY_ON,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Only retry on specific HTTP status codes
      const status = getStatusCode(err);
      if (status === null || !retryOn.includes(status)) {
        throw err;
      }

      if (attempt === retries) break;

      const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const wait = jitter(backoff);

      // Respect Retry-After header value if available (in seconds)
      const retryAfter = getRetryAfter(err);
      const finalWait = retryAfter !== null ? retryAfter * 1000 : wait;

      await delay(finalWait);
    }
  }

  throw lastError;
}

function getStatusCode(err: unknown): number | null {
  if (err instanceof Error && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return null;
}

function getRetryAfter(err: unknown): number | null {
  if (err instanceof Error && "retryAfter" in err) {
    const v = (err as { retryAfter: unknown }).retryAfter;
    if (typeof v === "number") return v;
  }
  return null;
}
