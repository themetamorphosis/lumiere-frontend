"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import AddFriend from "@/components/social/AddFriend";
import Avatar, { displayName } from "@/components/social/Avatar";
import {
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "@/app/actions/social";
import type { FriendsOverview } from "@/lib/types";

export default function FriendsPanel({
  overview,
  loading,
  selectedId,
  onSelect,
  onChanged,
}: {
  overview: FriendsOverview;
  loading: boolean;
  selectedId: string | null;
  onSelect: (userId: string) => void;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const run = async (
    id: string,
    action: () => Promise<{ error?: string; success?: boolean }>,
    successMessage?: string,
  ) => {
    setBusyId(id);
    const res = await action();
    setBusyId(null);
    setConfirmingId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (successMessage) toast.success(successMessage);
    onChanged();
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <AddFriend onChanged={onChanged} />

      {/* Requests waiting on you come first — they're the only thing here
          that's actually asking for a decision. */}
      {overview.incoming.length > 0 && (
        <section>
          <SectionTitle>Requests · {overview.incoming.length}</SectionTitle>
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {overview.incoming.map((request) => (
                <motion.li
                  key={request.id}
                  layout
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 border border-tui-amber/30 bg-tui-amber/5 p-2.5"
                >
                  <Avatar user={request.user} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-tui-text">
                    {displayName(request.user)}
                  </span>
                  <button
                    onClick={() =>
                      run(
                        request.id,
                        () => acceptFriendRequest(request.id),
                        `You and ${displayName(request.user)} are now friends`,
                      )
                    }
                    disabled={busyId === request.id}
                    aria-label={`Accept ${displayName(request.user)}`}
                    className="flex h-7 w-7 items-center justify-center border border-tui-border bg-tui-panel text-tui-green transition-colors hover:border-tui-green disabled:opacity-50"
                  >
                    {busyId === request.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      run(request.id, () => declineFriendRequest(request.id))
                    }
                    disabled={busyId === request.id}
                    aria-label={`Decline ${displayName(request.user)}`}
                    className="flex h-7 w-7 items-center justify-center border border-tui-border bg-tui-panel text-tui-text-muted transition-colors hover:border-tui-red hover:text-tui-red disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <section className="flex-1">
        <SectionTitle>Friends · {overview.friends.length}</SectionTitle>

        {loading && overview.friends.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
            Loading...
          </p>
        ) : overview.friends.length === 0 ? (
          <p className="font-mono text-[11px] uppercase leading-relaxed tracking-wider text-tui-text-muted">
            No friends yet. Search a handle above to send the first request.
          </p>
        ) : (
          <ul className="space-y-1">
            {overview.friends.map((friend) => {
              const active = friend.user.id === selectedId;
              const confirming = confirmingId === friend.user.id;
              return (
                <li
                  key={friend.user.id}
                  // Siblings, not nested: a remove control inside the select
                  // button would be an interactive element inside an
                  // interactive element, which keyboards and screen readers
                  // cannot resolve.
                  className={`group flex items-center border transition-colors ${
                    active
                      ? "border-tui-amber/40 bg-tui-input"
                      : "border-transparent hover:border-tui-border hover:bg-tui-input/40"
                  }`}
                >
                  <button
                    onClick={() => onSelect(friend.user.id)}
                    aria-current={active}
                    className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left"
                  >
                    <Avatar user={friend.user} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-tui-text">
                        {displayName(friend.user)}
                      </span>
                      {friend.user.handle && friend.user.name && (
                        <span className="block truncate font-mono text-[11px] text-tui-text-muted">
                          @{friend.user.handle}
                        </span>
                      )}
                    </span>

                    {friend.unread > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center bg-tui-amber px-1.5 font-mono text-[10px] font-bold text-tui-bg">
                        {friend.unread > 99 ? "99+" : friend.unread}
                      </span>
                    )}
                  </button>

                  {confirming ? (
                    // Two steps, because the remove control sits a few pixels
                    // from the row you click to open a chat.
                    <span className="flex shrink-0 items-center gap-1 pr-2">
                      <button
                        onClick={() =>
                          run(
                            friend.user.id,
                            () => removeFriend(friend.user.id),
                            "Friend removed",
                          )
                        }
                        disabled={busyId === friend.user.id}
                        className="border border-tui-red/50 px-2 py-1 font-mono text-[10px] uppercase text-tui-red disabled:opacity-50"
                      >
                        {busyId === friend.user.id ? "..." : "Remove"}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        aria-label="Keep friend"
                        className="px-1.5 py-1 font-mono text-[10px] uppercase text-tui-text-muted hover:text-tui-text"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(friend.user.id)}
                      aria-label={`Remove ${displayName(friend.user)}`}
                      className="shrink-0 px-2.5 py-2.5 text-tui-text-muted opacity-0 transition-opacity hover:text-tui-red focus:opacity-100 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {overview.outgoing.length > 0 && (
        <section>
          <SectionTitle>Sent · {overview.outgoing.length}</SectionTitle>
          <ul className="space-y-1">
            {overview.outgoing.map((request) => (
              <li
                key={request.id}
                className="flex items-center gap-3 border border-tui-border/60 p-2.5 opacity-70"
              >
                <Avatar user={request.user} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-tui-text-muted">
                  {displayName(request.user)}
                </span>
                <button
                  onClick={() =>
                    run(request.id, () => declineFriendRequest(request.id))
                  }
                  className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-tui-text-muted transition-colors hover:text-tui-red"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-tui-text-muted">
      {children}
    </h2>
  );
}
