import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from 'lucide-react';
import { DashboardSnapshot, DashboardSummary } from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface PortfolioTimelinePoint {
  monthKey: string;
  month: string;
  monthLabel: string;
  isHistorical: boolean;
  isCurrent: boolean;
  isProjected: boolean;
  activeExposure: number;
  activeProtection: number;
  insuranceRequired: number;
  protectionGap: number;
  coveragePct: number;
  policiesIncepted: number;
  inceptedAmount: number;
  policiesExpiring: number;
  expiringAmount: number;
  netProtectionFlow: number;
}

interface EnterprisePortfolioAnalyticsProps {
  portfolioTimeline?: PortfolioTimelinePoint[];
  summary?: DashboardSummary;
  scopeLevel?: string;
  scopeId?: string;
  userId?: string;
  className?: string;
}

export const EnterprisePortfolioAnalytics: React.FC<EnterprisePortfolioAnalyticsProps> = ({
  portfolioTimeline = [],
  summary,
  scopeLevel = 'BANK',
  scopeId = 'ALL',
  userId,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'RUNOFF' | 'SNAPSHOTS'>('TIMELINE');
  const [timelineView, setTimelineView] = useState<'AREAS' | 'VELOCITY' | 'COVERAGE'>('AREAS');

  // Snapshots tab state
  const [snapshots, setSnapshots] = useState<DashboardSnapshot[]>([]);
  const [hasSufficientSnapshots, setHasSufficientSnapshots] = useState<boolean>(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string>('');
  const [deltas, setDeltas] = useState<any>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await cimsApi.getDashboardSnapshots(scopeLevel, scopeId);
      setSnapshots(res.snapshots || []);
      setHasSufficientSnapshots(res.hasSufficientData);
      setSnapshotMessage(res.message);
      setDeltas(res.periodOverPeriodDeltas || null);
    } catch (err: any) {
      console.error('Failed to load dashboard snapshots:', err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'SNAPSHOTS') {
      fetchSnapshots();
    }
  }, [activeTab, scopeLevel, scopeId]);

  const handleCaptureSnapshot = async () => {
    setIsCapturing(true);
    setCaptureFeedback(null);
    try {
      await cimsApi.captureDashboardSnapshot(scopeLevel, scopeId, userId);
      setCaptureFeedback('Snapshot captured successfully.');
      await fetchSnapshots();
      setTimeout(() => setCaptureFeedback(null), 4000);
    } catch (err: any) {
      console.error('Failed to capture snapshot:', err);
      setCaptureFeedback(err?.message || 'Failed to capture snapshot');
    } finally {
      setIsCapturing(false);
    }
  };

  // Timeline KPIs
  const currentMonthPoint = portfolioTimeline.find((p) => p.isCurrent) || portfolioTimeline[portfolioTimeline.length - 1];
  const activeExposureM = currentMonthPoint ? Number((currentMonthPoint.activeExposure / 1e6).toFixed(2)) : 0;
  const activeProtectionM = currentMonthPoint ? Number((currentMonthPoint.activeProtection / 1e6).toFixed(2)) : 0;
  const protectionGapM = currentMonthPoint ? Number((currentMonthPoint.protectionGap / 1e6).toFixed(2)) : 0;
  const coveragePct = currentMonthPoint ? currentMonthPoint.coveragePct : 0;
  const netFlowM = currentMonthPoint ? Number((currentMonthPoint.netProtectionFlow / 1e6).toFixed(2)) : 0;

  // Forward Runoff Points (current and projected)
  const forwardRunoffData = portfolioTimeline.filter((p) => p.isCurrent || p.isProjected);

  // Snapshot chart points
  const snapshotChartData = snapshots.map((s) => ({
    date: s.snapshotDate,
    exposureM: Number(((s.totalExposure ?? 0) / 1e6).toFixed(2)),
    activeCoverM: Number(((s.activeInsurance ?? 0) / 1e6).toFixed(2)),
    gapM: Number(((s.insuranceGap ?? 0) / 1e6).toFixed(2)),
    coveragePct: Number((s.coveragePercentage ?? 0).toFixed(1)),
    uninsuredCount: s.uninsuredCollateralsCount ?? 0,
    underinsuredCount: s.underinsuredCollateralsCount ?? 0,
  }));

  return (
    <div className={`bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden ${className}`}>
      {/* Header & Mode Switcher */}
      <div className="p-5 border-b border-slate-100 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-[#1F4E7A] to-[#2C6295] text-white rounded-xl shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-[#101828]">
                  Longitudinal Portfolio Analytics & Protection Velocity
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1F4E7A] border border-blue-200">
                  {scopeLevel}: {scopeId}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Continuous Transaction Grounding
                </span>
              </div>
              <p className="text-xs text-[#5B6472] mt-0.5">
                Dynamic 12-month inflow/outflow trajectory, forward maturity runoff scheduling, and audited regulatory snapshots.
              </p>
            </div>
          </div>

          {/* Action button if on snapshots tab */}
          {activeTab === 'SNAPSHOTS' && (
            <div className="flex items-center gap-2">
              {captureFeedback && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                  {captureFeedback}
                </span>
              )}
              <button
                onClick={handleCaptureSnapshot}
                disabled={isCapturing}
                className="px-3.5 py-1.5 bg-[#1F4E7A] hover:bg-[#163857] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
              >
                <Camera className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
                <span>{isCapturing ? 'Capturing...' : 'Capture Snapshot'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Top 3 Navigation Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('TIMELINE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'TIMELINE'
                  ? 'bg-[#1F4E7A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Dynamic Portfolio Evolution (12-Month Trajectory)</span>
            </button>
            <button
              onClick={() => setActiveTab('RUNOFF')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'RUNOFF'
                  ? 'bg-[#1F4E7A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Maturing Policy & Risk Runoff Schedule</span>
            </button>
            <button
              onClick={() => setActiveTab('SNAPSHOTS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'SNAPSHOTS'
                  ? 'bg-[#1F4E7A] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audited Regulatory Snapshots</span>
            </button>
          </div>

          {activeTab === 'TIMELINE' && (
            <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg">
              <button
                onClick={() => setTimelineView('AREAS')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  timelineView === 'AREAS' ? 'bg-white text-[#1F4E7A] shadow-xs' : 'text-slate-600'
                }`}
              >
                Exposure vs Cover
              </button>
              <button
                onClick={() => setTimelineView('VELOCITY')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  timelineView === 'VELOCITY' ? 'bg-white text-[#1F4E7A] shadow-xs' : 'text-slate-600'
                }`}
              >
                Inflow vs Runoff
              </button>
              <button
                onClick={() => setTimelineView('COVERAGE')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  timelineView === 'COVERAGE' ? 'bg-white text-[#1F4E7A] shadow-xs' : 'text-slate-600'
                }`}
              >
                Coverage % Trend
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: DYNAMIC PORTFOLIO EVOLUTION */}
      {activeTab === 'TIMELINE' && (
        <div className="p-5 space-y-6">
          {/* Headline Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Exposure</div>
              <div className="text-lg font-black text-[#101828] mt-1 font-mono">
                ETB {activeExposureM.toLocaleString()}M
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Disbursed Facility Balances</div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Active Protection</div>
              <div className="text-lg font-black text-emerald-700 mt-1 font-mono">
                ETB {activeProtectionM.toLocaleString()}M
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">Valid Unexpired Cover</div>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider">Net Insurance Gap</div>
              <div className="text-lg font-black text-rose-700 mt-1 font-mono">
                ETB {protectionGapM.toLocaleString()}M
              </div>
              <div className="text-[10px] text-rose-600 mt-0.5">Required Cover Deficit</div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5">
              <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Portfolio Coverage</div>
              <div className="text-lg font-black text-blue-700 mt-1 font-mono">
                {coveragePct}%
              </div>
              <div className="text-[10px] text-blue-600 mt-0.5">Target Compliance: 95.0%</div>
            </div>

            <div className={`border rounded-xl p-3.5 col-span-2 lg:col-span-1 ${
              netFlowM >= 0 ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' : 'bg-amber-50/60 border-amber-200 text-amber-900'
            }`}>
              <div className="text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Net Flow Velocity</span>
                {netFlowM >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDownRight className="w-3.5 h-3.5 text-amber-600" />}
              </div>
              <div className="text-lg font-black mt-1 font-mono">
                {netFlowM >= 0 ? `+ETB ${netFlowM}M` : `-ETB ${Math.abs(netFlowM)}M`}
              </div>
              <div className="text-[10px] mt-0.5 opacity-80">
                Inceptions minus Runoff this month
              </div>
            </div>
          </div>

          {/* Primary Visualization */}
          {portfolioTimeline.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading portfolio timeline...</div>
          ) : timelineView === 'AREAS' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">12-Month Longitudinal Trajectory (Exposure vs Required Cover vs Active Protection)</span>
                <span>ETB Millions</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolioTimeline} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1F4E7A" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#1F4E7A" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="protGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip
                      formatter={((value: any, name: any) => [`ETB ${(Number(value) / 1e6).toFixed(2)}M`, name]) as any}
                      labelFormatter={(label, payload) => {
                        const point = payload?.[0]?.payload;
                        const status = point?.isCurrent ? ' (Current Active Month)' : point?.isProjected ? ' (Projected Horizon)' : ' (Historical Baseline)';
                        return `${label}${status}`;
                      }}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area type="monotone" dataKey="activeExposure" name="Outstanding Loan Exposure" stroke="#1F4E7A" strokeWidth={2} fillOpacity={1} fill="url(#expGrad)" />
                    <Area type="monotone" dataKey="insuranceRequired" name="Required Insurance" stroke="#D97706" strokeWidth={2} strokeDasharray="4 4" fill="none" />
                    <Area type="monotone" dataKey="activeProtection" name="Valid Active Insurance" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#protGrad)" />
                    <Area type="monotone" dataKey="protectionGap" name="Insurance Coverage Gap" stroke="#DC2626" strokeWidth={1.5} fillOpacity={1} fill="url(#gapGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : timelineView === 'VELOCITY' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Monthly Protection Flow Dynamics (New Inceptions vs Expirations)</span>
                <span>ETB Millions</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={portfolioTimeline} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                    <Tooltip
                      formatter={((value: any, name: any) => [`ETB ${(Number(value) / 1e6).toFixed(2)}M`, name]) as any}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="inceptedAmount" name="New Cover Inceptions" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expiringAmount" name="Maturing Policy Runoff" fill="#EA580C" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="netProtectionFlow" name="Net Protection Flow" stroke="#2563EB" strokeWidth={2} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Insurance Coverage % Trajectory</span>
                <span>Documented Adequacy Rule: {summary?.minimumCoverageAdequacyPct ?? 100.0}%</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={portfolioTimeline} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis domain={[50, 105]} stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={((value: any) => [`${value}%`, 'Coverage Compliance']) as any}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <ReferenceLine y={summary?.minimumCoverageAdequacyPct ?? 100.0} stroke="#059669" strokeDasharray="3 3" label={{ value: `Rule: ${summary?.minimumCoverageAdequacyPct ?? 100.0}%`, position: 'top', fill: '#059669', fontSize: 10 }} />
                    <Line type="monotone" dataKey="coveragePct" name="Coverage %" stroke="#1F4E7A" strokeWidth={3} dot={{ r: 4, fill: '#1F4E7A' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Monthly Velocity Breakdown Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="p-3">Period</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Exposure</th>
                  <th className="p-3 text-right">Required</th>
                  <th className="p-3 text-right">Active Cover</th>
                  <th className="p-3 text-right">Coverage Gap</th>
                  <th className="p-3 text-right">Coverage %</th>
                  <th className="p-3 text-center">New Inceptions</th>
                  <th className="p-3 text-center">Expirations</th>
                  <th className="p-3 text-right">Net Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {portfolioTimeline.map((row, idx) => (
                  <tr key={idx} className={`hover:bg-slate-50 transition-colors ${row.isCurrent ? 'bg-blue-50/50 font-semibold' : ''}`}>
                    <td className="p-3 font-bold text-slate-900">{row.month}</td>
                    <td className="p-3">
                      {row.isCurrent ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                          Current Month
                        </span>
                      ) : row.isProjected ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Projected Runoff
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          Historical
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono">ETB {((row.activeExposure ?? 0) / 1e6).toFixed(1)}M</td>
                    <td className="p-3 text-right font-mono">ETB {((row.insuranceRequired ?? 0) / 1e6).toFixed(1)}M</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">ETB {((row.activeProtection ?? 0) / 1e6).toFixed(1)}M</td>
                    <td className="p-3 text-right font-mono font-bold text-rose-700">ETB {((row.protectionGap ?? 0) / 1e6).toFixed(1)}M</td>
                    <td className="p-3 text-right font-bold">
                      <span className={row.coveragePct >= 90 ? 'text-emerald-700' : row.coveragePct >= 75 ? 'text-amber-700' : 'text-rose-700'}>
                        {row.coveragePct}%
                      </span>
                    </td>
                    <td className="p-3 text-center text-emerald-700 font-semibold">
                      {row.policiesIncepted > 0 ? `+${row.policiesIncepted} (ETB ${((row.inceptedAmount ?? 0) / 1e6).toFixed(1)}M)` : '—'}
                    </td>
                    <td className="p-3 text-center text-amber-700 font-semibold">
                      {row.policiesExpiring > 0 ? `-${row.policiesExpiring} (ETB ${((row.expiringAmount ?? 0) / 1e6).toFixed(1)}M)` : '—'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={row.netProtectionFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        {row.netProtectionFlow >= 0 ? `+ETB ${((row.netProtectionFlow ?? 0) / 1e6).toFixed(1)}M` : `-ETB ${((Math.abs(row.netProtectionFlow ?? 0)) / 1e6).toFixed(1)}M`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MATURING POLICY RUNOFF SCHEDULE */}
      {activeTab === 'RUNOFF' && (
        <div className="p-5 space-y-6">
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">Forward Maturing Policy & Risk Exposure Runoff Schedule</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Projected insurance expirations across the forward 6-month horizon. Without proactive renewal endorsements,
                maturing policies create immediate credit risk exposures and unhedged collateral assets.
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forwardRunoffData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <Tooltip
                  formatter={((value: any) => [`ETB ${(Number(value) / 1e6).toFixed(2)}M`, 'Expiring Sum Insured']) as any}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="expiringAmount" name="Maturing Coverage at Risk (ETB)" fill="#EA580C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {forwardRunoffData.map((f, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{f.month}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    f.policiesExpiring > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {f.policiesExpiring} Expiring Policies
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Maturing Coverage:</span>
                  <span className="font-bold font-mono text-slate-900">ETB {((f.expiringAmount ?? 0) / 1e6).toFixed(1)}M</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Projected Coverage Deficit:</span>
                  <span className="font-bold font-mono text-rose-700">ETB {((f.protectionGap ?? 0) / 1e6).toFixed(1)}M</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: AUDITED REGULATORY SNAPSHOTS */}
      {activeTab === 'SNAPSHOTS' && (
        <div className="p-5 space-y-6">
          {loadingSnapshots ? (
            <div className="p-12 text-center space-y-2">
              <RefreshCw className="w-6 h-6 text-[#1F4E7A] animate-spin mx-auto" />
              <div className="text-xs font-bold text-slate-700">Loading audited regulatory snapshots...</div>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No snapshot data returned. Click &quot;Capture Snapshot&quot; to initialize baseline.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Period over period deltas */}
              {deltas && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Exposure Delta (Last Period)</div>
                    <div className="text-base font-black text-slate-900 mt-1 font-mono">
                      {deltas.exposureDelta >= 0 ? `+ETB ${(deltas.exposureDelta / 1e6).toFixed(2)}M` : `-ETB ${(Math.abs(deltas.exposureDelta) / 1e6).toFixed(2)}M`}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Insurance Gap Delta</div>
                    <div className={`text-base font-black mt-1 font-mono ${deltas.insuranceGapDelta <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {deltas.insuranceGapDelta <= 0 ? `-ETB ${(Math.abs(deltas.insuranceGapDelta) / 1e6).toFixed(2)}M (Improved)` : `+ETB ${(deltas.insuranceGapDelta / 1e6).toFixed(2)}M (Increased Risk)`}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Coverage % Shift</div>
                    <div className={`text-base font-black mt-1 font-mono ${deltas.coveragePctDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {deltas.coveragePctDelta >= 0 ? `+${deltas.coveragePctDelta.toFixed(1)}%` : `${deltas.coveragePctDelta.toFixed(1)}%`}
                    </div>
                  </div>
                </div>
              )}

              {/* Snapshot Timeline Chart */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snapshotChartData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}M`} />
                    <Tooltip
                      formatter={((value: any, name: any) => [`ETB ${Number(value).toFixed(2)}M`, name]) as any}
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area type="monotone" dataKey="exposureM" name="Total Exposure (M)" stroke="#1F4E7A" fill="#1F4E7A" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="activeCoverM" name="Active Insurance (M)" stroke="#059669" fill="#059669" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="gapM" name="Insurance Gap (M)" stroke="#DC2626" fill="#DC2626" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Snapshots Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="p-3">Snapshot Date</th>
                      <th className="p-3 text-right">Exposure</th>
                      <th className="p-3 text-right">Collateral Value</th>
                      <th className="p-3 text-right">Required Cover</th>
                      <th className="p-3 text-right">Active Cover</th>
                      <th className="p-3 text-right">Gap</th>
                      <th className="p-3 text-right">Coverage %</th>
                      <th className="p-3 text-center">Uninsured</th>
                      <th className="p-3 text-center">Underinsured</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshots.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-900 font-mono">{s.snapshotDate}</td>
                        <td className="p-3 text-right font-mono">ETB {((s.totalExposure ?? 0) / 1e6).toFixed(1)}M</td>
                        <td className="p-3 text-right font-mono">ETB {((s.collateralValue ?? 0) / 1e6).toFixed(1)}M</td>
                        <td className="p-3 text-right font-mono">ETB {((s.requiredInsurance ?? 0) / 1e6).toFixed(1)}M</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">ETB {((s.activeInsurance ?? 0) / 1e6).toFixed(1)}M</td>
                        <td className="p-3 text-right font-mono font-bold text-rose-700">ETB {((s.insuranceGap ?? 0) / 1e6).toFixed(1)}M</td>
                        <td className="p-3 text-right font-bold text-slate-900">{s.coveragePercentage}%</td>
                        <td className="p-3 text-center text-rose-700 font-bold">{s.uninsuredCollateralsCount ?? 0}</td>
                        <td className="p-3 text-center text-amber-700 font-bold">{s.underinsuredCollateralsCount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
