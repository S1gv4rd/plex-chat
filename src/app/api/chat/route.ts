import Anthropic from "@anthropic-ai/sdk";
import { getLibraryContext, setCustomCredentials } from "@/lib/plex";
import { NextRequest } from "next/server";
import { ChatRequestSchema } from "@/lib/schemas";
import { tools } from "@/lib/tools";
import { processToolCall, setExternalConfig } from "@/lib/tool-processor";

// Simple in-memory rate limiter with lazy cleanup
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 10, // max requests per window
  cleanupThreshold: 100, // Clean up when map exceeds this size
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let lastCleanupTime = 0;

function cleanupExpiredEntries() {
  const now = Date.now();
  // Only cleanup if enough time has passed or map is too large
  if (now - lastCleanupTime < 30000 && rateLimitMap.size < RATE_LIMIT.cleanupThreshold) {
    return;
  }
  lastCleanupTime = now;
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Lazy cleanup on each request (efficient - only when needed)
  cleanupExpiredEntries();

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

// CSRF protection - verify origin matches host
function verifyCsrf(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // For same-origin requests, browsers may not send Origin header
  // In that case, check Referer as fallback
  const sourceUrl = origin || referer;

  // Reject requests with no origin indicators in production
  // This prevents CSRF from non-browser clients
  if (!sourceUrl) {
    // Allow in development for easier testing
    if (process.env.NODE_ENV === "development") return true;
    // In production, require origin or referer
    return false;
  }

  try {
    const sourceHost = new URL(sourceUrl).host;
    // Verify the request comes from the same host
    if (sourceHost !== host) {
      console.warn(`[CSRF] Blocked request from ${sourceHost} to ${host}`);
      return false;
    }
    return true;
  } catch {
    console.warn(`[CSRF] Invalid origin/referer: ${sourceUrl}`);
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
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[WebSearch] DuckDuckGo returned status ${response.status}`);
      return `Search temporarily unavailable (status ${response.status}). Try again in a moment.`;
    }

    const html = await response.text();

    let results: { title: string; snippet: string; url: string }[] = [];
    for (const strategy of parseStrategies) {
      results = strategy(html);
      if (results.length > 0) break;
    }

    if (results.length === 0) {
      console.error("[WebSearch] All parsing strategies failed. HTML structure may have changed.");
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

// Letterboxd rating scraper
async function getLetterboxdRating(title: string, year?: string): Promise<{ rating: string; url: string } | null> {
  const generateSlug = (t: string): string => {
    return t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['']/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  };

  const slug = generateSlug(title);

  const urls = [
    year ? `https://letterboxd.com/film/${slug}-${year}/` : null,
    `https://letterboxd.com/film/${slug}/`,
    slug.startsWith("the-") ? `https://letterboxd.com/film/${slug.slice(4)}/` : null,
  ].filter(Boolean) as string[];

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
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        if (response.status === 404) continue;
        continue;
      }

      const html = await response.text();

      for (const pattern of ratingPatterns) {
        const match = html.match(pattern);
        if (match) {
          const rating = parseFloat(match[1]);
          if (rating > 0 && rating <= 5) {
            return { rating: `${rating.toFixed(1)}/5`, url };
          }
        }
      }

      if (html.includes('class="film-poster"') || html.includes('data-film-slug')) {
        return null;
      }
    } catch {
      continue;
    }
  }

  return null;
}

// OMDB API key
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
  const letterboxdPromise = getLetterboxdRating(title, year);

  if (!omdbApiKey) {
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

// Default Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function getAnthropicClient(customKey?: string): Anthropic {
  if (customKey) {
    return new Anthropic({ apiKey: customKey });
  }
  return anthropic;
}

// Convert Anthropic tools to Gemini format
function convertToolsToGemini(anthropicTools: Anthropic.Tool[]) {
  return anthropicTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "OBJECT",
      properties: (tool.input_schema as { properties?: Record<string, unknown> }).properties || {},
      required: (tool.input_schema as { required?: string[] }).required || [],
    },
  }));
}

// Gemini API call with function calling
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  geminiTools: ReturnType<typeof convertToolsToGemini>
): Promise<{ text?: string; functionCalls?: { name: string; args: Record<string, unknown> }[] }> {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ functionDeclarations: geminiTools }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Gemini] API error:", error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const functionCalls: { name: string; args: Record<string, unknown> }[] = [];
  let text = "";

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  return { text: text || undefined, functionCalls: functionCalls.length > 0 ? functionCalls : undefined };
}

// Gemini API call with function results
async function callGeminiWithResults(
  apiKey: string,
  systemPrompt: string,
  contents: unknown[],
  geminiTools: ReturnType<typeof convertToolsToGemini>
): Promise<{ text?: string; functionCalls?: { name: string; args: Record<string, unknown> }[] }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: [{ functionDeclarations: geminiTools }],
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Gemini] API error:", error);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  const functionCalls: { name: string; args: Record<string, unknown> }[] = [];
  let text = "";

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  return { text: text || undefined, functionCalls: functionCalls.length > 0 ? functionCalls : undefined };
}

// System prompt for Claude
function getSystemPrompt(libraryContext: string): string {
  return `You are a Plex library assistant helping users discover what to watch from THEIR library.

CRITICAL RULES FOR ALL RECOMMENDATIONS:
1. ALWAYS use tools to find films - NEVER suggest films from your own knowledge without searching the library first
2. EVERY recommendation must be by a DIFFERENT director - never recommend multiple films from the same director
3. Check the director field in tool results before presenting recommendations

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

MOOD-BASED RECOMMENDATIONS - Map moods to genres and USE TOOLS:
- "I'm bored" / "something exciting" -> search_by_genre with Action, Adventure, or Thriller
- "I'm sad" / "feeling down" / "cheer me up" -> search_by_genre with Comedy
- "I'm stressed" / "need to relax" -> search_by_genre with Comedy or Romance
- "feeling nostalgic" -> get_watch_history to find patterns, then get_recommendations
- "date night" / "romantic evening" -> search_by_genre with Romance
- "can't sleep" / "something light" -> search_by_genre with Comedy
- "want to think" / "mind-bending" -> search_by_genre with Sci-Fi, Thriller, or Mystery
- "feeling adventurous" -> search_by_genre with Adventure or Sci-Fi
- "rainy day" / "cozy" -> search_by_genre with Drama or Romance
- "Halloween" / "scary" / "creepy" -> search_by_genre with Horror
- "family time" / "kids watching" -> search_by_genre with Animation or Family

Guidelines:
- Be conversational and friendly
- Keep responses concise but helpful
- CONVERSATION MEMORY: You have access to the full conversation history. Reference previous messages when relevant.
- FORMATTING: Only use **bold** for actual movie and TV show TITLES. Never bold section headers, categories, actor names, ratings, or other text.
- When recommending, pick 3-5 items from DIFFERENT DIRECTORS and explain briefly why each might appeal to them
- For mood-based requests, acknowledge the mood and explain why your picks fit
- Don't just list the recently added items - use the tools to search the full library
- IMPORTANT: Always use tools and give actual results from the library. Don't suggest films from memory.
- Never say you "can't" do something without trying first. Use the tools creatively.

WEB SEARCH CAPABILITIES:
- Use web_search to find information not in the library - reviews, news, actor info, upcoming movies
- Use lookup_movie_external to get IMDB, Rotten Tomatoes, AND Letterboxd ratings
- If user asks "is X good?", "should I watch X?", or wants info about a movie not in their library, use lookup_movie_external`;
}

export async function POST(request: NextRequest) {
  // CSRF protection
  if (!verifyCsrf(request)) {
    return Response.json(
      { error: "Invalid request origin", code: "CSRF_VALIDATION_FAILED" },
      { status: 403 }
    );
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
             request.headers.get("x-real-ip") ||
             "unknown";
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait before trying again.", code: "RATE_LIMIT_EXCEEDED", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = ChatRequestSchema.safeParse(body);

    if (!validation.success) {
      const issues = validation.error.issues || [];
      return Response.json(
        { error: "Invalid request", code: "VALIDATION_ERROR", details: issues.map((e: { message: string }) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { messages, plexUrl, plexToken, anthropicKey, geminiKey, omdbKey, model = "claude" } = validation.data;

    // Set custom Plex credentials if provided
    if (plexUrl || plexToken) {
      setCustomCredentials(plexUrl, plexToken);
    }

    // Set OMDB API key if provided
    setOmdbApiKey(omdbKey || process.env.OMDB_API_KEY || null);

    // Configure external lookup functions for tool processor
    setExternalConfig({
      omdbApiKey: omdbKey || process.env.OMDB_API_KEY || null,
      webSearch,
      getLetterboxdRating,
      getImdbRating,
      lookupMovieExternal,
    });

    // Get Plex library context
    let libraryContext: string;
    try {
      libraryContext = await getLibraryContext();
    } catch (error) {
      console.error("Failed to fetch Plex library:", error);
      return Response.json(
        { error: "Failed to connect to Plex server. Check your PLEX_URL and PLEX_TOKEN.", code: "PLEX_CONNECTION_FAILED" },
        { status: 502 }
      );
    }

    const systemPrompt = getSystemPrompt(libraryContext);
    const encoder = new TextEncoder();

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let finalText = "";

          if (model === "gemini") {
            // ===== GEMINI PATH =====
            const geminiApiKey = geminiKey || process.env.GEMINI_API_KEY;
            if (!geminiApiKey) {
              throw new Error("Gemini API key not configured");
            }

            const geminiTools = convertToolsToGemini(tools);

            // Build Gemini contents
            const geminiContents: unknown[] = messages.map(m => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            }));

            let response = await callGemini(geminiApiKey, systemPrompt, messages, geminiTools);

            // Handle function calling loop
            let maxIterations = 10;
            while (response.functionCalls && response.functionCalls.length > 0 && maxIterations > 0) {
              maxIterations--;

              // Show loading indicator
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "" })}\n\n`));

              // Process function calls
              const functionResponses: { name: string; response: { result: string } }[] = [];
              for (const fc of response.functionCalls) {
                const result = await processToolCall(fc.name, fc.args);
                functionResponses.push({
                  name: fc.name,
                  response: { result },
                });
              }

              // Add assistant response with function calls
              geminiContents.push({
                role: "model",
                parts: response.functionCalls.map(fc => ({
                  functionCall: { name: fc.name, args: fc.args },
                })),
              });

              // Add function results
              geminiContents.push({
                role: "user",
                parts: functionResponses.map(fr => ({
                  functionResponse: fr,
                })),
              });

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "" })}\n\n`));

              // Call again with results
              response = await callGeminiWithResults(geminiApiKey, systemPrompt, geminiContents, geminiTools);
            }

            finalText = response.text || "I couldn't generate a response.";
          } else {
            // ===== CLAUDE PATH =====
            const client = getAnthropicClient(anthropicKey);

            // Build messages for API
            const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
              role: m.role,
              content: m.content,
            }));

            // Initial API call
            let response = await client.messages.create({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1024,
              system: systemPrompt,
              tools: tools,
              messages: apiMessages,
            });

            // Handle tool use loop
            while (response.stop_reason === "tool_use") {
              const toolUseBlocks = response.content.filter(
                (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
              );

              if (toolUseBlocks.length === 0) break;

              // Show loading indicator
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "" })}\n\n`));

              // Process all tool calls with validation
              const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
                toolUseBlocks.map(async (toolUseBlock) => {
                  const toolResult = await processToolCall(
                    toolUseBlock.name,
                    toolUseBlock.input
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

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "" })}\n\n`));

              response = await client.messages.create({
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
            finalText = textBlock?.text || "I couldn't generate a response.";
          }

          // Clear status before streaming text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: null })}\n\n`));

          // Stream word by word
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
    const rawMessage = error instanceof Error ? error.message : "Unknown error";

    // Sanitize error message to remove potential API keys or sensitive data
    const sanitizeError = (msg: string): string => {
      // Remove anything that looks like an API key (long alphanumeric strings)
      let sanitized = msg.replace(/\b(sk-[a-zA-Z0-9-_]{20,})\b/g, "[API_KEY_REDACTED]");
      sanitized = sanitized.replace(/\b([a-zA-Z0-9]{32,})\b/g, "[KEY_REDACTED]");
      // Remove URL query parameters that might contain tokens
      sanitized = sanitized.replace(/[?&](token|key|apikey|api_key)=[^&\s]*/gi, "?[PARAM_REDACTED]");
      return sanitized;
    };

    const errorMessage = sanitizeError(rawMessage);

    // Determine error code based on error type
    let code = "INTERNAL_ERROR";
    if (rawMessage.includes("Anthropic") || rawMessage.includes("API")) {
      code = "ANTHROPIC_API_ERROR";
    }

    return Response.json(
      { error: "Failed to generate response", code, details: errorMessage },
      { status: 500 }
    );
  }
}
