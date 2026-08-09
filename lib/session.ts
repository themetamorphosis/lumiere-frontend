import "server-only";

/**
 * Auth cookie handling, shared by the login/logout actions and the refresh
 * path in serverFetch so the three can't drift apart.
 *
 * The backend issues an access token plus a rotating refresh token, but the
 * frontend used to read only `access_token` and drop the refresh token on the
 * floor — so every session died at the 24h access-token expiry with no way to
 * renew. Both are now persisted.
 */

export const ACCESS_COOKIE = "auth_token";
export const REFRESH_COOKIE = "refresh_token";

// Mirror the backend: ACCESS_TOKEN_EXPIRE_MINUTES (24h) and
// REFRESH_TOKEN_EXPIRE_DAYS (7d).
const ACCESS_MAX_AGE = 60 * 60 * 24;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge: number;
};

function options(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  };
}

export async function setSessionCookies(tokens: {
  access_token: string;
  refresh_token?: string;
}): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_COOKIE, tokens.access_token, options(ACCESS_MAX_AGE));

  if (tokens.refresh_token) {
    cookieStore.set(
      REFRESH_COOKIE,
      tokens.refresh_token,
      options(REFRESH_MAX_AGE),
    );
  }
}

export async function clearSessionCookies(): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
