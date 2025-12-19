"use client";

import { memo } from "react";
import { PlexLibrarySummary } from "@/lib/plex";
import { ModelProvider } from "./Settings";
import LibraryStats from "./LibraryStats";

interface ChatHeaderProps {
  isLoading: boolean;
  libraryError: string | null;
  librarySummary: PlexLibrarySummary | null;
  libraryLoading: boolean;
  currentModel: ModelProvider;
  onResetChat: () => void;
  onRandomPick: () => void;
  onOpenSettings: () => void;
}

const ChatHeader = memo(function ChatHeader({
  isLoading,
  libraryError,
  librarySummary,
  libraryLoading,
  currentModel,
  onResetChat,
  onRandomPick,
  onOpenSettings,
}: ChatHeaderProps) {
  const modelLabel = currentModel === "gemini" ? "Gemini" : "Claude";

  return (
    <header className="px-4 py-3 safe-top shrink-0 overflow-visible">
      <div className="max-w-2xl mx-auto flex items-center justify-between overflow-visible">
        <button
          onClick={onResetChat}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          aria-label="Start new chat"
        >
          <div className="w-8 h-8 bg-plex-orange rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 2A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2h-15Zm7.5 4 5.5 6-5.5 6-1.5-1.5L14 12l-3.5-4.5L12 6Z"/>
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-base font-medium text-foreground leading-tight">Plex Chat</span>
            <span className="text-[10px] text-foreground/40 leading-tight">{modelLabel}</span>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onRandomPick}
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
            onClick={onOpenSettings}
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
  );
});

export default ChatHeader;
