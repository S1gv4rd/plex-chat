import Anthropic from "@anthropic-ai/sdk";
import { getLibraryContext, searchByPerson, searchLibrary } from "@/lib/plex";
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

Here is the current state of their Plex library:

${libraryContext}

Guidelines:
- Be conversational and friendly
- When recommending something to watch, explain why based on their existing collection and preferences
- If they ask about movies/shows they don't have, acknowledge it and suggest similar things they DO have
- You can suggest what's missing from their library if they ask
- Reference specific titles, years, and ratings from their library
- For TV shows, you know the number of seasons and episodes they have
- Items marked * have been watched
- "On Deck" shows what they're currently watching or should continue
- Keep responses concise but helpful
- IMPORTANT: When the user asks about specific actors, directors, or wants detailed cast/crew info, use the search_by_person tool to get accurate information
- Use the search_library tool to find specific titles or check if content exists`;

    // Build messages for API
    const apiMessages: Anthropic.MessageParam[] = messages.map((m: Message) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // First API call
    let response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20250514",
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
        model: "claude-haiku-4-5-20250514",
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
