"use client";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] md:max-w-[70%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-plex-orange text-black"
            : "bg-chat-assistant text-foreground"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-2 text-plex-orange text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            Plex Assistant
          </div>
        )}
        <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
          {content}
        </div>
      </div>
    </div>
  );
}
