import React from 'react';
import {
  Building2,
  Shield,
  AlertTriangle,
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
  Lock,
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

interface SegmentDirectorDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
  isDistrictDirector?: boolean;
}

export const SegmentDirectorDashboardView: React.FC<SegmentDirectorDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
  isDistrictDirector = false,
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
                backgroundColor: '#B8863B',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {isDistrictDirector ? 'District Portfolio Monitoring' : 'Head Office Business Segment'}
            </span>
            <span style={{ fontSize: '11px', color: '#AEC0D2' }}>
              Locked Jurisdiction Policy Enforced (§7, §8)
            </span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            {summary.scopeBanner?.displayScope || 'Corporate Banking Portfolio Overview'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#AEC0D2' }}>Coverage Adequacy</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: summary.insuranceCoveragePct >= 100 ? '#4ADE80' : '#FBBF24' }}>
              {summary.insuranceCoveragePct}%
            </div>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '1px solid #1B4580', paddingLeft: '20px' }}>
            <div style={{ fontSize: '11px', color: '#AEC0D2' }}>Net Insurance Gap</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#F87171' }}>
              {formatCurrency(summary.totalInsuranceGap)}
            </div>
          </div>
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
          <div style={kpiLabelStyle}>Assigned Customers</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.totalCustomersCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>In authorized segment</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Credit Facilities</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.totalFacilitiesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Total active loan accounts</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Total Exposure</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalOutstandingExposure)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Outstanding balance</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Collateral Valuation</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalCollateralMarketValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>{summary.activeCollateralsCount} collaterals</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Valid Active Cover</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            {formatCurrency(summary.totalValidActiveInsurance)}
          </div>
          <div style={{ fontSize: '11px', color: '#15803D' }}>Compliant active sum</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #DC2626' }}>
          <div style={{ ...kpiLabelStyle, color: '#DC2626' }}>Expired Policies</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {summary.expiredPoliciesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Requires intervention</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Due for Renewal</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {summary.policiesExpiringWithin30Days}
          </div>
          <div style={{ fontSize: '11px', color: '#D97706' }}>Expiring in 30 days</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Open Exceptions</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.openExceptionsCount > 0 ? '#B45309' : '#0E284E', marginTop: '4px' }}>
            {summary.openExceptionsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Policy breaches</div>
        </div>
      </div>

      {/* Row 1: Branch Performance Action Table & Compliance Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Branch Compliance Ranking Bar Chart */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>Branch Performance &amp; Insurance Deficits</h3>
              <p style={chartSubStyle}>Ranked by collateral valuation and coverage compliance %</p>
            </div>
            <BarChart3 style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.branchRanking || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="branch" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                <Legend verticalAlign="bottom" height={36} />
                <Bar dataKey="collateralValue" name="Valuation" fill="#0E284E" />
                <Bar dataKey="insuredAmount" name="Active Cover" fill="#15803D" />
                <Bar dataKey="insuranceGap" name="Gap Deficit" fill="#DC2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expiry Pipeline */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>Expiry Risk Timeline</h3>
              <p style={chartSubStyle}>Aging distribution of policies within authorized segment</p>
            </div>
            <Clock style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.expiryPipeline || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Policies Count">
                  {(charts.expiryPipeline || []).map((entry, idx) => (
                    <Cell key={`bar-${idx}`} fill={entry.color || '#0E284E'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Universal Table */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title={`${isDistrictDirector ? 'District' : 'Segment'} Collateral Portfolio & Linked Accounts`}
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
