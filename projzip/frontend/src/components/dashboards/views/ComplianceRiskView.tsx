import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileCheck,
  Activity,
  DollarSign,
  TrendingDown,
  PieChart as PieIcon,
  CheckCircle,
  FileText,
  Building2,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { DashboardSummary, DashboardChartData, DashboardPortfolioRow } from '../../../types';
import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface ComplianceRiskViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
  isRiskOfficer?: boolean;
}

export const ComplianceRiskView: React.FC<ComplianceRiskViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
  isRiskOfficer = false,
}) => {
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'ETB 0.00';
    return `ETB ${new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(val)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Scope Header Card */}
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
                backgroundColor: '#2C6295',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {isRiskOfficer ? 'Credit Protection & Security Adequacy' : 'Regulatory & Internal Compliance Oversight'}
            </span>
            <span style={{ fontSize: '11px', color: '#B9D3EB' }}>Second Line of Defense Scope (§12, §13)</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            {isRiskOfficer ? 'Bank-Wide Credit Security & Collateral Exposure Matrix' : 'Compliance Breaches & Policy Deficit Monitor'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#B9D3EB' }}>Bank Compliance Index</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: summary.insuranceCoveragePct >= 100 ? '#4ADE80' : '#FBBF24' }}>
              {summary.insuranceCoveragePct}%
            </div>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '1px solid #1B4580', paddingLeft: '16px' }}>
            <div style={{ fontSize: '11px', color: '#B9D3EB' }}>Open Exceptions</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: summary.openExceptionsCount > 0 ? '#F87171' : '#4ADE80' }}>
              {summary.openExceptionsCount}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Total Exposure</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalOutstandingExposure)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Authorized facilities</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Market Valuation</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalCollateralMarketValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Gross collateral value</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Net Security Value</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalNetSecurityValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>After configured haircut</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Required Sum Insured</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceRequired)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>MAX(Exposure, Market Val)</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Active Insurance</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            {formatCurrency(summary.totalValidActiveInsurance)}
          </div>
          <div style={{ fontSize: '11px', color: '#15803D' }}>Valid policies sum</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #DC2626' }}>
          <div style={{ ...kpiLabelStyle, color: '#DC2626' }}>Unhedged Deficit (Gap)</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceGap)}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Required - Active cover</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: summary.expiredPoliciesCount > 0 ? '4px solid #DC2626' : '1px solid #DCE4EE' }}>
          <div style={{ ...kpiLabelStyle, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#64748B' }}>Expired Policies</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#0E284E', marginTop: '4px' }}>
            {summary.expiredPoliciesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Zero valid cover</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Doc Verification Backlog</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.pendingDocumentVerificationsCount > 0 ? '#D97706' : '#0E284E', marginTop: '4px' }}>
            {summary.pendingDocumentVerificationsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Unverified ownership files</div>
        </div>
      </div>

      {/* Row 1: Compliance Donut & Top Insurance Gaps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>Bank-Wide Coverage Adequacy Donut</h3>
              <p style={chartSubStyle}>Adequate vs Underinsured vs Uninsured collateral counts</p>
            </div>
            <PieIcon style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.complianceDonut || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {(charts.complianceDonut || []).map((entry, idx) => (
                    <Cell key={`comp-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Insurance Gaps Table */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>Top Insurance Deficits by Customer</h3>
              <p style={chartSubStyle}>Ranked by largest protection deficit (§5 Chart 7)</p>
            </div>
            <AlertTriangle style={{ width: '18px', height: '18px', color: '#DC2626' }} />
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '260px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #DCE4EE', color: '#0E284E' }}>
                  <th style={{ padding: '6px 8px' }}>Collateral / Customer</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Req. Insurance</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Active Cover</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Deficit Gap</th>
                </tr>
              </thead>
              <tbody>
                {(charts.topInsuranceGaps || []).slice(0, 5).map((g, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #EEF2F7' }}>
                    <td style={{ padding: '6px 8px' }}>
                      <div style={{ fontWeight: 700, color: '#0E284E' }}>{g.customerName}</div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>{g.collateralCode} · {g.branch}</div>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCurrency(g.requiredInsurance)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#15803D' }}>{formatCurrency(g.activeInsurance)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>{formatCurrency(g.insuranceGap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Main Scoped Portfolio Matrix Table */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title={isRiskOfficer ? 'Credit Security & Collateral Exposure Matrix' : 'Compliance Risk & Policy Deficit Matrix'}
        subtitle="Market Value vs Haircut vs Net Security vs Insurance Requirement vs Active Cover"
      />
    </div>
  );
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  border: '1px solid #DCE4EE',
  padding: '12px 14px',
  boxShadow: '0 1px 4px rgba(14, 40, 78, 0.04)',
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const chartCardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '10px',
  border: '1px solid #DCE4EE',
  padding: '18px 20px',
  boxShadow: '0 2px 8px rgba(14, 40, 78, 0.04)',
};

const chartHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
};

const chartTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
  color: '#0E284E',
  margin: 0,
};

const chartSubStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#64748B',
  margin: '2px 0 0 0',
};
