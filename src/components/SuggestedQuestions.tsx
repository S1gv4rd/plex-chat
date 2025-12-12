"use client";

import { useState, useEffect } from "react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const allSuggestions = [
  // What to watch
  "What should I watch tonight?",
  "Recommend a movie for date night",
  "Something fun for the whole family?",
  "I want something short, under 90 minutes",
  "What's a good weekend binge?",

  // Discovery
  "What movies haven't I watched yet?",
  "Show me my highest rated unwatched films",
  "What new shows did I add recently?",
  "Any hidden gems in my collection?",
  "What's my longest unwatched movie?",

  // Genres & Moods
  "What sci-fi movies do I have?",
  "I'm in the mood for comedy",
  "Show me some thrillers",
  "What horror movies are in my library?",
  "Any good documentaries?",
  "I want something feel-good",

  // People
  "What Tom Hanks movies do I have?",
  "Films directed by Christopher Nolan?",
  "Any movies with Meryl Streep?",
  "Show me Spielberg films in my library",
  "What Tarantino movies do I own?",

  // Collection analysis
  "What's missing from my collection?",
  "What am I currently watching?",
  "What decade has the most movies?",
  "What genres do I have the most of?",
  "Any movie series I haven't finished?",

  // Specific requests
  "Best movies from the 80s in my library?",
  "Award-winning films I haven't seen?",
  "What's the oldest movie I have?",
  "Movies over 3 hours long?",
  "Foreign films in my collection?",
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Pick 6 random suggestions on mount
    const shuffled = shuffleArray(allSuggestions);
    setSuggestions(shuffled.slice(0, 6));
  }, []);

  const refresh = () => {
    const shuffled = shuffleArray(allSuggestions);
    setSuggestions(shuffled.slice(0, 6));
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((question) => (
          <button
            key={question}
            onClick={() => onSelect(question)}
            className="bg-plex-gray hover:bg-plex-orange hover:text-black text-sm px-3 py-2 rounded-full transition-colors"
          >
            {question}
          </button>
        ))}
      </div>
      <button
        onClick={refresh}
        className="text-xs text-foreground/50 hover:text-plex-orange transition-colors flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        More suggestions
      </button>
    </div>
  );
}
