import React from 'react';
import { RefreshCw, Calendar, Clock, Database, ShieldCheck, MapPin, Building2, CheckCircle2, AlertCircle } from 'lucide-react';

interface EnterpriseScopeHeaderProps {
  scopeLevel: string;
  displayScope: string;
  authorizedRole: string;
  asOfDate?: string;
  lastRefresh?: string;
  cbsSyncStatus?: string;
  cbsLastSyncedAt?: string;
  authorizedBranchesCount?: number;
  scopedBranchesCount?: number;
  totalBranchesCount?: number;
  scopeBoundaryDescription?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const EnterpriseScopeHeader: React.FC<EnterpriseScopeHeaderProps> = ({
  scopeLevel,
  displayScope,
  authorizedRole,
  asOfDate,
  lastRefresh,
  cbsSyncStatus = 'Synced',
  cbsLastSyncedAt,
  authorizedBranchesCount,
  scopedBranchesCount,
  totalBranchesCount,
  scopeBoundaryDescription,
  onRefresh,
  isLoading = false,
}) => {
  const isCbsSynced = cbsSyncStatus?.toLowerCase() === 'synced';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 text-slate-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Scope identification & Level badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-[#EFF5FB] text-[#1F4E7A] border border-[#B9D3EB]">
              {scopeLevel || 'BANK_WIDE'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Role: {authorizedRole || 'Executive'}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <div className="flex items-center gap-1 text-slate-600 text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <strong className="text-slate-900">{displayScope || 'Bank-Wide Overview'}</strong>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {scopeBoundaryDescription || (
              scopedBranchesCount !== undefined
                ? `Authorized scope boundary: ${scopedBranchesCount} scoped ${scopedBranchesCount === 1 ? 'branch' : 'branches'}${authorizedBranchesCount ? ` of ${authorizedBranchesCount} permitted` : ''}${totalBranchesCount ? ` (${totalBranchesCount} total bank branches)` : ''}`
                : 'Full Bank-Wide aggregated portfolio intelligence across all business segments and operating districts.'
            )}
          </div>
        </div>

        {/* Right: 3-Timestamp strip, CBS Freshness, and Refresh Action */}
        <div className="flex items-center gap-3 flex-wrap self-start md:self-auto text-xs">
          {/* CBS Data Freshness Indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold transition-all ${
              isCbsSynced
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={`CBS Feed Sync Status: ${cbsSyncStatus} ${cbsLastSyncedAt ? `(Last synced: ${cbsLastSyncedAt})` : ''}`}
          >
            <Database className="w-3.5 h-3.5" />
            <span className={`w-1.5 h-1.5 rounded-full ${isCbsSynced ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>
              {isCbsSynced ? 'CBS Current' : 'CBS Sync Pending'}
            </span>
            {cbsLastSyncedAt && (
              <span className="text-[10px] opacity-75 hidden sm:inline">
                ({cbsLastSyncedAt.split('T')[0] || cbsLastSyncedAt})
              </span>
            )}
          </div>

          {/* As of Date */}
          <div className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>As of: <strong className="text-slate-800">{asOfDate || new Date().toISOString().split('T')[0]}</strong></span>
          </div>

          {/* Last Refreshed */}
          <div className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Refreshed: <strong className="text-slate-800">{lastRefresh || new Date().toLocaleTimeString()}</strong></span>
          </div>

          {/* Manual Refresh Trigger */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1.5 text-slate-600 hover:text-[#2C6295] hover:bg-slate-100 border border-slate-200 rounded-lg transition-all shadow-xs"
              title="Refresh Scope Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#2C6295]' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
