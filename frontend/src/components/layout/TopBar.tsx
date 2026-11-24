import { formatEtbNumber } from '../../utils/format.ts';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Shield,
  Bell,
  CheckSquare,
  Search,
  User,
  Key,
  UserCheck,
  LogOut,
  ChevronDown,
  RefreshCw,
  X,
  Users,
  CreditCard,
  Building2,
  FileText,
  AlertTriangle,
  ArrowRight,
  Globe,
  Building,
} from 'lucide-react';
import {
  UserSession,
  Customer,
  LoanAccount,
  Collateral,
  InsurancePolicy,
  OwnershipDocument,
  CimsException,
} from '../../types';

interface TopBarProps {
  currentUser: UserSession;
  selectedSegment: string;
  onSelectSegment: (segment: string) => void;
  availableSegments: string[];
  unreadNotificationCount: number;
  pendingApprovalCount: number;
  onOpenNotifications: () => void;
  onOpenApprovals: () => void;
  onChangePassword: () => void;
  onDelegateAuthority: () => void;
  onLogout: () => void;
  onGlobalSearch?: (query: string) => void;
  customers?: Customer[];
  facilities?: LoanAccount[];
  collaterals?: Collateral[];
  policies?: InsurancePolicy[];
  documents?: OwnershipDocument[];
  exceptions?: CimsException[];
  onNavigate?: (page: string, params?: Record<string, any>) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  selectedSegment,
  onSelectSegment,
  availableSegments,
  unreadNotificationCount,
  pendingApprovalCount,
  onOpenNotifications,
  onOpenApprovals,
  onChangePassword,
  onDelegateAuthority,
  onLogout,
  onGlobalSearch,
  customers = [],
  facilities = [],
  collaterals = [],
  policies = [],
  documents = [],
  exceptions = [],
  onNavigate,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close flyout & user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFlyoutOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute search results across all entities
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2) {
      return {
        customers: [],
        facilities: [],
        collaterals: [],
        policies: [],
        documents: [],
        exceptions: [],
        totalCount: 0,
      };
    }
    const tokens = query.split(/\s+/).filter(Boolean);

    const matchesTokens = (fields: (string | number | null | undefined)[]) => {
      const combined = fields.filter((f) => f !== null && f !== undefined).join(' ').toLowerCase();
      return tokens.every((token) => combined.includes(token));
    };

    const matchedCust = (customers || [])
      .filter((c) =>
        matchesTokens([
          c.cif,
          c.name,
          c.taxIdNo,
          c.nationalId,
          c.businessRegNo,
          c.phone,
          c.email,
          c.segment,
          c.branch,
          c.customerType,
        ])
      )
      .slice(0, 5);

    const matchedFac = (facilities || [])
      .filter((f) =>
        matchesTokens([
          f.id,
          f.loanReference,
          f.lineCode,
          f.takedownAccountNumber,
          f.customerId,
          f.facilityType,
          f.segment,
          f.branch,
          f.status,
        ])
      )
      .slice(0, 5);

    const matchedCol = (collaterals || [])
      .filter((c) =>
        matchesTokens([
          c.id,
          c.code,
          c.description,
          c.titleDeedNumber,
          c.registrationNumber,
          c.chassisNumber,
          c.category,
          c.type,
          c.location,
          c.status,
          c.owningSegment,
          c.branch,
        ])
      )
      .slice(0, 5);

    const matchedPol = (policies || [])
      .filter((p) =>
        matchesTokens([
          p.id,
          p.policyNumber,
          p.insurerName,
          p.coverageType,
          p.collateralId,
          p.status,
          p.insuredAmount,
        ])
      )
      .slice(0, 5);

    const matchedDoc = (documents || [])
      .filter((d) =>
        matchesTokens([
          d.id,
          d.name,
          d.fileName,
          d.type,
          d.entityType,
          d.entityId,
          d.dmsRef,
          d.remarks,
        ])
      )
      .slice(0, 5);

    const matchedExc = (exceptions || [])
      .filter((e) =>
        matchesTokens([
          e.id,
          e.exceptionType,
          e.description,
          e.entityType,
          e.entityId,
          e.severity,
          e.status,
          e.assignedToRole,
          e.assignedToUser,
        ])
      )
      .slice(0, 5);

    const totalCount =
      matchedCust.length +
      matchedFac.length +
      matchedCol.length +
      matchedPol.length +
      matchedDoc.length +
      matchedExc.length;

    return {
      customers: matchedCust,
      facilities: matchedFac,
      collaterals: matchedCol,
      policies: matchedPol,
      documents: matchedDoc,
      exceptions: matchedExc,
      totalCount,
    };
  }, [searchQuery, customers, facilities, collaterals, policies, documents, exceptions]);

  const handleSelectResult = (page: string, params: Record<string, any>) => {
    if (onNavigate) {
      onNavigate(page, params);
    }
    setIsFlyoutOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsFlyoutOpen(false);
    } else if (e.key === 'Enter') {
      if (searchResults.totalCount > 0) {
        if (searchResults.customers.length > 0) {
          const c = searchResults.customers[0];
          handleSelectResult('customers', { customerId: c.cif || c.id });
        } else if (searchResults.facilities.length > 0) {
          const f = searchResults.facilities[0];
          handleSelectResult('facilities', { facilityId: f.id });
        } else if (searchResults.collaterals.length > 0) {
          const col = searchResults.collaterals[0];
          handleSelectResult('collateral', { collateralId: col.id });
        } else if (searchResults.policies.length > 0) {
          const pol = searchResults.policies[0];
          handleSelectResult('insurance', { policyId: pol.id });
        } else if (searchResults.documents.length > 0) {
          const doc = searchResults.documents[0];
          handleSelectResult('documents', { id: doc.id });
        } else if (searchResults.exceptions.length > 0) {
          const exc = searchResults.exceptions[0];
          handleSelectResult('exceptions', { id: exc.id });
        }
      }
    }
  };

  // Segment authority comes only from the persisted backend user scope.
  const userSegmentList = (currentUser.allowedSegments && currentUser.allowedSegments.length > 0
    ? currentUser.allowedSegments
    : (currentUser.segmentIds || []));
  const segmentList = userSegmentList.length > 0
    ? userSegmentList
    : (currentUser.segment ? [currentUser.segment] : []);
  const bankWide = currentUser.bankWide === true;
  const canSelectSegment = bankWide || segmentList.length > 1;
  const segmentOptions = bankWide
    ? (availableSegments && availableSegments.length > 0 ? availableSegments : segmentList)
    : segmentList;

  const userInitials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 bg-[#00205B] text-white flex items-center justify-between px-4 sm:px-6 border-b border-[#143666] sticky top-0 z-40 select-none shadow-xs">
      {/* Left side: Segment Chip / Scope Selector */}
      <div className="flex items-center gap-3">
        {canSelectSegment ? (
          <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-2.5 py-1 shadow-xs transition-colors">
            <Globe className="w-3.5 h-3.5 text-[#D48806] shrink-0" />
            <span className="text-[11px] text-blue-200 font-semibold hidden sm:inline">Segment:</span>
            <select
              value={selectedSegment}
              onChange={(e) => onSelectSegment(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold cursor-pointer outline-none focus:ring-0 border-none py-0.5 pr-2"
              title="Filter entire application data by Business Segment"
            >
              {bankWide && (
                <option value="ALL" className="bg-[#00205B] text-white">
                  All Authorized Segments
                </option>
              )}
              {segmentOptions.map((seg) => (
                <option key={seg} value={seg} className="bg-[#00205B] text-white">
                  {seg}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            title="Authorized Segment (Locked to Your Assigned Role & Jurisdiction Scope)"
            className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white shadow-xs"
          >
            <Building className="w-3.5 h-3.5 text-[#D48806] shrink-0" />
            <span className="hidden sm:inline text-[11px] font-medium text-blue-200">Segment:</span>
            <span className="font-semibold text-white">{currentUser.segment || selectedSegment || 'Corporate Banking'}</span>
            <span className="text-[10px] text-blue-200/80" title="Organizational scope locked">🔒</span>
          </div>
        )}

        {/* Authorized organizational hierarchy from the backend user assignment. */}
        <div
          className="hidden lg:flex items-center gap-1.5 text-[10px] text-blue-100/90 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1"
          title="Your authorized scope: District Office → Branches → Customers"
        >
          <Building2 className="w-3 h-3 text-[#D48806] shrink-0" />
          <span className="font-semibold">{currentUser.district || 'Head Office'}</span>
          <span className="text-blue-300">→</span>
          <span className="font-semibold">{currentUser.branch || 'All Branches'}</span>
          <span className="text-blue-300">→</span>
          <span>Customers in scope</span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div
        ref={searchContainerRef}
        className="flex-1 max-w-md mx-4 sm:mx-8 relative"
      >
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-blue-200 pointer-events-none" />
          <input
            type="text"
            placeholder="Search CIF, Facility, Collateral, Policy, Document..."
            value={searchQuery}
            onFocus={() => setIsFlyoutOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsFlyoutOpen(true);
              if (onGlobalSearch) onGlobalSearch(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 hover:border-white/30 focus:border-[#D48806] focus:ring-2 focus:ring-[#D48806]/25 rounded-lg py-1.5 pl-9 pr-9 text-xs text-white placeholder:text-white/60 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsFlyoutOpen(false);
                if (onGlobalSearch) onGlobalSearch('');
              }}
              className="absolute right-2.5 text-blue-200 hover:text-white p-0.5 rounded transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Global Search Results Flyout Popover */}
        {isFlyoutOpen && searchQuery.trim().length >= 2 && (
          <div className="absolute top-full left-0 mt-2 w-full min-w-[340px] sm:min-w-[480px] max-h-96 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-y-auto text-slate-800 animate-fadeIn custom-scrollbar">
            {/* Header info bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs">
              <span className="text-slate-600">
                Matches for: <strong className="text-slate-900 font-bold">"{searchQuery}"</strong>
              </span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-[11px] ${searchResults.totalCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                }`}>
                {searchResults.totalCount} {searchResults.totalCount === 1 ? 'result' : 'results'}
              </span>
            </div>

            {/* Empty state in search */}
            {searchResults.totalCount === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <div className="text-sm font-semibold text-slate-700">No records found</div>
                <div className="text-xs text-slate-400 mt-1">
                  Try searching by CIF number, title deed reference, or loan ID.
                </div>
              </div>
            ) : (
              <div className="p-2 space-y-3">
                {/* Customers */}
                {searchResults.customers.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-blue-700" />
                      <span>Customers ({searchResults.customers.length})</span>
                    </div>
                    {searchResults.customers.map((c) => (
                      <div
                        key={c.id || c.cif}
                        onClick={() => handleSelectResult('customers', { customerId: c.cif || c.id })}
                        className="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-blue-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                            <Users className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">{c.name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>CIF: <strong className="text-blue-700 font-mono">{c.cif}</strong></span>
                              {c.branch && <span>• {c.branch}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Facilities */}
                {searchResults.facilities.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3 text-emerald-600" />
                      <span>Facilities &amp; Loans ({searchResults.facilities.length})</span>
                    </div>
                    {searchResults.facilities.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => handleSelectResult('facilities', { facilityId: f.id })}
                        className="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-emerald-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <CreditCard className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {f.loanReference || f.lineCode || f.id}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>{f.facilityType || 'Loan'}</span>
                              {f.approvedLimit && <span>• ETB {formatEtbNumber(Number(f.approvedLimit))}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Collaterals */}
                {searchResults.collaterals.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-amber-600" />
                      <span>Collateral Assets ({searchResults.collaterals.length})</span>
                    </div>
                    {searchResults.collaterals.map((col) => (
                      <div
                        key={col.id}
                        onClick={() => handleSelectResult('collateral', { collateralId: col.id })}
                        className="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-amber-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                            <Building2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {col.code} — {col.description || col.category}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>{col.category}</span>
                              {col.valuationAmount && <span>• ETB {formatEtbNumber(Number(col.valuationAmount))}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Policies */}
                {searchResults.policies.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-indigo-600" />
                      <span>Insurance Policies ({searchResults.policies.length})</span>
                    </div>
                    {searchResults.policies.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectResult('insurance', { policyId: p.id })}
                        className="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-indigo-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {p.policyNumber} — {p.insurerName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              <span>{p.coverageType}</span>
                              {p.insuredAmount && <span> • ETB {formatEtbNumber(Number(p.insuredAmount))}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents & Exceptions */}
                {searchResults.documents.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-purple-600" />
                      <span>Documents ({searchResults.documents.length})</span>
                    </div>
                    {searchResults.documents.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => handleSelectResult('documents', { id: d.id, entityId: d.entityId })}
                        className="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-purple-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">{d.name || d.fileName}</div>
                            <div className="text-[11px] text-slate-500">{d.type}</div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {searchResults.exceptions.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>Exceptions ({searchResults.exceptions.length})</span>
                    </div>
                    {searchResults.exceptions.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => handleSelectResult('exceptions', { id: e.id, entityId: e.entityId })}
                        className="px-3 py-2 rounded-lg flex items-center justify-between cursor-pointer hover:bg-rose-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-md bg-rose-100 text-rose-800 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {e.exceptionType} — {e.entityType} ({e.entityId})
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Severity: <strong className="text-rose-700">{e.severity}</strong> • {e.description}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer with shortcut hints */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 select-none">
              <span>Press <strong className="text-slate-700">Enter</strong> to open first • <strong className="text-slate-700">Esc</strong> to close</span>
              <span className="text-blue-700 font-semibold">Dashen Global Index</span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Action Badges & User Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Approvals Quick Access Button */}
        {currentUser.canApprove && (
          <button
            onClick={onOpenApprovals}
            className="relative p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Approvals Inbox"
            aria-label="Approvals Inbox"
          >
            <CheckSquare className="w-4 h-4" />
            {pendingApprovalCount > 0 && (
              <span className="absolute top-1 right-1 bg-[#D48806] text-white text-[9px] font-bold rounded-full px-1.5 py-0.2 leading-tight shadow-xs">
                {pendingApprovalCount}
              </span>
            )}
          </button>
        )}

        {/* Notifications Button */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Notification Center"
          aria-label="Notification Center"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.2 leading-tight shadow-xs animate-pulse">
              {unreadNotificationCount}
            </span>
          )}
        </button>

        {/* User Profile Chip & Dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors text-left"
            aria-expanded={showUserMenu}
          >
            {/* Initials Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1B4580] to-[#25589E] border border-blue-300/40 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {userInitials}
            </div>

            <div className="hidden md:block leading-tight">
              <div className="text-xs font-bold text-white truncate max-w-[120px]">{currentUser.name}</div>
              <div className="text-[10px] text-[#D48806] font-semibold">{currentUser.role}</div>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-blue-200" />
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-1 text-slate-800 z-50 animate-fadeIn">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 rounded-t-xl">
                <div className="text-xs font-bold text-slate-900">{currentUser.name}</div>
                <div className="text-[11px] text-blue-700 font-semibold">{currentUser.roleName || currentUser.role}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{currentUser.branch}</div>
              </div>

              <div className="p-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onChangePassword();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors text-left"
                >
                  <Key className="w-4 h-4 text-slate-500" />
                  <span>Change Password</span>
                </button>

                {currentUser.canApprove && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onDelegateAuthority();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors text-left"
                  >
                    <UserCheck className="w-4 h-4 text-slate-500" />
                    <span>Delegate Approval</span>
                  </button>
                )}

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left font-semibold"
                >
                  <LogOut className="w-4 h-4 text-red-600" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
