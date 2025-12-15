"use client";

import { useState, useEffect } from "react";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const SETTINGS_KEY = "plex-chat-settings";

export interface AppSettings {
  plexUrl: string;
  plexToken: string;
  anthropicKey: string;
}

export function getSettings(): AppSettings {
  if (typeof window === "undefined") {
    return { plexUrl: "", plexToken: "", anthropicKey: "" };
  }
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : { plexUrl: "", plexToken: "", anthropicKey: "" };
  } catch {
    return { plexUrl: "", plexToken: "", anthropicKey: "" };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export default function Settings({ isOpen, onClose, onSave }: SettingsProps) {
  const [plexUrl, setPlexUrl] = useState("");
  const [plexToken, setPlexToken] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const settings = getSettings();
      setPlexUrl(settings.plexUrl);
      setPlexToken(settings.plexToken);
      setAnthropicKey(settings.anthropicKey);
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveSettings({ plexUrl, plexToken, anthropicKey });
    setSaved(true);
    setTimeout(() => {
      onSave();
      onClose();
    }, 500);
  };

  const handleClear = () => {
    setPlexUrl("");
    setPlexToken("");
    setAnthropicKey("");
    localStorage.removeItem(SETTINGS_KEY);
    setSaved(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-plex-gray border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-foreground">Settings</h2>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Plex URL */}
          <div>
            <label className="block text-sm text-foreground/60 mb-1.5">
              Plex Server URL
            </label>
            <input
              type="url"
              value={plexUrl}
              onChange={(e) => setPlexUrl(e.target.value)}
              placeholder="http://192.168.1.100:32400"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none focus:border-plex-orange/50 transition-colors"
            />
          </div>

          {/* Plex Token */}
          <div>
            <label className="block text-sm text-foreground/60 mb-1.5">
              Plex Token
            </label>
            <input
              type="password"
              value={plexToken}
              onChange={(e) => setPlexToken(e.target.value)}
              placeholder="Your X-Plex-Token"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none focus:border-plex-orange/50 transition-colors"
            />
            <p className="text-xs text-foreground/30 mt-1">
              Find in Plex Web → Settings → Account → XML
            </p>
          </div>

          {/* Anthropic API Key */}
          <div>
            <label className="block text-sm text-foreground/60 mb-1.5">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none focus:border-plex-orange/50 transition-colors"
            />
          </div>

          {/* Info */}
          <p className="text-xs text-foreground/30 pt-2">
            Settings are stored locally in your browser. Leave blank to use server environment variables.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-foreground/60 hover:text-foreground hover:border-white/20 transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={saved}
            className="flex-1 px-4 py-2.5 rounded-xl bg-plex-orange text-black font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
