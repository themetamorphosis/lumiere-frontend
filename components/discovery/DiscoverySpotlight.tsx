"use client";

import React, { useRef, useState } from "react";
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

/**
 * Slide width and gutter. The track translates by exactly one stride
 * (`--sp-w` + `--sp-gap`) per index, and is padded by half the leftover width
 * so the active slide always lands dead centre with its neighbours peeking in.
 */
const TRACK_METRICS =
  "[--sp-w:86vw] [--sp-gap:0.75rem] sm:[--sp-w:78vw] lg:[--sp-w:min(64vw,880px)] lg:[--sp-gap:1.5rem]";

const SLIDE_HEIGHT = "h-[244px] sm:h-[340px] lg:h-[400px]";

/** Past this much horizontal travel a drag commits to the next slide. */
const DRAG_COMMIT_RATIO = 0.15;
const DRAG_COMMIT_MIN = 48;
/** Movement beyond this is a drag, not a click. */
const DRAG_SLOP = 8;

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
  const viewportRef = useRef<HTMLDivElement>(null);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  /* Set once a pointer travels past the slop, and read by the click handler so
     the gesture that ended a drag doesn't also open a detail overlay. */
  const draggedRef = useRef(false);

  const count = spotlightItems.length;

  const goTo = (idx: number) => {
    if (!setSpotlightIdx) return;
    setSpotlightIdx(Math.max(0, Math.min(idx, count - 1)));
  };

  const handlePrev = () => goTo(spotlightIdx - 1);
  const handleNext = () => goTo(spotlightIdx + 1);

  /* ── Pointer drag / touch swipe ───────────────────────────── */
  const onPointerDown = (e: React.PointerEvent) => {
    if (!setSpotlightIdx || (e.pointerType === "mouse" && e.button !== 0))
      return;
    dragStartX.current = e.clientX;
    draggedRef.current = false;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX.current;

    // Capture only once this is unambiguously a drag. Capturing on pointerdown
    // would retarget the subsequent click to this element, which would stop
    // every button inside a slide from firing.
    if (!draggedRef.current) {
      if (Math.abs(dx) <= DRAG_SLOP) return;
      draggedRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragDx(dx);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    const width = viewportRef.current?.clientWidth ?? 0;
    const threshold = Math.max(DRAG_COMMIT_MIN, width * DRAG_COMMIT_RATIO);

    if (dragDx <= -threshold) handleNext();
    else if (dragDx >= threshold) handlePrev();

    setDragging(false);
    setDragDx(0);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handlePrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleNext();
    }
  };

  /* A drag that moved is not a click — swallow the activation. */
  const activate = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (draggedRef.current) return;
    fn();
  };

  if (loadingSpotlight || !spotlightItem || count === 0) {
    if (loadingSpotlight) {
      return (
        <div
          className={`${SLIDE_HEIGHT} flex items-center justify-center border border-tui-border bg-tui-panel font-mono text-xs text-tui-text-muted uppercase tracking-widest mb-8`}
        >
          [ FETCHING SPOTLIGHT METADATA... ]
        </div>
      );
    }
    return null;
  }

  return (
    <section
      className="relative w-full mb-10 group/spot"
      aria-roledescription="carousel"
      aria-label="Featured spotlight"
    >
      {isRetro && (
        <div className="flex items-center justify-between mb-4 font-mono">
          <div className="text-tui-amber font-bold uppercase tracking-widest text-sm border-l-4 border-tui-amber pl-3">
            [ FEATURED_SPOTLIGHT ]
          </div>
          <div className="text-tui-text-muted text-[10px] uppercase tracking-widest">
            {String(spotlightIdx + 1).padStart(2, "0")} /{" "}
            {String(count).padStart(2, "0")}
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative overflow-hidden touch-pan-y outline-none ${TRACK_METRICS} ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div
          className="flex items-stretch"
          style={{
            gap: "var(--sp-gap)",
            paddingInline: "calc((100% - var(--sp-w)) / 2)",
            transform: `translate3d(calc(${-spotlightIdx} * (var(--sp-w) + var(--sp-gap)) + ${dragDx}px), 0, 0)`,
            transition: dragDx
              ? "none"
              : "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          {spotlightItems.map((item, i) => {
            const isActive = i === spotlightIdx;
            return (
              <article
                key={item.tmdbId}
                aria-hidden={!isActive}
                onClick={activate(() => (isActive ? onSelect(item) : goTo(i)))}
                style={{ width: "var(--sp-w)" }}
                className={`${SLIDE_HEIGHT} shrink-0 relative overflow-hidden select-none transition-[opacity,transform,filter] duration-500 ease-out ${
                  isRetro
                    ? `border bg-tui-panel ${isActive ? "border-tui-amber" : "border-tui-border"}`
                    : "rounded-2xl border border-white/10 bg-zinc-900"
                } ${
                  isActive
                    ? "opacity-100 scale-100"
                    : "opacity-45 scale-[0.94] brightness-[0.55] saturate-[0.7]"
                }`}
              >
                {/* Inert keeps a peeking slide's buttons out of the tab order
                    and out of hit testing, so a click on it falls through to
                    the article and simply brings that slide forward. */}
                {isRetro ? (
                  <RetroSlide
                    item={item}
                    isActive={isActive}
                    inert={!isActive}
                    watchlistItem={isActive ? watchlistItem : undefined}
                    priority={i === 0}
                    onSelect={activate(() => onSelect(item))}
                    onAdd={(status) => activate(() => onAdd(item, status))}
                    onRemove={(id) => activate(() => onRemove(id))}
                  />
                ) : (
                  <ModernSlide
                    item={item}
                    isActive={isActive}
                    inert={!isActive}
                    mediaType={mediaType}
                    watchlistItem={isActive ? watchlistItem : undefined}
                    priority={i === 0}
                    onSelect={activate(() => onSelect(item))}
                    onAdd={(status) => activate(() => onAdd(item, status))}
                    onRemove={(id) => activate(() => onRemove(id))}
                  />
                )}
              </article>
            );
          })}
        </div>

        {/* Edge fades so neighbouring slides dissolve out rather than being cut. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[8%] bg-gradient-to-r from-tui-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[8%] bg-gradient-to-l from-tui-bg to-transparent" />
      </div>

      {setSpotlightIdx && (
        <>
          <button
            onClick={handlePrev}
            disabled={spotlightIdx === 0}
            aria-label="Previous featured title"
            className={`absolute left-2 lg:left-6 top-1/2 -translate-y-1/2 z-30 p-3 transition-all duration-200 ${
              isRetro
                ? "border border-tui-border bg-tui-bg text-tui-text-muted hover:border-tui-amber hover:text-tui-amber"
                : "rounded-full bg-black/50 text-white border border-white/20 hover:bg-white/20 backdrop-blur-md"
            } ${
              spotlightIdx === 0
                ? "opacity-0 pointer-events-none"
                : "opacity-0 group-hover/spot:opacity-100 focus-visible:opacity-100"
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNext}
            disabled={spotlightIdx === count - 1}
            aria-label="Next featured title"
            className={`absolute right-2 lg:right-6 top-1/2 -translate-y-1/2 z-30 p-3 transition-all duration-200 ${
              isRetro
                ? "border border-tui-border bg-tui-bg text-tui-text-muted hover:border-tui-amber hover:text-tui-amber"
                : "rounded-full bg-black/50 text-white border border-white/20 hover:bg-white/20 backdrop-blur-md"
            } ${
              spotlightIdx === count - 1
                ? "opacity-0 pointer-events-none"
                : "opacity-0 group-hover/spot:opacity-100 focus-visible:opacity-100"
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      <div className="flex justify-center gap-2 mt-5">
        {spotlightItems.map((item, idx) => (
          <button
            key={item.tmdbId}
            onClick={() => goTo(idx)}
            aria-label={`Show ${item.title}`}
            aria-current={idx === spotlightIdx}
            className={`h-1 transition-all duration-300 ${
              isRetro ? "" : "rounded-full"
            } ${
              idx === spotlightIdx
                ? "w-10 bg-tui-amber"
                : "w-4 bg-tui-border hover:bg-tui-text-muted"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

/* ── Retro TUI slide ────────────────────────────────────────── */

interface SlideProps {
  item: TMDBSearchResult;
  isActive: boolean;
  inert: boolean;
  watchlistItem?: Item;
  priority: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onAdd: (status: Status) => (e: React.MouseEvent) => void;
  onRemove: (id: string) => (e: React.MouseEvent) => void;
}

function RetroSlide({
  item,
  isActive,
  inert,
  watchlistItem,
  priority,
  onSelect,
  onAdd,
  onRemove,
}: SlideProps) {
  return (
    <div className="flex h-full" inert={inert}>
      {/* Poster is height-driven, so the panel never grows a dead column of
          empty space underneath the copy. */}
      <div className="relative h-full aspect-[2/3] shrink-0 border-r border-tui-border bg-tui-bg">
        {item.posterUrl ? (
          <TMDBImage
            src={item.posterUrl}
            alt={item.title}
            fill
            priority={priority}
            sizes="(max-width: 640px) 40vw, 280px"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-tui-text-muted uppercase text-center p-2">
            No Image
          </div>
        )}
        {isActive && (
          <div className="absolute top-2 left-2 bg-tui-bg/90 px-1.5 py-0.5 text-tui-amber text-[9px] font-bold uppercase border border-tui-amber tracking-widest">
            Active
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between p-3 sm:p-6 font-mono flex-1 min-w-0">
        <div className="min-h-0">
          <h2 className="text-tui-text font-bold uppercase text-base sm:text-2xl leading-tight line-clamp-2 mb-1.5">
            {item.title}
          </h2>
          <div className="flex gap-3 text-tui-text-muted text-[10px] mb-3">
            <span>YR: {item.year || "N/A"}</span>
            {item.voteAverage ? (
              <span>RTG: {item.voteAverage.toFixed(1)}</span>
            ) : null}
          </div>
          <p className="hidden sm:block text-tui-text-muted text-xs leading-relaxed line-clamp-4">
            {item.overview || "No description available."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-3">
          {watchlistItem ? (
            <button
              onClick={onRemove(watchlistItem.id)}
              className="px-2 sm:px-4 py-2 text-[10px] sm:text-xs border border-red-900 text-red-500 hover:bg-red-900/20 uppercase transition-colors"
            >
              [REMOVE]
            </button>
          ) : (
            <>
              <button
                onClick={onAdd("watched")}
                className="px-2 sm:px-4 py-2 text-[10px] sm:text-xs border border-tui-green text-tui-green hover:bg-tui-green/10 uppercase transition-colors"
              >
                [+WATCHED]
              </button>
              <button
                onClick={onAdd("wishlist")}
                className="px-2 sm:px-4 py-2 text-[10px] sm:text-xs border border-tui-border text-tui-text-muted hover:border-tui-amber hover:text-tui-amber uppercase transition-colors"
              >
                [+WISHLIST]
              </button>
            </>
          )}
          <button
            onClick={onSelect}
            className="px-2 sm:px-4 py-2 text-[10px] sm:text-xs border border-tui-border text-tui-text-muted hover:bg-tui-text hover:text-black uppercase transition-colors ml-auto"
          >
            [DETAILS]
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modern cinematic slide ─────────────────────────────────── */

function ModernSlide({
  item,
  isActive,
  inert,
  mediaType,
  watchlistItem,
  priority,
  onSelect,
  onAdd,
  onRemove,
}: SlideProps & { mediaType: MediaType }) {
  const art = item.backdropUrl || item.posterUrl;

  return (
    <div className="absolute inset-0" inert={inert}>
      {art ? (
        <TMDBImage
          src={art}
          alt={item.title}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 86vw, 880px"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white/50 font-mono text-xs uppercase">
          No Backdrop Available
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/55 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/70 via-transparent to-transparent pointer-events-none" />

      <div
        className={`absolute inset-x-0 bottom-0 p-5 sm:p-8 text-left transition-all duration-500 ${
          isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-3 py-0.5 rounded-full bg-tui-amber/90 text-black font-mono text-[10px] tracking-widest uppercase font-bold">
            SPOTLIGHT // {mediaType.toUpperCase()}
          </span>
          {item.voteAverage ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-400 font-mono bg-black/40 px-2 py-0.5 rounded-full">
              <Star className="h-3.5 w-3.5 fill-current" />
              {item.voteAverage.toFixed(1)}
            </span>
          ) : null}
          <span className="text-white/70 text-xs font-mono bg-black/40 px-2 py-0.5 rounded-full">
            {item.year || "N/A"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight mb-2 drop-shadow-2xl line-clamp-2">
          {item.title}
        </h2>

        <p className="hidden sm:block text-sm text-zinc-200 leading-relaxed max-w-2xl line-clamp-2 mb-5">
          {item.overview || "No description available."}
        </p>

        <div className="flex items-center gap-3">
          {watchlistItem ? (
            <>
              <button
                onClick={onRemove(watchlistItem.id)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-semibold transition-colors backdrop-blur-md border border-red-400/30"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
              <button
                onClick={onSelect}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white border border-white/40 rounded-xl text-sm font-semibold transition-colors backdrop-blur-md"
              >
                <Bookmark className="h-4 w-4" /> Details
              </button>
            </>
          ) : isActive ? (
            <>
              <button
                onClick={onAdd("watched")}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-neutral-200 text-zinc-950 rounded-xl text-sm font-bold transition-colors"
              >
                <Check className="h-4 w-4" /> Mark Watched
              </button>
              <button
                onClick={onAdd("wishlist")}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-black/40 hover:bg-black/60 border border-white/20 text-white rounded-xl text-sm font-semibold transition-colors backdrop-blur-md"
              >
                <Plus className="h-4 w-4" /> Add to Wishlist
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
