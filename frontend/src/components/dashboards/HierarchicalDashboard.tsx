import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  MapPin,
  Landmark,
  User,
  CreditCard,
  Shield,
  FileText,
  ChevronRight,
  ArrowLeft,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Layers,
  FileCheck,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  Briefcase,
  FileCheck2,
  Clock,
  GitFork,
  History,
  Check,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { UserSession, BusinessSegment, Branch, KpiExplanation } from '../../types';
import { cimsApi } from '../../api/cimsApi';
import { EnterpriseScopeHeader } from './components/EnterpriseScopeHeader';
import { FiveTierKpiStrip } from './components/FiveTierKpiStrip';
import { OperationalHotspotsV2 } from './components/OperationalHotspotsV2';
import { HistoricalSnapshotTrend } from './components/HistoricalSnapshotTrend';
import { PaginatedPortfolioGrid } from './components/PaginatedPortfolioGrid';
import { KpiWhyModal } from './components/KpiWhyModal';

export type DrillLevel =
  | 'BANK'
  | 'SEGMENT'
  | 'DISTRICT'
  | 'AREA'
  | 'BRANCH'
  | 'CUSTOMER'
  | 'FACILITY'
  | 'COLLATERAL'
  | 'POLICY';

interface HierarchicalDashboardProps {
  currentUser: UserSession;
  segments?: BusinessSegment[];
  branches?: Branch[];
  onNavigate?: (screen: string, params?: any) => void;
}

export const HierarchicalDashboard: React.FC<HierarchicalDashboardProps> = ({
  currentUser,
  segments = [],
  branches = [],
  onNavigate,
}) => {
  // Determine initial drill level based on role and organizational metadata (no hardcoded fallbacks)
  const initialSetup = useMemo(() => {
    const role = currentUser.role;
    const defaultSegment = currentUser.segment || (segments[0]?.name || '');
    const defaultDistrict = currentUser.branch || (branches[0]?.parentDistrictId || '');
    const defaultBranch = currentUser.branch || (branches[0]?.name || '');

    if (role === 'HODEPT') {
      return { level: 'SEGMENT' as DrillLevel, segment: defaultSegment };
    }
    if (role === 'DISTDIR') {
      return { level: 'DISTRICT' as DrillLevel, district: defaultDistrict, segment: defaultSegment };
    }
    if (role === 'BRMGR') {
      return { level: 'BRANCH' as DrillLevel, branch: defaultBranch, segment: 'ALL' };
    }
    return { level: 'BANK' as DrillLevel, segment: 'ALL' };
  }, [currentUser, segments, branches]);

  // Drill State
  const [currentLevel, setCurrentLevel] = useState<DrillLevel>(initialSetup.level);
  const [selectedSegment, setSelectedSegment] = useState<string>(initialSetup.segment || (segments[0]?.name || ''));
  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialSetup.district || '');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>(initialSetup.branch || '');
  const [selectedCif, setSelectedCif] = useState<string>('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [selectedCollateralId, setSelectedCollateralId] = useState<string>('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');

  // Why Modal State for Deterministic Explanations
  const [whyModalKey, setWhyModalKey] = useState<string | null>(null);
  const [kpiExplanation, setKpiExplanation] = useState<KpiExplanation | null>(null);
  const [isExplainingKpi, setIsExplainingKpi] = useState<boolean>(false);

  const handleWhyClick = useCallback(async (kpiKey: string, _title: string) => {
    setWhyModalKey(kpiKey);
    setIsExplainingKpi(true);
    try {
      const res = await cimsApi.getDashboardKpiExplanation(kpiKey, {
        userId: currentUser.userId || currentUser.username,
        segment: selectedSegment && selectedSegment !== 'ALL' ? selectedSegment : undefined,
        district: selectedDistrict && selectedDistrict !== 'ALL' ? selectedDistrict : undefined,
        branch: selectedBranch && selectedBranch !== 'ALL' ? selectedBranch : undefined,
      });
      setKpiExplanation(res);
    } catch (err) {
      console.error('Failed to load KPI explanation:', err);
    } finally {
      setIsExplainingKpi(false);
    }
  }, [currentUser, selectedSegment, selectedDistrict, selectedBranch]);

  // Data States
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Load data progressively based on current level
  const loadLevelData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const uid = currentUser.userId || currentUser.username;
      let res: any = null;

      switch (currentLevel) {
        case 'BANK':
          res = await cimsApi.getHierarchyBank(uid);
          break;
        case 'SEGMENT':
          res = await cimsApi.getHierarchySegment(selectedSegment, uid);
          break;
        case 'DISTRICT':
          res = await cimsApi.getHierarchyDistrict(selectedDistrict, selectedSegment, uid);
          break;
        case 'AREA':
          res = await cimsApi.getHierarchyArea(selectedArea, selectedDistrict, selectedSegment, uid);
          break;
        case 'BRANCH':
          res = await cimsApi.getHierarchyBranch(selectedBranch, selectedSegment, uid);
          break;
        case 'CUSTOMER':
          res = await cimsApi.getHierarchyCustomer(selectedCif, uid);
          break;
        case 'FACILITY':
          res = await cimsApi.getHierarchyFacility(selectedFacilityId, uid);
          break;
        case 'COLLATERAL':
          res = await cimsApi.getHierarchyCollateral(selectedCollateralId, uid);
          break;
        case 'POLICY':
          res = await cimsApi.getHierarchyPolicy(selectedPolicyId, uid);
          break;
      }
      setData(res);
    } catch (err: any) {
      console.error('Error loading hierarchical dashboard data:', err);
      setError(err?.message || 'Failed to retrieve level analytics from server.');
    } finally {
      setIsLoading(false);
    }
  }, [
    currentLevel,
    selectedSegment,
    selectedDistrict,
    selectedArea,
    selectedBranch,
    selectedCif,
    selectedFacilityId,
    selectedCollateralId,
    selectedPolicyId,
    currentUser.userId,
    currentUser.username,
  ]);

  useEffect(() => {
    loadLevelData();
  }, [loadLevelData]);

  // Navigation handlers
  const drillToSegment = (seg: string) => {
    setSelectedSegment(seg);
    setCurrentLevel('SEGMENT');
  };

  const drillToDistrict = (dist: string) => {
    setSelectedDistrict(dist);
    setCurrentLevel('DISTRICT');
  };

  const drillToArea = (area: string) => {
    setSelectedArea(area);
    setCurrentLevel('AREA');
  };

  const drillToBranch = (brn: string) => {
    setSelectedBranch(brn);
    setCurrentLevel('BRANCH');
  };

  const drillToCustomer = (cif: string) => {
    setSelectedCif(cif);
    setCurrentLevel('CUSTOMER');
  };

  const drillToFacility = (facId: string) => {
    setSelectedFacilityId(facId);
    setCurrentLevel('FACILITY');
  };

  const drillToCollateral = (colId: string) => {
    setSelectedCollateralId(colId);
    setCurrentLevel('COLLATERAL');
  };

  const drillToPolicy = (polId: string) => {
    setSelectedPolicyId(polId);
    setCurrentLevel('POLICY');
  };

  // Breadcrumbs list
  const breadcrumbs = useMemo(() => {
    const crumbs = [];

    // Bank Crumb (if user has bank-wide view)
    const isBankRole = ['EXEC', 'SRMGMT', 'SYSADMIN', 'AUDITOR', 'COMPLIANCE', 'RISK', 'MGRCOLLDOC'].includes(currentUser.role);
    if (isBankRole || currentLevel === 'BANK') {
      crumbs.push({ label: 'Bank Overview', level: 'BANK' as DrillLevel });
    }

    if (currentLevel !== 'BANK') {
      if (selectedSegment && selectedSegment !== 'ALL') {
        crumbs.push({ label: selectedSegment, level: 'SEGMENT' as DrillLevel });
      }
      if (['DISTRICT', 'AREA', 'BRANCH', 'CUSTOMER', 'FACILITY', 'COLLATERAL', 'POLICY'].includes(currentLevel) && selectedDistrict) {
        crumbs.push({ label: selectedDistrict, level: 'DISTRICT' as DrillLevel });
      }
      if (['AREA'].includes(currentLevel) && selectedArea) {
        crumbs.push({ label: selectedArea, level: 'AREA' as DrillLevel });
      }
      if (['BRANCH', 'CUSTOMER', 'FACILITY', 'COLLATERAL', 'POLICY'].includes(currentLevel) && selectedBranch) {
        crumbs.push({ label: selectedBranch, level: 'BRANCH' as DrillLevel });
      }
      if (['CUSTOMER', 'FACILITY', 'COLLATERAL', 'POLICY'].includes(currentLevel) && selectedCif) {
        crumbs.push({ label: `Customer (${selectedCif})`, level: 'CUSTOMER' as DrillLevel });
      }
      if (['FACILITY'].includes(currentLevel) && selectedFacilityId) {
        crumbs.push({ label: `Facility (${selectedFacilityId})`, level: 'FACILITY' as DrillLevel });
      }
      if (['COLLATERAL'].includes(currentLevel) && selectedCollateralId) {
        crumbs.push({ label: `Collateral (${selectedCollateralId})`, level: 'COLLATERAL' as DrillLevel });
      }
      if (['POLICY'].includes(currentLevel) && selectedPolicyId) {
        crumbs.push({ label: `Policy (${selectedPolicyId})`, level: 'POLICY' as DrillLevel });
      }
    }

    return crumbs;
  }, [
    currentLevel,
    selectedSegment,
    selectedDistrict,
    selectedArea,
    selectedBranch,
    selectedCif,
    selectedFacilityId,
    selectedCollateralId,
    selectedPolicyId,
    currentUser.role,
  ]);

  const handleCrumbClick = (level: DrillLevel) => {
    setCurrentLevel(level);
    if (level === 'BANK') {
      setSelectedSegment('ALL');
      setSelectedDistrict('');
      setSelectedArea('');
      setSelectedBranch('');
      setSelectedCif('');
      setSelectedFacilityId('');
      setSelectedCollateralId('');
      setSelectedPolicyId('');
    } else if (level === 'SEGMENT') {
      setSelectedDistrict('');
      setSelectedArea('');
      setSelectedBranch('');
      setSelectedCif('');
      setSelectedFacilityId('');
      setSelectedCollateralId('');
      setSelectedPolicyId('');
    } else if (level === 'DISTRICT') {
      setSelectedArea('');
      setSelectedBranch('');
      setSelectedCif('');
      setSelectedFacilityId('');
      setSelectedCollateralId('');
      setSelectedPolicyId('');
    } else if (level === 'AREA') {
      setSelectedBranch('');
      setSelectedCif('');
      setSelectedFacilityId('');
      setSelectedCollateralId('');
      setSelectedPolicyId('');
    } else if (level === 'BRANCH') {
      setSelectedCif('');
      setSelectedFacilityId('');
      setSelectedCollateralId('');
      setSelectedPolicyId('');
    } else if (level === 'CUSTOMER') {
      setSelectedFacilityId('');
      setSelectedCollateralId('');
      setSelectedPolicyId('');
    } else if (level === 'FACILITY') {
      setSelectedCollateralId('');
      setSelectedPolicyId('');
    } else if (level === 'COLLATERAL') {
      setSelectedPolicyId('');
    }
  };

  const PIE_COLORS = ['#1e40af', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#4b5563'];

  const renderRequiresAttention = (items?: any[]) => {
    if (!items) return null;
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h4 className="font-bold text-sm text-[#101828]">Requires Attention & Operational Hotspots</h4>
              <p className="text-xs text-[#5B6472]">High-priority policy expiries, coverage gaps, and document deficiencies requiring action</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {items.length} Hotspots
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
            <div className="text-xs font-bold text-slate-700">No Urgent Operational Hotspots</div>
            <div className="text-[11px] text-[#5B6472] mt-0.5">All monitored assets, policies, and documents in this scope are compliant.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                <tr>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Issue / Type</th>
                  <th className="p-3">Asset / Reference</th>
                  <th className="p-3">Impact / Deficit</th>
                  <th className="p-3">Recommended Action</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {items.map((item: any, idx: number) => {
                  const sevBadge =
                    item.severity === 'CRITICAL'
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : item.severity === 'HIGH'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200';

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${sevBadge}`}>
                          {item.severity}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#101828]">{item.title}</div>
                        <div className="text-[11px] text-[#5B6472]">{item.type}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-semibold text-[#1F4E7A]">{item.code || item.id}</div>
                        <div className="text-[11px] text-[#5B6472] line-clamp-1">{item.description}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {item.amount > 0 ? `ETB ${Number(item.amount).toLocaleString()}` : '—'}
                      </td>
                      <td className="p-3 text-[#5B6472] text-[11px]">
                        {item.recommendedAction}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            if (item.type === 'EXPIRED_POLICY') {
                              drillToPolicy(item.id);
                            } else if (item.type === 'UNDERINSURED' || item.type === 'UNINSURED' || item.type === 'MISSING_DOC') {
                              drillToCollateral(item.entityId || item.id);
                            } else if (onNavigate) {
                              onNavigate(item.routeTarget?.replace('/', '') || 'exceptions');
                            }
                          }}
                          className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] font-bold rounded border border-[#B9D3EB] text-xs transition-colors"
                        >
                          Act Now
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderSharedCollaterals = (items?: any[]) => {
    if (!items) return null;
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <div>
              <h4 className="font-bold text-sm text-[#101828]">Cross-Segment Shared Collateral Assets</h4>
              <p className="text-xs text-[#5B6472]">Securing credit facilities across multiple segments without double counting valuation</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
            {items.length} Assets
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center">
            <div className="text-xs font-semibold text-[#5B6472]">No cross-segment shared collateral assets identified in this scope.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                <tr>
                  <th className="p-3">Collateral Code</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Borrower</th>
                  <th className="p-3">Owning Segment</th>
                  <th className="p-3">Linked Segments</th>
                  <th className="p-3">Facilities</th>
                  <th className="p-3">Market Value</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {items.map((sc: any) => (
                  <tr key={sc.collateralId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#1F4E7A]">{sc.collateralCode}</td>
                    <td className="p-3 font-semibold text-[#101828]">{sc.description}</td>
                    <td className="p-3">{sc.category}</td>
                    <td className="p-3">{sc.customerName}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {sc.owningSegment}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {sc.linkedSegments?.map((seg: string) => (
                          <span key={seg} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                            {seg}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 font-bold">{sc.facilityCount} facilities</td>
                    <td className="p-3 font-bold text-[#101828]">ETB {Number(sc.marketValue ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => drillToCollateral(sc.collateralId)}
                        className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] font-bold rounded border border-[#B9D3EB] text-xs transition-colors"
                      >
                        View Asset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Enterprise Scope & Freshness Header */}
      <EnterpriseScopeHeader
        scopeLevel={currentLevel}
        displayScope={
          currentLevel === 'BANK'
            ? 'Bank-Wide Overview'
            : currentLevel === 'SEGMENT'
            ? `${selectedSegment} Segment`
            : currentLevel === 'DISTRICT'
            ? `${selectedDistrict} District`
            : currentLevel === 'BRANCH'
            ? `${selectedBranch} Branch`
            : currentLevel === 'CUSTOMER'
            ? `Customer CIF ${selectedCif}`
            : `${currentLevel} View`
        }
        authorizedRole={currentUser.role}
        asOfDate={data?.asOfDate || new Date().toISOString().split('T')[0]}
        lastRefresh={data?.lastRefreshed || new Date().toLocaleTimeString()}
        onRefresh={loadLevelData}
        isLoading={isLoading}
      />

      {/* Dynamic Breadcrumb Bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[#5B6472] overflow-x-auto py-1">
          <Layers className="w-4 h-4 text-[#2C6295] shrink-0 mr-1" />
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                <button
                  onClick={() => !isLast && handleCrumbClick(crumb.level)}
                  disabled={isLast}
                  className={`font-semibold transition-colors px-1.5 py-0.5 rounded ${
                    isLast
                      ? 'text-[#1F4E7A] bg-[#EFF5FB] cursor-default font-bold'
                      : 'text-[#5B6472] hover:text-[#2C6295] hover:bg-slate-100 cursor-pointer'
                  }`}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {breadcrumbs.length > 1 && (
            <button
              onClick={() => {
                const prev = breadcrumbs[breadcrumbs.length - 2];
                if (prev) handleCrumbClick(prev.level);
              }}
              className="px-2.5 py-1 text-xs font-semibold text-[#101828] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded flex items-center gap-1 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back Up
            </button>
          )}
          <button
            onClick={loadLevelData}
            disabled={isLoading}
            className="p-1.5 text-xs text-slate-600 hover:text-[#2C6295] hover:bg-slate-100 border border-[#E2E8F0] rounded transition-all"
            title="Refresh Level Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading & Error State */}
      {isLoading && (
        <div className="p-12 bg-white border border-[#E2E8F0] rounded-xl text-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 text-[#2C6295] animate-spin mx-auto" />
          <div className="text-sm font-bold text-[#101828]">Loading {currentLevel.toLowerCase()} analytics...</div>
          <div className="text-xs text-[#5B6472]">Aggregating real database records across organizational hierarchy</div>
        </div>
      )}

      {error && !isLoading && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Data Loading Error</div>
            <div className="text-xs mt-0.5">{error}</div>
            <button
              onClick={loadLevelData}
              className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          {/* LEVEL 1: BANK OVERVIEW */}
          {currentLevel === 'BANK' && (
            <div className="space-y-6">
              {/* Bank Overview 5-Tier KPIs Strip */}
              {data.summary && (
                <FiveTierKpiStrip
                  summary={data.summary}
                  onWhyClick={handleWhyClick}
                />
              )}

              {/* Genuine Longitudinal Trend Analysis */}
              <HistoricalSnapshotTrend
                scopeLevel="BANK"
                scopeId="ALL"
                userId={currentUser.userId || currentUser.username}
              />

              {/* 4 Business Segments Comparison Cards (Click to Drill Down) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#101828]">Business Segment Portfolios</h3>
                    <p className="text-xs text-[#5B6472]">Click on any segment card to drill down into its district performance</p>
                  </div>
                  <span className="text-xs font-semibold bg-[#EFF5FB] text-[#1F4E7A] border border-[#B9D3EB] px-2.5 py-1 rounded-full">
                    {data.segments?.length ?? 4} Active Segments
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {data.segments?.map((seg: any) => {
                    const comp = seg.compliancePct ?? 0;
                    const compBadge =
                      comp >= 90
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : comp >= 70
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-red-100 text-red-800 border-red-300';

                    return (
                      <div
                        key={seg.segmentName}
                        onClick={() => drillToSegment(seg.segmentName)}
                        className="bg-white border-2 border-[#E2E8F0] hover:border-[#3E7AB0] rounded-xl p-5 shadow-xs hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="p-2 bg-[#EFF5FB] text-[#1F4E7A] rounded-lg group-hover:bg-[#2C6295] group-hover:text-white transition-colors">
                              <Building2 className="w-5 h-5" />
                            </span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${compBadge}`}>
                              {comp}% Covered
                            </span>
                          </div>

                          <h4 className="font-extrabold text-base text-[#101828] group-hover:text-[#2C6295] transition-colors">
                            {seg.segmentName}
                          </h4>

                          <div className="mt-4 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-[#5B6472]">Collateral Market Value:</span>
                              <span className="font-bold text-[#101828]">ETB {((seg.collateralValue ?? 0) / 1e6).toFixed(1)}M</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#5B6472]">Outstanding Exposure:</span>
                              <span className="font-bold text-[#1F4E7A]">ETB {((seg.exposure ?? 0) / 1e6).toFixed(1)}M</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#5B6472]">Active Insurance:</span>
                              <span className="font-bold text-emerald-700">ETB {((seg.activeInsurance ?? 0) / 1e6).toFixed(1)}M</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#5B6472]">Insurance Gap:</span>
                              <span className="font-bold text-red-600">ETB {((seg.insuranceGap ?? 0) / 1e6).toFixed(1)}M</span>
                            </div>
                            <div className="flex justify-between pt-1 border-t border-slate-100 text-[11px]">
                              <span className="text-[#5B6472]">Collaterals / Customers:</span>
                              <span className="font-semibold text-slate-700">{seg.collateralCount ?? 0} / {seg.customerCount ?? 0}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#2C6295] group-hover:translate-x-1 transition-transform">
                          <span>Drill Down into Districts</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bank Visual Analytics: Exposure vs Coverage & Collateral Category Mix */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Exposure vs Active Coverage Bar Chart */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Segment Exposure vs Active Insurance</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">ETB Millions</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.segments?.map((s: any) => ({
                          name: s.segmentName?.replace(' Banking', '').replace(' (IFB)', ''),
                          exposure: Number(((s.exposure ?? 0) / 1e6).toFixed(2)),
                          activeInsurance: Number(((s.activeInsurance ?? 0) / 1e6).toFixed(2)),
                          gap: Number(((s.insuranceGap ?? 0) / 1e6).toFixed(2)),
                        })) || []}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip
                          formatter={((value: any, name: any) => [
                            `ETB ${Number(value).toLocaleString()}M`,
                            name === 'exposure' ? 'Exposure' : name === 'activeInsurance' ? 'Active Insurance' : 'Protection Gap',
                          ]) as any}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="exposure" name="Outstanding Exposure" fill="#1e40af" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="activeInsurance" name="Active Insurance" fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gap" name="Protection Gap" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Collateral Category Breakdown Donut */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Collateral Portfolio Composition</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">By Asset Class</span>
                  </div>
                  <div className="h-64 w-full flex items-center justify-center">
                    {data.categoryDistribution && data.categoryDistribution.some((c: any) => c.value > 0 || c.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.categoryDistribution.map((item: any) => ({
                              name: item.name || item.category,
                              value: Number(((item.value ?? item.count ?? 0) / (item.value ? 1e6 : 1)).toFixed(1)),
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {data.categoryDistribution.map((_: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={((val: any) => [`${val} ${data.categoryDistribution[0]?.value ? 'ETB M' : 'Assets'}`, 'Volume']) as any}
                            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px' }} layout="horizontal" verticalAlign="bottom" />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-xs text-[#5B6472] text-center">No category distribution data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Segment Comparison Breakdown Table */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h4 className="font-bold text-sm text-[#101828] mb-3">Bank-Wide Cross-Segment Performance Matrix</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Business Segment</th>
                        <th className="p-3">Customers</th>
                        <th className="p-3">Facilities</th>
                        <th className="p-3">Collaterals</th>
                        <th className="p-3">Market Value</th>
                        <th className="p-3">Exposure</th>
                        <th className="p-3">Active Cover</th>
                        <th className="p-3">Gap</th>
                        <th className="p-3">Compliance</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {data.segments?.map((seg: any) => (
                        <tr key={seg.segmentName} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-[#101828] flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#2C6295]" />
                            {seg.segmentName}
                          </td>
                          <td className="p-3 font-semibold">{seg.customerCount ?? 0}</td>
                          <td className="p-3 font-semibold">{seg.facilityCount ?? 0}</td>
                          <td className="p-3 font-semibold">{seg.collateralCount ?? 0}</td>
                          <td className="p-3 font-bold">ETB {((seg.collateralValue ?? 0) / 1e6).toFixed(2)}M</td>
                          <td className="p-3 font-bold text-[#1F4E7A]">ETB {((seg.exposure ?? 0) / 1e6).toFixed(2)}M</td>
                          <td className="p-3 font-bold text-emerald-700">ETB {((seg.activeInsurance ?? 0) / 1e6).toFixed(2)}M</td>
                          <td className="p-3 font-bold text-red-600">ETB {((seg.insuranceGap ?? 0) / 1e6).toFixed(2)}M</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                              {seg.compliancePct ?? 0}%
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => drillToSegment(seg.segmentName)}
                              className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                            >
                              Explore
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cross-Segment Shared Collateral Assets (Single Count Valuation) */}
              {renderSharedCollaterals(data.sharedCollaterals)}

              {/* Action-Oriented Operational Hotspots */}
              <OperationalHotspotsV2
                items={data.requiresAttention}
                onDrillToCollateral={drillToCollateral}
                onDrillToPolicy={drillToPolicy}
                onDrillToCustomer={drillToCustomer}
                onNavigate={onNavigate}
              />

              {/* Bank-Wide Scoped Paginated Portfolio Grid */}
              <PaginatedPortfolioGrid
                userId={currentUser.userId || currentUser.username}
                onDrillToCollateral={drillToCollateral}
                onDrillToCustomer={drillToCustomer}
              />
            </div>
          )}

          {/* LEVEL 2: SEGMENT DASHBOARD */}
          {currentLevel === 'SEGMENT' && (
            <div className="space-y-6">
              {/* Segment 5-Tier KPIs Strip */}
              {data.summary && (
                <FiveTierKpiStrip
                  summary={data.summary}
                  onWhyClick={handleWhyClick}
                />
              )}

              {/* Segment Longitudinal Trend Analysis */}
              <HistoricalSnapshotTrend
                scopeLevel="SEGMENT"
                scopeId={data.segmentName || selectedSegment}
                userId={currentUser.userId || currentUser.username}
              />

              {/* Segment Visual Analytics: District Breakdown & Compliance Ranking */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* District Exposure vs Cover Bar Chart */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">District Exposure vs Active Cover</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">ETB Millions</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.districts?.map((d: any) => ({
                          name: d.districtName?.replace(' District', ''),
                          exposure: Number(((d.exposure ?? 0) / 1e6).toFixed(2)),
                          activeInsurance: Number(((d.activeInsurance ?? 0) / 1e6).toFixed(2)),
                          gap: Number(((d.insuranceGap ?? 0) / 1e6).toFixed(2)),
                        })) || []}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip
                          formatter={((value: any, name: any) => [
                            `ETB ${Number(value).toLocaleString()}M`,
                            name === 'exposure' ? 'Exposure' : name === 'activeInsurance' ? 'Active Insurance' : 'Gap',
                          ]) as any}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="exposure" name="Exposure" fill="#1e40af" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="activeInsurance" name="Active Cover" fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gap" name="Gap" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* District Compliance Ranking Progress Bars */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm text-[#101828]">District Compliance Ranking</h4>
                    <span className="text-[11px] text-[#5B6472]">% Active Protection</span>
                  </div>
                  <div className="space-y-3.5 my-auto overflow-y-auto max-h-60 pr-1">
                    {data.districts?.map((d: any) => {
                      const comp = d.compliancePct ?? 0;
                      const barColor = comp >= 90 ? 'bg-emerald-500' : comp >= 70 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                        <div key={d.districtName} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#101828] truncate max-w-[200px]">{d.districtName}</span>
                            <span className="font-bold font-mono text-slate-800">{comp}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, comp)}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-[#5B6472] pt-0.5">
                            <span>Cover: ETB {((d.activeInsurance ?? 0) / 1e6).toFixed(1)}M</span>
                            <span>Gap: ETB {((d.insuranceGap ?? 0) / 1e6).toFixed(1)}M</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Districts in this Segment */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-[#101828]">District Performance Breakdown</h3>
                    <p className="text-xs text-[#5B6472]">Select a district to view its area offices and branch operations</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {data.districts?.map((dist: any) => (
                    <div
                      key={dist.districtName}
                      onClick={() => drillToDistrict(dist.districtName)}
                      className="bg-white border-2 border-[#E2E8F0] hover:border-[#3E7AB0] rounded-xl p-5 shadow-xs hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="p-2 bg-slate-100 text-slate-700 rounded-lg group-hover:bg-[#2C6295] group-hover:text-white transition-colors">
                            <MapPin className="w-5 h-5" />
                          </span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-300">
                            {dist.compliancePct ?? 0}% Covered
                          </span>
                        </div>

                        <h4 className="font-extrabold text-base text-[#101828] group-hover:text-[#2C6295] transition-colors">
                          {dist.districtName}
                        </h4>

                        <div className="mt-4 space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Branches in District:</span>
                            <span className="font-bold text-[#101828]">{dist.branchCount ?? 1}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Collaterals:</span>
                            <span className="font-bold text-[#101828]">{dist.collateralCount ?? 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Exposure:</span>
                            <span className="font-bold text-[#1F4E7A]">ETB {((dist.exposure ?? 0) / 1e6).toFixed(1)}M</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Active Cover:</span>
                            <span className="font-bold text-emerald-700">ETB {((dist.activeInsurance ?? 0) / 1e6).toFixed(1)}M</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Protection Gap:</span>
                            <span className="font-bold text-red-600">ETB {((dist.insuranceGap ?? 0) / 1e6).toFixed(1)}M</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#2C6295] group-hover:translate-x-1 transition-transform">
                        <span>Drill Down into Branches</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cross-Segment Shared Collaterals in this Segment */}
              {renderSharedCollaterals(data.sharedCollaterals)}

              {/* Action-Oriented Operational Hotspots */}
              <OperationalHotspotsV2
                items={data.requiresAttention}
                onDrillToCollateral={drillToCollateral}
                onDrillToPolicy={drillToPolicy}
                onDrillToCustomer={drillToCustomer}
                onNavigate={onNavigate}
              />

              {/* Segment-Scoped Paginated Portfolio Grid */}
              <PaginatedPortfolioGrid
                userId={currentUser.userId || currentUser.username}
                segment={data.segmentName || selectedSegment}
                onDrillToCollateral={drillToCollateral}
                onDrillToCustomer={drillToCustomer}
              />
            </div>
          )}

          {/* LEVEL 3: DISTRICT DASHBOARD */}
          {currentLevel === 'DISTRICT' && (
            <div className="space-y-6">
              <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#5B6472] uppercase">District Operations</div>
                  <h2 className="text-xl font-extrabold text-[#101828]">{data.districtName}</h2>
                  <div className="text-xs text-[#1F4E7A] font-bold mt-0.5">{data.segmentName}</div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <div className="text-[#5B6472]">Branches</div>
                    <div className="text-base font-bold text-[#101828]">{data.branches?.length ?? 0}</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <div className="text-[#5B6472]">Exposure</div>
                    <div className="text-base font-bold text-[#1F4E7A]">ETB {((data.summary?.totalOutstandingExposure ?? 0) / 1e6).toFixed(1)}M</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <div className="text-[#5B6472]">Compliance</div>
                    <div className="text-base font-bold text-emerald-700">{data.summary?.insuranceCoveragePct ?? 0}%</div>
                  </div>
                </div>
              </div>

              {/* District 5-Tier KPIs Strip */}
              {data.summary && (
                <FiveTierKpiStrip
                  summary={data.summary}
                  onWhyClick={handleWhyClick}
                />
              )}

              {/* District Visual Analytics: Branch Exposure & Protection */}
              {data.branches && data.branches.length > 0 && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Branch Operations Comparison</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">Exposure vs Active Insurance (ETB M)</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.branches.map((b: any) => ({
                          name: b.branchName?.replace(' Branch', '').replace(' Corporate Center', ''),
                          exposure: Number(((b.exposure ?? 0) / 1e6).toFixed(2)),
                          activeInsurance: Number(((b.activeInsurance ?? 0) / 1e6).toFixed(2)),
                          gap: Number(((b.insuranceGap ?? 0) / 1e6).toFixed(2)),
                        }))}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip
                          formatter={((value: any, name: any) => [
                            `ETB ${Number(value).toLocaleString()}M`,
                            name === 'exposure' ? 'Exposure' : name === 'activeInsurance' ? 'Active Cover' : 'Protection Gap',
                          ]) as any}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="exposure" name="Exposure" fill="#1e40af" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="activeInsurance" name="Active Cover" fill="#059669" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="gap" name="Gap" fill="#dc2626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Branches under District */}
              <div>
                <h3 className="text-base font-bold text-[#101828] mb-3">Branches & Corporate Centers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.branches?.map((brn: any) => (
                    <div
                      key={brn.branchName}
                      onClick={() => drillToBranch(brn.branchName)}
                      className="bg-white border-2 border-[#E2E8F0] hover:border-[#3E7AB0] rounded-xl p-5 shadow-xs hover:shadow-md cursor-pointer transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="p-2 bg-slate-100 text-slate-700 rounded-lg group-hover:bg-[#2C6295] group-hover:text-white transition-colors">
                            <Landmark className="w-5 h-5" />
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EFF5FB] text-[#1F4E7A] border border-[#B9D3EB]">
                            {brn.branchCode || 'BRANCH'}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-base text-[#101828] group-hover:text-[#2C6295] transition-colors">
                          {brn.branchName}
                        </h4>

                        <div className="mt-3 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Customers:</span>
                            <span className="font-bold">{brn.customerCount ?? 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Collaterals:</span>
                            <span className="font-bold">{brn.collateralCount ?? 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Exposure:</span>
                            <span className="font-bold text-[#1F4E7A]">ETB {((brn.exposure ?? 0) / 1e6).toFixed(1)}M</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Active Cover:</span>
                            <span className="font-bold text-emerald-700">ETB {((brn.activeInsurance ?? 0) / 1e6).toFixed(1)}M</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#5B6472]">Compliance:</span>
                            <span className="font-bold text-slate-800">{brn.compliancePct ?? 0}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#2C6295] group-hover:translate-x-1 transition-transform">
                        <span>View Branch Customers</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action-Oriented Operational Hotspots */}
              <OperationalHotspotsV2
                items={data.requiresAttention}
                onDrillToCollateral={drillToCollateral}
                onDrillToPolicy={drillToPolicy}
                onDrillToCustomer={drillToCustomer}
                onNavigate={onNavigate}
              />

              {/* District-Scoped Paginated Portfolio Grid */}
              <PaginatedPortfolioGrid
                userId={currentUser.userId || currentUser.username}
                district={data.districtName || selectedDistrict}
                segment={selectedSegment}
                onDrillToCollateral={drillToCollateral}
                onDrillToCustomer={drillToCustomer}
              />
            </div>
          )}

          {/* LEVEL 4: AREA DASHBOARD (§11) */}
          {currentLevel === 'AREA' && (
            <div className="space-y-6">
              {/* Area Command Header */}
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#5B6472] uppercase tracking-wider">Area Command Center</div>
                  <h2 className="text-2xl font-black text-[#101828]">{data.areaName}</h2>
                  <div className="text-xs text-[#5B6472] mt-1 flex items-center gap-3">
                    <span>District: <strong className="text-[#101828]">{data.districtName}</strong></span>
                    <span>Branches Under Command: <strong className="text-[#1F4E7A]">{data.branches?.length ?? 0}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[110px]">
                    <div className="text-[#5B6472]">Total Exposure</div>
                    <div className="text-base font-bold text-[#1F4E7A]">
                      ETB {((data.summary?.totalOutstandingExposure ?? 0) / 1e6).toFixed(1)}M
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[110px]">
                    <div className="text-[#5B6472]">Active Insurance</div>
                    <div className="text-base font-bold text-emerald-700">
                      ETB {((data.summary?.totalValidActiveInsurance ?? 0) / 1e6).toFixed(1)}M
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center min-w-[100px]">
                    <div className="text-[#5B6472]">Coverage</div>
                    <div className="text-base font-bold text-slate-800">
                      {data.summary?.insuranceCoveragePct ?? 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Area 5-Tier KPIs Strip */}
              {data.summary && (
                <FiveTierKpiStrip
                  summary={data.summary}
                  onWhyClick={handleWhyClick}
                />
              )}

              {/* Visual Analytics & Operational Workload Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Branch Exposure vs Active Cover Bar Chart */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Branch Exposure vs Active Cover</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">ETB Millions</span>
                  </div>
                  <div className="h-64 w-full">
                    {data.branches && data.branches.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.branches.map((b: any) => ({
                            name: b.branchName?.replace(' Branch', '').replace(' Corporate Center', ''),
                            exposure: Number(((b.exposure ?? 0) / 1e6).toFixed(2)),
                            activeInsurance: Number(((b.activeInsurance ?? 0) / 1e6).toFixed(2)),
                            gap: Number(((b.insuranceGap ?? 0) / 1e6).toFixed(2)),
                          }))}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip
                            formatter={((value: any, name: any) => [
                              `ETB ${Number(value).toLocaleString()}M`,
                              name === 'exposure' ? 'Exposure' : name === 'activeInsurance' ? 'Active Insurance' : 'Gap',
                            ]) as any}
                            contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Bar dataKey="exposure" name="Exposure" fill="#1e40af" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="activeInsurance" name="Active Cover" fill="#059669" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="gap" name="Gap" fill="#dc2626" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-[#5B6472]">No branch chart data available</div>
                    )}
                  </div>
                </div>

                {/* Area Operational Workload Queue (§11.4) */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Branch Operational Workload Queue</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">Actionable Items</span>
                  </div>

                  <div className="overflow-x-auto my-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Branch</th>
                          <th className="p-2.5 text-center">Pending Approvals</th>
                          <th className="p-2.5 text-center">Returned Tasks</th>
                          <th className="p-2.5 text-center">Open Exceptions</th>
                          <th className="p-2.5 text-center">Overdue Renewals</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {data.operationalWorkload?.map((w: any) => (
                          <tr key={w.branchName} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-[#101828]">{w.branchName}</td>
                            <td className="p-2.5 text-center font-semibold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${w.pendingApprovals > 0 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-500'}`}>
                                {w.pendingApprovals}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-semibold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${w.returnedTasks > 0 ? 'bg-red-100 text-red-800 font-bold' : 'text-slate-500'}`}>
                                {w.returnedTasks}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-semibold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${w.openExceptions > 0 ? 'bg-red-100 text-red-800 font-bold' : 'text-slate-500'}`}>
                                {w.openExceptions}
                              </span>
                            </td>
                            <td className="p-2.5 text-center font-semibold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${w.overdueRenewals > 0 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-500'}`}>
                                {w.overdueRenewals}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Branch Performance & Protection Matrix (§11.2) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-base text-[#101828]">Branch Performance & Protection Matrix</h3>
                    <p className="text-xs text-[#5B6472]">Click on any branch to drill down into branch-level customer portfolios</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Branch Name</th>
                        <th className="p-3">Cust / Fac / Col</th>
                        <th className="p-3">Exposure</th>
                        <th className="p-3">Collateral Value</th>
                        <th className="p-3">Net Security</th>
                        <th className="p-3">Active Cover</th>
                        <th className="p-3">Protection Gap</th>
                        <th className="p-3">Coverage %</th>
                        <th className="p-3">Hotspots</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {data.branches?.map((brn: any) => (
                        <tr key={brn.branchName} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-[#101828] flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-[#2C6295]" />
                            {brn.branchName}
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            {brn.customerCount ?? 0} / {brn.facilityCount ?? 0} / {brn.collateralCount ?? 0}
                          </td>
                          <td className="p-3 font-bold text-[#1F4E7A]">
                            ETB {((brn.exposure ?? 0) / 1e6).toFixed(2)}M
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            ETB {((brn.collateralValue ?? 0) / 1e6).toFixed(2)}M
                          </td>
                          <td className="p-3 font-semibold text-slate-700">
                            ETB {((brn.netSecurityValue ?? 0) / 1e6).toFixed(2)}M
                          </td>
                          <td className="p-3 font-bold text-emerald-700">
                            ETB {((brn.activeInsurance ?? 0) / 1e6).toFixed(2)}M
                          </td>
                          <td className="p-3 font-bold text-red-600">
                            ETB {((brn.insuranceGap ?? 0) / 1e6).toFixed(2)}M
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                              {brn.coveragePct ?? 0}%
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {brn.uninsuredCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-100 text-red-800" title="Uninsured collaterals">
                                  {brn.uninsuredCount} Uninsured
                                </span>
                              )}
                              {brn.expiringCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800" title="Expiring within 30 days">
                                  {brn.expiringCount} Expiring
                                </span>
                              )}
                              {brn.documentationIssues > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-800" title="Missing mandatory documents">
                                  {brn.documentationIssues} Doc Issues
                                </span>
                              )}
                              {brn.uninsuredCount === 0 && brn.expiringCount === 0 && brn.documentationIssues === 0 && (
                                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Compliant
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => drillToBranch(brn.branchName)}
                              className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                            >
                              Explore Branch
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action-Oriented Operational Hotspots */}
              <OperationalHotspotsV2
                items={data.requiresAttention}
                onDrillToCollateral={drillToCollateral}
                onDrillToPolicy={drillToPolicy}
                onDrillToCustomer={drillToCustomer}
                onNavigate={onNavigate}
              />
            </div>
          )}

          {/* LEVEL 5: BRANCH / CORPORATE CENTER DASHBOARD (MULTI-SEGMENT) */}
          {currentLevel === 'BRANCH' && (
            <div className="space-y-6">
              {/* Branch KPIs */}
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#5B6472] uppercase">Branch / Corporate Center (All Segments)</div>
                  <h2 className="text-2xl font-black text-[#101828]">{data.branchName}</h2>
                  <div className="text-xs text-[#5B6472] mt-0.5">District: {data.districtName}</div>
                </div>

                <div className="flex items-center gap-3">
                  {Object.entries(data.segmentDistribution || {}).map(([seg, count]: any) => (
                    <span key={seg} className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-full border border-slate-300">
                      {seg}: {count} Assets
                    </span>
                  ))}
                </div>
              </div>

              {/* Branch 5-Tier KPIs Strip */}
              {data.summary && (
                <FiveTierKpiStrip
                  summary={data.summary}
                  onWhyClick={handleWhyClick}
                />
              )}

              {/* Branch Multi-Segment Distribution & Collateral Mix */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Segment Distribution Donut */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PieChartIcon className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Multi-Segment Asset Distribution</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">Assets per Segment</span>
                  </div>
                  <div className="h-56 w-full flex items-center justify-center">
                    {Object.keys(data.segmentDistribution || {}).length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={Object.entries(data.segmentDistribution || {}).map(([seg, count]) => ({
                              name: seg,
                              value: count,
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {Object.keys(data.segmentDistribution || {}).map((_, idx) => (
                              <Cell key={`seg-cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-xs text-[#5B6472] text-center">No segment distribution data available</div>
                    )}
                  </div>
                </div>

                {/* Collateral Asset Classes in Branch */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Collateral Asset Classes</h4>
                    </div>
                    <span className="text-[11px] text-[#5B6472]">By Category</span>
                  </div>
                  <div className="h-56 w-full flex items-center justify-center">
                    {data.categoryDistribution && data.categoryDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.categoryDistribution.map((item: any) => ({
                            name: (item.name || item.category || '').substring(0, 14),
                            count: item.count ?? 1,
                          }))}
                          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                          <Bar dataKey="count" name="Asset Count" fill="#0891b2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-xs text-[#5B6472] text-center">No category data available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Customer List in this Branch */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-base text-[#101828]">Branch Customers & Portfolios</h3>
                    <p className="text-xs text-[#5B6472]">Click on any customer to open their full 360 view (loans, collateral, insurance, documents)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search customers..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="pl-8 pr-3 py-1.5 border border-[#E2E8F0] rounded-lg text-xs w-56 focus:outline-hidden focus:border-[#3E7AB0]"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Customer Name</th>
                        <th className="p-3">CIF</th>
                        <th className="p-3">Segment</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Facilities</th>
                        <th className="p-3">Collaterals</th>
                        <th className="p-3">Exposure</th>
                        <th className="p-3">Collateral Value</th>
                        <th className="p-3">Compliance</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {data.customers
                        ?.filter((c: any) =>
                          !searchFilter ||
                          c.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          c.cif?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                          c.segment?.toLowerCase().includes(searchFilter.toLowerCase())
                        )
                        .map((c: any) => (
                          <tr
                            key={c.id}
                            onClick={() => drillToCustomer(c.cif || c.id)}
                            className="hover:bg-[#EFF5FB]/50 cursor-pointer transition-colors"
                          >
                            <td className="p-3 font-bold text-[#101828] flex items-center gap-2">
                              <User className="w-4 h-4 text-[#2C6295] shrink-0" />
                              {c.name}
                            </td>
                            <td className="p-3 font-mono text-[11px]">{c.cif}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
                                {c.segment}
                              </span>
                            </td>
                            <td className="p-3">{c.customerType}</td>
                            <td className="p-3 font-semibold">{c.facilityCount ?? 0}</td>
                            <td className="p-3 font-semibold">{c.collateralCount ?? 0}</td>
                            <td className="p-3 font-bold text-[#1F4E7A]">ETB {((c.exposure ?? 0) / 1e6).toFixed(2)}M</td>
                            <td className="p-3 font-bold text-slate-800">ETB {((c.collateralValue ?? 0) / 1e6).toFixed(2)}M</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.complianceStatus === 'Adequate' || c.complianceStatus === 'Compliant'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.complianceStatus === 'Underinsured'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {c.complianceStatus}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  drillToCustomer(c.cif || c.id);
                                }}
                                className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                              >
                                View 360
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action-Oriented Operational Hotspots */}
              <OperationalHotspotsV2
                items={data.requiresAttention}
                onDrillToCollateral={drillToCollateral}
                onDrillToPolicy={drillToPolicy}
                onDrillToCustomer={drillToCustomer}
                onNavigate={onNavigate}
              />

              {/* Branch-Scoped Paginated Portfolio Grid */}
              <PaginatedPortfolioGrid
                userId={currentUser.userId || currentUser.username}
                branch={data.branchName || selectedBranch}
                segment={selectedSegment}
                onDrillToCollateral={drillToCollateral}
                onDrillToCustomer={drillToCustomer}
              />
            </div>
          )}

          {/* LEVEL 6: CUSTOMER VIEW (CUSTOMER 360 - §13) */}
          {currentLevel === 'CUSTOMER' && (
            <div className="space-y-6">
              {/* Customer Command Header */}
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#EFF5FB] text-[#1F4E7A] rounded-xl border border-[#B9D3EB]">
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-[#101828]">{data.customer?.name}</h2>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#DCE9F5] text-[#173F63]">
                        {data.customer?.customerType}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        data.summary?.insuranceStatus === 'Adequate' || data.summary?.insuranceStatus === 'Compliant'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                      }`}>
                        {data.summary?.insuranceStatus || 'Under Evaluation'}
                      </span>
                    </div>
                    <div className="text-xs text-[#5B6472] mt-1 flex items-center gap-4 flex-wrap">
                      <span>CIF: <strong className="font-mono text-[#101828]">{data.customer?.cif}</strong></span>
                      <span>Segment: <strong>{data.customer?.segment}</strong></span>
                      <span>Branch: <strong>{data.customer?.branch}</strong></span>
                      <span>Risk Rating: <strong>{data.customer?.riskRating || 'Normal'}</strong></span>
                      <span>Status: <strong className="text-emerald-700">{data.customer?.status}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('customers', { selectedCif: data.customer?.cif })}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Customer Profile
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Financial & Protection Summary Strip (§13.2 & §13.3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Total Credit Exposure</div>
                  <div className="text-xl font-black text-[#1F4E7A] mt-1">
                    ETB {Number(data.summary?.totalExposure ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Approved Limits: ETB {Number(data.summary?.approvedLimits ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Collateral Market Value</div>
                  <div className="text-xl font-black text-[#101828] mt-1">
                    ETB {Number(data.summary?.collateralMarketValue ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Net Security: ETB {Number(data.summary?.netSecurityValue ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Insurance Protection</div>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    ETB {Number(data.summary?.activeValidInsurance ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Required: ETB {Number(data.summary?.insuranceRequired ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Coverage & Protection Gap</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-slate-900">
                      {data.summary?.coveragePct ?? 0}%
                    </span>
                    <span className="text-xs font-bold text-red-600">
                      (Gap: ETB {Number(data.summary?.insuranceGap ?? 0).toLocaleString()})
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1 flex items-center gap-2">
                    <span>{data.summary?.facilitiesCount ?? 0} Facilities</span>
                    <span>•</span>
                    <span>{data.summary?.collateralsCount ?? 0} Collaterals</span>
                    <span>•</span>
                    <span>{data.summary?.policiesCount ?? 0} Policies</span>
                  </div>
                </div>
              </div>

              {/* Documentation Health Strip (§13.7) */}
              {data.documentationHealth && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-[#2C6295]" />
                    <div>
                      <div className="text-xs font-bold text-[#101828]">Documentation & Legal Verification Health</div>
                      <div className="text-[11px] text-[#5B6472]">Regulatory & bank document compliance across all pledged assets</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-[#5B6472]">Mandatory Rules: </span>
                      <strong className="text-emerald-700">{data.documentationHealth.satisfied} / {data.documentationHealth.mandatoryRequirements} Satisfied</strong>
                    </div>
                    {data.documentationHealth.missing > 0 && (
                      <div className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[11px]">
                        {data.documentationHealth.missing} Missing
                      </div>
                    )}
                    {data.documentationHealth.expired > 0 && (
                      <div className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[11px]">
                        {data.documentationHealth.expired} Expired
                      </div>
                    )}
                    {data.documentationHealth.expiring > 0 && (
                      <div className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                        {data.documentationHealth.expiring} Expiring Soon
                      </div>
                    )}
                    <div className="text-[#5B6472]">
                      Supporting Files: <strong className="text-slate-800">{data.documentationHealth.supportingDocuments}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Open Exceptions Warning Banner */}
              {data.exceptions && data.exceptions.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs">{data.exceptions.length} Active Exceptions Logged for this Customer</div>
                    <div className="text-[11px] text-amber-800 mt-0.5">
                      Includes covenants, documentation deferrals, or insurance lapses requiring remediation.
                    </div>
                  </div>
                </div>
              )}

              {/* 1. Facilities / Loans Section (§13.4) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#2C6295]" />
                  Credit Facilities & Loans ({data.facilityDetails?.length || data.facilities?.length || 0})
                </h3>
                {(!data.facilityDetails || data.facilityDetails.length === 0) && (!data.facilities || data.facilities.length === 0) ? (
                  <div className="text-xs text-[#5B6472] py-4 text-center">No active facilities recorded for this customer.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Facility Ref / Line</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Approved Limit</th>
                          <th className="p-3">Outstanding Balance</th>
                          <th className="p-3">Linked Security</th>
                          <th className="p-3">Insurance Required</th>
                          <th className="p-3">Insurance Cover</th>
                          <th className="p-3">Gap</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {(data.facilityDetails || data.facilities)?.map((f: any) => (
                          <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#1F4E7A]">{f.facilityReference || f.loanReference || f.lineCode}</td>
                            <td className="p-3 font-semibold">{f.facilityType}</td>
                            <td className="p-3 font-bold">ETB {Number(f.approvedLimit ?? 0).toLocaleString()}</td>
                            <td className="p-3 font-bold text-[#1F4E7A]">ETB {Number(f.outstandingBalance ?? 0).toLocaleString()}</td>
                            <td className="p-3 font-semibold text-slate-800">
                              {f.securityValue !== undefined ? `ETB ${Number(f.securityValue).toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-bold text-slate-800">
                              {f.insuranceRequirement !== undefined ? `ETB ${Number(f.insuranceRequirement).toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-bold text-emerald-700">
                              {f.insuranceCoverage !== undefined ? `ETB ${Number(f.insuranceCoverage).toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-bold text-red-600">
                              {f.insuranceGap !== undefined ? `ETB ${Number(f.insuranceGap).toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-bold text-emerald-700">{f.status}</td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => drillToFacility(f.id)}
                                className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                              >
                                View Facility
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. Pledged Collateral Section (§13.5) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#2C6295]" />
                  Pledged Collateral Assets ({data.collateralDetails?.length || data.collaterals?.length || 0})
                </h3>
                {(!data.collateralDetails || data.collateralDetails.length === 0) && (!data.collaterals || data.collaterals.length === 0) ? (
                  <div className="text-xs text-[#5B6472] py-4 text-center">No pledged collaterals found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Collateral Code</th>
                          <th className="p-3">Category / Type</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Market Value</th>
                          <th className="p-3">Haircut</th>
                          <th className="p-3">Net Security</th>
                          <th className="p-3">Insurance Required</th>
                          <th className="p-3">Active Cover</th>
                          <th className="p-3">Coverage %</th>
                          <th className="p-3">Adequacy</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {(data.collateralDetails || data.collaterals)?.map((c: any) => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#1F4E7A]">{c.code || c.id}</td>
                            <td className="p-3">{c.category}</td>
                            <td className="p-3 max-w-xs truncate">{c.description}</td>
                            <td className="p-3 font-bold">ETB {Number(c.marketValue || c.valuationAmount || 0).toLocaleString()}</td>
                            <td className="p-3">{c.haircut}%</td>
                            <td className="p-3 font-bold text-slate-800">
                              ETB {Number(c.netSecurityValue || ((c.valuationAmount ?? 0) * (1 - (c.haircut ?? 0) / 100))).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-slate-800">
                              {c.insuranceRequired !== undefined ? `ETB ${Number(c.insuranceRequired).toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-bold text-emerald-700">
                              {c.activeInsurance !== undefined ? `ETB ${Number(c.activeInsurance).toLocaleString()}` : '—'}
                            </td>
                            <td className="p-3 font-semibold">
                              {c.coveragePct !== undefined ? `${c.coveragePct}%` : '—'}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                c.adequacyStatus === 'Adequate' || c.adequacyStatus === 'Compliant'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.adequacyStatus === 'Underinsured'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {c.adequacyStatus || c.status || 'Active'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => drillToCollateral(c.id)}
                                className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                              >
                                View Collateral
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. Insurance Policies Section (§13.6) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2C6295]" />
                  Insurance Policies ({data.policyDetails?.length || data.policies?.length || 0})
                </h3>
                {(!data.policyDetails || data.policyDetails.length === 0) && (!data.policies || data.policies.length === 0) ? (
                  <div className="text-xs text-[#5B6472] py-4 text-center">No active insurance policies linked.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Policy Number</th>
                          <th className="p-3">Insurer</th>
                          <th className="p-3">Coverage Type</th>
                          <th className="p-3">Sum Insured</th>
                          <th className="p-3">Effective Contribution</th>
                          <th className="p-3">Effective Date</th>
                          <th className="p-3">Expiry Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {(data.policyDetails || data.policies)?.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#1F4E7A]">{p.policyNumber}</td>
                            <td className="p-3 font-semibold">{p.insurerName}</td>
                            <td className="p-3">{p.coverageType}</td>
                            <td className="p-3 font-bold text-slate-800">
                              ETB {Number(p.sumInsured || p.insuredAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-emerald-700">
                              ETB {Number(p.effectiveContribution || p.insuredAmount || 0).toLocaleString()}
                            </td>
                            <td className="p-3">{p.effectiveDate}</td>
                            <td className="p-3 font-semibold">{p.expiryDate}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => drillToPolicy(p.id)}
                                className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                              >
                                View Policy
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LEVEL 7: FACILITY / CREDIT LINE VIEW (§14) */}
          {currentLevel === 'FACILITY' && (
            <div className="space-y-6">
              {/* Facility Header */}
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#5B6472] uppercase tracking-wider">Credit Facility Command</div>
                  <h2 className="text-2xl font-black text-[#101828]">
                    {data.facility?.loanReference || data.facility?.lineCode}
                  </h2>
                  <div className="mt-1 flex items-center gap-4 text-xs text-[#5B6472] flex-wrap">
                    <span>
                      Borrower:{' '}
                      <button
                        onClick={() => data.customer?.cif && drillToCustomer(data.customer.cif)}
                        className="font-bold text-[#1F4E7A] hover:underline"
                      >
                        {data.customer?.name} ({data.customer?.cif})
                      </button>
                    </span>
                    <span>Facility Type: <strong className="text-[#101828]">{data.facility?.facilityType}</strong></span>
                    <span>Segment: <strong>{data.facility?.segment}</strong></span>
                    <span>Branch: <strong>{data.facility?.branch}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                    data.financialKpis?.insuranceCoverageRatio >= 100
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-red-50 text-red-800 border-red-300'
                  }`}>
                    {data.financialKpis?.insuranceCoverageRatio >= 100 ? 'Fully Insured' : 'Insurance Deficit'}
                  </span>
                </div>
              </div>

              {/* Financial & Protection KPIs Strip (§14.2 & §14.3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Approved Facility Limit</div>
                  <div className="text-xl font-black text-[#101828] mt-1">
                    ETB {Number(data.financialKpis?.approvedLimit ?? data.facility?.approvedLimit ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#1F4E7A] font-bold mt-1">
                    Outstanding: ETB {Number(data.financialKpis?.outstandingBalance ?? data.facility?.outstandingBalance ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Allocated Net Security</div>
                  <div className="text-xl font-black text-slate-800 mt-1">
                    ETB {Number(data.financialKpis?.allocatedSecurity ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Security Coverage: <strong className="text-slate-800">{data.financialKpis?.securityCoverageRatio ?? 0}%</strong>
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Insurance Requirement</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    ETB {Number(data.financialKpis?.insuranceRequirement ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Rule: MAX(Outstanding, Market Value)
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Effective Active Insurance</div>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    ETB {Number(data.financialKpis?.effectiveInsurance ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-red-600 font-bold mt-1">
                    Gap: ETB {Number(data.financialKpis?.insuranceGap ?? 0).toLocaleString()} ({data.financialKpis?.insuranceCoverageRatio ?? 0}% Covered)
                  </div>
                </div>
              </div>

              {/* Shared Collateral Safeguard Banner (§14.5) */}
              {data.collateralAllocations && data.collateralAllocations.length > 0 && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-start gap-3">
                  <Layers className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs">Shared Collateral Assets Securing This Facility</div>
                    <div className="text-[11px] text-indigo-700 mt-0.5">
                      {data.collateralAllocations.length} securing collateral asset(s) are shared across multiple credit lines. Valuations are partitioned according to legal deed allocations to eliminate double counting.
                    </div>
                  </div>
                </div>
              )}

              {/* Securing Collateral Allocation Matrix (§14.4) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-[#101828]">Securing Collateral Assets & Legal Allocations</h3>
                  <span className="text-xs font-semibold text-[#5B6472]">
                    {data.securityMatrix?.length || data.linkedCollaterals?.length || 0} Linked Assets
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Collateral Code</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Market Value</th>
                        <th className="p-3">Haircut</th>
                        <th className="p-3">Net Security</th>
                        <th className="p-3">Allocated Amount</th>
                        <th className="p-3">Linkage Type</th>
                        <th className="p-3">Shared?</th>
                        <th className="p-3">Insurance Required</th>
                        <th className="p-3">Active Cover</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {(data.securityMatrix || data.linkedCollaterals)?.map((col: any) => (
                        <tr key={col.linkId || col.collateralId} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-[#1F4E7A]">{col.collateralCode}</td>
                          <td className="p-3">{col.category}</td>
                          <td className="p-3 max-w-xs truncate">{col.description}</td>
                          <td className="p-3 font-bold">ETB {Number(col.marketValue || col.valuationAmount || 0).toLocaleString()}</td>
                          <td className="p-3">{col.haircut}%</td>
                          <td className="p-3 font-bold text-slate-800">
                            ETB {Number(col.netSecurityValue ?? 0).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-emerald-700">
                            ETB {Number(col.allocatedAmount ?? 0).toLocaleString()}
                          </td>
                          <td className="p-3">{col.linkageType}</td>
                          <td className="p-3">
                            {col.isShared ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                Shared
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Sole</span>
                            )}
                          </td>
                          <td className="p-3 font-bold">
                            ETB {Number(col.insuranceRequired ?? 0).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-emerald-700">
                            ETB {Number(col.activeInsurance ?? 0).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              col.status === 'Adequate' || col.status === 'Compliant'
                                ? 'bg-emerald-100 text-emerald-800'
                                : col.status === 'Underinsured'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {col.status || col.insuranceStatus || 'Active'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => drillToCollateral(col.collateralId)}
                              className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                            >
                              View Asset
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Facility Exceptions */}
              {data.exceptions && data.exceptions.length > 0 && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-2">
                  <h4 className="font-bold text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    Operational Exceptions Linked to this Facility
                  </h4>
                  <div className="space-y-2">
                    {data.exceptions.map((exc: any) => (
                      <div key={exc.id} className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-red-900">{exc.exceptionType || exc.type}</span>: {exc.description}
                        </div>
                        <span className="px-2 py-0.5 bg-red-200 text-red-800 font-extrabold rounded text-[10px]">
                          {exc.severity || 'HIGH'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LEVEL 8: COLLATERAL VIEW (§15) */}
          {currentLevel === 'COLLATERAL' && (
            <div className="space-y-6">
              {/* Collateral Header */}
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#5B6472] uppercase tracking-wider">Collateral Asset Command</div>
                  <div className="flex items-center gap-3 mt-1">
                    <h2 className="text-2xl font-black text-[#101828]">{data.collateral?.code || data.collateral?.id}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EFF5FB] text-[#1F4E7A] border border-[#B9D3EB]">
                      {data.collateral?.category}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      data.insuranceProtection?.adequacyStatus === 'Adequate' || data.insuranceProtection?.adequacyStatus === 'Compliant'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}>
                      {data.insuranceProtection?.adequacyStatus || 'Under Evaluation'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-[#5B6472] flex-wrap">
                    <span>
                      Borrower:{' '}
                      <button
                        onClick={() => data.customer?.cif && drillToCustomer(data.customer.cif)}
                        className="font-bold text-[#1F4E7A] hover:underline"
                      >
                        {data.customer?.name} ({data.customer?.cif})
                      </button>
                    </span>
                    <span>Branch: <strong>{data.collateral?.branch}</strong></span>
                    <span>Owning Segment: <strong>{data.collateral?.owningSegment}</strong></span>
                    <span>Description: <strong className="text-[#101828]">{data.collateral?.description}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {data.gpsCoordinates?.isCaptured && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <div>
                        <div className="text-[10px] text-[#5B6472] uppercase font-bold">GPS Verified</div>
                        <div className="font-mono text-slate-800 font-bold">{data.gpsCoordinates.rawCoordinates}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Valuation & Insurance Dual Panels (§15.2 & §15.3) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 15.2 Valuation Panel */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Valuation & Net Security Panel</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      data.valuationPanel?.valuationDocumentStatus === 'Current'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      Doc: {data.valuationPanel?.valuationDocumentStatus || 'Current'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-[11px] text-[#5B6472]">Market Value</div>
                      <div className="text-base font-black text-[#101828] mt-0.5">
                        ETB {Number(data.valuationPanel?.marketValue ?? data.collateral?.valuationAmount ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-[11px] text-[#5B6472]">Haircut Applied</div>
                      <div className="text-base font-black text-slate-800 mt-0.5">
                        {data.valuationPanel?.haircut ?? data.collateral?.haircut ?? 0}%
                      </div>
                    </div>
                    <div className="p-3 bg-[#EFF5FB] rounded-lg border border-[#B9D3EB]">
                      <div className="text-[11px] text-[#1F4E7A] font-bold">Net Security Value</div>
                      <div className="text-base font-black text-[#1F4E7A] mt-0.5">
                        ETB {Number(data.valuationPanel?.netSecurityValue ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#5B6472] flex items-center justify-between pt-1">
                    <span>Valuation Review Date: <strong>{data.valuationPanel?.valuationDate || 'N/A'}</strong></span>
                    <span>Status: <strong className="text-emerald-700">{data.collateral?.status || 'Active'}</strong></span>
                  </div>
                </div>

                {/* 15.3 Insurance Protection Panel */}
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#2C6295]" />
                      <h4 className="font-bold text-sm text-[#101828]">Insurance Protection Position</h4>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">
                      {data.insuranceProtection?.activePolicyCount ?? 0} Active Policy(ies)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-[11px] text-[#5B6472]">Required Cover</div>
                      <div className="text-base font-black text-slate-900 mt-0.5">
                        ETB {Number(data.insuranceProtection?.insuranceRequired ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-[11px] text-[#5B6472]">Active Valid Cover</div>
                      <div className="text-base font-black text-emerald-700 mt-0.5">
                        ETB {Number(data.insuranceProtection?.activeValidInsurance ?? 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-[11px] text-[#5B6472]">Protection Gap</div>
                      <div className="text-base font-black text-red-600 mt-0.5">
                        ETB {Number(data.insuranceProtection?.insuranceGap ?? 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#5B6472] flex items-center justify-between pt-1">
                    <span>Coverage Pct: <strong className="text-slate-800">{data.insuranceProtection?.coveragePct ?? 0}%</strong></span>
                    <span>
                      Nearest Expiry:{' '}
                      <strong className={data.insuranceProtection?.nearestExpiry ? 'text-amber-700' : 'text-slate-700'}>
                        {data.insuranceProtection?.nearestExpiry || 'No Upcoming Expiry'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Shared Collateral Indicator (§15.5) */}
              {data.sharedCollateral?.isShared && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-start gap-3">
                  <Layers className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs">Cross-Facility Shared Collateral Asset</div>
                    <div className="text-[11px] text-indigo-700 mt-0.5">
                      This asset secures {data.sharedCollateral.facilitiesCount} facilities across {data.sharedCollateral.customersCount} customer(s) and {data.sharedCollateral.segmentsCount} business segment(s). Total allocated security: ETB {Number(data.sharedCollateral.allocatedSecurity ?? 0).toLocaleString()} of physical ETB {Number(data.sharedCollateral.totalMarketValue ?? 0).toLocaleString()} market value.
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Facilities Matrix (§15.4) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#2C6295]" />
                  Linked Credit Facilities ({data.linkedFacilitiesMatrix?.length || data.linkedFacilities?.length || 0})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Facility Ref</th>
                        <th className="p-3">Borrower / CIF</th>
                        <th className="p-3">Segment</th>
                        <th className="p-3">Outstanding Exposure</th>
                        <th className="p-3">Allocated Security</th>
                        <th className="p-3">Share of Collateral</th>
                        <th className="p-3">Linkage Type</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {(data.linkedFacilitiesMatrix || data.linkedFacilities)?.map((fac: any) => (
                        <tr key={fac.facilityId || fac.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-[#1F4E7A]">
                            {fac.facilityRef || fac.loanReference || fac.lineCode || fac.id}
                          </td>
                          <td className="p-3 font-semibold">{fac.customerId || fac.customerName || data.customer?.name}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 border border-slate-300">
                              {fac.segment}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-[#1F4E7A]">
                            ETB {Number(fac.outstandingBalance ?? 0).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-emerald-700">
                            ETB {Number(fac.allocatedSecurity ?? fac.outstandingBalance ?? 0).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold">
                            {fac.shareOfCollateralPct !== undefined ? `${fac.shareOfCollateralPct}%` : '100%'}
                          </td>
                          <td className="p-3">{fac.linkageType || 'DIRECT'}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => drillToFacility(fac.facilityId || fac.id)}
                              className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                            >
                              Explore Facility
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Insurance Policies */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2C6295]" />
                  Linked Insurance Coverage Policies ({data.policies?.length ?? 0})
                </h3>
                {data.policies?.length === 0 ? (
                  <div className="text-xs text-[#5B6472] py-4 text-center">No insurance policies currently linked to this collateral.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Policy Number</th>
                          <th className="p-3">Insurer</th>
                          <th className="p-3">Coverage Type</th>
                          <th className="p-3">Sum Insured</th>
                          <th className="p-3">Effective Contribution</th>
                          <th className="p-3">Expiry Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {data.policies?.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#1F4E7A]">{p.policyNumber}</td>
                            <td className="p-3 font-semibold">{p.insurerName}</td>
                            <td className="p-3">{p.coverageType}</td>
                            <td className="p-3 font-bold text-slate-800">
                              ETB {Number(p.insuredAmount ?? 0).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-emerald-700">
                              ETB {Number(p.insuredAmount ?? 0).toLocaleString()}
                            </td>
                            <td className="p-3 font-semibold">{p.expiryDate}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => drillToPolicy(p.id)}
                                className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                              >
                                View Policy
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Mandatory Document Checklist (§15.8) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#2C6295]" />
                  Mandatory Document Verification Checklist
                </h3>
                <div className="space-y-2">
                  {(data.mandatoryDocumentHealth || data.mandatoryChecklist)?.map((item: any) => {
                    const isPresent = item.present !== undefined ? item.present : item.uploaded;
                    const isExpired = item.status === 'Expired';
                    const isExpSoon = item.status === 'Expiring Soon';

                    return (
                      <div
                        key={item.ruleId || item.documentType}
                        className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                          isPresent && !isExpired
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : isExpired
                            ? 'bg-red-50 border-red-200 text-red-900'
                            : isExpSoon
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isPresent && !isExpired ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                          )}
                          <div>
                            <div className="font-bold">{item.documentType}</div>
                            {isPresent ? (
                              <div className="text-[11px] text-emerald-700 mt-0.5">
                                File: {item.fileName || 'Verified Document'} ({item.status || 'Current'})
                              </div>
                            ) : (
                              <div className="text-[11px] text-red-700 mt-0.5">
                                Missing mandatory document file. Upload required before collateral activation.
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isPresent && !isExpired
                            ? 'bg-emerald-200 text-emerald-800'
                            : isExpSoon
                            ? 'bg-amber-200 text-amber-800'
                            : 'bg-red-200 text-red-800'
                        }`}>
                          {item.status || (isPresent ? 'Present' : 'Missing')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Supporting Documents (if any) */}
              {data.supportingDocuments && data.supportingDocuments.length > 0 && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                  <h4 className="font-bold text-xs text-[#5B6472] uppercase tracking-wider mb-2">Additional Supporting Documents</h4>
                  <div className="space-y-1.5">
                    {data.supportingDocuments.map((doc: any) => (
                      <div key={doc.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{doc.documentType} — {doc.fileName}</span>
                        <span className="text-[11px] text-[#5B6472]">{doc.status || 'Active'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LEVEL 9: INSURANCE POLICY VIEW (§16) */}
          {currentLevel === 'POLICY' && (
            <div className="space-y-6">
              {/* Policy Header */}
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#5B6472] uppercase tracking-wider">Insurance Policy Lifecycle Command</div>
                  <div className="flex items-center gap-3 mt-1">
                    <h2 className="text-2xl font-black text-[#101828]">{data.policy?.policyNumber}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EFF5FB] text-[#1F4E7A] border border-[#B9D3EB]">
                      {data.policy?.coverageType}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      data.policy?.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}>
                      {data.policy?.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-[#5B6472] flex-wrap">
                    <span>Insurer: <strong className="text-[#101828]">{data.policy?.insurerName}</strong></span>
                    {data.customer && (
                      <span>
                        Borrower:{' '}
                        <button
                          onClick={() => drillToCustomer(data.customer.cif)}
                          className="font-bold text-[#1F4E7A] hover:underline"
                        >
                          {data.customer.name} ({data.customer.cif})
                        </button>
                      </span>
                    )}
                    {data.collateral && (
                      <span>
                        Linked Collateral:{' '}
                        <button
                          onClick={() => drillToCollateral(data.collateral.id)}
                          className="font-bold text-[#1F4E7A] hover:underline"
                        >
                          {data.collateral.code} ({data.collateral.category})
                        </button>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="text-[#5B6472]">Expiry Date</div>
                    <div className="font-bold font-mono text-slate-800 text-sm mt-0.5">{data.policy?.expiryDate}</div>
                  </div>
                </div>
              </div>

              {/* Financial Summary & Contribution Strip (§16.2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Sum Insured</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    ETB {Number(data.financialSummary?.sumInsured ?? data.policy?.insuredAmount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Annual Premium: ETB {Number(data.financialSummary?.premium ?? data.policy?.premium ?? 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Active Valid Contribution</div>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    ETB {Number(data.financialSummary?.coverageContribution ?? data.policy?.insuredAmount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Status: {data.financialSummary?.isSuperseded ? 'Superseded (ETB 0)' : 'Active Contributor'}
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Collateral Insurance Req</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    ETB {Number(data.financialSummary?.collateralInsuranceRequirement ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Asset Requirement: MAX(Exposure, Market Value)
                  </div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs">
                  <div className="text-xs font-semibold text-[#5B6472]">Collateral Protection Level</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-slate-900">
                      {data.financialSummary?.coveragePct ?? 0}%
                    </span>
                    <span className="text-xs font-bold text-red-600">
                      (Remaining Gap: ETB {Number(data.financialSummary?.remainingGap ?? 0).toLocaleString()})
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5B6472] mt-1">
                    Effective Insurance: ETB {Number(data.financialSummary?.effectiveInsurance ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Policy Succession & Relationships (§16.6) */}
              {data.relationships && (data.relationships.renewedFrom || data.relationships.renewedBy || data.relationships.replaces || data.relationships.replacedBy) && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-3">
                  <GitFork className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs">Policy Succession & Endorsement Lineage</div>
                    <div className="text-xs text-blue-800 mt-1 flex items-center gap-4 flex-wrap">
                      {data.relationships.renewedFrom && <span>Renewed From: <strong className="font-mono">{data.relationships.renewedFrom}</strong></span>}
                      {data.relationships.renewedBy && <span>Renewed By: <strong className="font-mono">{data.relationships.renewedBy}</strong></span>}
                      {data.relationships.replaces && <span>Replaces: <strong className="font-mono">{data.relationships.replaces}</strong></span>}
                      {data.relationships.replacedBy && <span>Replaced By: <strong className="font-mono">{data.relationships.replacedBy}</strong></span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Dated Lifecycle Timeline (§16.4) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#2C6295]" />
                  Dated Lifecycle Timeline
                </h3>
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
                  {data.datedTimeline?.map((t: any, idx: number) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-3.5 h-3.5 rounded-full bg-[#1F4E7A] border-2 border-white shadow-xs" />
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="font-bold text-xs text-[#101828]">{t.event}</div>
                        <span className="font-mono text-[11px] text-[#5B6472]">{t.date}</span>
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.status === 'Completed' || t.status === 'Active' || t.status === 'A'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'Expired'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {t.status === 'A' ? 'Authorized' : t.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endorsements & Modifications History (§16.5) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-[#2C6295]" />
                  Policy Endorsements & Modifications ({data.endorsements?.length ?? 0})
                </h3>
                {data.endorsements?.length === 0 ? (
                  <div className="text-xs text-[#5B6472] py-4 text-center">No endorsements issued for this policy. Original terms remain in effect.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Endorsement No</th>
                          <th className="p-3">Mod #</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Effective Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {data.endorsements?.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#1F4E7A]">{e.endorsementNo}</td>
                            <td className="p-3 font-semibold">#{e.modNo}</td>
                            <td className="p-3">{e.endorsementType}</td>
                            <td className="p-3">{e.effectiveDate || 'N/A'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                e.authStat === 'A' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {e.authStat === 'A' ? 'Authorized' : e.authStat}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700">{e.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Deterministic "Why?" Explanatory Evidence Modal */}
      <KpiWhyModal
        isOpen={!!whyModalKey}
        kpiKey={whyModalKey}
        explanation={kpiExplanation}
        isLoading={isExplainingKpi}
        onClose={() => {
          setWhyModalKey(null);
          setKpiExplanation(null);
        }}
        onNavigate={(target, params) => {
          setWhyModalKey(null);
          setKpiExplanation(null);
          if (onNavigate) onNavigate(target, params);
        }}
        onDrillToCollateral={(colId: string) => {
          setWhyModalKey(null);
          setKpiExplanation(null);
          drillToCollateral(colId);
        }}
      />
    </div>
  );
};
