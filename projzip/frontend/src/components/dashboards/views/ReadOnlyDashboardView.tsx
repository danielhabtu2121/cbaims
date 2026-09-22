import React from 'react';
import { Shield, Eye, Lock, FileText } from 'lucide-react';
import { DashboardSummary, DashboardChartData, DashboardPortfolioRow } from '../../../types';
import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface ReadOnlyDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
}

export const ReadOnlyDashboardView: React.FC<ReadOnlyDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
}) => {
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'ETB 0.00';
    return `ETB ${new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(val)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: '#0E284E',
          borderRadius: '10px',
          padding: '20px 24px',
          color: '#FFFFFF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                backgroundColor: '#64748B',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              Read-Only Inspector Scope (§17)
            </span>
            <span style={{ fontSize: '11px', color: '#B9D3EB' }}>Transaction Actions Restricted</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            {summary.scopeBanner?.displayScope || 'Authorized Portfolio Read-Only View'}
          </h1>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Total Exposure</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalOutstandingExposure)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>{summary.totalFacilitiesCount} loan facilities</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Collateral Market Value</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalCollateralMarketValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>{summary.activeCollateralsCount} collaterals</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Insurance Required</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceRequired)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Mandatory sum insured</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Active Insurance Cover</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            {formatCurrency(summary.totalValidActiveInsurance)}
          </div>
          <div style={{ fontSize: '11px', color: '#15803D' }}>Valid policies</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #DC2626' }}>
          <div style={{ ...kpiLabelStyle, color: '#DC2626' }}>Insurance Gap</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceGap)}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Uncovered risk</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Coverage %</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: summary.insuranceCoveragePct >= 100 ? '#15803D' : '#D97706', marginTop: '4px' }}>
            {summary.insuranceCoveragePct}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Adequacy index</div>
        </div>
      </div>

      {/* Universal Table (Read Only) */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title="Scoped Portfolio Roster (Read-Only)"
        subtitle="Inspection view without modification privileges"
        isReadOnly={true}
      />
    </div>
  );
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  border: '1px solid #DCE4EE',
  padding: '14px 16px',
  boxShadow: '0 1px 4px rgba(14, 40, 78, 0.04)',
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
