import React from 'react';
import { useVault } from '../context/VaultContext';
import {
  KeyRound,
  Home,
  Chrome,
  Settings,
  LogOut,
  Lock,
  Plus,
} from 'lucide-react';

interface VaultSidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  onAddNew: () => void;
  onOpenSettings: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const VaultSidebar: React.FC<VaultSidebarProps> = ({
  activeView,
  setActiveView,
  selectedCategory,
  setSelectedCategory,
  onAddNew,
  onOpenSettings,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { session, logout, isUnlocked, lockVault, vaultItems } = useVault();

  const totalCount = vaultItems.length;

  const handleNav = (view: string, category = 'all') => {
    setActiveView(view);
    setSelectedCategory(category);
    if (onCloseMobile) onCloseMobile();
  };

  const isNavActive = (view: string, cat?: string) => {
    if (view === 'dashboard' && activeView === 'dashboard' && selectedCategory === 'all') return true;
    if (view === 'dashboard' && activeView === 'dashboard' && cat && selectedCategory === cat) return true;
    if (view === activeView && !cat) return true;
    return false;
  };

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-[#FAFAFA] border-r border-[#E5E5E5] flex flex-col justify-between shrink-0 select-none overflow-y-auto transition-transform duration-200 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      <div className="p-5 space-y-5">
        {/* Top Header: Logo + App Name */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded-lg bg-[#008AD6] flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
            <KeyRound className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-base tracking-tight text-[#171717] block truncate">
              Databytes Keyhouse
            </span>
          </div>
        </div>

        {/* Primary Action Button: + Create key (Solid Black Button, comfortable height) */}
        {isUnlocked && (
          <button
            onClick={onAddNew}
            className="w-full h-11 bg-[#171717] hover:bg-[#262626] text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>Create key</span>
          </button>
        )}

        {/* Primary Navigation: My Vault, Chrome Extension, Settings */}
        <nav className="space-y-1.5 pt-1">
          {/* My Vault */}
          <button
            onClick={() => handleNav('dashboard', 'all')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              isNavActive('dashboard')
                ? 'bg-[#171717] text-white shadow-xs font-semibold'
                : 'text-[#404040] hover:text-[#171717] hover:bg-[#EFEFEF]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Home className={`w-4.5 h-4.5 ${isNavActive('dashboard') ? 'text-white' : 'text-[#737373]'}`} />
              <span>My Vault</span>
            </div>
            {totalCount > 0 && (
              <span
                className={`text-xs font-mono tabular-nums px-2 py-0.5 rounded-full ${
                  isNavActive('dashboard') ? 'bg-[#333333] text-white' : 'text-[#737373] bg-[#EFEFEF]'
                }`}
              >
                {totalCount}
              </span>
            )}
          </button>

          {/* Chrome Extension */}
          <button
            onClick={() => handleNav('extension')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeView === 'extension'
                ? 'bg-[#171717] text-white shadow-xs font-semibold'
                : 'text-[#404040] hover:text-[#171717] hover:bg-[#EFEFEF]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Chrome className={`w-4.5 h-4.5 ${activeView === 'extension' ? 'text-white' : 'text-[#737373]'}`} />
              <span>Chrome Extension</span>
            </div>
            <span className="text-xs font-semibold text-[#008AD6] bg-[#EBF5FB] border border-[#BCE1F5] px-2 py-0.5 rounded-md">
              MV3
            </span>
          </button>

          {/* Settings */}
          <button
            onClick={() => handleNav('settings')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              activeView === 'settings'
                ? 'bg-[#171717] text-white shadow-xs font-semibold'
                : 'text-[#404040] hover:text-[#171717] hover:bg-[#EFEFEF]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className={`w-4.5 h-4.5 ${activeView === 'settings' ? 'text-white' : 'text-[#737373]'}`} />
              <span>Settings</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Bottom User Profile Section */}
      <div className="p-5 border-t border-[#E5E5E5] space-y-3.5">
        {session ? (
          <div>
            <div className="px-2 py-1">
              <div className="text-sm font-semibold text-[#171717] truncate">
                {session.name || 'Vault Owner'}
              </div>
              <div className="text-xs text-[#737373] truncate font-mono mt-0.5">
                {session.email}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#E5E5E5] flex items-center justify-between">
              {isUnlocked && (
                <button
                  onClick={lockVault}
                  className="flex items-center gap-2 text-xs font-medium text-[#737373] hover:text-[#171717] px-3 py-1.5 rounded-lg hover:bg-[#EFEFEF] transition-colors cursor-pointer"
                  title="Lock Vault Now"
                >
                  <Lock className="w-4 h-4" />
                  <span>Lock</span>
                </button>
              )}

              <button
                onClick={logout}
                className="flex items-center gap-2 text-xs font-medium text-[#737373] hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer ml-auto"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-2 py-1 text-xs text-[#737373]">
            Not signed in
          </div>
        )}
      </div>
    </aside>
  );
};
