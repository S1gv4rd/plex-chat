"use client";

import { useReducer, useCallback, useRef, useEffect } from "react";
import { getSettingsAsync } from "@/components/Settings";

// Types
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  streamingContent: string;
  loadingStatus: string | null;
}

type ChatAction =
  | { type: "SET_INPUT"; payload: string }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_MESSAGES"; payload: Message[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_STREAMING_CONTENT"; payload: string }
  | { type: "SET_LOADING_STATUS"; payload: string | null }
  | { type: "CLEAR_MESSAGES" }
  | { type: "START_SENDING" }
  | { type: "FINISH_SENDING"; payload: { content: string } }
  | { type: "FINISH_SENDING_ERROR"; payload: { errorMessage: string } };

// Constants
const STORAGE_KEY = "plex-chat-history";
const MAX_STORED_MESSAGES = 50;
const REQUEST_TIMEOUT = 60000;
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000];

// Generate unique ID for messages
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Load messages from localStorage
function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed.map((msg: Partial<Message>) => ({
      id: msg.id || generateId(),
      role: msg.role || "assistant",
      content: msg.content || "",
    }));
  } catch {
    return [];
  }
}

// Save messages to localStorage
function saveMessages(messages: Message[]) {
  try {
    const toStore = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Storage full or unavailable
  }
}

// Reducer
function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    case "SET_MESSAGES":
      return { ...state, messages: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_STREAMING_CONTENT":
      return { ...state, streamingContent: action.payload };
    case "SET_LOADING_STATUS":
      return { ...state, loadingStatus: action.payload };
    case "CLEAR_MESSAGES":
      return { ...state, messages: [] };
    case "START_SENDING":
      return {
        ...state,
        input: "",
        isLoading: true,
        streamingContent: "",
        loadingStatus: null,
      };
    case "FINISH_SENDING":
      return {
        ...state,
        messages: [...state.messages, {
          id: generateId(),
          role: "assistant",
          content: action.payload.content,
        }],
        streamingContent: "",
        loadingStatus: null,
        isLoading: false,
      };
    case "FINISH_SENDING_ERROR":
      return {
        ...state,
        messages: [...state.messages, {
          id: generateId(),
          role: "assistant",
          content: action.payload.errorMessage,
        }],
        streamingContent: "",
        loadingStatus: null,
        isLoading: false,
      };
    default:
      return state;
  }
}

// Initial state
const initialState: ChatState = {
  messages: [],
  input: "",
  isLoading: false,
  streamingContent: "",
  loadingStatus: null,
};

export function useChat() {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const historyLoadedRef = useRef(false);
  // Refs for values needed in callbacks to avoid stale closures
  const messagesRef = useRef(state.messages);
  const isLoadingRef = useRef(state.isLoading);

  // Keep refs in sync with state
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  useEffect(() => {
    isLoadingRef.current = state.isLoading;
  }, [state.isLoading]);

  // Load chat history on mount
  useEffect(() => {
    const stored = loadMessages();
    if (stored.length > 0) {
      dispatch({ type: "SET_MESSAGES", payload: stored });
    }
    historyLoadedRef.current = true;
  }, []);

  // Save messages when they change
  useEffect(() => {
    if (historyLoadedRef.current && state.messages.length > 0) {
      saveMessages(state.messages);
    }
  }, [state.messages]);

  // Set input
  const setInput = useCallback((value: string) => {
    dispatch({ type: "SET_INPUT", payload: value });
  }, []);

  // Attempt request with retries
  const attemptRequest = useCallback(async (
    messages: Message[],
    userMessage: Message,
    attempt: number
  ): Promise<Response> => {
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
          geminiKey: settings.geminiKey || undefined,
          omdbKey: settings.omdbKey || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (attempt < MAX_RETRIES && error instanceof Error && error.name !== "AbortError") {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        return attemptRequest(messages, userMessage, attempt + 1);
      }
      throw error;
    }
  }, []);

  // Parse error message
  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return "The request timed out. The server might be busy - please try again.";
      }
      if (error.message.startsWith("rate_limit:")) {
        const seconds = error.message.split(":")[1];
        return `Too many requests. Please wait ${seconds} seconds before trying again.`;
      }
      if (error.message === "csrf_error") {
        return "Security check failed. Please refresh the page and try again.";
      }
      if (error.message === "server_error") {
        return "Server error. Please check your settings and try again.";
      }
      if (error.message.includes("Plex")) {
        return "Could not connect to Plex server. Check your server URL and token in Settings.";
      }
      if (error.message.includes("fetch") || error.message.includes("network")) {
        return "Network error. Please check your internet connection and try again.";
      }
    }
    return "Sorry, something went wrong. Please try again.";
  }, []);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    // Use refs to get current values and avoid stale closures
    if (!content.trim() || isLoadingRef.current) return;

    const userMessage: Message = { id: generateId(), role: "user", content: content.trim() };
    dispatch({ type: "ADD_MESSAGE", payload: userMessage });
    dispatch({ type: "START_SENDING" });

    try {
      const response = await attemptRequest(messagesRef.current, userMessage, 0);

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
      let buffer = ""; // Buffer for incomplete lines across chunk boundaries

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines only
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.status !== undefined) {
                dispatch({ type: "SET_LOADING_STATUS", payload: parsed.status });
              }
              if (parsed.text) {
                fullContent += parsed.text;
                dispatch({ type: "SET_STREAMING_CONTENT", payload: fullContent });
              }
              if (parsed.error) throw new Error(parsed.error);
            } catch (e) {
              if (data.trim() && data !== "[DONE]") {
                console.error("Parse error:", e, "Data:", data);
              }
            }
          }
        }
      }

      // Process any remaining data in buffer
      if (buffer.startsWith("data: ")) {
        const data = buffer.slice(6);
        if (data !== "[DONE]" && data.trim()) {
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullContent += parsed.text;
            }
          } catch {
            // Ignore incomplete final chunk
          }
        }
      }

      dispatch({ type: "FINISH_SENDING", payload: { content: fullContent } });
    } catch (error) {
      dispatch({ type: "FINISH_SENDING_ERROR", payload: { errorMessage: getErrorMessage(error) } });
    }
  }, [attemptRequest, getErrorMessage]);

  // Clear chat
  const clearChat = useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGES" });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    messages: state.messages,
    input: state.input,
    isLoading: state.isLoading,
    streamingContent: state.streamingContent,
    loadingStatus: state.loadingStatus,
    setInput,
    sendMessage,
    clearChat,
    hasMessages: state.messages.length > 0,
  };
}
