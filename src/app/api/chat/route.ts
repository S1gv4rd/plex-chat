import Anthropic from "@anthropic-ai/sdk";
import { getLibraryContext, searchByPerson, searchLibrary, getUnwatchedMovies, getUnwatchedShows, searchByGenre, getWatchHistory, getWatchStats, getWatchlist, getSimilarMovies, getCollections, getCollectionItems } from "@/lib/plex";
import { NextRequest } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    description: "Find movies similar to a given movie. Use when the user asks for movies like X, similar to X, or 'more like' a specific movie.",
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
    const shuffled = results.sort(() => Math.random() - 0.5).slice(0, 12);
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
  }
  return "Unknown tool";
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: "Messages are required" }, { status: 400 });
    }

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

    const systemPrompt = `You are a helpful assistant that knows everything about the user's Plex media library. You help them discover what to watch, find movies or shows they might enjoy based on their collection, identify gaps in their library, and answer questions about their media.

Here is a summary of their Plex library:

${libraryContext}

IMPORTANT - Always use tools to get accurate information:
- Use get_recommendations when the user asks "what should I watch", wants suggestions, or asks for recommendations (for MOVIES only)
- Use search_by_genre when asking about specific genres like "comedies", "horror movies", "sci-fi" - set type to "show" for TV shows
- Use search_by_person when asking about actors or directors
- Use search_library to find specific titles
- Use get_watch_history when asking about their viewing history or what they've watched
- Use get_watch_stats when asking about viewing statistics, habits, top genres, or most-watched
- Use get_watchlist when asking about their watchlist or what they plan to watch

CRITICAL - Understand the difference between movies and TV shows:
- "Binge", "binge-watch", "series", "show", "TV show", "what to start" = TV SHOWS (use search_by_genre with type="show")
- "Movie", "film", "quick watch", "movie night" = MOVIES
- When user asks for something to "binge" or a "weekend binge", they want TV SHOWS, not movies

Guidelines:
- Be conversational and friendly
- Keep responses concise but helpful
- When recommending, pick 3-5 items and explain briefly why each might appeal to them
- Don't just list the recently added items - use the tools to search the full library
- "On Deck" shows what they're currently watching`;

    // Build messages for API
    const apiMessages: Anthropic.MessageParam[] = messages.map((m: Message) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Handle tool use first (non-streaming)
    let response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools,
      messages: apiMessages,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (!toolUseBlock) break;

      const toolResult = await processToolCall(
        toolUseBlock.name,
        toolUseBlock.input as Record<string, string | number>
      );

      apiMessages.push({
        role: "assistant",
        content: response.content,
      });
      apiMessages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseBlock.id,
            content: toolResult,
          },
        ],
      });

      response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        tools: tools,
        messages: apiMessages,
      });
    }

    // Extract the final text response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    const finalText = textBlock?.text || "I couldn't generate a response.";

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send text in chunks for streaming effect
        const chunkSize = 15;
        for (let i = 0; i < finalText.length; i += chunkSize) {
          const chunk = finalText.slice(i, i + chunkSize);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
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
