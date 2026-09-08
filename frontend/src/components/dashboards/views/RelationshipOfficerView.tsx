import React from 'react';
import {
  ListTodo,
  Shield,
  AlertTriangle,
  FileCheck,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Eye,
  PlusCircle,
  RefreshCw,
  UploadCloud,
  CheckSquare,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { DashboardSummary, DashboardChartData, DashboardPortfolioRow, DashboardWorkQueueItem } from '../../../types';
import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface RelationshipOfficerViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  workQueue: DashboardWorkQueueItem[];
  onNavigate: (page: string, params?: any) => void;
}

export const RelationshipOfficerView: React.FC<RelationshipOfficerViewProps> = ({
  summary,
  charts,
  portfolioRows,
  workQueue,
  onNavigate,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Fast Maker Shortcuts */}
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
              Relationship Officer Workspace
            </span>
            <span style={{ fontSize: '11px', color: '#AEC0D2' }}>Task Execution &amp; Follow-up Queue (§11)</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            Today's Operational Task Dispatch
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('collateral')}
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
            <PlusCircle style={{ width: '14px', height: '14px', color: '#B8863B' }} />
            <span>New Collateral</span>
          </button>

          <button
            onClick={() => onNavigate('policies')}
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
            <PlusCircle style={{ width: '14px', height: '14px' }} />
            <span>New Policy</span>
          </button>
        </div>
      </div>

      {/* Primary Operational KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>My Customers</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.totalCustomersCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Assigned CIFs</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>My Collaterals</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.activeCollateralsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Registered securities</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: summary.expiredPoliciesCount > 0 ? '4px solid #DC2626' : '1px solid #DCE4EE' }}>
          <div style={{ ...kpiLabelStyle, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#64748B' }}>Expired Cover</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#0E284E', marginTop: '4px' }}>
            {summary.expiredPoliciesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Renew immediately</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Expiring Soon</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {summary.policiesExpiringWithin30Days}
          </div>
          <div style={{ fontSize: '11px', color: '#D97706' }}>Due in 30 days</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Missing Docs</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.missingDocumentsCount > 0 ? '#B45309' : '#0E284E', marginTop: '4px' }}>
            {summary.missingDocumentsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Mandatory uploads</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Returned Tasks</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.returnedTasksCount > 0 ? '#DC2626' : '#0E284E', marginTop: '4px' }}>
            {summary.returnedTasksCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Corrections from checker</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Pending Checker</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
            {summary.pendingApprovalsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>In approval pipeline</div>
        </div>
      </div>

      {/* Main Section: "Today's Work Queue" (§11) */}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListTodo style={{ width: '18px', height: '18px', color: '#0E284E' }} />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0E284E', margin: 0 }}>
                Today's Work Queue ({workQueue.length} actionable items)
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Prioritized queue: Expired policies, renewal follow-ups, document uploads, and returned transactions
              </p>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #DCE4EE', color: '#0E284E' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Priority</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Customer / CIF</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Collateral / Policy</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Issue / Deficit</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Action Required</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Execute</th>
              </tr>
            </thead>
            <tbody>
              {workQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    <CheckCircle style={{ width: '24px', height: '24px', color: '#16A34A', margin: '0 auto 6px auto' }} />
                    <div style={{ fontWeight: 600 }}>Your work queue is clear today!</div>
                  </td>
                </tr>
              ) : (
                workQueue.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid #EEF2F7',
                      backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FBFDFF',
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: item.priority === 'Critical' ? '#FEE2E2' : item.priority === 'High' ? '#FEF3C7' : '#EFF6FF',
                          color: item.priority === 'Critical' ? '#DC2626' : item.priority === 'High' ? '#B45309' : '#1D4ED8',
                        }}
                      >
                        {item.priority}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 700, color: '#0E284E' }}>{item.customerName}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{item.customerCif}</div>
                    </td>

                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A' }}>
                      {item.collateralCode || item.policyNumber || item.facilityRef || 'N/A'}
                    </td>

                    <td style={{ padding: '10px 14px', color: '#475569' }}>
                      {item.issueDescription}
                    </td>

                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0E284E' }}>
                      {item.requiredAction}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: item.status === 'Action Required' ? '#DC2626' : item.status === 'Returned' ? '#B45309' : '#2563EB',
                        }}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => onNavigate(item.targetModule || 'collateral', { entityId: item.targetEntityId })}
                        style={{
                          backgroundColor: '#0E284E',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '5px 12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Work
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Scoped Portfolio Table */}
      <UniversalPortfolioTable
        rows={portfolioRows}
        onNavigate={onNavigate}
        title="My Collateral Portfolio"
        subtitle="Active collateral files and coverage status"
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
