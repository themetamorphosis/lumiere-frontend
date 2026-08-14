"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import Avatar, { displayName } from "@/components/social/Avatar";
import { searchUsers, sendFriendRequest } from "@/app/actions/social";
import type { Relationship, UserSearchResult } from "@/lib/types";

const DEBOUNCE_MS = 300;

const RELATIONSHIP_LABEL: Record<Exclude<Relationship, "none">, string> = {
  friends: "Friends",
  incoming: "Asked you",
  outgoing: "Requested",
  self: "You",
};

/**
 * Handle search and friend requests.
 *
 * Debounced because the backend rate-limits search at 30/minute — a request
 * per keystroke would exhaust that in about two seconds of typing.
 */
export default function AddFriend({ onChanged }: { onChanged: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const trimmed = query.trim().replace(/^@/, "");
  const tooShort = trimmed.length < 2;

  // Derived, not stored: results for a query the user has since backspaced
  // away are simply not rendered, rather than cleared by an effect.
  const visible = tooShort ? [] : results;

  useEffect(() => {
    if (tooShort) return;

    // Sequence number, so a slow early response can't overwrite the results
    // for what the user has since typed.
    const seq = ++requestSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchUsers(trimmed);
      if (seq !== requestSeq.current) return;
      setResults(found);
      setSearching(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, tooShort]);

  const handleAdd = async (user: UserSearchResult) => {
    setPendingId(user.id);
    const res = await sendFriendRequest(user.handle ?? "");
    setPendingId(null);

    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Request sent to @${user.handle}`);
    // Reflect the new state without a round trip; the panel refreshes too.
    setResults((prev) =>
      prev.map((r) =>
        r.id === user.id ? { ...r, relationship: "outgoing" as const } : r,
      ),
    );
    onChanged();
  };

  return (
    <div>
      <div className="relative flex items-center border border-tui-border bg-tui-input/60 focus-within:border-tui-amber">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-tui-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find someone by @handle"
          aria-label="Find someone by handle"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 pl-10 pr-9 text-sm text-tui-text placeholder:text-tui-text-muted focus:outline-none"
        />
        {searching && (
          <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-tui-text-muted" />
        )}
      </div>

      {!tooShort && !searching && results.length === 0 && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
          No handle matches that
        </p>
      )}

      {visible.length > 0 && (
        <ul className="mt-3 space-y-1">
          {visible.map((user) => (
            <li
              key={user.id}
              className="flex items-center gap-3 border border-tui-border bg-tui-input/30 p-2.5"
            >
              <Avatar user={user} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-tui-text">
                  {displayName(user)}
                </div>
                {user.handle && user.name && (
                  <div className="truncate font-mono text-[11px] text-tui-text-muted">
                    @{user.handle}
                  </div>
                )}
              </div>

              {user.relationship === "none" ? (
                <button
                  onClick={() => handleAdd(user)}
                  disabled={pendingId === user.id}
                  className="flex shrink-0 items-center gap-1.5 border border-tui-border bg-tui-panel px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-tui-text-muted transition-all hover:border-tui-amber hover:text-tui-amber disabled:opacity-50"
                >
                  {pendingId === user.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <UserPlus className="h-3 w-3" />
                  )}
                  Add
                </button>
              ) : (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-tui-text-muted">
                  {RELATIONSHIP_LABEL[user.relationship]}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
