import React from 'react';
import { useVault } from '../context/VaultContext';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useVault();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border shadow-md bg-[#FFFFFF] border-[#E5E5E5] text-xs transition-all duration-200"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#008AD6] shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-[#008AD6] shrink-0" />}
            <span className="text-[#171717] font-medium">{toast.text}</span>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-[#737373] hover:text-[#171717] transition-colors p-0.5 cursor-pointer"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
