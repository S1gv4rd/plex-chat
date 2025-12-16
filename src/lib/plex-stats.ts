// Plex watch history and statistics

import type { PlexMediaItem } from "./plex-types";
import { plexFetch, getLibraries, parseMediaItems, logPlexError } from "./plex-api";

export async function getWatchHistory(limit = 20): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();

  const fetches = libraries
    .filter((lib) => lib.type === "movie" || lib.type === "show")
    .map((lib) => {
      const endpoint =
        lib.type === "movie"
          ? `/library/sections/${lib.key}/all?viewCount>=1&sort=lastViewedAt:desc&X-Plex-Container-Size=${limit}`
          : `/library/sections/${lib.key}/all?type=4&viewCount>=1&sort=lastViewedAt:desc&X-Plex-Container-Size=${limit}`;
      return plexFetch(endpoint).catch((e) => {
        logPlexError(`getWatchHistory in ${lib.title}`, e);
        return null;
      });
    });

  const responses = await Promise.all(fetches);
  const watched: PlexMediaItem[] = [];

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      watched.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  }

  return watched
    .filter((item) => item.lastViewedAt)
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
  const movieLibraries = libraries.filter((lib) => lib.type === "movie");

  const fetches = movieLibraries.map((lib) =>
    plexFetch(`/library/sections/${lib.key}/all?viewCount>=1`).catch((e) => {
      logPlexError(`getWatchStats in ${lib.title}`, e);
      return null;
    })
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
      if (item.lastViewedAt && item.lastViewedAt > oneWeekAgo)
        watchedThisWeek++;
      if (item.lastViewedAt && item.lastViewedAt > oneMonthAgo)
        watchedThisMonth++;

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
  const movieLibraries = libraries.filter((lib) => lib.type === "movie");

  const fetches = movieLibraries.map((lib) =>
    plexFetch(
      `/library/sections/${lib.key}/all?unwatched=1&sort=addedAt:desc&X-Plex-Container-Size=30`
    ).catch((e) => {
      logPlexError(`getWatchlist in ${lib.title}`, e);
      return null;
    })
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
