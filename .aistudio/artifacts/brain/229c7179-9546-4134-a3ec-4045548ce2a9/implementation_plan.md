# Databytes Keyhouse — Full-Stack Zero-Knowledge Password Manager & Chrome Extension

A secure, zero-knowledge password manager and Chrome extension (Manifest V3) powered by Google Sign-In, client-side AES-256-GCM encryption with PBKDF2 key derivation, an Express synchronization backend, and a downloadable extension bundle.

## User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction has been aligned with your preferences from Phase 1. All client-side cryptographic guarantees ensure the server only ever receives and persists encrypted ciphertext envelopes.

- **Vault Key Derivation**: Confirmed — Google Sign-In for account identity plus a separate client-side vault unlock passphrase. The passphrase never leaves the browser and is used with PBKDF2 (SHA-256, 100,000 iterations) to derive the 256-bit AES-GCM master encryption key.
- **Backend Architecture**: Confirmed — Express API server integrated into the workspace with local encrypted storage, sync endpoints, versioning/conflict detection, and automated Chrome extension ZIP packaging.
- **Auto-Lock & Recovery Policy**: Confirmed — 15-minute inactivity lock (plus background tab visibility lock) paired with an emergency recovery kit (24-word cryptographic recovery phrase + printable kit).
- **Visual Aesthetic & Theme**: Confirmed — Minimal dark interface with subtle warm gold/amber accents, high-density layout, zero-pill metadata discipline, and monospace tabular credential figures.
- **Chrome Extension (Manifest V3)**: Complete package including background service worker, origin-matched autofill content script, popup interface, secure messaging, password generator, and one-click ZIP download directly from the web UI.

---

## 1. Overview & Core Concept

**Databytes Keyhouse** is a security-first credential management platform designed for developers, systems engineers, and power users. It secures web logins, server infrastructure credentials (SSH keys, ports, passphrases), secure notes, and custom assets with zero-knowledge encryption. 

The server functions strictly as an encrypted blind storage and synchronization relay. Vault records are encrypted into authenticated ciphertext envelopes in memory using the browser's native Web Cryptography API before any network transmission occurs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATABYTES KEYHOUSE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Web App Client (Vite + React)              Chrome Extension (MV3)         │
│   ┌───────────────────────────────┐          ┌───────────────────────────┐  │
│   │ Google OAuth Authentication   │          │ Extension Popup & Fill    │  │
│   │ Client-Side PBKDF2 Key Deriv. │          │ Background Service Worker │  │
│   │ Web Crypto (AES-256-GCM)      │          │ Origin-Restricted Content │  │
│   │ In-Memory Decrypted Vault     │          │ In-Memory Crypto Session  │  │
│   └──────────────┬────────────────┘          └─────────────┬─────────────┘  │
│                  │                                         │                │
│                  │ Encrypted Ciphertext Envelope           │ Encrypted      │
│                  │ (No master keys or plaintext)           │ Envelope       │
│                  ▼                                         ▼                │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                       EXPRESS BACKEND SERVER                         │  │
│   │  - /api/auth/google           - /api/vault/sync (Versioned blobs)    │  │
│   │  - /api/vault/backup          - /api/extension/download (.zip)      │  │
│   │  - Conflict Resolution Check  - Encrypted Storage Store              │  │
│   └───────────────────────────────────┬──────────────────────────────────┘  │
│                                       ▼                                     │
│                     Encrypted JSON Vault Storage File                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Experience & Visual Design

### Visual Identity & Theme
- **Color Palette (60-30-10 Rule)**:
  - **60% Neutral Canvas**: Deep dark zinc `#09090b` canvas and `#121215` structural backgrounds.
  - **30% Structural Surfaces**: Subdued surfaces `#18181b`, hairline dividers `rgba(255,255,255,0.08)`, and neutral muted text `#a1a1aa`.
  - **10% Accent Budget**: Precision warm gold (`#f59e0b` / `#d97706` / `#fbbf24`) reserved strictly for primary actions, active navigation anchors, and security state highlights.
- **Typography**:
  - **Headings & Brand**: `Plus Jakarta Sans` with refined tracking (`-0.02em`).
  - **Body Text**: `DM Sans` (14px–15px) for dense readability.
  - **Credentials, Hashes & Code**: `JetBrains Mono` with `tabular-nums` for alignment.
- **Anti-Slop Discipline**:
  - Zero pill enclosures for static metadata; metadata separated with clean typographic dots (`·`).
  - Strict Top Bar Contract with exactly three zones: brand mark, single-line links, and primary CTA.
  - No fake latency counters, pulsing decorative dots, or ornamental compiler tags.

### Key User Flows

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────┐
│ 1. Sign In  │ ──> │ 2. Setup/Enter │ ──> │ 3. Decrypt   │ ──> │ 4. Manage   │
│ with Google │     │ Vault Passcode │     │ Locally      │     │ Credentials │
└─────────────┘     └────────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼ (First time only)
                    ┌────────────────┐
                    │ Save Emergency │
                    │  Recovery Kit  │
                    └────────────────┘
```

1. **Authentication Flow**: User signs in with Google. If the account is new, they set up their vault unlock passphrase and receive their 24-word Emergency Recovery Kit.
2. **Local Unlock & Key Derivation**: User enters their passphrase. Web Cryptography API runs PBKDF2 with 100,000 iterations to derive an AES-GCM-256 key, which decrypts the synced ciphertext in memory.
3. **Vault Dashboard**: Responsive two-column workspace:
   - **Sidebar**: All Items, Logins, Servers & SSH, Secure Notes, Custom Fields, Favorites, Folders, and Settings.
   - **Main Area**: Instant client-side fuzzy search, category filter, density toggle, add item modal, and masked credential list with 1-click copy.
4. **Detail & Edit View**: Granular controls for usernames, URLs, passwords, SSH keys, ports, TOTP tokens, and custom fields. Passwords are masked with click-to-reveal (optional WebAuthn device biometric check).
5. **Password Generator**: Configurable length (8-64), character sets (uppercase, lowercase, numbers, symbols), unambiguous character exclusions, and real-time entropy calculation.
6. **Chrome Extension Hub & Download**:
   - Download the full Manifest V3 extension as a ready-to-load ZIP file.
   - Step-by-step developer load instructions (`chrome://extensions` → Developer mode → Load unpacked).
   - In-app interactive Extension Preview panel to test autofill matching and popup actions directly in the browser.

---

## 3. Cryptographic Architecture & Data Model

### Zero-Knowledge Specification
- **Key Derivation Function (KDF)**: PBKDF2 with HMAC-SHA-256, 100,000 iterations, 32-byte cryptographically random salt (`crypto.getRandomValues`).
- **Symmetric Cipher**: AES-256-GCM with a fresh 12-byte initialization vector (IV) per encryption.
- **Envelope Format**:
  ```typescript
  interface EncryptedEnvelope {
    version: 1;
    kdf: {
      algorithm: "PBKDF2-SHA256";
      iterations: 100000;
      salt: string; // Base64
    };
    encryption: {
      algorithm: "AES-256-GCM";
      iv: string; // Base64
    };
    ciphertext: string; // Base64
    vaultVersion: number;
    updatedAt: string;
  }
  ```
- **Integrity & Conflict Handling**: AES-GCM provides authenticated encryption with an embedded auth tag. Corrupted ciphertexts are safely rejected. Concurrent updates are protected via monotonically increasing `vaultVersion` and server-side last-write validation.

### Vault Item Schema
```typescript
type VaultItemType = "login" | "server" | "secure_note" | "custom";

interface VaultItem {
  id: string;
  type: VaultItemType;
  name: string;
  folder?: string;
  favorite?: boolean;
  notes?: string;
  fields: Record<string, string>; // e.g. username, password, url, host, port, sshKey
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Chrome Extension (Manifest V3) Architecture

The extension is implemented with modern Manifest V3 standards:

- **`manifest.json`**: MV3 specification declaring `action`, `background.service_worker`, `content_scripts`, `storage`, and `activeTab` permissions.
- **Background Worker (`service-worker.ts`)**:
  - Manages encrypted synchronization with the Databytes Keyhouse server.
  - Holds the derived key in temporary session storage while unlocked.
  - Implements the 15-minute inactivity timer.
- **Content Script (`content-script.ts`)**:
  - Scans DOM for login forms (`input[type="password"]`, `input[autocomplete="username"]`).
  - Origin verification: matches exact scheme and hostname (e.g. `https://github.com` strictly matches `github.com` logins, never `github.com.attacker.test`).
  - Renders a discreet Databytes Keyhouse autofill button inside or adjacent to inputs.
  - Communicates with background worker via typed `chrome.runtime.sendMessage` channels.
- **Popup UI (`popup.html` & `popup.tsx`)**:
  - Fast, compact dark popup matching the web design system with subtle gold accents.
  - Vault unlock input, origin-matched logins for active tab, copy username/password buttons, quick password generator, and full web vault launcher.
- **Packaging & Download Service**:
  - Node/Express endpoint generates a standalone `.zip` archive containing the bundled extension code, icons, manifest, and setup documentation.

---

## 5. Technical Implementation Steps

### Step 1: Backend Sync & Packaging Server
- Configure Express backend API to run alongside Vite dev server (or mounted via Vite server middleware).
- Implement routes:
  - `POST /api/auth/google`: Session validation and token exchange.
  - `GET /api/vault`: Fetch latest encrypted envelope.
  - `POST /api/vault/sync`: Store updated ciphertext with version conflict checks.
  - `GET /api/extension/download`: Stream packaged Chrome extension ZIP.
- Set up local JSON-based encrypted persistence store with atomic file writes.

### Step 2: Cryptographic Engine & Recovery Kit
- Implement `src/crypto/vaultCrypto.ts` using native `window.crypto.subtle`.
- Add PBKDF2 key derivation, AES-GCM-256 encrypt/decrypt, salt/IV generation, and base64 conversions.
- Implement 24-word BIP39-compatible emergency recovery kit generator and validator.

### Step 3: Web Application Frontend
- Build full application shell with `frontend-design` SaaS dashboard layout:
  - Header with Top Bar Contract (Wordmark, links, user account, lock action).
  - Two-column dashboard with filterable sidebar and high-density credential table.
  - Add/Edit modals for Login, Server/SSH, Secure Note, and Custom entries.
  - Reveal/copy controls with security warnings and clipboard auto-clear (after 30s).
  - Cryptographically secure Password Generator with entropy gauge.
  - Auto-lock manager (15-minute idle listener + visibility change listener).
  - Settings page with Recovery Kit export, Import/Export (encrypted & CSV), and Extension Download.

### Step 4: Chrome Extension Source & In-App Simulator
- Create extension directory `src/extension/` with Manifest V3 files: `manifest.json`, `service-worker.js`, `content-script.js`, `popup.html`, `popup.js`, and SVG/PNG icon sets.
- Implement origin validation logic with public suffix/hostname checks.
- Build in-app interactive Chrome Extension Simulator allowing immediate testing of extension popup and autofill scenarios inside the preview.

### Step 5: Verification & Polish
- Run TypeScript linting and build validation (`compile_applet`).
- Verify zero-knowledge flow: verify in network payloads that no plaintext passwords, notes, or raw master keys are ever transmitted.
- Verify download functionality for the extension ZIP and recovery kit.
