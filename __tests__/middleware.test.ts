import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function request(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(new URL(`http://localhost:3000${path}`));
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value);
  }
  return req;
}

describe("auth middleware", () => {
  it("redirects to /login when no tokens are present", () => {
    const res = middleware(request("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("allows a request carrying an access token", () => {
    const res = middleware(request("/dashboard", { auth_token: "a" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows a request with only a refresh token", () => {
    // The access token expires after 24h while the refresh token lasts 7 days.
    // Bouncing here would log users out despite a renewable session.
    const res = middleware(request("/dashboard", { refresh_token: "r" }));
    expect(res.headers.get("location")).toBeNull();
  });

  it("protects every configured private route", () => {
    for (const path of [
      "/dashboard",
      "/library/movies",
      "/wishlist/tv",
      "/discovery",
      "/profile",
      "/social",
      "/ai",
    ]) {
      const res = middleware(request(path));
      expect(res.headers.get("location"), `${path} should redirect`).toBe(
        "http://localhost:3000/login",
      );
    }
  });
});
