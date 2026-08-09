import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("@/lib/serverFetch", () => ({
  authedFetch: vi.fn(),
}));

vi.mock("@/lib/validators", () => ({
  safeParseWatchlistItems: vi.fn(),
}));

import { authedFetch } from "@/lib/serverFetch";
import { safeParseWatchlistItems } from "@/lib/validators";
import {
  getItems,
  deleteItem,
  upsertItem,
  toggleFavorite,
  importItems,
} from "@/app/actions/items";

const mockAuthedFetch = vi.mocked(authedFetch);
const mockSafeParse = vi.mocked(safeParseWatchlistItems);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Server Actions: items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getItems", () => {
    it("returns parsed items on success", async () => {
      const rawItems = [
        {
          id: "1",
          userId: "user-1",
          title: "Test",
          mediaType: "movie" as const,
          status: "pending" as const,
          favorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      mockAuthedFetch.mockResolvedValue(jsonResponse(rawItems));
      mockSafeParse.mockReturnValue({ success: true, data: rawItems });

      const result = await getItems();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test");
      // Sends an explicit limit rather than relying on the server default,
      // so it behaves identically against both backend versions.
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/watchlist?limit=100&offset=0",
        { cache: "no-store" },
      );
    });

    it("returns [] on fetch failure", async () => {
      mockAuthedFetch.mockResolvedValue(new Response("{}", { status: 500 }));

      const result = await getItems();

      expect(result).toEqual([]);
    });

    it("returns [] on validation failure", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse([{ bad: "data" }]));
      mockSafeParse.mockReturnValue({
        success: false,
        error: new z.ZodError([]),
      } as ReturnType<typeof safeParseWatchlistItems>);

      const result = await getItems();

      expect(result).toEqual([]);
    });

    it("follows has_more across pages", async () => {
      const row = (id: string) => ({
        id,
        userId: "user-1",
        title: `Item ${id}`,
        mediaType: "movie" as const,
        status: "pending" as const,
        favorite: false,
      });
      const page1 = Array.from({ length: 100 }, (_, i) => row(`p1-${i}`));
      const page2 = [row("p2-0")];

      mockAuthedFetch
        .mockResolvedValueOnce(jsonResponse({ items: page1, has_more: true }))
        .mockResolvedValueOnce(jsonResponse({ items: page2, has_more: false }));
      mockSafeParse.mockImplementation((data) => ({
        success: true,
        data: data as never,
      }));

      const result = await getItems();

      expect(result).toHaveLength(101);
      expect(mockAuthedFetch).toHaveBeenNthCalledWith(
        1,
        "/watchlist?limit=100&offset=0",
        { cache: "no-store" },
      );
      expect(mockAuthedFetch).toHaveBeenNthCalledWith(
        2,
        "/watchlist?limit=100&offset=100",
        { cache: "no-store" },
      );
    });

    it("stops after one page when the backend ignores pagination", async () => {
      // An older backend returns a bare array; there is no second page.
      const rows = Array.from({ length: 3 }, (_, i) => ({
        id: String(i),
        userId: "u",
        title: `T${i}`,
        mediaType: "movie" as const,
        status: "pending" as const,
        favorite: false,
      }));
      mockAuthedFetch.mockImplementation(async () => jsonResponse(rows));
      mockSafeParse.mockImplementation((data) => ({
        success: true,
        data: data as never,
      }));

      const result = await getItems();

      expect(result).toHaveLength(3);
      expect(mockAuthedFetch).toHaveBeenCalledTimes(1);
    });

    it("stops on an empty page even if has_more stays true", async () => {
      mockAuthedFetch.mockImplementation(async () =>
        jsonResponse({ items: [], has_more: true }),
      );
      mockSafeParse.mockReturnValue({ success: true, data: [] });

      const result = await getItems();

      expect(result).toEqual([]);
      expect(mockAuthedFetch).toHaveBeenCalledTimes(1);
    });

    it("keeps the pages it already has when a later page fails", async () => {
      const rows = [
        {
          id: "1",
          userId: "u",
          title: "Kept",
          mediaType: "movie" as const,
          status: "pending" as const,
          favorite: false,
        },
      ];
      mockAuthedFetch
        .mockResolvedValueOnce(jsonResponse({ items: rows, has_more: true }))
        .mockResolvedValueOnce(new Response("{}", { status: 500 }));
      mockSafeParse.mockImplementation((data) => ({
        success: true,
        data: data as never,
      }));

      const result = await getItems();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Kept");
    });
  });

  describe("deleteItem", () => {
    it("returns success on ok", async () => {
      mockAuthedFetch.mockResolvedValue(new Response("{}", { status: 200 }));

      const result = await deleteItem("item-1");

      expect(result).toEqual({ success: true });
      expect(mockAuthedFetch).toHaveBeenCalledWith("/watchlist/item-1", {
        method: "DELETE",
      });
    });

    it("returns error on failure", async () => {
      mockAuthedFetch.mockResolvedValue(new Response("{}", { status: 500 }));

      const result = await deleteItem("item-1");

      expect(result).toEqual({ error: "Failed to delete item" });
    });
  });

  describe("upsertItem", () => {
    it("sends POST for new item", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ id: "new-1" }));

      const result = await upsertItem({
        title: "New",
        mediaType: "movie",
        status: "pending",
        favorite: false,
      });

      expect(result).toEqual({ success: true });
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/watchlist",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("sends PATCH for existing item", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ id: "existing-1" }));

      const result = await upsertItem({
        id: "existing-1",
        title: "Updated",
        mediaType: "movie",
        status: "watched",
        favorite: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/watchlist/existing-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("returns error on failure", async () => {
      mockAuthedFetch.mockResolvedValue(new Response("{}", { status: 400 }));

      const result = await upsertItem({
        title: "Bad",
        mediaType: "movie",
        status: "pending",
        favorite: false,
      });

      expect(result).toEqual({ error: "Failed to save item" });
    });
  });

  describe("toggleFavorite", () => {
    it("returns success and favorite state on ok", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ id: "1", favorite: true }),
      );

      const result = await toggleFavorite("1");

      expect(result).toEqual({ success: true, favorite: true });
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/watchlist/1/toggle-favorite",
        { method: "PATCH" },
      );
    });

    it("returns error on failure", async () => {
      mockAuthedFetch.mockResolvedValue(new Response("{}", { status: 500 }));

      const result = await toggleFavorite("1");

      expect(result).toEqual({ error: "Failed to toggle favorite" });
    });
  });

  describe("importItems", () => {
    it("sends batch and returns imported count", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ success: true, imported: 3 }),
      );

      const items = [
        {
          title: "A",
          mediaType: "movie" as const,
          status: "pending" as const,
          favorite: false,
        },
        {
          title: "B",
          mediaType: "movie" as const,
          status: "pending" as const,
          favorite: false,
        },
        {
          title: "C",
          mediaType: "movie" as const,
          status: "pending" as const,
          favorite: false,
        },
      ];

      const result = await importItems(items);

      // `failed` is new: chunked imports can partially succeed.
      expect(result).toEqual({ success: true, imported: 3, failed: 0 });
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/watchlist/batch",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("chunks to the server's batch ceiling instead of one request per item", async () => {
      // The backend 413s above 100. The old fallback read that as "old
      // backend" and sent one POST per item, hitting the rate limiter.
      // A fresh Response per call: a body can only be read once, so a shared
      // instance would fail on the second chunk.
      mockAuthedFetch.mockImplementation(async () =>
        jsonResponse({ success: true, imported: 100 }),
      );

      const items = Array.from({ length: 250 }, (_, i) => ({
        title: `Film ${i}`,
        mediaType: "movie" as const,
        status: "pending" as const,
        favorite: false,
      }));

      const result = await importItems(items);

      expect(mockAuthedFetch).toHaveBeenCalledTimes(3);
      for (const [url, init] of mockAuthedFetch.mock.calls) {
        expect(url).toBe("/watchlist/batch");
        expect(JSON.parse(init!.body as string).length).toBeLessThanOrEqual(
          100,
        );
      }
      expect(result).toMatchObject({ success: true, imported: 300 });
    });

    it("sends the exact chunk boundaries", async () => {
      mockAuthedFetch.mockImplementation(async () =>
        jsonResponse({ success: true, imported: 0 }),
      );

      const items = Array.from({ length: 101 }, (_, i) => ({
        title: `Film ${i}`,
        mediaType: "movie" as const,
        status: "pending" as const,
        favorite: false,
      }));

      await importItems(items);

      const sizes = mockAuthedFetch.mock.calls.map(
        ([, init]) => JSON.parse(init!.body as string).length,
      );
      expect(sizes).toEqual([100, 1]);
    });

    it("reports a partial import rather than failing outright", async () => {
      mockAuthedFetch
        .mockResolvedValueOnce(jsonResponse({ success: true, imported: 100 }))
        .mockResolvedValueOnce(new Response("{}", { status: 500 }));

      const items = Array.from({ length: 150 }, (_, i) => ({
        title: `Film ${i}`,
        mediaType: "movie" as const,
        status: "pending" as const,
        favorite: false,
      }));

      const result = await importItems(items);

      expect(result).toMatchObject({
        success: true,
        imported: 100,
        failed: 50,
      });
    });

    it("reports failure when nothing landed", async () => {
      mockAuthedFetch.mockImplementation(
        async () => new Response("{}", { status: 500 }),
      );

      const result = await importItems([
        {
          title: "A",
          mediaType: "movie" as const,
          status: "pending" as const,
          favorite: false,
        },
      ]);

      expect(result).toMatchObject({ error: "Import failed", imported: 0 });
    });
  });
});
