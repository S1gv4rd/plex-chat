"use client";

import { memo } from "react";

interface FollowUpChipsProps {
  onSelect: (message: string) => void;
  lastMessage?: string;
}

function isMultipleItems(content: string): boolean {
  // Check for numbered lists (1. 2. 3. or 1) 2) 3))
  const numberedListPattern = /\n\s*[2-9][.)]/;
  // Check for bullet points with multiple items
  const multipleBullets = (content.match(/\n\s*[-•*]/g) || []).length >= 2;
  // Check for plural indicators
  const pluralIndicators = /\b(these|movies|shows|series|episodes|items|recommendations)\b/i;

  return numberedListPattern.test(content) || multipleBullets || pluralIndicators.test(content);
}

const FollowUpChips = memo(function FollowUpChips({ onSelect, lastMessage = "" }: FollowUpChipsProps) {
  const isMultiple = isMultipleItems(lastMessage);

  const followUpOptions = [
    { label: "Something else", message: "Show me something different" },
    {
      label: isMultiple ? "More like these" : "More like this",
      message: isMultiple ? "More recommendations like these" : "More recommendations like this"
    },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-3 ml-1 animate-fade-in">
      {followUpOptions.map((option) => (
        <button
          key={option.label}
          onClick={() => onSelect(option.message)}
          className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-foreground/60 hover:text-foreground hover:border-plex-orange/30 hover:bg-plex-orange/5 transition-all active:scale-95"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
});

export default FollowUpChips;
