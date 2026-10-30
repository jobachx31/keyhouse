import React, { useState } from 'react';
import { VaultProvider, useVault } from './context/VaultContext';
import { VaultSidebar } from './components/VaultSidebar';
import { DashboardView } from './components/DashboardView';
import { VaultDetailModal } from './components/VaultDetailModal';
import { VaultEditModal } from './components/VaultEditModal';
import { AuthModal } from './components/AuthModal';
import { ExtensionView } from './components/ExtensionView';
import { SettingsView } from './components/SettingsView';
import { ToastContainer } from './components/Toast';
import { VaultItem } from './types/vault';
import { Lock, Unlock, Menu, KeyRound } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { session, isUnlocked, vaultItems } = useVault();

  // Navigation: 'dashboard' | 'extension' | 'settings'
  const [activeView, setActiveView] = useState<string>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals & Active Items
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const activeItem = vaultItems.find((i) => i.id === selectedItemId) || null;

  const handleAddNew = () => {
    setEditingItem(null);
    setIsEditModalOpen(true);
  };

  const handleEdit = (item: VaultItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FFFFFF] text-[#171717]">
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-[#FAFAFA] border-b border-[#E5E5E5] px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#008AD6] flex items-center justify-center text-white">
            <KeyRound className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs text-[#171717]">Databytes Keyhouse</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 text-[#171717] rounded-md hover:bg-[#E5E5E5] cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Backdrop for mobile drawer */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/30 z-25"
        />
      )}

      {/* Sidebar matching screenshot */}
      <VaultSidebar
        activeView={activeView}
        setActiveView={setActiveView}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        onAddNew={handleAddNew}
        onOpenSettings={() => setActiveView('settings')}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-14 lg:pt-0">
        {!session || !isUnlocked ? (
          /* Locked State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 text-center bg-[#FFFFFF]">
            <div className="w-16 h-16 rounded-2xl bg-[#EBF5FB] border border-[#BCE1F5] flex items-center justify-center text-[#008AD6] mb-5 shadow-xs">
              <Lock className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#171717]">
              Databytes Keyhouse Vault is Locked
            </h2>
            <p className="text-sm text-[#737373] mt-2.5 max-w-md leading-relaxed">
              {!session
                ? 'Sign in with Google to retrieve your encrypted zero-knowledge vault.'
                : 'Enter your client-side passphrase to derive the AES-256-GCM master key and decrypt your credentials.'}
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="mt-7 px-6 h-11 bg-[#171717] hover:bg-[#262626] text-white font-semibold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <Unlock className="w-4 h-4 text-white" />
              <span>{!session ? 'Sign in with Google' : 'Unlock Encrypted Vault'}</span>
            </button>
          </div>
        ) : activeView === 'dashboard' ? (
          <DashboardView
            key={selectedCategory}
            initialTypeFilter={selectedCategory}
            onSelectItem={(id) => setSelectedItemId(id)}
            onAddNew={handleAddNew}
          />
        ) : activeView === 'extension' ? (
          <ExtensionView />
        ) : (
          <SettingsView />
        )}
      </main>

      {/* Item Detail Modal */}
      <VaultDetailModal
        item={activeItem}
        onClose={() => setSelectedItemId(null)}
        onEdit={handleEdit}
      />

      {/* Add / Edit Key Modal */}
      <VaultEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        editItem={editingItem}
      />

      {/* Auth & Unlock Modal */}
      <AuthModal
        isOpen={isAuthModalOpen || (!isUnlocked && !!session)}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <VaultProvider>
      <MainLayout />
    </VaultProvider>
  );
}
