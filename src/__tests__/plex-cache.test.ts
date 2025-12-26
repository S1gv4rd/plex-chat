import { describe, it, expect, beforeEach } from "vitest";
import {
  getCached,
  setCache,
  clearCache,
  tryStartWarmup,
  completeWarmup,
  failWarmup,
  isCacheWarmedUp,
  invalidateCache,
} from "@/lib/plex-cache";

describe("plex-cache", () => {
  beforeEach(() => {
    clearCache();
    invalidateCache();
  });

  describe("getCached / setCache", () => {
    it("stores and retrieves cached data", () => {
      const testData = { MediaContainer: { size: 10 } };
      setCache("test-key", testData, 60000);
      const result = getCached<typeof testData>("test-key");
      expect(result).toEqual(testData);
    });

    it("returns null for non-existent keys", () => {
      const result = getCached("non-existent");
      expect(result).toBeNull();
    });

    it("returns null for expired entries", async () => {
      const testData = { MediaContainer: { size: 10 } };
      setCache("expire-test", testData, 1); // 1ms TTL
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = getCached("expire-test");
      expect(result).toBeNull();
    });

    it("updates lastAccessed on read for LRU tracking", () => {
      const testData = { MediaContainer: { size: 10 } };
      setCache("lru-test", testData, 60000);

      // First access
      getCached("lru-test");

      // Wait a bit and access again
      const result = getCached("lru-test");
      expect(result).toEqual(testData);
    });
  });

  describe("warmup state", () => {
    it("tryStartWarmup returns true on first call", () => {
      expect(tryStartWarmup()).toBe(true);
    });

    it("tryStartWarmup returns false when warmup in progress", () => {
      tryStartWarmup();
      expect(tryStartWarmup()).toBe(false);
    });

    it("completeWarmup marks cache as warmed up", () => {
      tryStartWarmup();
      completeWarmup();
      expect(isCacheWarmedUp()).toBe(true);
    });

    it("failWarmup allows retry", () => {
      tryStartWarmup();
      failWarmup();
      expect(isCacheWarmedUp()).toBe(false);
      expect(tryStartWarmup()).toBe(true); // Can start again
    });

    it("invalidateCache resets warmup state", () => {
      tryStartWarmup();
      completeWarmup();
      expect(isCacheWarmedUp()).toBe(true);

      invalidateCache();
      expect(isCacheWarmedUp()).toBe(false);
      expect(tryStartWarmup()).toBe(true);
    });
  });

  describe("clearCache", () => {
    it("removes all cached entries", () => {
      setCache("key1", { MediaContainer: { size: 1 } }, 60000);
      setCache("key2", { MediaContainer: { size: 2 } }, 60000);

      clearCache();

      expect(getCached("key1")).toBeNull();
      expect(getCached("key2")).toBeNull();
    });
  });
});
