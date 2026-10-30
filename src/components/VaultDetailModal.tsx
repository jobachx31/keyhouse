import React, { useState } from 'react';
import { VaultItem } from '../types/vault';
import { useVault } from '../context/VaultContext';
import {
  X,
  KeyRound,
  Laptop,
  FileText,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Edit2,
  Trash2,
} from 'lucide-react';

interface VaultDetailModalProps {
  item: VaultItem | null;
  onClose: () => void;
  onEdit: (item: VaultItem) => void;
}

export const VaultDetailModal: React.FC<VaultDetailModalProps> = ({
  item,
  onClose,
  onEdit,
}) => {
  const { deleteItem, copyToClipboard } = useVault();
  const [showKey, setShowKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item) return null;

  const fields = item.fields || {};
  const keyValue = fields.key || fields.password || fields.sshKey || '';

  const handleDelete = async () => {
    await deleteItem(item.id);
    onClose();
  };

  const getTypeIcon = () => {
    switch (item.type) {
      case 'device':
        return <Laptop className="w-5 h-5 text-[#008AD6]" />;
      case 'note':
        return <FileText className="w-5 h-5 text-[#008AD6]" />;
      default:
        return <KeyRound className="w-5 h-5 text-[#008AD6]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#E5E5E5] bg-[#FAFAFA]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EBF5FB] border border-[#BCE1F5] flex items-center justify-center shrink-0">
              {getTypeIcon()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#171717] truncate">{item.name}</h2>
              <div className="flex items-center gap-2 text-xs text-[#737373] mt-0.5">
                <span className="font-semibold uppercase text-[11px] bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-md">
                  {item.type}
                </span>
                <span className="text-xs font-mono text-[#737373]">
                  Updated {new Date(item.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-2 text-[#737373] hover:text-[#171717] rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Fields */}
        <div className="p-7 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* URL / IP Address */}
          {fields.url && (
            <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl">
              <div className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>URL / IP Address</span>
                <a
                  href={fields.url.startsWith('http://') || fields.url.startsWith('https://') ? fields.url : `http://${fields.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#008AD6] hover:underline flex items-center gap-1.5 text-xs font-medium"
                >
                  <span>{fields.url.startsWith('http') ? 'Visit site' : 'Open'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="flex items-center justify-between gap-3 font-mono text-sm text-[#171717]">
                <span className="truncate">{fields.url}</span>
                <button
                  onClick={() => copyToClipboard(fields.url || '', 'URL / IP Address')}
                  className="text-[#737373] hover:text-[#008AD6] p-1.5 rounded hover:bg-neutral-200 cursor-pointer"
                  title="Copy URL / IP Address"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Username */}
          {fields.username && (
            <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl">
              <div className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-1.5">
                Username / Identifier
              </div>
              <div className="flex items-center justify-between gap-3 font-mono text-sm text-[#171717]">
                <span className="truncate">{fields.username}</span>
                <button
                  onClick={() => copyToClipboard(fields.username || '', 'Username')}
                  className="text-[#737373] hover:text-[#008AD6] p-1.5 rounded hover:bg-neutral-200 cursor-pointer"
                  title="Copy username"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Key */}
          {keyValue && (
            <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl">
              <div className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-1.5">
                Key / Password
              </div>
              <div className="flex items-center justify-between gap-3 font-mono text-sm text-[#171717]">
                <span className="truncate select-all bg-[#FFFFFF] px-3 py-1.5 rounded-lg border border-[#E5E5E5] flex-1">
                  {showKey ? keyValue : '••••••••••••••••'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-[#737373] hover:text-[#171717] p-2 rounded-lg hover:bg-neutral-200 cursor-pointer"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(keyValue, 'Key')}
                    className="text-[#737373] hover:text-[#008AD6] p-2 rounded-lg hover:bg-neutral-200 cursor-pointer"
                    title="Copy key"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div className="p-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl">
              <div className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-1.5">
                Notes
              </div>
              <p className="text-sm text-[#171717] whitespace-pre-wrap leading-relaxed">
                {item.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-7 py-5 border-t border-[#E5E5E5] bg-[#FAFAFA]">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Permanently delete?</span>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E5E5E5] text-[#171717] rounded-lg text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-medium text-[#737373] hover:text-red-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Key</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#FFFFFF] border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5] rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(item);
              }}
              className="px-4.5 py-2 bg-[#171717] hover:bg-[#262626] text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Key</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
