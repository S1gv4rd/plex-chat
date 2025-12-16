// Plex API client with caching and optimized fetching
// Main entry point - re-exports from modules and provides remaining functions

// Re-export types
export type {
  PlexMediaItem,
  PlexLibrary,
  PlexLibrarySummary,
  PlexApiMediaItem,
  PlexApiCollection,
} from "./plex-types";

// Re-export cache functions
export { invalidateCache, isCacheWarmedUp } from "./plex-cache";

// Re-export API functions
export { setCustomCredentials } from "./plex-api";

// Re-export search functions
export {
  searchLibrary,
  searchByPerson,
  getUnwatchedMovies,
  getUnwatchedShows,
  searchByGenre,
} from "./plex-search";

// Re-export stats functions
export {
  getWatchHistory,
  getWatchStats,
  getWatchlist,
  getPersonalizedSuggestions,
} from "./plex-stats";

// Import from modules for use in this file
import type {
  PlexMediaItem,
  PlexLibrarySummary,
  PlexApiMediaItem,
  PlexApiCollection,
} from "./plex-types";
import {
  CACHE_TTL,
  isCacheWarmedUp,
  setCacheWarmedUp,
  getWarmupPromise,
  setWarmupPromise,
} from "./plex-cache";
import {
  plexFetch,
  getLibraries,
  parseMediaItems,
  logPlexError,
  logDebug,
} from "./plex-api";
import { searchLibrary } from "./plex-search";

// Library summary and context

export async function getLibrarySummary(): Promise<PlexLibrarySummary> {
  const libraries = await getLibraries();

  // Parallel fetch all library counts + recently added + on deck
  const countFetches = libraries.map((lib) =>
    plexFetch(
      `/library/sections/${lib.key}/all?X-Plex-Container-Size=0`,
      CACHE_TTL.LIBRARY_CONTENT
    ).catch((e) => {
      logPlexError(`getLibrarySummary count for ${lib.title}`, e);
      return null;
    })
  );

  const episodeFetches = libraries
    .filter((lib) => lib.type === "show")
    .map((lib) =>
      plexFetch(
        `/library/sections/${lib.key}/all?type=4&X-Plex-Container-Size=0`,
        CACHE_TTL.LIBRARY_CONTENT
      ).catch((e) => {
        logPlexError(`getLibrarySummary episodes for ${lib.title}`, e);
        return null;
      })
    );

  const [countResponses, episodeResponses, recentData, onDeckData] =
    await Promise.all([
      Promise.all(countFetches),
      Promise.all(episodeFetches),
      plexFetch(
        "/library/recentlyAdded?X-Plex-Container-Size=10",
        CACHE_TTL.RECENT
      ).catch((e) => {
        logPlexError("getLibrarySummary recentlyAdded", e);
        return null;
      }),
      plexFetch("/library/onDeck", CACHE_TTL.RECENT).catch((e) => {
        logPlexError("getLibrarySummary onDeck", e);
        return null;
      }),
    ]);

  let totalMovies = 0;
  let totalShows = 0;
  let totalEpisodes = 0;
  let episodeIdx = 0;

  libraries.forEach((lib, i) => {
    const count =
      countResponses[i]?.MediaContainer?.totalSize ||
      countResponses[i]?.MediaContainer?.size ||
      0;
    lib.itemCount = count;

    if (lib.type === "movie") {
      totalMovies += count;
    } else if (lib.type === "show") {
      totalShows += count;
      totalEpisodes +=
        episodeResponses[episodeIdx]?.MediaContainer?.totalSize ||
        episodeResponses[episodeIdx]?.MediaContainer?.size ||
        0;
      episodeIdx++;
    }
  });

  return {
    libraries,
    totalMovies,
    totalShows,
    totalEpisodes,
    recentlyAdded: parseMediaItems(recentData?.MediaContainer?.Metadata),
    recentlyWatched: parseMediaItems(onDeckData?.MediaContainer?.Metadata),
  };
}

export async function getLibraryContext(): Promise<string> {
  const summary = await getLibrarySummary();

  let context = `Plex Library: ${summary.totalMovies} movies, ${summary.totalShows} TV shows, ${summary.totalEpisodes} episodes.\n\n`;

  if (summary.recentlyAdded.length > 0) {
    context += `Recently Added:\n`;
    for (const item of summary.recentlyAdded.slice(0, 8)) {
      const name =
        item.type === "episode"
          ? `${item.grandparentTitle || "Unknown"} S${item.parentIndex ?? "?"}E${item.index ?? "?"}`
          : `${item.title} (${item.year || "?"})`;
      context += `- ${name}\n`;
    }
  }

  if (summary.recentlyWatched.length > 0) {
    context += `\nOn Deck:\n`;
    for (const item of summary.recentlyWatched.slice(0, 5)) {
      const name =
        item.type === "episode"
          ? `${item.grandparentTitle || "Unknown"} S${item.parentIndex ?? "?"}E${item.index ?? "?"}`
          : item.title;
      context += `- ${name}\n`;
    }
  }

  context += `\nUse search tools for specific queries.`;

  return context;
}

// Pre-fetch and warm up the cache
export async function warmupCache(): Promise<void> {
  // Prevent multiple simultaneous warmups
  const existingPromise = getWarmupPromise();
  if (existingPromise) {
    return existingPromise;
  }

  if (isCacheWarmedUp()) {
    return;
  }

  const warmupPromise = (async () => {
    try {
      logDebug("[Plex Cache] Starting cache warmup...");
      const startTime = Date.now();

      // 1. Fetch libraries first (needed for other calls)
      const libraries = await getLibraries();
      logDebug(`[Plex Cache] Loaded ${libraries.length} libraries`);

      // 2. Pre-fetch library summary (counts, recent, on deck)
      const summary = await getLibrarySummary();
      logDebug(
        `[Plex Cache] Summary: ${summary.totalMovies} movies, ${summary.totalShows} shows`
      );

      // 3. Pre-fetch all library content in parallel (for faster searches)
      const contentFetches = libraries.flatMap((lib) => {
        if (lib.type === "movie" || lib.type === "show") {
          return [
            plexFetch(
              `/library/sections/${lib.key}/all`,
              CACHE_TTL.LIBRARY_CONTENT
            ).catch((e) => {
              logPlexError(`warmupCache content for ${lib.title}`, e);
              return null;
            }),
            plexFetch(
              `/library/sections/${lib.key}/collections`,
              CACHE_TTL.LIBRARY_CONTENT
            ).catch((e) => {
              logPlexError(`warmupCache collections for ${lib.title}`, e);
              return null;
            }),
          ];
        }
        return [];
      });

      await Promise.all(contentFetches);

      setCacheWarmedUp(true);
      const elapsed = Date.now() - startTime;
      logDebug(`[Plex Cache] Warmup complete in ${elapsed}ms`);
    } catch (error) {
      console.error("[Plex Cache] Warmup failed:", error);
    } finally {
      setWarmupPromise(null);
    }
  })();

  setWarmupPromise(warmupPromise);
  return warmupPromise;
}

// Check if two titles are from the same franchise (sequels, prequels, etc.)
function isSameFranchise(title1: string, title2: string): boolean {
  const normalize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
  const t1 = normalize(title1);
  const t2 = normalize(title2);

  // Exact match
  if (t1 === t2) return true;

  // One title contains the other (e.g., "The Matrix" and "The Matrix Reloaded")
  if (t1.includes(t2) || t2.includes(t1)) return true;

  // Check for common franchise patterns
  const getBaseName = (t: string) => {
    // Remove common sequel indicators
    return t
      .replace(
        /\s*(2|3|4|5|ii|iii|iv|v|vi|part\s*\d+|chapter\s*\d+|reloaded|revolutions|resurrection|returns|rising|awakens|strikes back|revenge|reckoning|redemption|legacy|origins|generations|salvation|genisys|dark fate)\s*$/i,
        ""
      )
      .trim();
  };

  const base1 = getBaseName(t1);
  const base2 = getBaseName(t2);

  if (base1.length > 3 && base2.length > 3) {
    if (base1 === base2 || base1.includes(base2) || base2.includes(base1))
      return true;
  }

  return false;
}

// Get similar/related movies (excluding sequels from the same franchise)
export async function getSimilarMovies(
  title: string,
  count = 5
): Promise<PlexMediaItem[]> {
  // First find the movie
  const searchResults = await searchLibrary(title);
  const movie = searchResults.find((m) => m.type === "movie");

  if (!movie) return [];

  const libraries = await getLibraries();
  const movieLibs = libraries.filter((l) => l.type === "movie");

  // Collect candidates from multiple sources with scoring
  const candidateScores = new Map<
    string,
    { item: PlexMediaItem; score: number }
  >();

  // Helper to add candidate with score
  const addCandidate = (item: PlexMediaItem, points: number) => {
    if (item.ratingKey === movie.ratingKey) return; // Skip the original
    if (isSameFranchise(item.title, movie.title)) return; // Skip sequels/prequels

    const existing = candidateScores.get(item.ratingKey);
    if (existing) {
      existing.score += points;
    } else {
      candidateScores.set(item.ratingKey, { item, score: points });
    }
  };

  const fetches: Promise<void>[] = [];

  // Search by genres (highest priority for primary genre)
  if (movie.genres && movie.genres.length > 0) {
    for (let i = 0; i < Math.min(movie.genres.length, 2); i++) {
      const genre = movie.genres[i];
      const points = i === 0 ? 3 : 1; // Primary genre worth more

      for (const lib of movieLibs) {
        fetches.push(
          plexFetch(
            `/library/sections/${lib.key}/all?genre=${encodeURIComponent(genre)}`,
            CACHE_TTL.LIBRARY_CONTENT
          )
            .then((data) => {
              if (data?.MediaContainer?.Metadata) {
                for (const item of parseMediaItems(data.MediaContainer.Metadata)) {
                  addCandidate(item, points);
                }
              }
            })
            .catch((e) => {
              logPlexError(
                `getSimilarMovies genre ${genre} in ${lib.title}`,
                e
              );
            })
        );
      }
    }
  }

  // Search by director (good signal for style)
  if (movie.directors && movie.directors.length > 0) {
    const director = movie.directors[0];
    for (const lib of movieLibs) {
      fetches.push(
        plexFetch(
          `/library/sections/${lib.key}/all?director=${encodeURIComponent(director)}`,
          CACHE_TTL.LIBRARY_CONTENT
        )
          .then((data) => {
            if (data?.MediaContainer?.Metadata) {
              for (const item of parseMediaItems(data.MediaContainer.Metadata)) {
                addCandidate(item, 2);
              }
            }
          })
          .catch((e) => {
            logPlexError(
              `getSimilarMovies director ${director} in ${lib.title}`,
              e
            );
          })
      );
    }
  }

  // Search by lead actors
  if (movie.actors && movie.actors.length > 0) {
    const actor = movie.actors[0];
    for (const lib of movieLibs) {
      fetches.push(
        plexFetch(
          `/library/sections/${lib.key}/all?actor=${encodeURIComponent(actor)}`,
          CACHE_TTL.LIBRARY_CONTENT
        )
          .then((data) => {
            if (data?.MediaContainer?.Metadata) {
              for (const item of parseMediaItems(data.MediaContainer.Metadata)) {
                addCandidate(item, 1);
              }
            }
          })
          .catch((e) => {
            logPlexError(`getSimilarMovies actor ${actor} in ${lib.title}`, e);
          })
      );
    }
  }

  await Promise.all(fetches);

  // Sort by score (descending) and add some randomization for variety
  const sorted = Array.from(candidateScores.values())
    .sort((a, b) => {
      // Add small random factor to mix up results with same score
      const randomFactor = (Math.random() - 0.5) * 0.5;
      return b.score + randomFactor - (a.score + randomFactor);
    })
    .map((c) => c.item);

  // Enforce max 1 movie per director for variety
  const seenDirectors = new Set<string>();
  const sourceDirector = movie.directors?.[0]?.toLowerCase();
  if (sourceDirector) seenDirectors.add(sourceDirector); // Exclude source movie's director too

  const diverse: PlexMediaItem[] = [];
  for (const item of sorted) {
    const director = item.directors?.[0]?.toLowerCase();
    if (director && seenDirectors.has(director)) continue;
    if (director) seenDirectors.add(director);
    diverse.push(item);
    if (diverse.length >= count) break;
  }

  return diverse;
}

// Get collections
export async function getCollections(): Promise<
  { key: string; title: string; count: number }[]
> {
  const libraries = await getLibraries();
  const collections: { key: string; title: string; count: number }[] = [];

  const fetches = libraries.map((lib) =>
    plexFetch(`/library/sections/${lib.key}/collections`).catch((e) => {
      logPlexError(`getCollections in ${lib.title}`, e);
      return null;
    })
  );

  const responses = await Promise.all(fetches);

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      for (const col of data.MediaContainer.Metadata as PlexApiCollection[]) {
        collections.push({
          key: col.ratingKey,
          title: col.title,
          count: col.childCount || 0,
        });
      }
    }
  }

  return collections;
}

// Get items in a collection
export async function getCollectionItems(
  collectionTitle: string
): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();

  for (const lib of libraries) {
    try {
      const colData = await plexFetch(
        `/library/sections/${lib.key}/collections`
      );
      const collection = colData?.MediaContainer?.Metadata?.find(
        (c) =>
          (c as PlexApiCollection).title.toLowerCase() ===
          collectionTitle.toLowerCase()
      );

      if (collection) {
        const itemsData = await plexFetch(
          `/library/collections/${collection.ratingKey}/children`
        );
        return parseMediaItems(itemsData?.MediaContainer?.Metadata);
      }
    } catch (e) {
      logPlexError(
        `getCollectionItems for "${collectionTitle}" in ${lib.title}`,
        e
      );
    }
  }

  return [];
}

// Get detailed info about a specific movie or show
export async function getMediaDetails(title: string): Promise<{
  found: boolean;
  title: string;
  year?: number;
  type: string;
  summary?: string;
  rating?: number;
  contentRating?: string;
  duration?: string;
  genres: string[];
  directors: string[];
  writers: string[];
  cast: { name: string; role: string }[];
  studio?: string;
  originallyAvailable?: string;
  addedAt?: string;
  viewCount?: number;
  lastViewedAt?: string;
} | null> {
  // Search for the title
  const searchResults = await searchLibrary(title);
  const item = searchResults.find(
    (m) => m.type === "movie" || m.type === "show"
  );

  if (!item) return null;

  try {
    // Get full metadata
    const data = await plexFetch(
      `/library/metadata/${item.ratingKey}`,
      CACHE_TTL.LIBRARY_CONTENT
    );
    const meta = data?.MediaContainer?.Metadata?.[0] as
      | PlexApiMediaItem
      | undefined;

    if (!meta) return null;

    // Format duration
    let duration: string | undefined;
    if (meta.duration) {
      const mins = Math.round(meta.duration / 60000);
      if (mins >= 60) {
        const hrs = Math.floor(mins / 60);
        const remainMins = mins % 60;
        duration = `${hrs}h ${remainMins}m`;
      } else {
        duration = `${mins}m`;
      }
    }

    return {
      found: true,
      title: meta.title,
      year: meta.year,
      type: meta.type,
      summary: meta.summary,
      rating: meta.rating ? parseFloat(meta.rating.toFixed(1)) : undefined,
      contentRating: meta.contentRating,
      duration,
      genres: meta.Genre?.map((g: { tag: string }) => g.tag) || [],
      directors: meta.Director?.map((d: { tag: string }) => d.tag) || [],
      writers: meta.Writer?.map((w: { tag: string }) => w.tag) || [],
      cast:
        meta.Role?.slice(0, 8).map((r) => ({
          name: r.tag,
          role: r.role || "Unknown role",
        })) || [],
      studio: meta.studio,
      originallyAvailable: meta.originallyAvailableAt,
      addedAt: meta.addedAt
        ? new Date(meta.addedAt * 1000).toLocaleDateString()
        : undefined,
      viewCount: meta.viewCount,
      lastViewedAt: meta.lastViewedAt
        ? new Date(meta.lastViewedAt * 1000).toLocaleDateString()
        : undefined,
    };
  } catch {
    return null;
  }
}

// Pick a single random movie from the library
export async function pickRandomMovie(
  unwatchedOnly = true,
  genre?: string
): Promise<PlexMediaItem | null> {
  const libraries = await getLibraries();
  const movieLibraries = libraries.filter((lib) => lib.type === "movie");

  const allMovies: PlexMediaItem[] = [];

  const fetches = movieLibraries.map(async (lib) => {
    let endpoint = `/library/sections/${lib.key}/all`;
    const params: string[] = [];

    if (unwatchedOnly) {
      params.push("unwatched=1");
    }
    if (genre) {
      params.push(`genre=${encodeURIComponent(genre)}`);
    }

    if (params.length > 0) {
      endpoint += "?" + params.join("&");
    }

    const data = await plexFetch(endpoint, CACHE_TTL.LIBRARY_CONTENT).catch(
      (e) => {
        logPlexError(`pickRandomMovie in ${lib.title}`, e);
        return null;
      }
    );
    if (data?.MediaContainer?.Metadata) {
      allMovies.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  });

  await Promise.all(fetches);

  if (allMovies.length === 0) return null;

  // Pick a truly random movie
  const randomIndex = Math.floor(Math.random() * allMovies.length);
  return allMovies[randomIndex];
}
