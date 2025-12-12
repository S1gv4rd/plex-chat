"use client";

import { useState, useEffect } from "react";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const allSuggestions = [
  // What to watch tonight
  "What should I watch tonight?",
  "Recommend a movie for date night",
  "Something fun for the whole family?",
  "I want something short, under 90 minutes",
  "What's a good weekend binge?",
  "Pick a random movie for me",
  "What's something I haven't watched in a while?",
  "Surprise me with something good",

  // Moods
  "I need a laugh, something funny",
  "I want to cry, something emotional",
  "Something intense and suspenseful",
  "A feel-good movie to cheer me up",
  "Something dark and gritty",
  "A relaxing, easy watch",
  "Something mind-bending",
  "An epic adventure film",

  // Genres
  "What sci-fi movies do I have?",
  "Show me some thrillers",
  "What horror movies are in my library?",
  "Any good documentaries?",
  "Show me action movies",
  "What dramas do I have?",
  "Any romantic comedies?",
  "What animated films do I own?",
  "Show me crime movies",
  "Any war films in my collection?",
  "What westerns do I have?",
  "Show me mystery movies",
  "Any musicals?",
  "What fantasy films do I have?",

  // Actors
  "What Tom Hanks movies do I have?",
  "Any movies with Meryl Streep?",
  "Show me Leonardo DiCaprio films",
  "What do I have with Denzel Washington?",
  "Movies starring Brad Pitt?",
  "Any Scarlett Johansson films?",
  "What Nicolas Cage movies do I own?",
  "Show me films with Morgan Freeman",
  "Any movies with Cate Blanchett?",
  "What do I have with Samuel L. Jackson?",
  "Films starring Joaquin Phoenix?",
  "Any Amy Adams movies?",
  "Show me Keanu Reeves films",
  "What Jake Gyllenhaal movies do I have?",

  // Directors
  "Films directed by Christopher Nolan?",
  "Show me Spielberg films in my library",
  "What Tarantino movies do I own?",
  "Any Scorsese films?",
  "Show me Denis Villeneuve movies",
  "What do I have from David Fincher?",
  "Any Wes Anderson films?",
  "Movies directed by Ridley Scott?",
  "Show me Coen Brothers films",
  "What Stanley Kubrick movies do I have?",
  "Any films by Guillermo del Toro?",
  "Show me Edgar Wright movies",
  "What do I have from Paul Thomas Anderson?",

  // Discovery
  "What movies haven't I watched yet?",
  "Any hidden gems in my collection?",
  "What's my longest unwatched movie?",
  "Show me critically acclaimed films I haven't seen",
  "What cult classics do I have?",
  "Any underrated movies?",

  // Specific requests
  "Best movies from the 80s?",
  "Classic films from the 90s?",
  "What's the oldest movie I have?",
  "Movies over 3 hours long?",
  "Foreign films in my collection?",
  "Any black and white movies?",
  "Show me movies from this year",
  "What sequels do I have?",
  "Any based on true stories?",
  "Show me book adaptations",

  // TV Shows
  "What TV shows should I start?",
  "Any short series I can finish quickly?",
  "What's a good drama series?",
  "Show me comedy TV shows",
  "Any limited series?",
  "What reality shows do I have?",

  // Currently watching
  "What am I currently watching?",
  "What should I continue watching?",
  "Any shows I haven't finished?",
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
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      <div className="flex flex-wrap gap-2 justify-center">
        {suggestions.map((question) => (
          <button
            key={question}
            onClick={() => onSelect(question)}
            className="bg-white/5 border border-white/10 hover:border-plex-orange/30 hover:bg-plex-orange/5 text-xs px-3 py-1.5 rounded-full transition-all text-foreground/60 hover:text-foreground"
          >
            {question}
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
}
