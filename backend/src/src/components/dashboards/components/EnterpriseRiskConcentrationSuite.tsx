import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  CreditCard,
  Shield,
  Layers,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  Building,
  RefreshCw,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import { EnterpriseRiskConcentration } from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface EnterpriseRiskConcentrationSuiteProps {
  userId?: string;
  segment?: string;
  district?: string;
  branch?: string;
  onDrillToCustomer?: (cif: string) => void;
  onDrillToFacility?: (facilityId: string) => void;
  onDrillToCollateral?: (collateralId: string) => void;
  className?: string;
}

export const EnterpriseRiskConcentrationSuite: React.FC<EnterpriseRiskConcentrationSuiteProps> = ({
  userId,
  segment,
  district,
  branch,
  onDrillToCustomer,
  onDrillToFacility,
  onDrillToCollateral,
  className = '',
}) => {
  const [data, setData] = useState<EnterpriseRiskConcentration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'debtors' | 'deficits' | 'shared' | 'expiring'>('debtors');

  const fetchConcentration = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await cimsApi.getDashboardRiskConcentration({
        userId,
        segment: segment && segment !== 'ALL' ? segment : undefined,
        district: district && district !== 'ALL' ? district : undefined,
        branch: branch && branch !== 'ALL' ? branch : undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load risk concentration data:', err);
      setError(err?.message || 'Failed to load high-volume concentration intelligence.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, segment, district, branch]);

  useEffect(() => {
    fetchConcentration();
  }, [fetchConcentration]);

  if (isLoading) {
    return (
      <div className={`p-8 bg-white border border-[#E2E8F0] rounded-xl shadow-xs text-center ${className}`}>
        <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin text-[#2C6295]" />
          <span>Aggregating enterprise credit exposure and collateral cross-pledge matrix...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Graceful degrade if service unavailable
  }

  const ltvIsBreached = data.portfolioWeightedLtvPct > 80.0;
  const isSevereLtv = data.portfolioWeightedLtvPct > 100.0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Executive Multi-Tier Risk & Protection Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Credit Outstanding Exposure */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Credit Facilities</span>
            <CreditCard className="w-4 h-4 text-[#1F4E7A]" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#1F4E7A]">
            ETB {((data.totalCreditExposure || 0) / 1e6).toFixed(1)}M
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Aggregated corporate funded & non-funded limits</span>
          </div>
          <div className="absolute top-0 right-0 w-1.5 h-full bg-[#1F4E7A]" />
        </div>

        {/* Card 2: Single-Counted Pledged Collateral */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Pledged Collateral (Single-Counted)</span>
            <Shield className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#101828]">
            ETB {((data.singleCountedPledgedValue || 0) / 1e6).toFixed(1)}M
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
            <span>Net Realizable: ETB {((data.netRealizableSecurityValue || 0) / 1e6).toFixed(1)}M</span>
          </div>
          <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-600" />
        </div>

        {/* Card 3: Portfolio Weighted LTV Ratio */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Weighted Portfolio LTV</span>
            <Scale className={`w-4 h-4 ${isSevereLtv ? 'text-red-600' : ltvIsBreached ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-2 text-2xl font-black text-[#101828] flex items-center gap-2">
            <span>{data.portfolioWeightedLtvPct}%</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isSevereLtv
                ? 'bg-red-100 text-red-800 border border-red-300'
                : ltvIsBreached
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              {isSevereLtv ? 'Cap Breached' : ltvIsBreached ? 'Watchlist' : 'Compliant'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            NBE Regulatory Benchmark: ≤ 80.0%
          </div>
          <div className={`absolute top-0 right-0 w-1.5 h-full ${isSevereLtv ? 'bg-red-500' : ltvIsBreached ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        </div>

        {/* Card 4: Net Uncovered Exposure / Shortfall */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Collateral Deficit (Uncovered)</span>
            <ShieldAlert className={`w-4 h-4 ${data.netUncoveredDeficit > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-2 text-2xl font-black text-[#101828]">
            ETB {((data.netUncoveredDeficit || 0) / 1e6).toFixed(1)}M
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>Coverage Ratio: <strong className="text-slate-800">{data.portfolioCoveragePct}%</strong></span>
          </div>
          <div className={`absolute top-0 right-0 w-1.5 h-full ${data.netUncoveredDeficit > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        </div>
      </div>

      {/* 2. Interactive Enterprise Concentration Tabs */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-3">
          <div>
            <h3 className="font-extrabold text-base text-[#101828] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#2C6295]" />
              <span>Enterprise Credit & Collateral Concentration Intelligence</span>
            </h3>
            <p className="text-xs text-[#5B6472]">
              Real-time multi-dimensional exposure rankings designed for enterprise volumes (100k+ accounts)
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-bold">
            <button
              onClick={() => setActiveTab('debtors')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'debtors'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-slate-600 hover:text-[#101828]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-[#2C6295]" />
              <span>Top 10 Borrowers ({data.topDebtors?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('deficits')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'deficits'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-slate-600 hover:text-[#101828]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Under-Secured Loans ({data.topDeficitFacilities?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('shared')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'shared'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-slate-600 hover:text-[#101828]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#1F4E7A]" />
              <span>Shared Collaterals ({data.sharedCollaterals?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('expiring')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'expiring'
                  ? 'bg-white text-[#101828] shadow-xs'
                  : 'text-slate-600 hover:text-[#101828]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              <span>Uninsured Assets ({data.criticalExpiringCollaterals?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* TAB 1: TOP 10 HIGH EXPOSURE BORROWERS */}
        {activeTab === 'debtors' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Rank & Corporate Debtor</th>
                  <th className="p-3">CIF</th>
                  <th className="p-3">Segment & Branch</th>
                  <th className="p-3 text-center">Facilities</th>
                  <th className="p-3 text-center">Collaterals</th>
                  <th className="p-3">Total Exposure</th>
                  <th className="p-3">Collateral Value</th>
                  <th className="p-3 text-center">LTV %</th>
                  <th className="p-3 text-center">Coverage %</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Drill Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {(!data.topDebtors || data.topDebtors.length === 0) ? (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-slate-500">
                      No customer debtor records found in the current scope.
                    </td>
                  </tr>
                ) : (
                  data.topDebtors.map((debtor, idx) => (
                    <tr
                      key={debtor.cif}
                      onClick={() => onDrillToCustomer && onDrillToCustomer(debtor.cif)}
                      className="hover:bg-[#EFF5FB]/60 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-bold text-[#101828] flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-700 font-mono">
                          {idx + 1}
                        </span>
                        <span>{debtor.customerName}</span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">{debtor.cif}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{debtor.segment}</div>
                        <div className="text-[10px] text-slate-500">{debtor.branch}</div>
                      </td>
                      <td className="p-3 text-center font-bold">{debtor.facilityCount}</td>
                      <td className="p-3 text-center font-bold">{debtor.collateralCount}</td>
                      <td className="p-3 font-bold text-[#1F4E7A]">
                        ETB {((debtor.totalExposure || 0) / 1e6).toFixed(2)}M
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        ETB {((debtor.collateralMarketValue || 0) / 1e6).toFixed(2)}M
                      </td>
                      <td className="p-3 text-center font-bold">
                        <span className={`${debtor.effectiveLtvPct > 80 ? 'text-red-700' : 'text-slate-800'}`}>
                          {debtor.effectiveLtvPct}%
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold">
                        <span className={`${debtor.coveragePct < 100 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {debtor.coveragePct}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          debtor.insuranceStatus === 'Adequate'
                            ? 'bg-emerald-100 text-emerald-800'
                            : debtor.insuranceStatus === 'Partial Gap'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {debtor.insuranceStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDrillToCustomer) onDrillToCustomer(debtor.cif);
                          }}
                          className="px-2.5 py-1 bg-[#EFF5FB] hover:bg-[#DCE9F5] text-[#1F4E7A] text-xs font-bold rounded border border-[#B9D3EB] transition-colors inline-flex items-center gap-1"
                        >
                          <span>Customer 360</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: TOP 10 DEFICIT / UNDER-COLLATERALIZED FACILITIES */}
        {activeTab === 'deficits' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Facility Ref</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Outstanding Balance</th>
                  <th className="p-3">Pledged Security</th>
                  <th className="p-3">Collateral Shortfall</th>
                  <th className="p-3 text-center">LTV %</th>
                  <th className="p-3">Action Required</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {(!data.topDeficitFacilities || data.topDeficitFacilities.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                      <span>All facilities in the current scope have 100%+ collateral coverage. No deficits recorded.</span>
                    </td>
                  </tr>
                ) : (
                  data.topDeficitFacilities.map((fac) => (
                    <tr
                      key={fac.facilityId}
                      onClick={() => onDrillToFacility && onDrillToFacility(fac.facilityId)}
                      className="hover:bg-amber-50/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono font-bold text-[#101828]">
                        {fac.loanReference}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#101828]">{fac.customerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{fac.cif}</div>
                      </td>
                      <td className="p-3 font-medium text-slate-600">{fac.facilityType}</td>
                      <td className="p-3 font-bold text-slate-800">
                        ETB {Number(fac.outstandingBalance || 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        ETB {Number(fac.pledgedCollateralValue || 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-black text-red-600">
                        ETB {Number(fac.shortfallAmount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-bold text-red-600">
                        {fac.ltvRatio}%
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                          {fac.actionRequired}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDrillToFacility) onDrillToFacility(fac.facilityId);
                          }}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded border border-amber-200 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Facility 360</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: CROSS-FACILITY SHARED SECURITY POOLS */}
        {activeTab === 'shared' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Collateral Code</th>
                  <th className="p-3">Category & Asset</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Market Value</th>
                  <th className="p-3">Net Value</th>
                  <th className="p-3 text-center">Linked Loans</th>
                  <th className="p-3">Total Secured Exposure</th>
                  <th className="p-3 text-center">Allocated %</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Drill Down</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {(!data.sharedCollaterals || data.sharedCollaterals.length === 0) ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500">
                      No multi-pledged collateral pools detected in this branch or segment.
                    </td>
                  </tr>
                ) : (
                  data.sharedCollaterals.map((pool) => (
                    <tr
                      key={pool.collateralId}
                      onClick={() => onDrillToCollateral && onDrillToCollateral(pool.collateralId)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono font-bold text-[#1F4E7A]">
                        {pool.collateralCode}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#101828]">{pool.description}</div>
                        <div className="text-[10px] text-slate-500">{pool.category}</div>
                      </td>
                      <td className="p-3 font-medium text-slate-700">{pool.ownerName}</td>
                      <td className="p-3 font-bold text-slate-800">
                        ETB {Number(pool.marketValue || 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        ETB {Number(pool.netSecurityValue || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-900 border border-blue-200">
                          {pool.linkedFacilitiesCount} Loans
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#1F4E7A]">
                        ETB {Number(pool.totalLinkedExposure || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {pool.totalAllocationPct}%
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pool.overCommitted
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {pool.overCommitted ? 'Over-Allocated' : 'Balanced Pool'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDrillToCollateral) onDrillToCollateral(pool.collateralId);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold rounded border border-blue-200 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Collateral 360</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: CRITICAL UNINSURED / EXPIRING ASSETS */}
        {activeTab === 'expiring' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-[#E2E8F0] text-[#5B6472] uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Collateral Code</th>
                  <th className="p-3">Asset Description</th>
                  <th className="p-3">Borrower</th>
                  <th className="p-3">Valuation Amount</th>
                  <th className="p-3">Exposed Facility Balance</th>
                  <th className="p-3">Issue Detected</th>
                  <th className="p-3">Policy Number</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {(!data.criticalExpiringCollaterals || data.criticalExpiringCollaterals.length === 0) ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                      <span>All high-value collateral assets have valid, active insurance protection in place.</span>
                    </td>
                  </tr>
                ) : (
                  data.criticalExpiringCollaterals.map((asset) => (
                    <tr
                      key={asset.collateralId}
                      onClick={() => onDrillToCollateral && onDrillToCollateral(asset.collateralId)}
                      className="hover:bg-red-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-mono font-bold text-[#101828]">
                        {asset.collateralCode}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-[#101828]">{asset.description}</div>
                        <div className="text-[10px] text-slate-500">{asset.category}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{asset.customerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{asset.cif}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        ETB {Number(asset.marketValue || 0).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold text-red-600">
                        ETB {Number(asset.exposedLoanAmount || 0).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          asset.issueType === 'No Policy Registered'
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {asset.issueType}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">
                        {asset.policyNumber || 'N/A'}
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {asset.expiryDate || 'Unregistered'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDrillToCollateral) onDrillToCollateral(asset.collateralId);
                          }}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-900 text-xs font-bold rounded border border-red-200 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Review Asset</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
