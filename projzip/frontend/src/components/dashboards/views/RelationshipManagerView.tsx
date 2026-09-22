import React from 'react';
import {
  Users,
  Briefcase,
  Shield,
  AlertTriangle,
  FileCheck,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Eye,
  Activity,
  Layers,
  Phone,
  Mail,
} from 'lucide-react';
import { DashboardSummary, DashboardChartData, DashboardPortfolioRow, DashboardWorkQueueItem } from '../../../types';
import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface RelationshipManagerViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  workQueue: DashboardWorkQueueItem[];
  onNavigate: (page: string, params?: any) => void;
  isSeniorRM?: boolean;
}

export const RelationshipManagerView: React.FC<RelationshipManagerViewProps> = ({
  summary,
  charts,
  portfolioRows,
  workQueue,
  onNavigate,
  isSeniorRM = false,
}) => {
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'ETB 0.00';
    return `ETB ${new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(val)}`;
  };

  const attentionItems = workQueue.filter((q) => q.priority === 'Critical' || q.priority === 'High');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Portfolio Header */}
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
              {isSeniorRM ? 'Senior RM Portfolio' : 'Relationship Manager Command'}
            </span>
            <span style={{ fontSize: '11px', color: '#B9D3EB' }}>Personal Assigned Portfolio Scope (§10)</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '0.3px' }}>
            {summary.scopeBanner?.displayScope || 'My Customer Portfolio'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#B9D3EB' }}>My Portfolio Exposure</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF' }}>
              {formatCurrency(summary.totalOutstandingExposure)}
            </div>
          </div>
          <div style={{ textAlign: 'right', borderLeft: '1px solid #1B4580', paddingLeft: '16px' }}>
            <div style={{ fontSize: '11px', color: '#B9D3EB' }}>Portfolio Coverage</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: summary.insuranceCoveragePct >= 100 ? '#4ADE80' : '#FBBF24' }}>
              {summary.insuranceCoveragePct}%
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '12px',
        }}
      >
        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>My Customers</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.totalCustomersCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Assigned borrower CIFs</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>My Collaterals</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {summary.activeCollateralsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Val: {formatCurrency(summary.totalCollateralMarketValue)}</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Insurance Required</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0E284E', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceRequired)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Total mandatory coverage</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Active Insurance</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', marginTop: '4px' }}>
            {formatCurrency(summary.totalValidActiveInsurance)}
          </div>
          <div style={{ fontSize: '11px', color: '#15803D' }}>Valid policies sum</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: '4px solid #DC2626' }}>
          <div style={{ ...kpiLabelStyle, color: '#DC2626' }}>Insurance Gap</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {formatCurrency(summary.totalInsuranceGap)}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Unhedged portfolio risk</div>
        </div>

        <div style={{ ...kpiCardStyle, borderLeft: summary.expiredPoliciesCount > 0 ? '4px solid #DC2626' : '1px solid #DCE4EE' }}>
          <div style={{ ...kpiLabelStyle, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#64748B' }}>Expired Policies</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.expiredPoliciesCount > 0 ? '#DC2626' : '#0E284E', marginTop: '4px' }}>
            {summary.expiredPoliciesCount}
          </div>
          <div style={{ fontSize: '11px', color: '#DC2626' }}>Immediate renewal needed</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Due for Renewal</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {summary.policiesExpiringWithin30Days}
          </div>
          <div style={{ fontSize: '11px', color: '#D97706' }}>Within next 30 days</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiLabelStyle}>Missing Documents</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: summary.missingDocumentsCount > 0 ? '#B45309' : '#0E284E', marginTop: '4px' }}>
            {summary.missingDocumentsCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Mandatory file checklist</div>
        </div>
      </div>

      {/* Priority Section: "Requires My Attention" (§10) */}
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
            backgroundColor: '#FFFBF5',
            borderBottom: '1px solid #FED7AA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '18px', height: '18px', color: '#EA580C' }} />
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#9A3412', margin: 0 }}>
                Requires My Attention ({attentionItems.length} critical items)
              </h3>
              <p style={{ fontSize: '12px', color: '#C2410C', margin: '2px 0 0 0' }}>
                Follow up with customers on renewals, submit missing deeds, and fix returned maker tasks
              </p>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #DCE4EE', color: '#0E284E' }}>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Priority</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Category</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Customer Name / CIF</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Deficit / Description</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Required Action</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {attentionItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    <CheckCircle style={{ width: '24px', height: '24px', color: '#16A34A', margin: '0 auto 6px auto' }} />
                    <div style={{ fontWeight: 600 }}>All portfolio items are currently compliant.</div>
                  </td>
                </tr>
              ) : (
                attentionItems.slice(0, 10).map((item, idx) => (
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
                          backgroundColor: item.priority === 'Critical' ? '#FEE2E2' : '#FEF3C7',
                          color: item.priority === 'Critical' ? '#DC2626' : '#B45309',
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
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{item.customerCif}</div>
                    </td>

                    <td style={{ padding: '10px 14px', color: '#475569' }}>
                      {item.issueDescription}
                    </td>

                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0E284E' }}>
                      {item.requiredAction}
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
                        Action
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
        title="My Assigned Customer Collateral Roster"
        subtitle="Full real-time portfolio records assigned to Relationship Manager"
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
