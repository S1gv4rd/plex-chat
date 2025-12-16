"use client";

import { memo, useRef, useEffect, useCallback } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

const ChatInput = memo(function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle mobile keyboard - keep input visible when keyboard opens
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
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
    if (!value && inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }, [onSubmit]);

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  }, [onSubmit]);

  return (
    <div className="input-area px-4 pt-2 pb-4 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
      <form onSubmit={handleFormSubmit} className="flex gap-2 max-w-2xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 pr-12 resize-none focus:outline-none focus:border-plex-orange/50 text-foreground placeholder-foreground/30 transition-colors overflow-hidden"
            rows={1}
            style={{ minHeight: "48px" }}
            disabled={disabled}
            aria-label="Type your message"
          />
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-plex-orange text-black w-8 h-8 rounded-xl font-medium hover:bg-amber-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
});

export default ChatInput;
