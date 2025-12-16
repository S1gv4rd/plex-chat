"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import LibraryStats from "@/components/LibraryStats";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import Settings, { getSettingsAsync } from "@/components/Settings";
import ConfirmModal from "@/components/ConfirmModal";
import { PlexLibrarySummary } from "@/lib/plex";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "plex-chat-history";
const MAX_STORED_MESSAGES = 50;

// Generate unique ID for messages
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Migrate old messages without IDs
    return parsed.map((msg: Partial<Message>) => ({
      id: msg.id || generateId(),
      role: msg.role || "assistant",
      content: msg.content || "",
    }));
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
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const settings = await getSettingsAsync();
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      const res = await fetch("/api/library", {
        method: "POST",
        headers,
        body: JSON.stringify({
          plexUrl: settings.plexUrl || undefined,
          plexToken: settings.plexToken || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch library");

      const data = await res.json();
      setLibrarySummary(data);
      setLibraryError(null);
    } catch {
      setLibraryError("Could not connect to Plex server.");
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingContent]);

  // Handle mobile keyboard - keep input visible when keyboard opens
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      // When keyboard opens, visualViewport.height decreases
      // Scroll input into view with a small delay for keyboard animation
      if (document.activeElement === inputRef.current) {
        setTimeout(() => {
          inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    };

    visualViewport.addEventListener("resize", handleResize);
    return () => visualViewport.removeEventListener("resize", handleResize);
  }, []);

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [input]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { id: generateId(), role: "user", content: content.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");
    setLoadingStatus(null);

    const REQUEST_TIMEOUT = 60000; // 60 second timeout
    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [1000, 3000]; // Exponential backoff

    const attemptRequest = async (attempt: number): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const settings = await getSettingsAsync();
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            plexUrl: settings.plexUrl || undefined,
            plexToken: settings.plexToken || undefined,
            anthropicKey: settings.anthropicKey || undefined,
            omdbKey: settings.omdbKey || undefined,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        // Retry on network errors, not on abort
        if (attempt < MAX_RETRIES && error instanceof Error && error.name !== "AbortError") {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
          return attemptRequest(attempt + 1);
        }
        throw error;
      }
    };

    try {
      const response = await attemptRequest(0);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(`rate_limit:${errorData.retryAfter || 60}`);
        } else if (response.status === 403) {
          throw new Error("csrf_error");
        } else if (response.status === 500) {
          throw new Error(errorData.error || "server_error");
        }
        throw new Error("request_failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("no_stream");

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

      setMessages(prev => [...prev, { id: generateId(), role: "assistant", content: fullContent }]);
    } catch (error) {
      // Generate specific error messages
      let errorMessage = "Sorry, something went wrong. Please try again.";

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "The request timed out. The server might be busy - please try again.";
        } else if (error.message.startsWith("rate_limit:")) {
          const seconds = error.message.split(":")[1];
          errorMessage = `Too many requests. Please wait ${seconds} seconds before trying again.`;
        } else if (error.message === "csrf_error") {
          errorMessage = "Security check failed. Please refresh the page and try again.";
        } else if (error.message === "server_error") {
          errorMessage = "Server error. Please check your settings and try again.";
        } else if (error.message.includes("Plex")) {
          errorMessage = "Could not connect to Plex server. Check your server URL and token in Settings.";
        } else if (error.message.includes("fetch") || error.message.includes("network")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
        }
      }

      setMessages(prev => [...prev, {
        id: generateId(),
        role: "assistant",
        content: errorMessage,
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
    if (messages.length > 0) {
      setClearConfirmOpen(true);
      return;
    }
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, [messages.length]);

  const confirmClearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    setClearConfirmOpen(false);
  }, []);

  return (
    <div className="app-height flex flex-col bg-background">
      {/* Offline indicator */}
      {libraryError && (
        <div role="alert" className="bg-red-500/10 border-b border-red-500/20 px-4 py-1.5 mb-1">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-2.5 text-red-400 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a9 9 0 010-12.728m3.536 3.536a4 4 0 010 5.656M12 12h.01" />
            </svg>
            <span>Plex server offline</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-2 underline hover:text-red-300"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <header className="px-4 py-3 safe-top shrink-0 overflow-visible">
        <div className="max-w-2xl mx-auto flex items-center justify-between overflow-visible">
          <button onClick={resetChat} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity" aria-label="Start new chat">
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
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border-2 border-white/10 hover:border-plex-orange transition-all disabled:opacity-30 disabled:cursor-not-allowed text-lg"
              title="Random movie picker"
              aria-label="Pick a random movie"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin text-foreground/60" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : "🎲"}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              disabled={isLoading}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border-2 border-white/10 hover:border-plex-orange transition-all text-foreground/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
              title="Settings"
              aria-label="Open settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <LibraryStats summary={librarySummary} error={libraryError} loading={libraryLoading} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Chat messages">
          {messages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="welcome-icon w-16 h-16 bg-plex-orange/10 rounded-2xl flex items-center justify-center mb-5 icon-glow animate-fade-in-up">
                <svg className="w-8 h-8 text-plex-orange" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2h-15Zm7.5 4 5.5 6-5.5 6-1.5-1.5L14 12l-3.5-4.5L12 6Z"/>
                </svg>
              </div>
              <h2 className="welcome-title text-xl font-medium mb-2 text-foreground animate-fade-in-up-delay-1">What would you like to watch?</h2>
              <p className="welcome-subtitle text-foreground/40 mb-6 max-w-xs text-sm animate-fade-in-up-delay-2">
                Ask for recommendations, search by actor, or explore your library.
              </p>
              <div className="animate-fade-in-up-delay-3">
                <SuggestedQuestions onSelect={sendMessage} />
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
              ))}
              {streamingContent && <ChatMessage role="assistant" content={streamingContent} isStreaming />}
              {isLoading && !streamingContent && <TypingIndicator status={loadingStatus || undefined} />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="input-area px-4 pt-2 pb-4 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 resize-none focus:outline-none focus:border-plex-orange/50 text-foreground placeholder-foreground/30 transition-colors overflow-hidden"
                rows={1}
                style={{ minHeight: "48px" }}
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

      {/* Settings Modal */}
      <Settings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={fetchLibrary}
      />

      {/* Clear Chat Confirmation */}
      <ConfirmModal
        isOpen={clearConfirmOpen}
        title="Clear chat history?"
        message="This will remove all messages from this conversation. This action cannot be undone."
        confirmText="Clear"
        cancelText="Cancel"
        onConfirm={confirmClearChat}
        onCancel={() => setClearConfirmOpen(false)}
        destructive
      />
    </div>
  );
}
