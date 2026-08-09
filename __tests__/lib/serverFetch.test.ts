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

import { authedFetch } from "@/lib/serverFetch";

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
        .mockResolvedValueOnce(res(200, { access_token: "access-2" })) // refresh
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
        .mockResolvedValueOnce(res(200, { access_token: "access-2" }))
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

    it("does not replay FormData bodies, which are single-use streams", async () => {
      fetchMock.mockResolvedValueOnce(res(401));

      const out = await authedFetch("/upload", {
        method: "POST",
        body: new FormData(),
      });

      expect(out.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("survives a network error during refresh", async () => {
      fetchMock
        .mockResolvedValueOnce(res(401))
        .mockRejectedValueOnce(new Error("network down"));

      const out = await authedFetch("/watchlist");
      expect(out.status).toBe(401);
    });
  });
});
