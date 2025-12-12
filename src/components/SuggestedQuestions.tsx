"use client";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

const suggestions = [
  "What should I watch tonight?",
  "What movies haven't I watched yet?",
  "Recommend something based on my taste",
  "What sci-fi movies do I have?",
  "What am I currently watching?",
  "What's missing from my collection?",
];

export default function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
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
  );
}
