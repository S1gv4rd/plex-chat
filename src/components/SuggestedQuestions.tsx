"use client";

import { useState, memo, useCallback } from "react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const defaultSuggestions = [
  "What should I watch tonight?",
  "Recommend a movie for date night",
  "Something fun for the whole family?",
  "What's a good weekend binge?",
  "Surprise me with something good",
  "I need a laugh, something funny",
  "Something intense and suspenseful",
  "A feel-good movie to cheer me up",
  "Something mind-bending",
  "What sci-fi movies do I have?",
  "Show me some thrillers",
  "What horror movies are in my library?",
  "Show me action movies",
  "What Tom Hanks movies do I have?",
  "Films directed by Christopher Nolan?",
  "What Tarantino movies do I own?",
  "What movies haven't I watched yet?",
  "Any hidden gems in my collection?",
  "What TV shows should I start?",
  "What am I currently watching?",
  "What are my viewing stats?",
  "What's on my watchlist?",
  "Show me my collections",
  "Movies like Inception",
  "Find something similar to The Matrix",
];

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Get initial items once (not on every render)
function getInitialItems(): string[] {
  const shuffled = shuffle(defaultSuggestions);
  return shuffled.slice(0, 6);
}

const SuggestedQuestions = memo(function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  const [items, setItems] = useState<string[]>(getInitialItems);

  const refresh = useCallback(() => {
    setItems(shuffle(defaultSuggestions).slice(0, 6));
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
