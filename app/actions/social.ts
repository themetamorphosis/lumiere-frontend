"use server";

import { apiErrorMessage } from "@/lib/apiError";
import { authedFetch } from "@/lib/serverFetch";
import type {
  ChatMessage,
  Conversation,
  FriendsOverview,
  MessageAttachment,
  PublicUser,
  UserSearchResult,
} from "@/lib/types";
import {
  safeParseConversations,
  safeParseFriends,
  safeParseMessagePage,
  safeParseUserSearch,
} from "@/lib/validators";

const EMPTY_OVERVIEW: FriendsOverview = {
  friends: [],
  incoming: [],
  outgoing: [],
};

/** The backend sends `null` for absent optionals; the UI types use `undefined`. */
function user(raw: {
  id: string;
  handle?: string | null;
  name?: string | null;
  image?: string | null;
}): PublicUser {
  return {
    id: raw.id,
    handle: raw.handle ?? undefined,
    name: raw.name ?? undefined,
    image: raw.image ?? undefined,
  };
}

function message(raw: {
  id: string;
  senderId: string;
  recipientId: string;
  body?: string | null;
  attachment?: {
    title: string;
    mediaType: MessageAttachment["mediaType"];
    year?: number | null;
    coverUrl?: string | null;
  } | null;
  readAt?: string | null;
  createdAt?: string | null;
}): ChatMessage {
  return {
    id: raw.id,
    senderId: raw.senderId,
    recipientId: raw.recipientId,
    body: raw.body ?? undefined,
    attachment: raw.attachment
      ? {
          title: raw.attachment.title,
          mediaType: raw.attachment.mediaType,
          year: raw.attachment.year ?? undefined,
          coverUrl: raw.attachment.coverUrl ?? undefined,
        }
      : undefined,
    readAt: raw.readAt ?? undefined,
    createdAt: raw.createdAt ?? undefined,
  };
}

// --- Friends ---------------------------------------------------------------

export async function getFriends(): Promise<FriendsOverview> {
  const res = await authedFetch("/friends", { cache: "no-store" });
  if (!res.ok) return EMPTY_OVERVIEW;

  const parsed = safeParseFriends(await res.json());
  if (!parsed.success) {
    console.error("Friends validation failed:", parsed.error);
    return EMPTY_OVERVIEW;
  }

  return {
    friends: parsed.data.friends.map((f) => ({
      user: user(f.user),
      friendshipId: f.friendshipId,
      since: f.since ?? undefined,
      unread: f.unread,
    })),
    incoming: parsed.data.incoming.map((r) => ({
      id: r.id,
      user: user(r.user),
      createdAt: r.createdAt ?? undefined,
    })),
    outgoing: parsed.data.outgoing.map((r) => ({
      id: r.id,
      user: user(r.user),
      createdAt: r.createdAt ?? undefined,
    })),
  };
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const q = query.trim().replace(/^@/, "");
  // Mirrors the backend's minimum. Sending a 1-character query would only earn
  // a 422 and burn a rate-limit slot.
  if (q.length < 2) return [];

  const res = await authedFetch(`/friends/search?q=${encodeURIComponent(q)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];

  const parsed = safeParseUserSearch(await res.json());
  if (!parsed.success) {
    console.error("User search validation failed:", parsed.error);
    return [];
  }
  return parsed.data.results.map((r) => ({
    ...user(r),
    relationship: r.relationship,
  }));
}

export async function sendFriendRequest(handle: string) {
  const res = await authedFetch("/friends/requests", {
    method: "POST",
    body: JSON.stringify({ handle: handle.trim().replace(/^@/, "") }),
  });
  if (!res.ok) {
    return { error: await apiErrorMessage(res, "Could not send the request.") };
  }
  return { success: true };
}

export async function acceptFriendRequest(requestId: string) {
  const res = await authedFetch(`/friends/requests/${requestId}/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    return {
      error: await apiErrorMessage(res, "Could not accept the request."),
    };
  }
  return { success: true };
}

/** Declines a request sent to you, or cancels one you sent. */
export async function declineFriendRequest(requestId: string) {
  const res = await authedFetch(`/friends/requests/${requestId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    return {
      error: await apiErrorMessage(res, "Could not dismiss the request."),
    };
  }
  return { success: true };
}

export async function removeFriend(userId: string) {
  const res = await authedFetch(`/friends/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    return {
      error: await apiErrorMessage(res, "Could not remove the friend."),
    };
  }
  return { success: true };
}

// --- Messages --------------------------------------------------------------

export async function getConversations(): Promise<Conversation[]> {
  const res = await authedFetch("/messages", { cache: "no-store" });
  if (!res.ok) return [];

  const parsed = safeParseConversations(await res.json());
  if (!parsed.success) {
    console.error("Conversations validation failed:", parsed.error);
    return [];
  }
  return parsed.data.conversations.map((c) => ({
    user: user(c.user),
    lastMessage: c.lastMessage ? message(c.lastMessage) : undefined,
    unread: c.unread,
  }));
}

export async function getConversation(
  friendId: string,
  options: { since?: string; before?: string; limit?: number } = {},
): Promise<{ messages: ChatMessage[]; hasMore: boolean; ok: boolean }> {
  const params = new URLSearchParams();
  if (options.since) params.set("since", options.since);
  if (options.before) params.set("before", options.before);
  if (options.limit) params.set("limit", String(options.limit));

  const query = params.toString();
  const res = await authedFetch(
    `/messages/${friendId}${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );
  // `ok: false` is distinct from an empty conversation — the caller stops
  // polling on a failure rather than rendering it as "no messages".
  if (!res.ok) return { messages: [], hasMore: false, ok: false };

  const parsed = safeParseMessagePage(await res.json());
  if (!parsed.success) {
    console.error("Message page validation failed:", parsed.error);
    return { messages: [], hasMore: false, ok: false };
  }
  return {
    messages: parsed.data.messages.map(message),
    hasMore: parsed.data.has_more,
    ok: true,
  };
}

export async function sendMessage(
  friendId: string,
  payload: { body?: string; attachment?: MessageAttachment },
) {
  const res = await authedFetch(`/messages/${friendId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { error: await apiErrorMessage(res, "Message not sent.") };
  }
  return { success: true, message: message(await res.json()) };
}

export async function markConversationRead(friendId: string) {
  const res = await authedFetch(`/messages/${friendId}/read`, {
    method: "POST",
  });
  return res.ok ? { success: true } : { error: "Could not mark as read." };
}

export async function getUnreadTotal(): Promise<number> {
  const res = await authedFetch("/messages/unread", { cache: "no-store" });
  if (!res.ok) return 0;
  const data = await res.json();
  return typeof data?.unread === "number" ? data.unread : 0;
}

// --- Handle ----------------------------------------------------------------

export async function claimHandle(handle: string) {
  const res = await authedFetch("/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ handle: handle.trim().replace(/^@/, "") }),
  });
  if (!res.ok) {
    return { error: await apiErrorMessage(res, "Could not save the handle.") };
  }
  const data = await res.json();
  return { success: true, handle: data.handle as string };
}
