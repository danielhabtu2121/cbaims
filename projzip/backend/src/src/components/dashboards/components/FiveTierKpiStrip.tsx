import React from 'react';
import {
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Percent,
  AlertTriangle,
  FileCheck,
  FileX,
  Clock,
  HelpCircle,
  Building,
  CreditCard,
  CheckCircle2,
  PieChart,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { DashboardSummary } from '../../../types';

interface FiveTierKpiStripProps {
  summary: DashboardSummary;
  onWhyClick?: (kpiKey: string, kpiTitle: string) => void;
  onActionDrillDown?: (filterType: string, filterValue: string, label: string) => void;
  className?: string;
}

export const FiveTierKpiStrip: React.FC<FiveTierKpiStripProps> = ({
  summary,
  onWhyClick,
  onActionDrillDown,
  className = '',
}) => {
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'ETB 0.0';
    const abs = Math.abs(val);
    if (abs >= 1e9) {
      return `ETB ${(val / 1e9).toFixed(2)}B`;
    }
    if (abs >= 1e6) {
      return `ETB ${(val / 1e6).toFixed(2)}M`;
    }
    if (abs >= 1e3) {
      return `ETB ${(val / 1e3).toFixed(1)}K`;
    }
    return `ETB ${val.toLocaleString()}`;
  };

  const coveragePct = Number((summary.insuranceComplianceRate ?? summary.insuranceCoveragePct ?? 0).toFixed(1));
  const concentrationPct = Number((summary.insurerConcentrationMaxPct ?? 0).toFixed(1));

  return (
    <div className={`space-y-4 ${className}`}>
      {/* TIER 1: PORTFOLIO FUNDAMENTALS (§9) */}
      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1F4E7A]"></span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#1F4E7A]">
              Tier 1 • Portfolio Fundamentals
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">What portfolio exists within my authorized scope?</span>
        </div>

        {/* Primary KPI Cards (§9: Customers, Facilities, Collaterals, Outstanding Exposure) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Customers */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-[#1F4E7A]/40 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Customers (Borrowers)</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('customers', 'Customers Count')}
                  className="text-slate-400 hover:text-[#1F4E7A] p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {(summary.totalCustomersCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Authorized CIF Profiles
            </div>
          </div>

          {/* 2. Facilities */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-[#1F4E7A]/40 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Credit Facilities</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('facilities', 'Credit Facilities Count')}
                  className="text-slate-400 hover:text-[#1F4E7A] p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {(summary.totalFacilitiesCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Active Lending Accounts
            </div>
          </div>

          {/* 3. Collaterals */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-[#1F4E7A]/40 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Pledged Collaterals</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('collaterals', 'Pledged Collateral Assets')}
                  className="text-slate-400 hover:text-[#1F4E7A] p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {(summary.totalCollateralsCount ?? summary.activeCollateralsCount ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Unique Physical Assets
            </div>
          </div>

          {/* 4. Outstanding Exposure */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-[#1F4E7A]/40 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Outstanding Exposure</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('outstanding_exposure', 'Outstanding Lending Exposure')}
                  className="text-slate-400 hover:text-[#1F4E7A] p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-[#1F4E7A] mt-1">
              {formatCurrency(summary.totalOutstandingExposure)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Current Outstanding Loan Balances
            </div>
          </div>
        </div>

        {/* Secondary Metrics (§9: Collateral Market Value, Net Security Value, Collateral-to-Loan Ratio) */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-500 font-medium">Collateral Market Value:</span>
            <strong className="text-slate-800 font-bold">{formatCurrency(summary.totalCollateralMarketValue)}</strong>
          </div>
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-500 font-medium">Net Security Value (NSV):</span>
            <strong className="text-slate-800 font-bold">{formatCurrency(summary.totalNetSecurityValue)}</strong>
          </div>
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-500 font-medium">Collateral-to-Loan Ratio:</span>
            <strong className="text-slate-800 font-bold">
              {summary.totalOutstandingExposure > 0
                ? `${((summary.totalCollateralMarketValue / summary.totalOutstandingExposure) * 100).toFixed(1)}%`
                : 'N/A'}
            </strong>
          </div>
        </div>
      </div>

      {/* TIER 2: INSURANCE PROTECTION & COVERAGE (§10 Tier 2) */}
      <div className="bg-emerald-50/40 border border-emerald-200/70 rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
              Tier 2 • Insurance Protection & Coverage
            </span>
          </div>
          <span className="text-[11px] text-emerald-800 font-medium">Requirement = MAX(Outstanding Balance, Collateral Value)</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Insurance Requirement */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Insurance Requirement</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('insurance_required', 'Insurance Requirement')}
                  className="text-slate-400 hover:text-emerald-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {formatCurrency(summary.totalInsuranceRequired)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              MAX(Exposure, Market Value)
            </div>
          </div>

          {/* 2. Active Valid Insurance */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Active Valid Insurance</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('active_insurance', 'Active Valid Insurance')}
                  className="text-slate-400 hover:text-emerald-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-emerald-800 mt-1">
              {formatCurrency(summary.totalValidActiveInsurance)}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              Authoritative Active Lifecycle
            </div>
          </div>

          {/* 3. Insurance Gap */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-rose-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Insurance Gap</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('insurance_gap', 'Insurance Protection Gap')}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className={`text-xl font-extrabold mt-1 ${summary.totalInsuranceGap > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {formatCurrency(summary.totalInsuranceGap)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {summary.totalInsuranceGap > 0 ? 'MAX(0, Req - Active Cover)' : 'Adequately Covered'}
            </div>
          </div>

          {/* 4. Insurance Compliance Rate */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Insurance Compliance Rate</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('coverage_pct', 'Insurance Compliance Rate')}
                  className="text-slate-400 hover:text-emerald-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {coveragePct}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              (Adequate ÷ Required Records) × 100
            </div>
          </div>
        </div>

        {/* Authoritative Adequacy Breakdown (§10 & §11: Uninsured = 0, Underinsured > 0 & < Req, Adequate >= Req) */}
        <div className="mt-2.5 pt-2.5 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-600 font-medium">Uninsured (0% Cover):</span>
            <strong className="text-rose-700 font-bold">{summary.uninsuredCollateralsCount ?? 0} Assets</strong>
          </div>
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-600 font-medium">Underinsured (&lt; 100% Cover):</span>
            <strong className="text-amber-700 font-bold">{summary.underinsuredCollateralsCount ?? 0} Assets</strong>
          </div>
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-600 font-medium">Adequate (≥ 100% Cover):</span>
            <strong className="text-emerald-700 font-bold">{summary.adequatelyInsuredCollateralsCount ?? 0} Assets</strong>
          </div>
        </div>
      </div>

      {/* TIER 3: RISK & PORTFOLIO COMPLIANCE (§10 Tier 3) */}
      <div className="bg-rose-50/30 border border-rose-200/70 rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-900">
              Tier 3 • Risk & Portfolio Compliance
            </span>
          </div>
          <span className="text-[11px] text-rose-700 font-medium">Where is the risk in the portfolio?</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Uninsured Collateral */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('status', 'Uninsured', 'Uninsured Collaterals')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-rose-400 hover:shadow-md cursor-pointer' : 'hover:border-rose-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Uninsured Collateral</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('uninsured_collaterals', 'Uninsured Collaterals'); }}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {summary.uninsuredCollateralsCount ?? 0}
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-0.5 truncate" title={`Affected Market Value: ${formatCurrency(summary.uninsuredCollateralsMarketValue)}`}>
              Val: {formatCurrency(summary.uninsuredCollateralsMarketValue)}
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                <span>Inspect Records &rarr;</span>
              </div>
            )}
          </div>

          {/* 2. Underinsured Collateral */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('status', 'Underinsured', 'Underinsured Collaterals')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-amber-400 hover:shadow-md cursor-pointer' : 'hover:border-amber-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Underinsured Collateral</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('underinsured_collaterals', 'Underinsured Collaterals'); }}
                  className="text-slate-400 hover:text-amber-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1">
              {summary.underinsuredCollateralsCount ?? 0}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-0.5 truncate" title={`Insurance Deficit: ${formatCurrency(summary.underinsuredCollateralsGap)}`}>
              Gap: {formatCurrency(summary.underinsuredCollateralsGap)}
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1">
                <span>Inspect Records &rarr;</span>
              </div>
            )}
          </div>

          {/* 3. Expired Policies */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('status', 'Expired', 'Expired Policies')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-rose-400 hover:shadow-md cursor-pointer' : 'hover:border-rose-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Expired Policies</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('expired_policies', 'Expired Policies'); }}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {summary.expiredPoliciesCount ?? 0}
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-0.5">
              Current Effective Expired
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                <span>Inspect Records &rarr;</span>
              </div>
            )}
          </div>

          {/* 4. Due Within 7 Days (§10 Tier 3: Explicitly required by Executive Dashboard) */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('status', 'DueWithin7Days', 'Policies Due Within 7 Days')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-rose-400 hover:shadow-md cursor-pointer' : 'hover:border-rose-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Due Within 7 Days</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('due_7_days', 'Policies Due Within 7 Days'); }}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {summary.policiesDueWithin7DaysCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Immediate Expiry Window
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                <span>Inspect Records &rarr;</span>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Risk Metrics (§10: Expiring within 30 days, Open Exceptions) */}
        <div className="mt-2.5 pt-2.5 border-t border-rose-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-600 font-medium">Expiring in 8–30 Days:</span>
            <strong className="text-amber-700 font-bold">
              {Math.max(0, (summary.policiesExpiringWithin30Days ?? 0) - (summary.policiesDueWithin7DaysCount ?? 0))} Policies
            </strong>
          </div>
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-600 font-medium">Open Policy & Coverage Exceptions:</span>
            <strong className="text-rose-700 font-bold">{summary.openExceptionsCount ?? 0} Exceptions</strong>
          </div>
        </div>
      </div>

      {/* TIER 4: OPERATIONS & GOVERNANCE (§10 Tier 4) */}
      <div className="bg-purple-50/40 border border-purple-200/70 rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-purple-900">
              Tier 4 • Operations & Governance
            </span>
          </div>
          <span className="text-[11px] text-purple-800 font-medium">What operational work needs action?</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Renewals in Progress (§10: Actual workflow renewal lifecycle) */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('workflow', 'Renewals', 'Renewals in Progress')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-purple-400 hover:shadow-md cursor-pointer' : 'hover:border-purple-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Renewals In Progress</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('renewals_in_progress', 'Renewals in Progress'); }}
                  className="text-slate-400 hover:text-purple-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-purple-900 mt-1">
              {summary.renewalsInProgressCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Active Workflow Pipelines
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-purple-600 font-bold flex items-center gap-1 mt-1">
                <span>View Queue &rarr;</span>
              </div>
            )}
          </div>

          {/* 2. Pending Approvals */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('workflow', 'PendingApproval', 'Pending Approvals')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-purple-400 hover:shadow-md cursor-pointer' : 'hover:border-purple-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Pending Approvals</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('pending_approvals', 'Pending Approvals'); }}
                  className="text-slate-400 hover:text-purple-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-purple-900 mt-1">
              {summary.pendingApprovalsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Actionable Review Tasks
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-purple-600 font-bold flex items-center gap-1 mt-1">
                <span>View Queue &rarr;</span>
              </div>
            )}
          </div>

          {/* 3. Open Exceptions */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('exceptions', 'Open', 'Open Exceptions')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-purple-400 hover:shadow-md cursor-pointer' : 'hover:border-purple-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Open Exceptions</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('open_exceptions', 'Open Exceptions'); }}
                  className="text-slate-400 hover:text-purple-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {summary.openExceptionsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Unresolved Deviations
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-purple-600 font-bold flex items-center gap-1 mt-1">
                <span>View Exceptions &rarr;</span>
              </div>
            )}
          </div>

          {/* 4. Insurance Company Exposure (§10 Tier 4: Real Top Insurer Share vs Concentration Limit) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-purple-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Top Insurer Share</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('insurer_concentration', 'Insurance Company Exposure')}
                  className="text-slate-400 hover:text-purple-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-purple-900 mt-1">
              {summary.actualTopInsurerExposurePct ?? concentrationPct}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={summary.actualTopInsurerName ? `${summary.actualTopInsurerName} (Limit: ${summary.configuredInsurerConcentrationLimitPct ?? concentrationPct}%)` : `Limit: ${concentrationPct}%`}>
              {summary.actualTopInsurerName || 'Top Underwriter'} (Limit: {summary.configuredInsurerConcentrationLimitPct ?? concentrationPct}%)
            </div>
          </div>
        </div>

        {/* Secondary Operational Metrics */}
        <div className="mt-2.5 pt-2.5 border-t border-purple-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-600 font-medium">Returned Maker Tasks:</span>
            <strong className="text-rose-700 font-bold">{summary.returnedTasksCount ?? 0} Tasks</strong>
          </div>
          <div className="flex items-center justify-between bg-white/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
            <span className="text-slate-600 font-medium">Policy Overrides / Exceptions:</span>
            <strong className="text-slate-800 font-bold">{summary.overrideCount ?? 0} Overrides</strong>
          </div>
        </div>
      </div>

      {/* TIER 5: DOCUMENTATION INTEGRITY (§10 Tier 5 & §33: Rule-based, No pending verification queue) */}
      <div className="bg-cyan-50/40 border border-cyan-200/70 rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-900">
              Tier 5 • Documentation Integrity
            </span>
          </div>
          <span className="text-[11px] text-cyan-800 font-medium">Evaluated from MandatoryDocumentRule + Actual Files</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Mandatory Documents Complete */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-cyan-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Mandatory Complete</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('mandatory_complete', 'Mandatory Documents Complete')}
                  className="text-slate-400 hover:text-cyan-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-emerald-800 mt-1">
              {summary.mandatoryDocumentsCompleteCount ?? 0}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              All Rules Satisfied
            </div>
          </div>

          {/* 2. Missing Mandatory Documents */}
          <div
            onClick={() => onActionDrillDown && onActionDrillDown('document', 'Missing', 'Missing Mandatory Documents')}
            className={`bg-white border border-slate-200 rounded-xl p-3 shadow-xs transition-all ${
              onActionDrillDown ? 'hover:border-rose-400 hover:shadow-md cursor-pointer' : 'hover:border-cyan-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Missing Mandatory</span>
              {onWhyClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onWhyClick('missing_documents', 'Missing Mandatory Documents'); }}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {summary.missingMandatoryDocumentsCount ?? summary.missingDocumentsCount ?? 0}
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
              Collaterals Missing Files
            </div>
            {onActionDrillDown && (
              <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                <span>Inspect Missing Files &rarr;</span>
              </div>
            )}
          </div>

          {/* 3. Expired Documents */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-cyan-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Expired Documents</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('expired_documents', 'Expired Documents')}
                  className="text-slate-400 hover:text-amber-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1">
              {summary.expiredDocumentsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Leases, Valuations, Regs
            </div>
          </div>

          {/* 4. Documents Expiring Soon */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs hover:border-cyan-300 transition-colors">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Expiring Soon</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('expiring_documents', 'Documents Expiring Soon')}
                  className="text-slate-400 hover:text-cyan-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {summary.expiringDocumentsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Within Warning Days
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
