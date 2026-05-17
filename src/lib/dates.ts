/**
 * Parses human-friendly date shorthands into ISO 8601 strings.
 *
 * Supported shorthands:
 *   today, yesterday, this-week, last-week, this-month, last-month
 *   7d / 7days / last-7d  (any positive integer + d/days)
 *   Plain ISO 8601 strings are passed through unchanged.
 */

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export interface DateRange {
  start: string;
  end: string;
}

/**
 * Resolve a shorthand or ISO string into an ISO 8601 datetime string.
 * When used as a start date, "today" becomes midnight today.
 * When used as an end date, "today" becomes end of today.
 */
export function resolveDate(arg: string, role: "start" | "end" = "start"): string {
  const now = new Date();

  switch (arg.toLowerCase()) {
    case "today":
      return (role === "start" ? startOfDay(now) : endOfDay(now)).toISOString();
    case "yesterday": {
      const y = addDays(now, -1);
      return (role === "start" ? startOfDay(y) : endOfDay(y)).toISOString();
    }
    case "this-week": {
      const day = now.getDay(); // 0=Sun
      const mon = addDays(now, -(day === 0 ? 6 : day - 1));
      return (role === "start" ? startOfDay(mon) : endOfDay(now)).toISOString();
    }
    case "last-week": {
      const day = now.getDay();
      const thisMonday = addDays(now, -(day === 0 ? 6 : day - 1));
      const lastMonday = addDays(thisMonday, -7);
      const lastSunday = addDays(thisMonday, -1);
      return (role === "start" ? startOfDay(lastMonday) : endOfDay(lastSunday)).toISOString();
    }
    case "this-month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return (role === "start" ? startOfDay(firstDay) : endOfDay(now)).toISOString();
    }
    case "last-month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return (role === "start" ? startOfDay(firstDay) : endOfDay(lastDay)).toISOString();
    }
    default: {
      // Match: 7d, 30d, 7days, 30days, last-7d, last-30d
      const m = arg.toLowerCase().match(/^(?:last-)?(\d+)d(?:ays?)?$/);
      if (m) {
        const n = parseInt(m[1]!, 10);
        const past = addDays(now, -n);
        return (role === "start" ? startOfDay(past) : endOfDay(now)).toISOString();
      }
      // Bare YYYY-MM-DD → treat as midnight start or end of that day
      if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
        const d = new Date(arg + "T00:00:00");
        return (role === "start" ? startOfDay(d) : endOfDay(d)).toISOString();
      }
      // Pass ISO 8601 through unchanged
      return arg;
    }
  }
}

/**
 * Parse a --last shorthand like "7d" or "this-week" into a {start, end} pair.
 */
export function resolveDateRange(shorthand: string): DateRange {
  return {
    start: resolveDate(shorthand, "start"),
    end: resolveDate(shorthand, "end"),
  };
}

/**
 * Apply --start / --end / --last to produce final date strings for API calls.
 * --last overrides --start/--end.
 */
export function applyDateFlags(opts: {
  start?: string;
  end?: string;
  last?: string;
}): { startTime?: string; endTime?: string } {
  if (opts.last) {
    const range = resolveDateRange(opts.last);
    return { startTime: range.start, endTime: range.end };
  }
  return {
    startTime: opts.start ? resolveDate(opts.start, "start") : undefined,
    endTime: opts.end ? resolveDate(opts.end, "end") : undefined,
  };
}
