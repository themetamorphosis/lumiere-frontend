"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import SharePosterCard from "@/components/share/SharePosterCard";
import type {
  MediaType,
  PublicItem,
  PublicWatchlist,
  Status,
} from "@/lib/types";

const STATUS_TABS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "watched", label: "Watched" },
  { value: "pending", label: "Watching" },
  { value: "wishlist", label: "Wishlist" },
];

const TYPE_TABS: { value: MediaType | "all"; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV" },
  { value: "anime", label: "Anime" },
];

/** Only offer a tab the visitor can actually reach — a link scoped to
 * wishlist-only should not show three empty status tabs. */
function presentValues<T extends string>(
  items: PublicItem[],
  key: keyof PublicItem,
) {
  return new Set(items.map((i) => i[key] as T));
}

export default function PublicWatchlistView({
  data,
}: {
  data: PublicWatchlist;
}) {
  const [status, setStatus] = useState<Status | "all">("all");
  const [mediaType, setMediaType] = useState<MediaType | "all">("all");
  const [query, setQuery] = useState("");

  const statuses = useMemo(
    () => presentValues<Status>(data.items, "status"),
    [data.items],
  );
  const types = useMemo(
    () => presentValues<MediaType>(data.items, "mediaType"),
    [data.items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (mediaType !== "all" && item.mediaType !== mediaType) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.genres?.some((g) => g.toLowerCase().includes(q))
      );
    });
  }, [data.items, status, mediaType, query]);

  const ownerName = data.owner.name?.trim() || "Someone";
  const heading = data.label?.trim() || `${ownerName}'s watchlist`;

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-tui-bg text-tui-text">
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-24 pt-10 sm:px-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="border-b border-tui-border pb-8"
        >
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.25em] text-tui-text-muted transition-colors hover:text-tui-amber"
          >
            Lumière
          </Link>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4">
              <Avatar name={ownerName} image={data.owner.image} />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {heading}
                </h1>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
                  Shared by {ownerName} · Read only
                </p>
              </div>
            </div>

            <dl className="flex items-center gap-8">
              <Stat label="Titles" value={data.items.length} />
              <Stat
                label="Watched"
                value={data.items.filter((i) => i.status === "watched").length}
                tone="text-tui-green"
              />
              <Stat
                label="Wishlist"
                value={data.items.filter((i) => i.status === "wishlist").length}
                tone="text-tui-purple"
              />
            </dl>
          </div>
        </motion.header>

        {/* Filters */}
        {data.items.length > 0 && (
          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {statuses.size > 1 && (
                <TabGroup
                  tabs={STATUS_TABS.filter(
                    (t) => t.value === "all" || statuses.has(t.value as Status),
                  )}
                  value={status}
                  onChange={setStatus}
                />
              )}
              {types.size > 1 && (
                <TabGroup
                  tabs={TYPE_TABS.filter(
                    (t) => t.value === "all" || types.has(t.value as MediaType),
                  )}
                  value={mediaType}
                  onChange={setMediaType}
                />
              )}
            </div>

            <div className="relative flex items-center border border-tui-border bg-tui-input/60 focus-within:border-tui-amber lg:w-72">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-tui-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search this watchlist"
                placeholder="Search titles or genres"
                className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm text-tui-text placeholder:text-tui-text-muted focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Grid */}
        {visible.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {visible.map((item, i) => (
              <SharePosterCard key={item.id} item={item} index={i} />
            ))}
          </div>
        ) : (
          <p className="mt-24 text-center font-mono text-xs uppercase tracking-wider text-tui-text-muted">
            {data.items.length === 0
              ? "Nothing here yet"
              : "No titles match that filter"}
          </p>
        )}

        <footer className="mt-20 border-t border-tui-border pt-6 text-center font-mono text-[11px] uppercase tracking-wider text-tui-text-muted">
          Tracked with{" "}
          <Link href="/" className="text-tui-amber underline underline-offset-4">
            Lumière
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "text-tui-text",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-tui-text-muted">
        {label}
      </dt>
      <dd className={`mt-0.5 text-xl font-semibold leading-none ${tone}`}>
        {value}
      </dd>
    </div>
  );
}

function TabGroup<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center border border-tui-border bg-tui-input/60">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          aria-pressed={value === tab.value}
          className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            value === tab.value
              ? "bg-tui-input text-tui-amber"
              : "text-tui-text-muted hover:text-tui-text"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function Avatar({ name, image }: { name: string; image?: string }) {
  // Only absolute URLs: a stored `/uploads/...` path is served by the backend
  // origin and would 404 against the frontend's.
  const usable = image && /^https?:\/\//.test(image) ? image : null;

  if (usable) {
    // Plain <img>: the host is whatever the owner typed, and next/image
    // rejects anything outside next.config's remotePatterns.
    return (
      <img
        src={usable}
        alt=""
        className="h-14 w-14 border border-tui-border object-cover"
      />
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center border border-tui-border bg-tui-input font-mono text-xl text-tui-text-muted">
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
