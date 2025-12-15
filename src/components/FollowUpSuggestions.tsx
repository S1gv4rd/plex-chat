"use client";

import { memo, useMemo } from "react";

interface FollowUpSuggestionsProps {
  lastMessage: string;
  onSelect: (question: string) => void;
}

// Extract movie/show titles from the message (bold markdown format)
function extractTitles(content: string): string[] {
  const matches = content.match(/\*\*([^*]+)\*\*/g) || [];

  // Words/phrases that are headings or descriptions, not titles
  const excludePatterns = [
    /^tv shows?:?$/i,
    /^movies?:?$/i,
    /^cast:?$/i,
    /^synopsis:?$/i,
    /^directors?:?$/i,
    /^writers?:?$/i,
    /^rating:?$/i,
    /^genres?:?$/i,
    /^summary:?$/i,
    /^details:?$/i,
    /^studio:?$/i,
    /^search/i,
    /^browse/i,
    /^check/i,
    /^find/i,
    /^look/i,
    /^try/i,
    /^option/i,
    /^tip/i,
    /^note/i,
    /for specific/i,
    /by genre/i,
    /by director/i,
    /or franchise/i,
    /collections?$/i,
    /^top /i,
    /recommendations?:?$/i,
    /^here are/i,
    /^picks?:?$/i,
    /^suggestions?:?$/i,
    /wheel has spoken/i,
    /^the wheel/i,
    /must-watch/i,
    /mind-bender/i,
    /^great!/i,
    /^here's/i,
    /^your /i,
    /full picture/i,
    /full scoop/i,
    /^beyond /i,
    /^more /i,
    /^other /i,
    /^some /i,
    /sci-fi/i,
    /action-focused/i,
    /mind-bending/i,
    /puzzle-box/i,
    /thrillers?$/i,
    /films?$/i,
    /movies?$/i,
    /^the basics$/i,
    /^the story$/i,
    /^the plot$/i,
    /^the premise$/i,
    /^the cast$/i,
    /^the verdict$/i,
    /^the bottom line$/i,
    /^the runtime$/i,
    /^the good$/i,
    /^the bad$/i,
    /^the takeaway$/i,
    /^the setup$/i,
    /^the vibe$/i,
    /^best for$/i,
    /^why it's/i,
    /^why you/i,
    /^what makes/i,
    /rotten tomatoes/i,
    /^\d+%/,
    /^oscar/i,
    /^runtime/i,
    /^plot$/i,
    /^specific$/i,
  ];

  return matches
    .map(m => m
      .replace(/\*\*/g, "")
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "") // Remove emojis
      .split(" (")[0]
      .split(" — ")[0]  // Remove " — Complete Details:" etc.
      .split(":")[0]    // Remove trailing colons
      .trim()
    )
    .filter(t => {
      if (t.length === 0 || t.length > 40) return false;
      // Filter out section headings and action phrases
      if (excludePatterns.some(pattern => pattern.test(t))) return false;
      // Filter out if it contains common non-title words
      if (/^(how|what|where|when|why|which|the best|your|my|a |an )/i.test(t)) return false;
      return true;
    })
    .slice(0, 3);
}

function generateFollowUps(lastMessage: string): string[] {
  const titles = extractTitles(lastMessage);
  const lower = lastMessage.toLowerCase();
  const suggestions: string[] = [];

  // Detect if this is already a detailed response (has rating, runtime, cast, watch info, etc.)
  const hasRatingInfo = /\d+%/.test(lastMessage) && lower.includes("rotten tomatoes");
  const hasRuntimeInfo = /\d+h \d+m/.test(lastMessage) || (lower.includes("hour") && lower.includes("minute"));
  const hasCastInfo = lower.includes("cast:") || lower.includes("cast**") || lower.includes("full cast") || lower.includes("performance");
  const hasWatchInfo = /watched it \d+ times?/i.test(lastMessage) || /you've watched/i.test(lastMessage);
  const isDetailedView = hasRatingInfo || hasWatchInfo || (hasCastInfo && hasRuntimeInfo);

  // If we have a specific title mentioned, offer to explore it
  if (titles.length > 0) {
    // Only offer "More about" if this isn't already a detailed view
    if (!isDetailedView) {
      suggestions.push(`More about ${titles[0]}`);
    }
    suggestions.push(`Similar to ${titles[0]}`);
  }

  // Content type switching
  const hasMovies = lower.includes("movie") || lower.includes("film");
  const hasShows = lower.includes("show") || lower.includes("series") || lower.includes("tv");

  if (hasMovies && !hasShows && suggestions.length < 3) {
    suggestions.push("Show me TV shows instead");
  } else if (hasShows && !hasMovies && suggestions.length < 3) {
    suggestions.push("What about movies?");
  }

  // Fill remaining slots with contextual suggestions
  const fillers = [
    "Something different",
    "Surprise me",
    "What else is good?",
  ];

  for (const filler of fillers) {
    if (suggestions.length >= 3) break;
    suggestions.push(filler);
  }

  return suggestions.slice(0, 3);
}

const FollowUpSuggestions = memo(function FollowUpSuggestions({
  lastMessage,
  onSelect,
}: FollowUpSuggestionsProps) {
  const suggestions = useMemo(() => generateFollowUps(lastMessage), [lastMessage]);

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
