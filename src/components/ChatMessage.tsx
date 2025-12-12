"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const ChatMessage = memo(function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-plex-orange text-black rounded-br-md"
            : "bg-white/5 text-foreground rounded-bl-md"
        }`}
      >
        <div className={`text-sm leading-relaxed ${isUser ? "" : "text-foreground/90"}`}>
          {isUser ? (
            <p className="m-0">{content}</p>
          ) : (
            <ReactMarkdown
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
            <span className="inline-block w-1.5 h-4 bg-plex-orange/60 ml-0.5 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;
