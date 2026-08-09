import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // `config.matcher` below already scopes this to authenticated routes, so the
  // public-path / static-asset branches that used to live here were unreachable.
  const token = request.cookies.get("auth_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // A missing access token is not enough to bounce the user: the access token
  // expires after 24h while the refresh token is valid for 7 days, and
  // authedFetch renews on the first 401.
  if (!token && !refreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/library/:path*",
    "/wishlist/:path*",
    "/discovery/:path*",
    "/profile/:path*",
    "/social/:path*",
    "/ai/:path*",
  ],
};
