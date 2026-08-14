"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import TMDBImage from "@/components/ui/TMDBImage";
import type { PublicItem, Status } from "@/lib/types";

const STATUS_STYLE: Record<Status, string> = {
  watched: "text-tui-green",
  pending: "text-tui-amber",
  wishlist: "text-tui-purple",
};

const STATUS_LABEL: Record<Status, string> = {
  watched: "Watched",
  pending: "Watching",
  wishlist: "Wishlist",
};

/**
 * Read-only poster tile for the public share page.
 *
 * Deliberately not `PosterCard`: that one renders a hardcoded four-star rating
 * and a fabricated progress bar. Invented data is tolerable inside your own
 * library; on a page you hand to someone else it reads as a real claim about
 * the title.
 */
export default function SharePosterCard({
  item,
  index,
}: {
  item: PublicItem;
  index: number;
}) {
  const meta = [item.year, item.genres?.[0]].filter(Boolean).join(" • ");

  return (
    <motion.figure
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
        // Staggered reveal that stops compounding after the first screenful,
        // so item 300 doesn't wait 90 seconds to appear.
        delay: Math.min(index, 11) * 0.035,
      }}
      className="group"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden border border-tui-border bg-tui-input">
        {item.coverUrl ? (
          <TMDBImage
            src={item.coverUrl}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 180px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-[11px] text-tui-text-muted">
            {item.title}
          </div>
        )}

        {item.favorite && (
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center bg-black/60 backdrop-blur-sm">
            <Heart className="h-3 w-3 fill-tui-amber text-tui-amber" />
          </div>
        )}
      </div>

      <figcaption className="mt-2.5">
        <div className="truncate text-[13px] font-medium text-tui-text">
          {item.title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-tui-text-muted">
          <span className={STATUS_STYLE[item.status]}>
            {STATUS_LABEL[item.status]}
          </span>
          {meta && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{meta}</span>
            </>
          )}
        </div>
      </figcaption>
    </motion.figure>
  );
}
