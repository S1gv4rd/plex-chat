import "@testing-library/jest-dom";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as unknown as Storage;

// Mock fetch
global.fetch = vi.fn();

// Mock crypto for client-side encryption tests
Object.defineProperty(global, "crypto", {
  value: {
    subtle: {
      generateKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
    },
    getRandomValues: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
  },
});

// Mock indexedDB
const indexedDBMock = {
  open: vi.fn(() => ({
    onerror: null,
    onsuccess: null,
    onupgradeneeded: null,
  })),
};
global.indexedDB = indexedDBMock as unknown as IDBFactory;
