import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  FileWarning,
  Clock,
  Database,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
} from 'lucide-react';

export type HotspotCategory = 'ALL' | 'INSURANCE_RISK' | 'DOCUMENTATION' | 'OPERATIONAL' | 'DATA_QUALITY';

interface HotspotItem {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  category?: HotspotCategory | string;
  title: string;
  description: string;
  code?: string;
  entityId?: string;
  amount?: number;
  recommendedAction?: string;
  routeTarget?: string;
}

interface OperationalHotspotsV2Props {
  items?: HotspotItem[];
  onDrillToCollateral?: (colId: string) => void;
  onDrillToPolicy?: (polId: string) => void;
  onDrillToCustomer?: (cif: string) => void;
  onNavigate?: (screen: string, params?: any) => void;
  className?: string;
}

export const OperationalHotspotsV2: React.FC<OperationalHotspotsV2Props> = ({
  items = [],
  onDrillToCollateral,
  onDrillToPolicy,
  onDrillToCustomer,
  onNavigate,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<HotspotCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Classify item into category if not already explicitly tagged
  const resolveCategory = (item: HotspotItem): HotspotCategory => {
    if (item.category && ['INSURANCE_RISK', 'DOCUMENTATION', 'OPERATIONAL', 'DATA_QUALITY'].includes(item.category)) {
      return item.category as HotspotCategory;
    }
    const t = (item.type || '').toUpperCase();
    if (t.includes('INSUR') || t.includes('COVERAGE') || t.includes('POLICY') || t.includes('EXPIRED_POLICY')) {
      return 'INSURANCE_RISK';
    }
    if (t.includes('DOC') || t.includes('TITLE') || t.includes('DEED') || t.includes('CHECKLIST') || t.includes('MISSING_DOC')) {
      return 'DOCUMENTATION';
    }
    if (t.includes('WORKFLOW') || t.includes('APPROVAL') || t.includes('CONCENTRATION') || t.includes('OVERDUE')) {
      return 'OPERATIONAL';
    }
    return 'DATA_QUALITY';
  };

  const categorizedItems = useMemo(() => {
    return items.map((item) => ({
      ...item,
      resolvedCategory: resolveCategory(item),
    }));
  }, [items]);

  const counts = useMemo(() => {
    const c = {
      ALL: categorizedItems.length,
      INSURANCE_RISK: 0,
      DOCUMENTATION: 0,
      OPERATIONAL: 0,
      DATA_QUALITY: 0,
    };
    categorizedItems.forEach((it) => {
      if (c[it.resolvedCategory] !== undefined) {
        c[it.resolvedCategory]++;
      }
    });
    return c;
  }, [categorizedItems]);

  const filteredItems = useMemo(() => {
    return categorizedItems.filter((item) => {
      const matchesTab = activeTab === 'ALL' || item.resolvedCategory === activeTab;
      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.recommendedAction?.toLowerCase().includes(q)
      );
    });
  }, [categorizedItems, activeTab, searchQuery]);

  const handleItemAction = (item: HotspotItem) => {
    const t = (item.type || '').toUpperCase();
    if (t.includes('POLICY') || t === 'EXPIRED_POLICY') {
      if (onDrillToPolicy) {
        onDrillToPolicy(item.entityId || item.id);
        return;
      }
    }
    if (t.includes('COLLATERAL') || t === 'UNDERINSURED' || t === 'UNINSURED' || t.includes('DOC')) {
      if (onDrillToCollateral) {
        onDrillToCollateral(item.entityId || item.id);
        return;
      }
    }
    if (t.includes('CUSTOMER') || t.includes('CIF')) {
      if (onDrillToCustomer) {
        onDrillToCustomer(item.entityId || item.id);
        return;
      }
    }
    if (onNavigate) {
      const target = item.routeTarget ? item.routeTarget.replace('/', '') : 'exceptions';
      onNavigate(target, { id: item.entityId || item.id });
    }
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900">
              Operational Hotspots & Priority Action Items
            </h4>
            <p className="text-xs text-slate-500">
              Deterministic, actionable bottlenecks requiring intervention across coverage, documentation, and operations
            </p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
          {items.length} Active Hotspots
        </span>
      </div>

      {/* 4 Categorized Tabs + Search Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-800">
              {counts.ALL}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('INSURANCE_RISK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'INSURANCE_RISK'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Insurance Risk
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-rose-800">
              {counts.INSURANCE_RISK}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DOCUMENTATION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'DOCUMENTATION'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200'
            }`}
          >
            <FileWarning className="w-3.5 h-3.5" />
            Documentation
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-cyan-900">
              {counts.DOCUMENTATION}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('OPERATIONAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'OPERATIONAL'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Operational & Approval
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-purple-900">
              {counts.OPERATIONAL}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DATA_QUALITY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'DATA_QUALITY'
                ? 'bg-indigo-700 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Data Quality
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-indigo-900">
              {counts.DATA_QUALITY}
            </span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search hotspots..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 border border-slate-300 rounded-lg text-xs w-48 focus:outline-hidden focus:border-blue-500"
          />
        </div>
      </div>

      {/* Hotspots Content Table */}
      {filteredItems.length === 0 ? (
        <div className="p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
          <div className="text-sm font-bold text-slate-800">
            {searchQuery ? 'No matching hotspots found' : 'No Operational Hotspots in this Category'}
          </div>
          <div className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery
              ? 'Try refining your search query or switch categories.'
              : 'All monitored assets, policies, documents, and workflows in this scope meet compliance benchmarks.'}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Severity</th>
                <th className="p-3">Category / Issue</th>
                <th className="p-3">Asset / Reference</th>
                <th className="p-3">Exposure / Deficit</th>
                <th className="p-3">Recommended Action</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item, idx) => {
                const sev = (item.severity || 'MEDIUM').toUpperCase();
                const sevBadge =
                  sev === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : sev === 'HIGH'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : sev === 'LOW'
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-blue-100 text-blue-800 border-blue-300';

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${sevBadge}`}>
                        {sev}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{item.title}</div>
                      <div className="text-[11px] text-slate-500">{item.type}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono font-bold text-blue-700">{item.code || item.id}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{item.description}</div>
                    </td>
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                      {item.amount && item.amount > 0
                        ? `ETB ${Number(item.amount).toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="p-3 text-slate-600 text-[11px]">
                      {item.recommendedAction || 'Review and remediate immediately.'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleItemAction(item)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded border border-blue-200 text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <span>Resolve</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
