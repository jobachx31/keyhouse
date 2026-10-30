/**
 * Databytes Keyhouse — Vault Context & State Store
 *
 * Implements client-side state management, zero-knowledge encryption/decryption,
 * local storage caching of encrypted envelopes, auto-lock timers, and clipboard security.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  VaultItem,
  EncryptedEnvelope,
  UserSession,
  SyncStatus,
  VaultItemType,
} from '../types/vault';
import {
  deriveMasterKey,
  encryptVault,
  decryptVault,
  generateRandomBytes,
  generateRecoveryPhrase,
  deriveKeyFromRecovery,
  toBase64,
  fromBase64,
} from '../crypto/vaultCrypto';

interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface VaultContextType {
  session: UserSession | null;
  loginWithGoogle: (customEmail?: string, customName?: string) => Promise<void>;
  logout: () => void;
  isUnlocked: boolean;
  vaultItems: VaultItem[];
  vaultVersion: number;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  hasExistingVault: boolean;
  inactivityMinutes: number;
  setInactivityMinutes: (minutes: number) => void;
  lockOnTabBlur: boolean;
  setLockOnTabBlur: (lock: boolean) => void;
  requireBiometric: boolean;
  setRequireBiometric: (req: boolean) => void;
  unlockVault: (passphrase: string) => Promise<boolean>;
  setupNewVault: (passphrase: string) => Promise<{ recoveryPhrase: string[] }>;
  recoverVault: (phraseWords: string[]) => Promise<boolean>;
  lockVault: () => void;
  saveItem: (item: Partial<VaultItem>, existingId?: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  syncWithServer: () => Promise<void>;
  copyToClipboard: (text: string, label: string) => void;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
  exportVault: (format: 'encrypted-json' | 'plaintext-json' | 'plaintext-csv') => string;
  importVault: (content: string, isEncrypted: boolean, passphrase?: string) => Promise<number>;
  activeRecoveryPhrase: string[] | null;
}

const VaultContext = createContext<VaultContextType | null>(null);

const STORAGE_SESSION_KEY = 'databytes_keyhouse_session';
const STORAGE_SETTINGS_KEY = 'databytes_keyhouse_settings';
const STORAGE_ENVELOPE_KEY = 'databytes_keyhouse_envelope';

// Default starter items for new vaults (encrypted immediately with user's key)
const STARTER_ITEMS: Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    type: 'login',
    name: 'GitHub',
    notes: 'Personal development account with 2FA enabled.',
    fields: {
      url: 'https://github.com',
      username: 'jobachx31',
      key: 'kh_' + Math.random().toString(36).substring(2, 12) + '!G8',
      password: 'kh_' + Math.random().toString(36).substring(2, 12) + '!G8',
    },
  },
  {
    type: 'device',
    name: 'Production Gateway Server',
    notes: 'Main hardware gateway and Linux edge server access credentials.',
    fields: {
      url: 'https://gateway.internal.network',
      username: 'deploy',
      key: 'gw_auth_' + Math.random().toString(36).substring(2, 10) + '#99',
    },
  },
  {
    type: 'note',
    name: 'Master API Signing Secret',
    notes: 'Primary webhook HMAC secret and root signing certificate seed.',
    fields: {
      username: 'sysadmin',
      key: 'sec_live_9941a8bc43f820aa7b3e028',
    },
  },
];

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication & Session
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SESSION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Vault Unlock & In-Memory State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [currentSalt, setCurrentSalt] = useState<Uint8Array | null>(null);
  const [currentEnvelope, setCurrentEnvelope] = useState<EncryptedEnvelope | null>(null);
  const [hasExistingVault, setHasExistingVault] = useState<boolean>(false);
  const [vaultVersion, setVaultVersion] = useState<number>(1);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [activeRecoveryPhrase, setActiveRecoveryPhrase] = useState<string[] | null>(null);

  // Settings
  const [inactivityMinutes, setInactivityMinutesState] = useState<number>(15);
  const [lockOnTabBlur, setLockOnTabBlurState] = useState<boolean>(false);
  const [requireBiometric, setRequireBiometricState] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Timer Ref
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const clipboardTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load Settings from LocalStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.inactivityMinutes) setInactivityMinutesState(parsed.inactivityMinutes);
        if (parsed.lockOnTabBlur !== undefined) setLockOnTabBlurState(parsed.lockOnTabBlur);
        if (parsed.requireBiometric !== undefined) setRequireBiometricState(parsed.requireBiometric);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const setInactivityMinutes = (minutes: number) => {
    setInactivityMinutesState(minutes);
    saveSettings({ inactivityMinutes: minutes, lockOnTabBlur, requireBiometric });
  };

  const setLockOnTabBlur = (val: boolean) => {
    setLockOnTabBlurState(val);
    saveSettings({ inactivityMinutes, lockOnTabBlur: val, requireBiometric });
  };

  const setRequireBiometric = (val: boolean) => {
    setRequireBiometricState(val);
    saveSettings({ inactivityMinutes, lockOnTabBlur, requireBiometric: val });
  };

  function saveSettings(s: Record<string, any>) {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(s));
  }

  // Fetch encrypted envelope when session changes
  const fetchRemoteEnvelope = useCallback(async (userEmail: string) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch(`/api/vault?email=${encodeURIComponent(userEmail)}`);
      if (!res.ok) throw new Error('Failed to fetch vault');
      const data = await res.json();

      if (data && data.envelope) {
        setCurrentEnvelope(data.envelope);
        setVaultVersion(data.vaultVersion || 1);
        setHasExistingVault(true);
        setLastSyncTime(data.updatedAt || new Date().toISOString());
        localStorage.setItem(STORAGE_ENVELOPE_KEY, JSON.stringify(data.envelope));
      } else {
        // Check local cache
        const cached = localStorage.getItem(STORAGE_ENVELOPE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setCurrentEnvelope(parsed);
            setHasExistingVault(true);
          } catch {
            setHasExistingVault(false);
          }
        } else {
          setHasExistingVault(false);
        }
      }
      setSyncStatus('synced');
    } catch (err) {
      console.warn('[Sync] Could not reach sync server, checking offline cache:', err);
      const cached = localStorage.getItem(STORAGE_ENVELOPE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setCurrentEnvelope(parsed);
          setHasExistingVault(true);
        } catch {
          setHasExistingVault(false);
        }
      }
      setSyncStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (session && session.email) {
      fetchRemoteEnvelope(session.email);
    } else {
      setHasExistingVault(false);
      setCurrentEnvelope(null);
    }
  }, [session, fetchRemoteEnvelope]);

  // Lock Vault and securely purge memory
  const lockVault = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    // Purge decrypted items and master key references
    setIsUnlocked(false);
    setVaultItems([]);
    setMasterKey(null);
    setCurrentSalt(null);
    setActiveRecoveryPhrase(null);
    addToast('Vault locked. Plaintext wiped from memory.', 'info');
  }, [addToast]);

  // Reset auto-lock inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (!isUnlocked) return;
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      lockVault();
    }, inactivityMinutes * 60 * 1000);
  }, [isUnlocked, inactivityMinutes, lockVault]);

  // Activity listeners for auto-lock reset
  useEffect(() => {
    if (!isUnlocked) return;
    resetInactivityTimer();

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    const handleVisibilityChange = () => {
      if (document.hidden && lockOnTabBlur) {
        lockVault();
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isUnlocked, resetInactivityTimer, lockOnTabBlur, lockVault]);

  // Unlock existing vault with passphrase
  const unlockVault = async (passphrase: string): Promise<boolean> => {
    if (!currentEnvelope) {
      addToast('No encrypted vault envelope found to unlock.', 'error');
      return false;
    }

    try {
      const salt = fromBase64(currentEnvelope.kdf.salt);
      const key = await deriveMasterKey(passphrase, salt, currentEnvelope.kdf.iterations || 100000);
      const items = await decryptVault(currentEnvelope, key);

      setMasterKey(key);
      setCurrentSalt(salt);
      setVaultItems(items);
      setIsUnlocked(true);
      resetInactivityTimer();
      addToast(`Vault unlocked (${items.length} items decrypted locally)`, 'success');
      return true;
    } catch (err) {
      console.error('[Crypto] Unlock failed:', err);
      addToast('Incorrect vault passphrase or corrupted payload', 'error');
      return false;
    }
  };

  // Setup new vault with client-side passphrase and starter items
  const setupNewVault = async (passphrase: string): Promise<{ recoveryPhrase: string[] }> => {
    if (!session) throw new Error('Must be signed in with Google');

    const salt = generateRandomBytes(32);
    const key = await deriveMasterKey(passphrase, salt, 100000);
    const recoveryPhrase = generateRecoveryPhrase();

    const now = new Date().toISOString();
    const initialItems: VaultItem[] = STARTER_ITEMS.map((item, idx) => ({
      ...item,
      id: 'item_' + Math.random().toString(36).substring(2, 10),
      createdAt: now,
      updatedAt: now,
    }));

    const envelope = await encryptVault(initialItems, key, salt, 1);

    // Save envelope locally and sync to server
    setCurrentEnvelope(envelope);
    setMasterKey(key);
    setCurrentSalt(salt);
    setVaultItems(initialItems);
    setVaultVersion(1);
    setHasExistingVault(true);
    setIsUnlocked(true);
    setActiveRecoveryPhrase(recoveryPhrase);
    localStorage.setItem(STORAGE_ENVELOPE_KEY, JSON.stringify(envelope));

    // Upload encrypted envelope to server
    await uploadEnvelope(envelope, session.email, 1);

    addToast('Vault initialized with zero-knowledge AES-256-GCM encryption!', 'success');
    return { recoveryPhrase };
  };

  // Recover vault using 24-word recovery phrase
  const recoverVault = async (phraseWords: string[]): Promise<boolean> => {
    if (!currentEnvelope) {
      addToast('No encrypted envelope found to recover.', 'error');
      return false;
    }

    try {
      const salt = fromBase64(currentEnvelope.kdf.salt);
      const key = await deriveKeyFromRecovery(phraseWords, salt);
      const items = await decryptVault(currentEnvelope, key);

      setMasterKey(key);
      setCurrentSalt(salt);
      setVaultItems(items);
      setIsUnlocked(true);
      resetInactivityTimer();
      addToast('Vault successfully recovered via Emergency Phrase!', 'success');
      return true;
    } catch (err) {
      console.error('[Recovery] Recovery failed:', err);
      addToast('Invalid emergency recovery phrase.', 'error');
      return false;
    }
  };

  // Upload encrypted envelope to Express backend
  const uploadEnvelope = async (envelope: EncryptedEnvelope, userEmail: string, version: number) => {
    setSyncStatus('syncing');
    try {
      const res = await fetch('/api/vault/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          envelope,
          clientVaultVersion: version,
        }),
      });

      if (!res.ok) {
        if (res.status === 409) {
          setSyncStatus('conflict');
          addToast('Sync conflict detected: a newer vault version exists.', 'warning');
          return;
        }
        throw new Error('Sync endpoint failed');
      }

      const data = await res.json();
      setVaultVersion(data.vaultVersion);
      setLastSyncTime(data.updatedAt);
      setSyncStatus('synced');
      localStorage.setItem(STORAGE_ENVELOPE_KEY, JSON.stringify(envelope));
    } catch (err) {
      console.warn('[Sync] Offline or failed to sync with backend:', err);
      setSyncStatus('offline');
    }
  };

  // Save (add or update) an item in the vault
  const saveItem = async (itemData: Partial<VaultItem>, existingId?: string) => {
    if (!isUnlocked || !masterKey || !currentSalt || !session) {
      throw new Error('Vault is locked');
    }

    const now = new Date().toISOString();
    let updatedItems: VaultItem[];

    if (existingId) {
      updatedItems = vaultItems.map((item) =>
        item.id === existingId
          ? {
              ...item,
              ...itemData,
              fields: itemData.fields || item.fields,
              updatedAt: now,
            }
          : item
      );
    } else {
      const newItem: VaultItem = {
        id: 'item_' + Math.random().toString(36).substring(2, 10),
        type: (itemData.type || 'login') as VaultItemType,
        name: itemData.name || 'Untitled Entry',
        fields: itemData.fields || {},
        notes: itemData.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      updatedItems = [newItem, ...vaultItems];
    }

    setVaultItems(updatedItems);
    const newVersion = vaultVersion + 1;
    setVaultVersion(newVersion);

    // Encrypt updated items in memory
    const envelope = await encryptVault(updatedItems, masterKey, currentSalt, newVersion);
    setCurrentEnvelope(envelope);

    // Persist encrypted envelope locally and sync to backend
    await uploadEnvelope(envelope, session.email, newVersion);
    addToast(existingId ? 'Credential updated securely' : 'New credential encrypted and saved', 'success');
  };

  // Delete an item from the vault
  const deleteItem = async (id: string) => {
    if (!isUnlocked || !masterKey || !currentSalt || !session) return;

    const updatedItems = vaultItems.filter((item) => item.id !== id);
    setVaultItems(updatedItems);

    const newVersion = vaultVersion + 1;
    setVaultVersion(newVersion);

    const envelope = await encryptVault(updatedItems, masterKey, currentSalt, newVersion);
    setCurrentEnvelope(envelope);

    await uploadEnvelope(envelope, session.email, newVersion);
    addToast('Item removed from vault', 'info');
  };

  // Manual sync trigger
  const syncWithServer = async () => {
    if (!session) return;
    await fetchRemoteEnvelope(session.email);
    addToast('Vault synchronized with cloud relay', 'info');
  };

  // Clipboard auto-clear helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied! (Clipboard auto-clears in 30s)`, 'success');

    if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
    clipboardTimerRef.current = setTimeout(() => {
      // Clear clipboard securely
      navigator.clipboard.writeText('');
      addToast('Clipboard auto-cleared for security.', 'info');
    }, 30000);
  };

  // Export Vault
  const exportVault = (format: 'encrypted-json' | 'plaintext-json' | 'plaintext-csv'): string => {
    if (format === 'encrypted-json') {
      if (!currentEnvelope) throw new Error('No encrypted envelope available');
      return JSON.stringify(currentEnvelope, null, 2);
    }

    if (!isUnlocked) throw new Error('Vault must be unlocked for export');

    if (format === 'plaintext-json') {
      return JSON.stringify(vaultItems, null, 2);
    }

    if (format === 'plaintext-csv') {
      const headers = ['id', 'type', 'name', 'username', 'key', 'url', 'notes'];
      const rows = vaultItems.map((item) => {
        const f = item.fields || {};
        return [
          item.id,
          item.type,
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${(f.username || '').replace(/"/g, '""')}"`,
          `"${(f.key || f.password || '').replace(/"/g, '""')}"`,
          `"${(f.url || '').replace(/"/g, '""')}"`,
          `"${(item.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      });
      return [headers.join(','), ...rows].join('\n');
    }

    return '';
  };

  // Import Vault
  const importVault = async (
    content: string,
    isEncrypted: boolean,
    passphrase?: string
  ): Promise<number> => {
    if (isEncrypted) {
      const parsedEnvelope = JSON.parse(content) as EncryptedEnvelope;
      if (!passphrase) throw new Error('Passphrase required to decrypt imported envelope');
      const salt = fromBase64(parsedEnvelope.kdf.salt);
      const key = await deriveMasterKey(passphrase, salt, parsedEnvelope.kdf.iterations || 100000);
      const items = await decryptVault(parsedEnvelope, key);

      // Merge items
      const merged = [...items, ...vaultItems];
      setVaultItems(merged);
      if (masterKey && currentSalt && session) {
        const env = await encryptVault(merged, masterKey, currentSalt, vaultVersion + 1);
        await uploadEnvelope(env, session.email, vaultVersion + 1);
      }
      return items.length;
    } else {
      const items = JSON.parse(content);
      if (!Array.isArray(items)) throw new Error('Invalid JSON format: array expected');
      const now = new Date().toISOString();
      const formatted: VaultItem[] = items.map((i: any) => ({
        id: 'item_' + Math.random().toString(36).substring(2, 10),
        type: i.type === 'device' || i.type === 'note' ? i.type : 'login',
        name: i.name || 'Imported Entry',
        favorite: !!i.favorite,
        fields: {
          username: i.fields?.username || i.username || '',
          key: i.fields?.key || i.fields?.password || i.key || i.password || '',
          password: i.fields?.key || i.fields?.password || i.key || i.password || '',
          url: i.fields?.url || i.url || '',
        },
        notes: i.notes || '',
        createdAt: i.createdAt || now,
        updatedAt: now,
      }));

      const merged = [...formatted, ...vaultItems];
      setVaultItems(merged);
      if (masterKey && currentSalt && session) {
        const env = await encryptVault(merged, masterKey, currentSalt, vaultVersion + 1);
        await uploadEnvelope(env, session.email, vaultVersion + 1);
      }
      return formatted.length;
    }
  };

  // Google Login implementation
  const loginWithGoogle = async (customEmail?: string, customName?: string) => {
    try {
      const email = customEmail || 'jobachx31@gmail.com';
      const name = customName || 'Joba';

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setSession(data.user);
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(data.user));
        addToast(`Authenticated as ${data.user.email}`, 'success');
      }
    } catch (err) {
      console.error('[Auth] Google Sign-In error:', err);
      addToast('Authentication failed', 'error');
    }
  };

  const logout = () => {
    lockVault();
    setSession(null);
    localStorage.removeItem(STORAGE_SESSION_KEY);
    addToast('Signed out of Databytes Keyhouse', 'info');
  };

  return (
    <VaultContext.Provider
      value={{
        session,
        loginWithGoogle,
        logout,
        isUnlocked,
        vaultItems,
        vaultVersion,
        syncStatus,
        lastSyncTime,
        hasExistingVault,
        inactivityMinutes,
        setInactivityMinutes,
        lockOnTabBlur,
        setLockOnTabBlur,
        requireBiometric,
        setRequireBiometric,
        unlockVault,
        setupNewVault,
        recoverVault,
        lockVault,
        saveItem,
        deleteItem,
        syncWithServer,
        copyToClipboard,
        toasts,
        removeToast,
        exportVault,
        importVault,
        activeRecoveryPhrase,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within VaultProvider');
  return context;
};
