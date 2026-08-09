"use client";

import React, { useState, useEffect, useRef } from "react";
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

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth * 0.75
          : scrollLeft + clientWidth * 0.75;
      scrollContainerRef.current.scrollTo({
        left: scrollTo,
        behavior: "smooth",
      });
    }
  };

  if (!loading && items.length === 0) return null;

  return (
    <div className="w-full relative py-2 mb-8 group">
      <h2 className="text-sm font-mono font-bold text-tui-text uppercase mb-4 tracking-widest pl-2 sm:pl-4 border-l-4 border-tui-amber">
        [ {row.title} ]
      </h2>

      <div className="relative">
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 bottom-6 z-20 w-12 bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all flex items-center justify-center border-r-2 border-tui-amber/50 cursor-pointer"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-8 w-8 text-tui-amber drop-shadow-md" />
        </button>

        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-4 px-4 pb-6 pt-2 snap-x snap-mandatory hide-scrollbar"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-[160px] sm:min-w-[200px] h-[240px] sm:h-[300px] bg-tui-panel border border-tui-border animate-pulse shrink-0 snap-start"
                />
              ))
            : items.map((item) => (
                <div
                  key={item.tmdbId}
                  className="min-w-[160px] sm:min-w-[200px] w-[160px] sm:w-[200px] shrink-0 snap-start relative group/card"
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
          className="absolute right-0 top-0 bottom-6 z-20 w-12 bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all flex items-center justify-center border-l-2 border-tui-amber/50 cursor-pointer"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-8 w-8 text-tui-amber drop-shadow-md" />
        </button>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `,
        }}
      />
    </div>
  );
}
