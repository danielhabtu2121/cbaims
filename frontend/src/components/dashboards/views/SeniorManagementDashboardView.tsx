import { formatEtb } from '../../../utils/format';
import React, { useState } from 'react';

import {
  Building2,
  Shield,
  FileCheck,
  TrendingUp,
  MapPin,
  Clock,
  Layers,
  PieChart as PieIcon,
  CheckCircle,
  Eye,
  Activity,
  BarChart3,
  Download,
  FileSpreadsheet,
  AlertTriangle,
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

import { DashboardSummary, DashboardChartData, DashboardPortfolioRow } from '../../../types';

import { UniversalPortfolioTable } from '../UniversalPortfolioTable';

interface SeniorManagementDashboardViewProps {
  summary: DashboardSummary;
  charts: DashboardChartData;
  portfolioRows: DashboardPortfolioRow[];
  onNavigate: (page: string, params?: any) => void;
  onExport: () => void;
}

export const SeniorManagementDashboardView: React.FC<SeniorManagementDashboardViewProps> = ({
  summary,
  charts,
  portfolioRows,
  onNavigate,
  onExport,
}) => {
  const formatCurrency = (val?: number) => formatEtb(val);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner with Reporting Shortcuts */}
      <div className="bg-gradient-to-r from-[#00205B] to-[#0E284E] rounded-xl p-6 text-white flex flex-wrap items-center justify-between gap-4 shadow-sm border border-[#00205B]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-[#D48806]/20 text-[#D48806] border border-[#D48806]/40 text-[11px] font-bold px-2 py-0.5 rounded tracking-wide uppercase">
              Senior Management Review (§6)
            </span>
            <span className="text-[11px] text-slate-300 font-medium">Operational &amp; Analytical Command</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Bank-Wide Portfolio Health &amp; Branch Comparison
          </h1>
        </div>

        {/* Reporting Shortcuts (§6) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => onNavigate('reports')}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#D48806]" />
            <span>Generate Regulatory Report</span>
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-1.5 bg-[#D48806] hover:bg-[#b87405] text-white rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Management CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Exposure</div>
          <div className="text-lg font-bold text-[#00205B] mt-1">
            {formatCurrency(summary.totalOutstandingExposure)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{summary.totalFacilitiesCount} facility accounts</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Collateral Market Value</div>
          <div className="text-lg font-bold text-[#00205B] mt-1">
            {formatCurrency(summary.totalCollateralMarketValue)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{summary.activeCollateralsCount} collaterals</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Net Security</div>
          <div className="text-lg font-bold text-[#00205B] mt-1">
            {formatCurrency(summary.totalNetSecurityValue)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Post-haircut security sum</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Insurance Compliance</div>
          <div className={`text-xl font-extrabold mt-1 ${(summary.insuranceComplianceRate ?? summary.insuranceCoveragePct) >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {(summary.insuranceComplianceRate ?? summary.insuranceCoveragePct)}%
          </div>
          <div className="text-xs text-slate-500 mt-0.5">(Adequate ÷ Required) × 100</div>
        </div>

        <div className="bg-white rounded-xl border-l-4 border-l-rose-500 border-slate-200 border p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Net Insurance Gap</div>
          <div className="text-lg font-bold text-rose-600 mt-1">
            {formatCurrency(summary.totalInsuranceGap)}
          </div>
          <div className="text-xs text-rose-500 mt-0.5">Uncovered collateral risk</div>
        </div>

        <div className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow ${summary.expiredPoliciesCount > 0 ? 'border-l-4 border-l-rose-500 border-slate-200' : 'border-slate-200'}`}>
          <div className={`text-[11px] font-bold uppercase tracking-wider ${summary.expiredPoliciesCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Expired Policies</div>
          <div className={`text-lg font-bold mt-1 ${summary.expiredPoliciesCount > 0 ? 'text-rose-600' : 'text-[#00205B]'}`}>
            {summary.expiredPoliciesCount}
          </div>
          <div className="text-xs text-rose-500 mt-0.5">Overdue policies</div>
        </div>
      </div>

      {/* Senior Management Operational Table (§6 Required management table) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-bold text-[#00205B]">
            Branch &amp; District Comparative Risk Table (§6)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparative exposure, collateral security, insurance required, and compliance rates across branches
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[#00205B]">
                <th className="px-4 py-3 font-bold">Branch / Corporate Center</th>
                <th className="px-4 py-3 text-right font-bold">Collateral Value</th>
                <th className="px-4 py-3 text-right font-bold">Required Insurance</th>
                <th className="px-4 py-3 text-right font-bold">Active Cover</th>
                <th className="px-4 py-3 text-right font-bold">Insurance Gap</th>
                <th className="px-4 py-3 text-center font-bold">Coverage %</th>
                <th className="px-4 py-3 text-center font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(charts.branchRanking || []).map((b, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  onClick={() => onNavigate('collateral', { branch: b.branch })}
                >
                  <td className="px-4 py-3 font-semibold text-[#00205B]">
                    {b.branch}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {formatCurrency(b.collateralValue)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {formatCurrency(b.insuranceRequired)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                    {formatCurrency(b.insuredAmount)}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${b.insuranceGap > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(b.insuranceGap)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        b.compliancePct >= 100
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : b.compliancePct > 0
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {b.compliancePct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('collateral', { branch: b.branch });
                      }}
                      className="bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-2.5 py-1 text-[11px] font-semibold text-[#00205B] transition-colors"
                    >
                      Drill-down
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
        title="Bank-Wide Scoped Portfolio Roster"
        subtitle="Individual accounts and linked collaterals"
      />
    </div>
  );
};

const kpiCardStyle: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  border: '1px solid #DCE4EE',
  padding: '14px 16px',
  boxShadow: '0 1px 4px rgba(14, 40, 78, 0.04)',
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};
