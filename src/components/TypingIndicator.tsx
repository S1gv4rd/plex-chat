"use client";

import { memo } from "react";

interface TypingIndicatorProps {
  status?: string;
}

const TypingIndicator = memo(function TypingIndicator({ status }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start mb-3 animate-message-in">
      <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* Animated dots */}
          <div className="flex gap-1.5">
            <div className="typing-dot w-2 h-2 bg-plex-orange rounded-full" />
            <div className="typing-dot w-2 h-2 bg-plex-orange rounded-full" />
            <div className="typing-dot w-2 h-2 bg-plex-orange rounded-full" />
          </div>
          {status && (
            <span className="text-xs text-foreground/40">{status}</span>
          )}
        </div>
      </div>
    </div>
  );
});

export default TypingIndicator;
