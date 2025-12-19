// Plex cache management

import type { PlexApiResponse, PlexLibrary } from "./plex-types";

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
  DEFAULT: 5 * 60 * 1000, // 5 minutes for general API calls
  LIBRARIES: 30 * 60 * 1000, // 30 minutes for library structure
  LIBRARY_CONTENT: 10 * 60 * 1000, // 10 minutes for library content (movies/shows)
  RECENT: 2 * 60 * 1000, // 2 minutes for recently added/on deck
};

// Cache configuration
const MAX_CACHE_SIZE = 100; // Maximum number of entries in cache

// Simple in-memory cache with TTL and size limit
const cache = new Map<string, { data: PlexApiResponse; expires: number }>();

// Evict oldest entries when cache exceeds max size
function evictIfNeeded(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;

  // Remove expired entries first
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expires <= now) {
      cache.delete(key);
    }
  }

  // If still over limit, remove oldest entries (first inserted)
  if (cache.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(cache.keys()).slice(0, cache.size - MAX_CACHE_SIZE);
    for (const key of keysToDelete) {
      cache.delete(key);
    }
  }
}

// Cache warmup state
let cacheWarmedUp = false;
let warmupPromise: Promise<void> | null = null;

// Libraries cache
let librariesCache: { data: PlexLibrary[]; expires: number } | null = null;

// Debug logging - only in development
const DEBUG = process.env.NODE_ENV === "development";

function logDebug(message: string): void {
  if (DEBUG) console.log(message);
}

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

export function setCache(
  key: string,
  data: PlexApiResponse,
  ttl = CACHE_TTL.DEFAULT
): void {
  cache.set(key, { data, expires: Date.now() + ttl });
  evictIfNeeded();
}

export function getLibrariesCache(): PlexLibrary[] | null {
  if (librariesCache && librariesCache.expires > Date.now()) {
    return librariesCache.data;
  }
  return null;
}

export function setLibrariesCache(data: PlexLibrary[]): void {
  librariesCache = { data, expires: Date.now() + CACHE_TTL.LIBRARIES };
}

export function clearCache(): void {
  cache.clear();
  librariesCache = null;
}

// Check if cache is warmed up
export function isCacheWarmedUp(): boolean {
  return cacheWarmedUp;
}

// Set warmup state
export function setCacheWarmedUp(value: boolean): void {
  cacheWarmedUp = value;
}

// Get warmup promise
export function getWarmupPromise(): Promise<void> | null {
  return warmupPromise;
}

// Set warmup promise
export function setWarmupPromise(promise: Promise<void> | null): void {
  warmupPromise = promise;
}

// Invalidate cache (useful for webhook triggers)
export function invalidateCache(): void {
  cache.clear();
  librariesCache = null;
  cacheWarmedUp = false;
  logDebug("[Plex Cache] Cache invalidated");
}
