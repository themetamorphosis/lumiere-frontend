import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock Server Actions
vi.mock("@/app/actions/items", () => ({
  getItems: vi.fn(),
  upsertItem: vi.fn(),
  deleteItem: vi.fn(),
  toggleFavorite: vi.fn(),
  importItems: vi.fn(),
  updateMetadata: vi.fn(),
}));

vi.mock("@/lib/poster", () => ({
  fetchPoster: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { useLibraryData } from "@/hooks/useLibraryData";
import {
  getItems,
  upsertItem,
  deleteItem,
  toggleFavorite,
  importItems,
} from "@/app/actions/items";
import { toast } from "sonner";

const mockGetItems = vi.mocked(getItems);
const mockUpsertItem = vi.mocked(upsertItem);
const mockDeleteItem = vi.mocked(deleteItem);
const mockToggleFavorite = vi.mocked(toggleFavorite);
const mockImportItems = vi.mocked(importItems);
const mockToast = vi.mocked(toast);

const mockItem = {
  id: "item-1",
  title: "The Matrix",
  mediaType: "movie" as const,
  status: "pending" as const,
  favorite: false,
  genres: ["Sci-Fi"],
  year: 1999,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("useLibraryData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItems.mockResolvedValue([mockItem]);
    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => null);
    Storage.prototype.setItem = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads items on mount", async () => {
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe("The Matrix");
  });

  it("handleDelete optimistic + success", async () => {
    mockDeleteItem.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.handleDelete("item-1");
    });

    expect(result.current.items).toHaveLength(0);
    expect(mockDeleteItem).toHaveBeenCalledWith("item-1");
  });

  it("handleDelete optimistic + failure reverts and shows toast", async () => {
    mockDeleteItem.mockResolvedValue({ error: "Failed to delete item" });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.handleDelete("item-1");
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(mockToast.error).toHaveBeenCalledWith(
      "Delete failed — item restored",
    );
  });

  it("handleUpsert updates existing item", async () => {
    mockUpsertItem.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.handleUpsert(
        {
          title: "Updated Title",
          mediaType: "movie",
          status: "watched",
          favorite: true,
        },
        "item-1",
      );
    });

    expect(result.current.items[0].title).toBe("Updated Title");
    expect(result.current.items[0].status).toBe("watched");
  });

  it("handleUpsert update failure reverts and shows toast", async () => {
    mockUpsertItem.mockResolvedValue({ error: "Failed to save item" });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.handleUpsert(
        {
          title: "Bad Update",
          mediaType: "movie",
          status: "watched",
          favorite: false,
        },
        "item-1",
      );
    });

    await waitFor(() => {
      expect(result.current.items[0].title).toBe("The Matrix");
    });
    expect(mockToast.error).toHaveBeenCalledWith(
      "Update failed — changes reverted",
    );
  });

  it("handleToggleFav flips favorite", async () => {
    mockToggleFavorite.mockResolvedValue({ success: true, favorite: true });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.handleToggleFav("item-1");
    });

    expect(result.current.items[0].favorite).toBe(true);
  });

  it("handleToggleFav failure reverts", async () => {
    mockToggleFavorite.mockResolvedValue({
      error: "Failed to toggle favorite",
    });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.handleToggleFav("item-1");
    });

    await waitFor(() => {
      expect(result.current.items[0].favorite).toBe(false);
    });
    expect(mockToast.error).toHaveBeenCalledWith(
      "Favorite toggle failed — reverted",
    );
  });

  it("handleImport adds items and shows success toast", async () => {
    mockImportItems.mockResolvedValue({ success: true, imported: 2, failed: 0 });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    const newItem = {
      id: "item-2",
      title: "Inception",
      mediaType: "movie" as const,
      status: "pending" as const,
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    act(() => {
      result.current.handleImport([newItem]);
    });

    expect(result.current.items).toHaveLength(2);
    expect(mockImportItems).toHaveBeenCalled();
  });

  it("handleImport failure shows toast and refreshes", async () => {
    // Total failure now returns an `error` shape rather than success:false.
    mockImportItems.mockResolvedValue({ error: "Import failed", imported: 0 });
    const { result } = renderHook(() => useLibraryData("user-1"));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.handleImport([
        {
          id: "item-2",
          title: "Inception",
          mediaType: "movie",
          status: "pending",
          favorite: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]);
    });

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Import failed — please try again",
      );
    });
  });

  describe("optimistic rollback", () => {
    const second = {
      ...mockItem,
      id: "item-2",
      title: "Arrival",
      favorite: false,
    };

    it("a failed delete does not undo a concurrent favorite toggle", async () => {
      // Rollback used to restore a whole-array snapshot captured at render
      // time, which also reverted anything that changed in between.
      mockGetItems.mockResolvedValue([mockItem, second]);

      let resolveDelete: (v: { error: string }) => void = () => {};
      mockDeleteItem.mockReturnValue(
        new Promise((r) => {
          resolveDelete = r;
        }) as ReturnType<typeof deleteItem>,
      );
      mockToggleFavorite.mockResolvedValue({ success: true, favorite: true });

      const { result } = renderHook(() => useLibraryData("user-1"));
      await waitFor(() => expect(result.current.ready).toBe(true));

      act(() => {
        result.current.handleDelete("item-1");
      });
      act(() => {
        result.current.handleToggleFav("item-2");
      });

      expect(
        result.current.items.find((i) => i.id === "item-2")?.favorite,
      ).toBe(true);

      await act(async () => {
        resolveDelete({ error: "Failed to delete item" });
      });

      await waitFor(() =>
        expect(result.current.items.some((i) => i.id === "item-1")).toBe(true),
      );

      // The toggle must survive the unrelated rollback.
      expect(
        result.current.items.find((i) => i.id === "item-2")?.favorite,
      ).toBe(true);
    });

    it("restores a deleted item at its original position", async () => {
      mockGetItems.mockResolvedValue([mockItem, second]);
      mockDeleteItem.mockResolvedValue({ error: "Failed to delete item" });

      const { result } = renderHook(() => useLibraryData("user-1"));
      await waitFor(() => expect(result.current.ready).toBe(true));

      act(() => {
        result.current.handleDelete("item-2");
      });

      await waitFor(() => expect(result.current.items).toHaveLength(2));
      expect(result.current.items.map((i) => i.id)).toEqual([
        "item-1",
        "item-2",
      ]);
    });

    it("a failed toggle reverts only that item's flag", async () => {
      mockGetItems.mockResolvedValue([mockItem, second]);
      mockToggleFavorite.mockResolvedValue({ error: "nope" });

      const { result } = renderHook(() => useLibraryData("user-1"));
      await waitFor(() => expect(result.current.ready).toBe(true));

      act(() => {
        result.current.handleToggleFav("item-1");
      });

      await waitFor(() =>
        expect(
          result.current.items.find((i) => i.id === "item-1")?.favorite,
        ).toBe(false),
      );
      expect(result.current.items).toHaveLength(2);
    });

    it("a failed create removes only the optimistic row", async () => {
      mockGetItems.mockResolvedValue([mockItem]);
      mockUpsertItem.mockResolvedValue({ error: "Failed to save item" });

      const { result } = renderHook(() => useLibraryData("user-1"));
      await waitFor(() => expect(result.current.ready).toBe(true));

      act(() => {
        result.current.handleUpsert({
          title: "Ghost",
          mediaType: "movie",
          status: "pending",
          favorite: false,
        });
      });

      await waitFor(() => expect(result.current.items).toHaveLength(1));
      expect(result.current.items[0].id).toBe("item-1");
    });
  });

  describe("cached items", () => {
    // `localStorage` is not defined in this jsdom environment, so patching
    // Storage.prototype (as the tests above do) never reaches the hook — every
    // cache access simply threw into the catch. Stub the global instead.
    function stubStorage(stored: string | null) {
      const removeItem = vi.fn();
      vi.stubGlobal("localStorage", {
        getItem: vi.fn(() => stored),
        setItem: vi.fn(),
        removeItem,
      });
      return removeItem;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    // Cache entries round-trip the shape getItems produces, which includes
    // userId — the schema requires it.
    const cachedRow = {
      ...mockItem,
      userId: "user-1",
      id: "cached-1",
      title: "From Cache",
    };

    it("drops a cache entry that fails validation", async () => {
      const removeItem = stubStorage(JSON.stringify([{ nonsense: true }]));

      const { result } = renderHook(() => useLibraryData("user-1"));
      await waitFor(() => expect(result.current.ready).toBe(true));

      // Network data wins; the malformed cache never reaches state.
      expect(result.current.items).toEqual([mockItem]);
      expect(removeItem).toHaveBeenCalledWith("wv-cache-items-user-1");
    });

    it("drops a cache entry that is not valid JSON", async () => {
      const removeItem = stubStorage("{not json");

      const { result } = renderHook(() => useLibraryData("user-1"));
      await waitFor(() => expect(result.current.ready).toBe(true));

      expect(result.current.items).toEqual([mockItem]);
      expect(removeItem).toHaveBeenCalledWith("wv-cache-items-user-1");
    });

    it("renders a cache entry that validates, then replaces it with the network", async () => {
      stubStorage(JSON.stringify([cachedRow]));

      let resolveNetwork: (v: (typeof mockItem)[]) => void = () => {};
      mockGetItems.mockReturnValue(
        new Promise((r) => {
          resolveNetwork = r;
        }) as ReturnType<typeof getItems>,
      );

      const { result } = renderHook(() => useLibraryData("user-1"));

      await waitFor(() =>
        expect(result.current.items[0]?.title).toBe("From Cache"),
      );

      await act(async () => {
        resolveNetwork([mockItem]);
      });
      await waitFor(() =>
        expect(result.current.items[0]?.title).toBe("The Matrix"),
      );
    });
  });
});
