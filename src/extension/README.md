# Databytes Keyhouse — Chrome Extension (Manifest V3)

This is the official Chrome extension companion for **Databytes Keyhouse**, synchronized to the same zero-knowledge storage backend as your Web Vault.

## Features
- **Direct Storage Backend Sync**: Log in directly from the extension with your account email and passphrase. The extension fetches your encrypted envelope from the backend and derives your AES-256-GCM master key client-side.
- **Smart Sign-In Autofill**: Detects login forms on active web pages and provides a seamless 1-click in-page autofill popup.
- **Automatic Sign-Up Detection**: Automatically detects when you create or submit a new password, bringing up a non-intrusive prompt to save it directly to your Keyhouse vault.
- **Zero-Knowledge Architecture**: Encryption and decryption happen locally using Web Cryptography. Plaintext secrets never leave your device.
- **15-Minute Auto-Lock**: Master keys and credentials automatically clear from memory after 15 minutes of inactivity.
