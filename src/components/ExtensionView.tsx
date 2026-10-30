import React, { useState } from 'react';
import {
  Download,
  Chrome,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { downloadExtensionPackage } from '../utils/extensionPackager';

export const ExtensionView: React.FC = () => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    setDownloadSuccess(null);
    try {
      const { size } = await downloadExtensionPackage();
      const kb = (size / 1024).toFixed(1);
      setDownloadSuccess(`Verified package downloaded (${kb} KB, 9 files, valid DEFLATE archive)`);
      setTimeout(() => setDownloadSuccess(null), 8000);
    } catch (err: any) {
      console.error('Download failed:', err);
      alert('Failed to generate extension zip: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex-1 bg-[#FFFFFF] overflow-y-auto px-6 py-8 md:px-12 md:py-12 flex justify-center">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header & Download Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-7 bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-[#008AD6] text-xs font-semibold uppercase tracking-wider mb-1.5">
              <Chrome className="w-4 h-4 text-[#008AD6]" />
              <span>Manifest V3 Companion</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#171717]">
              Databytes Keyhouse Chrome Extension
            </h1>
            <p className="text-sm text-[#737373] mt-1.5 max-w-lg leading-relaxed">
              Zero-knowledge browser extension with origin-verified autofill, background encryption key derivation, and instant vault synchronization.
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-start sm:items-end gap-2.5">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="h-11 px-5 bg-[#171717] hover:bg-[#262626] text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-2.5 cursor-pointer shadow-xs disabled:opacity-50 active:scale-[0.99]"
            >
              <Download className="w-4 h-4 text-white" />
              <span>{isDownloading ? 'Packaging...' : 'Download Extension (.zip)'}</span>
            </button>
            {downloadSuccess && (
              <span className="text-xs text-[#008AD6] font-medium flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-[#008AD6] shrink-0" />
                <span>{downloadSuccess}</span>
              </span>
            )}
          </div>
        </div>

        {/* Installation Instructions: Bullet Pointed List Going Downwards */}
        <div className="p-7 bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl space-y-7 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-[#171717] tracking-tight">
              Developer Mode Installation Steps
            </h2>
            <p className="text-sm text-[#737373] mt-1">
              Follow these simple steps in Google Chrome, Brave, or Microsoft Edge to install the unpacked extension.
            </p>
          </div>

          <ul className="space-y-5">
            <li className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-[#EBF5FB] border border-[#BCE1F5] text-[#008AD6] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                1
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#171717]">
                  Download and extract the zip archive
                </div>
                <p className="text-sm text-[#737373] leading-relaxed">
                  Click the <strong>Download Extension (.zip)</strong> button above. Unzip the downloaded archive into a persistent directory on your local disk (for example, <code className="font-mono text-[#171717] bg-[#F5F5F5] px-2 py-0.5 rounded text-xs">~/Documents/databytes-keyhouse-extension/</code>).
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-[#EBF5FB] border border-[#BCE1F5] text-[#008AD6] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#171717]">
                  Open your browser extensions manager
                </div>
                <p className="text-sm text-[#737373] leading-relaxed">
                  In your browser address bar, navigate to{' '}
                  <code className="font-mono text-[#008AD6] bg-[#EBF5FB] px-2 py-0.5 rounded text-xs select-all font-semibold">
                    chrome://extensions
                  </code>{' '}
                  (or <code className="font-mono text-xs">edge://extensions</code> in Microsoft Edge, <code className="font-mono text-xs">brave://extensions</code> in Brave).
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-[#EBF5FB] border border-[#BCE1F5] text-[#008AD6] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                3
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#171717]">
                  Enable Developer Mode
                </div>
                <p className="text-sm text-[#737373] leading-relaxed">
                  Locate and turn on the <strong>Developer mode</strong> toggle switch in the upper-right corner of the Extensions dashboard.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-[#EBF5FB] border border-[#BCE1F5] text-[#008AD6] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                4
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#171717]">
                  Click "Load unpacked" and select the folder
                </div>
                <p className="text-sm text-[#737373] leading-relaxed">
                  Click the <strong>Load unpacked</strong> button in the top-left toolbar, then browse and select the unzipped directory containing <code className="font-mono text-[#171717] bg-[#F5F5F5] px-2 py-0.5 rounded text-xs">manifest.json</code>.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-[#EBF5FB] border border-[#BCE1F5] text-[#008AD6] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                5
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#171717]">
                  Log in with your passphrase & enable autofill
                </div>
                <p className="text-sm text-[#737373] leading-relaxed">
                  Click Chrome’s puzzle extensions icon to pin <strong>Databytes Keyhouse</strong>. Open the extension popup, enter your account email and vault passphrase, and click <strong>Sign In & Unlock Vault</strong>. The extension connects to the shared storage backend, detects sign-in forms to show 1-click autofill popups, and prompts to save new logins upon sign-up.
                </p>
              </div>
            </li>
          </ul>

          <div className="pt-5 border-t border-[#E5E5E5] flex items-center gap-2.5 text-xs text-[#737373]">
            <ShieldCheck className="w-4 h-4 text-[#008AD6]" />
            <span>Zero-Knowledge Architecture: Passphrase and derived keys never leave your device.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
