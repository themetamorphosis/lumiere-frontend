import { API_BASE } from "@/lib/auth";
import {
  ACCESS_COOKIE,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/session";

/** Without this a hung backend holds a server render open until the platform kills it. */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Endpoints where a 401 is a real answer, not an expired-token signal. */
function isAuthEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes("/auth/login") ||
    endpoint.includes("/auth/register") ||
    endpoint.includes("/auth/refresh")
  );
}

/**
 * Exchange the refresh token for a new token pair and persist both.
 *
 * The backend rotates refresh tokens and invalidates the old family on reuse,
 * so the new pair *must* be stored. Callers are Server Actions, where cookies
 * are writable; if a write ever fails we return null rather than leaving the
 * caller holding a token we couldn't persist.
 */
/**
 * In-flight refresh, shared by concurrent callers.
 *
 * The backend rotates the refresh-token family on every use and treats a stale
 * family as a replay attack, revoking everything. Two server actions that 401
 * at the same moment — routine, since a page fires several in parallel — would
 * both POST the same token: the first rotates, the second trips reuse detection
 * and logs the user out. Coalescing collapses that to one exchange.
 *
 * Per server instance, so this narrows the window rather than closing it;
 * closing it needs shared state, which arrives with Redis in Phase 4.
 */
let inFlightRefresh: Promise<string | null> | null = null;

function refreshSession(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/** Test seam: module state would otherwise leak between cases. */
export function __resetRefreshState() {
  inFlightRefresh = null;
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.access_token) return null;

    await setSessionCookies(data);
    return data.access_token as string;
  } catch {
    return null;
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

export async function authedFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const token = await getAccessToken();

  const send = (t?: string) =>
    fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      ...options,
      headers: buildHeaders(options, t),
    });

  const res = await send(token);

  // A 401 on a normal endpoint means the access token expired. Refresh once
  // and replay. FormData bodies are single-use streams, so they can't be
  // safely replayed and are left alone.
  if (
    res.status === 401 &&
    !isAuthEndpoint(endpoint) &&
    !(options.body instanceof FormData)
  ) {
    const renewed = await refreshSession();
    if (renewed) return send(renewed);
  }

  return res;
}
