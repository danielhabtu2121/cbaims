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
  className?: string;
}

export const FiveTierKpiStrip: React.FC<FiveTierKpiStripProps> = ({
  summary,
  onWhyClick,
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

  const coveragePct = Number((summary.insuranceCoveragePct ?? 0).toFixed(1));
  const concentrationPct = Number((summary.insurerConcentrationMaxPct ?? 0).toFixed(1));

  return (
    <div className={`space-y-4 ${className}`}>
      {/* TIER 1: PORTFOLIO FUNDAMENTALS */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Tier 1 • Portfolio Fundamentals
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Core Asset & Facility Values</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Market Value */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-blue-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Collateral Market Value</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('collateral_market_value', 'Collateral Market Value')}
                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {formatCurrency(summary.totalCollateralMarketValue)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400" />
              <span>{summary.totalCollateralsCount ?? summary.activeCollateralsCount ?? 0} Pledged Assets</span>
            </div>
          </div>

          {/* Outstanding Exposure */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-blue-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Outstanding Exposure</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('outstanding_exposure', 'Outstanding Loan Exposure')}
                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-blue-900 mt-1">
              {formatCurrency(summary.totalOutstandingExposure)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-slate-400" />
              <span>{summary.totalFacilitiesCount ?? 0} Facilities ({summary.totalCustomersCount ?? 0} Borrowers)</span>
            </div>
          </div>

          {/* Net Security Value */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-blue-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Net Security Value (NSV)</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('net_security_value', 'Net Security Value (NSV)')}
                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {formatCurrency(summary.totalNetSecurityValue)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Haircut-Adjusted Liquidation Value
            </div>
          </div>

          {/* Facility / Collateral Coverage Ratio */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-blue-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Collateral-to-Loan Ratio</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('collateral_to_loan', 'Collateral-to-Loan Ratio')}
                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {summary.totalOutstandingExposure > 0
                ? `${((summary.totalCollateralMarketValue / summary.totalOutstandingExposure) * 100).toFixed(1)}%`
                : 'N/A'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Market Value / Outstanding Balance
            </div>
          </div>
        </div>
      </div>

      {/* TIER 2: INSURANCE PROTECTION & COVERAGE */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Tier 2 • Insurance Protection & Coverage
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Req = Max(Balance, Collateral Value)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Insurance Requirement */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-emerald-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Insurance Required</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('insurance_required', 'Total Insurance Required')}
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
            <div className="text-[11px] text-slate-500 mt-1">
              ∑ MAX(Balance, Value) per Asset
            </div>
          </div>

          {/* Active Valid Insurance */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-emerald-300 transition-colors relative group">
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
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              Active Unexpired Policies
            </div>
          </div>

          {/* Insurance Gap */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-emerald-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Insurance Deficit (Gap)</span>
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
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {formatCurrency(summary.totalInsuranceGap)}
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-1">
              {summary.totalInsuranceGap > 0 ? 'Unprotected Bank Exposure' : 'Fully Protected Portfolio'}
            </div>
          </div>

          {/* Realistic Coverage Percentage */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-emerald-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Insurance Coverage %</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('coverage_pct', 'Insurance Coverage Percentage')}
                  className="text-slate-400 hover:text-emerald-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 flex items-baseline gap-1.5">
              <span>{coveragePct}%</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                coveragePct >= 90
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : coveragePct >= 70
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {coveragePct >= 90 ? 'Healthy' : coveragePct >= 70 ? 'Moderate' : 'Underinsured'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              (Active Cover / Required) × 100
            </div>
          </div>
        </div>
      </div>

      {/* TIER 3: RISK & PORTFOLIO COMPLIANCE */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Tier 3 • Risk & Portfolio Compliance
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Coverage Deficiencies & Exceptions</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Expired Policies */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-rose-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Expired Policies</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('expired_policies', 'Expired Policies')}
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
            <div className="text-[11px] text-rose-600 font-semibold mt-1">
              Zero Active Coverage
            </div>
          </div>

          {/* Underinsured & Uninsured Assets */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-rose-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Underinsured Collaterals</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('underinsured_collaterals', 'Underinsured Collateral Assets')}
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
            <div className="text-[11px] text-amber-700 font-semibold mt-1">
              Partial Coverage Shortfall
            </div>
          </div>

          {/* Open Compliance Exceptions */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-rose-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Open Exceptions</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('open_exceptions', 'Open Exceptions')}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {summary.openExceptionsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Pending Policy Deviations
            </div>
          </div>

          {/* Policy Expiries in 30 Days */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-rose-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Expiring in 30 Days</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('expiring_30_days', 'Policies Expiring in 30 Days')}
                  className="text-slate-400 hover:text-amber-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1">
              {summary.policiesExpiringWithin30Days ?? 0}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-1">
              Immediate Renewal Pipeline
            </div>
          </div>
        </div>
      </div>

      {/* TIER 4: OPERATIONS & GOVERNANCE */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Tier 4 • Operations & Governance
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Task Queues & Insurer Concentration</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Pending Approvals */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-purple-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Pending Approvals</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('pending_approvals', 'Pending Approvals')}
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
            <div className="text-[11px] text-slate-500 mt-1">
              Awaiting Supervisor Sign-off
            </div>
          </div>

          {/* Returned Tasks */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-purple-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Returned Tasks</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('returned_tasks', 'Returned Tasks')}
                  className="text-slate-400 hover:text-purple-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {summary.returnedTasksCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Returned for Correction
            </div>
          </div>

          {/* Policy Overrides */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-purple-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Policy Overrides</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('policy_overrides', 'Policy Overrides')}
                  className="text-slate-400 hover:text-purple-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {summary.overrideCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Executive / Risk Exceptions
            </div>
          </div>

          {/* Insurer Concentration */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-purple-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Max Insurer Share</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('insurer_concentration', 'Insurer Portfolio Concentration')}
                  className="text-slate-400 hover:text-purple-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1 flex items-baseline gap-1.5">
              <span>{concentrationPct}%</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                concentrationPct > 35
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : concentrationPct > 25
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {concentrationPct > 35 ? 'High Concentration' : 'Prudent'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Single Insurer Underwriting Cap
            </div>
          </div>
        </div>
      </div>

      {/* TIER 5: DOCUMENTATION INTEGRITY */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-600"></span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Tier 5 • Documentation Integrity & Health
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">Physical & Digital Collateral Documents</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Missing Documents */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-cyan-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Missing Mandatory Docs</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('missing_documents', 'Missing Mandatory Documents')}
                  className="text-slate-400 hover:text-cyan-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              {summary.missingDocumentsCount ?? 0}
            </div>
            <div className="text-[11px] text-rose-600 font-semibold mt-1">
              Title Deeds, Vehicle Logbooks
            </div>
          </div>

          {/* Pending Verification */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-cyan-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Pending Verifications</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('pending_verification', 'Pending Document Verifications')}
                  className="text-slate-400 hover:text-cyan-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {summary.pendingDocumentVerificationsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              In Officer Review Queue
            </div>
          </div>

          {/* Expired Documents */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-cyan-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Expired Documents</span>
              {onWhyClick && (
                <button
                  onClick={() => onWhyClick('expired_documents', 'Expired Ownership Documents')}
                  className="text-slate-400 hover:text-cyan-600 p-0.5 rounded transition-colors"
                  title="Explain this metric"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-xl font-extrabold text-amber-700 mt-1">
              {summary.expiredDocumentsCount ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Expired Leases, Valuations
            </div>
          </div>

          {/* Expiring Documents */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-cyan-300 transition-colors relative group">
            <div className="flex items-start justify-between">
              <span className="text-[11px] font-semibold text-slate-500">Docs Expiring in 30 Days</span>
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
            <div className="text-[11px] text-slate-500 mt-1">
              Upcoming Renewal Requirements
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
