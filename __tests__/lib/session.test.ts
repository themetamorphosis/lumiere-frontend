import { describe, it, expect, vi, beforeEach } from "vitest";

const store = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => store),
}));

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/session";

describe("session cookies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists both access and refresh tokens", async () => {
    await setSessionCookies({
      access_token: "a-token",
      refresh_token: "r-token",
    });

    const names = store.set.mock.calls.map((c) => c[0]);
    expect(names).toContain(ACCESS_COOKIE);
    expect(names).toContain(REFRESH_COOKIE);
  });

  it("stores the refresh token that used to be discarded", async () => {
    await setSessionCookies({ access_token: "a", refresh_token: "r" });

    const refreshCall = store.set.mock.calls.find(
      (c) => c[0] === REFRESH_COOKIE,
    );
    expect(refreshCall?.[1]).toBe("r");
  });

  it("marks auth cookies httpOnly and sameSite=strict", async () => {
    await setSessionCookies({ access_token: "a", refresh_token: "r" });

    for (const call of store.set.mock.calls) {
      expect(call[2]).toMatchObject({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      });
    }
  });

  it("gives the refresh cookie a longer lifetime than the access cookie", async () => {
    await setSessionCookies({ access_token: "a", refresh_token: "r" });

    const access = store.set.mock.calls.find((c) => c[0] === ACCESS_COOKIE);
    const refresh = store.set.mock.calls.find((c) => c[0] === REFRESH_COOKIE);
    expect(refresh?.[2].maxAge).toBeGreaterThan(access?.[2].maxAge);
  });

  it("tolerates a response with no refresh token", async () => {
    await setSessionCookies({ access_token: "only-access" });

    const names = store.set.mock.calls.map((c) => c[0]);
    expect(names).toContain(ACCESS_COOKIE);
    expect(names).not.toContain(REFRESH_COOKIE);
  });

  it("clears both cookies on sign-out", async () => {
    await clearSessionCookies();

    const deleted = store.delete.mock.calls.map((c) => c[0]);
    expect(deleted).toEqual(
      expect.arrayContaining([ACCESS_COOKIE, REFRESH_COOKIE]),
    );
  });

  it("reads tokens back out of the cookie store", async () => {
    store.get.mockImplementation((name: string) =>
      name === ACCESS_COOKIE ? { value: "av" } : { value: "rv" },
    );

    expect(await getAccessToken()).toBe("av");
    expect(await getRefreshToken()).toBe("rv");
  });

  it("returns undefined when a cookie is absent", async () => {
    store.get.mockReturnValue(undefined);
    expect(await getAccessToken()).toBeUndefined();
  });
});
