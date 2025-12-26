// Plex cache management with LRU eviction

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

// LRU cache entry with access tracking
interface CacheEntry {
  data: PlexApiResponse;
  expires: number;
  lastAccessed: number;
}

// In-memory cache with TTL and LRU eviction
const cache = new Map<string, CacheEntry>();

// Evict least recently used entries when cache exceeds max size
function evictIfNeeded(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;

  const now = Date.now();

  // Remove expired entries first
  for (const [key, entry] of cache) {
    if (entry.expires <= now) {
      cache.delete(key);
    }
  }

  // If still over limit, remove least recently used entries
  if (cache.size > MAX_CACHE_SIZE) {
    // Sort by lastAccessed (oldest first) and remove excess
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      cache.delete(key);
    }
  }
}

// Cache warmup state with atomic operations
let cacheWarmedUp = false;
let warmupPromise: Promise<void> | null = null;
let warmupInProgress = false;

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
    // Update last accessed time for LRU tracking
    entry.lastAccessed = Date.now();
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
  const now = Date.now();
  cache.set(key, { data, expires: now + ttl, lastAccessed: now });
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

// Atomically try to start warmup - returns true if caller should start warmup
export function tryStartWarmup(): boolean {
  if (cacheWarmedUp || warmupInProgress) {
    return false;
  }
  warmupInProgress = true;
  return true;
}

// Mark warmup as complete
export function completeWarmup(): void {
  warmupInProgress = false;
  cacheWarmedUp = true;
}

// Mark warmup as failed (allow retry)
export function failWarmup(): void {
  warmupInProgress = false;
}

// Invalidate cache (useful for webhook triggers)
export function invalidateCache(): void {
  cache.clear();
  librariesCache = null;
  cacheWarmedUp = false;
  warmupInProgress = false;
  logDebug("[Plex Cache] Cache invalidated");
}
