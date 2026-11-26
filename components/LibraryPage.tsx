"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Item, MediaType, Status } from "@/lib/types";
import TMDBImage from "@/components/ui/TMDBImage";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import MediaCard from "@/components/MediaCard";
import { toast } from "sonner";
import LibraryLoadNotice from "@/components/LibraryLoadNotice";
import { findCatalogTitle } from "@/lib/titleIdentity";
import EditorModal from "@/components/EditorModal";
import ImportModal from "@/components/ImportModal";
import TmdbSearchInput from "@/components/TmdbSearchInput";
import type { TMDBSearchResult } from "@/lib/tmdb";
import ExpandableCardOverlay from "@/components/ExpandableCardOverlay";
import EmptyState from "@/components/EmptyState";
import { useSession } from "@/components/SessionProvider";
import { useRetroTheme } from "@/components/layout/RetroThemeContext";
import { useLibraryData } from "@/hooks/useLibraryData";
import { useLibraryFilters } from "@/hooks/useLibraryFilters";
import { statusText } from "@/lib/utils";
import {
  Film,
  Tv,
  Sparkles,
  ChevronDown,
  Star,
  Heart,
  Share2,
  FilterX,
} from "lucide-react";

const SORT_OPTIONS: { value: "recent" | "title" | "year"; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "title", label: "Name (A → Z)" },
  { value: "year", label: "Release year" },
];

function SortDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: "recent" | "title" | "year") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, []);

  const current = SORT_OPTIONS.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={ref} className="relative h-full font-mono text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-5 h-full text-xs font-semibold text-tui-text-muted hover:text-tui-text transition-all uppercase hover:bg-tui-input"
      >
        <span>Sort: {current}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] bg-tui-panel border border-tui-border shadow-2xl p-1"
          >
            {SORT_OPTIONS.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 uppercase transition-all duration-150 ${
                    active
                      ? "bg-tui-input text-tui-amber font-bold"
                      : "text-tui-text-muted hover:bg-tui-input/50 hover:text-tui-text"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GenreDropdown({
  value,
  onChange,
  allGenres,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  allGenres: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, []);

  const currentLabel = value ? value.toUpperCase() : "ALL";

  return (
    <div ref={ref} className="relative h-full font-mono text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-5 h-full text-xs font-semibold text-tui-text-muted hover:text-tui-text transition-all uppercase hover:bg-tui-input"
      >
        <span>Genre: {currentLabel}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] max-h-[260px] overflow-y-auto bg-tui-panel border border-tui-border shadow-2xl p-1 scrollbar-thin"
          >
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 uppercase transition-all duration-150 ${
                value === null
                  ? "bg-tui-input text-tui-amber font-bold"
                  : "text-tui-text-muted hover:bg-tui-input/50 hover:text-tui-text"
              }`}
            >
              [ ALL GENRES ]
            </button>
            {allGenres.map((g) => {
              const active = g === value;
              return (
                <button
                  key={g}
                  onClick={() => {
                    onChange(active ? null : g);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 uppercase transition-all duration-150 ${
                    active
                      ? "bg-tui-input text-tui-amber font-bold"
                      : "text-tui-text-muted hover:bg-tui-input/50 hover:text-tui-text"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LibraryPage({
  mediaType,
  mode = "library",
}: {
  mediaType: MediaType;
  title: string;
  mode?: "library" | "wishlist";
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userId = session?.user?.id || "guest";

  const {
    items,
    ready,
    loadState,
    loadMessage,
    refreshItems,
    mounted,
    ensureCover,
    syncingRefs,
    handleUpsert,
    handleDelete,
    handleToggleFav,
    handleImport,
  } = useLibraryData(userId);

  const {
    query,
    setQuery,
    onlyFav,
    setOnlyFav,
    sort,
    setSort,
    genreFilter,
    setGenreFilter,
    allGenres,
    pageItems,
    filtered,
    renderItems,
    visibleCount,
    loadMoreRef,
  } = useLibraryFilters(items, mediaType, mode);

  // The CRT toggle itself lives in TopNavBar; this page only reads the value
  // to apply the scanline overlay.
  const { scanlines, theme } = useRetroTheme();

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<Item | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wv-library-viewmode");
        if (saved === "grid" || saved === "table")
          return saved as "grid" | "table";
      } catch {}
    }
    return "grid";
  });

  const handleSetViewMode = (mode: "grid" | "table") => {
    setViewMode(mode);
    try {
      localStorage.setItem("wv-library-viewmode", mode);
    } catch {}
  };

  // Poster enrichment for visible items
  useEffect(() => {
    if (!ready || renderItems.length === 0) return;

    const missing = renderItems.filter((it) => {
      if (syncingRefs.current.has(it.id)) return false;
      if (it.coverUrl && it.genres && it.genres.length > 0 && it.description)
        return false;
      try {
        if (sessionStorage.getItem(`wv-poster-skip-${it.id}`)) return false;
      } catch {}
      return true;
    });

    if (missing.length === 0) return;
    const batch = missing.slice(0, 4);
    batch.forEach((it) => {
      syncingRefs.current.add(it.id);
      ensureCover(it);
    });
  }, [renderItems, ready, ensureCover, syncingRefs]);

  const openFromTmdb = useCallback(
    async (result: TMDBSearchResult) => {
      if (findCatalogTitle(items, { ...result, mediaType })) {
        toast.info("This edition is already in your library.");
        return;
      }
      const now = Date.now();
      const newItem: Item = {
        id: crypto.randomUUID?.() ?? Math.random().toString(16).slice(2),
        title: result.title,
        tmdbId: result.tmdbId,
        mediaType,
        status: mode === "wishlist" ? "wishlist" : "watched",
        favorite: false,
        year: result.year ?? undefined,
        coverUrl: result.posterUrl
          ? result.posterUrl.replace("/w185/", "/w780/")
          : undefined,
        genres: result.genres,
        description: result.overview ?? undefined,
        createdAt: now,
        updatedAt: now,
      } as Item;

      await handleUpsert({
        title: newItem.title,
        tmdbId: newItem.tmdbId,
        mediaType: newItem.mediaType,
        status: newItem.status as Status,
        favorite: newItem.favorite,
        year: newItem.year,
        coverUrl: newItem.coverUrl,
        genres: newItem.genres,
        description: newItem.description,
      });
    },
    [mediaType, mode, handleUpsert, items],
  );

  const openEdit = useCallback((it: Item) => {
    setEditing({ ...it });
    setEditOpen(true);
  }, []);

  const openManualEntry = (title = "") => {
    const now = Date.now();
    setEditing({
      id: crypto.randomUUID(),
      title,
      mediaType,
      status: mode === "wishlist" ? "wishlist" : "watched",
      favorite: false,
      createdAt: now,
      updatedAt: now,
    });
    setEditOpen(true);
  };

  const editingExistingItem = editing !== null && items.some((item) => item.id === editing.id);
  const closeEditor = () => {
    setEditOpen(false);
    setEditing(null);
  };

  const basePath = mode === "wishlist" ? "/wishlist" : "/library";
  const SUB_TABS = [
    { href: `${basePath}/movies`, label: "Movies", icon: Film },
    { href: `${basePath}/tv`, label: "TV", icon: Tv },
    { href: `${basePath}/anime`, label: "Anime", icon: Sparkles },
  ];

  const activeBorderClass =
    mediaType === "movie"
      ? "border-tui-amber"
      : mediaType === "tv"
        ? "border-tui-purple"
        : "border-tui-green";
  const mediaPath = mediaType === "movie" ? "movies" : mediaType;

  const isRetro = mounted && theme.startsWith("retro");

  return (
    <div
      className={`w-full min-h-screen bg-tui-bg text-tui-text ${
        isRetro
          ? `retro-container ${!mounted || scanlines ? "retro-scanlines" : ""}`
          : "font-sans"
      } pb-10`}
    >
      <div className="relative z-10 mx-auto max-w-[1800px] px-3 lg:px-5 pt-8 pb-10">
        {/* PREMIUM GLASSMORPHISM TOOLBAR (SHARP EDGES) */}
        <div className="flex flex-col gap-4 mb-10 font-sans">
          {/* TOP ROW: Navigation & Stats */}
          <div
            className={`flex flex-col xl:flex-row justify-between items-center gap-4 bg-tui-panel/80 border border-tui-border p-2 ${isRetro ? "" : "backdrop-blur-2xl shadow-2xl"}`}
          >
            {/* Left: Media Types & Categories */}
            <div className="flex flex-1 flex-col sm:flex-row w-full xl:w-auto gap-2">
              {/* Media Types Pill */}
              <div className="flex items-center bg-tui-input/60 p-1 border border-tui-border">
                {SUB_TABS.map((tab) => {
                  const isActive = pathname?.startsWith(tab.href);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-2 py-3 text-xs font-semibold transition-all duration-300 sm:px-4 ${
                        isActive
                          ? `bg-tui-input ${activeBorderClass.replace("border-", "text-")} shadow-lg`
                          : "text-tui-text-muted hover:text-tui-text hover:bg-tui-input/50"
                      }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Categories Pill */}
              <div className="flex items-center bg-tui-input/60 p-1 border border-tui-border flex-1">
                <Link
                  href={`/library/${mediaPath}`}
                  aria-current={mode === "library" ? "page" : undefined}
                  onClick={() => setOnlyFav(false)}
                  className={`flex-1 flex items-center justify-center px-4 py-3 text-xs font-semibold transition-all duration-300 ${
                    mode === "library" && !onlyFav
                      ? "text-tui-green bg-tui-input shadow-lg"
                      : "text-tui-text-muted hover:text-tui-text hover:bg-tui-input/50"
                  }`}
                >
                  WATCHED
                </Link>
                <Link
                  href={`/wishlist/${mediaPath}`}
                  aria-current={mode === "wishlist" ? "page" : undefined}
                  onClick={() => setOnlyFav(false)}
                  className={`flex-1 flex items-center justify-center px-4 py-3 text-xs font-semibold transition-all duration-300 ${
                    mode === "wishlist" && !onlyFav
                      ? "text-tui-purple bg-tui-input shadow-lg"
                      : "text-tui-text-muted hover:text-tui-text hover:bg-tui-input/50"
                  }`}
                >
                  WISHLIST
                </Link>
                <button
                  onClick={() => setOnlyFav(!onlyFav)}
                  aria-label="Show favorites only"
                  aria-pressed={onlyFav}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-semibold transition-all duration-300 ${
                    onlyFav
                      ? "text-tui-amber bg-tui-input shadow-lg"
                      : "text-tui-text-muted hover:text-tui-text hover:bg-tui-input/50"
                  }`}
                >
                  <Star
                    className={`h-4 w-4 ${onlyFav ? "fill-current" : ""}`}
                  />
                  <span className="hidden sm:inline">FAVORITES</span>
                </button>
              </div>
            </div>

            {/* Right: Stats */}
            <div role="group" aria-label="Library totals" className="flex items-center justify-center gap-6 px-6 py-2 w-full xl:w-auto">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-tui-text-muted uppercase tracking-wider font-semibold">
                  TOTAL
                </span>
                <span className="text-xl font-bold text-tui-text leading-none mt-1">
                  {loadState === "complete" ? pageItems.length : "—"}
                </span>
              </div>
              <div className="w-px h-8 bg-tui-border"></div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-tui-text-muted uppercase tracking-wider font-semibold">
                  WATCHED
                </span>
                <span className="text-xl font-bold text-tui-green leading-none mt-1">
                  {loadState === "complete" ? pageItems.filter((it) => it.status === "watched").length : "—"}
                </span>
              </div>
              <div className="w-px h-8 bg-tui-border"></div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-tui-text-muted uppercase tracking-wider font-semibold">
                  WISHLIST
                </span>
                <span className="text-xl font-bold text-tui-purple leading-none mt-1">
                  {loadState === "complete" ? pageItems.filter((it) => it.status === "wishlist").length : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Search & Actions */}
          <div
            className={`flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-tui-panel/80 border border-tui-border p-2 ${isRetro ? "" : "backdrop-blur-2xl shadow-2xl"}`}
          >
            {/* Search Library */}
            <div className="flex-1 w-full relative flex items-center bg-tui-input/60 border border-tui-border group transition-all focus-within:border-tui-amber focus-within:bg-tui-input overflow-hidden">
              <span className="absolute left-4 text-tui-text-muted text-xs font-semibold flex items-center gap-2">
                <Film className="h-4 w-4" />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search your library"
                placeholder="Search titles, genres, years..."
                className="w-full h-full min-h-[52px] bg-transparent pl-12 pr-12 text-sm font-medium text-tui-text placeholder:text-tui-text-muted focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 p-1.5 text-tui-text-muted hover:text-tui-text hover:bg-tui-input transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Actions Toolbar */}
            <div id="add-title" role="group" aria-label="Add to your library" tabIndex={-1} className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="flex flex-1 lg:flex-none items-center bg-tui-input/60 border border-tui-border px-2 h-[52px]">
                <TmdbSearchInput
                  mediaType={mediaType}
                  onSelect={openFromTmdb}
                  onAddManually={openManualEntry}
                  placeholder="Add from TMDB..."
                />
              </div>
              <button
                type="button"
                onClick={() => openManualEntry()}
                className="flex h-[52px] items-center justify-center border border-tui-border bg-tui-input/60 px-4 text-xs font-semibold uppercase text-tui-text hover:bg-tui-input"
              >
                Add manually
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="px-5 h-[52px] flex items-center justify-center text-xs font-semibold text-tui-text-muted hover:text-tui-text bg-tui-input/60 border border-tui-border hover:bg-tui-input transition-all uppercase"
              >
                Import
              </button>
              <Link
                href="/profile#share"
                className="px-5 h-[52px] flex items-center justify-center gap-2 text-xs font-semibold text-tui-text-muted hover:text-tui-text bg-tui-input/60 border border-tui-border hover:bg-tui-input transition-all uppercase"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Link>

              <div className="flex items-center h-[52px] bg-tui-input/60 border border-tui-border">
                <SortDropdown value={sort} onChange={setSort} />
              </div>

              {allGenres.length > 0 && (
                <div className="flex items-center h-[52px] bg-tui-input/60 border border-tui-border">
                  <GenreDropdown
                    value={genreFilter}
                    onChange={setGenreFilter}
                    allGenres={allGenres}
                  />
                </div>
              )}

              <button
                onClick={() =>
                  handleSetViewMode(viewMode === "grid" ? "table" : "grid")
                }
                className="px-5 h-[52px] flex items-center justify-center text-xs font-semibold text-tui-text-muted hover:text-tui-text bg-tui-input/60 border border-tui-border hover:bg-tui-input transition-all uppercase"
              >
                {mounted && viewMode === "table" ? "Grid" : "List"}
              </button>
            </div>
          </div>
        </div>

        {loadState === "loading" && items.length > 0 && (
          <p role="status" className="mb-4 text-sm">Showing saved titles while the library refreshes.</p>
        )}
        {(loadState === "error" || loadState === "partial") && (
          <LibraryLoadNotice partial={items.length > 0} message={loadMessage} onRetry={refreshItems} />
        )}

        {/* Media display grid/table */}

        <AnimatePresence mode="wait">
          {!mounted || (!ready && items.length === 0) ? (
            <SkeletonGrid count={24} cols="lg:grid-cols-5 xl:grid-cols-6" />
          ) : renderItems.length > 0 ? (
            mounted && viewMode === "table" ? (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-x-auto border border-tui-border bg-tui-panel mb-10"
              >
                <table className="retro-table">
                  <thead>
                    <tr>
                      <th className="w-16">POSTER</th>
                      <th>TITLE</th>
                      <th>YEAR</th>
                      <th>GENRES</th>
                      <th>STATUS</th>
                      <th className="text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderItems.map((item) => {
                      const isMovie = item.mediaType === "movie";
                      const isTv = item.mediaType === "tv";
                      const badgeColor = isMovie
                        ? "border-tui-amber/30 text-tui-amber bg-tui-amber/5"
                        : isTv
                          ? "border-tui-purple/30 text-tui-purple bg-tui-purple/5"
                          : "border-tui-green/30 text-tui-green bg-tui-green/5";
                      return (
                        <tr key={item.id} className="group">
                          <td>
                            <div
                              className="w-10 h-14 bg-tui-input border border-tui-border overflow-hidden cursor-pointer"
                              onClick={() => setExpandedItem(item)}
                            >
                              {item.coverUrl ? (
                                <TMDBImage
                                  src={item.coverUrl}
                                  alt={item.title}
                                  fill
                                  className="w-full h-full object-cover filter brightness-90 group-hover:brightness-100 transition-all"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[8px] text-tui-text-muted">
                                  N/A
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div
                              className="font-bold text-tui-text hover:text-tui-amber cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
                              onClick={() => setExpandedItem(item)}
                            >
                              <span>{item.title}</span>
                              {item.favorite && (
                                <Star className="h-3.5 w-3.5 fill-current text-tui-amber shrink-0" />
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="text-tui-text/80">
                              {item.year || "N/A"}
                            </span>
                          </td>
                          <td>
                            <span className="text-tui-text-muted text-[11px] uppercase">
                              {item.genres?.join(", ") || "NONE"}
                            </span>
                          </td>
                          <td>
                            <span className={`retro-badge ${badgeColor}`}>
                              {statusText(item.status)}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleToggleFav(item.id)}
                                className={`px-2 py-1 border text-[10px] uppercase transition-all flex items-center justify-center ${
                                  item.favorite
                                    ? "border-tui-amber text-tui-amber bg-tui-amber/10"
                                    : "border-tui-border text-tui-text-muted bg-tui-panel hover:border-tui-text hover:text-tui-text"
                                }`}
                              >
                                <Star
                                  className={`h-3 w-3 ${item.favorite ? "fill-current" : ""}`}
                                />
                              </button>
                              <button
                                onClick={() => openEdit(item)}
                                className="px-2 py-1 border border-tui-border text-tui-text-muted bg-tui-panel hover:border-tui-text hover:text-tui-text transition-all text-[10px] uppercase"
                              >
                                EDIT
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-2 py-1 border border-tui-border text-tui-text-muted bg-tui-panel hover:border-red-900/50 hover:text-red-400 transition-all text-[10px] uppercase"
                              >
                                DEL
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleCount < filtered.length && (
                      <tr>
                        <td
                          colSpan={6}
                          ref={loadMoreRef}
                          className="h-10 text-center text-tui-text-muted uppercase text-[10px]"
                        >
                          [ LOADING MORE TITLES ]
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-8 pb-10"
              >
                {renderItems.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    onOpen={() => setExpandedItem(item)}
                    onEdit={() => openEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                    onFav={() => handleToggleFav(item.id)}
                  />
                ))}
                {visibleCount < filtered.length && (
                  <div
                    ref={loadMoreRef}
                    className="col-span-full h-20 w-full"
                  />
                )}
              </motion.div>
            )
          ) : loadState === "complete" ? (
            <div
              key="empty"
              className="flex h-[40vh] items-center justify-center text-center w-full"
            >
              {query || onlyFav || genreFilter ? (
                <EmptyState
                  icon={<FilterX className="h-8 w-8 text-tui-text-muted" />}
                  headline="No titles match these filters"
                  subtext="Clear the filters to see all titles in this category."
                  ctaLabel="Clear filters"
                  onCta={() => {
                    setQuery("");
                    setOnlyFav(false);
                    setGenreFilter(null);
                  }}
                />
              ) : (
                <EmptyState
                  icon={mode === "wishlist" ? <Heart className="h-8 w-8" /> : <Film className="h-8 w-8" />}
                  headline={mode === "wishlist" ? "Your wishlist is empty" : "Add your first title"}
                  subtext="Search TMDB, add a title manually, or import a list."
                  ctaLabel="Add manually"
                  onCta={() => openManualEntry()}
                />
              )}
            </div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {expandedItem && (
            <ExpandableCardOverlay
              key={expandedItem.id}
              item={expandedItem}
              onClose={() => setExpandedItem(null)}
              onEdit={() => {
                const it = expandedItem;
                setExpandedItem(null);
                openEdit(it);
              }}
              onDelete={() => {
                handleDelete(expandedItem.id);
                setExpandedItem(null);
              }}
              onFav={() => {
                handleToggleFav(expandedItem.id);
                setExpandedItem((prev) =>
                  prev ? { ...prev, favorite: !prev.favorite } : null,
                );
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      {editOpen && editing && (
        <EditorModal
          item={editing}
          onClose={closeEditor}
          onChange={setEditing}
          onSave={async (payload) => {
            const saved = await handleUpsert(payload, editingExistingItem ? editing.id : undefined);
            if (saved) closeEditor();
          }}
          onDelete={editingExistingItem ? () => {
            handleDelete(editing.id);
            closeEditor();
          } : undefined}
        />
      )}

      {importOpen && (
        <ImportModal
          defaultMediaType={mediaType}
          onClose={() => setImportOpen(false)}
          defaultStatus={mode === "wishlist" ? "wishlist" : "watched"}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
