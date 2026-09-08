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
import { ExecutiveDashboardView } from './views/ExecutiveDashboardView';
import { SeniorManagementDashboardView } from './views/SeniorManagementDashboardView';
import { SegmentDirectorDashboardView } from './views/SegmentDirectorDashboardView';
import { BranchManagerDashboardView } from './views/BranchManagerDashboardView';
import { RelationshipManagerView } from './views/RelationshipManagerView';
import { RelationshipOfficerView } from './views/RelationshipOfficerView';
import { ComplianceRiskView } from './views/ComplianceRiskView';
import { DocumentOfficerView } from './views/DocumentOfficerView';
import { AuditorDashboardView } from './views/AuditorDashboardView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { ReadOnlyDashboardView } from './views/ReadOnlyDashboardView';

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
  selectedSegment = 'Corporate Banking',
  onSelectSegment = () => {},
  segments = [],
  branches = [],
  systemParameters = [],
  onNavigate,
  onApproveTask,
  onRejectTask,
}) => {
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setErrorStatus(null);
    setErrorMessage(null);

    const queryParams = {
      userId: currentUser.userId || currentUser.username,
      segment: selectedSegment,
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
      const msg = err?.message || 'Unable to connect to CDIMS Dashboard Backend Service.';
      if (msg.includes('403') || msg.toLowerCase().includes('authorized') || msg.toLowerCase().includes('permission')) {
        setErrorStatus('UNAUTHORIZED');
        setErrorMessage('You are not authorized to view the requested dashboard scope.');
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setErrorStatus('BACKEND_UNAVAILABLE');
        setErrorMessage('The CDIMS Backend Server on :8082 is unreachable. Please verify the service is running.');
      } else {
        setErrorStatus('API_ERROR');
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    currentUser.userId,
    currentUser.username,
    selectedSegment,
    filterDistrict,
    filterBranch,
    filterCategory,
    filterStatus,
    filterExpiry,
  ]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleExportCsv = () => {
    const url = cimsApi.getDashboardExportUrl({
      userId: currentUser.userId || currentUser.username,
      segment: selectedSegment,
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
                ? 'CDIMS Backend Service Unavailable'
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
    displayScope: selectedSegment || 'Corporate Banking',
    scopeLevel: 'BANK_WIDE',
    authorizedRole: currentUser.role,
    segment: selectedSegment,
    availableSegments: segments.map((s) => s.name),
    district: filterDistrict,
    branch: filterBranch,
    lockedSegment: false,
    lockedDistrict: false,
    lockedBranch: false,
    serverDate: new Date().toISOString().split('T')[0],
    lastRefresh: 'Just now',
  };

  const defaultSummary: DashboardSummary = summary || {
    scopeBanner: scopeBannerData,
    totalOutstandingExposure: 0,
    totalCollateralMarketValue: 0,
    totalNetSecurityValue: 0,
    totalInsuranceRequired: 0,
    totalValidActiveInsurance: 0,
    totalInsuranceGap: 0,
    insuranceCoveragePct: 100,
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
    insurerConcentrationMaxPct: 30,
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
      {/* Universal Scope Banner (§3, §4, §18) */}
      <ScopeBanner
        scopeData={scopeBannerData}
        selectedSegment={selectedSegment}
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

      {/* Role-Based Dashboard View Router (§5 through §17) */}
      {(() => {
        switch (role) {
          case 'EXEC':
            return (
              <ExecutiveDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
              />
            );

          case 'SRMGMT':
            return (
              <SeniorManagementDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
                onExport={handleExportCsv}
              />
            );

          case 'HODEPT':
            return (
              <SegmentDirectorDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
                isDistrictDirector={false}
              />
            );

          case 'DISTDIR':
            return (
              <SegmentDirectorDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
                isDistrictDirector={true}
              />
            );

          case 'BRMGR':
            return (
              <BranchManagerDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                workQueue={workQueue}
                onNavigate={onNavigate}
                onApproveTask={onApproveTask}
                onRejectTask={onRejectTask}
              />
            );

          case 'SRM':
          case 'BRM':
            return (
              <RelationshipManagerView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                workQueue={workQueue}
                onNavigate={onNavigate}
                isSeniorRM={role === 'SRM'}
              />
            );

          case 'CRO':
          case 'BRO':
            return (
              <RelationshipOfficerView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                workQueue={workQueue}
                onNavigate={onNavigate}
              />
            );

          case 'COMPLIANCE':
            return (
              <ComplianceRiskView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
                isRiskOfficer={false}
              />
            );

          case 'RISK':
            return (
              <ComplianceRiskView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
                isRiskOfficer={true}
              />
            );

          case 'MGRCOLLDOC':
          case 'COLLDOCOFF':
            return (
              <DocumentOfficerView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
                isManager={role === 'MGRCOLLDOC'}
              />
            );

          case 'AUDITOR':
            return (
              <AuditorDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
              />
            );

          case 'SYSADMIN':
            return (
              <AdminDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
              />
            );

          case 'RDONLY':
          default:
            return (
              <ReadOnlyDashboardView
                summary={defaultSummary}
                charts={defaultCharts}
                portfolioRows={portfolioRows}
                onNavigate={onNavigate}
              />
            );
        }
      })()}
    </div>
  );
};
