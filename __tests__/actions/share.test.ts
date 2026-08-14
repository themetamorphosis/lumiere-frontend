import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/serverFetch", () => ({
  authedFetch: vi.fn(),
}));

import { authedFetch } from "@/lib/serverFetch";
import {
  createShareLink,
  deleteShareLink,
  getShareLinks,
  updateShareLink,
} from "@/app/actions/share";

const mockAuthedFetch = vi.mocked(authedFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const link = {
  id: "link-1",
  slug: "my-picks",
  label: "My picks",
  statuses: ["wishlist"],
  mediaTypes: [],
  favoritesOnly: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("Server Actions: share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getShareLinks", () => {
    it("returns the parsed links", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ links: [link] }));

      const links = await getShareLinks();

      expect(links).toHaveLength(1);
      expect(links[0].slug).toBe("my-picks");
      expect(mockAuthedFetch).toHaveBeenCalledWith("/share", {
        cache: "no-store",
      });
    });

    it("returns [] on a failed request", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({}, 500));

      expect(await getShareLinks()).toEqual([]);
    });

    it("returns [] when the payload does not match the schema", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ links: [{ id: 1 }] }));

      expect(await getShareLinks()).toEqual([]);
    });
  });

  describe("createShareLink", () => {
    it("posts the input", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse(link, 201));

      const res = await createShareLink({ slug: "my-picks" });

      expect(res).toEqual({ success: true });
      expect(mockAuthedFetch).toHaveBeenCalledWith("/share", {
        method: "POST",
        body: JSON.stringify({ slug: "my-picks" }),
      });
    });

    it("surfaces a taken handle", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ detail: "That handle is already taken" }, 409),
      );

      expect(await createShareLink({ slug: "taken" })).toEqual({
        error: "That handle is already taken",
      });
    });

    it("unwraps a Pydantic validation error into one readable line", async () => {
      // The slug rules live in a field validator, so the message users most
      // need arrives as an array of error objects rather than a string.
      mockAuthedFetch.mockResolvedValue(
        jsonResponse(
          {
            detail: [
              {
                loc: ["body", "slug"],
                msg: "Value error, 'login' is reserved and cannot be used as a handle",
                type: "value_error",
              },
            ],
          },
          422,
        ),
      );

      expect(await createShareLink({ slug: "login" })).toEqual({
        error: "'login' is reserved and cannot be used as a handle",
      });
    });

    it("falls back to a generic message when the body is not JSON", async () => {
      mockAuthedFetch.mockResolvedValue(
        new Response("<html>502</html>", { status: 502 }),
      );

      expect(await createShareLink({ slug: "x" })).toEqual({
        error: "Could not create the link.",
      });
    });
  });

  describe("updateShareLink", () => {
    it("patches the link", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse(link));

      const res = await updateShareLink("link-1", { label: "Renamed" });

      expect(res).toEqual({ success: true });
      expect(mockAuthedFetch).toHaveBeenCalledWith("/share/link-1", {
        method: "PATCH",
        body: JSON.stringify({ label: "Renamed" }),
      });
    });
  });

  describe("deleteShareLink", () => {
    it("revokes the link", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ ok: true }));

      const res = await deleteShareLink("link-1");

      expect(res).toEqual({ success: true });
      expect(mockAuthedFetch).toHaveBeenCalledWith("/share/link-1", {
        method: "DELETE",
      });
    });

    it("reports a failure instead of pretending the link is gone", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ detail: "Share link not found" }, 404),
      );

      expect(await deleteShareLink("nope")).toEqual({
        error: "Share link not found",
      });
    });
  });
});
