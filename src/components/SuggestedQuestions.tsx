"use client";

import { useState, useEffect, memo, useCallback } from "react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const defaultSuggestions = [
  // Quick actions
  "Surprise me",
  "Spin the wheel",
  "What should I watch?",

  // Mood
  "Something funny",
  "Something intense",
  "Something relaxing",

  // Context
  "Date night movie",
  "Family friendly",
  "Quick watch",

  // Genres
  "Best thrillers",
  "Sci-fi picks",
  "Horror movies",

  // Discovery
  "Hidden gems",
  "What's new?",
  "My collections",

  // TV
  "What should I binge?",
  "Best TV shows",

  // Stats
  "My watch stats",
  "Recently watched",
];

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const SuggestedQuestions = memo(function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  // Start with first 4 items (deterministic for SSR), then shuffle on client
  const [items, setItems] = useState<string[]>(defaultSuggestions.slice(0, 4));

  // Shuffle only on client after mount to avoid hydration mismatch
  useEffect(() => {
    setItems(shuffle(defaultSuggestions).slice(0, 4));
  }, []);

  const refresh = useCallback(() => {
    setItems(shuffle(defaultSuggestions).slice(0, 4));
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      <div className="flex flex-wrap gap-2 justify-center">
        {items.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="border text-xs px-3 py-1.5 rounded-full transition-all bg-white/5 border-white/10 hover:border-plex-orange/30 hover:bg-plex-orange/5 text-foreground/60 hover:text-foreground"
          >
            {q}
          </button>
        ))}
      </div>
      <button
        onClick={refresh}
        className="text-[11px] text-foreground/30 hover:text-foreground/60 transition-colors flex items-center gap-1 group"
      >
        <svg className="w-3 h-3 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        More
      </button>
    </div>
  );
});

export default SuggestedQuestions;
