"use client";

import { useState, useEffect, useCallback } from "react";
import { encryptSettings, decryptSettings, clearCryptoKeys } from "@/lib/crypto";
import { isValidUrl, isValidPlexToken, isValidAnthropicKey, isValidOmdbKey } from "@/lib/utils";

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
  omdbKey: string;
}

const emptySettings: AppSettings = {
  plexUrl: "",
  plexToken: "",
  anthropicKey: "",
  omdbKey: "",
};

// Async function to get settings (decrypts from storage)
export async function getSettingsAsync(): Promise<AppSettings> {
  if (typeof window === "undefined") {
    return emptySettings;
  }
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return emptySettings;

    const decrypted = await decryptSettings(stored);
    return decrypted || emptySettings;
  } catch {
    return emptySettings;
  }
}

// Synchronous getter for initial render (returns empty, actual values loaded async)
export function getSettings(): AppSettings {
  return emptySettings;
}

// Async function to save settings (encrypts before storage)
export async function saveSettingsAsync(settings: AppSettings): Promise<void> {
  const encrypted = await encryptSettings(settings);
  localStorage.setItem(SETTINGS_KEY, encrypted);
}

// Legacy sync save (deprecated, use saveSettingsAsync)
export function saveSettings(settings: AppSettings): void {
  // Fire and forget - encryption happens async
  saveSettingsAsync(settings).catch(console.error);
}

interface ValidationErrors {
  plexUrl?: string;
  plexToken?: string;
  anthropicKey?: string;
  omdbKey?: string;
}

export default function Settings({ isOpen, onClose, onSave }: SettingsProps) {
  const [plexUrl, setPlexUrl] = useState("");
  const [plexToken, setPlexToken] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [omdbKey, setOmdbKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Validate all fields and return true if valid
  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!isValidUrl(plexUrl)) {
      newErrors.plexUrl = "Enter a valid URL (http:// or https://)";
    }
    if (!isValidPlexToken(plexToken)) {
      newErrors.plexToken = "Token should be at least 10 alphanumeric characters";
    }
    if (!isValidAnthropicKey(anthropicKey)) {
      newErrors.anthropicKey = "Key should start with 'sk-ant-'";
    }
    if (!isValidOmdbKey(omdbKey)) {
      newErrors.omdbKey = "Key should be at least 8 alphanumeric characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [plexUrl, plexToken, anthropicKey, omdbKey]);

  // Load settings asynchronously (with decryption)
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getSettingsAsync();
      setPlexUrl(settings.plexUrl);
      setPlexToken(settings.plexToken);
      setAnthropicKey(settings.anthropicKey);
      setOmdbKey(settings.omdbKey || "");
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setSaved(false);
      setErrors({});
    }
  }, [isOpen, loadSettings]);

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await saveSettingsAsync({ plexUrl, plexToken, anthropicKey, omdbKey });
      setSaved(true);
      setTimeout(() => {
        onSave();
        onClose();
      }, 500);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setPlexUrl("");
    setPlexToken("");
    setAnthropicKey("");
    setOmdbKey("");
    setErrors({});
    localStorage.removeItem(SETTINGS_KEY);
    // Also clear encryption keys for complete cleanup
    await clearCryptoKeys();
    setSaved(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative bg-plex-gray border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="settings-title" className="text-lg font-medium text-foreground">Settings</h2>
          <button
            onClick={onClose}
            className="text-foreground/40 hover:text-foreground transition-colors"
            aria-label="Close settings"
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
              className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none transition-colors ${
                errors.plexUrl ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-plex-orange/50"
              }`}
              aria-invalid={!!errors.plexUrl}
            />
            {errors.plexUrl && (
              <p className="text-xs text-red-400 mt-1">{errors.plexUrl}</p>
            )}
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
              className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none transition-colors ${
                errors.plexToken ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-plex-orange/50"
              }`}
              aria-invalid={!!errors.plexToken}
            />
            {errors.plexToken ? (
              <p className="text-xs text-red-400 mt-1">{errors.plexToken}</p>
            ) : (
              <p className="text-xs text-foreground/30 mt-1">
                Find in Plex Web → Settings → Account → XML
              </p>
            )}
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
              className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none transition-colors ${
                errors.anthropicKey ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-plex-orange/50"
              }`}
              aria-invalid={!!errors.anthropicKey}
            />
            {errors.anthropicKey && (
              <p className="text-xs text-red-400 mt-1">{errors.anthropicKey}</p>
            )}
          </div>

          {/* OMDB API Key */}
          <div>
            <label className="block text-sm text-foreground/60 mb-1.5">
              OMDB API Key <span className="text-foreground/30">(optional)</span>
            </label>
            <input
              type="password"
              value={omdbKey}
              onChange={(e) => setOmdbKey(e.target.value)}
              placeholder="Your OMDB API key"
              className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none transition-colors ${
                errors.omdbKey ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-plex-orange/50"
              }`}
              aria-invalid={!!errors.omdbKey}
            />
            {errors.omdbKey ? (
              <p className="text-xs text-red-400 mt-1">{errors.omdbKey}</p>
            ) : (
              <p className="text-xs text-foreground/30 mt-1">
                For external movie ratings. Free at omdbapi.com
              </p>
            )}
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
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-foreground/60 hover:text-foreground hover:border-white/20 transition-colors disabled:opacity-50"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={saved || loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-plex-orange text-black font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
