"use client";

import { useState, useRef, useEffect } from "react";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import LibraryStats from "@/components/LibraryStats";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import { PlexLibrarySummary } from "@/lib/plex";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [librarySummary, setLibrarySummary] = useState<PlexLibrarySummary | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch library summary on mount
  useEffect(() => {
    async function fetchLibrary() {
      try {
        const response = await fetch("/api/library");
        if (!response.ok) {
          throw new Error("Failed to connect to Plex");
        }
        const data = await response.json();
        setLibrarySummary(data);
        setLibraryError(null);
      } catch (error) {
        setLibraryError("Could not connect to Plex server. Check your configuration.");
      } finally {
        setLibraryLoading(false);
      }
    }
    fetchLibrary();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: Message = { role: "assistant", content: data.message };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I had trouble processing that. Please check your connection and try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="h-[100dvh] flex flex-col">
      {/* Header */}
      <header className="bg-plex-dark border-b border-plex-gray px-4 py-3 safe-top shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-plex-orange rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 md:w-6 md:h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-foreground truncate">Plex Chat</h1>
            <p className="text-xs text-foreground/60 truncate">Ask me about your library</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Library stats */}
        <div className="p-4">
          <LibraryStats
            summary={librarySummary}
            loading={libraryLoading}
            error={libraryError}
          />
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 bg-plex-orange/20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-plex-orange" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">Welcome to Plex Chat</h2>
              <p className="text-foreground/60 mb-6 max-w-md">
                I can help you discover what to watch, find movies based on your taste,
                and explore your Plex library. Try asking me something!
              </p>
              <SuggestedQuestions onSelect={sendMessage} />
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <ChatMessage key={index} role={message.role} content={message.content} />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-plex-gray p-4 bg-plex-dark safe-bottom shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your Plex library..."
              className="flex-1 bg-plex-gray rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-plex-orange text-foreground placeholder-foreground/40"
              rows={1}
              disabled={isLoading || !!libraryError}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !!libraryError}
              className="bg-plex-orange text-black px-6 py-3 rounded-xl font-medium hover:bg-plex-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
