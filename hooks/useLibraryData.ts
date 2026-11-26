"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { toast } from "sonner";
import type { ImportResult, Item, LibraryLoad } from "@/lib/types";
import {
  getItems,
  upsertItem,
  deleteItem,
  toggleFavorite,
  importItems as importItemsAction,
  updateMetadata,
} from "@/app/actions/items";
import { fetchPoster } from "@/lib/poster";
import { safeParseWatchlistItems } from "@/lib/validators";

export function useLibraryData(userId: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();
  const syncingRefs = useRef<Set<string>>(new Set());

  const [owner, setOwner] = useState(userId);
  const [loadState, setLoadState] = useState<LibraryLoad["state"] | "loading">("loading");
  const [loadMessage, setLoadMessage] = useState<string>();
  const requestVersion = useRef(0);

  const refreshItems = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const result = await getItems();
      if (version !== requestVersion.current) return;
      setLoadState(result.state);
      setLoadMessage(result.message);
      if (result.state === "complete") {
        setItems(result.items);
        if (userId !== "guest") {
          try {
            localStorage.setItem(`wv-cache-items-${userId}`, JSON.stringify(result.items));
          } catch {
            // Storage is optional.
          }
        }
      } else if (result.state === "partial") {
        setItems(result.items);
      }
    } catch {
      if (version !== requestVersion.current) return;
      setLoadState("error");
      setLoadMessage("Could not load the library. Please try again.");
    } finally {
      if (version === requestVersion.current) setReady(true);
    }
  }, [userId]);

  const invalidateLoading = useCallback(() => { requestVersion.current++; }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOwner(userId);
      setMounted(true);
      setReady(false);
      setLoadState("loading");
      setLoadMessage(undefined);
      setItems([]);
      syncingRefs.current.clear();

      if (userId !== "guest") {
        const key = `wv-cache-items-${userId}`;
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const parsed = safeParseWatchlistItems(JSON.parse(cached));
            if (parsed.success && parsed.data.every((item) => item.userId === userId)) {
              setItems(parsed.data as Item[]);
            } else {
              localStorage.removeItem(key);
            }
          }
        } catch {
          try { localStorage.removeItem(key); } catch {}
        }
      }

      void refreshItems();
    }, 0);
    return () => {
      clearTimeout(timer);
      invalidateLoading();
    };
  }, [userId, refreshItems, invalidateLoading]);

  // Poster enrichment
  const ensureCover = useCallback(async (it: Item): Promise<void> => {
    if (it.tmdbId != null) return;
    if (it.coverUrl && it.genres && it.genres.length > 0 && it.description)
      return;

    let fetchResult;
    try {
      fetchResult = await fetchPoster(it.title, it.mediaType, it.year);
    } catch (e) {
      console.error("Poster fetch failed:", e);
      try {
        sessionStorage.setItem(`wv-poster-skip-${it.id}`, "1");
      } catch {}
      return;
    }

    if (!fetchResult) {
      try {
        sessionStorage.setItem(`wv-poster-skip-${it.id}`, "1");
      } catch {}
      return;
    }

    const { coverUrl, genres, description } = fetchResult;
    const hasNewCover = !it.coverUrl && coverUrl;
    const hasNewGenres =
      (!it.genres || it.genres.length === 0) && genres && genres.length > 0;
    const hasNewDesc = !it.description && description;

    if (!hasNewCover && !hasNewGenres && !hasNewDesc) {
      try {
        sessionStorage.setItem(`wv-poster-skip-${it.id}`, "1");
      } catch {}
      return;
    }

    setItems((prev) =>
      prev.map((x) =>
        x.id === it.id
          ? {
              ...x,
              ...(hasNewCover ? { coverUrl } : {}),
              ...(hasNewGenres ? { genres } : {}),
              ...(hasNewDesc ? { description } : {}),
            }
          : x,
      ),
    );

    startTransition(() => {
      updateMetadata(it.id, {
        ...(hasNewCover ? { coverUrl } : {}),
        ...(hasNewGenres ? { genres } : {}),
        ...(hasNewDesc ? { description } : {}),
      });
    });
  }, []);

  // Mirrors the latest items so a rollback can read the pre-change row without
  // capturing the whole array in a closure.
  const itemsRef = useRef<Item[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // CRUD operations
  //
  // Each of these rolls back by inverting its own change rather than restoring
  // a whole-array snapshot. Snapshots were captured at render time, so a failed
  // delete also reverted any favorite toggle that happened in between.
  const handleUpsert = useCallback(
    async (next: Omit<Item, "id" | "createdAt" | "updatedAt">, id?: string) => {
      const now = Date.now();
      const before = id ? itemsRef.current.find((item) => item.id === id) : undefined;
      const itemId = id ?? crypto.randomUUID();
      setItems((current) => id
        ? current.map((item) => item.id === id ? { ...item, ...next, updatedAt: now } : item)
        : [{ id: itemId, createdAt: now, updatedAt: now, ...next }, ...current],
      );

      const result = await (id
        ? upsertItem({ ...next, id, year: next.year ?? null })
        : upsertItem(next)
      ).catch(() => ({ success: false, error: "Failed to save item" }));
      if (result.success) {
        if (!id) await refreshItems();
        return true;
      }

      setItems((current) => id
        ? current.map((item) => before && item.id === id ? before : item)
        : current.filter((item) => item.id !== itemId),
      );
      const fallback = id ? "Update failed — changes reverted" : "Create failed — item removed";
      toast.error(result.error && result.error !== "Failed to save item" ? result.error : fallback);
      return false;
    },
    [refreshItems],
  );

  const handleDelete = useCallback((id: string) => {
    const removed = itemsRef.current.find((p) => p.id === id);
    const index = itemsRef.current.findIndex((p) => p.id === id);
    setItems((current) => current.filter((p) => p.id !== id));
    startTransition(async () => {
      const result = await deleteItem(id);
      if (!result.success && removed) {
        setItems((current) => {
          if (current.some((p) => p.id === id)) return current;
          // Put it back where it was, so a failed delete doesn't reorder.
          const restored = [...current];
          restored.splice(Math.min(index, restored.length), 0, removed);
          return restored;
        });
        toast.error("Delete failed — item restored");
      }
    });
  }, []);

  const handleToggleFav = useCallback((id: string) => {
    setItems((current) =>
      current.map((p) =>
        p.id === id
          ? { ...p, favorite: !p.favorite, updatedAt: Date.now() }
          : p,
      ),
    );
    startTransition(async () => {
      const result = await toggleFavorite(id);
      if (!result.success) {
        // Inverse of the change, so no snapshot is needed at all.
        setItems((current) =>
          current.map((p) =>
            p.id === id ? { ...p, favorite: !p.favorite } : p,
          ),
        );
        toast.error("Favorite toggle failed — reverted");
      }
    });
  }, []);

  const handleImport = useCallback(
    async (entries: Omit<Item, "id" | "createdAt" | "updatedAt">[]): Promise<ImportResult> => {
      const result = await importItemsAction(entries);
      void refreshItems();
      return result;
    },
    [refreshItems],
  );

  return {
    items: owner === userId ? items : [],
    setItems,
    ready: owner === userId && ready,
    loadState: owner === userId ? loadState : "loading",
    loadMessage,
    mounted,
    refreshItems,
    ensureCover,
    syncingRefs,
    handleUpsert,
    handleDelete,
    handleToggleFav,
    handleImport,
  };
}
