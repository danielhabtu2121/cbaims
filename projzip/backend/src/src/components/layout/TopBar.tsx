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
  allUsers: UserSession[];
  onSwitchUser: (user: UserSession) => void;
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
  allUsers,
  onSwitchUser,
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
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close flyout on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFlyoutOpen(false);
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

  const isBankWideRole = ['EXEC', 'SRMGMT', 'SYSADMIN', 'AUDITOR', 'COMPLIANCE', 'RISK', 'MGRCOLLDOC'].includes(currentUser.role);
  const isMultiSegmentRole = isBankWideRole || ['DISTDIR', 'BRMGR', 'BRO', 'CRO'].includes(currentUser.role);
  const userSegmentList = currentUser.segmentIds && currentUser.segmentIds.length > 0
    ? currentUser.segmentIds
    : (currentUser.segment ? [currentUser.segment] : ['Corporate Banking']);
  const canSelectSegment = isMultiSegmentRole || userSegmentList.length > 1;

  const segmentOptions = isMultiSegmentRole
    ? (availableSegments && availableSegments.length > 0 ? availableSegments : ['Corporate Banking', 'Retail Banking', 'MSME Banking', 'Interest-Free Banking (IFB)'])
    : userSegmentList;

  return (
    <header
      style={{
        height: '56px',
        backgroundColor: '#0E284E',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid #1B4580',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left side: Logo & Wordmark & Segment Chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              height: '38px',
              padding: '2px 4px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img
              src="/dashen-logo.png"
              alt="Dashen Bank Logo"
              style={{
                height: '34px',
                width: 'auto',
                objectFit: 'contain',
                borderRadius: '6px',
              }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.4px', color: '#FFFFFF' }}>
                DASHEN BANK
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px',
                }}
              >
                CBAIMS
              </span>
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#B9D3EB', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Collateral &amp; Bank Asset Insurance Management
            </div>
          </div>
        </div>

        {/* Business Segment Selector / Scope Badge */}
        {canSelectSegment ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <span style={{ fontSize: '11px', color: '#B9D3EB', fontWeight: 600 }}>Segment:</span>
            <select
              value={selectedSegment}
              onChange={(e) => onSelectSegment(e.target.value)}
              style={{
                backgroundColor: '#143666',
                color: '#FFFFFF',
                border: '1px solid #25589E',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              title="Filter entire application data by Business Segment"
            >
              {isMultiSegmentRole && (
                <option value="ALL" style={{ backgroundColor: '#0E284E', color: '#FFFFFF' }}>
                  🌐 All Segments {currentUser.role === 'BRMGR' ? '(Branch-Wide)' : currentUser.role === 'DISTDIR' ? '(District-Wide)' : '(Bank-Wide)'}
                </option>
              )}
              {segmentOptions.map((seg) => (
                <option key={seg} value={seg} style={{ backgroundColor: '#0E284E', color: '#FFFFFF' }}>
                  🏢 {seg}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            title="Authorized Segment (Locked to Your Assigned Role & Jurisdiction Scope)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '12px',
              backgroundColor: '#143666',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #1B4580',
              fontSize: '11px',
              color: '#B9D3EB',
            }}
          >
            <span>Segment:</span>
            <strong style={{ color: '#FFFFFF' }}>{currentUser.segment || selectedSegment || 'Corporate Banking'}</strong>
            <span style={{ fontSize: '10px', opacity: 0.8 }} title="Organizational scope locked">🔒</span>
          </div>
        )}
      </div>

      {/* Center: Global Search */}
      <div
        ref={searchContainerRef}
        style={{ flex: 1, maxWidth: '460px', margin: '0 24px', position: 'relative' }}
      >
        <Search
          style={{
            position: 'absolute',
            left: '10px',
            top: '9px',
            width: '14px',
            height: '14px',
            color: '#B9D3EB',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Global Search (CIF, Policy #, Collateral ID, Reg No)..."
          value={searchQuery}
          onFocus={() => setIsFlyoutOpen(true)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsFlyoutOpen(true);
            if (onGlobalSearch) onGlobalSearch(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            backgroundColor: '#143666',
            border: isFlyoutOpen ? '1px solid #60A5FA' : '1px solid #1B4580',
            borderRadius: '6px',
            padding: '7px 28px 7px 32px',
            fontSize: '12px',
            color: '#FFFFFF',
            outline: 'none',
            boxShadow: isFlyoutOpen ? '0 0 0 2px rgba(96, 165, 250, 0.25)' : 'none',
            transition: 'all 0.15s ease-in-out',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setIsFlyoutOpen(false);
              if (onGlobalSearch) onGlobalSearch('');
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '8px',
              background: 'transparent',
              border: 'none',
              color: '#B9D3EB',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Clear search"
          >
            <X style={{ width: '13px', height: '13px' }} />
          </button>
        )}

        {/* Global Search Results Flyout */}
        {isFlyoutOpen && searchQuery.trim().length >= 2 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              width: '540px',
              maxHeight: '440px',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              zIndex: 9999,
              overflowY: 'auto',
              color: '#101828',
            }}
          >
            {/* Header info bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                fontSize: '11px',
                color: '#64748B',
              }}
            >
              <span>
                Search results for: <strong style={{ color: '#0F172A' }}>"{searchQuery}"</strong>
              </span>
              <span style={{ fontWeight: 600, color: searchResults.totalCount > 0 ? '#0284C7' : '#DC2626' }}>
                {searchResults.totalCount} {searchResults.totalCount === 1 ? 'match' : 'matches'} found
              </span>
            </div>

            {/* Results sections */}
            {searchResults.totalCount === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                <Search style={{ width: '28px', height: '28px', margin: '0 auto 8px', color: '#94A3B8' }} />
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>No matches found</div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: '#64748B' }}>
                  No customer, facility, collateral, policy, document, or exception matched your query.
                </div>
              </div>
            ) : (
              <div style={{ padding: '6px 0' }}>
                {/* Customers */}
                {searchResults.customers.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users style={{ width: '12px', height: '12px' }} />
                      Customers ({searchResults.customers.length})
                    </div>
                    {searchResults.customers.map((c) => (
                      <div
                        key={c.id || c.cif}
                        onClick={() => handleSelectResult('customers', { customerId: c.cif || c.id })}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EFF6FF')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#DBEAFE', color: '#1E40AF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Users style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', gap: '6px' }}>
                              <span>CIF: <strong style={{ color: '#1E40AF' }}>{c.cif}</strong></span>
                              {c.segment && <span>• {c.segment}</span>}
                              {c.branch && <span>• {c.branch}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', color: '#334155', fontWeight: 600 }}>
                            {c.status || 'Active'}
                          </span>
                          <ArrowRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Facilities */}
                {searchResults.facilities.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard style={{ width: '12px', height: '12px' }} />
                      Loan Facilities ({searchResults.facilities.length})
                    </div>
                    {searchResults.facilities.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => handleSelectResult('facilities', { facilityId: f.id })}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ECFDF5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#D1FAE5', color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <CreditCard style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {f.loanReference || f.lineCode || f.id}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', gap: '6px' }}>
                              <span>{f.facilityType || 'Loan'}</span>
                              {f.approvedLimit && <span>• ETB {Number(f.approvedLimit).toLocaleString()}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ECFDF5', color: '#047857', fontWeight: 600 }}>
                            {f.status || 'Active'}
                          </span>
                          <ArrowRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Collaterals */}
                {searchResults.collaterals.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building2 style={{ width: '12px', height: '12px' }} />
                      Collateral Assets ({searchResults.collaterals.length})
                    </div>
                    {searchResults.collaterals.map((col) => (
                      <div
                        key={col.id}
                        onClick={() => handleSelectResult('collateral', { collateralId: col.id })}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF3C7')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FDE68A', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Building2 style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {col.code} — {col.description || col.category}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', gap: '6px' }}>
                              <span>Category: {col.category}</span>
                              {col.registrationNumber && <span>• Reg: {col.registrationNumber}</span>}
                              {col.valuationAmount && <span>• ETB {Number(col.valuationAmount).toLocaleString()}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                            {col.status || 'Active'}
                          </span>
                          <ArrowRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Policies */}
                {searchResults.policies.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield style={{ width: '12px', height: '12px' }} />
                      Insurance Policies ({searchResults.policies.length})
                    </div>
                    {searchResults.policies.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectResult('insurance', { policyId: p.id })}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EEF2FF')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#E0E7FF', color: '#3730A3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Shield style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.policyNumber} — {p.insurerName}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', gap: '6px' }}>
                              <span>{p.coverageType}</span>
                              {p.collateralId && <span>• Collateral: {p.collateralId}</span>}
                              {p.insuredAmount && <span>• Sum: ETB {Number(p.insuredAmount).toLocaleString()}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#EEF2FF', color: '#4338CA', fontWeight: 600 }}>
                            {p.status || 'Active'}
                          </span>
                          <ArrowRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents */}
                {searchResults.documents.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, color: '#6B21A8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText style={{ width: '12px', height: '12px' }} />
                      DMS Documents ({searchResults.documents.length})
                    </div>
                    {searchResults.documents.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => handleSelectResult('documents', { id: d.id, entityId: d.entityId })}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F3E8FF')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#F3E8FF', color: '#6B21A8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {d.name || d.fileName}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', gap: '6px' }}>
                              <span>{d.type}</span>
                              {d.entityId && <span>• Linked: {d.entityType} ({d.entityId})</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F3E8FF', color: '#7E22CE', fontWeight: 600 }}>
                            v{d.version || 1}
                          </span>
                          <ArrowRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Exceptions */}
                {searchResults.exceptions.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '4px 12px', fontSize: '10px', fontWeight: 700, color: '#9F1239', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle style={{ width: '12px', height: '12px' }} />
                      Exceptions &amp; Breaches ({searchResults.exceptions.length})
                    </div>
                    {searchResults.exceptions.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => handleSelectResult('exceptions', { id: e.id, entityId: e.entityId })}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FFE4E6')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#FFE4E6', color: '#9F1239', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AlertTriangle style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {e.exceptionType} — {e.entityType} ({e.entityId})
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', gap: '6px' }}>
                              <span>Severity: <strong style={{ color: e.severity === 'Critical' ? '#DC2626' : '#D97706' }}>{e.severity}</strong></span>
                              <span>• {e.description}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FFE4E6', color: '#BE123C', fontWeight: 600 }}>
                            {e.status}
                          </span>
                          <ArrowRight style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer with hint */}
            <div
              style={{
                padding: '6px 12px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#64748B',
              }}
            >
              <span>Press <strong style={{ color: '#0F172A' }}>Enter</strong> to navigate to first match • <strong style={{ color: '#0F172A' }}>Esc</strong> to dismiss</span>
              <span style={{ color: '#2563EB', fontWeight: 600 }}>Cross-Entity Search</span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Actions & User Persona */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Approvals Bell Icon with badge */}
        {currentUser.canApprove && (
          <button
            onClick={onOpenApprovals}
            style={{
              position: 'relative',
              background: 'transparent',
              border: 'none',
              color: '#B9D3EB',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
            title="Approvals Inbox"
          >
            <CheckSquare style={{ width: '18px', height: '18px' }} />
            {pendingApprovalCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: '#C0362C',
                  color: '#FFFFFF',
                  fontSize: '9px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '1px 4px',
                  minWidth: '14px',
                  textAlign: 'center',
                }}
              >
                {pendingApprovalCount}
              </span>
            )}
          </button>
        )}

        {/* Notifications Bell Icon with badge */}
        <button
          onClick={onOpenNotifications}
          style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            color: '#B9D3EB',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
          }}
          title="Notification Center"
        >
          <Bell style={{ width: '18px', height: '18px' }} />
          {unreadNotificationCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                backgroundColor: '#C0362C',
                color: '#FFFFFF',
                fontSize: '9px',
                fontWeight: 700,
                borderRadius: '9999px',
                padding: '1px 4px',
                minWidth: '14px',
                textAlign: 'center',
              }}
            >
              {unreadNotificationCount}
            </span>
          )}
        </button>

        {/* Switch Persona Fast-Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
            style={{
              backgroundColor: '#143666',
              color: '#FFFFFF',
              border: '1px solid #1B4580',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
            title="Switch Testing Role Persona"
          >
            <RefreshCw style={{ width: '12px', height: '12px', color: '#1E6FD9' }} />
            <span>Persona: {currentUser.role}</span>
            <ChevronDown style={{ width: '12px', height: '12px', opacity: 0.7 }} />
          </button>

          {showPersonaMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                marginTop: '6px',
                width: '260px',
                maxHeight: '340px',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                borderRadius: '8px',
                border: '1px solid #DCE4EE',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#5B6B82', padding: '6px 8px', borderBottom: '1px solid #DCE4EE' }}>
                Select Active Role Persona (16 Pre-Seeded Roles)
              </div>
              {allUsers.map((u) => (
                <button
                  key={u.userId}
                  onClick={() => {
                    onSwitchUser(u);
                    setShowPersonaMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: u.userId === currentUser.userId ? '#E8F0FA' : 'transparent',
                    color: u.userId === currentUser.userId ? '#08192E' : '#0F172A',
                    fontWeight: u.userId === currentUser.userId ? 700 : 400,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{u.name}</span>
                    <span style={{ fontSize: '10px', color: '#2E6FB8', fontWeight: 700 }}>{u.role}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#5B6B82' }}>{u.branch}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile Avatar Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: '#2E6FB8',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px',
              }}
            >
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)}
            </div>
            <div style={{ textAlign: 'left', display: 'none' }} className="md:block">
              <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2 }}>{currentUser.name}</div>
              <div style={{ fontSize: '10px', color: '#B9D3EB' }}>{currentUser.role}</div>
            </div>
            <ChevronDown style={{ width: '12px', height: '12px', opacity: 0.7 }} />
          </button>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                marginTop: '6px',
                width: '200px',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                borderRadius: '8px',
                border: '1px solid #DCE4EE',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: '6px',
                zIndex: 60,
              }}
            >
              <div style={{ padding: '8px', borderBottom: '1px solid #DCE4EE' }}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{currentUser.name}</div>
                <div style={{ fontSize: '11px', color: '#5B6B82' }}>{currentUser.role}</div>
                <div style={{ fontSize: '10px', color: '#5B6B82', marginTop: '2px' }}>{currentUser.branch}</div>
              </div>

              <div style={{ padding: '4px 0' }}>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onChangePassword();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    fontSize: '12px',
                    color: '#0F172A',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Key style={{ width: '14px', height: '14px', color: '#5B6B82' }} />
                  Change Password
                </button>

                {currentUser.canApprove && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onDelegateAuthority();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      fontSize: '12px',
                      color: '#0F172A',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <UserCheck style={{ width: '14px', height: '14px', color: '#5B6B82' }} />
                    Delegate Approval Authority
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    fontSize: '12px',
                    color: '#C0362C',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderTop: '1px solid #DCE4EE',
                    marginTop: '4px',
                  }}
                >
                  <LogOut style={{ width: '14px', height: '14px', color: '#C0362C' }} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
