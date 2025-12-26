// Shared utility functions

/**
 * Fisher-Yates shuffle algorithm
 * Returns a new shuffled array without mutating the original
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @param shouldRetry - Optional function to determine if retry should happen based on error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  shouldRetry?: (error: unknown) => boolean
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable (network errors, timeouts, 5xx responses)
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, timeouts, and transient failures
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("etimedout")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Validates a URL string
 * Returns true if the URL is valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url) return true; // Empty is valid (uses server env)
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates a Plex token format
 * Plex tokens are typically 20 characters alphanumeric
 */
export function isValidPlexToken(token: string): boolean {
  if (!token) return true; // Empty is valid (uses server env)
  return token.length >= 10 && /^[a-zA-Z0-9_-]+$/.test(token);
}

/**
 * Validates a Gemini API key format
 * Keys are alphanumeric and typically 39 characters
 */
export function isValidGeminiKey(key: string): boolean {
  if (!key) return true; // Empty is valid (uses server env)
  return key.length >= 30 && /^[a-zA-Z0-9_-]+$/.test(key);
}

/**
 * Validates an OMDB API key format
 * OMDB keys are 8 character alphanumeric
 */
export function isValidOmdbKey(key: string): boolean {
  if (!key) return true; // Empty is valid (optional)
  return key.length >= 8 && /^[a-zA-Z0-9]+$/.test(key);
}
