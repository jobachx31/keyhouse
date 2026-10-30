import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { VaultItem } from '../types/vault';
import {
  KeyRound,
  Laptop,
  FileText,
  RefreshCw,
  Search,
  Lock,
  Plus,
  Copy,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';

interface DashboardViewProps {
  onSelectItem: (id: string) => void;
  onAddNew: () => void;
  initialTypeFilter?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectItem,
  onAddNew,
  initialTypeFilter = 'all',
}) => {
  const { vaultItems, syncStatus, syncWithServer, lockVault, copyToClipboard } = useVault();

  // Search & Type Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>(initialTypeFilter);

  // Pagination State (Default 15 items per page as requested)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Counts
  const totalCount = vaultItems.length;
  const loginCount = vaultItems.filter((i) => i.type === 'login').length;
  const deviceCount = vaultItems.filter((i) => i.type === 'device').length;
  const noteCount = vaultItems.filter((i) => i.type === 'note').length;

  // Filtered Items (searching logs by name)
  const filteredItems = useMemo(() => {
    return vaultItems.filter((item) => {
      // Search by log name
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        if (!item.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Filter by type
      if (selectedType !== 'all') {
        return item.type === selectedType;
      }

      return true;
    });
  }, [vaultItems, searchQuery, selectedType]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, validCurrentPage, pageSize]);

  const getItemCode = (item: VaultItem, index: number) => {
    const baseNum = 1000 + (validCurrentPage - 1) * pageSize + index + 1;
    switch (item.type) {
      case 'device':
        return `DEV-${baseNum}`;
      case 'note':
        return `NOTE-${baseNum}`;
      default:
        return `LOG-${baseNum}`;
    }
  };

  const getStatusBadge = (item: VaultItem) => {
    if (item.type === 'device') return 'DEVICE';
    if (item.type === 'note') return 'NOTE';
    return 'LOGIN';
  };

  const handleCardClick = (type: string) => {
    if (selectedType === type) {
      setSelectedType('all');
    } else {
      setSelectedType(type);
    }
    setCurrentPage(1);
  };

  return (
    <div className="flex-1 bg-[#FFFFFF] overflow-y-auto px-6 py-8 md:px-12 md:py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* 1. Centered Search Bar at the very top (comfortable and spacious) */}
        <div className="w-full flex justify-center pt-1 pb-1">
          <div className="relative w-full max-w-xl">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search logs by name..."
              className="w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl pl-12 pr-12 py-3.5 text-sm text-[#171717] placeholder-[#737373] shadow-xs focus:outline-none focus:border-[#008AD6] focus:ring-2 focus:ring-[#008AD6]/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#737373] hover:text-[#171717] px-2 py-1 rounded-md hover:bg-neutral-100 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Page Header with Sync, Lock, and Create Key */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#171717]">
              My Vault
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              Zero-knowledge encrypted logs, credentials, and hardware keys.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={syncWithServer}
              title="Sync with cloud relay"
              className="h-10 px-3.5 border border-[#E5E5E5] rounded-xl text-[#737373] hover:text-[#171717] hover:bg-[#F5F5F5] transition-colors cursor-pointer text-xs font-medium flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin text-[#008AD6]' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button
              onClick={lockVault}
              className="h-10 px-4 border border-[#E5E5E5] rounded-xl text-[#171717] hover:bg-[#F5F5F5] transition-colors cursor-pointer text-xs font-medium flex items-center gap-2"
            >
              <Lock className="w-4 h-4 text-[#737373]" />
              <span>Lock Vault</span>
            </button>
            <button
              onClick={onAddNew}
              className="h-10 px-4.5 bg-[#171717] hover:bg-[#262626] text-white font-medium rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              <span>Create key</span>
            </button>
          </div>
        </div>

        {/* 2. Collections Cards at the Top (spacious, comfortable cards) */}
        <div>
          <div className="text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">
            Key Collections
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* All Logs Card */}
            <div
              onClick={() => handleCardClick('all')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                selectedType === 'all'
                  ? 'bg-[#171717] text-white border-[#171717] shadow-xs ring-2 ring-[#171717]/10'
                  : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#171717] hover:bg-[#F9F9F9] hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                  selectedType === 'all' ? 'bg-[#2B2B2B] text-white' : 'bg-neutral-100 text-[#737373]'
                }`}>
                  ALL
                </span>
                <Layers className={`w-5 h-5 ${selectedType === 'all' ? 'text-white' : 'text-[#737373]'}`} />
              </div>
              <div className="font-bold text-2xl sm:text-3xl tracking-tight">{totalCount}</div>
              <div className={`text-xs sm:text-sm font-medium mt-1 ${selectedType === 'all' ? 'text-neutral-300' : 'text-[#737373]'}`}>
                All Logs
              </div>
            </div>

            {/* Logins Card */}
            <div
              onClick={() => handleCardClick('login')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                selectedType === 'login'
                  ? 'bg-[#171717] text-white border-[#171717] shadow-xs ring-2 ring-[#171717]/10'
                  : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#171717] hover:bg-[#F9F9F9] hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                  selectedType === 'login' ? 'bg-[#2B2B2B] text-white' : 'bg-[#EBF5FB] text-[#008AD6]'
                }`}>
                  LOG
                </span>
                <KeyRound className={`w-5 h-5 ${selectedType === 'login' ? 'text-white' : 'text-[#008AD6]'}`} />
              </div>
              <div className="font-bold text-2xl sm:text-3xl tracking-tight">{loginCount}</div>
              <div className={`text-xs sm:text-sm font-medium mt-1 ${selectedType === 'login' ? 'text-neutral-300' : 'text-[#737373]'}`}>
                Logins
              </div>
            </div>

            {/* Devices Card */}
            <div
              onClick={() => handleCardClick('device')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                selectedType === 'device'
                  ? 'bg-[#171717] text-white border-[#171717] shadow-xs ring-2 ring-[#171717]/10'
                  : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#171717] hover:bg-[#F9F9F9] hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                  selectedType === 'device' ? 'bg-[#2B2B2B] text-white' : 'bg-neutral-100 text-[#737373]'
                }`}>
                  DEV
                </span>
                <Laptop className={`w-5 h-5 ${selectedType === 'device' ? 'text-white' : 'text-[#737373]'}`} />
              </div>
              <div className="font-bold text-2xl sm:text-3xl tracking-tight">{deviceCount}</div>
              <div className={`text-xs sm:text-sm font-medium mt-1 ${selectedType === 'device' ? 'text-neutral-300' : 'text-[#737373]'}`}>
                Devices
              </div>
            </div>

            {/* Notes Card */}
            <div
              onClick={() => handleCardClick('note')}
              className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                selectedType === 'note'
                  ? 'bg-[#171717] text-white border-[#171717] shadow-xs ring-2 ring-[#171717]/10'
                  : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#171717] hover:bg-[#F9F9F9] hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 rounded-md ${
                  selectedType === 'note' ? 'bg-[#2B2B2B] text-white' : 'bg-neutral-100 text-[#737373]'
                }`}>
                  NOTE
                </span>
                <FileText className={`w-5 h-5 ${selectedType === 'note' ? 'text-white' : 'text-[#737373]'}`} />
              </div>
              <div className="font-bold text-2xl sm:text-3xl tracking-tight">{noteCount}</div>
              <div className={`text-xs sm:text-sm font-medium mt-1 ${selectedType === 'note' ? 'text-neutral-300' : 'text-[#737373]'}`}>
                Notes
              </div>
            </div>
          </div>
        </div>

        {/* 3. List of All Logs, comfortable rows, paginated defaulting to 15 */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs font-semibold text-[#737373] uppercase tracking-wider">
              {searchQuery
                ? `Search Results for "${searchQuery}" (${filteredItems.length})`
                : selectedType !== 'all'
                ? `${selectedType.toUpperCase()} Logs (${filteredItems.length})`
                : `All Logs (${filteredItems.length})`}
            </div>

            {filteredItems.length > 0 && (
              <span className="text-xs text-[#737373] font-mono">
                Showing {Math.min((validCurrentPage - 1) * pageSize + 1, filteredItems.length)}–
                {Math.min(validCurrentPage * pageSize, filteredItems.length)} of {filteredItems.length}
              </span>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-14 border border-[#E5E5E5] rounded-2xl bg-[#FAFAFA] text-center space-y-3.5">
              <Shield className="w-9 h-9 text-[#A3A3A3] mx-auto stroke-[1.5]" />
              <p className="text-base font-semibold text-[#171717]">No logs found</p>
              <p className="text-sm text-[#737373] max-w-sm mx-auto leading-relaxed">
                {searchQuery
                  ? `No logs match the query "${searchQuery}". Try a different search term or clear the filter.`
                  : 'Your zero-knowledge vault is empty. Click "+ Create key" above to save your first credential.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-[#FFFFFF] border border-[#E5E5E5] text-xs font-semibold rounded-xl text-[#171717] hover:bg-[#F5F5F5] cursor-pointer"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  onClick={onAddNew}
                  className="px-5 py-2.5 bg-[#171717] text-white rounded-xl text-xs font-semibold hover:bg-[#262626] cursor-pointer"
                >
                  Create your first key
                </button>
              )}
            </div>
          ) : (
            <div className="border border-[#E5E5E5] rounded-2xl bg-[#FFFFFF] divide-y divide-[#E5E5E5] overflow-hidden shadow-xs">
              {paginatedItems.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className="flex items-center justify-between px-5 py-4 hover:bg-[#F9F9F9] transition-colors cursor-pointer select-none group"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-4">
                    {/* Blue outline checkbox / key badge matching screenshot */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[#008AD6] bg-[#EBF5FB] border border-[#BCE1F5] shrink-0">
                      {item.type === 'device' ? (
                        <Laptop className="w-4 h-4 text-[#008AD6]" />
                      ) : item.type === 'note' ? (
                        <FileText className="w-4 h-4 text-[#008AD6]" />
                      ) : (
                        <KeyRound className="w-4 h-4 text-[#008AD6]" />
                      )}
                    </div>

                    {/* Monospace Code / Identifier */}
                    <span className="font-mono text-xs text-[#525252] bg-neutral-100 px-2 py-0.5 rounded shrink-0 font-medium select-all">
                      {getItemCode(item, idx)}
                    </span>

                    {/* Item Name */}
                    <span className="font-medium text-sm text-[#171717] truncate max-w-xs md:max-w-md">
                      {item.name}
                    </span>

                    {/* Username or URL */}
                    <span className="text-xs text-[#737373] hidden sm:inline truncate font-mono ml-1">
                      {item.fields?.username || item.fields?.url || ''}
                    </span>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Hover copy action */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(item.fields?.key || item.fields?.password) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.fields?.key || item.fields?.password || '', 'Key');
                          }}
                          title="Copy Key"
                          className="p-1.5 text-[#737373] hover:text-[#171717] rounded-lg hover:bg-neutral-200 transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Pale Blue Status Badge matching screenshot */}
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide bg-[#EBF5FB] text-[#008AD6] border border-[#BCE1F5]">
                      {getStatusBadge(item)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4. Pagination Controls (comfortable sizing, defaults to 15 items per page) */}
          {filteredItems.length > pageSize && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 px-2">
              <div className="flex items-center gap-2.5 text-xs text-[#737373]">
                <span>Logs per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#008AD6]"
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg text-xs font-medium text-[#171717] hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((pageNum) => {
                      return (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        Math.abs(pageNum - validCurrentPage) <= 1
                      );
                    })
                    .map((pageNum, idx, arr) => {
                      const showEllipsis = idx > 0 && pageNum - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={pageNum}>
                          {showEllipsis && (
                            <span className="px-1 text-xs text-[#737373]">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                              validCurrentPage === pageNum
                                ? 'bg-[#171717] text-white font-semibold'
                                : 'border border-[#E5E5E5] text-[#171717] hover:bg-[#F5F5F5]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="px-3 py-1.5 border border-[#E5E5E5] rounded-lg text-xs font-medium text-[#171717] hover:bg-[#F5F5F5] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
