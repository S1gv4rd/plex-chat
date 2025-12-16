import Anthropic from "@anthropic-ai/sdk";
import { getLibraryContext, searchByPerson, searchLibrary, getUnwatchedMovies, getUnwatchedShows, searchByGenre, getWatchHistory, getWatchStats, getWatchlist, getSimilarMovies, getCollections, getCollectionItems, getMediaDetails, pickRandomMovie, setCustomCredentials } from "@/lib/plex";
import { shuffle } from "@/lib/utils";
import { NextRequest } from "next/server";

// Simple in-memory rate limiter
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10, // max requests per window
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 60 * 1000);

// CSRF protection - verify origin matches host
function verifyCsrf(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Allow requests without origin (same-origin requests from some browsers)
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

// Web search using DuckDuckGo HTML with robust fallback parsing
async function webSearch(query: string, maxResults: number = 5): Promise<string> {
  const parseStrategies = [
    // Strategy 1: Standard DuckDuckGo result structure
    (html: string) => {
      const results: { title: string; snippet: string; url: string }[] = [];
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*)/g;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        const url = match[1];
        const title = match[2].trim();
        const snippet = match[3].trim();
        if (title && snippet) results.push({ title, url, snippet });
      }
      return results;
    },
    // Strategy 2: Simpler class-based parsing
    (html: string) => {
      const results: { title: string; snippet: string; url: string }[] = [];
      const titleMatches = html.match(/<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/g) || [];
      const snippetMatches = html.match(/<a[^>]*class="result__snippet"[^>]*>([^<]+)/g) || [];
      for (let i = 0; i < Math.min(titleMatches.length, snippetMatches.length, maxResults); i++) {
        const titleMatch = titleMatches[i].match(/>([^<]+)<\/a>/);
        const snippetMatch = snippetMatches[i].match(/>([^<]+)/);
        if (titleMatch && snippetMatch) {
          results.push({ title: titleMatch[1].trim(), snippet: snippetMatch[1].trim(), url: "" });
        }
      }
      return results;
    },
    // Strategy 3: Generic link + text extraction (fallback)
    (html: string) => {
      const results: { title: string; snippet: string; url: string }[] = [];
      // Look for any structured result blocks
      const blockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      let blockMatch;
      while ((blockMatch = blockRegex.exec(html)) !== null && results.length < maxResults) {
        const block = blockMatch[1];
        const linkMatch = block.match(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/);
        const textMatch = block.match(/<[^>]*class="[^"]*snippet[^"]*"[^>]*>([^<]+)/i) ||
                          block.match(/<p[^>]*>([^<]{20,})</);
        if (linkMatch && textMatch) {
          results.push({ url: linkMatch[1], title: linkMatch[2].trim(), snippet: textMatch[1].trim() });
        }
      }
      return results;
    },
  ];

  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`[WebSearch] DuckDuckGo returned status ${response.status}`);
      return `Search temporarily unavailable (status ${response.status}). Try again in a moment.`;
    }

    const html = await response.text();

    // Try each parsing strategy until one works
    let results: { title: string; snippet: string; url: string }[] = [];
    for (const strategy of parseStrategies) {
      results = strategy(html);
      if (results.length > 0) break;
    }

    if (results.length === 0) {
      // Log for debugging - HTML structure may have changed
      console.error("[WebSearch] All parsing strategies failed. HTML structure may have changed.");
      console.error("[WebSearch] HTML sample:", html.substring(0, 500));
      return `Search completed but couldn't parse results. The search service format may have changed.`;
    }

    let response_text = `Web search results for "${query}":\n\n`;
    for (const result of results) {
      response_text += `**${result.title}**\n${result.snippet}\n\n`;
    }
    return response_text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[WebSearch] Error:", message);

    if (message.includes("timeout") || message.includes("abort")) {
      return "Search timed out. The search service may be slow - try again.";
    }
    if (message.includes("fetch")) {
      return "Could not connect to search service. Check your internet connection.";
    }
    return `Search failed: ${message}`;
  }
}

// Letterboxd rating scraper with multiple parsing strategies
async function getLetterboxdRating(title: string, year?: string): Promise<{ rating: string; url: string } | null> {
  // Generate slug with better handling of special characters
  const generateSlug = (t: string): string => {
    return t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/['']/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-"); // Collapse multiple dashes
  };

  const slug = generateSlug(title);

  // Try multiple URL patterns
  const urls = [
    year ? `https://letterboxd.com/film/${slug}-${year}/` : null,
    `https://letterboxd.com/film/${slug}/`,
    // Try without "the" prefix
    slug.startsWith("the-") ? `https://letterboxd.com/film/${slug.slice(4)}/` : null,
  ].filter(Boolean) as string[];

  // Multiple strategies for finding the rating
  const ratingPatterns = [
    /itemprop="ratingValue"[^>]*>([0-9.]+)</i,
    /content="([0-9.]+)"[^>]*itemprop="ratingValue"/i,
    /"ratingValue":\s*"?([0-9.]+)"?/i,
    /class="average-rating"[^>]*>([0-9.]+)/i,
    /data-average-rating="([0-9.]+)"/i,
    /"aggregateRating"[^}]*"ratingValue":\s*"?([0-9.]+)"?/i,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(8000), // 8 second timeout
      });

      if (!response.ok) {
        if (response.status === 404) continue; // Try next URL
        console.error(`[Letterboxd] Status ${response.status} for ${url}`);
        continue;
      }

      const html = await response.text();

      // Try each rating pattern
      for (const pattern of ratingPatterns) {
        const match = html.match(pattern);
        if (match) {
          const rating = parseFloat(match[1]);
          if (rating > 0 && rating <= 5) {
            return { rating: `${rating.toFixed(1)}/5`, url };
          }
        }
      }

      // If we got HTML but no rating, the movie exists but might not have enough ratings
      if (html.includes('class="film-poster"') || html.includes('data-film-slug')) {
        if (process.env.NODE_ENV === "development") {
          console.log(`[Letterboxd] Found film "${title}" but no rating available yet`);
        }
        return null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("timeout")) {
        console.error(`[Letterboxd] Timeout fetching ${url}`);
      } else {
        console.error(`[Letterboxd] Error fetching ${url}:`, message);
      }
      // Continue to next URL
    }
  }

  return null;
}

// OMDB API for movie details (optional - requires free API key)
let omdbApiKey: string | null = null;

export function setOmdbApiKey(key: string | null) {
  omdbApiKey = key;
}

// Get IMDb rating from OMDB
async function getImdbRating(title: string, year?: string): Promise<{ rating: string; votes: string } | null> {
  if (!omdbApiKey) return null;

  try {
    const params = new URLSearchParams({
      apikey: omdbApiKey,
      t: title,
      type: "movie",
    });
    if (year) params.set("y", year);

    const response = await fetch(`https://www.omdbapi.com/?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.Response === "False" || !data.imdbRating || data.imdbRating === "N/A") {
      return null;
    }

    return {
      rating: `${data.imdbRating}/10`,
      votes: data.imdbVotes || "",
    };
  } catch {
    return null;
  }
}

async function lookupMovieExternal(title: string, year?: string): Promise<string> {
  // Always try to get Letterboxd rating
  const letterboxdPromise = getLetterboxdRating(title, year);

  if (!omdbApiKey) {
    // If no OMDB key, just get Letterboxd + web search
    const letterboxd = await letterboxdPromise;
    let result = "";
    if (letterboxd) {
      result += `**Letterboxd:** ${letterboxd.rating}\n\n`;
    }
    const webResults = await webSearch(`${title} ${year || ""} movie review rating`);
    return result + webResults;
  }

  try {
    const params = new URLSearchParams({
      apikey: omdbApiKey,
      t: title,
      type: "movie",
    });
    if (year) params.set("y", year);

    const [omdbResponse, letterboxd] = await Promise.all([
      fetch(`https://www.omdbapi.com/?${params}`),
      letterboxdPromise,
    ]);

    const data = await omdbResponse.json();

    if (data.Response === "False") {
      // Still show Letterboxd if we have it
      if (letterboxd) {
        return `**${title}** - Letterboxd: ${letterboxd.rating}\n\nCouldn't find other external info.`;
      }
      return `Could not find external info for "${title}".`;
    }

    let result = `**${data.Title}** (${data.Year})\n\n`;
    if (data.Rated) result += `Rated: ${data.Rated}\n`;
    if (data.Runtime) result += `Runtime: ${data.Runtime}\n`;
    if (data.Genre) result += `Genre: ${data.Genre}\n`;
    if (data.Director) result += `Director: ${data.Director}\n`;
    if (data.Actors) result += `Cast: ${data.Actors}\n`;
    result += `\n`;
    if (data.Plot) result += `**Plot:** ${data.Plot}\n\n`;

    result += `**Ratings:**\n`;
    if (data.Ratings && data.Ratings.length > 0) {
      for (const rating of data.Ratings) {
        result += `- ${rating.Source}: ${rating.Value}\n`;
      }
    }
    // Add Letterboxd rating
    if (letterboxd) {
      result += `- Letterboxd: ${letterboxd.rating}\n`;
    }

    if (data.Awards && data.Awards !== "N/A") {
      result += `\n**Awards:** ${data.Awards}\n`;
    }
    if (data.BoxOffice && data.BoxOffice !== "N/A") {
      result += `**Box Office:** ${data.BoxOffice}\n`;
    }

    return result;
  } catch (error) {
    console.error("OMDB lookup error:", error);
    const letterboxd = await letterboxdPromise;
    let result = "";
    if (letterboxd) {
      result += `**Letterboxd:** ${letterboxd.rating}\n\n`;
    }
    return result + await webSearch(`${title} ${year || ""} movie information`);
  }
}

// Default client using env var
let anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getAnthropicClient(customKey?: string): Anthropic {
  if (customKey) {
    return new Anthropic({ apiKey: customKey });
  }
  return anthropic;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Tools for Claude to search the library
const tools: Anthropic.Tool[] = [
  {
    name: "search_by_person",
    description: "Search for movies and TV shows by actor or director name. Use this when the user asks about films with a specific actor, movies directed by someone, or what content features a particular person.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The name of the actor or director to search for"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "search_library",
    description: "Search for movies or TV shows by title or keyword. Use this to find specific content or check if something exists in the library.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The title or keyword to search for"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_recommendations",
    description: "Get MOVIE recommendations from the user's library. Use ONLY for movie recommendations. Returns random unwatched movies, optionally filtered by genre. Do NOT use this for TV shows or binge requests.",
    input_schema: {
      type: "object" as const,
      properties: {
        genre: {
          type: "string",
          description: "Optional genre to filter by (e.g., 'Comedy', 'Action', 'Drama', 'Horror', 'Sci-Fi', 'Thriller')"
        },
        count: {
          type: "number",
          description: "Number of recommendations to return (default 5)"
        }
      },
      required: []
    }
  },
  {
    name: "get_tv_recommendations",
    description: "Get TV SHOW recommendations for binge-watching. Use this when the user asks for something to 'binge', 'binge-watch', wants a 'series', 'TV show', or asks 'what show should I start'. Returns TV shows from the library.",
    input_schema: {
      type: "object" as const,
      properties: {
        genre: {
          type: "string",
          description: "Optional genre to filter by (e.g., 'Comedy', 'Drama', 'Crime', 'Sci-Fi', 'Thriller')"
        },
        count: {
          type: "number",
          description: "Number of recommendations to return (default 5)"
        }
      },
      required: []
    }
  },
  {
    name: "search_by_genre",
    description: "Search for movies or TV shows by genre. Use this when the user asks about a specific genre like 'show me comedies' or 'what horror movies do I have'.",
    input_schema: {
      type: "object" as const,
      properties: {
        genre: {
          type: "string",
          description: "The genre to search for (e.g., 'Comedy', 'Action', 'Drama', 'Horror', 'Science Fiction', 'Thriller', 'Romance')"
        },
        type: {
          type: "string",
          description: "Type of content: 'movie' or 'show' (default: 'movie')"
        }
      },
      required: ["genre"]
    }
  },
  {
    name: "get_watch_history",
    description: "Get the user's watch history - movies and shows they've recently watched. Use this when the user asks 'what did I watch', 'my watch history', 'what have I seen recently', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of items to return (default 20)"
        }
      },
      required: []
    }
  },
  {
    name: "get_watch_stats",
    description: "Get viewing statistics and insights - total watched, most watched genres, favorite directors, etc. Use this when the user asks about their viewing habits, stats, most-watched, favorite genres, etc.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "get_watchlist",
    description: "Get the user's watchlist - unwatched movies they've recently added. Use when asking about their watchlist or what they plan to watch.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "get_similar_movies",
    description: "Find movies similar to a given movie. Use when the user asks for movies like X, similar to X, or 'more like' a specific movie. CRITICAL: You MUST recommend films by DIFFERENT DIRECTORS - never recommend multiple films by the same director. If asked for movies like a Nolan film, recommend films by Villeneuve, Fincher, Mann, etc. - NOT other Nolan films.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The movie title to find similar movies for"
        },
        count: {
          type: "number",
          description: "Number of similar movies to return (default 5)"
        }
      },
      required: ["title"]
    }
  },
  {
    name: "get_collections",
    description: "List all collections in the user's library. Use when the user asks about their collections, curated lists, or organized groups of movies.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: []
    }
  },
  {
    name: "get_collection_items",
    description: "Get all movies/shows in a specific collection. Use when the user asks what's in a collection or wants to browse a specific collection.",
    input_schema: {
      type: "object" as const,
      properties: {
        collection: {
          type: "string",
          description: "The name of the collection to browse"
        }
      },
      required: ["collection"]
    }
  },
  {
    name: "get_media_details",
    description: "Get detailed information about a specific movie or TV show including full cast, directors, writers, ratings, summary, and more. Use this when the user asks to 'tell me more about', 'what is X about', 'who stars in', 'details about', or wants in-depth info about a specific title.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The title of the movie or show to get details for"
        }
      },
      required: ["title"]
    }
  },
  {
    name: "random_movie_picker",
    description: "Pick a random movie from the library. Use this when the user wants a random pick, says 'spin the wheel', 'surprise me', 'random movie', 'pick for me', 'dealer's choice', or wants fate to decide. Can optionally filter by genre or only unwatched movies.",
    input_schema: {
      type: "object" as const,
      properties: {
        genre: {
          type: "string",
          description: "Optional genre filter (e.g., 'Action', 'Comedy', 'Horror')"
        },
        unwatched_only: {
          type: "boolean",
          description: "If true, only pick from unwatched movies (default: true)"
        }
      },
      required: []
    }
  },
  {
    name: "web_search",
    description: "Search the internet for information. Use this to find movie reviews, actor info, film news, release dates, or any information not in the Plex library. Good for questions about movies the user doesn't have, upcoming releases, industry news, or general entertainment questions.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "lookup_movie_external",
    description: "Look up detailed external information about a movie including IMDB, Rotten Tomatoes, and Letterboxd ratings, plus box office, awards, and full plot. Use when the user asks about a movie they might not have, wants external ratings (including Letterboxd scores), or asks 'is X any good?', 'should I watch X?', 'what's the Letterboxd rating?', or wants more info about a movie not in their library.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The movie title to look up"
        },
        year: {
          type: "string",
          description: "Optional release year to help find the correct movie"
        }
      },
      required: ["title"]
    }
  }
];

// Process tool calls
async function processToolCall(toolName: string, toolInput: Record<string, string | number>): Promise<string> {
  if (toolName === "search_by_person") {
    const results = await searchByPerson(toolInput.name as string);
    if (results.movies.length === 0 && results.shows.length === 0) {
      return `No movies or shows found featuring "${toolInput.name}" in the library.`;
    }
    let response = "";
    if (results.movies.length > 0) {
      response += `Movies with ${toolInput.name} (${results.movies.length} found):\n`;
      for (const movie of results.movies.slice(0, 15)) {
        const directors = movie.directors?.length ? ` - Dir: ${movie.directors.join(", ")}` : "";
        response += `- **${movie.title}** (${movie.year || "?"})${directors}\n`;
      }
      if (results.movies.length > 15) {
        response += `... and ${results.movies.length - 15} more movies\n`;
      }
    }
    if (results.shows.length > 0) {
      response += `\nTV Shows with ${toolInput.name} (${results.shows.length} found):\n`;
      for (const show of results.shows.slice(0, 10)) {
        response += `- **${show.title}** (${show.year || "?"}) - ${show.leafCount || "?"} episodes\n`;
      }
    }
    return response;
  } else if (toolName === "search_library") {
    const results = await searchLibrary(toolInput.query as string);
    if (results.length === 0) {
      return `No results found for "${toolInput.query}" in the library.`;
    }
    let response = `Search results for "${toolInput.query}" (${results.length} found):\n`;
    for (const item of results.slice(0, 15)) {
      const type = item.type === "movie" ? "Movie" : item.type === "show" ? "TV Show" : item.type;
      const directors = item.directors?.length ? ` - Dir: ${item.directors.join(", ")}` : "";
      response += `- [${type}] **${item.title}** (${item.year || "?"})${directors}\n`;
    }
    return response;
  } else if (toolName === "get_recommendations") {
    const count = (toolInput.count as number) || 5;
    const genre = toolInput.genre as string;
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
      const summary = movie.summary ? ` - ${movie.summary.slice(0, 100)}...` : "";
      response += `- **${movie.title}** (${movie.year || "?"})${genres ? ` [${genres}]` : ""}${summary}\n`;
    }
    return response;
  } else if (toolName === "get_tv_recommendations") {
    const count = (toolInput.count as number) || 5;
    const genre = toolInput.genre as string;
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
  } else if (toolName === "search_by_genre") {
    const type = (toolInput.type as "movie" | "show") || "movie";
    const results = await searchByGenre(toolInput.genre as string, type);
    if (results.length === 0) {
      return `No ${type}s found in the ${toolInput.genre} genre.`;
    }
    const shuffled = shuffle(results).slice(0, 12);
    let response = `Found ${results.length} ${type}s in ${toolInput.genre}. Here are some:\n`;
    for (const item of shuffled) {
      const watched = item.viewCount ? " [WATCHED]" : "";
      response += `- **${item.title}** (${item.year || "?"})${watched}\n`;
    }
    return response;
  } else if (toolName === "get_watch_history") {
    const limit = (toolInput.limit as number) || 20;
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
  } else if (toolName === "get_watch_stats") {
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
  } else if (toolName === "get_watchlist") {
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
  } else if (toolName === "get_similar_movies") {
    const count = (toolInput.count as number) || 5;
    const similar = await getSimilarMovies(toolInput.title as string, count);
    if (similar.length === 0) {
      return `Couldn't find movies similar to "${toolInput.title}" - the movie may not be in the library.`;
    }
    let response = `Movies similar to "${toolInput.title}":\n`;
    for (const movie of similar) {
      const genres = movie.genres?.slice(0, 2).join(", ") || "";
      response += `- **${movie.title}** (${movie.year || "?"})${genres ? ` [${genres}]` : ""}\n`;
    }
    return response;
  } else if (toolName === "get_collections") {
    const collections = await getCollections();
    if (collections.length === 0) {
      return "No collections found in your library.";
    }
    let response = `Your collections (${collections.length} total):\n`;
    for (const col of collections) {
      response += `- **${col.title}** (${col.count} items)\n`;
    }
    return response;
  } else if (toolName === "get_collection_items") {
    const items = await getCollectionItems(toolInput.collection as string);
    if (items.length === 0) {
      return `Collection "${toolInput.collection}" not found or is empty.`;
    }
    let response = `"${toolInput.collection}" collection (${items.length} items):\n`;
    for (const item of items) {
      response += `- **${item.title}** (${item.year || "?"})\n`;
    }
    return response;
  } else if (toolName === "random_movie_picker") {
    const unwatchedOnly = toolInput.unwatched_only === undefined ? true : Boolean(toolInput.unwatched_only);
    const genre = toolInput.genre as string | undefined;
    const movie = await pickRandomMovie(unwatchedOnly, genre);

    if (!movie) {
      return genre
        ? `No ${unwatchedOnly ? "unwatched " : ""}${genre} movies found in the library.`
        : `No ${unwatchedOnly ? "unwatched " : ""}movies found in the library.`;
    }

    let response = `🎰 **The wheel has spoken!**\n\n`;
    response += `🎬 **${movie.title}** (${movie.year || "?"})\n\n`;

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
  } else if (toolName === "get_media_details") {
    const details = await getMediaDetails(toolInput.title as string);
    if (!details) {
      return `Could not find "${toolInput.title}" in the library.`;
    }

    // Fetch external ratings in parallel (only for movies)
    const isMovie = details.type === "movie";
    const [letterboxd, imdb] = await Promise.all([
      isMovie ? getLetterboxdRating(details.title, details.year?.toString()) : null,
      isMovie ? getImdbRating(details.title, details.year?.toString()) : null,
    ]);

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
  } else if (toolName === "web_search") {
    return await webSearch(toolInput.query as string);
  } else if (toolName === "lookup_movie_external") {
    return await lookupMovieExternal(
      toolInput.title as string,
      toolInput.year as string | undefined
    );
  }
  return "Unknown tool";
}

export async function POST(request: NextRequest) {
  // CSRF protection
  if (!verifyCsrf(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
             request.headers.get("x-real-ip") ||
             "unknown";
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait before trying again.", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    const { messages, plexUrl, plexToken, anthropicKey, omdbKey } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Messages are required" }, { status: 400 });
    }

    // Set custom Plex credentials if provided
    if (plexUrl || plexToken) {
      setCustomCredentials(plexUrl, plexToken);
    }

    // Set OMDB API key if provided
    setOmdbApiKey(omdbKey || process.env.OMDB_API_KEY || null);

    // Get Anthropic client (custom or default)
    const client = getAnthropicClient(anthropicKey);

    // Get Plex library context
    let libraryContext: string;
    try {
      libraryContext = await getLibraryContext();
    } catch (error) {
      console.error("Failed to fetch Plex library:", error);
      return Response.json(
        { error: "Failed to connect to Plex server. Check your PLEX_URL and PLEX_TOKEN." },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a Plex library assistant helping users discover what to watch.

⚠️ CRITICAL RULE: For "similar to X" requests, EVERY film must be by a DIFFERENT director. Never recommend multiple films by the same director.

Library summary:

${libraryContext}

IMPORTANT - Always use tools to get accurate information:
- Use get_recommendations when the user asks "what should I watch", wants suggestions, or asks for recommendations (for MOVIES only)
- Use get_tv_recommendations when the user wants TV shows or something to binge
- Use search_by_genre when asking about specific genres like "comedies", "horror movies", "sci-fi" - set type to "show" for TV shows
- Use search_by_person when asking about actors or directors
- Use search_library to find specific titles
- Use get_media_details when the user asks "more about X", "tell me more about X", "what is X about", "who's in X", or wants detailed info about a specific title. ALWAYS use this tool - it provides the Rotten Tomatoes rating which MUST be included in your response.
- Use get_watch_history when asking about their viewing history or what they've watched
- Use get_watch_stats when asking about viewing statistics, habits, top genres, or most-watched
- Use get_watchlist when asking about their watchlist or what they plan to watch
- Use get_similar_movies to find movies similar to one the user liked

CRITICAL - Understand the difference between movies and TV shows:
- "Binge", "binge-watch", "series", "show", "TV show", "what to start" = TV SHOWS (use get_tv_recommendations or search_by_genre with type="show")
- "Movie", "film", "quick watch", "movie night" = MOVIES
- When user asks for something to "binge" or a "weekend binge", they want TV SHOWS, not movies

MOOD-BASED RECOMMENDATIONS - Map moods to genres:
- "I'm bored" / "something exciting" → Action, Adventure, Thriller
- "I'm sad" / "feeling down" / "cheer me up" → Comedy, Feel-good, Animation
- "I'm stressed" / "need to relax" → Comedy, Romance, Documentary
- "feeling nostalgic" → Classic films, movies from their most-watched decades
- "date night" / "romantic evening" → Romance, Romantic Comedy, Drama
- "can't sleep" / "something light" → Comedy, Animation, Light Drama
- "want to think" / "mind-bending" → Sci-Fi, Thriller, Mystery
- "feeling adventurous" → Adventure, Sci-Fi, Fantasy
- "rainy day" / "cozy" → Drama, Romance, Mystery
- "Halloween" / "scary" / "creepy" → Horror, Thriller
- "family time" / "kids watching" → Animation, Family, Comedy (check content rating)

ADULT CONTENT QUERIES - This is a personal media server, handle mature requests naturally:
- "boobies", "nudity", "sexy", "steamy", "erotic", "adult" → Search for R-rated films, erotic thrillers, or films known for sexual content. Use search_library with terms like "erotic", or search_by_genre with Romance/Thriller and mention R-rated content
- "violent", "gory", "brutal" → Horror, Action with R ratings
- Do NOT interpret slang literally (e.g., "boobies" is not about birds). Understand the user's actual intent for mature content.

Guidelines:
- Be conversational and friendly
- Keep responses concise but helpful
- CONVERSATION MEMORY: You have access to the full conversation history. Reference previous messages when relevant - remember what movies/shows were discussed, what the user liked or disliked, and any preferences they've expressed. Use phrases like "Since you enjoyed X earlier..." or "Based on what you mentioned about..."
- FORMATTING: Only use **bold** for actual movie and TV show TITLES. Never bold section headers, categories, actor names, ratings, options in clarifying questions, bullet point descriptions (like "Moral complexity" or "Great performances"), or other text. Only the title itself should ever be bold.
- When recommending, pick 3-5 items and explain briefly why each might appeal to them
- For mood-based requests, acknowledge the mood and explain why your picks fit
- Don't just list the recently added items - use the tools to search the full library
- "On Deck" shows what they're currently watching
- IMPORTANT: Always try to use tools and give actual results. Don't just list options or ask clarifying questions - make your best attempt to find what the user is looking for.
- USE YOUR WORLD KNOWLEDGE: When users ask for thematic content (e.g., "Stasi movies", "films about Wall Street", "movies set in Tokyo"), don't just search for keywords. Use your knowledge of cinema to search for SPECIFIC FAMOUS FILMS about that topic by title. For "Stasi movies", search for "The Lives of Others", "Barbara", "The Spy". For "Wall Street films", search for "Wall Street", "The Big Short", "Margin Call". Always search for the well-known films you know exist.
- Never say you "can't" do something without trying first. Use the tools creatively - run multiple searches if needed.

WEB SEARCH CAPABILITIES:
- Use web_search to find information not in the library - reviews, news, actor info, upcoming movies, release dates
- Use lookup_movie_external to get IMDB, Rotten Tomatoes, AND Letterboxd ratings, plus box office data and awards
- If user asks "is X good?", "should I watch X?", "Letterboxd score", or wants info about a movie not in their library, use lookup_movie_external
- You can now answer general entertainment questions, find reviews, and research movies before recommending them

SIMILAR MOVIES: Each recommendation must be by a DIFFERENT director. Check before responding.

CONVERSATION CONTEXT:
- Track what the user has asked about in this conversation - movies mentioned, genres explored, actors discussed
- If user says "something else" or "another one", provide different options from what you've already suggested
- If user expresses preferences ("I loved that", "not a fan of horror", "too long"), remember and apply them to future recommendations
- When user refers to "it" or "that movie", understand they mean the most recently discussed title
- Build on the conversation - don't treat each message as isolated`;

    // Build messages for API
    const apiMessages: Anthropic.MessageParam[] = messages.map((m: Message) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const encoder = new TextEncoder();

    // Create a streaming response that handles both status updates and final text
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Initial API call
          let response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: systemPrompt,
            tools: tools,
            messages: apiMessages,
          });

          // Handle tool use loop with status updates
          while (response.stop_reason === "tool_use") {
            const toolUseBlocks = response.content.filter(
              (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
            );

            if (toolUseBlocks.length === 0) break;

            // Show loading dots (no text)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "" })}\n\n`));

            // Process all tool calls
            const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
              toolUseBlocks.map(async (toolUseBlock) => {
                const toolResult = await processToolCall(
                  toolUseBlock.name,
                  toolUseBlock.input as Record<string, string | number>
                );
                return {
                  type: "tool_result" as const,
                  tool_use_id: toolUseBlock.id,
                  content: toolResult,
                };
              })
            );

            apiMessages.push({
              role: "assistant",
              content: response.content,
            });
            apiMessages.push({
              role: "user",
              content: toolResults,
            });

            // Keep loading indicator without text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "" })}\n\n`));

            response = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1024,
              system: systemPrompt,
              tools: tools,
              messages: apiMessages,
            });
          }

          // Clear status before streaming text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: null })}\n\n`));

          // Extract the final text response
          const textBlock = response.content.find(
            (block): block is Anthropic.TextBlock => block.type === "text"
          );
          const finalText = textBlock?.text || "I couldn't generate a response.";

          // Stream word by word with small delays for natural feel
          const words = finalText.split(/(\s+)/);
          for (const word of words) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word })}\n\n`));
            await new Promise(resolve => setTimeout(resolve, 8));
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Failed to generate response", details: errorMessage },
      { status: 500 }
    );
  }
}
