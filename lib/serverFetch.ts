import { setTimeout } from "node:timers";
import { API_BASE } from "@/lib/auth";
import {
  ACCESS_COOKIE,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/session";

/** Without this a hung backend holds a server render open until the platform kills it. */
const DEFAULT_TIMEOUT_MS = 10_000;
export const SERVER_API_BASE = process.env.API_URL || API_BASE;

/** Endpoints where a 401 is a real answer, not an expired-token signal. */
function isAuthEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/register") ||
    endpoint.includes("/auth/refresh")
  );
}

type TokenPair = { access_token: string; refresh_token: string };
type RefreshResult = { tokens: TokenPair } | { unavailable: boolean };
type RefreshExchange = {
  pending: Promise<RefreshResult>;
  completedAt?: number;
};

// Next can load route handlers and server actions in separate bundles within
// the same process. Each exchange is isolated by the original credential.
const runtime = globalThis as typeof globalThis & {
  lumiereRefreshExchanges?: Map<string, RefreshExchange>;
};
const refreshExchanges = (runtime.lumiereRefreshExchanges ??= new Map());

function refreshSession(refreshToken: string, requestStarted: number): Promise<RefreshResult> {
  const current = refreshExchanges.get(refreshToken);
  if (current && (current.completedAt === undefined || requestStarted <= current.completedAt)) {
    return current.pending;
  }
  const exchange: RefreshExchange = { pending: performRefresh(refreshToken) };
  refreshExchanges.set(refreshToken, exchange);
  void exchange.pending.then(() => {
    exchange.completedAt = performance.now();
    // A request already underway may receive its 401 after the rotation.
    // Requests started after it complete a new exchange instead.
    setTimeout(() => {
      if (refreshExchanges.get(refreshToken) === exchange) refreshExchanges.delete(refreshToken);
    }, DEFAULT_TIMEOUT_MS).unref();
  });
  return exchange.pending;
}

async function performRefresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch(`${SERVER_API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return { unavailable: res.status !== 401 };
    const tokens = await res.json();
    if (typeof tokens?.access_token !== "string" || typeof tokens?.refresh_token !== "string") {
      return { unavailable: true };
    }
    return { tokens };
  } catch {
    return { unavailable: true };
  }
}

function buildHeaders(options: RequestInit, token?: string): Headers {
  const headers = new Headers(options.headers || {});

  if (
    options.method &&
    ["POST", "PATCH", "PUT"].includes(options.method.toUpperCase())
  ) {
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  }

  if (token) headers.set("Cookie", `${ACCESS_COOKIE}=${token}`);

  return headers;
}

/**
 * Fetch an endpoint that requires no session.
 *
 * Separate from `authedFetch` on purpose: the share pages are rendered for
 * anonymous visitors, and attaching the *renderer's* cookie there would mean a
 * logged-in owner previewing their own link sees a different response than the
 * public does — which is exactly the bug that makes a leak invisible in
 * testing. Nothing here reads or writes cookies.
 */
export async function publicFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${SERVER_API_BASE}${endpoint}`;
  return fetch(url, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    ...options,
    headers: buildHeaders(options),
  });
}

export async function authedFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const { response } = await fetchWithSession(endpoint, options);
  return response;
}

export async function fetchWithSession(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ response: Response; accessToken?: string }> {
  const requestStarted = performance.now();
  const url = endpoint.startsWith("http") ? endpoint : `${SERVER_API_BASE}${endpoint}`;
  const token = await getAccessToken();

  const send = (t?: string) =>
    fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      ...options,
      headers: buildHeaders(options, t),
    });

  const res = await send(token);
  const body = options.body;
  const streaming = body && typeof body === "object" && "getReader" in body;

  // Rebuild the request after a 401. A raw stream can't be read twice.
  if (
    res.status === 401 &&
    !isAuthEndpoint(endpoint) &&
    !streaming
  ) {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return { response: res };
    const result = await refreshSession(refreshToken, requestStarted);
    if ("tokens" in result) {
      await setSessionCookies(result.tokens);
      const accessToken = result.tokens.access_token;
      return { response: await send(accessToken), accessToken };
    }
    if (result.unavailable) {
      return { response: Response.json({ detail: "Session service temporarily unavailable" }, { status: 503 }) };
    }
  }

  return { response: res, accessToken: token };
}
