// Plex core API functions

import type {
  PlexApiResponse,
  PlexApiMediaItem,
  PlexApiCollection,
  PlexApiTag,
  PlexLibrary,
  PlexMediaItem,
} from "./plex-types";
import {
  CACHE_TTL,
  getCached,
  setCache,
  getLibrariesCache,
  setLibrariesCache,
  clearCache,
} from "./plex-cache";

let PLEX_URL = process.env.PLEX_URL;
let PLEX_TOKEN = process.env.PLEX_TOKEN;

// Consistent error logging helper
export function logPlexError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Plex API] ${context}: ${message}`);
}

// Debug logging - only in development
const DEBUG = process.env.NODE_ENV === "development";
export function logDebug(message: string): void {
  if (DEBUG) console.log(message);
}

// Allow setting custom credentials at runtime
export function setCustomCredentials(url?: string, token?: string): void {
  if (url) PLEX_URL = url;
  if (token) PLEX_TOKEN = token;
  // Clear cache when credentials change
  clearCache();
}

export async function plexFetch(
  endpoint: string,
  ttl = CACHE_TTL.DEFAULT
): Promise<PlexApiResponse | null> {
  if (!PLEX_URL || !PLEX_TOKEN) {
    throw new Error("Plex URL and Token must be configured");
  }

  const cacheKey = endpoint;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `${PLEX_URL}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Plex-Token": PLEX_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(`Plex API error: ${response.status}`);
  }

  const data = await response.json();
  setCache(cacheKey, data, ttl);
  return data;
}

// Cached libraries fetch
export async function getLibraries(): Promise<PlexLibrary[]> {
  const cached = getLibrariesCache();
  if (cached) return cached;

  const data = await plexFetch("/library/sections", CACHE_TTL.LIBRARIES);
  if (!data?.MediaContainer?.Directory) {
    return [];
  }
  const libraries = data.MediaContainer.Directory.map((lib) => ({
    key: lib.key,
    title: lib.title,
    type: lib.type,
  }));

  setLibrariesCache(libraries);
  return libraries;
}

export function parseMediaItems(
  items: (PlexApiMediaItem | PlexApiCollection)[] | undefined
): PlexMediaItem[] {
  if (!items) return [];
  // Filter to only media items (not collections) and map
  return items
    .filter((item): item is PlexApiMediaItem => "type" in item)
    .map((item: PlexApiMediaItem) => ({
      ratingKey: item.ratingKey,
      title: item.title,
      type: item.type,
      year: item.year,
      summary: item.summary,
      genres: item.Genre?.map((g: PlexApiTag) => g.tag),
      directors: item.Director?.map((d: PlexApiTag) => d.tag),
      actors: item.Role?.slice(0, 5).map((r: PlexApiTag) => r.tag),
      addedAt: item.addedAt,
      lastViewedAt: item.lastViewedAt,
      viewCount: item.viewCount,
      grandparentTitle: item.grandparentTitle,
      parentTitle: item.parentTitle,
      index: item.index,
      parentIndex: item.parentIndex,
      leafCount: item.leafCount,
    }));
}
