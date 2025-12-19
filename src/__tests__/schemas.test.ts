import { describe, it, expect } from "vitest";
import {
  MessageSchema,
  ChatRequestSchema,
  LibraryRequestSchema,
  validateToolInput,
  SearchByPersonInputSchema,
  SearchLibraryInputSchema,
  GetRecommendationsInputSchema,
} from "@/lib/schemas";

describe("MessageSchema", () => {
  it("validates a valid user message", () => {
    const result = MessageSchema.safeParse({
      role: "user",
      content: "Hello, world!",
    });
    expect(result.success).toBe(true);
  });

  it("validates a valid assistant message", () => {
    const result = MessageSchema.safeParse({
      role: "assistant",
      content: "Here are some recommendations.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = MessageSchema.safeParse({
      role: "system",
      content: "Hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = MessageSchema.safeParse({
      role: "user",
      content: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("ChatRequestSchema", () => {
  it("validates a minimal valid request", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("validates a full request with all optional fields", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
      plexUrl: "http://localhost:32400",
      plexToken: "abc123",
      geminiKey: "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345",
      omdbKey: "12345678",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty messages array", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid plexUrl", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
      plexUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("LibraryRequestSchema", () => {
  it("validates an empty request", () => {
    const result = LibraryRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates a request with plexUrl", () => {
    const result = LibraryRequestSchema.safeParse({
      plexUrl: "http://192.168.1.100:32400",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid plexUrl", () => {
    const result = LibraryRequestSchema.safeParse({
      plexUrl: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("Tool Input Schemas", () => {
  describe("SearchByPersonInputSchema", () => {
    it("validates valid input", () => {
      const result = SearchByPersonInputSchema.safeParse({ name: "Tom Hanks" });
      expect(result.success).toBe(true);
    });

    it("rejects empty name", () => {
      const result = SearchByPersonInputSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("SearchLibraryInputSchema", () => {
    it("validates valid input", () => {
      const result = SearchLibraryInputSchema.safeParse({ query: "Inception" });
      expect(result.success).toBe(true);
    });

    it("rejects empty query", () => {
      const result = SearchLibraryInputSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("GetRecommendationsInputSchema", () => {
    it("validates empty input", () => {
      const result = GetRecommendationsInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("validates input with genre", () => {
      const result = GetRecommendationsInputSchema.safeParse({ genre: "Comedy" });
      expect(result.success).toBe(true);
    });

    it("validates input with count", () => {
      const result = GetRecommendationsInputSchema.safeParse({ count: 5 });
      expect(result.success).toBe(true);
    });

    it("rejects count over 20", () => {
      const result = GetRecommendationsInputSchema.safeParse({ count: 25 });
      expect(result.success).toBe(false);
    });

    it("rejects negative count", () => {
      const result = GetRecommendationsInputSchema.safeParse({ count: -1 });
      expect(result.success).toBe(false);
    });
  });
});

describe("validateToolInput", () => {
  it("validates known tool with valid input", () => {
    const result = validateToolInput("search_by_person", { name: "Tom Hanks" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Tom Hanks" });
    }
  });

  it("returns error for unknown tool", () => {
    const result = validateToolInput("unknown_tool", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Unknown tool");
    }
  });

  it("returns error for invalid input", () => {
    const result = validateToolInput("search_by_person", { name: "" });
    expect(result.success).toBe(false);
  });
});
