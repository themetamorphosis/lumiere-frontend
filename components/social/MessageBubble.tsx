"use client";

import { useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import TMDBImage from "@/components/ui/TMDBImage";
import { upsertItem } from "@/app/actions/items";
import type { ChatMessage } from "@/lib/types";

function timeLabel(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({
  message,
  isMine,
}: {
  message: ChatMessage;
  isMine: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const attachment = message.attachment;

  const handleAdd = async () => {
    if (!attachment) return;
    setAdding(true);
    const res = await upsertItem({
      title: attachment.title,
      mediaType: attachment.mediaType,
      // A recommendation lands in the wishlist, not as already-watched.
      status: "wishlist",
      favorite: false,
      year: attachment.year,
      coverUrl: attachment.coverUrl,
    });
    setAdding(false);

    if (res.error) {
      // The backend rejects a duplicate with a 400, which for this button is
      // the same practical outcome as success: the title is in the library.
      toast.error(`${attachment.title} is already in your library`);
      setAdded(true);
      return;
    }
    setAdded(true);
    toast.success(`${attachment.title} added to your wishlist`);
  };

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(28rem,85%)] border p-3 ${
          isMine
            ? "border-tui-amber/30 bg-tui-amber/5"
            : "border-tui-border bg-tui-input/40"
        }`}
      >
        {attachment && (
          <div className="mb-2 flex gap-3 border border-tui-border bg-tui-panel p-2">
            <div className="relative h-[72px] w-12 shrink-0 overflow-hidden bg-tui-input">
              {attachment.coverUrl ? (
                <TMDBImage
                  src={attachment.coverUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-[9px] text-tui-text-muted">
                  N/A
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-tui-text">
                  {attachment.title}
                </div>
                <div className="mt-0.5 font-mono text-[10px] uppercase text-tui-text-muted">
                  {[attachment.year, attachment.mediaType]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>

              {!isMine && (
                <button
                  onClick={handleAdd}
                  disabled={adding || added}
                  className="mt-1.5 flex w-fit items-center gap-1 border border-tui-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-tui-text-muted transition-colors hover:border-tui-amber hover:text-tui-amber disabled:opacity-60"
                >
                  {adding ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : added ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  {added ? "In library" : "Add"}
                </button>
              )}
            </div>
          </div>
        )}

        {message.body && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-tui-text">
            {message.body}
          </p>
        )}

        <time
          dateTime={message.createdAt}
          className="mt-1 block text-right font-mono text-[10px] text-tui-text-muted"
        >
          {timeLabel(message.createdAt)}
        </time>
      </div>
    </div>
  );
}
