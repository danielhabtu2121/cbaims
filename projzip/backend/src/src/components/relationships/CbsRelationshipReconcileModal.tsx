import React, { useEffect, useState } from 'react';
import { cimsApi } from '../../api/cimsApi';
import { CbsRelationshipReconciliationDto, CbsRelationshipReconciliationItem } from '../../types';

interface CbsRelationshipReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CbsRelationshipReconcileModal: React.FC<CbsRelationshipReconcileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<CbsRelationshipReconciliationDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'MATCHING' | 'CBS_ONLY' | 'CIMS_ONLY' | 'CHANGED_IN_CBS' | 'INCONSISTENT'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadReconciliation = () => {
    setLoading(true);
    setError(null);
    cimsApi
      .reconcileCbsRelationships()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to reconcile CBS relationships.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      loadReconciliation();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const items = data?.items || [];
  const filteredItems = items.filter((item) => {
    if (filter !== 'ALL' && item.status !== filter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchCol = item.collateralId?.toLowerCase().includes(term);
      const matchLoan = item.loanAccountId?.toLowerCase().includes(term);
      const matchLink = item.linkId?.toLowerCase().includes(term);
      const matchSummary = item.differenceSummary?.toLowerCase().includes(term);
      return matchCol || matchLoan || matchLink || matchSummary;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'MATCHING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            ✓ Matching
          </span>
        );
      case 'CBS_ONLY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800">
            CBS Only
          </span>
        );
      case 'CIMS_ONLY':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800">
            CIMS Native
          </span>
        );
      case 'CHANGED_IN_CBS':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
            ⚠ Diff in CBS
          </span>
        );
      case 'INCONSISTENT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
            ✕ Inconsistent
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center text-lg font-bold border border-purple-200 dark:border-purple-800">
              🔄
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                CBS vs CIMS Relationship Reconciliation Engine
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                  CLTB_ACC_COLL_LINK_DTLS
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reconciliation layer between Core Banking System link records and CIMS relationship masters (Section 28 & 29)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadReconciliation}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              🔄 Refresh
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        {data && (
          <div className="px-6 py-4 bg-slate-50/40 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total CBS Links</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{data.totalCbsRelationships}</div>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total CIMS Links</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{data.totalCimsRelationships}</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 shadow-sm">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Matching</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{data.matchingCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/40 shadow-sm">
              <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">CBS Only</div>
              <div className="text-xl font-bold text-sky-700 dark:text-sky-400 mt-1">{data.cbsOnlyCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 shadow-sm">
              <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">CIMS Only (Native)</div>
              <div className="text-xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">{data.cimsOnlyCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 shadow-sm">
              <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Changed / Diffs</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{data.changedCount + data.inconsistentCount}</div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['ALL', 'MATCHING', 'CBS_ONLY', 'CIMS_ONLY', 'CHANGED_IN_CBS', 'INCONSISTENT'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  filter === tab
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-72">
            <input
              type="text"
              placeholder="Search by ID, Collateral, Loan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Reconciling CBS and CIMS records...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && filteredItems.length === 0 && (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400 text-sm">
              No reconciliation items matching the current filter criteria.
            </div>
          )}

          {!loading && !error && filteredItems.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                    <th className="py-3 px-3">Reconciliation Status</th>
                    <th className="py-3 px-3">Link ID</th>
                    <th className="py-3 px-3">Collateral ID</th>
                    <th className="py-3 px-3">Loan Account ID</th>
                    <th className="py-3 px-3 text-right">CBS Linked Amount</th>
                    <th className="py-3 px-3 text-right">CIMS Allocated Amount</th>
                    <th className="py-3 px-3">Linkage Type (CBS / CIMS)</th>
                    <th className="py-3 px-3">Reconciliation Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredItems.map((item, idx) => (
                    <tr
                      key={item.linkId || `${item.collateralId}-${item.loanAccountId}-${idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {item.linkId || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {item.collateralId}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {item.loanAccountId}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {item.cbsLinkedAmount > 0
                          ? `ETB ${Number(item.cbsLinkedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                        {item.cimsAllocatedAmount > 0
                          ? `ETB ${Number(item.cimsAllocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        <span className="text-slate-500">{item.cbsLinkageType || '—'}</span> /{' '}
                        <span className="font-medium text-slate-800 dark:text-slate-200">{item.cimsLinkageType || '—'}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={item.differenceSummary}>
                        {item.differenceSummary || 'Matched successfully'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {data?.reconciliationTimestamp && `Last reconciled at: ${new Date(data.reconciliationTimestamp).toLocaleString()}`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
