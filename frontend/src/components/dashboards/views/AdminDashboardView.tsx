import React from 'react';
import {
  Server,
  Database,
  RefreshCw,
  Sliders,
  Users,
  Shield,
  Key,
  CheckCircle,
  AlertTriangle,
  FileText,
  Building2,
  Calendar,
  Lock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { DashboardSummary, DashboardChartData, DashboardPortfolioRow } from '../../../types';
import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface AdminDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
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
                backgroundColor: '#B8863B',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              System Administration &amp; Telemetry (§16)
            </span>
            <span style={{ fontSize: '11px', color: '#AEC0D2' }}>Live Engine &amp; Configuration State</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            CDIMS Platform Operations &amp; Configuration Hub
          </h1>
        </div>

        <button
          onClick={() => onNavigate('admin')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#B8863B',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Sliders style={{ width: '14px', height: '14px' }} />
          <span>System Administration Matrix</span>
        </button>
      </div>

      {/* System Health Status Grid (§16) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={kpiLabelStyle}>Backend Service</div>
            <CheckCircle style={{ width: '16px', height: '16px', color: '#16A34A' }} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            Online · Healthy
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Spring Boot REST API on :8082</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={kpiLabelStyle}>Database Engine</div>
            <CheckCircle style={{ width: '16px', height: '16px', color: '#16A34A' }} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            PostgreSQL / Flyway
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>19 Schema Migrations Verified</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={kpiLabelStyle}>CBS Integration</div>
            <RefreshCw style={{ width: '16px', height: '16px', color: '#2563EB' }} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            Simulated Online
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Live bidirectional sync active</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={kpiLabelStyle}>Workflow Engine</div>
            <CheckCircle style={{ width: '16px', height: '16px', color: '#16A34A' }} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            Flowable BPMN 2.0
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>{summary.pendingApprovalsCount} tasks in queue</div>
        </div>
      </div>

      {/* Configuration Hub Shortcuts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <div style={configCardStyle} onClick={() => onNavigate('admin')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBoxStyle}>
              <Users style={{ width: '18px', height: '18px', color: '#0E284E' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0E284E' }}>16 Seeded App Personas</h4>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>Manage users, roles, and branch scope</p>
            </div>
          </div>
          <ArrowRight style={{ width: '16px', height: '16px', color: '#94A3B8' }} />
        </div>

        <div style={configCardStyle} onClick={() => onNavigate('admin')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBoxStyle}>
              <Key style={{ width: '18px', height: '18px', color: '#0E284E' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0E284E' }}>Role Permission Matrix</h4>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>Screen-level View/Create/Edit/Approve</p>
            </div>
          </div>
          <ArrowRight style={{ width: '16px', height: '16px', color: '#94A3B8' }} />
        </div>

        <div style={configCardStyle} onClick={() => onNavigate('admin')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBoxStyle}>
              <Building2 style={{ width: '18px', height: '18px', color: '#0E284E' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0E284E' }}>Organizational Structure</h4>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>Districts, Corporate Centers, Branches</p>
            </div>
          </div>
          <ArrowRight style={{ width: '16px', height: '16px', color: '#94A3B8' }} />
        </div>

        <div style={configCardStyle} onClick={() => onNavigate('admin')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={iconBoxStyle}>
              <Sliders style={{ width: '18px', height: '18px', color: '#0E284E' }} />
            </div>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: '#0E284E' }}>System Parameters</h4>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>Coverage % threshold, grace periods, concentration caps</p>
            </div>
          </div>
          <ArrowRight style={{ width: '16px', height: '16px', color: '#94A3B8' }} />
        </div>
      </div>

      {/* Universal Scoped Portfolio Table */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title="Bank-Wide Registered Collateral &amp; Insurance Registry"
        subtitle="System administrator overview of all active banking records"
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

const configCardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  border: '1px solid #DCE4EE',
  padding: '14px 18px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  boxShadow: '0 1px 4px rgba(14, 40, 78, 0.04)',
};

const iconBoxStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '6px',
  backgroundColor: '#F1F5F9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
