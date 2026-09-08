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

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '0.00';
    return new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #DCE4EE',
        boxShadow: '0 2px 8px rgba(14, 40, 78, 0.04)',
        overflow: 'hidden',
        marginTop: '24px',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #EEF2F7',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: '#FAFCFF',
        }}
      >
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0E284E', margin: 0 }}>
            {title}
          </h3>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
            {subtitle} ({rows.length} total records)
          </p>
        </div>

        {/* Search & Column Toggle Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search
              style={{
                position: 'absolute',
                left: '10px',
                top: '8px',
                width: '14px',
                height: '14px',
                color: '#94A3B8',
              }}
            />
            <input
              type="text"
              placeholder="Search Customer, CIF, Collateral, Policy..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                fontSize: '12px',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                outline: 'none',
              }}
            />
          </div>

          <button
            onClick={() => setShowExtendedCols(!showExtendedCols)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: showExtendedCols ? '#0E284E' : '#F1F5F9',
              color: showExtendedCols ? '#FFFFFF' : '#0F172A',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal style={{ width: '13px', height: '13px' }} />
            <span>{showExtendedCols ? 'Standard Columns' : 'All 24 Columns'}</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #DCE4EE', color: '#0E284E' }}>
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
                <td colSpan={showExtendedCols ? 13 : 9} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
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

                    {/* Extended Haircut / Net Security */}
                    {showExtendedCols && (
                      <>
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
