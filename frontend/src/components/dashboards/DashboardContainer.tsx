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

  const fetchDashboardData = useCallback(async () => {
    // When viewing the 9-level hierarchical drilldown, skip role-view queries
    if (activeTab === 'hierarchy') {
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
      const msg = err?.message || 'Unable to connect to CBAIMS Dashboard Backend Service.';
      if (msg.includes('403') || msg.toLowerCase().includes('authorized') || msg.toLowerCase().includes('permission')) {
        setErrorStatus('UNAUTHORIZED');
        setErrorMessage('You are not authorized to view the requested dashboard scope.');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setErrorStatus('BACKEND_UNAVAILABLE');
        setErrorMessage('The CBAIMS Backend Server on :8082 is unreachable. Please verify the service is running.');
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
                ? 'CBAIMS Backend Service Unavailable'
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
      <div className="flex items-center justify-between mb-4 border-b border-[#E2E8F0] pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'hierarchy'
                ? 'bg-[#2C6295] text-white shadow-xs'
                : 'bg-white text-[#5B6472] hover:text-[#101828] border border-[#E2E8F0]'
            }`}
          >
            Management Dashboard
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'portfolio'
                ? 'bg-[#2C6295] text-white shadow-xs'
                : 'bg-white text-[#5B6472] hover:text-[#101828] border border-[#E2E8F0]'
            }`}
          >
            Universal Portfolio Table
          </button>
        </div>

        <div className="text-xs text-[#5B6472] font-medium">
          Authorized Scope: <strong className="text-[#101828]">{currentUser.name}</strong> ({currentUser.roleName})
        </div>
      </div>

      {activeTab === 'hierarchy' && (
        <HierarchicalDashboard
          currentUser={currentUser}
          segments={segments}
          branches={branches}
          onNavigate={onNavigate}
        />
      )}

      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <ScopeBanner
            scopeData={scopeBannerData}
            selectedSegment={activeSegment}
            onSelectSegment={onSelectSegment}
            filterDistrict={filterDistrict}
            onSelectDistrict={setFilterDistrict}
            filterBranch={filterBranch}
            onSelectBranch={setFilterBranch}
            filterCategory={filterCategory}
            onSelectCategory={setFilterCategory}
            filterStatus={filterStatus}
            onSelectStatus={setFilterStatus}
            filterExpiry={filterExpiry}
            onSelectExpiry={setFilterExpiry}
            onRefresh={fetchDashboardData}
            onExport={handleExportCsv}
            isLoading={isLoading}
          />
          <UniversalPortfolioTable
            rows={portfolioRows}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </div>
  );
};
