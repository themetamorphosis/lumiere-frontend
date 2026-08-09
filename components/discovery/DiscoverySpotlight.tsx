"use client";

import React, { useEffect, useRef } from "react";
import {
  Star,
  Plus,
  Check,
  Trash2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { TMDBSearchResult } from "@/lib/tmdb";
import type { Item, Status, MediaType } from "@/lib/types";
import TMDBImage from "@/components/ui/TMDBImage";

interface DiscoverySpotlightProps {
  spotlightItem: TMDBSearchResult | undefined;
  spotlightItems: TMDBSearchResult[];
  spotlightIdx: number;
  setSpotlightIdx?: React.Dispatch<React.SetStateAction<number>>;
  loadingSpotlight: boolean;
  mediaType: MediaType;
  isRetro: boolean;
  watchlistItem?: Item;
  onSelect: (item: TMDBSearchResult) => void;
  onAdd: (media: TMDBSearchResult, status: Status) => void;
  onRemove: (itemId: string) => void;
}

export default function DiscoverySpotlight({
  spotlightItem,
  spotlightItems,
  spotlightIdx,
  setSpotlightIdx,
  loadingSpotlight,
  mediaType,
  isRetro,
  watchlistItem,
  onSelect,
  onAdd,
  onRemove,
}: DiscoverySpotlightProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isProgrammaticScroll = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastObservedIdx = useRef(spotlightIdx);

  // The observer effect reads the current index but must not be torn down and
  // rebuilt every time it changes — that would drop and re-register every card
  // observation mid-scroll. A ref gives the callback the live value while
  // keeping the effect's dependencies honest.
  const spotlightIdxRef = useRef(spotlightIdx);
  useEffect(() => {
    spotlightIdxRef.current = spotlightIdx;
  }, [spotlightIdx]);

  // Intersection Observer to detect which card is centered in the scroll view
  useEffect(() => {
    if (isRetro || !setSpotlightIdx || spotlightItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return; // Prevent state fighting during manual button clicks

        let maxRatio = 0;
        let bestIdx = -1;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            const idx = Number(entry.target.getAttribute("data-idx"));
            if (!isNaN(idx)) bestIdx = idx;
          }
        });

        if (bestIdx !== -1 && maxRatio > 0.5) {
          if (
            bestIdx !== spotlightIdxRef.current &&
            !isProgrammaticScroll.current
          ) {
            lastObservedIdx.current = bestIdx;
            if (setSpotlightIdx) setSpotlightIdx(bestIdx);
          }
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: [0.3, 0.5, 0.8, 1.0], // Multiple thresholds for accurate center detection
      },
    );

    cardRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isRetro, setSpotlightIdx, spotlightItems.length]);

  // Handle auto-scroll when spotlightIdx changes externally (e.g. Next/Prev buttons)
  useEffect(() => {
    if (isRetro || !scrollContainerRef.current) return;

    // If the state changed because of our native scroll observer, do NOT programmatically scroll!
    if (spotlightIdx === lastObservedIdx.current) {
      return;
    }

    const targetCard = cardRefs.current[spotlightIdx];
    if (targetCard) {
      isProgrammaticScroll.current = true;
      lastObservedIdx.current = spotlightIdx; // sync it

      const container = scrollContainerRef.current;
      const scrollLeft =
        targetCard.offsetLeft -
        container.clientWidth / 2 +
        targetCard.clientWidth / 2;

      container.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });

      // Reset programmatic flag after smooth scroll finishes safely
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 800);
    }
  }, [spotlightIdx, isRetro]);

  if (loadingSpotlight || !spotlightItem || spotlightItems.length === 0) {
    if (loadingSpotlight) {
      return isRetro ? (
        <div className="border border-tui-border bg-tui-panel p-4 font-mono text-xs text-tui-text-muted mb-6">
          *** LOADING SPOTLIGHT METADATA ***
        </div>
      ) : (
        <div className="min-h-[400px] flex items-center justify-center font-mono text-xs text-tui-text-muted uppercase">
          [ FETCHING SPOTLIGHT METADATA... ]
        </div>
      );
    }
    return null;
  }

  const handleNext = () => {
    if (setSpotlightIdx) {
      setSpotlightIdx((prev) => Math.min(prev + 1, spotlightItems.length - 1));
    }
  };

  const handlePrev = () => {
    if (setSpotlightIdx) {
      setSpotlightIdx((prev) => Math.max(prev - 1, 0));
    }
  };

  return (
    <div className="relative min-h-[440px] mb-8 w-full py-8 group">
      {!isRetro ? (
        /* Native DOM Scrolling Cover Flow */
        <div className="relative w-full overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar w-full items-center min-h-[420px] sm:min-h-[460px] pb-6 gap-4 sm:gap-6"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              paddingLeft: "calc(50vw - min(40vw, 400px))", // Center the first item
              paddingRight: "calc(50vw - min(40vw, 400px))", // Center the last item
            }}
          >
            {spotlightItems.map((item, i) => {
              const isActive = i === spotlightIdx;

              return (
                <div
                  key={item.tmdbId}
                  data-idx={i}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  className={`relative shrink-0 w-[80vw] max-w-[800px] aspect-[16/9] md:aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl cursor-pointer snap-center transition-all duration-500 ease-out bg-zinc-900 border border-white/5
                    ${isActive ? "scale-100 opacity-100" : "scale-90 opacity-40 brightness-50"}`}
                  onClick={() => {
                    if (isActive) onSelect(item);
                    else if (setSpotlightIdx) setSpotlightIdx(i);
                  }}
                >
                  {/* Backdrop Image */}
                  {item.backdropUrl ? (
                    <TMDBImage
                      src={item.backdropUrl}
                      alt={item.title}
                      fill
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white font-mono opacity-50">
                      No Backdrop Available
                    </div>
                  )}

                  {/* Gradients */}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/40 via-transparent to-transparent pointer-events-none" />

                  {/* Content - Fade in/out based on active state using CSS */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 p-6 sm:p-10 text-left transition-all duration-500 pointer-events-none ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 pointer-events-auto">
                      <span className="px-3 py-0.5 rounded-full bg-tui-amber/90 text-black font-mono text-[10px] tracking-widest uppercase font-bold shadow-lg">
                        SPOTLIGHT // {mediaType.toUpperCase()}
                      </span>
                      {item.voteAverage && (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-400 font-mono drop-shadow-md bg-black/40 px-2 py-0.5 rounded-full">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {item.voteAverage.toFixed(1)}
                        </span>
                      )}
                      <span className="text-white/70 text-xs font-mono bg-black/40 px-2 py-0.5 rounded-full drop-shadow-md">
                        {item.year || "N/A"}
                      </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-3 drop-shadow-2xl">
                      {item.title}
                    </h1>

                    <p className="text-sm md:text-base text-zinc-200 leading-relaxed max-w-2xl line-clamp-2 drop-shadow-md hidden sm:block mb-6">
                      {item.overview || "No description available."}
                    </p>

                    <div className="flex items-center gap-3 pt-2 pointer-events-auto">
                      {isActive && watchlistItem ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove(watchlistItem.id);
                            }}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-all shadow-xl backdrop-blur-md border border-red-400/30"
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(item);
                            }}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 text-white border border-white/40 rounded-xl text-sm font-semibold transition-all backdrop-blur-md shadow-xl"
                          >
                            <Bookmark className="h-4 w-4" /> Details
                          </button>
                        </>
                      ) : isActive && !watchlistItem ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdd(item, "watched");
                            }}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-white hover:bg-neutral-200 text-zinc-950 rounded-xl text-sm font-bold transition-all shadow-xl"
                          >
                            <Check className="h-4 w-4" />{" "}
                            <span className="hidden sm:inline">
                              Mark Watched
                            </span>
                            <span className="sm:hidden">Watched</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdd(item, "wishlist");
                            }}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-black/40 hover:bg-black/60 border border-white/20 text-white rounded-xl text-sm font-semibold transition-all backdrop-blur-md shadow-xl"
                          >
                            <Plus className="h-4 w-4" /> Add to Wishlist
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls (Visible on Hover) */}
          {setSpotlightIdx && (
            <>
              <button
                onClick={handlePrev}
                disabled={spotlightIdx === 0}
                className={`absolute left-[5%] top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/50 text-white border border-white/20 hover:bg-white/20 hover:scale-110 transition-all backdrop-blur-md shadow-2xl ${spotlightIdx === 0 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                disabled={spotlightIdx === spotlightItems.length - 1}
                className={`absolute right-[5%] top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/50 text-white border border-white/20 hover:bg-white/20 hover:scale-110 transition-all backdrop-blur-md shadow-2xl ${spotlightIdx === spotlightItems.length - 1 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"}`}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Pagination Indicators */}
          <div className="absolute bottom-[-10px] left-0 right-0 flex justify-center gap-2 z-40">
            {spotlightItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSpotlightIdx && setSpotlightIdx(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === spotlightIdx
                    ? "w-8 bg-tui-amber shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                    : "w-3 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
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
      ) : (
        /* Retro TUI Rolling Spotlight */
        <div className="w-full relative py-4">
          <div className="flex items-center justify-between mb-4 pl-2 font-mono">
            <div className="text-tui-amber font-bold uppercase tracking-widest text-sm border-l-4 border-tui-amber pl-3">
              [ FEATURED_SPOTLIGHT ]
            </div>
            {setSpotlightIdx && (
              <div className="flex gap-4 text-tui-text-muted text-xs">
                <button onClick={handlePrev} className="hover:text-tui-amber">
                  {"<<< PREV"}
                </button>
                <button onClick={handleNext} className="hover:text-tui-amber">
                  {"NEXT >>>"}
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-4 overflow-hidden min-h-[300px] justify-center px-4">
            {spotlightItems.map((item, i) => {
              const isActive = i === spotlightIdx;

              // Only render the active one and the immediate next/prev for performance and cleaner TUI look
              let diff = i - spotlightIdx;
              if (diff > Math.floor(spotlightItems.length / 2))
                diff -= spotlightItems.length;
              if (diff < -Math.floor(spotlightItems.length / 2))
                diff += spotlightItems.length;

              if (Math.abs(diff) > 1) return null; // hide distant cards in retro mode

              return (
                <div
                  key={item.tmdbId}
                  onClick={() => setSpotlightIdx && setSpotlightIdx(i)}
                  className={`
                    relative flex-shrink-0 transition-all duration-300 cursor-pointer border 
                    ${isActive ? "w-[75%] sm:w-[60%] opacity-100 border-tui-amber z-20 scale-100 bg-tui-panel shadow-[0_0_15px_rgba(251,191,36,0.15)]" : "w-[15%] sm:w-[15%] opacity-30 border-tui-border hover:opacity-60 hover:border-tui-text z-10 bg-tui-bg flex items-center justify-center overflow-hidden"}
                  `}
                >
                  {isActive && (
                    <div className="absolute -top-3 right-4 bg-tui-bg px-2 text-tui-amber text-[10px] font-bold uppercase z-10 border border-tui-amber">
                      ACTIVE
                    </div>
                  )}
                  {isActive ? (
                    <div className="flex flex-col md:flex-row h-full">
                      <div className="relative aspect-[2/3] w-full md:w-1/3 border-b md:border-b-0 md:border-r border-tui-border shrink-0">
                        {item.posterUrl ? (
                          <TMDBImage
                            src={item.posterUrl}
                            alt={item.title}
                            fill
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-tui-text-muted uppercase text-center p-2">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-4 sm:p-6 font-mono flex flex-col justify-between w-full">
                        <div>
                          <div className="text-tui-text font-bold uppercase text-lg sm:text-2xl truncate mb-1 text-wrap line-clamp-2 leading-tight">
                            {item.title}
                          </div>
                          <div className="flex gap-3 text-tui-text-muted text-[10px] mb-4">
                            <span>YR: {item.year || "N/A"}</span>
                            {item.voteAverage && (
                              <span>RTG: {item.voteAverage.toFixed(1)}</span>
                            )}
                          </div>
                          <div className="text-tui-text-muted text-xs leading-relaxed line-clamp-4 mb-4">
                            {item.overview || "No description available."}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          {watchlistItem ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemove(watchlistItem.id);
                              }}
                              className="px-4 py-2 text-xs border border-red-900 text-red-500 hover:bg-red-900/20 uppercase transition-colors"
                            >
                              [REMOVE]
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdd(item, "watched");
                                }}
                                className="px-4 py-2 text-xs border border-tui-green text-tui-green hover:bg-tui-green/10 uppercase transition-colors"
                              >
                                [+WATCHED]
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAdd(item, "wishlist");
                                }}
                                className="px-4 py-2 text-xs border border-tui-border text-tui-text-muted hover:border-tui-amber hover:text-tui-amber uppercase transition-colors"
                              >
                                [+WISHLIST]
                              </button>
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(item);
                            }}
                            className="px-4 py-2 text-xs border border-tui-border text-tui-text-muted hover:bg-tui-text hover:text-black uppercase transition-colors ml-auto"
                          >
                            [DETAILS]
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full p-2 flex flex-col items-center justify-center font-mono">
                      <div className="rotate-90 sm:rotate-0 text-tui-text-muted font-bold text-xs whitespace-nowrap overflow-hidden text-ellipsis w-full text-center tracking-widest uppercase">
                        {item.title}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
