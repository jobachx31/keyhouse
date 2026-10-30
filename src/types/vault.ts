/**
 * Databytes Keyhouse — Vault & Cryptography Types
 */

export type VaultItemType = 'login' | 'device' | 'note';

export interface VaultItem {
  id: string;
  type: VaultItemType;
  name: string;
  favorite?: boolean;
  notes?: string;
  fields: {
    url?: string;
    username?: string;
    key?: string;
    password?: string;
    [key: string]: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedEnvelope {
  version: 1;
  kdf: {
    algorithm: 'PBKDF2-SHA256';
    iterations: number;
    salt: string; // Base64 encoded
  };
  encryption: {
    algorithm: 'AES-256-GCM';
    iv: string; // Base64 encoded
  };
  ciphertext: string; // Base64 encoded AES-GCM ciphertext + auth tag
  vaultVersion: number;
  updatedAt: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'conflict' | 'error' | 'offline';

export interface UserSession {
  email: string;
  name: string;
  picture?: string;
  token: string;
  googleId?: string;
}

export interface VaultMetadata {
  vaultVersion: number;
  updatedAt: string;
  itemCount: number;
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export interface RecoveryKit {
  phrase: string[];
  generatedAt: string;
  userEmail: string;
}
