"use client";

import { memo, useMemo } from "react";

interface FollowUpSuggestionsProps {
  lastMessage: string;
  onSelect: (question: string) => void;
}

// Extract movie/show titles from the message (bold markdown format)
function extractTitles(content: string): string[] {
  const matches = content.match(/\*\*([^*]+)\*\*/g) || [];
  return matches
    .map(m => m.replace(/\*\*/g, "").split(" (")[0].trim())
    .filter(t => t.length > 0 && t.length < 50)
    .slice(0, 5);
}

// Detect what type of content was discussed
function detectContext(content: string): {
  hasMovies: boolean;
  hasShows: boolean;
  hasStats: boolean;
  hasGenre: string | null;
  hasPerson: string | null;
} {
  const lower = content.toLowerCase();
  return {
    hasMovies: lower.includes("movie") || lower.includes("film"),
    hasShows: lower.includes("show") || lower.includes("series") || lower.includes("episode"),
    hasStats: lower.includes("watched") || lower.includes("viewing") || lower.includes("stats"),
    hasGenre: extractGenre(lower),
    hasPerson: extractPerson(content),
  };
}

function extractGenre(content: string): string | null {
  const genres = ["comedy", "drama", "action", "horror", "sci-fi", "thriller", "romance", "documentary"];
  for (const genre of genres) {
    if (content.includes(genre)) return genre;
  }
  return null;
}

function extractPerson(content: string): string | null {
  // Look for "directed by X" or "with X" patterns
  const directorMatch = content.match(/directed by ([A-Z][a-z]+ [A-Z][a-z]+)/);
  if (directorMatch) return directorMatch[1];
  return null;
}

function generateFollowUps(lastMessage: string): string[] {
  const titles = extractTitles(lastMessage);
  const context = detectContext(lastMessage);
  const suggestions: string[] = [];

  // Title-based suggestions
  if (titles.length > 0) {
    const firstTitle = titles[0];
    suggestions.push(`Tell me more about ${firstTitle}`);
    suggestions.push(`Find something similar to ${firstTitle}`);
  }

  // Context-based suggestions
  if (context.hasMovies && !context.hasShows) {
    suggestions.push("What about TV shows instead?");
  }
  if (context.hasShows && !context.hasMovies) {
    suggestions.push("Any movie recommendations?");
  }
  if (context.hasGenre) {
    suggestions.push(`More ${context.hasGenre} recommendations`);
  }
  if (context.hasPerson) {
    suggestions.push(`What else from ${context.hasPerson}?`);
  }
  if (context.hasStats) {
    suggestions.push("What should I watch next?");
  }

  // General follow-ups if we don't have enough
  const generalFollowUps = [
    "Something completely different",
    "What's new in my library?",
    "Any hidden gems?",
    "What's popular right now?",
  ];

  while (suggestions.length < 3) {
    const next = generalFollowUps.shift();
    if (next && !suggestions.includes(next)) {
      suggestions.push(next);
    } else {
      break;
    }
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
