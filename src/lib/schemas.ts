import { z } from "zod";

// Message schema
export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Message content cannot be empty"),
});

export type Message = z.infer<typeof MessageSchema>;

// Chat request schema
export const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1, "At least one message is required"),
  plexUrl: z.string().url("Invalid Plex URL").optional(),
  plexToken: z.string().min(1).optional(),
  geminiKey: z.string().min(1).optional(),
  omdbKey: z.string().min(1).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Library request schema
export const LibraryRequestSchema = z.object({
  plexUrl: z.string().url("Invalid Plex URL").optional(),
  plexToken: z.string().min(1).optional(),
});

export type LibraryRequest = z.infer<typeof LibraryRequestSchema>;

// Tool input schemas for runtime validation
export const SearchByPersonInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const SearchLibraryInputSchema = z.object({
  query: z.string().min(1, "Query is required"),
});

export const GetRecommendationsInputSchema = z.object({
  genre: z.string().optional(),
  count: z.number().int().positive().max(20).optional(),
});

export const GetTvRecommendationsInputSchema = z.object({
  genre: z.string().optional(),
  count: z.number().int().positive().max(20).optional(),
});

export const SearchByGenreInputSchema = z.object({
  genre: z.string().min(1, "Genre is required"),
  type: z.enum(["movie", "show"]).optional(),
});

export const GetWatchHistoryInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

export const GetSimilarMoviesInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  count: z.number().int().positive().max(20).optional(),
});

export const GetCollectionItemsInputSchema = z.object({
  collection: z.string().min(1, "Collection name is required"),
});

export const GetMediaDetailsInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

export const RandomMoviePickerInputSchema = z.object({
  genre: z.string().optional(),
  unwatched_only: z.boolean().optional(),
});

export const WebSearchInputSchema = z.object({
  query: z.string().min(1, "Search query is required"),
});

export const LookupMovieExternalInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  year: z.string().optional(),
});

export const GetTrailerInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  year: z.string().optional(),
});

// Map tool names to their schemas
export const toolInputSchemas: Record<string, z.ZodSchema> = {
  search_by_person: SearchByPersonInputSchema,
  search_library: SearchLibraryInputSchema,
  get_recommendations: GetRecommendationsInputSchema,
  get_tv_recommendations: GetTvRecommendationsInputSchema,
  search_by_genre: SearchByGenreInputSchema,
  get_watch_history: GetWatchHistoryInputSchema,
  get_watch_stats: z.object({}),
  get_watchlist: z.object({}),
  get_similar_movies: GetSimilarMoviesInputSchema,
  get_collections: z.object({}),
  get_collection_items: GetCollectionItemsInputSchema,
  get_media_details: GetMediaDetailsInputSchema,
  random_movie_picker: RandomMoviePickerInputSchema,
  web_search: WebSearchInputSchema,
  lookup_movie_external: LookupMovieExternalInputSchema,
  get_trailer: GetTrailerInputSchema,
};

// Inferred types for tool inputs
export type SearchByPersonInput = z.infer<typeof SearchByPersonInputSchema>;
export type SearchLibraryInput = z.infer<typeof SearchLibraryInputSchema>;
export type GetRecommendationsInput = z.infer<typeof GetRecommendationsInputSchema>;
export type GetTvRecommendationsInput = z.infer<typeof GetTvRecommendationsInputSchema>;
export type SearchByGenreInput = z.infer<typeof SearchByGenreInputSchema>;
export type GetWatchHistoryInput = z.infer<typeof GetWatchHistoryInputSchema>;
export type GetSimilarMoviesInput = z.infer<typeof GetSimilarMoviesInputSchema>;
export type GetCollectionItemsInput = z.infer<typeof GetCollectionItemsInputSchema>;
export type GetMediaDetailsInput = z.infer<typeof GetMediaDetailsInputSchema>;
export type RandomMoviePickerInput = z.infer<typeof RandomMoviePickerInputSchema>;
export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;
export type LookupMovieExternalInput = z.infer<typeof LookupMovieExternalInputSchema>;
export type GetTrailerInput = z.infer<typeof GetTrailerInputSchema>;

// Union type of all tool inputs
export type ToolInput =
  | SearchByPersonInput
  | SearchLibraryInput
  | GetRecommendationsInput
  | GetTvRecommendationsInput
  | SearchByGenreInput
  | GetWatchHistoryInput
  | GetSimilarMoviesInput
  | GetCollectionItemsInput
  | GetMediaDetailsInput
  | RandomMoviePickerInput
  | WebSearchInput
  | LookupMovieExternalInput
  | GetTrailerInput
  | Record<string, never>; // For tools with no input

// Validate tool input with typed result
export function validateToolInput(
  toolName: string,
  input: unknown
): { success: true; data: ToolInput } | { success: false; error: string } {
  const schema = toolInputSchemas[toolName];
  if (!schema) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  const result = schema.safeParse(input);
  if (!result.success) {
    // Zod v4 uses 'issues'
    const issues = result.error.issues || [];
    return { success: false, error: issues.map((e: { message: string }) => e.message).join(", ") };
  }

  return { success: true, data: result.data as ToolInput };
}
