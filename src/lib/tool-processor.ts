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
import {
  validateToolInput,
  type SearchByPersonInput,
  type SearchLibraryInput,
  type GetRecommendationsInput,
  type GetTvRecommendationsInput,
  type SearchByGenreInput,
  type GetWatchHistoryInput,
  type GetSimilarMoviesInput,
  type GetCollectionItemsInput,
  type GetMediaDetailsInput,
  type RandomMoviePickerInput,
  type WebSearchInput,
  type LookupMovieExternalInput,
  type GetTrailerInput,
} from "@/lib/schemas";

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

  const validatedInput = validation.data;

  switch (toolName) {
    case "search_by_person": {
      const input = validatedInput as SearchByPersonInput;
      const results = await searchByPerson(input.name);
      if (results.movies.length === 0 && results.shows.length === 0) {
        return `No movies or shows found featuring "${input.name}" in the library.`;
      }

      // Fetch Letterboxd ratings for movies in parallel (limit to first 15)
      const moviesToShow = results.movies.slice(0, 15);
      const letterboxdRatings = externalConfig
        ? await Promise.all(
            moviesToShow.map(m => externalConfig!.getLetterboxdRating(m.title, m.year?.toString()))
          )
        : moviesToShow.map(() => null);

      let response = "";
      if (results.movies.length > 0) {
        response += `Movies with ${input.name} (${results.movies.length} found):\n`;
        for (let i = 0; i < moviesToShow.length; i++) {
          const movie = moviesToShow[i];
          const lb = letterboxdRatings[i];
          const directors = movie.directors?.length ? ` - Dir: ${movie.directors.join(", ")}` : "";
          const rating = lb ? ` ⭐ ${lb.rating}` : "";
          response += `- **${movie.title}** (${movie.year || "?"})${rating}${directors}\n`;
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
      const input = validatedInput as SearchLibraryInput;
      const results = await searchLibrary(input.query);
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
      const input = validatedInput as GetRecommendationsInput;
      const count = input.count ?? 5;
      const genre = input.genre;
      const movies = await getUnwatchedMovies(count, genre);
      if (movies.length === 0) {
        return genre
          ? `No unwatched ${genre} movies found in the library.`
          : "No unwatched movies found in the library.";
      }

      // Fetch Letterboxd ratings in parallel
      const letterboxdRatings = externalConfig
        ? await Promise.all(
            movies.map(m => externalConfig!.getLetterboxdRating(m.title, m.year?.toString()))
          )
        : movies.map(() => null);

      let response = genre
        ? `Here are ${movies.length} unwatched ${genre} movies from your library:\n`
        : `Here are ${movies.length} unwatched movies from your library:\n`;
      for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];
        const lb = letterboxdRatings[i];
        const genres = movie.genres?.slice(0, 3).join(", ") || "";
        const director = movie.directors?.[0] ? ` - Dir: ${movie.directors[0]}` : "";
        const rating = lb ? ` ⭐ ${lb.rating}` : "";
        const summary = movie.summary ? ` - ${movie.summary.slice(0, 100)}...` : "";
        response += `- **${movie.title}** (${movie.year || "?"})${rating}${director}${genres ? ` [${genres}]` : ""}${summary}\n`;
      }
      return response;
    }

    case "get_tv_recommendations": {
      const input = validatedInput as GetTvRecommendationsInput;
      const count = input.count ?? 5;
      const genre = input.genre;
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
      const input = validatedInput as SearchByGenreInput;
      const type = input.type ?? "movie";
      const results = await searchByGenre(input.genre, type);
      if (results.length === 0) {
        return `No ${type}s found in the ${input.genre} genre.`;
      }
      // Shuffle then diversify to avoid multiple films from same director
      const shuffled = shuffle(results);
      const diverse = type === "movie" ? diversifyByDirector(shuffled) : shuffled;
      const selected = diverse.slice(0, 12);

      // Fetch Letterboxd ratings for movies in parallel
      const letterboxdRatings = (externalConfig && type === "movie")
        ? await Promise.all(
            selected.map(m => externalConfig!.getLetterboxdRating(m.title, m.year?.toString()))
          )
        : selected.map(() => null);

      let response = `Found ${results.length} ${type}s in ${input.genre}. Here are some:\n`;
      for (let i = 0; i < selected.length; i++) {
        const item = selected[i];
        const lb = letterboxdRatings[i];
        const watched = item.viewCount ? " [WATCHED]" : "";
        const director = item.directors?.[0] ? ` - Dir: ${item.directors[0]}` : "";
        const rating = lb ? ` ⭐ ${lb.rating}` : "";
        response += `- **${item.title}** (${item.year || "?"})${rating}${director}${watched}\n`;
      }
      return response;
    }

    case "get_watch_history": {
      const input = validatedInput as GetWatchHistoryInput;
      const limit = input.limit ?? 20;
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
      const input = validatedInput as GetSimilarMoviesInput;
      const count = input.count ?? 5;
      const similar = await getSimilarMovies(input.title, count);
      if (similar.length === 0) {
        return `Couldn't find movies similar to "${input.title}" - the movie may not be in the library.`;
      }

      // Fetch Letterboxd ratings in parallel
      const letterboxdRatings = externalConfig
        ? await Promise.all(
            similar.map(m => externalConfig!.getLetterboxdRating(m.title, m.year?.toString()))
          )
        : similar.map(() => null);

      let response = `Movies similar to "${input.title}":\n`;
      for (let i = 0; i < similar.length; i++) {
        const movie = similar[i];
        const lb = letterboxdRatings[i];
        const genres = movie.genres?.slice(0, 2).join(", ") || "";
        const rating = lb ? ` ⭐ ${lb.rating}` : "";
        response += `- **${movie.title}** (${movie.year || "?"})${rating}${genres ? ` [${genres}]` : ""}\n`;
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
      const input = validatedInput as GetCollectionItemsInput;
      const items = await getCollectionItems(input.collection);
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
      const input = validatedInput as RandomMoviePickerInput;
      const unwatchedOnly = input.unwatched_only ?? true;
      const genre = input.genre;
      const movie = await pickRandomMovie(unwatchedOnly, genre);

      if (!movie) {
        return genre
          ? `No ${unwatchedOnly ? "unwatched " : ""}${genre} movies found in the library.`
          : `No ${unwatchedOnly ? "unwatched " : ""}movies found in the library.`;
      }

      // Fetch Letterboxd rating
      const letterboxd = externalConfig
        ? await externalConfig.getLetterboxdRating(movie.title, movie.year?.toString())
        : null;

      let response = `**The wheel has spoken!**\n\n`;
      response += `**${movie.title}** (${movie.year || "?"})\n\n`;

      if (letterboxd) {
        response += `**Letterboxd:** ⭐ ${letterboxd.rating}\n`;
      }
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
      const input = validatedInput as GetMediaDetailsInput;
      const details = await getMediaDetails(input.title);
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
      const input = validatedInput as WebSearchInput;
      if (!externalConfig) {
        return "Web search is not configured.";
      }
      return await externalConfig.webSearch(input.query);
    }

    case "lookup_movie_external": {
      const input = validatedInput as LookupMovieExternalInput;
      if (!externalConfig) {
        return "External movie lookup is not configured.";
      }
      return await externalConfig.lookupMovieExternal(input.title, input.year);
    }

    case "get_trailer": {
      const input = validatedInput as GetTrailerInput;
      const title = input.title;
      const year = input.year;
      const searchQuery = year ? `${title} ${year} official trailer` : `${title} official trailer`;
      const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
      return `**Watch Trailer:** [${title} - Official Trailer](${youtubeUrl})`;
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}
