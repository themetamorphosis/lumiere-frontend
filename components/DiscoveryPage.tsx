"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Film, Tv, Sparkles, Compass } from "lucide-react";
import { useRetroTheme } from "@/components/layout/RetroThemeContext";
import {
  getTrendingMedia,
  getMediaDetails,
  type TMDBSearchResult,
  type TMDBMediaDetails,
} from "@/lib/tmdb";
import {
  getItems,
  upsertItem,
  deleteItem,
  toggleFavorite,
} from "@/app/actions/items";
import type { Item, MediaType, Status } from "@/lib/types";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/discovery-constants";
import DetailOverlay from "@/components/discovery/DetailOverlay";
import DiscoverySpotlight from "@/components/discovery/DiscoverySpotlight";
import MediaCarouselRow, {
  type RowDefinition,
} from "@/components/discovery/MediaCarouselRow";

const INITIAL_ROWS: RowDefinition[] = [
  { id: "trending", title: "Trending Now", type: "trending" },
  { id: "popular", title: "Popular Choices", type: "popular" },
  { id: "top-rated", title: "Top Rated", type: "top-rated" },
];

export default function DiscoveryPage() {
  const { theme, scanlines } = useRetroTheme();
  // The provider's SSR default is already a retro theme, so server and first
  // client render agree — gating this on a mount flag only bought a frame of
  // the modern layout before it snapped to retro.
  const isRetro = theme.startsWith("retro");

  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [watchlist, setWatchlist] = useState<Item[]>([]);

  /* Infinite Scroll Rows */
  const [displayedRows, setDisplayedRows] =
    useState<RowDefinition[]>(INITIAL_ROWS);
  const [genreIndex, setGenreIndex] = useState(0);
  const [hasMoreRows, setHasMoreRows] = useState(true);

  /* Featured Spotlight Carousel */
  const [spotlightItems, setSpotlightItems] = useState<TMDBSearchResult[]>([]);
  const [spotlightIdx, setSpotlightIdx] = useState<number>(0);
  const [loadingSpotlight, setLoadingSpotlight] = useState(true);

  /* Deep Details state */
  const [selectedItem, setSelectedItem] = useState<TMDBSearchResult | null>(
    null,
  );
  const [details, setDetails] = useState<TMDBMediaDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [playTrailer, setPlayTrailer] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [showRatingSelector, setShowRatingSelector] = useState(false);

  const handleSelectItem = (item: TMDBSearchResult | null) => {
    setSelectedItem(item);
    setPlayTrailer(false);
    setShowRatingSelector(false);
    setDetails(null);
    if (item) {
      setLoadingDetails(true);
      const saved = localStorage.getItem(`user_rating_${item.tmdbId}`);
      setUserRating(saved ? Number(saved) : null);
    } else {
      setLoadingDetails(false);
      setUserRating(null);
    }
  };

  const handleRate = (rating: number) => {
    setUserRating(rating);
    if (selectedItem) {
      localStorage.setItem(
        `user_rating_${selectedItem.tmdbId}`,
        String(rating),
      );
    }
    setShowRatingSelector(false);
  };

  const handleClearRate = () => {
    setUserRating(null);
    if (selectedItem) {
      localStorage.removeItem(`user_rating_${selectedItem.tmdbId}`);
    }
    setShowRatingSelector(false);
  };

  /* ── Fetch User Watchlist ─────────────────────────────────── */
  const loadWatchlist = useCallback(() => {
    getItems()
      .then((items) => setWatchlist(items))
      .catch((err) => console.error("Failed to load watchlist:", err));
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const getWatchlistItem = useCallback(
    (res: TMDBSearchResult | null) => {
      if (!res) return undefined;
      return watchlist.find(
        (w) =>
          w.title.toLowerCase() === res.title.toLowerCase() &&
          w.mediaType === res.mediaType,
      );
    },
    [watchlist],
  );

  /* ── Fetch Spotlight Items (Top Trending) ─────────────────── */
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSpotlight(true);
    getTrendingMedia(mediaType, "week", controller.signal)
      .then((res) => {
        if (!controller.signal.aborted && res.length > 0) {
          setSpotlightItems(res.slice(0, 5));
          setSpotlightIdx(0);
          setLoadingSpotlight(false);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          console.error("Failed to fetch spotlight titles:", err);
          setLoadingSpotlight(false);
        }
      });

    return () => controller.abort();
  }, [mediaType]);

  useEffect(() => {
    if (spotlightItems.length === 0 || loadingSpotlight) return;
    const interval = setInterval(() => {
      setSpotlightIdx((prev) => (prev + 1) % spotlightItems.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [spotlightItems, loadingSpotlight]);

  const spotlightItem = spotlightItems[spotlightIdx];

  /* ── Infinite Scroll Row Logic ───────────────────────────── */
  // Reset rows when mediaType changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayedRows(INITIAL_ROWS);
    setGenreIndex(0);
    setHasMoreRows(true);
  }, [mediaType]);

  // Safely use a ref for the index so we don't have side effects inside state updaters
  const genreIndexRef = useRef(genreIndex);
  useEffect(() => {
    genreIndexRef.current = genreIndex;
  }, [genreIndex]);

  const handleLoadMoreRows = useCallback(() => {
    const genres = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES;
    const currentIdx = genreIndexRef.current;

    if (currentIdx >= genres.length) {
      setHasMoreRows(false);
      return;
    }

    // Load next 2 genres
    const nextGenres = genres.slice(currentIdx, currentIdx + 2);
    const newRows: RowDefinition[] = nextGenres.map((g) => ({
      id: `genre-${g.id}`,
      title: g.name,
      type: "genre",
      genreId: g.id,
    }));

    setDisplayedRows((prev) => {
      // Prevent duplicates by checking IDs
      const uniqueNewRows = newRows.filter(
        (nr) => !prev.some((pr) => pr.id === nr.id),
      );
      return [...prev, ...uniqueNewRows];
    });
    setGenreIndex(currentIdx + 2);

    if (currentIdx + 2 >= genres.length) {
      setHasMoreRows(false);
    }
  }, [mediaType]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!hasMoreRows) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMoreRows();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [hasMoreRows, handleLoadMoreRows],
  );

  /* ── Fetch Deep Details for Selected Item ───────────────── */
  useEffect(() => {
    if (!selectedItem) return;

    const controller = new AbortController();
    getMediaDetails(
      selectedItem.tmdbId,
      selectedItem.mediaType as MediaType,
      controller.signal,
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setDetails(data);
          setLoadingDetails(false);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          console.error("Failed to fetch detailed info:", err);
          setLoadingDetails(false);
        }
      });

    return () => controller.abort();
  }, [selectedItem]);

  /* ── Watchlist Operations ────────────────────────────────── */
  const handleAddToWatchlist = async (
    media: TMDBSearchResult | TMDBMediaDetails,
    status: Status,
  ) => {
    const payload = {
      title: media.title,
      mediaType: (selectedItem?.mediaType as MediaType) || mediaType,
      status: status,
      favorite: false,
      genres: media.genres,
      description: media.overview || undefined,
      year: media.year || undefined,
      coverUrl: media.posterUrl || undefined,
      runtime: (media as TMDBMediaDetails).runtime || undefined,
    };

    const result = await upsertItem(payload);
    if (result.success) {
      toast.success(`Added "${media.title}" to ${status}`);
      loadWatchlist();
    } else {
      toast.error(result.error || "Failed to add to watchlist");
    }
  };

  const handleRemoveFromWatchlist = async (itemId: string) => {
    const result = await deleteItem(itemId);
    if (result.success) {
      toast.success("Removed from watchlist");
      loadWatchlist();
    } else {
      toast.error(result.error || "Failed to remove from watchlist");
    }
  };

  const handleToggleFavorite = async (itemId: string) => {
    const result = await toggleFavorite(itemId);
    if (result.success) {
      toast.success(
        result.favorite ? "Added to favorites" : "Removed from favorites",
      );
      loadWatchlist();
    } else {
      toast.error(result.error || "Failed to toggle favorite");
    }
  };

  return (
    <div
      className={`w-full min-h-screen bg-tui-bg text-tui-text ${
        isRetro
          ? `retro-container ${scanlines ? "retro-scanlines" : ""}`
          : "font-sans selection:bg-violet-500/30 selection:text-white"
      } pb-16 relative overflow-x-hidden`}
    >
      {/* ── CINEMATIC FULL-BLEED BACKDROP OVERLAY ── */}
      {!isRetro && spotlightItem && (
        <div className="absolute top-[-64px] left-0 w-full h-[620px] z-0 overflow-hidden pointer-events-none">
          <AnimatePresence mode="wait">
            {spotlightItem.backdropUrl && (
              <motion.div
                key={spotlightItem.backdropUrl}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 bg-cover bg-[center_top] filter brightness-[0.55] saturate-[1.15]"
                style={{ backgroundImage: `url(${spotlightItem.backdropUrl})` }}
              />
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-tui-bg via-tui-bg/70 via-tui-bg/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-tui-bg/75 via-transparent to-tui-bg/40" />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-[1800px] pt-8">
        {/* ── TOP NAV BAR & MEDIA SELECTOR ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-zinc-900/40 backdrop-blur-2xl border border-white/10 p-2 shadow-2xl mb-8 font-sans gap-4 sm:gap-0 mx-3 lg:mx-5">
          <div className="flex items-center gap-3 px-6 py-2">
            <div className="bg-white/10 p-2">
              <Compass className="h-5 w-5 text-tui-amber" />
            </div>
            <span className="font-bold text-white uppercase tracking-wider text-sm">
              Discovery Engine
            </span>
          </div>

          <div
            role="radiogroup"
            className="flex flex-col sm:flex-row items-stretch sm:items-center bg-black/40 p-1 border border-white/5 flex-1 sm:flex-none gap-1 sm:gap-0"
          >
            {(["movie", "tv", "anime"] as MediaType[]).map((type) => {
              const active = mediaType === type;
              const Icon =
                type === "movie" ? Film : type === "tv" ? Tv : Sparkles;
              const accentColor =
                type === "movie"
                  ? "text-tui-amber"
                  : type === "tv"
                    ? "text-tui-purple"
                    : "text-tui-green";
              return (
                <button
                  key={type}
                  onClick={() => setMediaType(type)}
                  className={`flex-1 sm:flex-none px-6 py-3 text-xs font-semibold uppercase flex items-center justify-center gap-2 transition-all duration-300 ${
                    active
                      ? `${accentColor} bg-white/10 shadow-lg`
                      : "text-tui-text-muted hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? accentColor : ""}`} />
                  <span className="inline">
                    {type === "tv" ? "TV Shows" : type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 lg:px-5">
          <DiscoverySpotlight
            spotlightItem={spotlightItem}
            spotlightItems={spotlightItems}
            spotlightIdx={spotlightIdx}
            setSpotlightIdx={setSpotlightIdx}
            loadingSpotlight={loadingSpotlight}
            mediaType={mediaType}
            isRetro={isRetro}
            watchlistItem={getWatchlistItem(spotlightItem)}
            onSelect={handleSelectItem}
            onAdd={handleAddToWatchlist}
            onRemove={handleRemoveFromWatchlist}
          />
        </div>

        {/* ── UNLIMITED HORIZONTAL CAROUSEL ROWS ──────────────────────── */}
        <div className="flex flex-col w-full mt-6">
          {displayedRows.map((row) => (
            <MediaCarouselRow
              key={row.id}
              row={row}
              mediaType={mediaType}
              isRetro={isRetro}
              onOpen={handleSelectItem}
              onAdd={handleAddToWatchlist}
              onRemove={handleRemoveFromWatchlist}
              getWatchlistItem={getWatchlistItem}
            />
          ))}

          {/* Infinite Scroll Sentinel for Rows */}
          {hasMoreRows ? (
            <div
              ref={sentinelRef}
              className="flex justify-center pt-8 pb-16 w-full"
            >
              <div className="flex items-center gap-3 font-mono text-xs text-tui-amber uppercase tracking-widest">
                <div className="w-4 h-4 border-2 border-tui-amber border-t-transparent rounded-full animate-spin" />
                [ LOADING_CATEGORIES... ]
              </div>
            </div>
          ) : (
            <div className="text-center pt-8 pb-16 font-mono text-xs text-tui-text-muted uppercase tracking-widest">
              [ END_OF_CATEGORIES ]
            </div>
          )}
        </div>
      </div>

      <DetailOverlay
        selectedItem={selectedItem}
        details={details}
        loadingDetails={loadingDetails}
        playTrailer={playTrailer}
        userRating={userRating}
        showRatingSelector={showRatingSelector}
        isRetro={isRetro}
        watchlistItem={getWatchlistItem(selectedItem)}
        onClose={() => handleSelectItem(null)}
        onRate={handleRate}
        onClearRate={handleClearRate}
        onSetPlayTrailer={setPlayTrailer}
        onSetShowRatingSelector={setShowRatingSelector}
        onAddToWatchlist={handleAddToWatchlist}
        onRemoveFromWatchlist={handleRemoveFromWatchlist}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}
