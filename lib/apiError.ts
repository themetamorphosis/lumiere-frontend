/** Shown whenever the session is gone, in place of any backend wording. */
export const SESSION_EXPIRED = "Your session expired. Sign in again to continue.";

/**
 * Pull a human-readable message out of a FastAPI error body.
 *
 * `detail` is a string for our own HTTPExceptions but an array of error objects
 * for Pydantic validation failures — and the rules users trip over most (slug
 * format, handle format, empty message) live in field validators, so the
 * message that matters arrives in the array form.
 */
export async function apiErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  // A 401 here means authedFetch already tried to refresh and failed, so the
  // session is genuinely gone. The backend's own wording for this is "Could
  // not validate credentials", which read as a validation failure on whatever
  // field the user was editing — it told them their handle was wrong when the
  // real answer was "sign in again".
  if (res.status === 401) {
    return SESSION_EXPIRED;
  }

  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const msg = detail[0]?.msg;
      if (typeof msg === "string") {
        // Pydantic prefixes messages raised from a validator.
        return msg.replace(/^Value error,\s*/, "");
      }
    }
  } catch {
    // Not JSON — a proxy error page, most likely.
  }
  return fallback;
}
