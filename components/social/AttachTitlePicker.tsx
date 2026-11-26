"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { getItems } from "@/app/actions/items";
import type { LibraryLoad, MessageAttachment } from "@/lib/types";

/**
 * Pick something from your own library to attach to a message.
 *
 * Reads the library once when opened and filters in memory: it's the same list
 * the library page already holds, and a search-per-keystroke against the
 * backend would be a lot of traffic for a list of a few hundred titles.
 */
export default function AttachTitlePicker({
  onPick,
  onClose,
}: {
  onPick: (attachment: MessageAttachment) => void;
  onClose: () => void;
}) {
  const [library, setLibrary] = useState<LibraryLoad>();
  const [attempt, setAttempt] = useState(0);
  const items = library?.items;
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    getItems()
      .then((result) => { if (!cancelled) setLibrary(result); })
      .catch(() => { if (!cancelled) setLibrary({ items: [], state: "error" }); });
    return () => { cancelled = true; };
  }, [attempt]);

  const visible = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const pool = q
      ? items.filter((i) => i.title.toLowerCase().includes(q))
      : items;
    return pool.slice(0, 40);
  }, [items, query]);

  return (
    <div className="border border-tui-border bg-tui-panel">
      <div className="flex items-center justify-between border-b border-tui-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-tui-text-muted">
          Attach a title
        </span>
        <button
          onClick={onClose}
          aria-label="Close attachment picker"
          className="text-tui-text-muted hover:text-tui-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative flex items-center border-b border-tui-border">
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-tui-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library"
          aria-label="Search your library"
          autoFocus
          className="w-full bg-transparent py-2 pl-9 pr-3 text-sm text-tui-text placeholder:text-tui-text-muted focus:outline-none"
        />
      </div>

      <div className="max-h-56 overflow-y-auto">
        {library && library.state !== "complete" && (
          <p role="status" className="p-3 text-sm">
            {library.state === "partial" ? "The library view is incomplete." : "Could not load the library."}
            {" "}<button type="button" className="underline" onClick={() => setAttempt(attempt + 1)}>Retry</button>
          </p>
        )}
        {!library ? (
          <div className="flex items-center gap-2 p-4 text-tui-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-mono text-[11px] uppercase">
              Loading library
            </span>
          </div>
        ) : visible.length === 0 ? library.state === "complete" && (
          <p className="p-4 font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
            {!items?.length ? "Your library is empty" : "Nothing matches"}
          </p>
        ) : (
          <ul>
            {visible.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() =>
                    onPick({
                      title: item.title,
                      mediaType: item.mediaType,
                      year: item.year,
                      coverUrl: item.coverUrl,
                    })
                  }
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-tui-input"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-tui-text">
                    {item.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase text-tui-text-muted">
                    {[item.year, item.mediaType].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
