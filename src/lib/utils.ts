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
