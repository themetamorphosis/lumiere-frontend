"use server";

import { authedFetch } from "@/lib/serverFetch";
import type { MediaType, ShareLink, Status } from "@/lib/types";
import { safeParseShareLinks } from "@/lib/validators";

export type ShareLinkInput = {
  slug?: string;
  label?: string;
  statuses?: Status[];
  mediaTypes?: MediaType[];
  favoritesOnly?: boolean;
};

/**
 * Pull a human-readable message out of a FastAPI error body.
 *
 * `detail` is a string for our own HTTPExceptions but an array of error objects
 * for Pydantic validation failures — and the slug rules live in a validator, so
 * the message a user most needs to see arrives in the array form.
 */
async function errorMessage(res: Response, fallback: string): Promise<string> {
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
    // Fall through to the generic message.
  }
  return fallback;
}

function normalize(links: ShareLink[]): ShareLink[] {
  return links.map((link) => ({ ...link, label: link.label ?? undefined }));
}

export async function getShareLinks(): Promise<ShareLink[]> {
  const res = await authedFetch("/share", { cache: "no-store" });
  if (!res.ok) return [];

  const parsed = safeParseShareLinks(await res.json());
  if (!parsed.success) {
    console.error("Share links validation failed:", parsed.error);
    return [];
  }
  return normalize(parsed.data.links as ShareLink[]);
}

export async function createShareLink(input: ShareLinkInput) {
  const res = await authedFetch("/share", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { error: await errorMessage(res, "Could not create the link.") };
  }
  return { success: true };
}

export async function updateShareLink(id: string, input: ShareLinkInput) {
  const res = await authedFetch(`/share/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { error: await errorMessage(res, "Could not update the link.") };
  }
  return { success: true };
}

export async function deleteShareLink(id: string) {
  const res = await authedFetch(`/share/${id}`, { method: "DELETE" });
  if (!res.ok) {
    return { error: await errorMessage(res, "Could not revoke the link.") };
  }
  return { success: true };
}
