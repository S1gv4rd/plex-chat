import Anthropic from "@anthropic-ai/sdk";

// Tools for Claude to search the library
export const tools: Anthropic.Tool[] = [
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
  },
  {
    name: "get_trailer",
    description: "Get a YouTube trailer link for a movie or TV show. Use when the user asks to see a trailer, wants to watch a preview, or says 'show me the trailer for X'.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "The movie or TV show title"
        },
        year: {
          type: "string",
          description: "Optional release year to help find the correct trailer"
        }
      },
      required: ["title"]
    }
  }
];
