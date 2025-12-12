// Plex API client with caching and optimized fetching

const PLEX_URL = process.env.PLEX_URL;
const PLEX_TOKEN = process.env.PLEX_TOKEN;

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute cache

interface PlexMediaItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  summary?: string;
  genres?: string[];
  directors?: string[];
  actors?: string[];
  addedAt?: number;
  lastViewedAt?: number;
  viewCount?: number;
  grandparentTitle?: string;
  parentTitle?: string;
  index?: number;
  parentIndex?: number;
  leafCount?: number;
}

interface PlexLibrary {
  key: string;
  title: string;
  type: string;
  itemCount?: number;
}

interface PlexLibrarySummary {
  libraries: PlexLibrary[];
  totalMovies: number;
  totalShows: number;
  totalEpisodes: number;
  recentlyAdded: PlexMediaItem[];
  recentlyWatched: PlexMediaItem[];
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any, ttl = CACHE_TTL): void {
  cache.set(key, { data, expires: Date.now() + ttl });
}

async function plexFetch(endpoint: string): Promise<any> {
  if (!PLEX_URL || !PLEX_TOKEN) {
    throw new Error("Plex URL and Token must be configured");
  }

  const cacheKey = endpoint;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const url = `${PLEX_URL}${endpoint}`;
  const separator = endpoint.includes("?") ? "&" : "?";

  const response = await fetch(`${url}${separator}X-Plex-Token=${PLEX_TOKEN}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Plex API error: ${response.status}`);
  }

  const data = await response.json();
  setCache(cacheKey, data);
  return data;
}

// Cached libraries fetch
let librariesCache: { data: PlexLibrary[]; expires: number } | null = null;

async function getLibraries(): Promise<PlexLibrary[]> {
  if (librariesCache && librariesCache.expires > Date.now()) {
    return librariesCache.data;
  }

  const data = await plexFetch("/library/sections");
  const libraries = data.MediaContainer.Directory.map((lib: any) => ({
    key: lib.key,
    title: lib.title,
    type: lib.type,
  }));

  librariesCache = { data: libraries, expires: Date.now() + 5 * 60 * 1000 }; // 5 min cache
  return libraries;
}

function parseMediaItems(items: any[]): PlexMediaItem[] {
  if (!items) return [];
  return items.map((item: any) => ({
    ratingKey: item.ratingKey,
    title: item.title,
    type: item.type,
    year: item.year,
    summary: item.summary,
    genres: item.Genre?.map((g: any) => g.tag),
    directors: item.Director?.map((d: any) => d.tag),
    actors: item.Role?.slice(0, 5).map((r: any) => r.tag),
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

export async function searchLibrary(query: string): Promise<PlexMediaItem[]> {
  const data = await plexFetch(`/search?query=${encodeURIComponent(query)}`);
  return parseMediaItems(data.MediaContainer.Metadata);
}

export async function searchByPerson(name: string): Promise<{ movies: PlexMediaItem[]; shows: PlexMediaItem[] }> {
  const libraries = await getLibraries();
  const results: { movies: PlexMediaItem[]; shows: PlexMediaItem[] } = { movies: [], shows: [] };
  const seen = new Set<string>();

  // Parallel fetch for all libraries
  const fetches = libraries.flatMap(lib => {
    if (lib.type === "movie") {
      return [
        plexFetch(`/library/sections/${lib.key}/all?actor=${encodeURIComponent(name)}`).catch(() => null),
        plexFetch(`/library/sections/${lib.key}/all?director=${encodeURIComponent(name)}`).catch(() => null),
      ];
    } else if (lib.type === "show") {
      return [plexFetch(`/library/sections/${lib.key}/all?actor=${encodeURIComponent(name)}`).catch(() => null)];
    }
    return [];
  });

  const responses = await Promise.all(fetches);
  const movieLibs = libraries.filter(l => l.type === "movie").length;

  // Process movie results (actor + director per library)
  for (let i = 0; i < movieLibs * 2; i++) {
    const data = responses[i];
    if (data?.MediaContainer?.Metadata) {
      for (const item of parseMediaItems(data.MediaContainer.Metadata)) {
        if (!seen.has(item.ratingKey)) {
          seen.add(item.ratingKey);
          results.movies.push(item);
        }
      }
    }
  }

  // Process show results
  for (let i = movieLibs * 2; i < responses.length; i++) {
    const data = responses[i];
    if (data?.MediaContainer?.Metadata) {
      results.shows.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  }

  return results;
}

export async function getUnwatchedMovies(count = 20, genre?: string): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const movieLibraries = libraries.filter(lib => lib.type === "movie");

  const fetches = movieLibraries.map(lib => {
    const endpoint = genre
      ? `/library/sections/${lib.key}/unwatched?genre=${encodeURIComponent(genre)}`
      : `/library/sections/${lib.key}/unwatched`;
    return plexFetch(endpoint).catch(() => null);
  });

  const responses = await Promise.all(fetches);
  const unwatched: PlexMediaItem[] = [];

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      unwatched.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  }

  // Fisher-Yates shuffle for better randomness
  for (let i = unwatched.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unwatched[i], unwatched[j]] = [unwatched[j], unwatched[i]];
  }

  return unwatched.slice(0, count);
}

export async function searchByGenre(genre: string, type: "movie" | "show" = "movie"): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const filteredLibraries = libraries.filter(lib => lib.type === type);

  const fetches = filteredLibraries.map(lib =>
    plexFetch(`/library/sections/${lib.key}/all?genre=${encodeURIComponent(genre)}`).catch(() => null)
  );

  const responses = await Promise.all(fetches);
  const results: PlexMediaItem[] = [];

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      results.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  }

  return results;
}

export async function getWatchHistory(limit = 20): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();

  const fetches = libraries
    .filter(lib => lib.type === "movie" || lib.type === "show")
    .map(lib => {
      const endpoint = lib.type === "movie"
        ? `/library/sections/${lib.key}/all?viewCount>=1&sort=lastViewedAt:desc&X-Plex-Container-Size=${limit}`
        : `/library/sections/${lib.key}/all?type=4&viewCount>=1&sort=lastViewedAt:desc&X-Plex-Container-Size=${limit}`;
      return plexFetch(endpoint).catch(() => null);
    });

  const responses = await Promise.all(fetches);
  const watched: PlexMediaItem[] = [];

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      watched.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  }

  return watched
    .filter(item => item.lastViewedAt)
    .sort((a, b) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0))
    .slice(0, limit);
}

export async function getWatchStats(): Promise<{
  totalWatched: number;
  watchedThisWeek: number;
  watchedThisMonth: number;
  topGenres: { genre: string; count: number }[];
  mostWatchedDirectors: { name: string; count: number }[];
}> {
  const libraries = await getLibraries();
  const movieLibraries = libraries.filter(lib => lib.type === "movie");

  const fetches = movieLibraries.map(lib =>
    plexFetch(`/library/sections/${lib.key}/all?viewCount>=1`).catch(() => null)
  );

  const responses = await Promise.all(fetches);

  let totalWatched = 0;
  let watchedThisWeek = 0;
  let watchedThisMonth = 0;
  const genreCounts: Record<string, number> = {};
  const directorCounts: Record<string, number> = {};

  const now = Date.now() / 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60;
  const oneMonthAgo = now - 30 * 24 * 60 * 60;

  for (const data of responses) {
    if (!data?.MediaContainer?.Metadata) continue;

    for (const item of parseMediaItems(data.MediaContainer.Metadata)) {
      totalWatched++;
      if (item.lastViewedAt && item.lastViewedAt > oneWeekAgo) watchedThisWeek++;
      if (item.lastViewedAt && item.lastViewedAt > oneMonthAgo) watchedThisMonth++;

      for (const genre of item.genres || []) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
      for (const director of item.directors || []) {
        directorCounts[director] = (directorCounts[director] || 0) + 1;
      }
    }
  }

  return {
    totalWatched,
    watchedThisWeek,
    watchedThisMonth,
    topGenres: Object.entries(genreCounts)
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    mostWatchedDirectors: Object.entries(directorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

export async function getWatchlist(): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const movieLibraries = libraries.filter(lib => lib.type === "movie");

  const fetches = movieLibraries.map(lib =>
    plexFetch(`/library/sections/${lib.key}/all?unwatched=1&sort=addedAt:desc&X-Plex-Container-Size=30`).catch(() => null)
  );

  const responses = await Promise.all(fetches);
  const twoWeeksAgo = Date.now() / 1000 - 14 * 24 * 60 * 60;
  const watchlist: PlexMediaItem[] = [];

  for (const data of responses) {
    if (!data?.MediaContainer?.Metadata) continue;
    for (const item of parseMediaItems(data.MediaContainer.Metadata)) {
      if (item.addedAt && item.addedAt > twoWeeksAgo) {
        watchlist.push(item);
      }
    }
  }

  return watchlist.slice(0, 20);
}

export async function getLibrarySummary(): Promise<PlexLibrarySummary> {
  const libraries = await getLibraries();

  // Parallel fetch all library counts + recently added + on deck
  const countFetches = libraries.map(lib =>
    plexFetch(`/library/sections/${lib.key}/all?X-Plex-Container-Size=0`).catch(() => null)
  );

  const episodeFetches = libraries
    .filter(lib => lib.type === "show")
    .map(lib =>
      plexFetch(`/library/sections/${lib.key}/all?type=4&X-Plex-Container-Size=0`).catch(() => null)
    );

  const [countResponses, episodeResponses, recentData, onDeckData] = await Promise.all([
    Promise.all(countFetches),
    Promise.all(episodeFetches),
    plexFetch("/library/recentlyAdded?X-Plex-Container-Size=10").catch(() => null),
    plexFetch("/library/onDeck").catch(() => null),
  ]);

  let totalMovies = 0;
  let totalShows = 0;
  let totalEpisodes = 0;
  let episodeIdx = 0;

  libraries.forEach((lib, i) => {
    const count = countResponses[i]?.MediaContainer?.totalSize ||
                  countResponses[i]?.MediaContainer?.size || 0;
    lib.itemCount = count;

    if (lib.type === "movie") {
      totalMovies += count;
    } else if (lib.type === "show") {
      totalShows += count;
      totalEpisodes += episodeResponses[episodeIdx]?.MediaContainer?.totalSize ||
                       episodeResponses[episodeIdx]?.MediaContainer?.size || 0;
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
      const name = item.type === "episode"
        ? `${item.grandparentTitle} S${item.parentIndex}E${item.index}`
        : `${item.title} (${item.year || "?"})`;
      context += `- ${name}\n`;
    }
  }

  if (summary.recentlyWatched.length > 0) {
    context += `\nOn Deck:\n`;
    for (const item of summary.recentlyWatched.slice(0, 5)) {
      const name = item.type === "episode"
        ? `${item.grandparentTitle} S${item.parentIndex}E${item.index}`
        : item.title;
      context += `- ${name}\n`;
    }
  }

  context += `\nUse search tools for specific queries.`;

  return context;
}

// Get similar/related movies
export async function getSimilarMovies(title: string, count = 5): Promise<PlexMediaItem[]> {
  // First find the movie
  const searchResults = await searchLibrary(title);
  const movie = searchResults.find(m => m.type === "movie");

  if (!movie) return [];

  try {
    const data = await plexFetch(`/library/metadata/${movie.ratingKey}/similar`);
    const similar = parseMediaItems(data?.MediaContainer?.Metadata);
    return similar.slice(0, count);
  } catch {
    // Fallback: find movies with same genre/director
    const libraries = await getLibraries();
    const movieLibs = libraries.filter(l => l.type === "movie");
    const candidates: PlexMediaItem[] = [];

    for (const lib of movieLibs) {
      if (movie.genres?.[0]) {
        const genreData = await plexFetch(`/library/sections/${lib.key}/all?genre=${encodeURIComponent(movie.genres[0])}`).catch(() => null);
        if (genreData?.MediaContainer?.Metadata) {
          candidates.push(...parseMediaItems(genreData.MediaContainer.Metadata));
        }
      }
    }

    // Filter out the original movie and shuffle
    const filtered = candidates.filter(m => m.ratingKey !== movie.ratingKey);
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }
    return filtered.slice(0, count);
  }
}

// Get collections
export async function getCollections(): Promise<{ key: string; title: string; count: number }[]> {
  const libraries = await getLibraries();
  const collections: { key: string; title: string; count: number }[] = [];

  const fetches = libraries.map(lib =>
    plexFetch(`/library/sections/${lib.key}/collections`).catch(() => null)
  );

  const responses = await Promise.all(fetches);

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      for (const col of data.MediaContainer.Metadata) {
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
export async function getCollectionItems(collectionTitle: string): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();

  for (const lib of libraries) {
    try {
      const colData = await plexFetch(`/library/sections/${lib.key}/collections`);
      const collection = colData?.MediaContainer?.Metadata?.find(
        (c: any) => c.title.toLowerCase() === collectionTitle.toLowerCase()
      );

      if (collection) {
        const itemsData = await plexFetch(`/library/collections/${collection.ratingKey}/children`);
        return parseMediaItems(itemsData?.MediaContainer?.Metadata);
      }
    } catch {}
  }

  return [];
}

// Get personalized suggestions based on watch history
export async function getPersonalizedSuggestions(): Promise<string[]> {
  const stats = await getWatchStats();
  const suggestions: string[] = [];

  // Add genre-based suggestions
  if (stats.topGenres.length > 0) {
    const topGenre = stats.topGenres[0].genre;
    suggestions.push(`More ${topGenre.toLowerCase()} movies`);
    if (stats.topGenres[1]) {
      suggestions.push(`${stats.topGenres[1].genre} films I haven't seen`);
    }
  }

  // Add director-based suggestions
  if (stats.mostWatchedDirectors.length > 0) {
    suggestions.push(`More from ${stats.mostWatchedDirectors[0].name}`);
  }

  // Add time-based suggestions
  if (stats.watchedThisWeek > 0) {
    suggestions.push("Something different from what I watched this week");
  }

  // Add discovery suggestions
  suggestions.push("Hidden gems I might have missed");
  suggestions.push("Critically acclaimed unwatched films");

  return suggestions.slice(0, 4);
}

export type { PlexMediaItem, PlexLibrary, PlexLibrarySummary };
