import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Shield,
  Lock,
  WifiOff,
} from 'lucide-react';
import {
  UserSession,
  DashboardSummary,
  DashboardChartData,
  DashboardPortfolioRow,
  DashboardWorkQueueItem,
  BusinessSegment,
  Branch,
  SystemParameter,
  LoanAccount,
  Collateral,
  InsurancePolicy,
  CimsException,
  WorkflowTask,
  OwnershipDocument,
  LoanCollateralLink,
} from '../../types';
import { cimsApi } from '../../api/cimsApi';
import { ScopeBanner } from './ScopeBanner';
import { HierarchicalDashboard } from './HierarchicalDashboard';
import { UniversalPortfolioTable } from './UniversalPortfolioTable';
import { PaginatedPortfolioGrid } from './components/PaginatedPortfolioGrid';

interface DashboardContainerProps {
  currentUser: UserSession;
  selectedSegment?: string;
  onSelectSegment?: (segment: string) => void;
  customers?: any[];
  facilities?: LoanAccount[];
  collaterals?: Collateral[];
  policies?: InsurancePolicy[];
  exceptions?: CimsException[];
  workflowTasks?: WorkflowTask[];
  documents?: OwnershipDocument[];
  links?: LoanCollateralLink[];
  segments?: BusinessSegment[];
  branches?: Branch[];
  systemParameters?: SystemParameter[];
  onNavigate: (pageId: any, params?: any) => void;
  onApproveTask?: (taskId: string, comments: string) => Promise<void>;
  onRejectTask?: (taskId: string, comments: string) => Promise<void>;
}

export const DashboardContainer: React.FC<DashboardContainerProps> = ({
  currentUser,
  selectedSegment,
  onSelectSegment = () => {},
  segments = [],
  branches = [],
  systemParameters = [],
  onNavigate,
  onApproveTask,
  onRejectTask,
}) => {
  const activeSegment = selectedSegment || currentUser.segment || (segments[0]?.name || '');
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'portfolio'>('hierarchy');
  // Filter States (§4)
  const [filterDistrict, setFilterDistrict] = useState('ALL');
  const [filterBranch, setFilterBranch] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterExpiry, setFilterExpiry] = useState('ALL');

  // Async Telemetry States
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<DashboardChartData | null>(null);
  const [portfolioRows, setPortfolioRows] = useState<DashboardPortfolioRow[]>([]);
  const [workQueue, setWorkQueue] = useState<DashboardWorkQueueItem[]>([]);

  // Request State (§27 Empty vs Error Handling)
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (force = false) => {
    if (force) {
      cimsApi.invalidateState();
    }
    // When viewing the 9-level hierarchical drilldown without portfolio tab, skip role-view queries
    if (activeTab === 'hierarchy' && !force) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    const queryParams = {
      userId: currentUser.userId || currentUser.username,
      segment: activeSegment,
      district: filterDistrict,
      branch: filterBranch,
      category: filterCategory,
      status: filterStatus,
      expiry: filterExpiry,
    };

    try {
      const [sumRes, chartRes, portRes, wqRes] = await Promise.all([
        cimsApi.getDashboardSummary(queryParams),
        cimsApi.getDashboardCharts(queryParams),
        cimsApi.getDashboardPortfolio(queryParams),
        cimsApi.getDashboardWorkQueue({
          userId: queryParams.userId,
          segment: queryParams.segment,
          district: queryParams.district,
          branch: queryParams.branch,
        }),
      ]);

      setSummary(sumRes);
      setCharts(chartRes);
      setPortfolioRows(portRes || []);
      setWorkQueue(wqRes || []);
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      const msg = err?.message || 'Unable to load dashboard data.';
      if (msg.includes('403') || msg.toLowerCase().includes('authorized') || msg.toLowerCase().includes('permission')) {
        setErrorStatus('UNAUTHORIZED');
        setErrorMessage('You are not authorized to view the requested dashboard scope.');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setErrorStatus('BACKEND_UNAVAILABLE');
        setErrorMessage('The service is temporarily unreachable. Please try again in a moment.');
      } else {
        setErrorStatus('API_ERROR');
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    currentUser.userId,
    currentUser.username,
    activeSegment,
    filterDistrict,
    filterBranch,
    filterCategory,
    filterStatus,
    filterExpiry,
  ]);

  useEffect(() => {
    if (activeTab !== 'hierarchy') {
      fetchDashboardData();
    }
  }, [fetchDashboardData, activeTab]);

  const handleExportCsv = () => {
    const url = cimsApi.getDashboardExportUrl({
      userId: currentUser.userId || currentUser.username,
      segment: activeSegment,
      district: filterDistrict,
      branch: filterBranch,
      category: filterCategory,
      status: filterStatus,
      expiry: filterExpiry,
    });
    window.open(url, '_blank');
  };

  // Render Error State (§27)
  if (errorStatus) {
    return (
      <div style={{ padding: '32px 20px', maxWidth: '1400px', margin: '0 auto' }}>
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #F87171',
            borderRadius: '10px',
            padding: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px',
            color: '#991B1B',
          }}
        >
          {errorStatus === 'UNAUTHORIZED' ? (
            <Lock style={{ width: '28px', height: '28px', flexShrink: 0, color: '#DC2626' }} />
          ) : (
            <WifiOff style={{ width: '28px', height: '28px', flexShrink: 0, color: '#DC2626' }} />
          )}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
              {errorStatus === 'UNAUTHORIZED'
                ? 'Access Denied by Security Policy'
                : errorStatus === 'BACKEND_UNAVAILABLE'
                ? 'Service Temporarily Unavailable'
                : 'Dashboard Data Load Error'}
            </h3>
            <p style={{ fontSize: '13px', margin: '6px 0 16px 0', color: '#7F1D1D' }}>
              {errorMessage}
            </p>
            <button
              onClick={() => fetchDashboardData()}
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw style={{ width: '14px', height: '14px' }} />
              <span>Retry Request</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback initial scope data while loading
  const scopeBannerData = summary?.scopeBanner || {
    displayScope: `${activeSegment || 'Bank Scope'}`,
    scopeLevel: 'BANK_WIDE',
    authorizedRole: currentUser.role,
    segment: activeSegment,
    availableSegments: segments.map((s) => s.name),
    district: filterDistrict !== 'ALL' ? filterDistrict : 'All Districts',
    branch: filterBranch !== 'ALL' ? filterBranch : 'All Branches',
    lockedSegment: false,
    lockedDistrict: false,
    lockedBranch: false,
    serverDate: new Date().toISOString().split('T')[0],
    lastRefresh: new Date().toLocaleTimeString(),
  };

  const defaultSummary: DashboardSummary = summary || {
    scopeBanner: scopeBannerData,
    totalOutstandingExposure: 0,
    totalCollateralMarketValue: 0,
    totalNetSecurityValue: 0,
    totalInsuranceRequired: 0,
    totalValidActiveInsurance: 0,
    totalInsuranceGap: 0,
    insuranceCoveragePct: 0,
    expiredPoliciesCount: 0,
    policiesExpiringWithin30Days: 0,
    openExceptionsCount: 0,
    pendingApprovalsCount: 0,
    activeCollateralsCount: 0,
    totalCustomersCount: 0,
    totalFacilitiesCount: 0,
    totalBranchesCount: 0,
    missingDocumentsCount: 0,
    pendingDocumentVerificationsCount: 0,
    returnedTasksCount: 0,
    overrideCount: 0,
    insurerConcentrationMaxPct: 0,
    systemDate: new Date().toISOString().split('T')[0],
    lastRefreshTimestamp: new Date().toLocaleTimeString(),
  };

  const defaultCharts: DashboardChartData = charts || {
    complianceDonut: [],
    exposureVsProtection: [],
    districtRanking: [],
    branchRanking: [],
    expiryPipeline: [],
    collateralCategoryDistribution: [],
    topInsuranceGaps: [],
    workflowFunnel: [],
    documentationHealth: [],
    ownershipDistribution: [],
  };

  const role = currentUser.role || 'RDONLY';

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Authoritative Dashboard Shell Navigation */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all select-none ${
              activeTab === 'hierarchy'
                ? 'bg-[#00205B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Management Dashboard
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all select-none ${
              activeTab === 'portfolio'
                ? 'bg-[#00205B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Universal Portfolio Table
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#00205B]" />
          <span>Authorized Scope:</span>
          <strong className="text-slate-900 font-bold">{currentUser.name}</strong>
          <span className="text-[#D48806] font-semibold">({currentUser.roleName || currentUser.role})</span>
        </div>
      </div>

      {activeTab === 'hierarchy' && (
        <HierarchicalDashboard
          currentUser={currentUser}
          selectedSegment={activeSegment}
          onSelectSegment={onSelectSegment}
          segments={segments}
          branches={branches}
          onNavigate={onNavigate}
          onRefreshTelemetry={fetchDashboardData}
        />
      )}

      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <PaginatedPortfolioGrid
            userId={currentUser.userId || currentUser.username}
            segment={activeSegment && activeSegment !== 'ALL' ? activeSegment : undefined}
            district={filterDistrict && filterDistrict !== 'ALL' ? filterDistrict : undefined}
            branch={filterBranch && filterBranch !== 'ALL' ? filterBranch : undefined}
            initialStatus={filterStatus}
            onDrillToCollateral={(id) => onNavigate('collateral-detail', { id })}
            onDrillToCustomer={(cif) => onNavigate('customer-360', { cif })}
          />
        </div>
      )}
    </div>
  );
};
