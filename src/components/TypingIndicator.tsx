"use client";

export default function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-chat-assistant rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2 text-plex-orange text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          Plex Assistant
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-plex-orange rounded-full typing-dot" />
          <div className="w-2 h-2 bg-plex-orange rounded-full typing-dot" />
          <div className="w-2 h-2 bg-plex-orange rounded-full typing-dot" />
        </div>
      </div>
    </div>
  );
}
