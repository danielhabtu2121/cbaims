import React, { useState } from 'react';
import {
  Building2,
  Shield,
  FileCheck,
  TrendingUp,
  MapPin,
  Clock,
  Layers,
  PieChart as PieIcon,
  CheckCircle,
  Eye,
  Activity,
  BarChart3,
  Download,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DashboardSummary, DashboardChartData, DashboardPortfolioRow } from '../../../types';
import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface SeniorManagementDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
  onExport: () => void;
}

export const SeniorManagementDashboardView: React.FC<SeniorManagementDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
  onExport,
}) => {
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'ETB 0.00';
    return `ETB ${new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(val)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner with Reporting Shortcuts */}
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
                backgroundColor: '#B8863B',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              Senior Management Review (§6)
            </span>
            <span style={{ fontSize: '11px', color: '#AEC0D2' }}>Operational &amp; Analytical Command</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            Bank-Wide Portfolio Health &amp; Branch Comparison
          </h1>
        </div>

        {/* Reporting Shortcuts (§6) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('reports')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#143666',
              border: '1px solid #1B4580',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <FileSpreadsheet style={{ width: '14px', height: '14px', color: '#B8863B' }} />
            <span>Generate Regulatory Report</span>
          </button>

          <button
            onClick={onExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#B8863B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download style={{ width: '14px', height: '14px' }} />
            <span>Export Management CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
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
          <div style={{ fontSize: '11px', color: '#64748B' }}>{summary.totalFacilitiesCount} facility accounts</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Collateral Market Value</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalCollateralMarketValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>{summary.activeCollateralsCount} collaterals</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Total Net Security</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalNetSecurityValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Post-haircut security sum</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Insurance Coverage %</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: summary.insuranceCoveragePct >= 100 ? '#15803D' : '#D97706', marginTop: '4px' }}>
            {summary.insuranceCoveragePct}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Target benchmark 100%</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #DC2626' }}>
          <div style={{ ...kpiLabelStyle, color: '#DC2626' }}>Net Insurance Gap</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceGap)}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Uncovered collateral risk</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: summary.expiredPoliciesCount > 0 ? '4px solid #DC2626' : '1px solid #DCE4EE' }}>
          <div style={{ ...kpiLabelStyle, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#64748B' }}>Expired Policies</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#0E284E', marginTop: '4px' }}>
            {summary.expiredPoliciesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Overdue policies</div>
        </div>
      </div>

      {/* Senior Management Operational Table (§6 Required management table) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #DCE4EE',
          boxShadow: '0 2px 8px rgba(14, 40, 78, 0.04)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#FAFCFF',
            borderBottom: '1px solid #EEF2F7',
          }}
        >
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0E284E', margin: 0 }}>
            Branch &amp; District Comparative Risk Table (§6)
          </h3>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
            Comparative exposure, collateral security, insurance required, and compliance rates across branches
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #DCE4EE', color: '#0E284E' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Branch / Corporate Center</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Collateral Value</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Required Insurance</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Active Cover</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Insurance Gap</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Coverage %</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(charts.branchRanking || []).map((b, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #EEF2F7',
                    backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF',
                    cursor: 'pointer',
                  }}
                  onClick={() => onNavigate('collateral', { branch: b.branch })}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0E284E' }}>
                    {b.branch}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    {formatCurrency(b.collateralValue)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    {formatCurrency(b.insuranceRequired)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#15803D', fontWeight: 600 }}>
                    {formatCurrency(b.insuredAmount)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: b.insuranceGap > 0 ? '#DC2626' : '#15803D', fontWeight: 700 }}>
                    {formatCurrency(b.insuranceGap)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: b.compliancePct >= 100 ? '#DCFCE7' : b.compliancePct > 0 ? '#FEF3C7' : '#FEE2E2',
                        color: b.compliancePct >= 100 ? '#15803D' : b.compliancePct > 0 ? '#B45309' : '#DC2626',
                      }}
                    >
                      {b.compliancePct}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('collateral', { branch: b.branch });
                      }}
                      style={{
                        backgroundColor: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#0E284E',
                        cursor: 'pointer',
                      }}
                    >
                      Drill-down
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Scoped Portfolio Table */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title="Bank-Wide Scoped Portfolio Roster"
        subtitle="Individual accounts and linked collaterals"
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
