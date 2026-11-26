import type { MediaType } from "@/lib/types";
import { fetchApi } from "@/lib/apiClient";
import {
  TMDBSearchResponseSchema,
  TMDBMediaDetailsSchema,
} from "@/lib/validators";

export type TMDBSearchResult = {
  tmdbId: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string | null;
  mediaType: string;
  genres: string[];
  voteAverage: number | null;
};

export class TmdbCredentialsError extends Error {}

async function fetchCatalog(path: string, params: URLSearchParams, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetchApi(`/media/${path}?${params}`, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    if (error?.detail?.code === "tmdb_credentials_required") {
      throw new TmdbCredentialsError("Title search needs a valid TMDB API key.");
    }
    throw new Error("The title catalogue is temporarily unavailable.");
  }
  return TMDBSearchResponseSchema.parse(await response.json()).results;
}

export async function searchTmdb(query: string, type: MediaType, signal?: AbortSignal) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return fetchCatalog("search", new URLSearchParams({ query: trimmed, type }), signal);
}

export function getTrendingMedia(type: MediaType, window: "day" | "week" = "day", signal?: AbortSignal) {
  return fetchCatalog("trending", new URLSearchParams({ type, time_window: window }), signal);
}

export function getPopularMedia(type: MediaType, page = 1, signal?: AbortSignal) {
  return fetchCatalog("popular", new URLSearchParams({ type, page: String(page) }), signal);
}

export function getTopRatedMedia(type: MediaType, page = 1, signal?: AbortSignal) {
  return fetchCatalog("top-rated", new URLSearchParams({ type, page: String(page) }), signal);
}

export function discoverMedia(
  params: { type: MediaType; genre?: string; year?: number; decade?: number; sortBy?: string; page?: number },
  signal?: AbortSignal,
) {
  const { type, genre, year, decade, sortBy, page } = params;
  const query = new URLSearchParams({ type });
  if (genre) query.set("genre", genre);
  if (year) query.set("year", String(year));
  if (decade) query.set("decade", String(decade));
  if (sortBy) query.set("sort_by", sortBy);
  if (page) query.set("page", String(page));
  return fetchCatalog("discover", query, signal);
}

export type TMDBCastMember = {
  name: string;
  character: string;
  profileUrl: string | null;
};

export type TMDBMediaDetails = {
  tmdbId: number;
  title: string;
  year: number | null;
  overview: string | null;
  genres: string[];
  voteAverage: number | null;
  voteCount: number | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  runtime: number | null;
  directors: string[];
  writers: string[];
  composers: string[];
  cast: TMDBCastMember[];
  trailerKey: string | null;
};

/**
 * Fetch detailed media information, credits, and videos.
 */
export async function getMediaDetails(
  tmdbId: number,
  type: MediaType,
  signal?: AbortSignal,
): Promise<TMDBMediaDetails | null> {
  try {
    const params = new URLSearchParams();
    params.set("tmdb_id", String(tmdbId));
    params.set("type", type);

    const res = await fetchApi(`/media/details?${params.toString()}`, {
      signal,
    });
    if (!res.ok) {
      console.error("[TMDB] details request failed:", res.status);
      return null;
    }

    const raw = await res.json();
    const parsed = TMDBMediaDetailsSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("TMDB details response validation failed:", parsed.error);
      return null;
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    console.error("[TMDB] details fetch error:", err);
    return null;
  }
}
