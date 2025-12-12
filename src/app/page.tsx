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
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-plex-gray/50 px-4 py-4 safe-top shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-plex-orange to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-plex-orange/20">
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2h-15Zm7.5 4 5.5 6-5.5 6-1.5-1.5L14 12l-3.5-4.5L12 6Z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Plex Chat</h1>
              <p className="text-xs text-foreground/50">AI-powered library assistant</p>
            </div>
          </div>
          <LibraryStats
            summary={librarySummary}
            loading={libraryLoading}
            error={libraryError}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-plex-orange/20 to-amber-600/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <svg className="w-10 h-10 text-plex-orange" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2h-15Zm7.5 4 5.5 6-5.5 6-1.5-1.5L14 12l-3.5-4.5L12 6Z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-3 text-foreground">What would you like to watch?</h2>
              <p className="text-foreground/50 mb-8 max-w-sm text-sm leading-relaxed">
                I know your entire library. Ask me for recommendations, search by actor or director, or discover hidden gems.
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
        <div className="border-t border-plex-gray/50 p-4 safe-bottom shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your Plex library..."
              className="flex-1 bg-plex-gray/50 border border-plex-gray rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-plex-orange/50 focus:border-plex-orange text-foreground placeholder-foreground/30 transition-all"
              rows={1}
              disabled={isLoading || !!libraryError}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !!libraryError}
              className="bg-plex-orange text-black w-12 h-12 rounded-xl font-medium hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-lg shadow-plex-orange/20 disabled:shadow-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
