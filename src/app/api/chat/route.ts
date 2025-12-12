import Anthropic from "@anthropic-ai/sdk";
import { getLibraryContext, searchByPerson, searchLibrary, getRandomMovies, getUnwatchedMovies, searchByGenre } from "@/lib/plex";
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
    description: "Get movie recommendations from the user's library. Use this when the user asks for something to watch, wants recommendations, or asks 'what should I watch'. Returns random unwatched movies, optionally filtered by genre.",
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
  }
];

// Process tool calls
async function processToolCall(toolName: string, toolInput: Record<string, string>): Promise<string> {
  if (toolName === "search_by_person") {
    const results = await searchByPerson(toolInput.name);
    if (results.movies.length === 0 && results.shows.length === 0) {
      return `No movies or shows found featuring "${toolInput.name}" in the library.`;
    }
    let response = "";
    if (results.movies.length > 0) {
      response += `Movies with ${toolInput.name} (${results.movies.length} found):\n`;
      for (const movie of results.movies.slice(0, 30)) {
        const directors = movie.directors?.length ? ` - Dir: ${movie.directors.join(", ")}` : "";
        const actors = movie.actors?.length ? ` - Cast: ${movie.actors.join(", ")}` : "";
        response += `- ${movie.title} (${movie.year || "?"})${directors}${actors}\n`;
      }
      if (results.movies.length > 30) {
        response += `... and ${results.movies.length - 30} more movies\n`;
      }
    }
    if (results.shows.length > 0) {
      response += `\nTV Shows with ${toolInput.name} (${results.shows.length} found):\n`;
      for (const show of results.shows.slice(0, 20)) {
        response += `- ${show.title} (${show.year || "?"}) - ${show.leafCount || "?"} episodes\n`;
      }
    }
    return response;
  } else if (toolName === "search_library") {
    const results = await searchLibrary(toolInput.query);
    if (results.length === 0) {
      return `No results found for "${toolInput.query}" in the library.`;
    }
    let response = `Search results for "${toolInput.query}" (${results.length} found):\n`;
    for (const item of results.slice(0, 20)) {
      const type = item.type === "movie" ? "Movie" : item.type === "show" ? "TV Show" : item.type;
      const directors = item.directors?.length ? ` - Dir: ${item.directors.join(", ")}` : "";
      const actors = item.actors?.length ? ` - Cast: ${item.actors.join(", ")}` : "";
      response += `- [${type}] ${item.title} (${item.year || "?"})${directors}${actors}\n`;
    }
    return response;
  } else if (toolName === "get_recommendations") {
    const count = parseInt(toolInput.count) || 5;
    const genre = toolInput.genre;
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
      const rating = movie.rating ? ` - Rating: ${movie.rating}/10` : "";
      const genres = movie.genres?.slice(0, 3).join(", ") || "";
      const summary = movie.summary ? ` - ${movie.summary.slice(0, 100)}...` : "";
      response += `- **${movie.title}** (${movie.year || "?"})${rating}${genres ? ` [${genres}]` : ""}${summary}\n`;
    }
    return response;
  } else if (toolName === "search_by_genre") {
    const type = (toolInput.type as "movie" | "show") || "movie";
    const results = await searchByGenre(toolInput.genre, type);
    if (results.length === 0) {
      return `No ${type}s found in the ${toolInput.genre} genre.`;
    }
    // Shuffle and pick random selection to avoid always showing same results
    const shuffled = results.sort(() => Math.random() - 0.5).slice(0, 15);
    let response = `Found ${results.length} ${type}s in ${toolInput.genre}. Here are some:\n`;
    for (const item of shuffled) {
      const rating = item.rating ? ` - Rating: ${item.rating}/10` : "";
      const watched = item.viewCount ? " [WATCHED]" : "";
      response += `- ${item.title} (${item.year || "?"})${rating}${watched}\n`;
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
- Use get_recommendations when the user asks "what should I watch", wants suggestions, or asks for recommendations
- Use search_by_genre when asking about specific genres like "comedies", "horror movies", "sci-fi"
- Use search_by_person when asking about actors or directors
- Use search_library to find specific titles

Guidelines:
- Be conversational and friendly
- Keep responses concise but helpful
- When recommending, pick 3-5 movies and explain briefly why each might appeal to them
- Don't just list the recently added items - use the tools to search the full library
- "On Deck" shows what they're currently watching`;

    // Build messages for API
    const apiMessages: Anthropic.MessageParam[] = messages.map((m: Message) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // First API call
    let response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools,
      messages: apiMessages,
    });

    // Handle tool use - loop until we get a final response
    while (response.stop_reason === "tool_use") {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (!toolUseBlock) break;

      const toolResult = await processToolCall(
        toolUseBlock.name,
        toolUseBlock.input as Record<string, string>
      );

      // Continue the conversation with tool result
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

    // Extract final text response
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const assistantMessage = textBlock?.text || "";

    return Response.json({ message: assistantMessage });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Failed to generate response", details: errorMessage },
      { status: 500 }
    );
  }
}
