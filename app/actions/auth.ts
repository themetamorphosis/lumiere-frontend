"use server";

import { apiErrorMessage } from "@/lib/apiError";
import { authedFetch, publicFetch, SERVER_API_BASE } from "@/lib/serverFetch";
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/session";

export async function getSession() {
  try {
    const res = await authedFetch(`/auth/me`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function logout() {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();
  try {
    await fetch(`${SERVER_API_BASE}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Cookie: `${ACCESS_COOKIE}=${accessToken}` } : {}),
      },
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : null),
      signal: AbortSignal.timeout(10_000),
    });
  } finally {
    await clearSessionCookies();
  }
}

export async function login(prevState: unknown, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);

    const res = await publicFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      if ([400, 401].includes(res.status)) return { error: "Invalid email or password." };
      if (res.status === 429) return { error: "Too many attempts. Try again in a minute." };
      return { error: "Sign-in is temporarily unavailable. Please try again." };
    }

    const data = await res.json();

    // Persist the refresh token too — without it the session simply dies when
    // the access token expires, with no way to renew.
    await setSessionCookies(data);

    return { success: true };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }
}

export async function register(
  _prevState: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean; accountCreated?: boolean }> {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" || !email.trim() ||
    typeof password !== "string" || !password ||
    typeof confirmPassword !== "string" || !confirmPassword
  ) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  let response: Response;
  try {
    response = await publicFetch("/auth/register?create_session=true", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    });
  } catch {
    return { error: "Could not confirm registration. Try signing in if you already submitted the form." };
  }
  if (!response.ok) {
    if (response.status === 400) {
      return { error: "This email already has an account. Sign in or reset your password." };
    }
    if (response.status === 429) return { error: "Too many attempts. Try again in a minute." };
    if (response.status === 422) {
      return { error: await apiErrorMessage(response, "Check your registration details and try again.") };
    }
    return { error: "Registration is temporarily unavailable. Please try again." };
  }

  try {
    const { session } = await response.json();
    if (typeof session?.access_token === "string" && session.access_token &&
        typeof session?.refresh_token === "string" && session.refresh_token) {
      await setSessionCookies(session);
      return { success: true };
    }
  } catch {
    // The account was already created even if the session could not be saved.
  }
  return { accountCreated: true };
}

export async function requestPasswordReset(_state: unknown, formData: FormData) {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.trim()) return { error: "Enter your email address." };
  try {
    const res = await publicFetch("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email: email.trim() }),
    });
    if (res.ok) return { success: true };
    if (res.status === 422) return { error: "Enter a valid email address." };
    if (res.status === 429) return { error: "Too many requests. Try again in a minute." };
  } catch {
    // Keep transport details on the server.
  }
  return { error: "Password recovery is temporarily unavailable. Please try again." };
}

export async function confirmPasswordReset(formData: FormData) {
  const token = formData.get("token");
  const password = formData.get("password");
  if (typeof token !== "string" || !token) return { error: "Request a new reset link to continue." };
  if (typeof password !== "string" || password !== formData.get("confirmPassword")) {
    return { error: "Passwords do not match." };
  }
  try {
    const res = await publicFetch("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) {
      await clearSessionCookies();
      return { success: true };
    }
    if (res.status === 400) return { error: "This reset link is invalid or expired. Request a new link." };
    if (res.status === 422) {
      const { detail } = await res.json();
      return { error: typeof detail === "string" ? detail : "Choose a valid password." };
    }
    if (res.status === 429) return { error: "Too many attempts. Try again in a minute." };
  } catch {
    // Keep transport details on the server.
  }
  return { error: "Password recovery is temporarily unavailable. Please try again." };
}
