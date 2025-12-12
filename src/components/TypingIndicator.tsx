"use client";

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white/5 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 bg-plex-orange/60 rounded-full typing-dot" />
          <div className="w-1.5 h-1.5 bg-plex-orange/60 rounded-full typing-dot" />
          <div className="w-1.5 h-1.5 bg-plex-orange/60 rounded-full typing-dot" />
        </div>
      </div>
    </div>
  );
}
