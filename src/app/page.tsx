"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import LibraryStats from "@/components/LibraryStats";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import FollowUpSuggestions from "@/components/FollowUpSuggestions";
import { PlexLibrarySummary } from "@/lib/plex";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "plex-chat-history";
const MAX_STORED_MESSAGES = 50;

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]) {
  try {
    // Keep only recent messages to avoid storage limits
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Storage full or unavailable
  }
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [librarySummary, setLibrarySummary] = useState<PlexLibrarySummary | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const stored = loadMessages();
    if (stored.length > 0) {
      setMessages(stored);
    }
    setHistoryLoaded(true);
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (historyLoaded && messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages, historyLoaded]);

  useEffect(() => {
    // Fetch library summary in background - don't block UI
    fetch("/api/library")
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(setLibrarySummary)
      .catch(() => setLibraryError("Could not connect to Plex server."));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingContent]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    setLoadingStatus(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error();

      const reader = response.body?.getReader();
      if (!reader) throw new Error();

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.status !== undefined) {
                setLoadingStatus(parsed.status);
              }
              if (parsed.text) {
                fullContent += parsed.text;
                setStreamingContent(fullContent);
              }
              if (parsed.error) throw new Error(parsed.error);
            } catch (e) {
              // Only log actual errors, not empty parse attempts
              if (data.trim() && data !== "[DONE]") {
                console.error("Parse error:", e, "Data:", data);
              }
            }
          }
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: fullContent }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I had trouble processing that. Please try again.",
      }]);
    } finally {
      setStreamingContent("");
      setLoadingStatus(null);
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  const resetChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <header className="px-4 py-3 safe-top shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={resetChat} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-plex-orange rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2h-15Zm7.5 4 5.5 6-5.5 6-1.5-1.5L14 12l-3.5-4.5L12 6Z"/>
              </svg>
            </div>
            <span className="text-base font-medium text-foreground">Plex Chat</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => sendMessage("Spin the wheel!")}
              disabled={isLoading || !!libraryError}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:border-plex-orange/30 hover:bg-plex-orange/5 text-foreground/60 hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed text-lg"
              title="Random movie picker"
            >
              🎲
            </button>
            <LibraryStats summary={librarySummary} error={libraryError} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-plex-orange/10 rounded-2xl flex items-center justify-center mb-5">
                <svg className="w-8 h-8 text-plex-orange" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2h-15Zm7.5 4 5.5 6-5.5 6-1.5-1.5L14 12l-3.5-4.5L12 6Z"/>
                </svg>
              </div>
              <h2 className="text-xl font-medium mb-2 text-foreground">What would you like to watch?</h2>
              <p className="text-foreground/40 mb-6 max-w-xs text-sm">
                Ask for recommendations, search by actor, or explore your library.
              </p>
              <SuggestedQuestions onSelect={sendMessage} />
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <ChatMessage key={i} role={msg.role} content={msg.content} />
              ))}
              {streamingContent && <ChatMessage role="assistant" content={streamingContent} isStreaming />}
              {isLoading && !streamingContent && <TypingIndicator status={loadingStatus || undefined} />}
              {/* Show follow-up suggestions after last assistant message */}
              {!isLoading && !streamingContent && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                <FollowUpSuggestions
                  lastMessage={messages[messages.length - 1].content}
                  onSelect={sendMessage}
                />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-4 safe-bottom shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 resize-none focus:outline-none focus:border-plex-orange/50 text-foreground placeholder-foreground/30 transition-colors"
                rows={1}
                disabled={isLoading || !!libraryError}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || !!libraryError}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-plex-orange text-black w-8 h-8 rounded-xl font-medium hover:bg-amber-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
