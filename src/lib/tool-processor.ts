import {
  searchByPerson,
  searchLibrary,
  getUnwatchedMovies,
  getUnwatchedShows,
  searchByGenre,
  getWatchHistory,
  getWatchStats,
  getWatchlist,
  getSimilarMovies,
  getCollections,
  getCollectionItems,
  getMediaDetails,
  pickRandomMovie,
} from "@/lib/plex";
import { diversifyByDirector } from "@/lib/plex-search";
import { shuffle } from "@/lib/utils";
import { validateToolInput } from "@/lib/schemas";

// External API functions
export interface ExternalLookupConfig {
  omdbApiKey: string | null;
  webSearch: (query: string, maxResults?: number) => Promise<string>;
  getLetterboxdRating: (title: string, year?: string) => Promise<{ rating: string; url: string } | null>;
  getImdbRating: (title: string, year?: string) => Promise<{ rating: string; votes: string } | null>;
  lookupMovieExternal: (title: string, year?: string) => Promise<string>;
}

let externalConfig: ExternalLookupConfig | null = null;

export function setExternalConfig(config: ExternalLookupConfig): void {
  externalConfig = config;
}

// Process tool calls with validation
export async function processToolCall(
  toolName: string,
  toolInput: unknown
): Promise<string> {
  // Validate input
  const validation = validateToolInput(toolName, toolInput);
  if (!validation.success) {
    return `Invalid input for ${toolName}: ${validation.error}`;
  }

  const input = validation.data as Record<string, unknown>;

  switch (toolName) {
    case "search_by_person": {
      const results = await searchByPerson(input.name as string);
      if (results.movies.length === 0 && results.shows.length === 0) {
        return `No movies or shows found featuring "${input.name}" in the library.`;
      }
      let response = "";
      if (results.movies.length > 0) {
        response += `Movies with ${input.name} (${results.movies.length} found):\n`;
        for (const movie of results.movies.slice(0, 15)) {
          const directors = movie.directors?.length ? ` - Dir: ${movie.directors.join(", ")}` : "";
          response += `- **${movie.title}** (${movie.year || "?"})${directors}\n`;
        }
        if (results.movies.length > 15) {
          response += `... and ${results.movies.length - 15} more movies\n`;
        }
      }
      if (results.shows.length > 0) {
        response += `\nTV Shows with ${input.name} (${results.shows.length} found):\n`;
        for (const show of results.shows.slice(0, 10)) {
          response += `- **${show.title}** (${show.year || "?"}) - ${show.leafCount || "?"} episodes\n`;
        }
      }
      return response;
    }

    case "search_library": {
      const results = await searchLibrary(input.query as string);
      if (results.length === 0) {
        return `No results found for "${input.query}" in the library.`;
      }
      let response = `Search results for "${input.query}" (${results.length} found):\n`;
      for (const item of results.slice(0, 15)) {
        const type = item.type === "movie" ? "Movie" : item.type === "show" ? "TV Show" : item.type;
        const directors = item.directors?.length ? ` - Dir: ${item.directors.join(", ")}` : "";
        response += `- [${type}] **${item.title}** (${item.year || "?"})${directors}\n`;
      }
      return response;
    }

    case "get_recommendations": {
      const count = (input.count as number) || 5;
      const genre = input.genre as string | undefined;
      const movies = await getUnwatchedMovies(count, genre);
      if (movies.length === 0) {
        return genre
          ? `No unwatched ${genre} movies found in the library.`
          : "No unwatched movies found in the library.";
      }
      let response = genre
        ? `Here are ${movies.length} unwatched ${genre} movies from your library:\n`
        : `Here are ${movies.length} unwatched movies from your library:\n`;
      for (const movie of movies) {
        const genres = movie.genres?.slice(0, 3).join(", ") || "";
        const director = movie.directors?.[0] ? ` - Dir: ${movie.directors[0]}` : "";
        const summary = movie.summary ? ` - ${movie.summary.slice(0, 100)}...` : "";
        response += `- **${movie.title}** (${movie.year || "?"})${director}${genres ? ` [${genres}]` : ""}${summary}\n`;
      }
      return response;
    }

    case "get_tv_recommendations": {
      const count = (input.count as number) || 5;
      const genre = input.genre as string | undefined;
      const shows = await getUnwatchedShows(count, genre);
      if (shows.length === 0) {
        return genre
          ? `No ${genre} TV shows found in the library.`
          : "No TV shows found in the library.";
      }
      let response = genre
        ? `Here are ${shows.length} ${genre} TV shows to binge from your library:\n`
        : `Here are ${shows.length} TV shows to binge from your library:\n`;
      for (const show of shows) {
        const genres = show.genres?.slice(0, 3).join(", ") || "";
        const episodes = show.leafCount ? ` - ${show.leafCount} episodes` : "";
        response += `- **${show.title}** (${show.year || "?"})${genres ? ` [${genres}]` : ""}${episodes}\n`;
      }
      return response;
    }

    case "search_by_genre": {
      const type = (input.type as "movie" | "show") || "movie";
      const results = await searchByGenre(input.genre as string, type);
      if (results.length === 0) {
        return `No ${type}s found in the ${input.genre} genre.`;
      }
      // Shuffle then diversify to avoid multiple films from same director
      const shuffled = shuffle(results);
      const diverse = type === "movie" ? diversifyByDirector(shuffled) : shuffled;
      const selected = diverse.slice(0, 12);
      let response = `Found ${results.length} ${type}s in ${input.genre}. Here are some:\n`;
      for (const item of selected) {
        const watched = item.viewCount ? " [WATCHED]" : "";
        const director = item.directors?.[0] ? ` - Dir: ${item.directors[0]}` : "";
        response += `- **${item.title}** (${item.year || "?"})${director}${watched}\n`;
      }
      return response;
    }

    case "get_watch_history": {
      const limit = (input.limit as number) || 20;
      const history = await getWatchHistory(limit);
      if (history.length === 0) {
        return "No watch history found.";
      }
      let response = `Your recent watch history (${history.length} items):\n`;
      for (const item of history) {
        const date = item.lastViewedAt ? new Date(item.lastViewedAt * 1000).toLocaleDateString() : "?";
        const name = item.type === "episode"
          ? `${item.grandparentTitle} S${item.parentIndex}E${item.index} "${item.title}"`
          : `**${item.title}** (${item.year || "?"})`;
        response += `- ${name} - watched ${date}\n`;
      }
      return response;
    }

    case "get_watch_stats": {
      const stats = await getWatchStats();
      let response = `Your viewing stats:\n`;
      response += `- Total movies watched: ${stats.totalWatched}\n`;
      response += `- Watched this week: ${stats.watchedThisWeek}\n`;
      response += `- Watched this month: ${stats.watchedThisMonth}\n\n`;

      if (stats.topGenres.length > 0) {
        response += `Your top genres:\n`;
        for (const g of stats.topGenres) {
          response += `- ${g.genre}: ${g.count} movies\n`;
        }
      }

      if (stats.mostWatchedDirectors.length > 0) {
        response += `\nMost watched directors:\n`;
        for (const d of stats.mostWatchedDirectors) {
          response += `- ${d.name}: ${d.count} movies\n`;
        }
      }
      return response;
    }

    case "get_watchlist": {
      const watchlist = await getWatchlist();
      if (watchlist.length === 0) {
        return "Your watchlist is empty (no recently added unwatched movies).";
      }
      let response = `Your watchlist (${watchlist.length} unwatched recently-added movies):\n`;
      for (const item of watchlist) {
        const genres = item.genres?.slice(0, 2).join(", ") || "";
        response += `- **${item.title}** (${item.year || "?"})${genres ? ` [${genres}]` : ""}\n`;
      }
      return response;
    }

    case "get_similar_movies": {
      const count = (input.count as number) || 5;
      const similar = await getSimilarMovies(input.title as string, count);
      if (similar.length === 0) {
        return `Couldn't find movies similar to "${input.title}" - the movie may not be in the library.`;
      }
      let response = `Movies similar to "${input.title}":\n`;
      for (const movie of similar) {
        const genres = movie.genres?.slice(0, 2).join(", ") || "";
        response += `- **${movie.title}** (${movie.year || "?"})${genres ? ` [${genres}]` : ""}\n`;
      }
      return response;
    }

    case "get_collections": {
      const collections = await getCollections();
      if (collections.length === 0) {
        return "No collections found in your library.";
      }
      let response = `Your collections (${collections.length} total):\n`;
      for (const col of collections) {
        response += `- **${col.title}** (${col.count} items)\n`;
      }
      return response;
    }

    case "get_collection_items": {
      const items = await getCollectionItems(input.collection as string);
      if (items.length === 0) {
        return `Collection "${input.collection}" not found or is empty.`;
      }
      let response = `"${input.collection}" collection (${items.length} items):\n`;
      for (const item of items) {
        response += `- **${item.title}** (${item.year || "?"})\n`;
      }
      return response;
    }

    case "random_movie_picker": {
      const unwatchedOnly = input.unwatched_only === undefined ? true : Boolean(input.unwatched_only);
      const genre = input.genre as string | undefined;
      const movie = await pickRandomMovie(unwatchedOnly, genre);

      if (!movie) {
        return genre
          ? `No ${unwatchedOnly ? "unwatched " : ""}${genre} movies found in the library.`
          : `No ${unwatchedOnly ? "unwatched " : ""}movies found in the library.`;
      }

      let response = `**The wheel has spoken!**\n\n`;
      response += `**${movie.title}** (${movie.year || "?"})\n\n`;

      if (movie.genres && movie.genres.length > 0) {
        response += `**Genre:** ${movie.genres.slice(0, 3).join(", ")}\n`;
      }
      if (movie.directors && movie.directors.length > 0) {
        response += `**Director:** ${movie.directors[0]}\n`;
      }
      if (movie.summary) {
        const shortSummary = movie.summary.length > 200
          ? movie.summary.slice(0, 200) + "..."
          : movie.summary;
        response += `\n${shortSummary}\n`;
      }

      response += `\n_This is your destiny for tonight!_`;
      return response;
    }

    case "get_media_details": {
      const details = await getMediaDetails(input.title as string);
      if (!details) {
        return `Could not find "${input.title}" in the library.`;
      }

      // Fetch external ratings in parallel (only for movies)
      const isMovie = details.type === "movie";
      let letterboxd: { rating: string; url: string } | null = null;
      let imdb: { rating: string; votes: string } | null = null;

      if (externalConfig && isMovie) {
        [letterboxd, imdb] = await Promise.all([
          externalConfig.getLetterboxdRating(details.title, details.year?.toString()),
          externalConfig.getImdbRating(details.title, details.year?.toString()),
        ]);
      }

      let response = `**${details.title}** (${details.year || "?"})`;
      if (details.contentRating) response += ` [${details.contentRating}]`;
      if (details.duration) response += ` - ${details.duration}`;
      response += `\n\n`;

      if (details.rating || letterboxd || imdb) {
        response += `**Ratings:**\n`;
        if (imdb) {
          response += `- IMDb: ${imdb.rating}${imdb.votes ? ` (${imdb.votes} votes)` : ""}\n`;
        }
        if (details.rating) {
          response += `- Rotten Tomatoes: ${Math.round(details.rating * 10)}%\n`;
        }
        if (letterboxd) {
          response += `- Letterboxd: ${letterboxd.rating}\n`;
        }
        response += `\n`;
      }
      if (details.genres.length > 0) {
        response += `Genres: ${details.genres.join(", ")}\n`;
      }
      if (details.studio) {
        response += `Studio: ${details.studio}\n`;
      }
      response += `\n`;

      if (details.summary) {
        response += `**Synopsis:**\n${details.summary}\n\n`;
      }

      if (details.directors.length > 0) {
        response += `**Director${details.directors.length > 1 ? "s" : ""}:** ${details.directors.join(", ")}\n`;
      }
      if (details.writers.length > 0) {
        response += `**Writer${details.writers.length > 1 ? "s" : ""}:** ${details.writers.join(", ")}\n`;
      }

      if (details.cast.length > 0) {
        response += `\n**Cast:**\n`;
        for (const actor of details.cast) {
          response += `- ${actor.name} as ${actor.role}\n`;
        }
      }

      response += `\n`;
      if (details.addedAt) {
        response += `Added to library: ${details.addedAt}\n`;
      }
      if (details.viewCount) {
        response += `Watched ${details.viewCount} time${details.viewCount > 1 ? "s" : ""}`;
        if (details.lastViewedAt) {
          response += ` (last: ${details.lastViewedAt})`;
        }
        response += `\n`;
      } else {
        response += `Not yet watched\n`;
      }

      return response;
    }

    case "web_search": {
      if (!externalConfig) {
        return "Web search is not configured.";
      }
      return await externalConfig.webSearch(input.query as string);
    }

    case "lookup_movie_external": {
      if (!externalConfig) {
        return "External movie lookup is not configured.";
      }
      return await externalConfig.lookupMovieExternal(
        input.title as string,
        input.year as string | undefined
      );
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
