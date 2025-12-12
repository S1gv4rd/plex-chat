"use client";

import ReactMarkdown from "react-markdown";

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
        <div className="prose prose-sm md:prose-base prose-invert max-w-none">
          {isUser ? (
            <p className="m-0">{content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-plex-orange">{children}</strong>,
                h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-plex-orange">{children}</h1>,
                h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-plex-orange">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-plex-orange">{children}</h3>,
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
