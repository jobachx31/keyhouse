/**
 * Databytes Keyhouse — Chrome Extension Packager & Source Bundler
 *
 * Provides client-side ZIP packaging using JSZip with zero network dependency,
 * ensuring seamless and uncorrupted extension downloads in sandboxed iframes.
 * Fully synchronized with the Databytes Keyhouse Express storage backend.
 */

import JSZip from 'jszip';

export const ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABXElEQVR4nO2WsU4CQRCGP8Mh' +
  'GgNtbKzsbOzsbOzt7OzsbOwsre2tbCzsbCzsbOz8N7MLXFzgdYmXk+5n38zM7OzO/Hfv7kJAQEBAYJzYABp5Pweu837ZtG0P' +
  'WAFX+e8A7/k6A34Fk+wBfWB3qAEoACeA3z4A/F4D7bweAA81799q9reB2/n/AH7k6wh4L5v+rGbnHdgC4g+Av+F8B9w1bfmC' +
  '120Fk2wAbeChYf8Z2ANv8nUG/NWyT4B+3v8A7oH/A3AF/K1l9wB4rnm3h23/vM8fAK81729qdtzCq2YfeG/Y3wPv5f0Q+Kxl' +
  'FwE9/i8AD8C3/J837f4A3Dft/wS4L5ueAr1/ANwDv9fAO/Be3q/ydQ+s/0D/ALwCT+X9Evheto+A16b9HwG3NW/3gPvf7R4Q' +
  'EBAQEBBA/AJ+v20s6UeY3wAAAABJRU5ErkJggg==';

export function getExtensionFiles(currentOrigin?: string) {
  const origin = currentOrigin || (typeof window !== 'undefined' ? window.location.origin : '');

  const manifest = JSON.stringify(
    {
      manifest_version: 3,
      name: 'Databytes Keyhouse',
      version: '1.2.0',
      description: 'Zero-knowledge password manager with origin autofill, sign-up detection, and instant web vault sync.',
      permissions: ['storage', 'activeTab', 'scripting'],
      host_permissions: ['<all_urls>'],
      action: {
        default_popup: 'popup.html',
        default_icon: {
          '16': 'icons/icon16.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png',
        },
      },
      background: {
        service_worker: 'background.js',
        type: 'module',
      },
      content_scripts: [
        {
          matches: ['<all_urls>'],
          js: ['content.js'],
          run_at: 'document_idle',
        },
      ],
      icons: {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
    },
    null,
    2
  );

  const background = `/**
 * Databytes Keyhouse — Chrome Extension Manifest V3 Background Service Worker
 *
 * Handles zero-knowledge encryption, shared backend sync with the web app,
 * in-memory decrypted credentials while unlocked, origin matching, and auto-lock.
 */

const DEFAULT_ORIGIN = '${origin}';

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
  const url = \`\${apiOrigin}/api/vault?email=\${encodeURIComponent(email)}\`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to reach Keyhouse backend: ' + res.statusText);
  }
  return await res.json();
}

// Sync / upload encrypted envelope to web app backend
async function uploadRemoteEnvelope(envelope, email, apiOrigin) {
  const url = \`\${apiOrigin}/api/vault/sync\`;
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
      const apiOrigin = (message.apiOrigin || DEFAULT_ORIGIN).replace(/\\/+$/, '');

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
`;

  const content = `/**
 * Databytes Keyhouse — Content Script
 *
 * 1. Detects sign-in forms on active webpage and displays an autofill popup.
 * 2. Detects sign-up and password submissions and displays a "Save to Vault" prompt.
 */

(function () {
  let matchingLogins = [];
  let isUnlocked = false;
  let activeAutofillBanner = null;
  let activeSavePrompt = null;

  // -------------------------------------------------------------
  // 1. SIGN-IN DETECTION & AUTOFILL POPUP
  // -------------------------------------------------------------

  function checkAndAttachAutofill() {
    try {
      chrome.runtime.sendMessage(
        { type: 'GET_MATCHING_LOGINS', url: window.location.href },
        (response) => {
          if (chrome.runtime.lastError || !response) return;

          isUnlocked = response.isUnlocked;
          matchingLogins = response.logins || [];

          if (isUnlocked && matchingLogins.length > 0) {
            showAutofillBannerIfLoginForm();
            injectInlineKeyIcons();
          }
        }
      );
    } catch (e) {
      // Extension context invalidated or not ready
    }
  }

  function findPasswordInputs() {
    return Array.from(document.querySelectorAll('input[type="password"]')).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    });
  }

  function showAutofillBannerIfLoginForm() {
    const passwordInputs = findPasswordInputs();
    if (passwordInputs.length === 0) return;
    if (document.getElementById('keyhouse-autofill-banner')) return;

    const firstMatch = matchingLogins[0];
    if (!firstMatch) return;

    const banner = document.createElement('div');
    banner.id = 'keyhouse-autofill-banner';
    banner.style.cssText = \`
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #FFFFFF;
      border: 1px solid #E5E5E5;
      border-radius: 14px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: 'Funnel Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #171717;
      max-width: 380px;
      animation: keyhouseSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    \`;

    banner.innerHTML = \`
      <style>
        @keyframes keyhouseSlideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      <div style="width: 32px; height: 32px; border-radius: 8px; background: #008AD6; display: flex; align-items: center; justify-content: center; color: white; shrink: 0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="7.5" cy="15.5" r="5.5"></circle>
          <path d="m21 2-9.6 9.6"></path>
          <path d="m15.5 7.5 3 3L22 7l-3-3"></path>
        </svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 13px; color: #171717; line-height: 1.2;">Autofill Login?</div>
        <div style="font-size: 11px; color: #737373; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
          \${escapeHtml(firstMatch.username || firstMatch.name)}
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="keyhouse-autofill-btn" style="background: #171717; color: white; border: none; border-radius: 8px; padding: 7px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s;">
          Autofill
        </button>
        <button id="keyhouse-autofill-close" style="background: transparent; border: none; color: #737373; font-size: 16px; cursor: pointer; padding: 4px; display: flex; align-items: center;">
          ✕
        </button>
      </div>
    \`;

    document.body.appendChild(banner);
    activeAutofillBanner = banner;

    banner.querySelector('#keyhouse-autofill-btn').addEventListener('click', () => {
      autofillCredentials(firstMatch.username, firstMatch.password);
      const btn = banner.querySelector('#keyhouse-autofill-btn');
      btn.textContent = 'Filled ✓';
      btn.style.background = '#008AD6';
      setTimeout(() => {
        banner.remove();
      }, 1200);
    });

    banner.querySelector('#keyhouse-autofill-close').addEventListener('click', () => {
      banner.remove();
    });
  }

  function autofillCredentials(username, password) {
    const passwordInputs = findPasswordInputs();
    if (passwordInputs.length === 0) return;

    passwordInputs.forEach((passInput) => {
      passInput.value = password;
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Find username / email field in the same form or preceding
      const form = passInput.closest('form') || document;
      const userInput = form.querySelector(
        'input[type="text"], input[type="email"], input[autocomplete*="username"], input[name*="user" i], input[name*="email" i], input[id*="user" i]'
      );
      if (userInput && username) {
        userInput.value = username;
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        userInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  function injectInlineKeyIcons() {
    const passwordInputs = document.querySelectorAll('input[type="password"]:not([data-keyhouse-injected])');
    passwordInputs.forEach((input) => {
      input.setAttribute('data-keyhouse-injected', 'true');
      input.addEventListener('focus', () => {
        if (matchingLogins.length > 0 && isUnlocked) {
          showAutofillBannerIfLoginForm();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 2. SIGN-UP / PASSWORD SUBMIT DETECTION & SAVE TO VAULT PROMPT
  // -------------------------------------------------------------

  let capturedCredentials = null;

  function captureFormInputs(formOrContainer) {
    const passInput = formOrContainer.querySelector('input[type="password"]');
    if (!passInput || !passInput.value.trim()) return null;

    const userInput = formOrContainer.querySelector(
      'input[type="email"], input[type="text"], input[autocomplete*="username"], input[name*="user" i], input[name*="email" i], input[id*="user" i]'
    );

    return {
      username: userInput ? userInput.value.trim() : '',
      password: passInput.value.trim()
    };
  }

  function onFormSubmitDetected(e) {
    const target = e.target;
    let creds = null;

    if (target && target.tagName === 'FORM') {
      creds = captureFormInputs(target);
    } else if (target && (target.tagName === 'BUTTON' || target.tagName === 'INPUT')) {
      const form = target.closest('form');
      if (form) {
        creds = captureFormInputs(form);
      } else {
        const pass = document.querySelector('input[type="password"]');
        if (pass && pass.value) {
          creds = captureFormInputs(document.body);
        }
      }
    }

    if (creds && creds.password) {
      capturedCredentials = creds;
      // Prompt user to save after form submits
      setTimeout(() => {
        verifyAndPromptSave(creds.username, creds.password);
      }, 300);
    }
  }

  function verifyAndPromptSave(username, password) {
    if (!password) return;

    try {
      chrome.runtime.sendMessage(
        {
          type: 'CHECK_EXISTING_LOGIN',
          url: window.location.href,
          username,
          password
        },
        (res) => {
          if (chrome.runtime.lastError || !res) return;
          // If this login is not already stored, show the save prompt
          if (!res.exists) {
            showSaveToVaultModal(username, password);
          }
        }
      );
    } catch (e) {}
  }

  function showSaveToVaultModal(username, password) {
    if (document.getElementById('keyhouse-save-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'keyhouse-save-modal';
    modal.style.cssText = \`
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      background: #FFFFFF;
      border: 1px solid #E5E5E5;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      padding: 18px 20px;
      font-family: 'Funnel Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #171717;
      width: 340px;
      animation: keyhouseSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    \`;

    modal.innerHTML = \`
      <style>
        @keyframes keyhouseSlideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
      <div style="display: flex; items-center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 26px; height: 26px; border-radius: 6px; background: #008AD6; display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="7.5" cy="15.5" r="5.5"></circle>
              <path d="m21 2-9.6 9.6"></path>
              <path d="m15.5 7.5 3 3L22 7l-3-3"></path>
            </svg>
          </div>
          <span style="font-weight: 700; font-size: 13px; color: #171717;">Databytes Keyhouse</span>
        </div>
        <button id="keyhouse-save-close" style="background: transparent; border: none; color: #737373; font-size: 16px; cursor: pointer; padding: 2px;">
          ✕
        </button>
      </div>

      <div style="font-weight: 700; font-size: 14px; color: #171717; margin-bottom: 4px;">
        Save password to vault?
      </div>
      <div style="font-size: 11px; color: #737373; margin-bottom: 12px;">
        Encrypt and sync this login with your zero-knowledge storage backend.
      </div>

      <div style="background: #FAFAFA; border: 1px solid #E5E5E5; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-family: monospace; font-size: 12px; space-y: 6px;">
        <div style="display: flex; justify-content: space-between; color: #737373; margin-bottom: 4px;">
          <span>URL:</span>
          <span style="color: #171717; font-weight: 500;">\${window.location.hostname}</span>
        </div>
        <div style="display: flex; justify-content: space-between; color: #737373; margin-bottom: 4px;">
          <span>User:</span>
          <span style="color: #171717; font-weight: 500;">\${escapeHtml(username || 'Account')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; color: #737373;">
          <span>Pass:</span>
          <span id="keyhouse-pass-masked" style="color: #171717; font-weight: 500;">••••••••••••</span>
        </div>
      </div>

      <div id="keyhouse-save-status" style="font-size: 11px; color: #008AD6; margin-bottom: 10px; display: none;"></div>

      <div style="display: flex; gap: 8px;">
        <button id="keyhouse-not-now-btn" style="flex: 1; background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 8px; color: #171717; padding: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Not Now
        </button>
        <button id="keyhouse-save-btn" style="flex: 1.5; background: #171717; color: white; border: none; border-radius: 8px; padding: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Save to Vault
        </button>
      </div>
    \`;

    document.body.appendChild(modal);
    activeSavePrompt = modal;

    const saveBtn = modal.querySelector('#keyhouse-save-btn');
    const notNowBtn = modal.querySelector('#keyhouse-not-now-btn');
    const closeBtn = modal.querySelector('#keyhouse-save-close');
    const statusDiv = modal.querySelector('#keyhouse-save-status');

    saveBtn.addEventListener('click', () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      chrome.runtime.sendMessage(
        {
          type: 'SAVE_NEW_LOGIN',
          url: window.location.href,
          username: username,
          password: password,
          siteName: document.title || window.location.hostname
        },
        (res) => {
          if (res && res.success) {
            statusDiv.textContent = '✓ Encrypted and saved to your Keyhouse vault!';
            statusDiv.style.color = '#008AD6';
            statusDiv.style.display = 'block';
            saveBtn.textContent = 'Saved ✓';
            setTimeout(() => {
              modal.remove();
            }, 2000);
          } else {
            statusDiv.textContent = res.error || 'Failed to save to vault.';
            statusDiv.style.color = '#DC2626';
            statusDiv.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save to Vault';
          }
        }
      );
    });

    notNowBtn.addEventListener('click', () => modal.remove());
    closeBtn.addEventListener('click', () => modal.remove());
  }

  // Intercept form submissions
  document.addEventListener('submit', onFormSubmitDetected, true);
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, input[type="submit"]');
    if (btn) {
      const text = (btn.innerText || btn.value || '').toLowerCase();
      if (
        text.includes('sign in') ||
        text.includes('log in') ||
        text.includes('sign up') ||
        text.includes('register') ||
        text.includes('submit') ||
        text.includes('continue')
      ) {
        onFormSubmitDetected(e);
      }
    }
  }, true);

  function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // Initial check on page load
  checkAndAttachAutofill();
  setInterval(checkAndAttachAutofill, 3000);
})();
`;

  const popupHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Funnel+Sans:ital,wght@0,300..800;1,300..800&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { width: 360px; min-height: 480px; background-color: #ffffff; color: #171717; font-family: 'Funnel Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; display: flex; flex-direction: column; }
      .credential-meta, #generatedPass, .badge-origin, code, pre { font-family: 'Space Mono', monospace !important; }
      header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background-color: #FAFAFA; border-bottom: 1px solid #E5E5E5; }
      .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: #171717; }
      .brand-icon { width: 22px; height: 22px; border-radius: 6px; background: #008AD6; color: white; display: flex; align-items: center; justify-content: center; }
      .btn-lock { background: #FFFFFF; border: 1px solid #E5E5E5; color: #737373; border-radius: 8px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; }
      .btn-lock:hover { background: #F5F5F5; color: #171717; }
      .view-container { flex: 1; padding: 18px; overflow-y: auto; }
      .hidden { display: none !important; }
      label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; margin-bottom: 6px; }
      input[type="text"], input[type="email"], input[type="password"] { width: 100%; background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 10px; color: #171717; padding: 10px 12px; font-size: 13px; outline: none; margin-bottom: 12px; font-family: 'Funnel Sans', sans-serif; transition: border-color 0.15s; }
      input[type="password"] { font-family: 'Space Mono', monospace; }
      input:focus { border-color: #008AD6; ring: 2px solid rgba(0, 138, 214, 0.2); }
      .btn-primary { width: 100%; background: #171717; color: #FFFFFF; border: none; border-radius: 10px; font-weight: 600; font-size: 13px; padding: 11px; cursor: pointer; transition: background 0.15s; font-family: 'Funnel Sans', sans-serif; }
      .btn-primary:hover { background: #262626; }
      .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      .credential-card { background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; }
      .credential-title { font-weight: 700; color: #171717; font-size: 13px; margin-bottom: 4px; }
      .credential-meta { font-size: 11px; color: #737373; margin-bottom: 10px; font-family: 'Space Mono', monospace; word-break: break-all; }
      .btn-group { display: flex; gap: 6px; }
      .btn-secondary { flex: 1; background: #FFFFFF; border: 1px solid #E5E5E5; border-radius: 8px; color: #171717; padding: 6px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Funnel Sans', sans-serif; }
      .btn-secondary:hover { background: #F5F5F5; }
      footer { padding: 12px 18px; background: #FAFAFA; border-top: 1px solid #E5E5E5; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #737373; }
      footer a { color: #008AD6; text-decoration: none; font-weight: 600; }
      footer a:hover { text-decoration: underline; }
      .badge-origin { display: inline-block; font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 600; color: #008AD6; margin-bottom: 12px; word-break: break-all; background: #EBF5FB; padding: 4px 8px; border-radius: 6px; border: 1px solid #BCE1F5; }
      .status-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; color: #008AD6; background: #EBF5FB; border: 1px solid #BCE1F5; border-radius: 4px; padding: 2px 6px; text-transform: uppercase; }
      .info-box { background: #FAFAFA; border: 1px solid #E5E5E5; border-radius: 10px; padding: 10px 12px; font-size: 11px; color: #737373; line-height: 1.4; margin-bottom: 14px; }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        <div class="brand-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="7.5" cy="15.5" r="5.5"></circle>
            <path d="m21 2-9.6 9.6"></path>
            <path d="m15.5 7.5 3 3L22 7l-3-3"></path>
          </svg>
        </div>
        <span>Keyhouse</span>
      </div>
      <button id="lockVaultBtn" class="btn-lock hidden" title="Lock Vault">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>Lock</span>
      </button>
    </header>

    <!-- Locked / Sign-In View -->
    <div id="lockedView" class="view-container">
      <div style="text-align: center; margin: 10px 0 18px;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: #EBF5FB; border: 1px solid #BCE1F5; color: #008AD6; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h3 style="font-size: 15px; font-weight: 700; color: #171717;">Log In to Keyhouse</h3>
        <p style="color: #737373; font-size: 12px; margin-top: 4px;">Syncs with your Web Vault storage backend</p>
      </div>

      <div class="info-box">
        Enter your account email and client passphrase to retrieve and decrypt your encrypted vault.
      </div>

      <label>Account Email</label>
      <input type="email" id="emailInput" placeholder="user@gmail.com" value="jobachx31@gmail.com" />

      <label>Vault Passphrase</label>
      <div style="position: relative;">
        <input type="password" id="passphraseInput" placeholder="Client passphrase" style="margin-bottom: 8px; padding-right: 36px;" />
        <button type="button" id="togglePassEye" style="position: absolute; right: 10px; top: 12px; background: none; border: none; cursor: pointer; color: #737373; font-size: 12px;">
          👁
        </button>
      </div>

      <div style="margin-bottom: 14px;">
        <label style="font-size: 10px; color: #A3A3A3;">Connected Storage Backend</label>
        <input type="text" id="apiOriginInput" value="${origin}" style="font-size: 11px; font-family: monospace; padding: 6px 10px; color: #737373;" />
      </div>

      <button id="unlockBtn" class="btn-primary">Sign In & Unlock Vault</button>
      <div id="unlockError" style="color: #DC2626; font-size: 11px; margin-top: 10px; text-align: center; line-height: 1.4;" class="hidden"></div>
    </div>

    <!-- Unlocked Logins View -->
    <div id="unlockedView" class="view-container hidden">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #E5E5E5; pb-3;">
        <div>
          <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #737373;">ACTIVE SITE</div>
          <div id="currentOrigin" class="badge-origin" style="margin-top: 4px; margin-bottom: 0;">Detecting...</div>
        </div>
        <div class="status-pill">
          <span>● Synced</span>
        </div>
      </div>

      <div id="loginList"></div>
    </div>

    <footer>
      <span>Zero-Knowledge AES-GCM</span>
      <a href="${origin}" target="_blank" id="openWebVault">Open Web Vault &rarr;</a>
    </footer>

    <script src="popup.js"></script>
  </body>
</html>
`;

  const popupJs = `/**
 * Databytes Keyhouse — Popup Logic
 *
 * Implements login via account email + passphrase, connects to the shared storage backend,
 * decrypts credentials locally, and provides 1-click autofill for the active webpage.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const lockedView = document.getElementById('lockedView');
  const unlockedView = document.getElementById('unlockedView');
  const emailInput = document.getElementById('emailInput');
  const passphraseInput = document.getElementById('passphraseInput');
  const togglePassEye = document.getElementById('togglePassEye');
  const apiOriginInput = document.getElementById('apiOriginInput');
  const unlockBtn = document.getElementById('unlockBtn');
  const unlockError = document.getElementById('unlockError');
  const lockVaultBtn = document.getElementById('lockVaultBtn');
  const currentOrigin = document.getElementById('currentOrigin');
  const loginList = document.getElementById('loginList');

  let activeTabUrl = '';

  // Toggle show/hide passphrase
  togglePassEye.addEventListener('click', () => {
    if (passphraseInput.type === 'password') {
      passphraseInput.type = 'text';
      togglePassEye.textContent = '🔒';
    } else {
      passphraseInput.type = 'password';
      togglePassEye.textContent = '👁';
    }
  });

  // Pre-load saved email from storage
  chrome.storage.local.get(['userEmail', 'apiOrigin'], (data) => {
    if (data && data.userEmail) {
      emailInput.value = data.userEmail;
    }
    if (data && data.apiOrigin) {
      apiOriginInput.value = data.apiOrigin;
    }
  });

  // Query active tab URL / IP
  if (chrome && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        activeTabUrl = tabs[0].url;
        try {
          const u = new URL(activeTabUrl);
          currentOrigin.textContent = u.hostname;
        } catch (e) {
          currentOrigin.textContent = activeTabUrl;
        }
      }
      checkStatus();
    });
  } else {
    checkStatus();
  }

  function checkStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.isUnlocked) {
        showUnlockedView(response.userEmail);
      } else {
        showLockedView();
      }
    });
  }

  function showLockedView() {
    lockedView.classList.remove('hidden');
    unlockedView.classList.add('hidden');
    lockVaultBtn.classList.add('hidden');
    passphraseInput.focus();
  }

  function showUnlockedView(email) {
    lockedView.classList.add('hidden');
    unlockedView.classList.remove('hidden');
    lockVaultBtn.classList.remove('hidden');

    loadMatchingLogins();
  }

  function loadMatchingLogins() {
    chrome.runtime.sendMessage({ type: 'GET_MATCHING_LOGINS', url: activeTabUrl }, (res) => {
      loginList.innerHTML = '';

      if (!res || !res.logins || res.logins.length === 0) {
        loginList.innerHTML = \`
          <div style="text-align: center; color: #737373; padding: 30px 10px;">
            <div style="font-weight: 700; color: #171717; font-size: 13px; margin-bottom: 4px;">No Logins for this Site</div>
            <p style="font-size: 11px; line-height: 1.4;">When you sign up or log in on this webpage, Keyhouse will automatically ask to save your credentials to your vault.</p>
          </div>
        \`;
        return;
      }

      res.logins.forEach((login) => {
        const card = document.createElement('div');
        card.className = 'credential-card';
        card.innerHTML = \`
          <div class="credential-title">\${escapeHtml(login.name || 'Login')}</div>
          <div class="credential-meta">\${escapeHtml(login.username || 'No username')}</div>
          <div class="btn-group">
            <button class="btn-secondary copy-user-btn">Copy User</button>
            <button class="btn-secondary copy-pass-btn">Copy Pass</button>
            <button class="btn-primary fill-btn" style="padding: 6px 12px; font-size: 11px; width: auto; flex: 1.2;">Autofill</button>
          </div>
        \`;

        card.querySelector('.copy-user-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(login.username);
          flashButton(card.querySelector('.copy-user-btn'), 'Copied!');
        });

        card.querySelector('.copy-pass-btn').addEventListener('click', () => {
          navigator.clipboard.writeText(login.password);
          flashButton(card.querySelector('.copy-pass-btn'), 'Copied!');
        });

        card.querySelector('.fill-btn').addEventListener('click', () => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
              chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (u, p) => {
                  const passInput = document.querySelector('input[type="password"]');
                  if (passInput) {
                    passInput.value = p;
                    passInput.dispatchEvent(new Event('input', { bubbles: true }));
                    passInput.dispatchEvent(new Event('change', { bubbles: true }));

                    const form = passInput.closest('form') || document;
                    const userInput = form.querySelector('input[type="text"], input[type="email"], input[autocomplete*="username"]');
                    if (userInput && u) {
                      userInput.value = u;
                      userInput.dispatchEvent(new Event('input', { bubbles: true }));
                      userInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }
                },
                args: [login.username, login.password]
              });
              flashButton(card.querySelector('.fill-btn'), 'Filled ✓');
            }
          });
        });

        loginList.appendChild(card);
      });
    });
  }

  function flashButton(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    setTimeout(() => {
      btn.textContent = orig;
    }, 1200);
  }

  unlockBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const pass = passphraseInput.value.trim();
    const apiOrigin = apiOriginInput.value.trim();

    if (!email) {
      unlockError.textContent = 'Please enter your account email.';
      unlockError.classList.remove('hidden');
      return;
    }

    if (!pass) {
      unlockError.textContent = 'Please enter your vault unlock passphrase.';
      unlockError.classList.remove('hidden');
      return;
    }

    unlockError.classList.add('hidden');
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Connecting & Decrypting...';

    chrome.runtime.sendMessage(
      {
        type: 'LOGIN_AND_UNLOCK',
        email,
        passphrase: pass,
        apiOrigin
      },
      (res) => {
        unlockBtn.disabled = false;
        unlockBtn.textContent = 'Sign In & Unlock Vault';

        if (res && res.success) {
          passphraseInput.value = '';
          showUnlockedView(email);
        } else {
          unlockError.textContent = (res && res.error) || 'Incorrect passphrase or backend connection failed.';
          unlockError.classList.remove('hidden');
        }
      }
    );
  });

  lockVaultBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOCK_VAULT' }, () => {
      showLockedView();
    });
  });

  function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
`;

  const readme = `# Databytes Keyhouse — Chrome Extension (Manifest V3)

This is the official Chrome extension companion for **Databytes Keyhouse**, synchronized to the same zero-knowledge storage backend as your Web Vault.

## Features
- **Direct Storage Backend Sync**: Log in directly from the extension with your account email and passphrase. The extension fetches your encrypted envelope from the backend and derives your AES-256-GCM master key client-side.
- **Smart Sign-In Autofill**: Detects login forms on active web pages and provides a seamless 1-click in-page autofill popup.
- **Automatic Sign-Up Detection**: Automatically detects when you create or submit a new password, bringing up a non-intrusive prompt to save it directly to your Keyhouse vault.
- **Zero-Knowledge Architecture**: Encryption and decryption happen locally using Web Cryptography. Plaintext secrets never leave your device.
- **15-Minute Auto-Lock**: Master keys and credentials automatically clear from memory after 15 minutes of inactivity.
`;

  return {
    manifest,
    background,
    content,
    popupHtml,
    popupJs,
    readme,
    iconBase64: ICON_BASE64,
  };
}

/**
 * Builds the complete uncompressed ZIP Blob containing all extension files
 */
export async function generateExtensionZipBlob(origin?: string): Promise<Blob> {
  const files = getExtensionFiles(origin);
  const zip = new JSZip();

  // Root manifest
  zip.file('manifest.json', files.manifest);

  // Background service worker
  zip.file('background.js', files.background);

  // Content script
  zip.file('content.js', files.content);

  // Popup UI
  zip.file('popup.html', files.popupHtml);
  zip.file('popup.js', files.popupJs);

  // Readme
  zip.file('README.md', files.readme);

  // Icons folder with binary PNGs
  const iconsFolder = zip.folder('icons');
  if (iconsFolder) {
    const binary = atob(files.iconBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    iconsFolder.file('icon16.png', bytes, { binary: true });
    iconsFolder.file('icon48.png', bytes, { binary: true });
    iconsFolder.file('icon128.png', bytes, { binary: true });
  }

  // Generate ZIP using standard DEFLATE compression
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6,
    },
    mimeType: 'application/zip',
  });

  return blob;
}

/**
 * Triggers a direct browser download of the verified ZIP blob
 */
export async function downloadExtensionPackage(origin?: string): Promise<{ size: number }> {
  const blob = await generateExtensionZipBlob(origin);
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'databytes-keyhouse-extension.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up object URL after download trigger
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10000);

  return { size: blob.size };
}
