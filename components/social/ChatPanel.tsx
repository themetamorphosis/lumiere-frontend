"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Film, Loader2, Send, X } from "lucide-react";
import AttachTitlePicker from "@/components/social/AttachTitlePicker";
import Avatar, { displayName } from "@/components/social/Avatar";
import MessageBubble from "@/components/social/MessageBubble";
import { useConversation } from "@/hooks/useConversation";
import type { MessageAttachment, PublicUser } from "@/lib/types";

export default function ChatPanel({
  friend,
  currentUserId,
  onBack,
}: {
  friend: PublicUser;
  currentUserId: string;
  onBack: () => void;
}) {
  const {
    messages,
    hasMore,
    loading,
    sending,
    error,
    send,
    loadOlder,
    markActive,
  } = useConversation(friend.id, currentUserId);

  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // Follow new messages, but only when already at the bottom — yanking the
  // view down while someone is reading back through history is worse than a
  // missed scroll.
  useEffect(() => {
    const newest = messages.at(-1);
    if (!newest || newest.id === lastIdRef.current) return;
    const first = lastIdRef.current === null;
    lastIdRef.current = newest.id;

    const el = scrollRef.current;
    const atBottom =
      !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;

    if (first || atBottom || newest.senderId === currentUserId) {
      bottomRef.current?.scrollIntoView({
        behavior: first ? "auto" : "smooth",
      });
    }
  }, [messages, currentUserId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body && !attachment) return;

    // Cleared up front so the input is ready for the next message; restored
    // only if the send actually failed.
    setDraft("");
    setAttachment(null);

    const res = await send({
      body: body || undefined,
      attachment: attachment ?? undefined,
    });

    if (res.error) {
      setDraft(body);
      setAttachment(attachment);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-tui-border px-4 py-3">
        <button
          onClick={onBack}
          aria-label="Back to friends"
          className="text-tui-text-muted hover:text-tui-text lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Avatar user={friend} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-tui-text">
            {displayName(friend)}
          </div>
          {friend.handle && friend.name && (
            <div className="truncate font-mono text-[11px] text-tui-text-muted">
              @{friend.handle}
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-tui-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-mono text-[11px] uppercase">Loading</span>
          </div>
        ) : (
          <>
            {hasMore && (
              <button
                onClick={loadOlder}
                className="mx-auto block border border-tui-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-tui-text-muted transition-colors hover:text-tui-text"
              >
                Load earlier
              </button>
            )}

            {messages.length === 0 && (
              <p className="py-12 text-center font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
                No messages yet. Say something.
              </p>
            )}

            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isMine={message.senderId === currentUserId}
              />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="border-t border-tui-red/40 bg-tui-red/10 px-4 py-2 font-mono text-[11px] uppercase text-tui-red">
          {error}
        </p>
      )}

      {/* Composer */}
      <div className="border-t border-tui-border p-3">
        {pickerOpen && (
          <div className="mb-2">
            <AttachTitlePicker
              onPick={(picked) => {
                setAttachment(picked);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        )}

        {attachment && (
          <div className="mb-2 flex items-center gap-2 border border-tui-amber/40 bg-tui-amber/5 px-3 py-2">
            <Film className="h-3.5 w-3.5 shrink-0 text-tui-amber" />
            <span className="min-w-0 flex-1 truncate text-sm text-tui-text">
              {attachment.title}
            </span>
            <button
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
              className="shrink-0 text-tui-text-muted hover:text-tui-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Attach a title"
            aria-expanded={pickerOpen}
            className={`flex h-10 w-10 shrink-0 items-center justify-center border transition-colors ${
              pickerOpen
                ? "border-tui-amber text-tui-amber"
                : "border-tui-border text-tui-text-muted hover:text-tui-text"
            }`}
          >
            <Film className="h-4 w-4" />
          </button>

          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              markActive();
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            rows={1}
            placeholder={`Message ${displayName(friend)}`}
            aria-label={`Message ${displayName(friend)}`}
            maxLength={2000}
            className="max-h-32 min-h-10 flex-1 resize-none border border-tui-border bg-tui-input/60 px-3 py-2.5 text-sm text-tui-text placeholder:text-tui-text-muted focus:border-tui-amber focus:outline-none"
          />

          <button
            type="submit"
            disabled={sending || (!draft.trim() && !attachment)}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-tui-border text-tui-text-muted transition-colors hover:border-tui-amber hover:text-tui-amber disabled:opacity-40 disabled:hover:border-tui-border disabled:hover:text-tui-text-muted"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
