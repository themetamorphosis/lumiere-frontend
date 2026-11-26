import type { TMDBSearchResult } from "@/lib/tmdb";
import type { Item } from "@/lib/types";

export function findCatalogTitle(items: Item[], title: TMDBSearchResult): Item | undefined {
  const linked = items.find((item) => item.mediaType === title.mediaType && item.tmdbId === title.tmdbId);
  if (linked) return linked;

  // A manual or older entry can match when the edition's year is known.
  if (title.year == null) return undefined;
  return items.find((item) =>
    item.tmdbId == null &&
    item.mediaType === title.mediaType &&
    item.year === title.year &&
    item.title.toLowerCase() === title.title.toLowerCase()
  );
}
