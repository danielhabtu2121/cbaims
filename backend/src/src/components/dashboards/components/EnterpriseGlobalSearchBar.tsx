import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  User,
  CreditCard,
  Shield,
  ExternalLink,
  X,
  Loader2,
  Building,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { EnterpriseSearchResponse } from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface EnterpriseGlobalSearchBarProps {
  userId?: string;
  segment?: string;
  district?: string;
  branch?: string;
  onDrillToCustomer?: (cif: string) => void;
  onDrillToFacility?: (facilityId: string) => void;
  onDrillToCollateral?: (collateralId: string) => void;
  className?: string;
}

export const EnterpriseGlobalSearchBar: React.FC<EnterpriseGlobalSearchBarProps> = ({
  userId,
  segment,
  district,
  branch,
  onDrillToCustomer,
  onDrillToFacility,
  onDrillToCollateral,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EnterpriseSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: '/' or 'Ctrl+K' focuses search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search (300ms)
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await cimsApi.getDashboardEnterpriseSearch(query.trim(), {
          userId,
          segment: segment && segment !== 'ALL' ? segment : undefined,
          district: district && district !== 'ALL' ? district : undefined,
          branch: branch && branch !== 'ALL' ? branch : undefined,
        });
        setResults(res);
        setIsOpen(true);
      } catch (err) {
        console.error('Enterprise search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, userId, segment, district, branch]);

  const handleSelectCustomer = (cif: string) => {
    setIsOpen(false);
    setQuery('');
    if (onDrillToCustomer) onDrillToCustomer(cif);
  };

  const handleSelectFacility = (facId: string) => {
    setIsOpen(false);
    setQuery('');
    if (onDrillToFacility) onDrillToFacility(facId);
  };

  const handleSelectCollateral = (colId: string) => {
    setIsOpen(false);
    setQuery('');
    if (onDrillToCollateral) onDrillToCollateral(colId);
  };

  const totalHits = results ? (results.customers.length + results.facilities.length + results.collaterals.length) : 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#2C6295]" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="⚡ Instant Enterprise Search (CIF, Borrower Name, Loan Ref, Collateral Code)..."
          className="w-full pl-10 pr-20 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs font-medium text-[#101828] placeholder-slate-400 focus:outline-hidden focus:border-[#2C6295] focus:ring-2 focus:ring-[#2C6295]/10 shadow-xs transition-all"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                setResults(null);
                setIsOpen(false);
              }}
              className="p-1 hover:text-slate-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-500 font-sans">
              /
            </span>
          )}
        </div>
      </div>

      {/* Instant Dropdown Popover */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#CBD5E1] rounded-2xl shadow-xl z-50 overflow-hidden max-h-[520px] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">
              Enterprise Results for <strong className="text-[#101828]">"{query}"</strong>
            </span>
            <span className="text-[11px] text-slate-400">
              {isLoading ? 'Searching database...' : `${totalHits} direct matches found`}
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100">
            {isLoading && !results && (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#2C6295]" />
                <span>Scanning 500,000+ customer, loan, and collateral records...</span>
              </div>
            )}

            {!isLoading && totalHits === 0 && (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-1">
                <AlertTriangle className="w-6 h-6 text-amber-500 mb-1" />
                <span className="font-bold text-slate-700">No matching enterprise entities found</span>
                <span className="text-[11px] text-slate-400">Try searching by Customer CIF (e.g. CIF-000102), Loan Reference, or Collateral Code</span>
              </div>
            )}

            {/* CUSTOMERS SECTION */}
            {results && results.customers.length > 0 && (
              <div className="p-3">
                <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3 h-3 text-[#2C6295]" />
                  <span>Corporate & Retail Customers ({results.customers.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.customers.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust.cif || cust.id)}
                      className="px-3 py-2 hover:bg-[#EFF5FB] rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-[#1F4E7A] rounded-lg border border-blue-100 group-hover:bg-[#1F4E7A] group-hover:text-white transition-colors">
                          <Building className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#101828] group-hover:text-[#1F4E7A] transition-colors">
                            {cust.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-medium text-slate-700">{cust.cif}</span>
                            <span>•</span>
                            <span>{cust.segment}</span>
                            <span>•</span>
                            <span>{cust.branch}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs font-bold text-[#1F4E7A]">
                            ETB {((cust.totalExposure || 0) / 1e6).toFixed(2)}M Exp.
                          </div>
                          <div className="text-[10px] text-slate-500">
                            ETB {((cust.totalCollateralValue || 0) / 1e6).toFixed(2)}M Col.
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-[#1F4E7A] transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FACILITIES SECTION */}
            {results && results.facilities.length > 0 && (
              <div className="p-3">
                <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3 text-emerald-600" />
                  <span>Credit Facilities & Loans ({results.facilities.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.facilities.map((fac) => (
                    <div
                      key={fac.id}
                      onClick={() => handleSelectFacility(fac.id)}
                      className="px-3 py-2 hover:bg-emerald-50/50 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#101828] group-hover:text-emerald-700 transition-colors flex items-center gap-2">
                            <span>{fac.loanReference}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                              {fac.facilityType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{fac.customerName || fac.customerId}</span>
                            <span>•</span>
                            <span>{fac.branch}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs font-bold text-emerald-700">
                            ETB {Number(fac.outstandingBalance || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Limit: ETB {Number(fac.approvedAmount || 0).toLocaleString()}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-emerald-700 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COLLATERALS SECTION */}
            {results && results.collaterals.length > 0 && (
              <div className="p-3">
                <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-[#2C6295]" />
                  <span>Pledged Collateral Assets ({results.collaterals.length})</span>
                </div>
                <div className="space-y-1 mt-1">
                  {results.collaterals.map((col) => (
                    <div
                      key={col.id}
                      onClick={() => handleSelectCollateral(col.id)}
                      className="px-3 py-2 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-[#1F4E7A] rounded-lg border border-blue-100 group-hover:bg-[#1F4E7A] group-hover:text-white transition-colors">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#101828] group-hover:text-[#1F4E7A] transition-colors flex items-center gap-2">
                            <span>{col.code}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                              {col.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="truncate max-w-[240px]">{col.description}</span>
                            <span>•</span>
                            <span>Owner: {col.customerName || col.customerId}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            ETB {Number(col.marketValue || 0).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            Net: ETB {Number(col.netValue || 0).toLocaleString()}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-[#1F4E7A] transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">ESC</kbd> to close</span>
            <span>Click any entity to jump straight into its 360° deep-dive</span>
          </div>
        </div>
      )}
    </div>
  );
};
