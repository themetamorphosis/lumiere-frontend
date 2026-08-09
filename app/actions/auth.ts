"use server";

import { authedFetch } from "@/lib/serverFetch";
import { API_BASE } from "@/lib/auth";
import { clearSessionCookies, setSessionCookies } from "@/lib/session";

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
  // Revoke server-side first so the refresh-token family is invalidated, then
  // drop the cookies. A failure here must not block local sign-out.
  try {
    await authedFetch(`/auth/logout`, { method: "POST" });
  } catch {
    // ignore — cookies are cleared regardless
  }
  await clearSessionCookies();
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

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      return { error: "Invalid email or password." };
    }

    const data = await res.json();

    // Persist the refresh token too — without it the session simply dies when
    // the access token expires, with no way to renew.
    await setSessionCookies(data);

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    };
  }
}

export async function register(
  prevState: unknown,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!name || !email || !password || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { error: err.detail || "An error occurred during registration." };
    }

    return login(prevState, formData);
  } catch (error) {
    console.error("Registration error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    };
  }
}
