import React, { useState, useEffect } from 'react';
import { VaultItem, VaultItemType } from '../types/vault';
import { useVault } from '../context/VaultContext';
import {
  X,
  KeyRound,
  Laptop,
  FileText,
  Eye,
  EyeOff,
  Copy,
  Wand2,
} from 'lucide-react';
import { generatePassword } from '../crypto/vaultCrypto';

interface VaultEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: VaultItem | null;
}

export const VaultEditModal: React.FC<VaultEditModalProps> = ({
  isOpen,
  onClose,
  editItem,
}) => {
  const { saveItem, copyToClipboard } = useVault();

  const [type, setType] = useState<VaultItemType>('login');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [key, setKey] = useState('');
  const [notes, setNotes] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editItem) {
      setType(editItem.type === 'device' || editItem.type === 'note' ? editItem.type : 'login');
      setName(editItem.name || '');
      setNotes(editItem.notes || '');

      const f = editItem.fields || {};
      setUrl(f.url || '');
      setUsername(f.username || '');
      setKey(f.key || f.password || f.sshKey || '');
      setError(null);
    } else {
      setType('login');
      setName('');
      setUrl('');
      setUsername('');
      setKey('');
      setNotes('');
      setShowKey(false);
      setError(null);
    }
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleGenerateKey = () => {
    const generated = generatePassword({
      length: 20,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      excludeAmbiguous: true,
    });
    setKey(generated);
    setShowKey(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a name for this key');
      return;
    }

    if (type === 'login' && !url.trim()) {
      setError('URL / IP address is mandatory for login keys (e.g., https://example.com/login or 192.168.1.1)');
      return;
    }

    if (!key.trim()) {
      setError('Please provide a key or password value');
      return;
    }

    try {
      await saveItem(
        {
          type,
          name: name.trim(),
          notes: notes.trim() || undefined,
          fields: {
            url: url.trim() || undefined,
            username: username.trim() || undefined,
            key: key.trim(),
            password: key.trim(), // synced for extension autofill
          },
        },
        editItem ? editItem.id : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save key');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#008AD6] flex items-center justify-center text-white shrink-0">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#171717]">
                {editItem ? 'Edit Key' : 'Create Key'}
              </h2>
              <p className="text-xs text-[#737373] mt-0.5">
                Zero-knowledge encrypted with client-side AES-256-GCM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[#737373] hover:text-[#171717] rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-7 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 text-xs bg-red-50 border border-red-200 text-red-600 rounded-xl leading-relaxed">
              {error}
            </div>
          )}

          {/* Tag Section: What kind of key is being saved? (login, device, note) */}
          <div>
            <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider mb-2.5">
              Select Key Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setType('login')}
                className={`py-3 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === 'login'
                    ? 'bg-[#171717] border-[#171717] text-white shadow-xs font-semibold ring-2 ring-[#171717]/10'
                    : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717]'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Login</span>
              </button>

              <button
                type="button"
                onClick={() => setType('device')}
                className={`py-3 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === 'device'
                    ? 'bg-[#171717] border-[#171717] text-white shadow-xs font-semibold ring-2 ring-[#171717]/10'
                    : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717]'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Device</span>
              </button>

              <button
                type="button"
                onClick={() => setType('note')}
                className={`py-3 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  type === 'note'
                    ? 'bg-[#171717] border-[#171717] text-white shadow-xs font-semibold ring-2 ring-[#171717]/10'
                    : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5] hover:text-[#171717]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Note</span>
              </button>
            </div>
          </div>

          {/* Field 1: Name */}
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'login' ? 'e.g. Google Workspace' : type === 'device' ? 'e.g. Office Firewall Gateway' : 'e.g. Database Root Seed'}
              className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl px-3.5 py-3 text-sm text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 transition-all"
            />
          </div>

          {/* Field 2: URL / IP Address (Mandatory for login, optional for device/note) */}
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              URL / IP Address {type === 'login' ? <span className="text-red-500">* (mandatory for autofill)</span> : <span className="text-[#737373] text-xs font-normal">(optional)</span>}
            </label>
            <input
              type="text"
              required={type === 'login'}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={type === 'device' ? 'e.g. 192.168.1.1, 10.0.0.5:8080, or ssh://192.168.1.10' : 'e.g. https://example.com/login or 192.168.1.1'}
              className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl px-3.5 py-3 text-sm font-mono text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 transition-all"
            />
          </div>

          {/* Field 3: Username */}
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Username <span className="text-[#737373] text-xs font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com or device admin"
              className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl px-3.5 py-3 text-sm font-mono text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 transition-all"
            />
          </div>

          {/* Field 4: Key (password / secret key / token) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#171717]">
                Key <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateKey}
                className="text-xs text-[#008AD6] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Generate Secure Key</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Password, API secret, or device key"
                className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl pl-3.5 pr-22 py-3 text-sm font-mono text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-[#737373] hover:text-[#171717] rounded hover:bg-neutral-100 cursor-pointer"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {key && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(key, 'Key')}
                    className="p-1.5 text-[#737373] hover:text-[#008AD6] rounded hover:bg-neutral-100 cursor-pointer"
                    title="Copy key"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Field 5: Notes (optional) */}
          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1.5">
              Notes <span className="text-[#737373] text-xs font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Recovery codes, server pin, port instructions, etc."
              className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl px-3.5 py-3 text-sm text-[#171717] placeholder-[#A3A3A3] focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 resize-none transition-all"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E5E5]">
            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2.5 bg-[#FFFFFF] border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#171717] hover:bg-[#262626] text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs active:scale-[0.99]"
            >
              {editItem ? 'Save Key' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
