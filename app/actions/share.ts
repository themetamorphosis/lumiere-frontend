"use server";

import { authedFetch } from "@/lib/serverFetch";
import type { MediaType, ShareLink, Status } from "@/lib/types";
import { safeParseShareLinks } from "@/lib/validators";
import { apiErrorMessage } from "@/lib/apiError";

export type ShareLinkInput = {
  slug?: string;
  label?: string;
  statuses?: Status[];
  mediaTypes?: MediaType[];
  favoritesOnly?: boolean;
};

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
    return { error: await apiErrorMessage(res, "Could not create the link.") };
  }
  return { success: true };
}

export async function updateShareLink(id: string, input: ShareLinkInput) {
  const res = await authedFetch(`/share/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { error: await apiErrorMessage(res, "Could not update the link.") };
  }
  return { success: true };
}

export async function deleteShareLink(id: string) {
  const res = await authedFetch(`/share/${id}`, { method: "DELETE" });
  if (!res.ok) {
    return { error: await apiErrorMessage(res, "Could not revoke the link.") };
  }
  return { success: true };
}
