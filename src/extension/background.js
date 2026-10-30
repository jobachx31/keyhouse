/**
 * Databytes Keyhouse — Chrome Extension Manifest V3 Background Service Worker
 *
 * Handles zero-knowledge encryption, shared backend sync with the web app,
 * in-memory decrypted credentials while unlocked, origin matching, and auto-lock.
 */

const DEFAULT_ORIGIN = 'https://ais-dev-co4gob4lg4iddfeaoxhusv-474810200924.europe-west2.run.app';

// In-memory runtime state (keys & credentials are never stored in plaintext on disk)
let sessionState = {
  isUnlocked: false,
  items: [],
  masterKey: null,
  currentSalt: null,
  userEmail: null,
  vaultVersion: 0,
  apiOrigin: DEFAULT_ORIGIN,
  lockTimerId: null,
  inactivityLimitMinutes: 15
};

// Reset auto-lock timer
function resetAutoLock() {
  if (sessionState.lockTimerId) {
    clearTimeout(sessionState.lockTimerId);
  }
  sessionState.lockTimerId = setTimeout(() => {
    lockVault();
  }, sessionState.inactivityLimitMinutes * 60 * 1000);
}

// Lock vault and purge all decrypted items & master keys from memory
function lockVault() {
  if (sessionState.lockTimerId) {
    clearTimeout(sessionState.lockTimerId);
    sessionState.lockTimerId = null;
  }
  sessionState.isUnlocked = false;
  sessionState.masterKey = null;
  sessionState.currentSalt = null;
  sessionState.items = [];
  console.log('[Databytes Keyhouse] Vault locked due to inactivity or command');
  chrome.runtime.sendMessage({ type: 'VAULT_LOCKED' }).catch(() => {});
}

// Extract canonical hostname or IP address for origin checks
function extractHostname(urlStr) {
  try {
    const raw = (urlStr || '').trim();
    if (!raw) return '';
    const formatted = raw.includes('://') ? raw : 'http://' + raw;
    const url = new URL(formatted);
    return url.hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

// Strict origin matching: does itemUrl match pageUrl?
function matchesOrigin(itemUrl, pageUrl) {
  if (!itemUrl || !pageUrl) return false;
  try {
    const itemHost = extractHostname(itemUrl);
    const pageHost = extractHostname(pageUrl);
    if (!itemHost || !pageHost) return false;

    // Exact hostname / IP match
    if (itemHost === pageHost) return true;

    // Subdomain matching
    if (pageHost.endsWith('.' + itemHost)) return true;
    if (itemHost.endsWith('.' + pageHost)) return true;

    return false;
  } catch (e) {
    return false;
  }
}

// Web Crypto base64 helpers
function toBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function generateRandomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

// Derive AES-256-GCM key from passphrase using PBKDF2 (100,000 iterations)
async function deriveMasterKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt', 'encrypt']
  );
}

// Encrypt items into a versioned EncryptedEnvelope
async function encryptVault(items, key, salt, vaultVersion) {
  const encoder = new TextEncoder();
  const serialized = JSON.stringify(items);
  const plaintext = encoder.encode(serialized);
  const iv = generateRandomBytes(12);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    version: 1,
    kdf: {
      algorithm: 'PBKDF2-SHA256',
      iterations: 100000,
      salt: toBase64(salt)
    },
    encryption: {
      algorithm: 'AES-256-GCM',
      iv: toBase64(iv)
    },
    ciphertext: toBase64(ciphertextBuffer),
    vaultVersion,
    updatedAt: new Date().toISOString()
  };
}

// Decrypt vault envelope using derived key or passphrase
async function decryptEnvelope(envelope, keyOrPassphrase) {
  const salt = fromBase64(envelope.kdf.salt);
  const iv = fromBase64(envelope.encryption.iv);
  const ciphertext = fromBase64(envelope.ciphertext);

  let key = keyOrPassphrase;
  if (typeof keyOrPassphrase === 'string') {
    key = await deriveMasterKey(keyOrPassphrase, salt);
  }

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return { items: JSON.parse(dec.decode(decryptedBuffer)), key, salt };
}

// Fetch remote encrypted envelope from web app backend
async function fetchRemoteEnvelope(email, apiOrigin) {
  const url = `${apiOrigin}/api/vault?email=${encodeURIComponent(email)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to reach Keyhouse backend: ' + res.statusText);
  }
  return await res.json();
}

// Sync / upload encrypted envelope to web app backend
async function uploadRemoteEnvelope(envelope, email, apiOrigin) {
  const url = `${apiOrigin}/api/vault/sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: email,
      envelope,
      clientVaultVersion: envelope.vaultVersion,
      force: true
    })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Sync failed: ' + res.statusText);
  }
  return await res.json();
}

// Message Dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  resetAutoLock();

  switch (message.type) {
    case 'GET_STATUS': {
      sendResponse({
        isUnlocked: sessionState.isUnlocked,
        userEmail: sessionState.userEmail,
        vaultVersion: sessionState.vaultVersion,
        itemCount: sessionState.items.length,
        apiOrigin: sessionState.apiOrigin,
        inactivityLimitMinutes: sessionState.inactivityLimitMinutes
      });
      break;
    }

    case 'LOGIN_AND_UNLOCK': {
      const email = (message.email || 'jobachx31@gmail.com').toLowerCase().trim();
      const passphrase = (message.passphrase || '').trim();
      const apiOrigin = (message.apiOrigin || DEFAULT_ORIGIN).replace(/\/+$/, '');

      if (!passphrase) {
        sendResponse({ success: false, error: 'Passphrase is required.' });
        return true;
      }

      fetchRemoteEnvelope(email, apiOrigin)
        .then(async (data) => {
          let envelope = data && data.envelope;
          let items = [];
          let key, salt;

          if (envelope && envelope.ciphertext) {
            // Decrypt existing vault from server
            try {
              const res = await decryptEnvelope(envelope, passphrase);
              items = res.items;
              key = res.key;
              salt = res.salt;
            } catch (decErr) {
              sendResponse({ success: false, error: 'Incorrect passphrase or corrupted encrypted vault.' });
              return;
            }
          } else {
            // New user vault initialization on server
            salt = generateRandomBytes(16);
            key = await deriveMasterKey(passphrase, salt);
            items = [];
            envelope = await encryptVault(items, key, salt, 1);
            await uploadRemoteEnvelope(envelope, email, apiOrigin);
          }

          // Populate active session
          sessionState.isUnlocked = true;
          sessionState.masterKey = key;
          sessionState.currentSalt = salt;
          sessionState.items = items;
          sessionState.userEmail = email;
          sessionState.vaultVersion = envelope.vaultVersion || 1;
          sessionState.apiOrigin = apiOrigin;

          // Cache in local storage for quick subsequent re-authentication
          chrome.storage.local.set({
            userEmail: email,
            apiOrigin,
            encryptedEnvelope: envelope
          });

          sendResponse({
            success: true,
            userEmail: email,
            count: items.length,
            vaultVersion: sessionState.vaultVersion
          });
        })
        .catch((err) => {
          console.error('[Databytes Keyhouse] Login error:', err);
          sendResponse({ success: false, error: err.message || 'Network error connecting to backend.' });
        });

      return true;
    }

    case 'LOCK_VAULT': {
      lockVault();
      sendResponse({ success: true });
      break;
    }

    case 'GET_MATCHING_LOGINS': {
      if (!sessionState.isUnlocked) {
        sendResponse({ isUnlocked: false, logins: [] });
        return;
      }

      const activeUrl = message.url || (sender.tab && sender.tab.url);
      if (!activeUrl) {
        sendResponse({ isUnlocked: true, logins: [] });
        return;
      }

      const matches = sessionState.items
        .filter((item) => item.type === 'login' && item.fields && item.fields.url)
        .filter((item) => matchesOrigin(item.fields.url, activeUrl))
        .map((item) => ({
          id: item.id,
          name: item.name,
          username: item.fields.username || '',
          password: item.fields.password || item.fields.key || '',
          url: item.fields.url || ''
        }));

      sendResponse({ isUnlocked: true, logins: matches });
      break;
    }

    case 'CHECK_EXISTING_LOGIN': {
      if (!sessionState.isUnlocked) {
        sendResponse({ exists: false, isUnlocked: false });
        return;
      }
      const activeUrl = message.url || '';
      const username = (message.username || '').toLowerCase().trim();
      const password = message.password || '';

      const exists = sessionState.items.some((item) => {
        if (item.type !== 'login' || !item.fields) return false;
        const hostMatches = matchesOrigin(item.fields.url || '', activeUrl);
        const userMatches = (item.fields.username || '').toLowerCase().trim() === username;
        const passMatches = (item.fields.password || item.fields.key || '') === password;
        return hostMatches && (userMatches || passMatches);
      });

      sendResponse({ exists, isUnlocked: true });
      break;
    }

    case 'SAVE_NEW_LOGIN': {
      if (!sessionState.isUnlocked || !sessionState.masterKey || !sessionState.currentSalt) {
        sendResponse({
          success: false,
          error: 'Vault is locked. Open the Keyhouse extension to unlock and save.'
        });
        return;
      }

      const { url, username, password, siteName } = message;
      if (!password) {
        sendResponse({ success: false, error: 'Password cannot be empty.' });
        return;
      }

      const now = new Date().toISOString();
      const hostname = extractHostname(url);
      const displayName = siteName || hostname || 'New Login';

      // Check if item already exists for this URL & username
      const existingIdx = sessionState.items.findIndex((item) => {
        return (
          item.type === 'login' &&
          item.fields &&
          matchesOrigin(item.fields.url || '', url) &&
          (item.fields.username || '').toLowerCase().trim() === (username || '').toLowerCase().trim()
        );
      });

      let updatedItems = [...sessionState.items];
      let savedItem;

      if (existingIdx >= 0) {
        // Update password for existing entry
        const existing = updatedItems[existingIdx];
        savedItem = {
          ...existing,
          fields: {
            ...existing.fields,
            password: password.trim(),
            key: password.trim()
          },
          updatedAt: now
        };
        updatedItems[existingIdx] = savedItem;
      } else {
        // Create new login entry
        savedItem = {
          id: 'item_' + Math.random().toString(36).substring(2, 10),
          type: 'login',
          name: displayName,
          fields: {
            url: url || 'https://' + hostname,
            username: (username || '').trim(),
            password: password.trim(),
            key: password.trim()
          },
          notes: 'Captured by Keyhouse extension on ' + new Date().toLocaleDateString(),
          createdAt: now,
          updatedAt: now
        };
        updatedItems = [savedItem, ...updatedItems];
      }

      const newVersion = sessionState.vaultVersion + 1;

      encryptVault(updatedItems, sessionState.masterKey, sessionState.currentSalt, newVersion)
        .then((envelope) => {
          sessionState.items = updatedItems;
          sessionState.vaultVersion = newVersion;

          // Upload directly to shared backend
          return uploadRemoteEnvelope(envelope, sessionState.userEmail, sessionState.apiOrigin)
            .then(() => {
              chrome.storage.local.set({ encryptedEnvelope: envelope });
              sendResponse({ success: true, item: savedItem });
            });
        })
        .catch((err) => {
          console.error('[Databytes Keyhouse] Failed to save credential:', err);
          sendResponse({ success: false, error: err.message || 'Encryption/Sync failed.' });
        });

      return true;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }
});

console.log('[Databytes Keyhouse] Background service worker initialized with shared backend sync');
