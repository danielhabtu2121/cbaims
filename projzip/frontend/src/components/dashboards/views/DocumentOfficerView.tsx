import React from 'react';
import {
  FileCheck,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  UploadCloud,
  Eye,
  AlertCircle,
  Building2,
  FolderOpen,
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

interface DocumentOfficerViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
  isManager?: boolean;
}

export const DocumentOfficerView: React.FC<DocumentOfficerViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
  isManager = false,
}) => {
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
                backgroundColor: '#2C6295',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              Collateral Documentation Management (§14)
            </span>
            <span style={{ fontSize: '11px', color: '#B9D3EB' }}>DMS &amp; Physical Vault Verification Scope</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            {isManager ? 'Collateral Documentation Workload & Verification Center' : 'Document Officer Verification Queue'}
          </h1>
        </div>

        <button
          onClick={() => onNavigate('documents')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#2C6295',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <UploadCloud style={{ width: '14px', height: '14px' }} />
          <span>Open Document Vault</span>
        </button>
      </div>

      {/* Document Workload KPI Cards (§14) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #EA580C' }}>
          <div style={{ ...kpiLabelStyle, color: '#EA580C' }}>Pending Verification</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#EA580C', marginTop: '4px' }}>
            {summary.pendingDocumentVerificationsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Awaiting checker review</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #DC2626' }}>
          <div style={{ ...kpiLabelStyle, color: '#DC2626' }}>Missing Mandatory Files</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {summary.missingDocumentsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Title deed / Valuation report</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Active Collateral Files</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.activeCollateralsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>In electronic registry</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Bank Coverage %</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: summary.insuranceCoveragePct >= 100 ? '#15803D' : '#D97706', marginTop: '4px' }}>
            {summary.insuranceCoveragePct}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Insurance adequacy</div>
        </div>
      </div>

      {/* Charts Row: Documentation Health & Documentation by Category */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>Documentation Health Status</h3>
              <p style={chartSubStyle}>Complete vs Missing vs Pending Verification breakdown</p>
            </div>
            <FileText style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.documentationHealth || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {(charts.documentationHealth || []).map((entry, idx) => (
                    <Cell key={`doc-cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={chartCardStyle}>
          <div style={chartHeaderStyle}>
            <div>
              <h3 style={chartTitleStyle}>Collateral Category Distribution</h3>
              <p style={chartSubStyle}>Securities requiring mandatory deeds &amp; invoices</p>
            </div>
            <FolderOpen style={{ width: '18px', height: '18px', color: '#0E284E' }} />
          </div>
          <div style={{ height: '260px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.collateralCategoryDistribution || []} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Count" fill="#0E284E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Universal Table */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title="Collateral File Verification &amp; Document Checklist"
        subtitle="Verification status across Title Deeds, Valuation Reports, Invoices &amp; Insurance Policies"
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
