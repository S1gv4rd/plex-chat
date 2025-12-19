"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { encryptSettings, decryptSettings, clearCryptoKeys } from "@/lib/crypto";
import { isValidUrl, isValidPlexToken, isValidAnthropicKey, isValidOmdbKey } from "@/lib/utils";
import { useModalAnimation } from "@/hooks/useModalAnimation";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const SETTINGS_KEY = "plex-chat-settings";

export type ModelProvider = "claude" | "gemini";

export interface AppSettings {
  plexUrl: string;
  plexToken: string;
  anthropicKey: string;
  geminiKey: string;
  omdbKey: string;
  model: ModelProvider;
}

const emptySettings: AppSettings = {
  plexUrl: "",
  plexToken: "",
  anthropicKey: "",
  geminiKey: "",
  omdbKey: "",
  model: "claude",
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
    // Merge with defaults for backward compatibility with old stored settings
    return decrypted ? { ...emptySettings, ...decrypted } : emptySettings;
  } catch {
    return emptySettings;
  }
}

// Async function to save settings (encrypts before storage)
export async function saveSettingsAsync(settings: AppSettings): Promise<void> {
  const encrypted = await encryptSettings(settings);
  localStorage.setItem(SETTINGS_KEY, encrypted);
}

interface ValidationErrors {
  plexUrl?: string;
  plexToken?: string;
  anthropicKey?: string;
  geminiKey?: string;
  omdbKey?: string;
}

export default function Settings({ isOpen, onClose, onSave }: SettingsProps) {
  const [plexUrl, setPlexUrl] = useState("");
  const [plexToken, setPlexToken] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [omdbKey, setOmdbKey] = useState("");
  const [model, setModel] = useState<ModelProvider>("claude");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const { visible, shouldRender } = useModalAnimation(isOpen);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Validate all fields and return true if valid
  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!isValidUrl(plexUrl)) {
      newErrors.plexUrl = "Enter a valid URL (http:// or https://)";
    }
    if (!isValidPlexToken(plexToken)) {
      newErrors.plexToken = "Token should be at least 10 alphanumeric characters";
    }
    // Validate API key based on selected model
    if (model === "claude" && !isValidAnthropicKey(anthropicKey)) {
      newErrors.anthropicKey = "Key should start with 'sk-ant-'";
    }
    if (model === "gemini" && geminiKey && geminiKey.length < 20) {
      newErrors.geminiKey = "Key should be at least 20 characters";
    }
    if (!isValidOmdbKey(omdbKey)) {
      newErrors.omdbKey = "Key should be at least 8 alphanumeric characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [plexUrl, plexToken, anthropicKey, geminiKey, omdbKey, model]);

  // Load settings asynchronously (with decryption)
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getSettingsAsync();
      setPlexUrl(settings.plexUrl);
      setPlexToken(settings.plexToken);
      setAnthropicKey(settings.anthropicKey);
      setGeminiKey(settings.geminiKey || "");
      setOmdbKey(settings.omdbKey || "");
      setModel(settings.model || "claude");
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
      setTestResult(null);
    }
  }, [isOpen, loadSettings]);

  // Test connection to Plex server
  const testConnection = useCallback(async () => {
    if (!plexUrl || !plexToken) {
      setTestResult({ success: false, message: "Enter Plex URL and token first" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plexUrl, plexToken }),
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Connected! ${data.totalMovies} movies, ${data.totalShows} shows`,
        });
      } else {
        setTestResult({ success: false, message: "Could not connect to Plex server" });
      }
    } catch {
      setTestResult({ success: false, message: "Connection failed" });
    } finally {
      setTesting(false);
    }
  }, [plexUrl, plexToken]);

  // Handle Escape key to close modal and focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Focus first input when modal opens
    firstInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap - keep Tab within modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await saveSettingsAsync({ plexUrl, plexToken, anthropicKey, geminiKey, omdbKey, model });
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
    if (!window.confirm("Clear all settings? This will remove your API keys and Plex credentials.")) {
      return;
    }
    setPlexUrl("");
    setPlexToken("");
    setAnthropicKey("");
    setGeminiKey("");
    setOmdbKey("");
    setModel("claude");
    setErrors({});
    localStorage.removeItem(SETTINGS_KEY);
    // Also clear encryption keys for complete cleanup
    await clearCryptoKeys();
    setSaved(false);
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`relative bg-plex-gray border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl transition-all duration-200 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
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
              ref={firstInputRef}
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

          {/* Test Connection Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || !plexUrl || !plexToken}
              className="min-w-[120px] px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:border-plex-orange/30 hover:bg-plex-orange/5 text-foreground/60 hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {testResult && (
              <span className={`text-xs ${testResult.success ? "text-green-400" : "text-red-400"}`}>
                {testResult.message}
              </span>
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm text-foreground/60 mb-1.5">
              AI Model
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModel("claude")}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  model === "claude"
                    ? "bg-plex-orange text-black font-medium"
                    : "bg-white/5 border border-white/10 text-foreground/60 hover:text-foreground hover:border-white/20"
                }`}
              >
                Claude
              </button>
              <button
                type="button"
                onClick={() => setModel("gemini")}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  model === "gemini"
                    ? "bg-plex-orange text-black font-medium"
                    : "bg-white/5 border border-white/10 text-foreground/60 hover:text-foreground hover:border-white/20"
                }`}
              >
                Gemini Flash
              </button>
            </div>
          </div>

          {/* API Key - conditional based on model */}
          {model === "claude" ? (
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
          ) : (
            <div>
              <label className="block text-sm text-foreground/60 mb-1.5">
                Google AI API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Your Gemini API key"
                className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-foreground placeholder-foreground/30 focus:outline-none transition-colors ${
                  errors.geminiKey ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-plex-orange/50"
                }`}
                aria-invalid={!!errors.geminiKey}
              />
              {errors.geminiKey ? (
                <p className="text-xs text-red-400 mt-1">{errors.geminiKey}</p>
              ) : (
                <p className="text-xs text-foreground/30 mt-1">
                  Get a key at aistudio.google.com
                </p>
              )}
            </div>
          )}

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
