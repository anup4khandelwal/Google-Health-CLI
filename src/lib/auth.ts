import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { getTokenFilePath, loadConfig } from "./config.js";

export interface Token {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

export interface AuthStatus {
  loggedIn: boolean;
  scopes?: string[];
  expiresAt?: Date;
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function randomState(): string {
  return base64url(randomBytes(16));
}

export function loadToken(): Token | null {
  const tokenFile = getTokenFilePath();
  if (!existsSync(tokenFile)) return null;
  try {
    const raw = readFileSync(tokenFile, "utf8");
    return JSON.parse(raw) as Token;
  } catch {
    return null;
  }
}

export function saveToken(token: Token): void {
  const tokenFile = getTokenFilePath();
  writeFileSync(tokenFile, JSON.stringify(token, null, 2), { mode: 0o600 });
}

export function revokeLocal(): void {
  const tokenFile = getTokenFilePath();
  if (existsSync(tokenFile)) unlinkSync(tokenFile);
}

export async function revokeRemote(token: Token): Promise<void> {
  const target = token.refresh_token ?? token.access_token;
  const res = await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `token=${encodeURIComponent(target)}`,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Revoke failed: ${res.status} ${body}`);
  }
}

export function currentStatus(): AuthStatus {
  const token = loadToken();
  if (!token) return { loggedIn: false };

  const scopes = token.scope ? token.scope.split(" ") : undefined;
  const expiresAt = token.expires_at ? new Date(token.expires_at * 1000) : undefined;
  return { loggedIn: true, scopes, expiresAt };
}

export function buildAuthUrl(
  clientId: string,
  redirectUrl: string,
  scopes: string[],
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUrl,
    response_type: "code",
    scope: scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(
  code: string,
  verifier: string,
  clientId: string,
  clientSecret: string,
  redirectUrl: string,
): Promise<Token> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUrl,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  const token: Token = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    scope: data.scope,
    expires_at: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : undefined,
  };

  return token;
}

export async function refreshToken(token: Token, clientId: string, clientSecret: string): Promise<Token> {
  if (!token.refresh_token) throw new Error("No refresh token available");

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  };

  const refreshed: Token = {
    ...token,
    access_token: data.access_token,
    token_type: data.token_type ?? token.token_type,
    scope: data.scope ?? token.scope,
    expires_at: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : token.expires_at,
  };

  saveToken(refreshed);
  return refreshed;
}

/** Force-refresh the stored token regardless of expiry. */
export async function forceRefresh(): Promise<Token> {
  const cfg = loadConfig();
  const token = loadToken();
  if (!token) throw new NotLoggedInError("Not logged in. Run: ghealth auth login");
  return refreshToken(token, cfg.clientId, cfg.clientSecret);
}

export async function getValidToken(): Promise<Token> {
  const cfg = loadConfig();
  const token = loadToken();
  if (!token) throw new NotLoggedInError("Not logged in. Run: ghealth auth login");

  const now = Math.floor(Date.now() / 1000);
  if (token.expires_at && token.expires_at - now < 60) {
    return await refreshToken(token, cfg.clientId, cfg.clientSecret);
  }

  return token;
}

export class NotLoggedInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotLoggedInError";
  }
}

export function isNotLoggedIn(err: unknown): err is NotLoggedInError {
  return err instanceof NotLoggedInError;
}

export interface LoginOptions {
  scopes?: string[];
  noBrowser?: boolean;
  redirectUrl?: string;
  timeoutMs?: number;
}

export async function login(
  clientId: string,
  clientSecret: string,
  options: LoginOptions = {},
): Promise<Token> {
  const cfg = loadConfig();
  const redirectUrl = options.redirectUrl ?? cfg.redirectUrl;
  const scopes = options.scopes?.length ? options.scopes : cfg.scopes;
  const timeoutMs = options.timeoutMs ?? 120_000;

  const { verifier, challenge } = generatePKCE();
  const state = randomState();

  const authUrl = buildAuthUrl(clientId, redirectUrl, scopes, state, challenge);

  const callbackUrl = new URL(redirectUrl);
  const port = parseInt(callbackUrl.port || "80", 10);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out"));
    }, timeoutMs);

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (!req.url?.startsWith(callbackUrl.pathname)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const url = new URL(req.url, `http://localhost:${port}`);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Authentication failed: ${error}</h1><p>You can close this tab.</p>`);
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Invalid callback</h1><p>You can close this tab.</p>");
        clearTimeout(timeout);
        server.close();
        reject(new Error("Invalid OAuth callback: state mismatch or missing code"));
        return;
      }

      try {
        const token = await exchangeCode(code, verifier, clientId, clientSecret, redirectUrl);
        saveToken(token);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authenticated successfully!</h1><p>You can close this tab.</p>");
        clearTimeout(timeout);
        server.close();
        resolve(token);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("<h1>Token exchange failed</h1><p>You can close this tab.</p>");
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
    });

    server.listen(port, "localhost", async () => {
      if (!options.noBrowser) {
        try {
          const { default: open } = await import("open");
          await open(authUrl);
        } catch {
          // ignore open errors
        }
      }
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
