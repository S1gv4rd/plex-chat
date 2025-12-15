"use client";

interface TypingIndicatorProps {
  status?: string;
}

export default function TypingIndicator({ status }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3 min-w-[80px]">
        <div className="flex items-center gap-3">
          {/* Animated dots */}
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-plex-orange rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "600ms" }} />
            <div className="w-2 h-2 bg-plex-orange rounded-full animate-bounce" style={{ animationDelay: "150ms", animationDuration: "600ms" }} />
            <div className="w-2 h-2 bg-plex-orange rounded-full animate-bounce" style={{ animationDelay: "300ms", animationDuration: "600ms" }} />
          </div>
          {status && (
            <span className="text-xs text-foreground/40">{status}</span>
          )}
        </div>
      </div>
    </div>
  );
}
