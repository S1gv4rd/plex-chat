"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const ChatMessage = memo(function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";
  const roleLabel = isUser ? "You" : "Plex Assistant";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 chat-message ${!isStreaming ? "animate-message-in" : ""}`}
      role="article"
      aria-label={`Message from ${roleLabel}`}
    >
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-plex-orange text-black rounded-br-md"
            : "bg-white/5 text-foreground rounded-bl-md"
        }`}
      >
        {/* Screen reader only label */}
        <span className="sr-only">{roleLabel} says: </span>

        <div
          className={`text-sm leading-relaxed ${isUser ? "" : "text-foreground/90"}`}
          aria-live={isStreaming ? "polite" : undefined}
          aria-atomic={isStreaming ? "false" : undefined}
        >
          {isUser ? (
            <p className="m-0">{content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkBreaks]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc marker:text-plex-orange/50">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => <strong className="font-medium text-plex-orange">{children}</strong>,
                h1: ({ children }) => <h1 className="text-base font-semibold mb-2 text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 text-foreground">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium mb-1 text-foreground">{children}</h3>,
              }}
            >
              {content}
            </ReactMarkdown>
          )}
          {isStreaming && (
            <span
              className="streaming-cursor inline-block w-0.5 h-4 bg-plex-orange ml-0.5 rounded-full"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;
