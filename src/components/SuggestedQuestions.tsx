"use client";

import { useState, useEffect, memo, useCallback } from "react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const defaultSuggestions = [
  // Mood-based
  "I'm bored, surprise me",
  "Cheer me up with something funny",
  "I need to unwind after a long day",
  "Feeling nostalgic tonight",
  "Something cozy for a rainy day",
  "I can't sleep, something calming",
  "I want my mind blown",
  "Feeling adventurous!",
  "I need a good cry",
  "Something heartwarming",
  "I want to feel inspired",
  "Escape reality for a few hours",

  // Social context
  "Perfect movie for date night",
  "Something the whole family can watch",
  "Movie night with friends",
  "Solo viewing, dealer's choice",
  "Background movie while I work",
  "Something to watch with my parents",

  // Time-based
  "Quick watch under 90 minutes",
  "Epic movie for a lazy Sunday",
  "What's a good weekend binge?",
  "Short episodes I can squeeze in",
  "A movie I can pause and resume",

  // Genre exploration
  "Best sci-fi in my library",
  "Underrated thrillers I own",
  "Scary movies for tonight",
  "Classic action films",
  "Romantic comedies please",
  "Mind-bending psychological films",
  "Best documentaries I have",
  "Animated movies for adults",
  "Crime dramas to binge",
  "Fantasy epics in my collection",

  // Discovery
  "Hidden gems I might have missed",
  "Critically acclaimed unwatched films",
  "Overlooked movies in my library",
  "What's the highest rated unwatched?",
  "Cult classics I should watch",
  "Award winners I haven't seen",

  // Decades & eras
  "Best 80s movies I own",
  "90s nostalgia trip",
  "Classic films from the golden age",
  "Modern masterpieces from the 2020s",
  "2000s movies I forgot about",

  // Actor/director search
  "Movies with Leonardo DiCaprio",
  "Directed by Denis Villeneuve",
  "Anything with Meryl Streep",
  "Wes Anderson films I have",
  "Movies starring Oscar Isaac",
  "Spielberg classics in my library",

  // TV Shows specific
  "Best TV shows to start",
  "Short series under 3 seasons",
  "Completed shows I can binge",
  "What show should I start next?",
  "Limited series recommendations",
  "Comedy shows to binge",

  // Library stats & exploration
  "What's my most watched genre?",
  "Show me my viewing stats",
  "What have I watched recently?",
  "What's on my watchlist?",
  "Recently added to my library",
  "What am I in the middle of?",
  "Show me my collections",
  "Most popular in my library",

  // Similar content
  "Movies like Interstellar",
  "Shows similar to Breaking Bad",
  "More like The Dark Knight",
  "If I liked Parasite, what else?",
  "Something in the style of Wes Anderson",

  // Specific requests
  "Best movie I haven't watched",
  "Random pick for tonight",
  "What's the longest movie I own?",
  "Foreign films with subtitles",
  "Based on true stories",
  "Book adaptations in my library",
  "Movies with twist endings",
  "Visually stunning films",
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
  // Start with first 6 items (deterministic for SSR), then shuffle on client
  const [items, setItems] = useState<string[]>(defaultSuggestions.slice(0, 6));

  // Shuffle only on client after mount to avoid hydration mismatch
  useEffect(() => {
    setItems(shuffle(defaultSuggestions).slice(0, 6));
  }, []);

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
