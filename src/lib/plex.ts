// Plex API client for fetching library data

const PLEX_URL = process.env.PLEX_URL;
const PLEX_TOKEN = process.env.PLEX_TOKEN;

interface PlexMediaItem {
  ratingKey: string;
  title: string;
  type: string;
  year?: number;
  summary?: string;
  rating?: number;
  audienceRating?: number;
  contentRating?: string;
  duration?: number;
  genres?: string[];
  directors?: string[];
  actors?: string[];
  studio?: string;
  addedAt?: number;
  lastViewedAt?: number;
  viewCount?: number;
  thumb?: string;
  grandparentTitle?: string; // For episodes - show name
  parentTitle?: string; // For episodes - season name
  index?: number; // Episode number
  parentIndex?: number; // Season number
  childCount?: number; // For shows - number of seasons
  leafCount?: number; // For shows - total episodes
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

async function plexFetch(endpoint: string): Promise<any> {
  if (!PLEX_URL || !PLEX_TOKEN) {
    throw new Error("Plex URL and Token must be configured");
  }

  const url = `${PLEX_URL}${endpoint}`;
  const separator = endpoint.includes("?") ? "&" : "?";

  const response = await fetch(`${url}${separator}X-Plex-Token=${PLEX_TOKEN}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Plex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getLibraries(): Promise<PlexLibrary[]> {
  const data = await plexFetch("/library/sections");
  return data.MediaContainer.Directory.map((lib: any) => ({
    key: lib.key,
    title: lib.title,
    type: lib.type,
  }));
}

export async function getLibraryItems(
  libraryKey: string,
  limit?: number
): Promise<PlexMediaItem[]> {
  const endpoint = limit
    ? `/library/sections/${libraryKey}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=${limit}`
    : `/library/sections/${libraryKey}/all`;

  const data = await plexFetch(endpoint);
  return parseMediaItems(data.MediaContainer.Metadata || []);
}

export async function getRecentlyAdded(limit = 20): Promise<PlexMediaItem[]> {
  const data = await plexFetch(`/library/recentlyAdded?X-Plex-Container-Size=${limit}`);
  return parseMediaItems(data.MediaContainer.Metadata || []);
}

export async function getOnDeck(): Promise<PlexMediaItem[]> {
  const data = await plexFetch("/library/onDeck");
  return parseMediaItems(data.MediaContainer.Metadata || []);
}

export async function searchLibrary(query: string): Promise<PlexMediaItem[]> {
  const data = await plexFetch(`/search?query=${encodeURIComponent(query)}`);
  return parseMediaItems(data.MediaContainer.Metadata || []);
}

// Search for movies/shows by actor or director
export async function searchByPerson(name: string): Promise<{ movies: PlexMediaItem[]; shows: PlexMediaItem[] }> {
  const libraries = await getLibraries();
  const results: { movies: PlexMediaItem[]; shows: PlexMediaItem[] } = { movies: [], shows: [] };

  for (const lib of libraries) {
    if (lib.type === "movie") {
      // Search by actor
      try {
        const actorData = await plexFetch(`/library/sections/${lib.key}/all?actor=${encodeURIComponent(name)}`);
        results.movies.push(...parseMediaItems(actorData.MediaContainer.Metadata || []));
      } catch (e) { /* no results */ }

      // Search by director
      try {
        const directorData = await plexFetch(`/library/sections/${lib.key}/all?director=${encodeURIComponent(name)}`);
        const directorMovies = parseMediaItems(directorData.MediaContainer.Metadata || []);
        // Avoid duplicates
        for (const movie of directorMovies) {
          if (!results.movies.find(m => m.ratingKey === movie.ratingKey)) {
            results.movies.push(movie);
          }
        }
      } catch (e) { /* no results */ }
    } else if (lib.type === "show") {
      try {
        const actorData = await plexFetch(`/library/sections/${lib.key}/all?actor=${encodeURIComponent(name)}`);
        results.shows.push(...parseMediaItems(actorData.MediaContainer.Metadata || []));
      } catch (e) { /* no results */ }
    }
  }

  return results;
}

// Get detailed info about a specific movie or show
export async function getMediaDetails(title: string): Promise<PlexMediaItem | null> {
  const searchResults = await searchLibrary(title);
  if (searchResults.length === 0) return null;

  // Return the first match with full details
  const item = searchResults[0];
  return item;
}

export async function getLibrarySummary(): Promise<PlexLibrarySummary> {
  const libraries = await getLibraries();

  let totalMovies = 0;
  let totalShows = 0;
  let totalEpisodes = 0;

  // Get counts for each library
  for (const lib of libraries) {
    try {
      const data = await plexFetch(`/library/sections/${lib.key}/all?X-Plex-Container-Size=0`);
      const count = data.MediaContainer.totalSize || data.MediaContainer.size || 0;
      lib.itemCount = count;

      if (lib.type === "movie") {
        totalMovies += count;
      } else if (lib.type === "show") {
        totalShows += count;
        // Get episode count
        const episodeData = await plexFetch(
          `/library/sections/${lib.key}/all?type=4&X-Plex-Container-Size=0`
        );
        totalEpisodes += episodeData.MediaContainer.totalSize || episodeData.MediaContainer.size || 0;
      }
    } catch (e) {
      console.error(`Error fetching library ${lib.title}:`, e);
    }
  }

  const recentlyAdded = await getRecentlyAdded(10);

  let recentlyWatched: PlexMediaItem[] = [];
  try {
    recentlyWatched = await getOnDeck();
  } catch (e) {
    // On deck might not be available
  }

  return {
    libraries,
    totalMovies,
    totalShows,
    totalEpisodes,
    recentlyAdded,
    recentlyWatched,
  };
}

export async function getAllMovies(): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const movieLibraries = libraries.filter((lib) => lib.type === "movie");

  const allMovies: PlexMediaItem[] = [];
  for (const lib of movieLibraries) {
    const movies = await getLibraryItems(lib.key);
    allMovies.push(...movies);
  }

  return allMovies;
}

export async function getAllShows(): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const showLibraries = libraries.filter((lib) => lib.type === "show");

  const allShows: PlexMediaItem[] = [];
  for (const lib of showLibraries) {
    const shows = await getLibraryItems(lib.key);
    allShows.push(...shows);
  }

  return allShows;
}

export async function getUnwatchedMovies(): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const movieLibraries = libraries.filter((lib) => lib.type === "movie");

  const unwatched: PlexMediaItem[] = [];
  for (const lib of movieLibraries) {
    const data = await plexFetch(`/library/sections/${lib.key}/unwatched`);
    unwatched.push(...parseMediaItems(data.MediaContainer.Metadata || []));
  }

  return unwatched;
}

function parseMediaItems(items: any[]): PlexMediaItem[] {
  return items.map((item: any) => ({
    ratingKey: item.ratingKey,
    title: item.title,
    type: item.type,
    year: item.year,
    summary: item.summary,
    rating: item.rating,
    audienceRating: item.audienceRating,
    contentRating: item.contentRating,
    duration: item.duration,
    genres: item.Genre?.map((g: any) => g.tag) || [],
    directors: item.Director?.map((d: any) => d.tag) || [],
    actors: item.Role?.map((r: any) => r.tag).slice(0, 5) || [],
    studio: item.studio,
    addedAt: item.addedAt,
    lastViewedAt: item.lastViewedAt,
    viewCount: item.viewCount,
    thumb: item.thumb,
    grandparentTitle: item.grandparentTitle,
    parentTitle: item.parentTitle,
    index: item.index,
    parentIndex: item.parentIndex,
    childCount: item.childCount,
    leafCount: item.leafCount,
  }));
}

// Format library data as context for Claude - minimal format to reduce tokens
export async function getLibraryContext(): Promise<string> {
  const summary = await getLibrarySummary();

  let context = `Plex Library: ${summary.totalMovies} movies, ${summary.totalShows} TV shows, ${summary.totalEpisodes} episodes.\n\n`;

  // Recently added
  context += `Recently Added:\n`;
  for (const item of summary.recentlyAdded.slice(0, 10)) {
    const name = item.type === "episode"
      ? `${item.grandparentTitle} S${item.parentIndex}E${item.index}`
      : `${item.title} (${item.year || "?"})`;
    context += `- ${name}\n`;
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

  context += `\nNote: Use the search tools to find specific movies, shows, actors, or directors. The full library is too large to list here.`;

  return context;
}

export type { PlexMediaItem, PlexLibrary, PlexLibrarySummary };
