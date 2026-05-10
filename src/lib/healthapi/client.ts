import { getValidToken } from "../auth.js";
import { loadConfig } from "../config.js";
import { NotLoggedInError } from "../auth.js";

export class APIError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly status: string,
    public readonly body: string,
  ) {
    super(`API error ${statusCode}: ${status}`);
    this.name = "APIError";
  }
}

export function isAPIError(err: unknown): err is APIError {
  return err instanceof APIError;
}

export function isNotLoggedIn(err: unknown): err is NotLoggedInError {
  return err instanceof NotLoggedInError;
}

export interface ListOptions {
  startTime?: string;
  endTime?: string;
  pageSize?: number;
  pageToken?: string;
  filter?: string;
}

export interface ReconcileOptions {
  dataType: string;
}

export interface UpdateOptions {
  updateMask?: string;
}

export interface SubscriberListOptions {
  pageSize?: number;
  pageToken?: string;
}

export interface CreateSubscriberOptions {
  name: string;
  pubsubTopic: string;
  eventTypes?: string[];
}

export interface PatchSubscriberOptions {
  subscriberId: string;
  body: Record<string, unknown>;
  updateMask?: string;
}

export interface DeleteSubscriberOptions {
  subscriberId: string;
}

export interface ExportExerciseTCXOptions {
  sessionId: string;
}

export interface RollupOptions {
  startTime?: string;
  endTime?: string;
  dataTypes?: string[];
}

// Generic JSON record
export type JsonRecord = Record<string, unknown>;

export class HealthClient {
  private readonly baseUrl: string;
  private readonly user: string;
  private readonly project: string;

  constructor(baseUrl: string, user: string, project: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.user = user;
    this.project = project;
  }

  static async create(): Promise<HealthClient> {
    const cfg = loadConfig();
    return new HealthClient(cfg.baseUrl, cfg.user, cfg.project);
  }

  private async authHeader(): Promise<Record<string, string>> {
    const token = await getValidToken();
    return { Authorization: `Bearer ${token.access_token}` };
  }

  private userPath(): string {
    return `v4/users/${encodeURIComponent(this.user)}`;
  }

  private projectPath(): string {
    return `v4/projects/${encodeURIComponent(this.project)}`;
  }

  private async doJSON<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    const auth = await this.authHeader();
    const url = new URL(`${this.baseUrl}/${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        ...auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
      throw new APIError(res.status, res.statusText, text);
    }

    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  private async doBytes(method: string, path: string, params?: Record<string, string>): Promise<Buffer> {
    const auth = await this.authHeader();
    const url = new URL(`${this.baseUrl}/${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await fetch(url.toString(), { method, headers: auth });
    if (!res.ok) {
      const text = await res.text();
      throw new APIError(res.status, res.statusText, text);
    }

    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  }

  // Profile
  async getProfile(): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("GET", `${this.userPath()}/profile`);
  }

  async updateProfile(body: JsonRecord, updateMask?: string): Promise<JsonRecord> {
    const params = updateMask ? { updateMask } : undefined;
    return this.doJSON<JsonRecord>("PATCH", `${this.userPath()}/profile`, body, params);
  }

  // Settings
  async getSettings(): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("GET", `${this.userPath()}/settings`);
  }

  async updateSettings(body: JsonRecord, updateMask?: string): Promise<JsonRecord> {
    const params = updateMask ? { updateMask } : undefined;
    return this.doJSON<JsonRecord>("PATCH", `${this.userPath()}/settings`, body, params);
  }

  // Identity
  async getIdentity(): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("GET", `${this.userPath()}/identity`);
  }

  // Data Points
  async listDataPoints(dataType: string, opts: ListOptions = {}): Promise<JsonRecord> {
    const params: Record<string, string> = {};
    if (opts.startTime) params["startTime"] = opts.startTime;
    if (opts.endTime) params["endTime"] = opts.endTime;
    if (opts.pageSize) params["pageSize"] = String(opts.pageSize);
    if (opts.pageToken) params["pageToken"] = opts.pageToken;
    if (opts.filter) params["filter"] = opts.filter;
    return this.doJSON<JsonRecord>("GET", `${this.userPath()}/${dataType}`, undefined, params);
  }

  async getDataPoint(dataType: string, dataId: string): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("GET", `${this.userPath()}/${dataType}/${encodeURIComponent(dataId)}`);
  }

  async createDataPoint(dataType: string, body: JsonRecord): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("POST", `${this.userPath()}/${dataType}`, body);
  }

  async patchDataPoint(dataType: string, dataId: string, body: JsonRecord, opts: UpdateOptions = {}): Promise<JsonRecord> {
    const params = opts.updateMask ? { updateMask: opts.updateMask } : undefined;
    return this.doJSON<JsonRecord>("PATCH", `${this.userPath()}/${dataType}/${encodeURIComponent(dataId)}`, body, params);
  }

  async deleteDataPoint(dataType: string, dataId: string): Promise<void> {
    await this.doJSON<void>("DELETE", `${this.userPath()}/${dataType}/${encodeURIComponent(dataId)}`);
  }

  async batchDeleteDataPoints(dataType: string, ids: string[]): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("POST", `${this.userPath()}/${dataType}:batchDelete`, { ids });
  }

  async reconcileDataPoints(dataType: string): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("POST", `${this.userPath()}/${dataType}:reconcile`, {});
  }

  // Rollups
  async dailyRollup(opts: RollupOptions = {}): Promise<JsonRecord> {
    const params: Record<string, string> = {};
    if (opts.startTime) params["startTime"] = opts.startTime;
    if (opts.endTime) params["endTime"] = opts.endTime;
    if (opts.dataTypes?.length) params["dataTypes"] = opts.dataTypes.join(",");
    return this.doJSON<JsonRecord>("GET", `${this.userPath()}/rollups:daily`, undefined, params);
  }

  async physicalRollup(opts: RollupOptions = {}): Promise<JsonRecord> {
    const params: Record<string, string> = {};
    if (opts.startTime) params["startTime"] = opts.startTime;
    if (opts.endTime) params["endTime"] = opts.endTime;
    if (opts.dataTypes?.length) params["dataTypes"] = opts.dataTypes.join(",");
    return this.doJSON<JsonRecord>("GET", `${this.userPath()}/rollups:physical`, undefined, params);
  }

  // Exercise TCX export
  async exportExerciseTCX(sessionId: string): Promise<Buffer> {
    return this.doBytes("GET", `${this.userPath()}/exerciseSessions/${encodeURIComponent(sessionId)}:exportTcx`);
  }

  // Subscribers
  async listSubscribers(opts: SubscriberListOptions = {}): Promise<JsonRecord> {
    const params: Record<string, string> = {};
    if (opts.pageSize) params["pageSize"] = String(opts.pageSize);
    if (opts.pageToken) params["pageToken"] = opts.pageToken;
    return this.doJSON<JsonRecord>("GET", `${this.projectPath()}/subscribers`, undefined, params);
  }

  async createSubscriber(body: CreateSubscriberOptions): Promise<JsonRecord> {
    return this.doJSON<JsonRecord>("POST", `${this.projectPath()}/subscribers`, body);
  }

  async patchSubscriber(subscriberId: string, body: JsonRecord, updateMask?: string): Promise<JsonRecord> {
    const params = updateMask ? { updateMask } : undefined;
    return this.doJSON<JsonRecord>(
      "PATCH",
      `${this.projectPath()}/subscribers/${encodeURIComponent(subscriberId)}`,
      body,
      params,
    );
  }

  async deleteSubscriber(subscriberId: string): Promise<void> {
    await this.doJSON<void>("DELETE", `${this.projectPath()}/subscribers/${encodeURIComponent(subscriberId)}`);
  }

  // Raw API access
  async rawRequest(method: string, path: string, body?: JsonRecord, params?: Record<string, string>): Promise<JsonRecord> {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return this.doJSON<JsonRecord>(method.toUpperCase(), cleanPath, body, params);
  }
}
