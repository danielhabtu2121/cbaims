import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Camera,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  CheckCircle2,
  RefreshCw,
  BarChart2,
} from 'lucide-react';
import { DashboardSnapshot } from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface HistoricalSnapshotTrendProps {
  scopeLevel?: string;
  scopeId?: string;
  userId?: string;
  className?: string;
}

export const HistoricalSnapshotTrend: React.FC<HistoricalSnapshotTrendProps> = ({
  scopeLevel = 'BANK',
  scopeId = 'ALL',
  userId,
  className = '',
}) => {
  const [snapshots, setSnapshots] = useState<DashboardSnapshot[]>([]);
  const [hasSufficientData, setHasSufficientData] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [deltas, setDeltas] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [metricView, setMetricView] = useState<'EXPOSURE_COVER' | 'GAP' | 'COVERAGE_PCT'>('EXPOSURE_COVER');
  const [captureFeedback, setCaptureFeedback] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    setIsLoading(true);
    try {
      const res = await cimsApi.getDashboardSnapshots(scopeLevel, scopeId);
      setSnapshots(res.snapshots || []);
      setHasSufficientData(res.hasSufficientData);
      setMessage(res.message);
      setDeltas(res.periodOverPeriodDeltas || null);
    } catch (err: any) {
      console.error('Failed to load dashboard snapshots:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [scopeLevel, scopeId]);

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

  const formatChartData = snapshots.map((s) => ({
    date: s.snapshotDate,
    exposureM: Number(((s.totalExposure ?? 0) / 1e6).toFixed(2)),
    activeCoverM: Number(((s.activeInsurance ?? 0) / 1e6).toFixed(2)),
    gapM: Number(((s.insuranceGap ?? 0) / 1e6).toFixed(2)),
    requiredM: Number(((s.requiredInsurance ?? 0) / 1e6).toFixed(2)),
    coveragePct: Number((s.coveragePercentage ?? 0).toFixed(1)),
    uninsuredCount: s.uninsuredCollateralsCount ?? 0,
    underinsuredCount: s.underinsuredCollateralsCount ?? 0,
  }));

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm text-slate-900">
                Longitudinal Portfolio Trend (Genuine Point-in-Time Snapshots)
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                {scopeLevel}: {scopeId}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Deterministic historical tracking. Trend rendering strictly requires $\ge 2$ real snapshots (no simulated data).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {captureFeedback && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              {captureFeedback}
            </span>
          )}
          <button
            onClick={handleCaptureSnapshot}
            disabled={isCapturing}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Capture current portfolio state as an official point-in-time snapshot"
          >
            <Camera className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
            <span>{isCapturing ? 'Capturing...' : 'Capture Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="p-8 text-center space-y-2">
          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
          <div className="text-xs font-bold text-slate-700">Loading historical snapshots...</div>
        </div>
      ) : !hasSufficientData || snapshots.length < 2 ? (
        /* Honest < 2 Snapshots Empty State */
        <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">
              Insufficient Point-in-Time History ({snapshots.length} of 2 required)
            </div>
            <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1">
              {message ||
                'In accordance with CIMS banking governance, historical trend lines require at least 2 distinct point-in-time records. No simulated or artificial trends are rendered.'}
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleCaptureSnapshot}
              disabled={isCapturing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-2 shadow-xs transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Capture Point-in-Time Snapshot Now</span>
            </button>
          </div>
        </div>
      ) : (
        /* Slices when >= 2 snapshots exist */
        <div className="space-y-4">
          {/* Metric Selector & Delta Badges */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMetricView('EXPOSURE_COVER')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  metricView === 'EXPOSURE_COVER'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Exposure vs Active Cover
              </button>
              <button
                onClick={() => setMetricView('GAP')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  metricView === 'GAP'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Protection Deficit (Gap)
              </button>
              <button
                onClick={() => setMetricView('COVERAGE_PCT')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  metricView === 'COVERAGE_PCT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Coverage % Trend
              </button>
            </div>

            {deltas && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 font-medium">Period Delta:</span>
                <span className={`font-bold flex items-center gap-1 ${
                  (deltas.exposureDelta ?? 0) > 0 ? 'text-blue-700' : 'text-slate-700'
                }`}>
                  Exposure: ETB {((deltas.exposureDelta ?? 0) / 1e6).toFixed(1)}M
                </span>
                <span className={`font-bold flex items-center gap-1 ${
                  (deltas.gapDelta ?? 0) <= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {(deltas.gapDelta ?? 0) <= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  Gap: ETB {((deltas.gapDelta ?? 0) / 1e6).toFixed(1)}M
                </span>
                <span className={`font-bold flex items-center gap-1 ${
                  (deltas.coveragePctDelta ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  Cover: {deltas.coveragePctDelta > 0 ? `+${deltas.coveragePctDelta}%` : `${deltas.coveragePctDelta}%`}
                </span>
              </div>
            )}
          </div>

          {/* Recharts Trend Area */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {metricView === 'EXPOSURE_COVER' ? (
                <AreaChart data={formatChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorExposure" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e40af" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCover" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={((val: any, name: any) => [
                      `ETB ${Number(val).toLocaleString()}M`,
                      name === 'exposureM' ? 'Outstanding Exposure' : 'Active Insurance',
                    ]) as any}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="exposureM"
                    name="Outstanding Exposure"
                    stroke="#1e40af"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorExposure)"
                  />
                  <Area
                    type="monotone"
                    dataKey="activeCoverM"
                    name="Active Insurance"
                    stroke="#059669"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCover)"
                  />
                </AreaChart>
              ) : metricView === 'GAP' ? (
                <AreaChart data={formatChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={((val: any) => [`ETB ${Number(val).toLocaleString()}M`, 'Protection Deficit (Gap)']) as any}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    type="monotone"
                    dataKey="gapM"
                    name="Insurance Protection Deficit"
                    stroke="#dc2626"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorGap)"
                  />
                </AreaChart>
              ) : (
                <LineChart data={formatChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 'auto']} />
                  <Tooltip
                    formatter={((val: any) => [`${val}%`, 'Insurance Coverage %']) as any}
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="coveragePct"
                    name="Coverage %"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
