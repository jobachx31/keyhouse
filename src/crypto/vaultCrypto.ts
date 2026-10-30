/**
 * Databytes Keyhouse — Zero-Knowledge Cryptographic Engine
 *
 * Implements client-side PBKDF2-SHA256 key derivation and AES-256-GCM
 * authenticated encryption via the standard Web Cryptography API.
 * Plaintext vault items never leave client memory unencrypted.
 */

import { EncryptedEnvelope, PasswordGeneratorOptions, VaultItem } from '../types/vault';

// Base64 encoding/decoding utilities using standard browser APIs
export function toBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM master encryption key from a user passphrase using PBKDF2-SHA256
 */
export async function deriveMasterKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import raw passphrase as a key derivation secret
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM symmetric key
  const masterKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false, // Master key is not exportable from subtle crypto memory
    ['encrypt', 'decrypt']
  );

  return masterKey;
}

/**
 * Encrypts an array of vault items into a versioned authenticated ciphertext envelope
 */
export async function encryptVault(
  items: VaultItem[],
  key: CryptoKey,
  salt: Uint8Array,
  vaultVersion: number
): Promise<EncryptedEnvelope> {
  const encoder = new TextEncoder();
  const serialized = JSON.stringify(items);
  const plaintext = encoder.encode(serialized);

  // 12-byte initialization vector (standard for AES-GCM)
  const iv = generateRandomBytes(12);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    plaintext
  );

  return {
    version: 1,
    kdf: {
      algorithm: 'PBKDF2-SHA256',
      iterations: 100000,
      salt: toBase64(salt),
    },
    encryption: {
      algorithm: 'AES-256-GCM',
      iv: toBase64(iv),
    },
    ciphertext: toBase64(ciphertextBuffer),
    vaultVersion,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Decrypts an authenticated ciphertext envelope back into plaintext vault items
 */
export async function decryptVault(
  envelope: EncryptedEnvelope,
  key: CryptoKey
): Promise<VaultItem[]> {
  const iv = fromBase64(envelope.encryption.iv);
  const ciphertext = fromBase64(envelope.ciphertext);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    const parsed = JSON.parse(jsonString);

    if (!Array.isArray(parsed)) {
      throw new Error('Decrypted payload is not a valid items array');
    }

    return parsed as VaultItem[];
  } catch (err) {
    throw new Error('Failed to decrypt vault: invalid passphrase or corrupt payload');
  }
}

// Wordlist for 24-word emergency recovery kits (clean high-entropy words)
const RECOVERY_WORDLIST: string[] = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
  'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
  'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
  'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
  'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
  'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
  'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
  'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
  'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
  'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
  'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado',
  'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis',
  'baby', 'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball',
  'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base',
  'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt',
  'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle',
  'bid', 'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black',
  'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood',
  'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring',
  'borrow', 'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain',
  'brand', 'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief',
  'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother',
  'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus',
  'business', 'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable',
  'cactus', 'cage', 'cake', 'call', 'calm', 'camera', 'camp', 'can'
];

/**
 * Generates a 24-word cryptographically random Emergency Recovery Phrase
 */
export function generateRecoveryPhrase(): string[] {
  const phrase: string[] = [];
  const randomIndices = new Uint16Array(24);
  window.crypto.getRandomValues(randomIndices);

  for (let i = 0; i < 24; i++) {
    const word = RECOVERY_WORDLIST[randomIndices[i] % RECOVERY_WORDLIST.length];
    phrase.push(word);
  }
  return phrase;
}

/**
 * Derives a master key using an emergency recovery phrase
 */
export async function deriveKeyFromRecovery(
  phraseWords: string[],
  salt: Uint8Array
): Promise<CryptoKey> {
  const normalized = phraseWords.map((w) => w.trim().toLowerCase()).join(' ');
  return deriveMasterKey(normalized, salt, 100000);
}

/**
 * Cryptographically secure password generator
 */
export function generatePassword(options: PasswordGeneratorOptions): string {
  const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz';
  const numberChars = '23456789';
  const symbolChars = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  // Ambiguous characters: 0, O, 1, l, I
  const ambiguousChars = '0O1lI';

  let charset = '';
  const requiredChars: string[] = [];

  if (options.uppercase) {
    charset += uppercaseChars;
    requiredChars.push(getRandomChar(uppercaseChars));
  }
  if (options.lowercase) {
    charset += lowercaseChars;
    requiredChars.push(getRandomChar(lowercaseChars));
  }
  if (options.numbers) {
    charset += numberChars;
    requiredChars.push(getRandomChar(numberChars));
  }
  if (options.symbols) {
    charset += symbolChars;
    requiredChars.push(getRandomChar(symbolChars));
  }

  if (!options.excludeAmbiguous) {
    charset += ambiguousChars;
  }

  // Fallback to alphanumeric if no categories selected
  if (charset.length === 0) {
    charset = lowercaseChars + numberChars;
  }

  const length = Math.max(8, Math.min(64, options.length));
  const remainingLength = Math.max(0, length - requiredChars.length);
  const result: string[] = [...requiredChars];

  const randomBytes = new Uint32Array(remainingLength);
  window.crypto.getRandomValues(randomBytes);

  for (let i = 0; i < remainingLength; i++) {
    result.push(charset[randomBytes[i] % charset.length]);
  }

  // Fisher-Yates cryptographically secure shuffle
  const shuffleBytes = new Uint32Array(result.length);
  window.crypto.getRandomValues(shuffleBytes);
  for (let i = result.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}

function getRandomChar(charset: string): string {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return charset[array[0] % charset.length];
}

/**
 * Calculate password information entropy in bits
 */
export function calculatePasswordEntropy(password: string): {
  entropy: number;
  label: string;
  colorClass: string;
} {
  if (!password) {
    return { entropy: 0, label: 'Empty', colorClass: 'text-zinc-500' };
  }

  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

  const entropy = Math.round(password.length * (Math.log2(poolSize || 10)));

  if (entropy < 36) {
    return { entropy, label: 'Weak', colorClass: 'text-red-400' };
  } else if (entropy < 56) {
    return { entropy, label: 'Fair', colorClass: 'text-amber-400' };
  } else if (entropy < 80) {
    return { entropy, label: 'Good', colorClass: 'text-emerald-400' };
  } else {
    return { entropy, label: 'Very Strong', colorClass: 'text-amber-300' };
  }
}
