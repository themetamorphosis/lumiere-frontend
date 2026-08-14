"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import ChatPanel from "@/components/social/ChatPanel";
import FriendsPanel from "@/components/social/FriendsPanel";
import HandleBanner from "@/components/social/HandleBanner";
import { useSession } from "@/components/SessionProvider";
import { getFriends } from "@/app/actions/social";
import type { FriendsOverview } from "@/lib/types";

/** How often the friends list refreshes, for incoming requests and unread
 * counts. Slower than the open conversation, which polls itself. */
const OVERVIEW_INTERVAL_MS = 15_000;

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [] };

export default function SocialPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "";

  const [overview, setOverview] = useState<FriendsOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await getFriends();
    setOverview(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getFriends().then((next) => {
      if (cancelled) return;
      setOverview(next);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Background refresh for incoming requests and unread badges. Paused while
  // the tab is hidden, like the conversation poller.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, OVERVIEW_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Derived, never stored: an id that no longer resolves to a friend — because
  // either side removed the other — falls back to the placeholder on the next
  // refresh with no effect needed to clean it up.
  const selectedFriend = useMemo(
    () => overview.friends.find((f) => f.user.id === selectedId)?.user ?? null,
    [overview.friends, selectedId],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-tui-text">
          Social
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
          Friends · Messages
        </p>
      </header>

      <div className="mb-5">
        <HandleBanner />
      </div>

      <div className="grid h-[calc(100vh-19rem)] min-h-[30rem] grid-cols-1 border border-tui-border bg-tui-panel lg:grid-cols-[20rem_1fr]">
        {/* On mobile the two panes share the space: the list is the page until
            you pick someone, then the chat is. */}
        <div
          className={`min-h-0 border-tui-border lg:border-r ${
            selectedFriend ? "hidden lg:block" : "block"
          }`}
        >
          <FriendsPanel
            overview={overview}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={refresh}
          />
        </div>

        <div
          className={`min-h-0 ${selectedFriend ? "block" : "hidden lg:block"}`}
        >
          {selectedFriend ? (
            <ChatPanel
              key={selectedFriend.id}
              friend={selectedFriend}
              currentUserId={currentUserId}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <MessageSquare className="h-8 w-8 text-tui-text-muted/40" />
              <p className="font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
                {overview.friends.length === 0
                  ? "Add a friend to start talking"
                  : "Pick a friend to open the conversation"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
