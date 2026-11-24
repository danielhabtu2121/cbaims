import { formatEtb } from '../../utils/format';
import React, { useState, useMemo } from 'react';

import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Shield,
  FileText,
  AlertTriangle,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

import { DashboardPortfolioRow } from '../../types';

interface UniversalPortfolioTableProps {
  rows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
  title?: string;
  subtitle?: string;
  isReadOnly?: boolean;
}

export const UniversalPortfolioTable: React.FC<UniversalPortfolioTableProps> = ({
  rows,
  onNavigate,
  title = 'Universal Scoped Portfolio Risk & Compliance Matrix',
  subtitle = 'Individual collateral and linked credit facilities within current authorized jurisdiction (§19)',
  isReadOnly = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof DashboardPortfolioRow>('insuranceGap');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Column visibility toggles
  const [showExtendedCols, setShowExtendedCols] = useState(false);

  // Search & Filter
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        r.customerName?.toLowerCase().includes(q) ||
        r.cif?.toLowerCase().includes(q) ||
        r.collateralCode?.toLowerCase().includes(q) ||
        r.facilityRef?.toLowerCase().includes(q) ||
        r.policyNumber?.toLowerCase().includes(q) ||
        r.branch?.toLowerCase().includes(q) ||
        r.segment?.toLowerCase().includes(q)
      );
    });
  }, [rows, searchTerm]);

  // Sorting
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortField] ?? '';
      const bVal = b[sortField] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredRows, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (field: keyof DashboardPortfolioRow) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatCurrency = (amount?: number) => formatEtb(amount);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden mt-6">
      {/* Header Bar */}
      <div className="p-4 sm:px-6 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-[#00205B] m-0 tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {subtitle} ({rows.length} total records)
          </p>
        </div>

        {/* Search & Column Toggle Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Customer, CIF, Collateral..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#00205B]/20 focus:border-[#00205B] transition-all"
            />
          </div>

          <button
            onClick={() => setShowExtendedCols(!showExtendedCols)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showExtendedCols
                ? 'bg-[#00205B] text-white border-[#00205B] shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showExtendedCols ? 'Standard Columns' : 'All 24 Columns'}</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[#00205B] text-xs font-bold uppercase tracking-wider select-none">
              <th onClick={() => handleSort('customerName')} style={{ padding: '12px 14px', cursor: 'pointer', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Customer / CIF</span>
                  <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                </div>
              </th>

              {showExtendedCols && (
                <>
                  <th style={{ padding: '12px 10px', fontWeight: 700 }}>Segment</th>
                  <th style={{ padding: '12px 10px', fontWeight: 700 }}>Branch / Dist</th>
                </>
              )}

              <th onClick={() => handleSort('collateralCode')} style={{ padding: '12px 14px', cursor: 'pointer', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Collateral ID &amp; Type</span>
                  <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                </div>
              </th>

              <th onClick={() => handleSort('marketValue')} style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <span>Valuation (ETB)</span>
                  <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                </div>
              </th>

              {showExtendedCols && (
                <>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>Allocated Exposure</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>Allocated Security</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>Haircut %</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700 }}>Net Security</th>
                </>
              )}

              <th onClick={() => handleSort('insuranceRequired')} style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <span>Req. Sum Insured</span>
                  <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                </div>
              </th>

              <th onClick={() => handleSort('insuredAmount')} style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <span>Active Cover</span>
                  <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                </div>
              </th>

              <th onClick={() => handleSort('insuranceGap')} style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <span>Insurance Gap</span>
                  <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                </div>
              </th>

              <th onClick={() => handleSort('coveragePct')} style={{ padding: '12px 14px', textAlign: 'center', cursor: 'pointer', fontWeight: 700 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span>Coverage %</span>
                  <ArrowUpDown style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                </div>
              </th>

              <th style={{ padding: '12px 14px', fontWeight: 700 }}>Policy Status &amp; Expiry</th>
              <th style={{ padding: '12px 14px', fontWeight: 700 }}>Docs</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={showExtendedCols ? 15 : 9} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                  <Shield style={{ width: '32px', height: '32px', color: '#CBD5E1', margin: '0 auto 8px auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>No matching collateral records found in authorized scope.</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>Try clearing filters or switching business segments.</div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((r, idx) => {
                const isUnderinsured = r.insuranceGap > 0;
                const isAdequate = r.coveragePct >= 100;
                return (
                  <tr
                    key={r.collateralId || idx}
                    style={{
                      borderBottom: '1px solid #EEF2F7',
                      backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF',
                    }}
                  >
                    {/* Customer & CIF */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{r.customerName}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{r.cif}</div>
                    </td>

                    {/* Extended Scope Details */}
                    {showExtendedCols && (
                      <>
                        <td style={{ padding: '12px 10px', color: '#475569' }}>{r.segment}</td>
                        <td style={{ padding: '12px 10px', color: '#475569' }}>
                          <div>{r.branch}</div>
                          <div style={{ fontSize: '10px', color: '#94A3B8' }}>{r.district}</div>
                        </td>
                      </>
                    )}

                    {/* Collateral Code & Type */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0E284E' }}>{r.collateralCode}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        {r.collateralCategory} · {r.collateralType || r.ownershipType}
                      </div>
                    </td>

                    {/* Valuation */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                      {formatCurrency(r.marketValue)}
                    </td>

                    {/* Extended Allocation & Net Security Details */}
                    {showExtendedCols && (
                      <>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600, color: '#0E284E' }}>
                          {formatCurrency(r.allocatedExposure ?? r.outstandingExposure)}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600, color: '#0E284E' }}>
                          {formatCurrency(r.allocatedSecurity)}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', color: '#64748B' }}>
                          {r.haircut}%
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                          {formatCurrency(r.netSecurity)}
                        </td>
                      </>
                    )}

                    {/* Required Insurance */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#0E284E' }}>
                      {formatCurrency(r.insuranceRequired)}
                    </td>

                    {/* Active Insurance */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#15803D' }}>
                      {formatCurrency(r.insuredAmount)}
                    </td>

                    {/* Insurance Gap */}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isUnderinsured ? '#DC2626' : '#15803D',
                        }}
                      >
                        {formatCurrency(r.insuranceGap)}
                      </span>
                    </td>

                    {/* Coverage % Chip */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isAdequate ? '#DCFCE7' : isUnderinsured && r.insuredAmount > 0 ? '#FEF3C7' : '#FEE2E2',
                          color: isAdequate ? '#15803D' : isUnderinsured && r.insuredAmount > 0 ? '#B45309' : '#B91C1C',
                        }}
                      >
                        {r.coveragePct}%
                      </span>
                    </td>

                    {/* Policy Status & Expiry */}
                    <td style={{ padding: '12px 14px' }}>
                      {r.policyNumber ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{r.policyNumber}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>
                            {r.insurerName} · Exp: {r.expiryDate || 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>Uninsured</span>
                      )}
                    </td>

                    {/* Document Status */}
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: r.documentStatus === 'Complete' ? '#15803D' : r.documentStatus === 'Missing Mandatory' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {r.documentStatus}
                      </span>
                    </td>

                    {/* Actions Drill-down */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => onNavigate('collateral', { collateralId: r.collateralId, cif: r.cif })}
                        style={{
                          backgroundColor: '#F1F5F9',
                          border: '1px solid #CBD5E1',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#0E284E',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Open Collateral Record"
                      >
                        <Eye style={{ width: '12px', height: '12px' }} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #EEF2F7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#64748B',
        }}
      >
        <div>
          Showing {Math.min(sortedRows.length, (currentPage - 1) * pageSize + 1)} to{' '}
          {Math.min(sortedRows.length, currentPage * pageSize)} of {sortedRows.length} entries
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '4px 10px',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              backgroundColor: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              color: '#0F172A',
            }}
          >
            Previous
          </button>

          <span style={{ fontWeight: 600, color: '#0E284E', padding: '0 6px' }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '4px 10px',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              backgroundColor: currentPage === totalPages ? '#F1F5F9' : '#FFFFFF',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              color: '#0F172A',
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
