import { API_BASE, signOut } from "@/lib/auth";

const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

    const headers = new Headers(options.headers || {});

    // Default to JSON if method is POST/PATCH/PUT and no content-type is set
    if (options.method && ["POST", "PATCH", "PUT"].includes(options.method.toUpperCase())) {
        if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }
    }

    const res = await fetch(url, {
        // Callers that pass their own signal (e.g. AbortController for cancellable
        // row fetches) override this via the spread below.
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        ...options,
        headers,
        credentials: "include",
    });

    if (res.status === 401) {
        if (!url.includes("/auth/login") && !url.includes("/auth/register")) {
            await signOut();
        }
    }

    return res;
}
