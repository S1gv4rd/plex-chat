"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import SuggestedQuestions from "@/components/SuggestedQuestions";
import Settings, { getSettingsAsync } from "@/components/Settings";
import ConfirmModal from "@/components/ConfirmModal";
import ChatHeader from "@/components/ChatHeader";
import ChatInput from "@/components/ChatInput";
import OfflineIndicator from "@/components/OfflineIndicator";
import FollowUpChips from "@/components/FollowUpChips";
import { PlexLibrarySummary } from "@/lib/plex";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  // Chat state from hook
  const {
    messages,
    input,
    isLoading,
    streamingContent,
    loadingStatus,
    setInput,
    sendMessage,
    clearChat,
    hasMessages,
  } = useChat();

  // UI state
  const [librarySummary, setLibrarySummary] = useState<PlexLibrarySummary | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch library data
  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true);
    try {
      const settings = await getSettingsAsync();
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // Initial library fetch
  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, streamingContent]);

  // Handlers
  const handleResetChat = useCallback(() => {
    if (hasMessages) {
      setClearConfirmOpen(true);
    } else {
      clearChat();
    }
  }, [hasMessages, clearChat]);

  const handleConfirmClear = useCallback(() => {
    clearChat();
    setClearConfirmOpen(false);
  }, [clearChat]);

  const handleRandomPick = useCallback(() => {
    sendMessage("Spin the wheel!");
  }, [sendMessage]);

  const handleSubmit = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  return (
    <div className="app-height flex flex-col bg-background">
      <OfflineIndicator error={libraryError} />

      <ChatHeader
        isLoading={isLoading}
        libraryError={libraryError}
        librarySummary={librarySummary}
        libraryLoading={libraryLoading}
        onResetChat={handleResetChat}
        onRandomPick={handleRandomPick}
        onOpenSettings={() => setSettingsOpen(true)}
      />

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
              {!isLoading && !streamingContent && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                <FollowUpChips onSelect={sendMessage} />
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isLoading || !!libraryError}
        />
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
        onConfirm={handleConfirmClear}
        onCancel={() => setClearConfirmOpen(false)}
        destructive
      />
    </div>
  );
}
