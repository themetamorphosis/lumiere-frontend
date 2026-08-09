"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getTrendingMedia,
  getPopularMedia,
  getTopRatedMedia,
  discoverMedia,
  type TMDBSearchResult,
} from "@/lib/tmdb";
import MediaDiscoverCard from "@/components/discovery/DiscoveryCard";
import type { MediaType, Status, Item } from "@/lib/types";

export type RowDefinition = {
  id: string;
  title: string;
  type: "trending" | "popular" | "top-rated" | "genre";
  genreId?: number;
};

/**
 * Column count per breakpoint. The fractional part is a deliberate peek — it
 * shows that the row continues without leaving an arbitrary sliver of a poster
 * clipped by the viewport edge, which is what a fixed pixel card width does.
 */
const TRACK_METRICS =
  "[--cols:2.25] [--gap:0.75rem] sm:[--cols:3.35] md:[--cols:4.35] lg:[--cols:4.85] lg:[--gap:1rem] xl:[--cols:5.85] 2xl:[--cols:6.35]";

/** Cards fill the row exactly: N columns plus N-1 gaps span the content box. */
const CARD_WIDTH = "w-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))]";

interface MediaCarouselRowProps {
  row: RowDefinition;
  mediaType: MediaType;
  isRetro: boolean;
  onOpen: (item: TMDBSearchResult) => void;
  onAdd: (item: TMDBSearchResult, status: Status) => void;
  onRemove: (id: string) => void;
  getWatchlistItem: (item: TMDBSearchResult | null) => Item | undefined;
}

export default function MediaCarouselRow({
  row,
  mediaType,
  isRetro,
  onOpen,
  onAdd,
  onRemove,
  getWatchlistItem,
}: MediaCarouselRowProps) {
  const [items, setItems] = useState<TMDBSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const fetchData = async () => {
      try {
        let data: TMDBSearchResult[] = [];
        if (row.type === "trending") {
          data = await getTrendingMedia(mediaType, "week", controller.signal);
        } else if (row.type === "popular") {
          data = await getPopularMedia(mediaType, 1, controller.signal);
        } else if (row.type === "top-rated") {
          data = await getTopRatedMedia(mediaType, 1, controller.signal);
        } else if (row.type === "genre" && row.title) {
          data = await discoverMedia(
            { type: mediaType, genre: row.title, page: 1 },
            controller.signal,
          );
        }

        if (mounted && data && data.length > 0) {
          setItems(data);
          setLoading(false);
        } else if (mounted) {
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [row, mediaType]);

  /* Which arrows are usable. Read straight off the scroller so it stays honest
     through resizes, font loading, and images settling. */
  const syncEdges = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    syncEdges();
    const observer = new ResizeObserver(syncEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncEdges, items.length]);

  /**
   * Advance by a whole number of cards rather than a fraction of the viewport,
   * so every click lands cards back on the gutter instead of drifting them
   * further out of alignment on each press.
   */
  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Fractional widths are the norm here, so measure with getBoundingClientRect
    // rather than the integer-rounded offsetLeft — six rounded strides would
    // otherwise drift the row several pixels off the gutter.
    const first = el.firstElementChild?.getBoundingClientRect();
    if (!first) return;
    const second = el.children[1]?.getBoundingClientRect();
    const stride = second ? second.left - first.left : first.width;
    if (stride <= 0) return;

    const perPage = Math.max(1, Math.floor(el.clientWidth / stride));
    el.scrollBy({
      left: (direction === "left" ? -1 : 1) * perPage * stride,
      behavior: "smooth",
    });
  };

  if (!loading && items.length === 0) return null;

  const arrowBase =
    "absolute top-0 bottom-6 z-20 w-10 lg:w-14 flex items-center justify-center transition-opacity duration-200 cursor-pointer";

  return (
    <div className="w-full relative py-2 mb-8 group/row">
      <h2 className="text-sm font-mono font-bold text-tui-text uppercase mb-4 tracking-widest pl-3 lg:pl-5 border-l-4 border-tui-amber">
        [ {row.title} ]
      </h2>

      <div className="relative">
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className={`${arrowBase} left-0 bg-gradient-to-r from-tui-bg via-tui-bg/80 to-transparent ${
            atStart
              ? "opacity-0 pointer-events-none"
              : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <ChevronLeft className="h-8 w-8 text-tui-amber drop-shadow-md" />
        </button>

        <div
          ref={scrollContainerRef}
          onScroll={syncEdges}
          className={`flex overflow-x-auto gap-[var(--gap)] px-3 lg:px-5 scroll-px-3 lg:scroll-px-5 pb-6 pt-2 snap-x snap-mandatory scrollbar-hide ${TRACK_METRICS}`}
        >
          {loading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`${CARD_WIDTH} shrink-0 snap-start bg-tui-panel border border-tui-border animate-pulse`}
                >
                  <div className="aspect-[2/3] w-full" />
                  <div className="h-[88px]" />
                </div>
              ))
            : items.map((item) => (
                <div
                  key={item.tmdbId}
                  className={`${CARD_WIDTH} shrink-0 snap-start relative`}
                >
                  <MediaDiscoverCard
                    item={item}
                    isRetro={isRetro}
                    onOpen={() => onOpen(item)}
                    onAdd={(status) => onAdd(item, status)}
                    onRemove={(id) => onRemove(id)}
                    dbItem={getWatchlistItem(item)}
                  />
                </div>
              ))}
        </div>

        <button
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className={`${arrowBase} right-0 bg-gradient-to-l from-tui-bg via-tui-bg/80 to-transparent ${
            atEnd
              ? "opacity-0 pointer-events-none"
              : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
          }`}
        >
          <ChevronRight className="h-8 w-8 text-tui-amber drop-shadow-md" />
        </button>
      </div>
    </div>
  );
}
