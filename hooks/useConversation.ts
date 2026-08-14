"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getConversation,
  markConversationRead,
  sendMessage as sendMessageAction,
} from "@/app/actions/social";
import type { ChatMessage, MessageAttachment } from "@/lib/types";

/** While you're actively in the conversation. */
const ACTIVE_INTERVAL_MS = 2_000;

/** After a stretch with nothing arriving and no typing. */
const IDLE_INTERVAL_MS = 10_000;

/** How long after the last activity before backing off to the idle interval. */
const IDLE_AFTER_MS = 60_000;

/** Consecutive failures before the loop gives up rather than hammering. */
const MAX_CONSECUTIVE_ERRORS = 5;

const PAGE_SIZE = 50;

/**
 * A conversation with a friend, kept fresh by polling.
 *
 * The cadence is adaptive rather than fixed: 2s while you're actually in the
 * conversation, 10s once a minute has passed with no activity, and paused
 * entirely while the tab is hidden. A tab left open on /social overnight costs
 * nothing, and a live back-and-forth still feels immediate.
 *
 * Every request after the first sends `since=<last id>`, so a poll returns an
 * empty array rather than re-downloading the thread. Swapping this for SSE
 * later means replacing the interval — the rest of the contract holds.
 */
export function useConversation(
  friendId: string | null,
  currentUserId: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs, not state: the polling loop reads these without wanting to restart
  // itself every time one changes.
  const lastIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const errorCountRef = useRef(0);
  const inFlightRef = useRef(false);

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  /** Initial load — replaces everything and resets the cursor. */
  useEffect(() => {
    if (!friendId) {
      setMessages([]);
      setHasMore(false);
      lastIdRef.current = null;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    lastActivityRef.current = Date.now();
    errorCountRef.current = 0;

    getConversation(friendId, { limit: PAGE_SIZE }).then((page) => {
      if (cancelled) return;
      if (!page.ok) {
        setError("Could not load this conversation.");
        setLoading(false);
        return;
      }
      setMessages(page.messages);
      setHasMore(page.hasMore);
      lastIdRef.current = page.messages.at(-1)?.id ?? null;
      setLoading(false);
      // Opening a conversation is reading it.
      markConversationRead(friendId);
    });

    return () => {
      cancelled = true;
    };
  }, [friendId]);

  /** Poll for new messages. */
  useEffect(() => {
    if (!friendId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;

      const hidden =
        typeof document !== "undefined" &&
        document.visibilityState === "hidden";

      // A hidden tab polls nothing at all; the visibilitychange listener below
      // fires an immediate catch-up when it comes back.
      if (!hidden && !inFlightRef.current) {
        inFlightRef.current = true;
        try {
          const page = await getConversation(friendId, {
            since: lastIdRef.current ?? undefined,
            limit: PAGE_SIZE,
          });

          if (!cancelled) {
            if (!page.ok) {
              errorCountRef.current += 1;
              if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
                setError("Connection lost. Reload to resume.");
                inFlightRef.current = false;
                return; // Stop scheduling.
              }
            } else {
              errorCountRef.current = 0;
              if (page.messages.length > 0) {
                setMessages((prev) => merge(prev, page.messages));
                lastIdRef.current = page.messages.at(-1)!.id;
                lastActivityRef.current = Date.now();
                // Anything that arrived while the conversation is open is read
                // on arrival, so the badge never counts what's on screen.
                if (
                  page.messages.some((m) => m.recipientId === currentUserId)
                ) {
                  markConversationRead(friendId);
                }
              }
            }
          }
        } finally {
          inFlightRef.current = false;
        }
      }

      if (cancelled) return;
      const idle = Date.now() - lastActivityRef.current > IDLE_AFTER_MS;
      timer = setTimeout(tick, idle ? IDLE_INTERVAL_MS : ACTIVE_INTERVAL_MS);
    };

    timer = setTimeout(tick, ACTIVE_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        lastActivityRef.current = Date.now();
        clearTimeout(timer);
        timer = setTimeout(tick, 0);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [friendId, currentUserId]);

  const send = useCallback(
    async (payload: { body?: string; attachment?: MessageAttachment }) => {
      if (!friendId) return { error: "No conversation open" };
      setSending(true);
      markActive();
      const res = await sendMessageAction(friendId, payload);
      setSending(false);

      if (res.error) return { error: res.error };
      if (res.message) {
        // Append the server's row rather than an optimistic placeholder: it
        // carries the real id, which is the polling cursor.
        setMessages((prev) => merge(prev, [res.message!]));
        lastIdRef.current = res.message.id;
      }
      return { success: true };
    },
    [friendId, markActive],
  );

  const loadOlder = useCallback(async () => {
    if (!friendId || messages.length === 0) return;
    const page = await getConversation(friendId, {
      before: messages[0].id,
      limit: PAGE_SIZE,
    });
    if (!page.ok) return;
    setMessages((prev) => merge(page.messages, prev));
    setHasMore(page.hasMore);
  }, [friendId, messages]);

  return {
    messages,
    hasMore,
    loading,
    sending,
    error,
    send,
    loadOlder,
    markActive,
  };
}

/** Concatenate, dropping ids already present — a send and a poll can race. */
function merge(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  return added.length === 0 ? existing : [...existing, ...added];
}
