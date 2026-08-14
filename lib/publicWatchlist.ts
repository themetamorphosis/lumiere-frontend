import "server-only";

import { cache } from "react";
import { publicFetch } from "@/lib/serverFetch";
import type { PublicItem, PublicWatchlist } from "@/lib/types";
import {
  safeParsePublicWatchlist,
  type PublicWatchlistItemPayload,
} from "@/lib/validators";

/** The backend caps `limit` at 200. */
const PAGE_SIZE = 200;

/** Stops a malformed `has_more` from looping forever. 25 pages = 5k items. */
const MAX_PAGES = 25;

/**
 * Load a shared watchlist for an anonymous visitor.
 *
 * Not a Server Action: the share page is a server component reading data, and
 * a "use server" export would publish this as a callable POST endpoint for no
 * reason. Returns null when the slug is unknown or revoked, which the page
 * turns into a 404.
 *
 * Memoized per request because `generateMetadata` and the page component both
 * need it; the responses are `no-store`, so without this every share page
 * would fetch the whole list twice.
 */
export const getPublicWatchlist = cache(async function getPublicWatchlist(
  slug: string,
): Promise<PublicWatchlist | null> {
  let head: Omit<PublicWatchlist, "items"> | null = null;
  const items: PublicItem[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;

    let res: Response;
    try {
      res = await publicFetch(
        `/public/watchlist/${encodeURIComponent(slug)}?limit=${PAGE_SIZE}&offset=${offset}`,
        { cache: "no-store" },
      );
    } catch {
      return null;
    }

    if (!res.ok) return head ? { ...head, items } : null;

    const parsed = safeParsePublicWatchlist(await res.json());
    if (!parsed.success) {
      console.error("Public watchlist validation failed:", parsed.error);
      return head ? { ...head, items } : null;
    }

    const data = parsed.data;
    if (!head) {
      head = {
        slug: data.slug,
        label: data.label ?? undefined,
        owner: {
          name: data.owner.name ?? undefined,
          image: data.owner.image ?? undefined,
        },
        filters: data.filters,
        total: data.total,
      };
    }

    items.push(...data.items.map(toPublicItem));

    if (!data.has_more || data.items.length === 0) break;
  }

  return head ? { ...head, items } : null;
});

function toPublicItem(item: PublicWatchlistItemPayload): PublicItem {
  return {
    ...item,
    description: item.description ?? undefined,
    coverUrl: item.coverUrl ?? undefined,
    year: item.year ?? undefined,
    endYear: item.endYear ?? undefined,
    runtime: item.runtime ?? undefined,
    createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now(),
  };
}
