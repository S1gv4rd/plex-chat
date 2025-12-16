import { describe, it, expect } from "vitest";
import { shuffle, isValidUrl, isValidPlexToken, isValidAnthropicKey, isValidOmdbKey } from "@/lib/utils";

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

describe("isValidAnthropicKey", () => {
  it("validates proper Anthropic API keys", () => {
    expect(isValidAnthropicKey("sk-ant-api03-abcdefghijklmnop")).toBe(true);
  });

  it("treats empty key as valid (uses server env)", () => {
    expect(isValidAnthropicKey("")).toBe(true);
  });

  it("rejects keys without sk-ant- prefix", () => {
    expect(isValidAnthropicKey("sk-1234567890abcdefgh")).toBe(false);
  });

  it("rejects keys that are too short", () => {
    expect(isValidAnthropicKey("sk-ant-short")).toBe(false);
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
