"use client";

import { useState, memo, useCallback, useRef, useEffect } from "react";
import { shuffle } from "@/lib/utils";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const defaultSuggestions = [
  // Mood-based
  "I need a good laugh tonight",
  "Something to keep me on the edge of my seat",
  "I want to feel inspired",
  "Find me something heartwarming",
  "I'm in the mood for something mind-bending",
  "Show me something visually stunning",

  // Context-based
  "Perfect movie for a date night",
  "Something the whole family can enjoy",
  "A quick movie I can finish in under 90 minutes",
  "An epic film for a lazy Sunday",
  "Something light and easy to watch",

  // Genre exploration
  "What are my best unwatched thrillers?",
  "Show me some classic sci-fi I haven't seen",
  "Any good horror movies in my library?",
  "I want to watch a great documentary",
  "Find me an underrated gem",

  // Discovery
  "What movies have I added recently?",
  "Show me my collections",
  "What are the highest rated films I haven't watched?",
  "Movies similar to what I've enjoyed",

  // TV Shows
  "What's a good show to binge this weekend?",
  "Short series I can finish quickly",
  "What TV shows have I been watching?",

  // Stats & History
  "Show me my watching stats",
  "What have I watched recently?",
  "What genres do I watch the most?",
];

const SuggestedQuestions = memo(function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  // Track if initial shuffle has happened
  const hasShuffled = useRef(false);

  // Initialize with deterministic first 3 for SSR
  const [items, setItems] = useState<string[]>(defaultSuggestions.slice(0, 3));

  // Shuffle after mount (client-side only)
  // This is intentional: we need to shuffle on first render for client-side randomization
  useEffect(() => {
    if (!hasShuffled.current) {
      hasShuffled.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(shuffle(defaultSuggestions).slice(0, 3));
    }
  }, []);

  const refresh = useCallback(() => {
    setItems(shuffle(defaultSuggestions).slice(0, 3));
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-lg">
      <div className="flex flex-col gap-2 w-full">
        {items.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="border text-sm px-4 py-2.5 rounded-xl transition-all duration-150 bg-white/5 border-white/10 hover:border-plex-orange/40 hover:bg-plex-orange/10 active:scale-[0.98] active:bg-plex-orange/20 text-foreground/70 hover:text-foreground text-left"
          >
            {q}
          </button>
        ))}
      </div>
      <button
        onClick={refresh}
        className="text-xs text-foreground/30 hover:text-foreground/60 transition-colors flex items-center gap-1.5 group"
        aria-label="Show more suggestions"
      >
        <svg className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Show different suggestions
      </button>
    </div>
  );
});

export default SuggestedQuestions;
