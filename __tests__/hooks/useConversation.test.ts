import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/social", () => ({
  getConversation: vi.fn(),
  markConversationRead: vi.fn(),
  sendMessage: vi.fn(),
}));

import {
  getConversation,
  markConversationRead,
  sendMessage,
} from "@/app/actions/social";
import { useConversation } from "@/hooks/useConversation";

const mockGet = vi.mocked(getConversation);
const mockRead = vi.mocked(markConversationRead);
const mockSend = vi.mocked(sendMessage);

const ME = "u1";
const FRIEND = "u2";

function msg(id: string, from = FRIEND) {
  return {
    id,
    senderId: from,
    recipientId: from === ME ? FRIEND : ME,
    body: id,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

function page(messages: ReturnType<typeof msg>[], hasMore = false) {
  return { messages, hasMore, ok: true };
}

describe("useConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    // restoreAllMocks, not clearAllMocks: the visibilityState getter spy is
    // only undone by a restore, and leaking it leaves the next test's poller
    // paused on a hidden tab.
    vi.restoreAllMocks();
  });

  it("loads the conversation and marks it read on open", async () => {
    mockGet.mockResolvedValue(page([msg("m1")]));

    const { result } = renderHook(() => useConversation(FRIEND, ME));

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.loading).toBe(false);
    // Opening a conversation is reading it.
    expect(mockRead).toHaveBeenCalledWith(FRIEND);
  });

  it("clears state when no conversation is selected", async () => {
    const { result } = renderHook(() => useConversation(null, ME));

    expect(result.current.messages).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("surfaces a load failure instead of showing an empty thread", async () => {
    mockGet.mockResolvedValue({ messages: [], hasMore: false, ok: false });

    const { result } = renderHook(() => useConversation(FRIEND, ME));

    await waitFor(() =>
      expect(result.current.error).toBe("Could not load this conversation."),
    );
  });

  it("polls with a since cursor rather than refetching the thread", async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue(page([msg("m1")]));

    renderHook(() => useConversation(FRIEND, ME));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    mockGet.mockResolvedValue(page([]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    const pollCall = mockGet.mock.calls.at(-1);
    expect(pollCall?.[1]).toMatchObject({ since: "m1" });
  });

  it("appends polled messages without duplicating what is already shown", async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue(page([msg("m1")]));

    const { result } = renderHook(() => useConversation(FRIEND, ME));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // A poll that re-reports m1 alongside m2 — the send/poll race.
    mockGet.mockResolvedValue(page([msg("m1"), msg("m2")]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(result.current.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("does not poll while the tab is hidden", async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue(page([msg("m1")]));

    renderHook(() => useConversation(FRIEND, ME));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const afterLoad = mockGet.mock.calls.length;

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    // A tab left open on /social costs nothing.
    expect(mockGet.mock.calls.length).toBe(afterLoad);
  });

  it("stops polling after repeated failures", async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue(page([msg("m1")]));

    const { result } = renderHook(() => useConversation(FRIEND, ME));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    mockGet.mockResolvedValue({ messages: [], hasMore: false, ok: false });
    await act(async () => {
      // Five failures at the 2s active interval. `waitFor` cannot be used
      // here: it polls on real timers and would deadlock against the fake ones.
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current.error).toBe("Connection lost. Reload to resume.");

    const callsAtGiveUp = mockGet.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // Gave up rather than hammering a backend that is already failing.
    expect(mockGet.mock.calls.length).toBe(callsAtGiveUp);
  });

  it("appends the server's message on send", async () => {
    mockGet.mockResolvedValue(page([]));
    mockSend.mockResolvedValue({ success: true, message: msg("m9", ME) });

    const { result } = renderHook(() => useConversation(FRIEND, ME));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.send({ body: "hi" });
    });

    expect(result.current.messages.map((m) => m.id)).toEqual(["m9"]);
  });

  it("reports a send failure and adds nothing", async () => {
    mockGet.mockResolvedValue(page([]));
    mockSend.mockResolvedValue({ error: "Conversation not found" });

    const { result } = renderHook(() => useConversation(FRIEND, ME));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: { error?: string } = {};
    await act(async () => {
      outcome = await result.current.send({ body: "hi" });
    });

    expect(outcome.error).toBe("Conversation not found");
    expect(result.current.messages).toEqual([]);
  });

  it("prepends older messages in order", async () => {
    mockGet.mockResolvedValue(page([msg("m5")], true));

    const { result } = renderHook(() => useConversation(FRIEND, ME));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    mockGet.mockResolvedValue(page([msg("m3"), msg("m4")], false));
    await act(async () => {
      await result.current.loadOlder();
    });

    expect(result.current.messages.map((m) => m.id)).toEqual([
      "m3",
      "m4",
      "m5",
    ]);
  });
});
