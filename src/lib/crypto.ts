// Simple encryption for localStorage credentials
// This provides protection against casual snooping and basic XSS attacks
// Note: Client-side encryption has inherent limitations - determined attackers
// with full browser access can still extract credentials

const ENCRYPTION_KEY_NAME = "plex-chat-key";

// Generate or retrieve a persistent encryption key
async function getOrCreateKey(): Promise<CryptoKey> {
  // Try to retrieve existing key from IndexedDB
  const existingKey = await retrieveKeyFromStorage();
  if (existingKey) {
    return existingKey;
  }

  // Generate a new key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable for storage
    ["encrypt", "decrypt"]
  );

  // Store for future use
  await storeKeyInStorage(key);
  return key;
}

// Store key in IndexedDB (more secure than localStorage)
function storeKeyInStorage(key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("plex-chat-crypto", 1);

    request.onerror = () => reject(new Error("Failed to open IndexedDB"));

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys");
      }
    };

    request.onsuccess = async (event) => {
      try {
        const db = (event.target as IDBOpenDBRequest).result;
        const exportedKey = await crypto.subtle.exportKey("jwk", key);

        const tx = db.transaction("keys", "readwrite");
        const store = tx.objectStore("keys");
        store.put(exportedKey, ENCRYPTION_KEY_NAME);

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(new Error("Failed to store key"));
        };
      } catch (err) {
        reject(err);
      }
    };
  });
}

// Retrieve key from IndexedDB
function retrieveKeyFromStorage(): Promise<CryptoKey | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open("plex-chat-crypto", 1);

    request.onerror = () => resolve(null);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys");
      }
    };

    request.onsuccess = async (event) => {
      try {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains("keys")) {
          db.close();
          resolve(null);
          return;
        }

        const tx = db.transaction("keys", "readonly");
        const store = tx.objectStore("keys");
        const getRequest = store.get(ENCRYPTION_KEY_NAME);

        getRequest.onsuccess = async () => {
          db.close();
          if (!getRequest.result) {
            resolve(null);
            return;
          }

          try {
            const key = await crypto.subtle.importKey(
              "jwk",
              getRequest.result,
              { name: "AES-GCM", length: 256 },
              true,
              ["encrypt", "decrypt"]
            );
            resolve(key);
          } catch {
            resolve(null);
          }
        };

        getRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    };
  });
}

// Encrypt a string value
export async function encryptValue(plaintext: string): Promise<string> {
  if (!plaintext) return "";

  try {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(plaintext);

    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encodedData
    );

    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("Encryption failed:", error);
    // Fallback: return empty to avoid storing plaintext
    return "";
  }
}

// Decrypt a string value
export async function decryptValue(ciphertext: string): Promise<string> {
  if (!ciphertext) return "";

  try {
    const key = await getOrCreateKey();

    // Decode base64
    const combined = new Uint8Array(
      atob(ciphertext)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Decryption failed:", error);
    return "";
  }
}

// Encrypt an object with sensitive fields
export async function encryptSettings(settings: {
  plexUrl: string;
  plexToken: string;
  anthropicKey: string;
  omdbKey: string;
}): Promise<string> {
  const [plexUrl, plexToken, anthropicKey, omdbKey] = await Promise.all([
    encryptValue(settings.plexUrl),
    encryptValue(settings.plexToken),
    encryptValue(settings.anthropicKey),
    encryptValue(settings.omdbKey),
  ]);

  return JSON.stringify({
    plexUrl,
    plexToken,
    anthropicKey,
    omdbKey,
    _encrypted: true,
  });
}

// Decrypt settings object
export async function decryptSettings(stored: string): Promise<{
  plexUrl: string;
  plexToken: string;
  anthropicKey: string;
  omdbKey: string;
} | null> {
  try {
    const parsed = JSON.parse(stored);

    // Handle legacy unencrypted settings (migrate them)
    if (!parsed._encrypted) {
      return {
        plexUrl: parsed.plexUrl || "",
        plexToken: parsed.plexToken || "",
        anthropicKey: parsed.anthropicKey || "",
        omdbKey: parsed.omdbKey || "",
      };
    }

    const [plexUrl, plexToken, anthropicKey, omdbKey] = await Promise.all([
      decryptValue(parsed.plexUrl),
      decryptValue(parsed.plexToken),
      decryptValue(parsed.anthropicKey),
      decryptValue(parsed.omdbKey),
    ]);

    return { plexUrl, plexToken, anthropicKey, omdbKey };
  } catch {
    return null;
  }
}

// Clear all stored crypto keys (for logout/clear functionality)
export function clearCryptoKeys(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase("plex-chat-crypto");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
