import { describe, it, expect, vi } from "vitest";
import { shuffle, isValidUrl, isValidPlexToken, isValidGeminiKey, isValidOmdbKey, withRetry, isRetryableError } from "@/lib/utils";

describe("shuffle", () => {
  it("returns an array of the same length", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.length).toBe(arr.length);
  });

  it("contains all original elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.sort()).toEqual(arr.sort());
  });

  it("does not modify the original array", () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });

  it("handles empty array", () => {
    const result = shuffle([]);
    expect(result).toEqual([]);
  });

  it("handles single element array", () => {
    const result = shuffle([1]);
    expect(result).toEqual([1]);
  });
});

describe("isValidUrl", () => {
  it("validates http URLs", () => {
    expect(isValidUrl("http://localhost:32400")).toBe(true);
    expect(isValidUrl("http://192.168.1.100:32400")).toBe(true);
  });

  it("validates https URLs", () => {
    expect(isValidUrl("https://plex.example.com")).toBe(true);
    expect(isValidUrl("https://plex.example.com:443")).toBe(true);
  });

  it("treats empty string as valid (uses server env)", () => {
    expect(isValidUrl("")).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });
});

describe("isValidPlexToken", () => {
  it("validates typical Plex tokens", () => {
    expect(isValidPlexToken("abcdefghijklmnop")).toBe(true);
    expect(isValidPlexToken("ABC123xyz789")).toBe(true);
    expect(isValidPlexToken("token_with-dashes")).toBe(true);
  });

  it("treats empty token as valid (uses server env)", () => {
    expect(isValidPlexToken("")).toBe(true);
  });

  it("rejects token shorter than 10 chars", () => {
    expect(isValidPlexToken("short")).toBe(false);
  });

  it("rejects token with invalid characters", () => {
    expect(isValidPlexToken("token with spaces")).toBe(false);
    expect(isValidPlexToken("token<script>")).toBe(false);
  });
});

describe("isValidGeminiKey", () => {
  it("validates proper Gemini API keys", () => {
    expect(isValidGeminiKey("AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345")).toBe(true);
  });

  it("treats empty key as valid (uses server env)", () => {
    expect(isValidGeminiKey("")).toBe(true);
  });

  it("rejects keys that are too short", () => {
    expect(isValidGeminiKey("short")).toBe(false);
  });
});

describe("isValidOmdbKey", () => {
  it("validates proper OMDB keys", () => {
    expect(isValidOmdbKey("12345678")).toBe(true);
    expect(isValidOmdbKey("abcd1234")).toBe(true);
  });

  it("treats empty key as valid (optional)", () => {
    expect(isValidOmdbKey("")).toBe(true);
  });

  it("rejects keys shorter than 8 chars", () => {
    expect(isValidOmdbKey("short")).toBe(false);
  });

  it("rejects keys with invalid characters", () => {
    expect(isValidOmdbKey("key-with-dashes")).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, 2, 10)).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("respects shouldRetry predicate", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));
    const shouldRetry = vi.fn().mockReturnValue(false);
    await expect(withRetry(fn, 3, 10, shouldRetry)).rejects.toThrow("non-retryable");
    expect(fn).toHaveBeenCalledTimes(1); // No retries when shouldRetry returns false
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });
});

describe("isRetryableError", () => {
  it("returns true for network errors", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("network error"))).toBe(true);
  });

  it("returns true for timeout errors", () => {
    expect(isRetryableError(new Error("timeout reached"))).toBe(true);
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
  });

  it("returns true for connection errors", () => {
    expect(isRetryableError(new Error("ECONNREFUSED"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError(new Error("validation failed"))).toBe(false);
    expect(isRetryableError(new Error("not found"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isRetryableError("string error")).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});
