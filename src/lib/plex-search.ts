// Plex search functions

import type { PlexMediaItem } from "./plex-types";
import { plexFetch, getLibraries, parseMediaItems, logPlexError } from "./plex-api";
import { shuffle } from "./utils";

/**
 * Diversify a list of media items to avoid multiple items from the same director.
 * Ensures variety in recommendations by limiting to max 1 item per director.
 */
export function diversifyByDirector(
  items: PlexMediaItem[],
  maxPerDirector: number = 1
): PlexMediaItem[] {
  const directorCounts = new Map<string, number>();
  const diverse: PlexMediaItem[] = [];

  for (const item of items) {
    const director = item.directors?.[0]?.toLowerCase();

    // Items without directors are always included
    if (!director) {
      diverse.push(item);
      continue;
    }

    const count = directorCounts.get(director) || 0;
    if (count < maxPerDirector) {
      directorCounts.set(director, count + 1);
      diverse.push(item);
    }
  }

  return diverse;
}

export async function searchLibrary(query: string): Promise<PlexMediaItem[]> {
  const data = await plexFetch(`/search?query=${encodeURIComponent(query)}`);
  return parseMediaItems(data?.MediaContainer?.Metadata);
}

export async function searchByPerson(
  name: string
): Promise<{ movies: PlexMediaItem[]; shows: PlexMediaItem[] }> {
  const libraries = await getLibraries();
  const results: { movies: PlexMediaItem[]; shows: PlexMediaItem[] } = {
    movies: [],
    shows: [],
  };
  const seen = new Set<string>();

  // Parallel fetch for all libraries
  const fetches = libraries.flatMap((lib) => {
    if (lib.type === "movie") {
      return [
        plexFetch(
          `/library/sections/${lib.key}/all?actor=${encodeURIComponent(name)}`
        ).catch((e) => {
          logPlexError(`searchByPerson actor in ${lib.title}`, e);
          return null;
        }),
        plexFetch(
          `/library/sections/${lib.key}/all?director=${encodeURIComponent(name)}`
        ).catch((e) => {
          logPlexError(`searchByPerson director in ${lib.title}`, e);
          return null;
        }),
      ];
    } else if (lib.type === "show") {
      return [
        plexFetch(
          `/library/sections/${lib.key}/all?actor=${encodeURIComponent(name)}`
        ).catch((e) => {
          logPlexError(`searchByPerson actor (shows) in ${lib.title}`, e);
          return null;
        }),
      ];
    }
    return [];
  });

  const responses = await Promise.all(fetches);
  const movieLibs = libraries.filter((l) => l.type === "movie").length;

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

export async function getUnwatchedMovies(
  count = 20,
  genre?: string
): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const movieLibraries = libraries.filter((lib) => lib.type === "movie");

  const fetches = movieLibraries.map((lib) => {
    const endpoint = genre
      ? `/library/sections/${lib.key}/unwatched?genre=${encodeURIComponent(genre)}`
      : `/library/sections/${lib.key}/unwatched`;
    return plexFetch(endpoint).catch((e) => {
      logPlexError(`getUnwatchedMovies in ${lib.title}`, e);
      return null;
    });
  });

  const responses = await Promise.all(fetches);
  const unwatched: PlexMediaItem[] = [];

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      unwatched.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  }

  // Shuffle first, then diversify by director to avoid multiple films from same director
  const shuffled = shuffle(unwatched);
  const diverse = diversifyByDirector(shuffled);
  return diverse.slice(0, count);
}

export async function getUnwatchedShows(
  count = 10,
  genre?: string
): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const showLibraries = libraries.filter((lib) => lib.type === "show");

  const fetches = showLibraries.map((lib) => {
    const endpoint = genre
      ? `/library/sections/${lib.key}/all?genre=${encodeURIComponent(genre)}`
      : `/library/sections/${lib.key}/all`;
    return plexFetch(endpoint).catch((e) => {
      logPlexError(`getUnwatchedShows in ${lib.title}`, e);
      return null;
    });
  });

  const responses = await Promise.all(fetches);
  const shows: PlexMediaItem[] = [];

  for (const data of responses) {
    if (data?.MediaContainer?.Metadata) {
      shows.push(...parseMediaItems(data.MediaContainer.Metadata));
    }
  }

  return shuffle(shows).slice(0, count);
}

export async function searchByGenre(
  genre: string,
  type: "movie" | "show" = "movie"
): Promise<PlexMediaItem[]> {
  const libraries = await getLibraries();
  const filteredLibraries = libraries.filter((lib) => lib.type === type);

  const fetches = filteredLibraries.map((lib) =>
    plexFetch(
      `/library/sections/${lib.key}/all?genre=${encodeURIComponent(genre)}`
    ).catch((e) => {
      logPlexError(`searchByGenre in ${lib.title}`, e);
      return null;
    })
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
