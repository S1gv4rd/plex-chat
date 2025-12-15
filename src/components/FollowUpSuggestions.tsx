"use client";

import { memo, useMemo } from "react";

interface FollowUpSuggestionsProps {
  lastMessage: string;
  onSelect: (question: string) => void;
}

type ResponseType =
  | "detail"      // Detailed info about one movie/show
  | "list"        // List of recommendations
  | "similar"     // Similar movies list
  | "random"      // Random wheel pick
  | "stats"       // Watch history/stats
  | "search"      // Search results
  | "question"    // Clarifying question (no suggestions)
  | "general";    // General response

function detectResponseType(message: string): ResponseType {
  const lower = message.toLowerCase();

  // Random wheel pick
  if (lower.includes("wheel has spoken") || lower.includes("your destiny")) {
    return "random";
  }

  // Clarifying question - don't show suggestions
  if (lower.includes("what kind of mood") ||
      lower.includes("are you looking for") ||
      lower.includes("let me know what") ||
      lower.includes("which would you prefer") ||
      (lower.includes("?") && lower.split("?").length > 3)) {
    return "question";
  }

  // Watch stats/history
  if (lower.includes("viewing stats") ||
      lower.includes("watch history") ||
      lower.includes("total movies watched") ||
      lower.includes("top genres")) {
    return "stats";
  }

  // Similar movies
  if (lower.includes("similar to") ||
      lower.includes("films like") ||
      lower.includes("movies like") ||
      lower.includes("if you enjoyed") ||
      lower.includes("if you loved") ||
      (lower.includes("let me suggest") && lower.includes("library"))) {
    return "similar";
  }

  // Detailed view (single movie info)
  if ((lower.includes("rotten tomatoes") && /\d+%/.test(message)) ||
      lower.includes("synopsis") ||
      (lower.includes("cast:") || lower.includes("**cast**")) ||
      (lower.includes("director") && lower.includes("writer"))) {
    return "detail";
  }

  // Search results
  if (lower.includes("search results") || lower.includes("found in your library")) {
    return "search";
  }

  // List of recommendations (multiple items)
  const bulletCount = (message.match(/^- \*\*/gm) || []).length;
  if (bulletCount >= 3) {
    return "list";
  }

  return "general";
}

function getSuggestionsForType(type: ResponseType, message: string): string[] {
  const lower = message.toLowerCase();
  const hasMovies = lower.includes("movie") || lower.includes("film");
  const hasShows = lower.includes("show") || lower.includes("series") || lower.includes("tv");

  const contentSwitch = hasMovies && !hasShows
    ? "Show me TV shows instead"
    : hasShows && !hasMovies
    ? "What about movies?"
    : null;

  switch (type) {
    case "random":
      return ["Spin again", "Tell me more", "Something different"];

    case "detail":
      return [
        "Find similar",
        contentSwitch || "Something different",
        "Spin the wheel"
      ].filter(Boolean) as string[];

    case "similar":
      return [
        "Something different",
        contentSwitch || "Spin the wheel",
        "Browse collections"
      ].filter(Boolean) as string[];

    case "list":
      return [
        "Something different",
        contentSwitch || "Spin the wheel",
        "Browse collections"
      ].filter(Boolean) as string[];

    case "stats":
      return ["Recommend a movie", "What should I binge?", "Spin the wheel"];

    case "search":
      return ["Something different", "Spin the wheel", "Browse collections"];

    case "question":
      return []; // Let user answer the question

    case "general":
    default:
      return ["Recommend a movie", "What should I binge?", "Spin the wheel"];
  }
}

const FollowUpSuggestions = memo(function FollowUpSuggestions({
  lastMessage,
  onSelect,
}: FollowUpSuggestionsProps) {
  const suggestions = useMemo(() => {
    const type = detectResponseType(lastMessage);
    return getSuggestionsForType(type, lastMessage);
  }, [lastMessage]);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 mb-3 justify-start">
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="text-xs px-3 py-1.5 rounded-full transition-all bg-white/5 border border-white/10 hover:border-plex-orange/30 hover:bg-plex-orange/5 text-foreground/60 hover:text-foreground"
        >
          {s}
        </button>
      ))}
    </div>
  );
});

export default FollowUpSuggestions;
