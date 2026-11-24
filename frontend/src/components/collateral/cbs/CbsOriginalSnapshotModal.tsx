import { formatEtbNumber } from '../../../utils/format.ts';
import React, { useState, useEffect } from 'react';
import {
  Database,
  History,
  X,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Clock,
  ArrowRight,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { Collateral, CbsCollateralRawSnapshot, CbsCollateralProvenanceLog } from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface CbsOriginalSnapshotModalProps {
  collateral: Collateral;
  onClose: () => void;
}

export const CbsOriginalSnapshotModal: React.FC<CbsOriginalSnapshotModalProps> = ({
  collateral,
  onClose,
}) => {
  const [snapshot, setSnapshot] = useState<CbsCollateralRawSnapshot | null>(null);
  const [provenanceLogs, setProvenanceLogs] = useState<CbsCollateralProvenanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<'comparison' | 'json' | 'provenance'>('comparison');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const snap = await cimsApi.getCbsSnapshot(collateral.id);
        setSnapshot(snap);
        const prov = await cimsApi.getCollateralProvenance(collateral.id);
        setProvenanceLogs(prov || []);
      } catch (err) {
        console.error('Failed to load snapshot/provenance:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [collateral.id]);

  let parsedRaw: Record<string, any> = {};
  if (snapshot?.rawPayloadJson) {
    try {
      parsedRaw = JSON.parse(snapshot.rawPayloadJson);
    } catch (e) {
      parsedRaw = { raw: snapshot.rawPayloadJson };
    }
  }

  const comparisonRows = [
    { label: 'Collateral Code', cbs: parsedRaw.collateralCode || collateral.cbsCollateralRef, cbaims: collateral.code },
    { label: 'Customer CIF', cbs: parsedRaw.customerCif || collateral.customerId, cbaims: collateral.customerId },
    { label: 'Description', cbs: parsedRaw.description || '—', cbaims: collateral.description || '—' },
    { label: 'Category', cbs: parsedRaw.category || '—', cbaims: collateral.category || '—' },
    { label: 'Collateral Subtype', cbs: parsedRaw.collateralType || '—', cbaims: collateral.type || '—' },
    { label: 'Ownership Type', cbs: parsedRaw.ownershipType || '—', cbaims: collateral.ownerType || '—' },
    { label: 'Valuation Amount', cbs: parsedRaw.collateralValue ? `ETB ${formatEtbNumber(Number(parsedRaw.collateralValue))}` : '—', cbaims: `ETB ${formatEtbNumber(collateral.valuationAmount || 0)}` },
    { label: 'Haircut', cbs: parsedRaw.haircut ? `${parsedRaw.haircut}%` : '0%', cbaims: `${collateral.haircut || 0}%` },
    { label: 'Branch Code', cbs: parsedRaw.branch || '—', cbaims: collateral.branch || '—' },
    { label: 'Business Segment', cbs: parsedRaw.businessSegment || '—', cbaims: collateral.owningSegment || '—' },
    { label: 'GPS Coordinates', cbs: parsedRaw.gpsCoordinates || 'Not in CBS feed', cbaims: collateral.gpsCoordinates || 'Not captured' },
    { label: 'Title Deed Number', cbs: parsedRaw.titleDeedNumber || 'Not in CBS feed', cbaims: collateral.titleDeedNumber || 'Not captured' },
  ];

  return (
    <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-300" />
              <h3 className="text-sm font-bold">CBS Source Snapshot & Provenance Evidence</h3>
            </div>
            <p className="text-xs text-blue-100/80 mt-0.5">
              Original CBS Reference: <strong>{collateral.cbsCollateralRef || 'CBS-FEED'}</strong> | Origin:{' '}
              <span className="font-semibold text-white">CBS_IMPORTED</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Bar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveView('comparison')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors ${
                activeView === 'comparison'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Side-by-Side Comparison
            </button>
            <button
              onClick={() => setActiveView('provenance')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 ${
                activeView === 'provenance'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Provenance Audit Logs ({provenanceLogs.length})
            </button>
            <button
              onClick={() => setActiveView('json')}
              className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors flex items-center gap-1 ${
                activeView === 'json'
                  ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Raw Source JSON
            </button>
          </div>

          {snapshot && (
            <span className="text-[11px] text-slate-500 font-mono">
              Captured: {snapshot.createdAt}
            </span>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Loading immutable CBS snapshot...
            </div>
          ) : (
            <>
              {/* 1. Side-by-Side Comparison View */}
              {activeView === 'comparison' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Immutable Source Integrity (Section 5.1):</strong> The CBS original values on the left
                      are preserved forever as read-only historical source evidence. On the right is the current
                      operational CBAIMS record managed by Bank CROs and checker workflows.
                    </div>
                  </div>

                  <div className="overflow-hidden border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                          <th className="py-2.5 px-3 w-1/3">Field Name</th>
                          <th className="py-2.5 px-3 w-1/3 text-slate-600 bg-slate-50">Original CBS Value (Immutable)</th>
                          <th className="py-2.5 px-3 w-1/3 text-blue-900 bg-blue-50/50">CBAIMS Operational Value (Active)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparisonRows.map((row, idx) => {
                          const isDifferent = row.cbs !== row.cbaims;
                          return (
                            <tr key={idx} className={isDifferent ? 'bg-amber-50/30' : ''}>
                              <td className="py-2 px-3 font-medium text-slate-700">{row.label}</td>
                              <td className="py-2 px-3 font-mono text-slate-600 bg-slate-50/60">{row.cbs}</td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-900 bg-blue-50/20">
                                {row.cbaims}
                                {isDifferent && (
                                  <span className="ml-2 inline-flex items-center text-[10px] text-amber-700 font-normal">
                                    (Enriched)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 2. Provenance Audit Logs View */}
              {activeView === 'provenance' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-xs">Field-Level Modification Audit Trail</h4>
                  {provenanceLogs.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      No modifications have been recorded for this CBS record yet. Data matches original import.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {provenanceLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 font-mono">{log.fieldName}</span>
                            <span className="text-[11px] text-slate-500">{log.changedAt} by <strong>{log.changedBy}</strong></span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-1.5 bg-white rounded border border-slate-200">
                              <span className="text-slate-400 text-[10px] block">Previous Value:</span>
                              <span className="text-slate-700 font-mono">{log.previousCbaimsValue || '—'}</span>
                            </div>
                            <div className="p-1.5 bg-white rounded border border-blue-200 text-blue-900">
                              <span className="text-blue-500 text-[10px] block">New Value:</span>
                              <span className="font-semibold font-mono">{log.newCbaimsValue || '—'}</span>
                            </div>
                          </div>
                          {log.changeReason && (
                            <div className="text-[11px] text-slate-600">
                              <strong>Reason:</strong> {log.changeReason}
                            </div>
                          )}
                          {log.supportingDocRef && (
                            <div className="text-[11px] text-slate-500">
                              <strong>Doc Ref:</strong> {log.supportingDocRef}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Raw Source JSON View */}
              {activeView === 'json' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Raw Flexcube Source Payload</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(snapshot?.rawPayloadJson || '')}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs"
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-emerald-400 rounded-lg text-xs font-mono overflow-x-auto max-h-[500px]">
                    {JSON.stringify(parsedRaw, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

