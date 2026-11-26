"use server";

import { authedFetch } from "@/lib/serverFetch";
import type { Item, ImportOutcome, ImportResult, LibraryLoad, MediaType, Status } from "@/lib/types";
import { safeParseWatchlistItems } from "@/lib/validators";
import { apiErrorMessage, SESSION_EXPIRED } from "@/lib/apiError";

type ItemInput = {
  id?: string;
  title: string;
  mediaType: MediaType;
  tmdbId?: number;
  status: Status;
  favorite: boolean;
  genres?: string[];
  notes?: string;
  description?: string;
  year?: number | null;
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

/** Use the backend's maximum page size to reduce round trips for large libraries. */
const PAGE_SIZE = 500;

/** Stops a malformed `has_more` from looping forever while supporting 10,000 rows. */
const MAX_PAGES = 10_000 / PAGE_SIZE;

export async function getItems(): Promise<LibraryLoad> {
  const items: Item[] = [];
  const seen = new Set<string>();
  const failure = (message = "Could not load the library. Please try again."): LibraryLoad =>
    ({ items, state: items.length ? "partial" : "error", message });

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE_SIZE;
      const res = await authedFetch(
        `/watchlist?limit=${PAGE_SIZE}&offset=${offset}`,
        { cache: "no-store" },
      );
      if (!res.ok) return failure(res.status === 401 ? SESSION_EXPIRED : undefined);

      const data = await res.json();
      const legacy = Array.isArray(data);
      if (!legacy && (!Array.isArray(data?.items) || typeof data.has_more !== "boolean")) {
        return failure();
      }
      const parsed = safeParseWatchlistItems(legacy ? data : data.items);
      if (!parsed.success) return failure();

      for (const item of normalizeItems(parsed.data)) {
        if (seen.has(item.id)) return failure("The library changed while loading. Please try again.");
        seen.add(item.id);
        items.push(item);
      }

      if (legacy) return { items, state: "complete" };
      if (!data.has_more) {
        if (typeof data.total === "number" && data.total !== items.length) {
          return failure("The library changed while loading. Please try again.");
        }
        return { items, state: "complete" };
      }
      if (parsed.data.length !== PAGE_SIZE) return failure();
    }
  } catch {
    return failure();
  }
  return failure("The library exceeds the current display limit.");
}

function normalizeItems(rows: Extract<ReturnType<typeof safeParseWatchlistItems>, { success: true }>["data"]): Item[] {
  return rows.map((item) => ({
    ...item,
    tmdbId: item.tmdbId ?? undefined,
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
  return { error: await apiErrorMessage(res, "Failed to save item") };
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

export async function importItems(items: ItemInput[]): Promise<ImportResult> {
  const results: ImportOutcome[] = [];
  for (let i = 0; i < items.length; i += MAX_BATCH_SIZE) {
    const chunk = items.slice(i, i + MAX_BATCH_SIZE);
    let outcomes: ImportOutcome[] = chunk.map(() => "unconfirmed");
    try {
      const res = await authedFetch("/watchlist/batch", {
        method: "POST",
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        const data = await res.json();
        const rows: unknown = data.results;
        if (
          Array.isArray(rows) &&
          rows.length === chunk.length &&
          rows.every((value) => value === "imported" || value === "duplicate")
        ) {
          outcomes = rows;
        } else if (data.imported === chunk.length && !data.skipped) {
          outcomes = chunk.map(() => "imported");
        } else if (data.skipped === chunk.length && !data.imported) {
          outcomes = chunk.map(() => "duplicate");
        }
      }
    } catch {
      // The write may have committed before the connection timed out. Let a
      // retry use the same identity rules and report the matching rows.
    }
    results.push(...outcomes);
  }
  return {
    imported: results.filter((result) => result === "imported").length,
    skipped: results.filter((result) => result === "duplicate").length,
    failed: results.filter((result) => result === "unconfirmed").length,
    results,
  };
}
