import React, { useEffect, useState } from 'react';
import { cimsApi } from '../../api/cimsApi';
import { LoanCollateralLinkHistoryDto } from '../../types';

interface RelationshipHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkId: string;
  loanReference?: string;
  collateralCode?: string;
}

export const RelationshipHistoryModal: React.FC<RelationshipHistoryModalProps> = ({
  isOpen,
  onClose,
  linkId,
  loanReference,
  collateralCode,
}) => {
  const [history, setHistory] = useState<LoanCollateralLinkHistoryDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !linkId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    cimsApi
      .getCollateralFacilityLinkHistory(linkId)
      .then((data) => {
        if (isMounted) {
          setHistory(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load relationship history.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, linkId]);

  if (!isOpen) return null;

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
      case 'ALLOCATION_CHANGED':
      case 'UPDATED':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
      case 'ENDED':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
      case 'CBS_SYNC':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-lg font-bold border border-indigo-200 dark:border-indigo-800">
              📜
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Relationship Audit & Version History
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {linkId}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authoritative audit record of allocation adjustments, linkage classification, and lifecycle events
                {collateralCode && ` • Collateral: ${collateralCode}`}
                {loanReference && ` • Facility Ref: ${loanReference}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading relationship audit trail...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
              No historical revision records found for this relationship link.
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="relative border-l-2 border-indigo-100 dark:border-indigo-950/60 ml-4 pl-6 space-y-6">
              {history.map((record, idx) => (
                <div key={record.id || idx} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500 group-hover:scale-125 transition-transform" />

                  <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:shadow-md transition-shadow space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${getActionBadgeColor(
                            record.actionType
                          )}`}
                        >
                          {record.actionType}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {record.makerDtStamp ? new Date(record.makerDtStamp).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                        <span>
                          Maker: <strong className="text-slate-700 dark:text-slate-300">{record.makerId || 'System'}</strong>
                        </span>
                        {record.checkerId && (
                          <span>
                            Checker: <strong className="text-slate-700 dark:text-slate-300">{record.checkerId}</strong>
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                          Auth: {record.authStat || 'A'}
                        </span>
                      </div>
                    </div>

                    {/* Change Diff Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-slate-500 dark:text-slate-400 font-medium mb-1">Allocated Amount</div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 line-through">
                            ETB {Number(record.previousAllocatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            ETB {Number(record.newAllocatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-slate-500 dark:text-slate-400 font-medium mb-1">Linkage Classification</div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{record.previousLinkageType || 'None'}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-bold text-slate-900 dark:text-white">{record.newLinkageType || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                        <div className="text-slate-500 dark:text-slate-400 font-medium mb-1">Status Lifecycle</div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{record.previousStatus || 'N/A'}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-bold text-slate-900 dark:text-white">{record.newStatus || 'Active'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Reason / Remarks */}
                    {record.changeReason && (
                      <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                        <span className="font-semibold text-amber-800 dark:text-amber-300">Justification / Reason: </span>
                        <span className="text-amber-900 dark:text-amber-200">{record.changeReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
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
