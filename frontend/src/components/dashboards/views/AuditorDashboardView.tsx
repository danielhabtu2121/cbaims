import React from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  UserCheck,
  Building2,
  Lock,
  Eye,
  Activity,
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
} from 'recharts';
import { DashboardSummary, DashboardChartData, DashboardPortfolioRow } from '../../../types';
import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface AuditorDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
}

export const AuditorDashboardView: React.FC<AuditorDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
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
              Independent Audit &amp; Control (§15)
            </span>
            <span style={{ fontSize: '11px', color: '#AEC0D2' }}>Read-Only Reconstruction of System Activity</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            Dual-Control Audit Trail &amp; Transaction Integrity Log
          </h1>
        </div>

        <button
          onClick={() => onNavigate('audit')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#143666',
            border: '1px solid #1B4580',
            color: '#FFFFFF',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <FileText style={{ width: '14px', height: '14px', color: '#B8863B' }} />
          <span>Full Forensic Audit Log</span>
        </button>
      </div>

      {/* Audit KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Maker-Checker Tasks</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.pendingApprovalsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Awaiting dual authorization</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Returned Transactions</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {summary.returnedTasksCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Rejected or returned to maker</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Manager Overrides</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: summary.overrideCount > 0 ? '#B45309' : '#0E284E', marginTop: '4px' }}>
            {summary.overrideCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Authorized policy overrides</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Open Risk Exceptions</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: summary.openExceptionsCount > 0 ? '#DC2626' : '#15803D', marginTop: '4px' }}>
            {summary.openExceptionsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Active policy breaches</div>
        </div>
      </div>

      {/* Workflow Funnel Chart */}
      <div style={chartCardStyle}>
        <div style={chartHeaderStyle}>
          <div>
            <h3 style={chartTitleStyle}>Maker-Checker Transaction State Distribution</h3>
            <p style={chartSubStyle}>Complete dual-control pipeline from Draft to Approved/Overdue</p>
          </div>
          <Activity style={{ width: '18px', height: '18px', color: '#0E284E' }} />
        </div>
        <div style={{ height: '240px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.workflowFunnel || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" name="Count" fill="#0E284E" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Read-Only Portfolio Matrix */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title="Auditor Read-Only Portfolio Recon"
        subtitle="Complete immutable view of collateral, loans, and insurance endorsements"
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
