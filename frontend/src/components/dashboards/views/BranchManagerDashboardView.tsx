import { formatEtb } from '../../../utils/format';
import React, { useState } from 'react';

import {
  Building2,
  Shield,
  AlertTriangle,
  FileCheck,
  CheckCircle,
  Clock,
  FileText,
  Users,
  Briefcase,
  AlertCircle,
  ArrowRight,
  Eye,
  CheckSquare,
  Lock,
  PieChart as PieIcon,
} from 'lucide-react';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import { DashboardSummary, DashboardChartData, DashboardPortfolioRow, DashboardWorkQueueItem } from '../../../types';

import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface BranchManagerDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  workQueue: DashboardWorkQueueItem[];
  onNavigate: (page: string, params?: any) => void;
  onApproveTask?: (taskId: string, comments: string) => Promise<void>;
  onRejectTask?: (taskId: string, comments: string) => Promise<void>;
}

export const BranchManagerDashboardView: React.FC<BranchManagerDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  workQueue,
  onNavigate,
  onApproveTask,
  onRejectTask,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'portfolio' | 'expiring' | 'uninsured' | 'approvals'>('queue');

  const formatCurrency = (val?: number) => formatEtb(val);

  const pendingApprovals = workQueue.filter((q) => q.category?.includes('Approval') || q.category?.includes('Workflow') || q.status === 'Pending');
  const criticalExpiries = workQueue.filter((q) => q.category?.includes('Expired') || q.category?.includes('Expiring'));
  const coverageGaps = workQueue.filter((q) => q.category?.includes('Uninsured') || q.category?.includes('Underinsured'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Branch Header Banner */}
      <div
        style={{
          backgroundColor: '#00205B',
          borderRadius: '14px',
          padding: '22px 26px',
          color: '#FFFFFF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          border: '1px solid #143666',
          boxShadow: '0 4px 6px -1px rgba(0, 32, 91, 0.1)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                backgroundColor: '#1F4E7A',
                color: '#D48806',
                border: '1px solid rgba(212, 136, 6, 0.3)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Branch Operational Command
            </span>
            <span style={{ fontSize: '11px', color: '#B9D3EB' }}>
              Corporate Center / Branch Scope Enforced (§9)
            </span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px', color: '#FFFFFF' }}>
            {summary.scopeBanner?.displayScope || 'Bole Special Branch Portfolio'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => onNavigate('approvals')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#D48806',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          >
            <CheckSquare style={{ width: '14px', height: '14px' }} />
            <span>Workflow Queue ({summary.pendingApprovalsCount})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Branch Customers</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.totalCustomersCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>In branch CIF portfolio</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Credit Facilities</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.totalFacilitiesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Active loan lines</div>
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
          <div style={kpiLabelStyle}>Insurance Gap</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceGap)}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Coverage deficit</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Insurance Compliance Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: (summary.insuranceComplianceRate ?? summary.insuranceCoveragePct) >= 100 ? '#15803D' : '#D97706', marginTop: '4px' }}>
            {(summary.insuranceComplianceRate ?? summary.insuranceCoveragePct)}%
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>(Adequate ÷ Required) × 100</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: summary.expiredPoliciesCount > 0 ? '4px solid #DC2626' : '1px solid #DCE4EE' }}>
          <div style={{ ...kpiLabelStyle, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#64748B' }}>Expired Policies</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#0E284E', marginTop: '4px' }}>
            {summary.expiredPoliciesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Needs immediate action</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Pending Approvals</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
            {summary.pendingApprovalsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#2563EB' }}>Checker reviews awaiting</div>
        </div>
      </div>

      {/* Action-Focused Area: "What Needs Management Attention Today?" (§9) */}
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
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0E284E', margin: 0 }}>
              What Needs Management Attention Today?
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
              Operational priorities, overdue items, expiring insurance, and pending maker-checker tasks
            </p>
          </div>

          {/* Quick Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('queue')}
              style={{
                ...tabBtnStyle,
                backgroundColor: activeTab === 'queue' ? '#0E284E' : '#F1F5F9',
                color: activeTab === 'queue' ? '#FFFFFF' : '#0F172A',
              }}
            >
              All Action Items ({workQueue.length})
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              style={{
                ...tabBtnStyle,
                backgroundColor: activeTab === 'approvals' ? '#0E284E' : '#F1F5F9',
                color: activeTab === 'approvals' ? '#FFFFFF' : '#0F172A',
              }}
            >
              Pending Approvals ({pendingApprovals.length})
            </button>
            <button
              onClick={() => setActiveTab('expiring')}
              style={{
                ...tabBtnStyle,
                backgroundColor: activeTab === 'expiring' ? '#0E284E' : '#F1F5F9',
                color: activeTab === 'expiring' ? '#FFFFFF' : '#0F172A',
              }}
            >
              Expiring &amp; Expired ({criticalExpiries.length})
            </button>
            <button
              onClick={() => setActiveTab('uninsured')}
              style={{
                ...tabBtnStyle,
                backgroundColor: activeTab === 'uninsured' ? '#0E284E' : '#F1F5F9',
                color: activeTab === 'uninsured' ? '#FFFFFF' : '#0F172A',
              }}
            >
              Coverage Gaps ({coverageGaps.length})
            </button>
          </div>
        </div>

        {/* Action Table List */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #DCE4EE', color: '#0E284E' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Priority</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Category</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Customer / Entity</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Issue Description</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Action Required</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Assigned</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'queue'
                ? workQueue
                : activeTab === 'approvals'
                ? pendingApprovals
                : activeTab === 'expiring'
                ? criticalExpiries
                : coverageGaps
              ).slice(0, 15).map((item, idx) => (
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

                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0F172A' }}>
                    {item.category}
                  </td>

                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, color: '#0E284E' }}>{item.customerName}</div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      {item.collateralCode || item.policyNumber || item.customerCif}
                    </div>
                  </td>

                  <td style={{ padding: '10px 14px', color: '#475569' }}>
                    {item.issueDescription}
                  </td>

                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0E284E' }}>
                    {item.requiredAction}
                  </td>

                  <td style={{ padding: '10px 14px', color: '#64748B' }}>
                    {item.assignedOfficer}
                  </td>

                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <button
                      onClick={() => onNavigate(item.targetModule || 'collateral', { entityId: item.targetEntityId })}
                      style={{
                        backgroundColor: '#0E284E',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Resolve
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
        title="Branch Collateral &amp; Insurance Portfolio"
        subtitle="Complete live roster for Bole Special Branch"
      />
    </div>
  );
};

const tabBtnStyle: React.CSSProperties = {
  border: '1px solid #CBD5E1',
  borderRadius: '6px',
  padding: '6px 12px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  border: '1px solid #E2E8F0',
  padding: '14px 16px',
  boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.06)',
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
