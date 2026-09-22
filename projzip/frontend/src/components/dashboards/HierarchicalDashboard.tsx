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

          {/* LEVEL 4: AREA DASHBOARD */}
          {currentLevel === 'AREA' && (
            <div className="space-y-6">
              <div className="p-4 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
                <div className="text-xs font-semibold text-[#5B6472] uppercase">Area Office</div>
                <h2 className="text-xl font-extrabold text-[#101828]">{data.areaName}</h2>
                <div className="text-xs text-[#5B6472] mt-0.5">District: {data.districtName}</div>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#101828] mb-3">Branches under {data.areaName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.branches?.map((brn: any) => (
                    <div
                      key={brn.branchName}
                      onClick={() => drillToBranch(brn.branchName)}
                      className="bg-white border-2 border-[#E2E8F0] hover:border-[#3E7AB0] rounded-xl p-5 shadow-xs hover:shadow-md cursor-pointer transition-all group"
                    >
                      <h4 className="font-bold text-base text-[#101828] group-hover:text-[#2C6295] transition-colors">
                        {brn.branchName}
                      </h4>
                      <div className="mt-3 text-xs space-y-1">
                        <div>Collaterals: <strong>{brn.collateralCount ?? 0}</strong></div>
                        <div>Exposure: <strong>ETB {((brn.exposure ?? 0) / 1e6).toFixed(1)}M</strong></div>
                      </div>
                      <div className="mt-4 text-xs font-bold text-[#2C6295] flex items-center justify-between">
                        <span>Open Branch</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action-Oriented Operational Hotspots */}
              {renderRequiresAttention(data.requiresAttention)}
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

          {/* LEVEL 6: CUSTOMER VIEW (CUSTOMER 360) */}
          {currentLevel === 'CUSTOMER' && (
            <div className="space-y-6">
              {/* Customer Header Card */}
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
                    </div>
                    <div className="text-xs text-[#5B6472] mt-1 flex items-center gap-4 flex-wrap">
                      <span>CIF: <strong className="font-mono text-[#101828]">{data.customer?.cif}</strong></span>
                      <span>Segment: <strong>{data.customer?.segment}</strong></span>
                      <span>Branch: <strong>{data.customer?.branch}</strong></span>
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
                      <ExternalLink className="w-3.5 h-3.5" /> Customer Management
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Facilities / Loans Section */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#2C6295]" />
                  Credit Facilities & Loans ({data.facilities?.length ?? 0})
                </h3>
                {data.facilities?.length === 0 ? (
                  <div className="text-xs text-[#5B6472] py-4 text-center">No active facilities recorded for this customer.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Facility Ref / Line</th>
                          <th className="p-3">Facility Type</th>
                          <th className="p-3">Approved Limit</th>
                          <th className="p-3">Outstanding Balance</th>
                          <th className="p-3">Expiry Date</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {data.facilities?.map((f: any) => (
                          <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#1F4E7A]">{f.loanReference || f.lineCode}</td>
                            <td className="p-3 font-semibold">{f.facilityType}</td>
                            <td className="p-3 font-bold">ETB {(f.approvedLimit ?? 0).toLocaleString()}</td>
                            <td className="p-3 font-bold text-[#1F4E7A]">ETB {(f.outstandingBalance ?? 0).toLocaleString()}</td>
                            <td className="p-3">{f.lineExpiryDate || 'N/A'}</td>
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

              {/* 2. Pledged Collateral Section */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#2C6295]" />
                  Pledged Collateral Assets ({data.collaterals?.length ?? 0})
                </h3>
                {data.collaterals?.length === 0 ? (
                  <div className="text-xs text-[#5B6472] py-4 text-center">No pledged collaterals found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Collateral Code</th>
                          <th className="p-3">Category / Type</th>
                          <th className="p-3">Description</th>
                          <th className="p-3">Valuation Amount</th>
                          <th className="p-3">Haircut</th>
                          <th className="p-3">Net Security</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Insurance Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {data.collaterals?.map((c: any) => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-[#1F4E7A]">{c.code || c.id}</td>
                            <td className="p-3">{c.category}</td>
                            <td className="p-3 max-w-xs truncate">{c.description}</td>
                            <td className="p-3 font-bold">ETB {(c.valuationAmount ?? 0).toLocaleString()}</td>
                            <td className="p-3">{c.haircut}%</td>
                            <td className="p-3 font-bold text-emerald-700">
                              ETB {((c.valuationAmount ?? 0) * (1 - (c.haircut ?? 0) / 100)).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold">{c.status}</td>
                            <td className="p-3 font-bold text-slate-700">{c.insuranceStatus || 'N/A'}</td>
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

              {/* 3. Insurance Policies Section */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#2C6295]" />
                  Insurance Policies ({data.policies?.length ?? 0})
                </h3>
                {data.policies?.length === 0 ? (
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
                          <th className="p-3">Premium</th>
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
                            <td className="p-3 font-bold text-emerald-700">ETB {(p.insuredAmount ?? 0).toLocaleString()}</td>
                            <td className="p-3">ETB {(p.premium ?? 0).toLocaleString()}</td>
                            <td className="p-3 font-semibold">{p.expiryDate}</td>
                            <td className="p-3 font-bold text-[#173F63]">{p.status}</td>
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

          {/* LEVEL 7: FACILITY / LOAN VIEW */}
          {currentLevel === 'FACILITY' && (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
                <div className="text-xs font-semibold text-[#5B6472] uppercase">Facility Details</div>
                <h2 className="text-2xl font-black text-[#101828]">
                  {data.facility?.loanReference || data.facility?.lineCode}
                </h2>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>Borrower: <strong>{data.customer?.name}</strong> (CIF: {data.customer?.cif})</div>
                  <div>Facility Type: <strong>{data.facility?.facilityType}</strong></div>
                  <div>Approved Limit: <strong>ETB {(data.facility?.approvedLimit ?? 0).toLocaleString()}</strong></div>
                  <div>Outstanding Balance: <strong className="text-[#1F4E7A]">ETB {(data.facility?.outstandingBalance ?? 0).toLocaleString()}</strong></div>
                </div>
              </div>

              {/* Linked Collateral Allocation Details (No double counting) */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3">Securing Collateral Assets & Allocations</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Collateral Code</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Market Value</th>
                        <th className="p-3">Allocated Amount</th>
                        <th className="p-3">Linkage Type</th>
                        <th className="p-3">Insurance Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {data.linkedCollaterals?.map((col: any) => (
                        <tr key={col.linkId || col.collateralId} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-[#1F4E7A]">{col.collateralCode}</td>
                          <td className="p-3">{col.category}</td>
                          <td className="p-3 max-w-xs truncate">{col.description}</td>
                          <td className="p-3 font-bold">ETB {(col.valuationAmount ?? 0).toLocaleString()}</td>
                          <td className="p-3 font-bold text-emerald-700">ETB {(col.allocatedAmount ?? 0).toLocaleString()}</td>
                          <td className="p-3">{col.linkageType}</td>
                          <td className="p-3 font-semibold">{col.insuranceStatus}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => drillToCollateral(col.collateralId)}
                              className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors"
                            >
                              Explore Collateral
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 8: COLLATERAL VIEW */}
          {currentLevel === 'COLLATERAL' && (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
                <div className="text-xs font-semibold text-[#5B6472] uppercase">Collateral Asset Details</div>
                <h2 className="text-2xl font-black text-[#101828]">{data.collateral?.code || data.collateral?.id}</h2>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>Category: <strong>{data.collateral?.category}</strong></div>
                  <div>Borrower: <strong>{data.customer?.name}</strong></div>
                  <div>Valuation Amount: <strong>ETB {(data.collateral?.valuationAmount ?? 0).toLocaleString()}</strong></div>
                  <div>Haircut: <strong>{data.collateral?.haircut}%</strong></div>
                  <div>Net Security Value: <strong className="text-emerald-700">ETB {((data.collateral?.valuationAmount ?? 0) * (1 - (data.collateral?.haircut ?? 0) / 100)).toLocaleString()}</strong></div>
                  <div>Status: <strong className="text-[#173F63]">{data.collateral?.status}</strong></div>
                </div>
              </div>

              {/* Mandatory Document Checklist */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#2C6295]" />
                  Mandatory Document Verification Checklist
                </h3>
                <div className="space-y-2">
                  {data.mandatoryChecklist?.map((item: any) => (
                    <div
                      key={item.ruleId || item.documentType}
                      className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                        item.uploaded
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {item.uploaded ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold">{item.documentType}</div>
                          {item.uploaded ? (
                            <div className="text-[11px] text-emerald-700 mt-0.5">
                              File: {item.fileName} ({item.status || 'Uploaded'})
                            </div>
                          ) : (
                            <div className="text-[11px] text-red-700 mt-0.5">
                              Missing authentic document file. Must be uploaded prior to activation.
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.uploaded ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'
                      }`}>
                        {item.uploaded ? 'Present' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Linked Policies */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3">Linked Insurance Coverage</h3>
                {data.policies?.length === 0 ? (
                  <div className="text-xs text-[#5B6472] py-3 text-center">No active insurance policy linked.</div>
                ) : (
                  <div className="space-y-2">
                    {data.policies?.map((p: any) => (
                      <div key={p.id} className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-lg flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-[#101828]">{p.policyNumber} — {p.insurerName}</div>
                          <div className="text-[#5B6472] text-[11px] mt-0.5">
                            Sum: ETB {(p.insuredAmount ?? 0).toLocaleString()} | Expiry: {p.expiryDate}
                          </div>
                        </div>
                        <button
                          onClick={() => drillToPolicy(p.id)}
                          className="px-2.5 py-1 bg-white hover:bg-[#EFF5FB] text-[#1F4E7A] border border-[#B9D3EB] rounded font-bold"
                        >
                          View Policy
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LEVEL 9: INSURANCE POLICY VIEW */}
          {currentLevel === 'POLICY' && (
            <div className="space-y-6">
              <div className="p-5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs">
                <div className="text-xs font-semibold text-[#5B6472] uppercase">Insurance Policy Details</div>
                <h2 className="text-2xl font-black text-[#101828]">{data.policy?.policyNumber}</h2>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>Insurer: <strong>{data.policy?.insurerName}</strong></div>
                  <div>Coverage Type: <strong>{data.policy?.coverageType}</strong></div>
                  <div>Sum Insured: <strong className="text-emerald-700">ETB {(data.policy?.insuredAmount ?? 0).toLocaleString()}</strong></div>
                  <div>Annual Premium: <strong>ETB {(data.policy?.premium ?? 0).toLocaleString()}</strong></div>
                  <div>Effective Date: <strong>{data.policy?.effectiveDate}</strong></div>
                  <div>Expiry Date: <strong>{data.policy?.expiryDate}</strong></div>
                  <div>Status: <strong className="text-[#173F63]">{data.policy?.status}</strong></div>
                  <div>Compliance: <strong className="text-emerald-700">{data.policy?.complianceStatus || 'Compliant'}</strong></div>
                </div>
              </div>

              {/* Endorsement & History Section */}
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
                <h3 className="font-bold text-sm text-[#101828] mb-3">Policy Endorsements & Lifecycle History</h3>
                {data.endorsements?.length === 0 ? (
                  <div className="text-xs text-[#5B6472] py-3 text-center">No endorsements issued for this policy.</div>
                ) : (
                  <div className="space-y-2">
                    {data.endorsements?.map((e: any) => (
                      <div key={e.id} className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-lg text-xs">
                        <div className="font-bold text-[#101828]">{e.endorsementNo} — {e.endorsementType}</div>
                        <div className="text-[#5B6472] mt-0.5">{e.description}</div>
                      </div>
                    ))}
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
