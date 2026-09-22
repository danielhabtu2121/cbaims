import React from 'react';
import {
  TrendingUp,
  Shield,
  AlertTriangle,
  FileCheck,
  Building2,
  DollarSign,
  PieChart as PieIcon,
  Clock,
  CheckCircle,
  FileText,
  Users,
  Briefcase,
  Layers,
  MapPin,
  ChevronRight,
  Activity,
  ArrowUpRight,
  AlertCircle,
  BarChart3,
  Calendar,
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

interface ExecutiveDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
  isSeniorManagement?: boolean;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
  isSeniorManagement = false,
}) => {
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'ETB 0.00';
    return `ETB ${new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(val)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 12 Primary KPI Cards (§5 Primary KPI cards) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0E284E', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity style={{ width: '18px', height: '18px', color: '#2C6295' }} />
            <span>Executive Portfolio KPIs &amp; Risk Metrics</span>
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B' }}>Real-time aggregated backend telemetry</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}
        >
          {/* KPI 1: Outstanding Exposure */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Total Outstanding Exposure</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '6px' }}>
              {formatCurrency(summary.totalOutstandingExposure)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              {summary.totalFacilitiesCount} active loan facilities (N:M safe)
            </div>
          </div>

          {/* KPI 2: Collateral Valuation */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Collateral Market Value</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '6px' }}>
              {formatCurrency(summary.totalCollateralMarketValue)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              {summary.activeCollateralsCount} secured collaterals
            </div>
          </div>

          {/* KPI 3: Net Security Value */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Total Net Security Value</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '6px' }}>
              {formatCurrency(summary.totalNetSecurityValue)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              After configured haircut deduction
            </div>
          </div>

          {/* KPI 4: Insurance Required */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Total Insurance Required</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '6px' }}>
              {formatCurrency(summary.totalInsuranceRequired)}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              MAX(Exposure, Valuation)
            </div>
          </div>

          {/* KPI 5: Active Valid Insurance */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Valid Active Insurance</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '6px' }}>
              {formatCurrency(summary.totalValidActiveInsurance)}
            </div>
            <div style={{ fontSize: '11px', color: '#15803D', marginTop: '4px' }}>
              Compliant active policy sums
            </div>
          </div>

          {/* KPI 6: Insurance Gap */}
          <div style={{ ...kpiCardStyle, borderLeft: '4px solid #DC2626' }}>
            <div style={{ ...kpiLabelStyle, color: '#DC2626' }}>Total Insurance Gap</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '6px' }}>
              {formatCurrency(summary.totalInsuranceGap)}
            </div>
            <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>
              Unhedged credit exposure
            </div>
          </div>

          {/* KPI 7: Insurance Coverage % */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Insurance Coverage %</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: summary.insuranceCoveragePct >= 100 ? '#15803D' : '#D97706', marginTop: '6px' }}>
              {summary.insuranceCoveragePct}%
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Benchmark: 100% adequate
            </div>
          </div>

          {/* KPI 8: Expired Policies */}
          <div style={{ ...kpiCardStyle, borderLeft: summary.expiredPoliciesCount > 0 ? '4px solid #DC2626' : '1px solid #DCE4EE' }}>
            <div style={{ ...kpiLabelStyle, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#64748B' }}>Expired Policies</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#0E284E', marginTop: '6px' }}>
              {summary.expiredPoliciesCount}
            </div>
            <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>
              Requires immediate renewal
            </div>
          </div>

          {/* KPI 9: Expiring <= 30 Days */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Expiring Within 30 Days</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#D97706', marginTop: '6px' }}>
              {summary.policiesExpiringWithin30Days}
            </div>
            <div style={{ fontSize: '11px', color: '#D97706', marginTop: '4px' }}>
              Renewal notice pipeline
            </div>
          </div>

          {/* KPI 10: Open Exceptions */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Open Exceptions</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: summary.openExceptionsCount > 0 ? '#B45309' : '#0E284E', marginTop: '6px' }}>
              {summary.openExceptionsCount}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Unresolved breach items
            </div>
          </div>

          {/* KPI 11: Pending Approvals */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Pending Approvals</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563EB', marginTop: '6px' }}>
              {summary.pendingApprovalsCount}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Maker-checker tasks
            </div>
          </div>

          {/* KPI 12: Active Collaterals */}
          <div style={kpiCardStyle}>
            <div style={kpiLabelStyle}>Active Collaterals</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0E284E', marginTop: '6px' }}>
              {summary.activeCollateralsCount}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Enrolled &amp; registered
            </div>
          </div>
        </div>
      </div>

      {/* Row 1 Charts: Chart 1 (Compliance Donut) & Chart 2 (Exposure vs Protection by Segment) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Chart 1: Bank Insurance Compliance Donut (§5 Chart 1) */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>1. Bank Insurance Compliance</h3>
              <p style={chartSubStyle}>Categorized collateral adequacy breakdown</p>
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
                  {(charts.complianceDonut || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Exposure vs Protection Grouped Bars (§5 Chart 2) */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>2. Exposure vs Protection by Segment</h3>
              <p style={chartSubStyle}>Collateral value, required insurance, and active cover</p>
            </div>
            <BarChart3 style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.exposureVsProtection || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="segment" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                <Legend verticalAlign="bottom" height={36} />
                <Bar dataKey="collateralValue" name="Collateral Value" fill="#0E284E" />
                <Bar dataKey="insuredCoverage" name="Insured Cover" fill="#15803D" />
                <Bar dataKey="gap" name="Gap Deficit" fill="#DC2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 Charts: Chart 3 (District Risk Ranking) & Chart 4 (Branch Compliance Ranking) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Chart 3: District Risk Ranking (§5 Chart 3) */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>3. District Risk &amp; Compliance Ranking</h3>
              <p style={chartSubStyle}>Ranked by exposure and compliance percentage</p>
            </div>
            <MapPin style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={charts.districtRanking || []}
                margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="district" type="category" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
                <Bar dataKey="compliancePct" name="Compliance %" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 5: Expiry Pipeline Buckets (§5 Chart 5) */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>4. Insurance Expiry Pipeline</h3>
              <p style={chartSubStyle}>Policy expiration distribution across aging buckets</p>
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

      {/* Row 3 Charts: Collateral Category Distribution & Workflow Funnel & Documentation Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Chart 6: Collateral Category Distribution */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>5. Collateral Categories</h3>
              <p style={chartSubStyle}>Asset distribution across classes</p>
            </div>
            <Layers style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.collateralCategoryDistribution || []} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Count" fill="#0E284E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 8: Workflow Funnel */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>6. Workflow Task Pipeline</h3>
              <p style={chartSubStyle}>Maker-checker lifecycle status</p>
            </div>
            <FileCheck style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.workflowFunnel || []} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Tasks" fill="#2C6295" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 9: Documentation Health */}
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>7. Documentation Health</h3>
              <p style={chartSubStyle}>Verification status &amp; missing files</p>
            </div>
            <FileText style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.documentationHealth || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                >
                  {(charts.documentationHealth || []).map((entry, idx) => (
                    <Cell key={`doc-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={28} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Universal Scoped Portfolio Table (§19) */}
      <UniversalPortfolioTable rows={portfolioRows} onNavigate={onNavigate} />
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
