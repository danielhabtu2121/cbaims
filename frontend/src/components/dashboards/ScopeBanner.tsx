import React from 'react';
import {
  Building2,
  Calendar,
  Clock,
  RefreshCw,
  Download,
  Filter,
  Lock,
  ChevronRight,
  ShieldCheck,
  Globe,
  UserCheck,
} from 'lucide-react';
import { ScopeBannerData } from '../../types';

interface ScopeBannerProps {
  scopeData: ScopeBannerData;
  selectedSegment: string;
  onSelectSegment: (segment: string) => void;
  filterDistrict: string;
  onSelectDistrict: (district: string) => void;
  filterBranch: string;
  onSelectBranch: (branch: string) => void;
  filterCategory: string;
  onSelectCategory: (category: string) => void;
  filterStatus: string;
  onSelectStatus: (status: string) => void;
  filterExpiry: string;
  onSelectExpiry: (expiry: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  isLoading?: boolean;
}

export const ScopeBanner: React.FC<ScopeBannerProps> = ({
  scopeData,
  selectedSegment,
  onSelectSegment,
  filterDistrict,
  onSelectDistrict,
  filterBranch,
  onSelectBranch,
  filterCategory,
  onSelectCategory,
  filterStatus,
  onSelectStatus,
  filterExpiry,
  onSelectExpiry,
  onRefresh,
  onExport,
  isLoading = false,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '10px',
        border: '1px solid #DCE4EE',
        boxShadow: '0 2px 8px rgba(14, 40, 78, 0.04)',
        padding: '16px 20px',
        marginBottom: '20px',
      }}
    >
      {/* Top Row: Scope Breadcrumb & Server Metadata */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid #EEF2F7',
        }}
      >
        {/* Scope Hierarchy Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: '#0E284E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#B8863B',
            }}
          >
            <Globe style={{ width: '18px', height: '18px' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Authorized Jurisdiction &amp; Scope
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#0E284E' }}>
              <span>You are viewing:</span>
              <span
                style={{
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 800,
                  border: '1px solid #BFDBFE',
                }}
              >
                {scopeData.displayScope || 'BANK-WIDE'}
              </span>
              {(scopeData.lockedSegment || scopeData.lockedDistrict || scopeData.lockedBranch) && (
                <span
                  title="Organizational scope enforced by backend security policy (§2)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10px',
                    color: '#B45309',
                    backgroundColor: '#FEF3C7',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  <Lock style={{ width: '10px', height: '10px' }} /> Scope Enforced
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Server System Date & Refresh Timestamp & Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
            <Calendar style={{ width: '14px', height: '14px', color: '#0E284E' }} />
            <span>Server Date:</span>
            <strong style={{ color: '#0F172A' }}>{scopeData.serverDate || new Date().toISOString().split('T')[0]}</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
            <Clock style={{ width: '14px', height: '14px', color: '#0E284E' }} />
            <span>Updated:</span>
            <strong style={{ color: '#0F172A' }}>{scopeData.lastRefresh || 'Just now'}</strong>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0F172A',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            title="Refresh dashboard metrics (Backend scoped API)"
          >
            <RefreshCw style={{ width: '13px', height: '13px', animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={onExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0E284E',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
            title="Export scoped portfolio view to CSV"
          >
            <Download style={{ width: '13px', height: '13px', color: '#B8863B' }} />
            <span>Export Scoped CSV</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Multi-Dimensional Filter Hierarchy (§4) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          marginTop: '12px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0E284E', fontWeight: 700 }}>
          <Filter style={{ width: '14px', height: '14px' }} />
          <span>Filters:</span>
        </div>

        {/* Collateral Category Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#64748B' }}>Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => onSelectCategory(e.target.value)}
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0F172A',
              outline: 'none',
            }}
          >
            <option value="ALL">All Categories</option>
            <option value="Immovable Properties">Immovable Properties</option>
            <option value="Movable Properties">Movable Properties</option>
            <option value="Business Mortgages">Business Mortgages</option>
            <option value="Financial Assets">Financial Assets</option>
            <option value="Agricultural / Other">Agricultural / Other</option>
            <option value="Guarantees">Guarantees</option>
          </select>
        </div>

        {/* Insurance Compliance Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#64748B' }}>Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => onSelectStatus(e.target.value)}
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0F172A',
              outline: 'none',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ADEQUATE">Adequately Insured</option>
            <option value="UNDERINSURED">Underinsured (Gap)</option>
            <option value="EXPIRED">Expired Policies</option>
            <option value="UNINSURED">Uninsured / Missing</option>
          </select>
        </div>

        {/* Expiry Pipeline Period Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#64748B' }}>Expiry:</span>
          <select
            value={filterExpiry}
            onChange={(e) => onSelectExpiry(e.target.value)}
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#0F172A',
              outline: 'none',
            }}
          >
            <option value="ALL">All Timeframes</option>
            <option value="EXPIRED">Already Expired</option>
            <option value="0-7">Critical (0–7 Days)</option>
            <option value="8-15">Upcoming (8–15 Days)</option>
            <option value="16-30">Within Month (16–30 Days)</option>
            <option value="31-60">Medium Term (31–60 Days)</option>
            <option value="61-90">Long Term (61–90 Days)</option>
            <option value=">90">&gt; 90 Days</option>
          </select>
        </div>

        {/* Reset Filter Action */}
        {(filterCategory !== 'ALL' || filterStatus !== 'ALL' || filterExpiry !== 'ALL') && (
          <button
            onClick={() => {
              onSelectCategory('ALL');
              onSelectStatus('ALL');
              onSelectExpiry('ALL');
            }}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#DC2626',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};
