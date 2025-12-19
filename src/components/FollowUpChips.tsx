"use client";

import { memo } from "react";

interface FollowUpChipsProps {
  onSelect: (message: string) => void;
}

const followUpOptions = [
  { label: "Tell me more", message: "Tell me more about the first one" },
  { label: "Something else", message: "Show me something different" },
  { label: "More like these", message: "More recommendations like these" },
];

const FollowUpChips = memo(function FollowUpChips({ onSelect }: FollowUpChipsProps) {
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
