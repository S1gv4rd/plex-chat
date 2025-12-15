"use client";

interface TypingIndicatorProps {
  status?: string;
}

export default function TypingIndicator({ status }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-plex-orange/60 rounded-full typing-dot" />
            <div className="w-1.5 h-1.5 bg-plex-orange/60 rounded-full typing-dot" />
            <div className="w-1.5 h-1.5 bg-plex-orange/60 rounded-full typing-dot" />
          </div>
          {status && (
            <span className="text-xs text-foreground/40 ml-1">{status}</span>
          )}
        </div>
      </div>
    </div>
  );
}
