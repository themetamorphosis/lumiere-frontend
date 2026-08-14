import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/serverFetch", () => ({
  publicFetch: vi.fn(),
  authedFetch: vi.fn(),
}));

import { publicFetch, authedFetch } from "@/lib/serverFetch";
import { getPublicWatchlist } from "@/lib/publicWatchlist";

const mockPublicFetch = vi.mocked(publicFetch);
const mockAuthedFetch = vi.mocked(authedFetch);

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: `id-${Math.random().toString(16).slice(2)}`,
    title: "Dune",
    mediaType: "movie",
    status: "watched",
    favorite: false,
    genres: ["Sci-Fi"],
    description: null,
    year: 2021,
    endYear: null,
    running: false,
    coverUrl: null,
    runtime: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function page(
  items: unknown[],
  { has_more = false, total = items.length, offset = 0 } = {},
) {
  return new Response(
    JSON.stringify({
      slug: "noor",
      label: "My picks",
      owner: { name: "Noor", image: null },
      filters: { statuses: [], mediaTypes: [], favoritesOnly: false },
      items,
      total,
      limit: 200,
      offset,
      has_more,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("getPublicWatchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads through the unauthenticated fetch, never the authed one", async () => {
    mockPublicFetch.mockResolvedValue(page([item()]));

    await getPublicWatchlist("slug-unauth");

    expect(mockPublicFetch).toHaveBeenCalledTimes(1);
    // The whole point of the feature: a visitor with no session sees the same
    // response the owner does.
    expect(mockAuthedFetch).not.toHaveBeenCalled();
  });

  it("returns owner and items on success", async () => {
    mockPublicFetch.mockResolvedValue(page([item({ title: "Arrival" })]));

    const data = await getPublicWatchlist("slug-success");

    expect(data?.owner.name).toBe("Noor");
    expect(data?.label).toBe("My picks");
    expect(data?.items.map((i) => i.title)).toEqual(["Arrival"]);
  });

  it("follows has_more across pages", async () => {
    mockPublicFetch
      .mockResolvedValueOnce(
        page([item({ title: "One" })], { has_more: true, total: 2 }),
      )
      .mockResolvedValueOnce(
        page([item({ title: "Two" })], {
          has_more: false,
          total: 2,
          offset: 200,
        }),
      );

    const data = await getPublicWatchlist("slug-paged");

    expect(data?.items.map((i) => i.title)).toEqual(["One", "Two"]);
    expect(mockPublicFetch.mock.calls[1][0]).toContain("offset=200");
  });

  it("returns null for an unknown or revoked slug", async () => {
    mockPublicFetch.mockResolvedValue(new Response("{}", { status: 404 }));

    expect(await getPublicWatchlist("slug-gone")).toBeNull();
  });

  it("returns null when the backend is unreachable", async () => {
    mockPublicFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await getPublicWatchlist("slug-down")).toBeNull();
  });

  it("returns null when the payload does not match the schema", async () => {
    mockPublicFetch.mockResolvedValue(
      new Response(JSON.stringify({ nope: true }), { status: 200 }),
    );

    expect(await getPublicWatchlist("slug-garbage")).toBeNull();
  });

  it("drops any notes the backend might send", async () => {
    // Defence in depth: the endpoint omits notes, and so must the client if a
    // future change ever starts sending them.
    mockPublicFetch.mockResolvedValue(
      page([item({ notes: "private thought" })]),
    );

    const data = await getPublicWatchlist("slug-notes");

    expect(data?.items[0]).not.toHaveProperty("notes");
  });

  it("percent-encodes the slug into the path", async () => {
    mockPublicFetch.mockResolvedValue(page([]));

    await getPublicWatchlist("../../auth/me");

    expect(mockPublicFetch.mock.calls[0][0]).toContain(
      encodeURIComponent("../../auth/me"),
    );
  });
});
