export type MediaType = "movie" | "tv" | "anime";
export type Status = "watched" | "pending" | "wishlist";

export type Item = {
  id: string;
  title: string;
  mediaType: MediaType;
  status: Status;
  favorite: boolean;
  genres?: string[];
  notes?: string;
  description?: string;

  year?: number;
  endYear?: number;
  running?: boolean;

  coverUrl?: string;
  runtime?: number;   // total runtime in minutes (cached from TMDB)

  createdAt: number;
  updatedAt: number;
};

/** A share link as its owner sees it. */
export type ShareLink = {
  id: string;
  slug: string;
  label?: string;
  /** Empty means "no filter on this dimension", not "nothing". */
  statuses: Status[];
  mediaTypes: MediaType[];
  favoritesOnly: boolean;
  createdAt?: string;
  updatedAt?: string;
};

/** A watchlist item as an anonymous visitor sees it — no `notes`, no `userId`. */
export type PublicItem = Omit<Item, "notes">;

export type PublicWatchlist = {
  slug: string;
  label?: string;
  owner: { name?: string; image?: string };
  filters: {
    statuses: Status[];
    mediaTypes: MediaType[];
    favoritesOnly: boolean;
  };
  items: PublicItem[];
  total: number;
};
