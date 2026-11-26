import { ReadableStream as NodeReadableStream } from "node:stream/web";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockSession = {
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  setSessionCookies: vi.fn(),
};

vi.mock("@/lib/session", () => ({
  ACCESS_COOKIE: "auth_token",
  REFRESH_COOKIE: "refresh_token",
  getAccessToken: () => mockSession.getAccessToken(),
  getRefreshToken: () => mockSession.getRefreshToken(),
  setSessionCookies: (t: unknown) => mockSession.setSessionCookies(t),
}));

import {
  authedFetch,
  publicFetch,
} from "@/lib/serverFetch";

function res(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("authedFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockSession.getAccessToken.mockResolvedValue("access-1");
    mockSession.getRefreshToken.mockResolvedValue("refresh-1");
  });

  it("attaches the access token as a cookie header", async () => {
    fetchMock.mockResolvedValue(res(200));
    await authedFetch("/watchlist");

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Cookie")).toBe("auth_token=access-1");
  });

  it("sets a request timeout so a hung backend can't stall the render", async () => {
    fetchMock.mockResolvedValue(res(200));
    await authedFetch("/watchlist");

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("defaults JSON content-type on mutations", async () => {
    fetchMock.mockResolvedValue(res(200));
    await authedFetch("/watchlist", { method: "POST", body: "{}" });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not force JSON content-type for FormData", async () => {
    fetchMock.mockResolvedValue(res(200));
    await authedFetch("/upload", { method: "POST", body: new FormData() });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("passes through a successful response untouched", async () => {
    fetchMock.mockResolvedValue(res(200, { ok: true }));
    const out = await authedFetch("/watchlist");

    expect(out.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  describe("refresh on 401", () => {
    it("refreshes and replays the original request", async () => {
      fetchMock
        .mockResolvedValueOnce(res(401)) // original
        .mockResolvedValueOnce(res(200, { access_token: "access-2", refresh_token: "refresh-2" })) // refresh
        .mockResolvedValueOnce(res(200, { items: [] })); // replay

      const out = await authedFetch("/watchlist");

      expect(out.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("persists the rotated token pair", async () => {
      fetchMock
        .mockResolvedValueOnce(res(401))
        .mockResolvedValueOnce(
          res(200, { access_token: "access-2", refresh_token: "refresh-2" }),
        )
        .mockResolvedValueOnce(res(200));

      await authedFetch("/watchlist");

      expect(mockSession.setSessionCookies).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: "access-2",
          refresh_token: "refresh-2",
        }),
      );
    });

    it("replays with the new access token, not the stale one", async () => {
      fetchMock
        .mockResolvedValueOnce(res(401))
        .mockResolvedValueOnce(res(200, { access_token: "access-2", refresh_token: "refresh-2" }))
        .mockResolvedValueOnce(res(200));

      await authedFetch("/watchlist");

      const replayHeaders = fetchMock.mock.calls[2][1].headers as Headers;
      expect(replayHeaders.get("Cookie")).toBe("auth_token=access-2");
    });

    it("gives up when there is no refresh token", async () => {
      mockSession.getRefreshToken.mockResolvedValue(undefined);
      fetchMock.mockResolvedValueOnce(res(401));

      const out = await authedFetch("/watchlist");

      expect(out.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("returns the 401 when refresh itself is rejected", async () => {
      fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(401)); // refresh refused

      const out = await authedFetch("/watchlist");

      expect(out.status).toBe(401);
      expect(mockSession.setSessionCookies).not.toHaveBeenCalled();
    });

    it("does not retry auth endpoints, where 401 is a real answer", async () => {
      fetchMock.mockResolvedValueOnce(res(401));

      const out = await authedFetch("/auth/login", { method: "POST" });

      expect(out.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not replay a streaming request body", async () => {
      fetchMock.mockResolvedValueOnce(res(401));

      const out = await authedFetch("/upload", {
        method: "POST",
        body: new NodeReadableStream() as unknown as ReadableStream,
      });

      expect(out.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("survives a network error during refresh", async () => {
      fetchMock
        .mockResolvedValueOnce(res(401))
        .mockRejectedValueOnce(new Error("network down"));

      const out = await authedFetch("/watchlist");
      expect(out.status).toBe(503);
    });
  });

  describe("concurrent refresh", () => {
    /** Count calls to the rotating refresh endpoint. */
    function refreshCalls() {
      return fetchMock.mock.calls.filter(
        ([url]) => typeof url === "string" && url.includes("/auth/refresh"),
      ).length;
    }

    it("exchanges the refresh token once for simultaneous 401s", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/auth/refresh")) {
          await new Promise((r) => setTimeout(r, 10));
          return res(200, {
            access_token: "access-2",
            refresh_token: "refresh-2",
          });
        }
        return res(401);
      });

      await Promise.all([
        authedFetch("/watchlist"),
        authedFetch("/auth/me"),
        authedFetch("/watchlist/stats"),
      ]);

      expect(refreshCalls()).toBe(1);
      expect(mockSession.setSessionCookies).toHaveBeenCalledTimes(3);
    });

    it("keeps simultaneous refreshes for two accounts isolated", async () => {
      mockSession.getAccessToken
        .mockResolvedValueOnce("access-a")
        .mockResolvedValueOnce("access-b");
      mockSession.getRefreshToken
        .mockResolvedValueOnce("refresh-a")
        .mockResolvedValueOnce("refresh-b");
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          const suffix = JSON.parse(init.body as string).refresh_token.slice(-1);
          await new Promise((resolve) => setTimeout(resolve, 10));
          return res(200, {
            access_token: `renewed-${suffix}`,
            refresh_token: `rotated-${suffix}`,
          });
        }
        const cookie = (init.headers as Headers).get("Cookie")!;
        if (!cookie.startsWith("auth_token=renewed-")) return res(401);
        return res(200, { account: cookie.slice(-1) });
      });

      const [a, b] = await Promise.all([
        authedFetch("/watchlist"),
        authedFetch("/auth/me"),
      ]);
      expect(await a.json()).toEqual({ account: "a" });
      expect(await b.json()).toEqual({ account: "b" });
      expect(refreshCalls()).toBe(2);
    });

    it("gives every waiter the renewed token", async () => {
      let attempt = 0;
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        if (url.includes("/auth/refresh")) {
          await new Promise((r) => setTimeout(r, 10));
          return res(200, {
            access_token: "access-2",
            refresh_token: "refresh-2",
          });
        }
        attempt += 1;
        const cookie = (init.headers as Headers).get("Cookie");
        // First pass for each caller carries the stale token and 401s.
        return cookie === "auth_token=access-2"
          ? res(200, { ok: true })
          : res(401);
      });

      const results = await Promise.all([
        authedFetch("/watchlist"),
        authedFetch("/auth/me"),
      ]);

      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(refreshCalls()).toBe(1);
      expect(attempt).toBe(4); // two initial 401s, two successful replays
    });

    it("reuses an exchange for a request whose 401 arrives after rotation", async () => {
      let releaseLateRequest!: () => void;
      const lateRequest = new Promise<void>((resolve) => { releaseLateRequest = resolve; });
      fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          return res(200, { access_token: "access-2", refresh_token: "refresh-2" });
        }
        if ((init.headers as Headers).get("Cookie") === "auth_token=access-2") return res(200);
        if (url.endsWith("/auth/me")) await lateRequest;
        return res(401);
      });

      const first = authedFetch("/watchlist");
      const late = authedFetch("/auth/me");
      expect((await first).status).toBe(200);
      releaseLateRequest();
      expect((await late).status).toBe(200);
      expect(refreshCalls()).toBe(1);
    });

    it("starts a fresh exchange after the previous one settles", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/auth/refresh")) {
          return res(200, {
            access_token: "access-2",
            refresh_token: "refresh-2",
          });
        }
        return res(401);
      });

      await authedFetch("/watchlist");
      await authedFetch("/watchlist");

      // Sequential calls are two separate expiries, not a race.
      expect(refreshCalls()).toBe(2);
    });

    it("does not strand waiters when the refresh fails", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes("/auth/refresh")) return res(401);
        return res(401);
      });

      const results = await Promise.all([
        authedFetch("/watchlist"),
        authedFetch("/auth/me"),
      ]);

      expect(results.every((r) => r.status === 401)).toBe(true);
      expect(refreshCalls()).toBe(1);
    });
  });
});

describe("publicFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockSession.getAccessToken.mockResolvedValue("access-1");
    mockSession.getRefreshToken.mockResolvedValue("refresh-1");
  });

  it("never attaches the renderer's session cookie", async () => {
    fetchMock.mockResolvedValue(res(200));
    await publicFetch("/public/watchlist/noor");

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    // A logged-in owner previewing their own share link must get exactly the
    // response a stranger gets, or a leak is invisible in testing.
    expect(headers.get("Cookie")).toBeNull();
    expect(mockSession.getAccessToken).not.toHaveBeenCalled();
  });

  it("does not try to refresh on a 401", async () => {
    fetchMock.mockResolvedValue(res(401));
    const result = await publicFetch("/public/watchlist/noor");

    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sets a request timeout", async () => {
    fetchMock.mockResolvedValue(res(200));
    await publicFetch("/public/watchlist/noor");

    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
