import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import {
  Shield,
  Clock,
  Fingerprint,
  FileText,
  Download,
  Upload,
  LogOut,
  AlertTriangle,
  Copy,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    session,
    logout,
    inactivityMinutes,
    setInactivityMinutes,
    lockOnTabBlur,
    setLockOnTabBlur,
    requireBiometric,
    setRequireBiometric,
    exportVault,
    importVault,
    activeRecoveryPhrase,
    copyToClipboard,
    vaultVersion,
  } = useVault();

  const [importFileContent, setImportFileContent] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [isEncryptedImport, setIsEncryptedImport] = useState(false);
  const [showPlaintextWarning, setShowPlaintextWarning] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleExportEncrypted = () => {
    try {
      const data = exportVault('encrypted-json');
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `databytes-keyhouse-vault-v${vaultVersion}.encrypted.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    }
  };

  const handleExportPlaintext = (type: 'plaintext-json' | 'plaintext-csv') => {
    try {
      const data = exportVault(type);
      const mime = type === 'plaintext-json' ? 'application/json' : 'text/csv';
      const ext = type === 'plaintext-json' ? 'json' : 'csv';
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `databytes-keyhouse-unencrypted-backup.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowPlaintextWarning(false);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportFileContent(text);
      try {
        const parsed = JSON.parse(text);
        if (parsed.kdf && parsed.ciphertext) {
          setIsEncryptedImport(true);
        } else {
          setIsEncryptedImport(false);
        }
      } catch {
        setIsEncryptedImport(false);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importFileContent) return;
    try {
      const count = await importVault(importFileContent, isEncryptedImport, importPassphrase);
      setImportStatus(`Successfully merged ${count} credentials into your vault!`);
      setImportFileContent('');
      setImportPassphrase('');
    } catch (e: any) {
      setImportStatus(`Import failed: ${e.message || 'Invalid format'}`);
    }
  };

  return (
    <div className="flex-1 bg-[#FFFFFF] overflow-y-auto px-6 py-8 md:px-12 md:py-12 flex justify-center">
      <div className="w-full max-w-4xl space-y-8">
        <div className="border-b border-[#E5E5E5] pb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171717]">
            Security & Vault Settings
          </h1>
          <p className="text-sm text-[#737373] mt-1.5">
            Configure auto-lock parameters, device authenticators, and emergency recovery options.
          </p>
        </div>

        {/* Inactivity & Auto-Lock Section */}
        <div className="p-7 bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl space-y-6 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#171717] uppercase tracking-wider">
            <Clock className="w-4 h-4 text-[#008AD6]" />
            <span>Vault Locking & Lifecycle</span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#171717] mb-2.5">
              Inactivity Auto-Lock Timeout
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[1, 5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setInactivityMinutes(mins)}
                  className={`py-2.5 px-4 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                    inactivityMinutes === mins
                      ? 'bg-[#171717] text-white font-semibold border-[#171717] shadow-xs'
                      : 'bg-[#FAFAFA] text-[#171717] border-[#E5E5E5] hover:border-neutral-400 hover:bg-[#F5F5F5]'
                  }`}
                >
                  {mins === 60 ? '1 Hour' : `${mins} Mins`}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#737373] mt-2.5">
              Vault keys and decrypted records are securely erased from memory after {inactivityMinutes} minutes without interaction.
            </p>
          </div>

          <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#171717]">Lock on Tab Backgrounding</div>
              <div className="text-xs text-[#737373] mt-0.5">
                Immediately lock vault whenever switching tabs or minimizing browser window.
              </div>
            </div>
            <input
              type="checkbox"
              checked={lockOnTabBlur}
              onChange={(e) => setLockOnTabBlur(e.target.checked)}
              className="w-4 h-4 rounded border-[#E5E5E5] text-[#008AD6] focus:ring-[#008AD6] cursor-pointer"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-[#171717] flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-[#008AD6]" />
                <span>WebAuthn Device Verification (Touch ID / Windows Hello)</span>
              </div>
              <div className="text-xs text-[#737373] mt-0.5 max-w-md">
                Prompt for platform biometric or device PIN check before revealing secret passwords.
              </div>
            </div>
            <input
              type="checkbox"
              checked={requireBiometric}
              onChange={(e) => setRequireBiometric(e.target.checked)}
              className="w-4 h-4 rounded border-[#E5E5E5] text-[#008AD6] focus:ring-[#008AD6] cursor-pointer"
            />
          </div>
        </div>

        {/* Emergency Recovery Kit */}
        <div className="p-7 bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl space-y-5 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#171717] uppercase tracking-wider">
            <FileText className="w-4 h-4 text-[#008AD6]" />
            <span>Emergency Recovery Kit</span>
          </div>

          <p className="text-sm text-[#737373] leading-relaxed">
            In a strict zero-knowledge architecture, no server administrator can decrypt your vault. If you
            lose your passphrase, your 24-word Emergency Recovery Kit is the only way to recover access.
          </p>

          {activeRecoveryPhrase ? (
            <div className="p-5 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl space-y-4">
              <div className="text-xs font-semibold text-[#008AD6]">Active Session Recovery Phrase:</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs font-mono">
                {activeRecoveryPhrase.map((w, i) => (
                  <div key={i} className="bg-[#FFFFFF] p-2 rounded-lg border border-[#E5E5E5]">
                    <span className="text-[#A3A3A3] text-[11px] tabular-nums mr-1.5">{i + 1}.</span>
                    <span className="text-[#171717] font-semibold">{w}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => copyToClipboard(activeRecoveryPhrase.join(' '), 'Recovery Kit')}
                className="px-4 py-2 bg-[#FFFFFF] hover:bg-[#F5F5F5] border border-[#E5E5E5] text-[#171717] text-xs rounded-xl font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Copy className="w-4 h-4 text-[#008AD6]" />
                <span>Copy 24 Words</span>
              </button>
            </div>
          ) : (
            <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl text-xs text-[#737373]">
              Your 24-word recovery kit was generated during your initial vault setup. Keep your saved copy safe offline.
            </div>
          )}
        </div>

        {/* Backup & Export */}
        <div className="p-7 bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl space-y-6 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#171717] uppercase tracking-wider">
            <Download className="w-4 h-4 text-[#008AD6]" />
            <span>Vault Backup & Export</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportEncrypted}
              className="flex-1 py-3 px-4 bg-[#FAFAFA] hover:bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#171717] flex items-center justify-center gap-2.5 cursor-pointer transition-colors shadow-xs"
            >
              <Shield className="w-4 h-4 text-[#008AD6]" />
              <span>Export Encrypted JSON (Safe)</span>
            </button>

            <button
              onClick={() => setShowPlaintextWarning(true)}
              className="flex-1 py-3 px-4 bg-[#FAFAFA] hover:bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-xs font-semibold text-[#737373] hover:text-[#171717] flex items-center justify-center gap-2.5 cursor-pointer transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Export Plaintext Backup...</span>
            </button>
          </div>

          {showPlaintextWarning && (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-3.5 animate-in fade-in">
              <div className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Security Warning: Unencrypted Plaintext Export</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Exporting your vault in unencrypted plaintext will write all credentials to an unencrypted file on your computer. Anyone with access to this file can view all your passwords.
              </p>
              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => handleExportPlaintext('plaintext-json')}
                  className="px-4 py-2 bg-[#171717] hover:bg-[#262626] text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Download Plain JSON
                </button>
                <button
                  onClick={() => handleExportPlaintext('plaintext-csv')}
                  className="px-4 py-2 bg-[#171717] hover:bg-[#262626] text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => setShowPlaintextWarning(false)}
                  className="px-4 py-2 bg-[#FFFFFF] hover:bg-[#F5F5F5] border border-[#E5E5E5] text-[#171717] text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Import */}
          <div className="pt-5 border-t border-[#E5E5E5] space-y-3.5">
            <div className="text-sm font-semibold text-[#171717] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#737373]" />
              <span>Import Credentials (JSON)</span>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="text-xs text-[#737373] file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border file:border-[#E5E5E5] file:text-xs file:font-semibold file:bg-[#FFFFFF] file:text-[#171717] hover:file:bg-[#F5F5F5] cursor-pointer"
            />

            {isEncryptedImport && (
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-semibold text-[#171717]">
                  Passphrase for Imported Encrypted Envelope:
                </label>
                <input
                  type="password"
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                  placeholder="Passphrase used to encrypt this file"
                  className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl text-sm text-[#171717]"
                />
              </div>
            )}

            {importFileContent && (
              <button
                onClick={handleExecuteImport}
                className="px-5 py-2.5 bg-[#171717] hover:bg-[#262626] text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Execute Import & Encrypt
              </button>
            )}

            {importStatus && <div className="text-xs text-[#008AD6] font-semibold">{importStatus}</div>}
          </div>
        </div>

        {/* User Account & Sign Out */}
        <div className="p-7 bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <div className="text-sm font-semibold text-[#171717]">Authenticated Google Account</div>
            <div className="text-xs text-[#737373] font-mono mt-1">{session?.email}</div>
          </div>

          <button
            onClick={logout}
            className="px-4.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
