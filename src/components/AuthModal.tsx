import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import { Lock, Unlock, KeyRound, ShieldAlert, Copy, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { calculatePasswordEntropy } from '../crypto/vaultCrypto';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    session,
    loginWithGoogle,
    isUnlocked,
    hasExistingVault,
    unlockVault,
    setupNewVault,
    recoverVault,
    copyToClipboard,
  } = useVault();

  const [mode, setMode] = useState<'unlock' | 'setup' | 'recover' | 'recovery-kit-view'>('unlock');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [generatedPhrase, setGeneratedPhrase] = useState<string[]>([]);
  const [acknowledgedRecovery, setAcknowledgedRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (session && !isUnlocked) {
      setMode(hasExistingVault ? 'unlock' : 'setup');
    }
    setErrorMessage('');
  }, [session, isUnlocked, hasExistingVault]);

  if (!isOpen && isUnlocked) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) return;
    setIsLoading(true);
    setErrorMessage('');
    const success = await unlockVault(passphrase);
    setIsLoading(false);
    if (success) {
      setPassphrase('');
      onClose();
    } else {
      setErrorMessage('Incorrect vault passphrase or corrupted payload');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length < 8) {
      setErrorMessage('Passphrase must be at least 8 characters long');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setErrorMessage('Passphrases do not match');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const { recoveryPhrase } = await setupNewVault(passphrase);
      setGeneratedPhrase(recoveryPhrase);
      setMode('recovery-kit-view');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to setup vault');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const words = recoveryInput
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (words.length !== 24) {
      setErrorMessage(`Please enter all 24 words (currently entered: ${words.length})`);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    const success = await recoverVault(words);
    setIsLoading(false);
    if (success) {
      setRecoveryInput('');
      onClose();
    } else {
      setErrorMessage('Failed to restore vault. Please check word sequence.');
    }
  };

  const entropy = calculatePasswordEntropy(passphrase);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-xl p-7 text-[#171717]">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-[#E5E5E5]">
          <div className="w-9 h-9 rounded-xl bg-[#EBF5FB] border border-[#BCE1F5] flex items-center justify-center text-[#008AD6] shrink-0">
            <KeyRound className="w-5 h-5 text-[#008AD6]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#171717]">Databytes Keyhouse</h2>
            <p className="text-xs text-[#737373]">Zero-Knowledge AES-256-GCM Vault</p>
          </div>
        </div>

        {/* Step 1: Sign in with Google */}
        {!session ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] text-xs text-[#737373] space-y-2">
              <div className="font-semibold text-sm text-[#171717] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#008AD6]" />
                <span>Zero-Knowledge Architecture</span>
              </div>
              <p className="leading-relaxed">
                Google authenticates your account identity, while your vault is encrypted and decrypted locally
                using client-side Web Cryptography. We never receive or store your master keys.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-12 flex items-center justify-center gap-3 px-4 bg-[#FFFFFF] hover:bg-[#F5F5F5] border border-[#E5E5E5] text-[#171717] font-semibold rounded-xl text-sm transition-colors cursor-pointer shadow-xs disabled:opacity-50 active:scale-[0.99]"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoading ? 'Connecting...' : 'Continue with Google'}</span>
            </button>
          </div>
        ) : mode === 'unlock' ? (
          /* Step 2: Unlock Existing Vault */
          <form onSubmit={handleUnlock} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-2">
                Vault Unlock Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Enter your client-side passphrase"
                  autoFocus
                  required
                  className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-sm text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 font-mono pr-12 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717] p-1 cursor-pointer"
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !passphrase}
              className="w-full h-11 bg-[#171717] hover:bg-[#262626] text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs active:scale-[0.99]"
            >
              <Unlock className="w-4 h-4 text-white" />
              <span>{isLoading ? 'Decrypting Vault...' : 'Unlock Vault'}</span>
            </button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setMode('recover')}
                className="text-xs text-[#737373] hover:text-[#008AD6] underline transition-colors cursor-pointer"
              >
                Restore with 24-word Recovery Kit
              </button>
            </div>
          </form>
        ) : mode === 'setup' ? (
          /* Step 3: Setup New Vault */
          <form onSubmit={handleSetup} className="space-y-5">
            <div className="p-4 rounded-xl bg-[#EBF5FB] border border-[#BCE1F5] text-xs text-[#008AD6] leading-relaxed">
              Create a vault passphrase. This secret is used with PBKDF2 (100,000 iterations) to derive your AES-256 master key. It is never transmitted across the network.
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                New Vault Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-sm text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 font-mono pr-12 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717] p-1 cursor-pointer"
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passphrase && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-[#737373]">Entropy: {entropy.entropy} bits</span>
                  <span className="text-[#008AD6] font-semibold">{entropy.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1.5">
                Confirm Passphrase
              </label>
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                placeholder="Repeat your passphrase"
                required
                className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-sm text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 font-mono transition-all"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !passphrase || passphrase !== confirmPassphrase}
              className="w-full h-11 bg-[#171717] hover:bg-[#262626] text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs active:scale-[0.99]"
            >
              <span>Initialize Vault & Generate Recovery Kit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : mode === 'recovery-kit-view' ? (
          /* Step 4: Show Generated 24-Word Recovery Phrase */
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-[#EBF5FB] border border-[#BCE1F5] text-xs text-[#008AD6] leading-relaxed">
              <strong>Emergency Recovery Kit Generated:</strong> Save these 24 words in a secure place. This is the only way to recover your vault if you forget your passphrase.
            </div>

            <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl max-h-56 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2.5">
                {generatedPhrase.map((word, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-xs font-mono bg-[#FFFFFF] px-2.5 py-1.5 rounded-lg border border-[#E5E5E5]"
                  >
                    <span className="text-[#A3A3A3] text-[11px] tabular-nums select-none">{idx + 1}.</span>
                    <span className="text-[#171717] font-semibold">{word}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(generatedPhrase.join(' '), '24-Word Recovery Phrase')}
              className="w-full h-10 bg-[#FFFFFF] hover:bg-[#F5F5F5] border border-[#E5E5E5] text-[#171717] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Copy className="w-4 h-4 text-[#008AD6]" />
              <span>Copy 24 Words</span>
            </button>

            <label className="flex items-start gap-3 text-xs text-[#171717] cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={acknowledgedRecovery}
                onChange={(e) => setAcknowledgedRecovery(e.target.checked)}
                className="mt-0.5 rounded border-[#E5E5E5] text-[#008AD6] focus:ring-[#008AD6]"
              />
              <span className="leading-snug">I have safely stored my 24-word Emergency Recovery Kit.</span>
            </label>

            <button
              type="button"
              disabled={!acknowledgedRecovery}
              onClick={onClose}
              className="w-full h-11 bg-[#171717] hover:bg-[#262626] text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50 shadow-xs active:scale-[0.99]"
            >
              Open Vault Dashboard
            </button>
          </div>
        ) : (
          /* Step 5: Restore via 24-word Recovery Phrase */
          <form onSubmit={handleRecoverySubmit} className="space-y-5">
            <div className="text-xs text-[#737373] leading-relaxed">
              Paste or type your 24 emergency recovery words separated by spaces.
            </div>

            <textarea
              rows={4}
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              placeholder="e.g. abandon ability able about above absent absorb..."
              required
              className="w-full px-4 py-3 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-sm font-mono text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 leading-relaxed transition-all"
            />

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode('unlock')}
                className="flex-1 h-11 bg-[#FFFFFF] hover:bg-[#F5F5F5] border border-[#E5E5E5] text-[#171717] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading || !recoveryInput}
                className="flex-1 h-11 bg-[#171717] hover:bg-[#262626] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
              >
                <Unlock className="w-4 h-4 text-white" />
                <span>{isLoading ? 'Decrypting...' : 'Restore Vault'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
