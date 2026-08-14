import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/serverFetch", () => ({
  authedFetch: vi.fn(),
}));

import { authedFetch } from "@/lib/serverFetch";
import { SESSION_EXPIRED } from "@/lib/apiError";
import {
  claimHandle,
  getConversation,
  getFriends,
  searchUsers,
  sendFriendRequest,
  sendMessage,
} from "@/app/actions/social";

const mockAuthedFetch = vi.mocked(authedFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const publicUser = {
  id: "u2",
  handle: "bob",
  name: "Bob",
  image: null,
};

describe("Server Actions: social", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFriends", () => {
    it("parses the three lists", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({
          friends: [
            {
              user: publicUser,
              friendshipId: "f1",
              since: "2026-01-01T00:00:00Z",
              unread: 3,
            },
          ],
          incoming: [{ id: "f2", user: publicUser, createdAt: null }],
          outgoing: [],
        }),
      );

      const overview = await getFriends();

      expect(overview.friends[0].unread).toBe(3);
      expect(overview.friends[0].user.handle).toBe("bob");
      expect(overview.incoming).toHaveLength(1);
      expect(overview.outgoing).toEqual([]);
    });

    it("returns empty lists on failure rather than throwing", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({}, 500));

      expect(await getFriends()).toEqual({
        friends: [],
        incoming: [],
        outgoing: [],
      });
    });

    it("returns empty lists when the payload does not match the schema", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ friends: "nope" }));

      expect((await getFriends()).friends).toEqual([]);
    });
  });

  describe("searchUsers", () => {
    it("does not call the API for a query under two characters", async () => {
      expect(await searchUsers("b")).toEqual([]);
      // The backend 422s below its minimum, and each call burns a rate-limit
      // slot for nothing.
      expect(mockAuthedFetch).not.toHaveBeenCalled();
    });

    it("strips a leading @ and encodes the query", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ results: [] }));

      await searchUsers("@bo b");

      expect(mockAuthedFetch).toHaveBeenCalledWith("/friends/search?q=bo%20b", {
        cache: "no-store",
      });
    });

    it("carries the relationship through", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({
          results: [{ ...publicUser, relationship: "outgoing" }],
        }),
      );

      const results = await searchUsers("bob");

      expect(results[0].relationship).toBe("outgoing");
    });
  });

  describe("sendFriendRequest", () => {
    it("normalizes the handle before sending", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ id: "f1" }, 201));

      await sendFriendRequest("  @Bob  ");

      expect(mockAuthedFetch).toHaveBeenCalledWith("/friends/requests", {
        method: "POST",
        body: JSON.stringify({ handle: "Bob" }),
      });
    });

    it("surfaces the backend's reason", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ detail: "No user with the handle @ghost" }, 404),
      );

      expect(await sendFriendRequest("ghost")).toEqual({
        error: "No user with the handle @ghost",
      });
    });
  });

  describe("getConversation", () => {
    it("distinguishes a failure from an empty conversation", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({}, 404));

      const page = await getConversation("u2");

      // `ok: false` is what stops the poller; an empty array would be rendered
      // as a conversation with no messages.
      expect(page).toEqual({ messages: [], hasMore: false, ok: false });
    });

    it("passes the since cursor", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ messages: [], has_more: false }),
      );

      await getConversation("u2", { since: "m1", limit: 50 });

      expect(mockAuthedFetch).toHaveBeenCalledWith(
        "/messages/u2?since=m1&limit=50",
        { cache: "no-store" },
      );
    });

    it("normalizes an attachment", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({
          messages: [
            {
              id: "m1",
              senderId: "u1",
              recipientId: "u2",
              body: null,
              attachment: {
                title: "Dune",
                mediaType: "movie",
                year: 2021,
                coverUrl: null,
              },
              readAt: null,
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
          has_more: false,
        }),
      );

      const page = await getConversation("u2");

      expect(page.ok).toBe(true);
      expect(page.messages[0].body).toBeUndefined();
      expect(page.messages[0].attachment).toEqual({
        title: "Dune",
        mediaType: "movie",
        year: 2021,
        coverUrl: undefined,
      });
    });
  });

  describe("sendMessage", () => {
    it("returns the created message", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse(
          {
            id: "m9",
            senderId: "u1",
            recipientId: "u2",
            body: "hi",
            attachment: null,
            readAt: null,
            createdAt: "2026-01-01T00:00:00Z",
          },
          201,
        ),
      );

      const res = await sendMessage("u2", { body: "hi" });

      expect(res.success).toBe(true);
      expect(res.message?.id).toBe("m9");
    });

    it("reports a rejection", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ detail: "Conversation not found" }, 404),
      );

      expect(await sendMessage("u2", { body: "hi" })).toEqual({
        error: "Conversation not found",
      });
    });
  });

  describe("claimHandle", () => {
    it("returns the normalized handle from the backend", async () => {
      mockAuthedFetch.mockResolvedValue(jsonResponse({ handle: "noor" }));

      expect(await claimHandle("@Noor")).toEqual({
        success: true,
        handle: "noor",
      });
    });

    it("unwraps a validation error into one readable line", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse(
          {
            detail: [
              {
                loc: ["body", "handle"],
                msg: "Value error, 'admin' is reserved and cannot be used as a handle",
              },
            ],
          },
          422,
        ),
      );

      expect(await claimHandle("admin")).toEqual({
        error: "'admin' is reserved and cannot be used as a handle",
      });
    });

    it("surfaces a taken handle", async () => {
      mockAuthedFetch.mockResolvedValue(
        jsonResponse({ detail: "That handle is already taken" }, 409),
      );

      expect(await claimHandle("bob")).toEqual({
        error: "That handle is already taken",
      });
    });
  });
});

describe("session expiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show the backend's credential wording in a form field", async () => {
    // authedFetch already tried to refresh and failed by the time we see a
    // 401, so "Could not validate credentials" would tell the user their
    // handle was invalid when the real answer is "sign in again".
    mockAuthedFetch.mockResolvedValue(
      jsonResponse({ detail: "Could not validate credentials" }, 401),
    );

    const res = await claimHandle("noornought");

    expect(res.error).toBe(SESSION_EXPIRED);
    expect(res.error).not.toMatch(/credentials/i);
  });

  it("reports an expired session the same way for friend requests", async () => {
    mockAuthedFetch.mockResolvedValue(
      jsonResponse({ detail: "Could not validate credentials" }, 401),
    );

    expect(await sendFriendRequest("bob")).toEqual({ error: SESSION_EXPIRED });
  });
});
