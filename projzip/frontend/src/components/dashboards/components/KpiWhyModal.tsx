import React from 'react';
import { X, Calculator, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, Building, Layers } from 'lucide-react';
import { KpiExplanation } from '../../../types';

interface KpiWhyModalProps {
  isOpen: boolean;
  kpiKey: string | null;
  explanation: KpiExplanation | null;
  isLoading: boolean;
  onClose: () => void;
  onDrillToCollateral?: (colId: string) => void;
  onNavigate?: (screen: string, params?: any) => void;
}

export const KpiWhyModal: React.FC<KpiWhyModalProps> = ({
  isOpen,
  kpiKey,
  explanation,
  isLoading,
  onClose,
  onDrillToCollateral,
  onNavigate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-[#EFF5FB] text-[#2C6295] rounded-xl border border-[#DCE9F5]">
              <Calculator className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">
                  {explanation?.kpiTitle || kpiKey?.replace(/_/g, ' ') || 'Metric Breakdown'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCE9F5] text-[#173F63] border border-[#B9D3EB]">
                  Deterministic "Why?" Engine
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span>Scope: <strong className="text-slate-700">{explanation?.scope || 'Bank-Wide'}</strong></span>
                <span>•</span>
                <span>As of Date: <strong className="text-slate-700">{explanation?.asOfDate || new Date().toISOString().split('T')[0]}</strong></span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#2C6295] border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="font-bold text-slate-700">Evaluating Authoritative Portfolio Rules...</div>
              <div className="text-slate-400 text-[11px]">Aggregating live facilities, collateral valuations, and policy endorsements</div>
            </div>
          ) : !explanation ? (
            <div className="py-12 text-center text-slate-500">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p>Unable to retrieve explanatory decomposition for {kpiKey}.</p>
            </div>
          ) : (
            <>
              {/* Section 1: Exact Mathematical Formula & Definition */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  <span>Authoritative Calculation Formula</span>
                  <span className="text-slate-400 font-normal">CIMS Standard</span>
                </div>
                <div className="font-mono text-sm sm:text-base text-emerald-300 font-bold bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                  {explanation.formula}
                </div>
                <p className="text-slate-300 text-xs leading-relaxed pt-1">
                  {explanation.definition}
                </p>
              </div>

              {/* Section 2: Sub-unit Contributions Matrix */}
              {explanation.subUnitContributions && explanation.subUnitContributions.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#2C6295]" />
                      Sub-Unit Decomposition & Contribution Matrix
                    </h4>
                    <span className="text-[11px] text-slate-500">All figures in ETB</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                        <tr>
                          <th className="p-2.5">Segment / Sub-Unit</th>
                          <th className="p-2.5 text-center">Assets</th>
                          <th className="p-2.5 text-right">Exposure</th>
                          <th className="p-2.5 text-right">Required Cover</th>
                          <th className="p-2.5 text-right">Active Cover</th>
                          <th className="p-2.5 text-right">Deficit Gap</th>
                          <th className="p-2.5 text-right">Coverage %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {explanation.subUnitContributions.map((sub, idx) => {
                          const cov = sub.coveragePct ?? 0;
                          const covBadge =
                            cov >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : cov >= 75
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800';

                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                {sub.name}
                              </td>
                              <td className="p-2.5 text-center font-semibold text-slate-600">
                                {sub.collateralCount}
                              </td>
                              <td className="p-2.5 text-right text-slate-700">
                                {Number(sub.exposure ?? 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-semibold text-slate-900">
                                {Number(sub.insuranceRequired ?? 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right text-emerald-700 font-semibold">
                                {Number(sub.activeInsurance ?? 0).toLocaleString()}
                              </td>
                              <td className="p-2.5 text-right font-bold text-red-600">
                                {sub.gap > 0 ? Number(sub.gap).toLocaleString() : '—'}
                              </td>
                              <td className="p-2.5 text-right">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${covBadge}`}>
                                  {cov.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 3: Top 5 Risk Contributors */}
              {explanation.topRiskContributors && explanation.topRiskContributors.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      Top 5 Deficit Accounts & Risk Contributors
                    </h4>
                    <span className="text-[11px] text-slate-500">Highest individual protection gaps</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {explanation.topRiskContributors.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#5F97C7] transition-all flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs truncate">{item.borrowerName}</span>
                            <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                              {item.code || item.id}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-red-100 text-red-800 border border-red-200">
                              {item.issue}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Branch: <strong className="text-slate-700">{item.branch}</strong></span>
                            <span>•</span>
                            <span>Segment: <strong className="text-slate-700">{item.segment}</strong></span>
                            <span>•</span>
                            <span>Required: <strong>ETB {Number(item.amount ?? 0).toLocaleString()}</strong></span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">Deficit Gap</div>
                            <div className="text-xs font-extrabold text-red-600">
                              ETB {Number(item.gap ?? 0).toLocaleString()}
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              onClose();
                              if (onDrillToCollateral) {
                                onDrillToCollateral(item.id);
                              } else if (onNavigate) {
                                onNavigate('collaterals');
                              }
                            }}
                            className="px-2.5 py-1.5 bg-[#2C6295] hover:bg-[#1F4E7A] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <span>{item.actionLabel || 'Inspect Asset'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Recommended Corrective Actions */}
              {explanation.recommendedActions && explanation.recommendedActions.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Prescriptive Operational Recommendations</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-amber-900/90 list-disc list-inside">
                    {explanation.recommendedActions.map((rec, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">Collateral Insurance Management System (CIMS) • Audit & Compliance Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
