"use server";

import { authedFetch } from "@/lib/serverFetch";
import type { Item, MediaType, Status } from "@/lib/types";
import { safeParseWatchlistItems } from "@/lib/validators";

type ItemInput = {
  id?: string;
  title: string;
  mediaType: MediaType;
  status: Status;
  favorite: boolean;
  genres?: string[];
  notes?: string;
  description?: string;
  year?: number;
  endYear?: number;
  running?: boolean;
  coverUrl?: string;
  runtime?: number;
};

export async function getUserId(): Promise<string> {
  const res = await authedFetch(`/auth/me`, { cache: "no-store" });
  if (!res.ok) throw new Error("Unauthorized");
  const user = await res.json();
  return user.id;
}

/** Items requested per request. The backend caps `limit` at 500. */
const PAGE_SIZE = 100;

/** Stops a malformed `has_more` from looping forever. 100 pages = 10k items. */
const MAX_PAGES = 100;

export async function getItems(): Promise<Item[]> {
  // Pages explicitly rather than relying on the server default. The backend
  // still defaults `limit=0` ("everything") for older clients, so this works
  // against both the current and the paginated-by-default backend — which is
  // what makes the two deploys independent. See REMEDIATION_PLAN.md 2.6/2.10.
  const raw: unknown[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const res = await authedFetch(
      `/watchlist?limit=${PAGE_SIZE}&offset=${offset}`,
      { cache: "no-store" },
    );
    if (!res.ok) return page === 0 ? [] : raw.length ? finalize(raw) : [];

    const json = await res.json();

    // A bare array means an older backend that ignored the pagination
    // parameters and returned everything; there is no second page to fetch.
    if (Array.isArray(json)) {
      raw.push(...json);
      break;
    }

    const items = json.items ?? [];
    raw.push(...items);

    if (!json.has_more || items.length === 0) break;
  }

  return finalize(raw);
}

function finalize(raw: unknown[]): Item[] {
  const parsed = safeParseWatchlistItems(raw);
  if (!parsed.success) {
    console.error("Watchlist items validation failed:", parsed.error);
    return [];
  }

  return parsed.data.map((item) => ({
    ...item,
    notes: item.notes ?? undefined,
    description: item.description ?? undefined,
    coverUrl: item.coverUrl ?? undefined,
    genres: item.genres ?? undefined,
    year: item.year ?? undefined,
    endYear: item.endYear ?? undefined,
    running: item.running ?? undefined,
    runtime: item.runtime ?? undefined,
    createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now(),
  }));
}

export async function upsertItem(data: ItemInput) {
  let res;
  if (data.id) {
    res = await authedFetch(`/watchlist/${data.id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  } else {
    res = await authedFetch(`/watchlist`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  if (res.ok) return { success: true };
  return { error: "Failed to save item" };
}

export async function deleteItem(id: string) {
  const res = await authedFetch(`/watchlist/${id}`, { method: "DELETE" });
  if (res.ok) return { success: true };
  return { error: "Failed to delete item" };
}

export async function toggleFavorite(id: string) {
  const res = await authedFetch(`/watchlist/${id}/toggle-favorite`, {
    method: "PATCH",
  });
  if (res.ok) {
    const data = await res.json();
    return { success: true, favorite: data.favorite };
  }
  return { error: "Failed to toggle favorite" };
}

export async function updateMetadata(
  id: string,
  payload: {
    coverUrl?: string;
    genres?: string[];
    description?: string;
    runtime?: number;
  },
) {
  const res = await authedFetch(`/watchlist/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (res.ok) return { success: true };
  return { error: "Failed to update metadata" };
}

/** The backend rejects a batch larger than this with a 413. */
const MAX_BATCH_SIZE = 100;

export async function importItems(items: ItemInput[]) {
  // Chunked to the server's documented ceiling. The previous code posted the
  // whole list, took the resulting 413 as "old backend", and fell back to one
  // request per item — which for a 300-item import meant 300 POSTs and a
  // rate-limit wall around request 60.
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
    const chunk = items.slice(i, i + MAX_BATCH_SIZE);
    try {
      const res = await authedFetch(`/watchlist/batch`, {
        method: "POST",
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        const data = await res.json();
        imported += data.imported ?? 0;
      } else {
        failed += chunk.length;
      }
    } catch {
      failed += chunk.length;
    }
  }

  // A partial import is still a success — the caller reports what landed —
  // but a run where nothing at all landed is a failure worth surfacing.
  if (failed > 0 && imported === 0) {
    return { error: "Import failed", imported: 0 };
  }

  return { success: true, imported, failed };
}
