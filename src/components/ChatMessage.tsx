"use client";

import { memo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const ChatMessage = memo(function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  return (
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-3 chat-message`}>
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
        {/* Copy button - only for assistant messages, hidden while streaming */}
        {!isUser && !isStreaming && (
          <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-foreground/40 hover:text-foreground/70 active:text-plex-orange transition-colors"
              aria-label={copied ? "Copied!" : "Copy message"}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
