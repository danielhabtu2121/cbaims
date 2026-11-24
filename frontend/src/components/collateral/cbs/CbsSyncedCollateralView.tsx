import React, { useState, useEffect } from 'react';
import { formatEtbNumber } from '../../../utils/format.ts';
import {
  Database,
  Filter,
  Search,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  Building,
  Layers,
  Shield,
  FileText,
  Eye,
  Edit,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Collateral, CbsDataQualitySummaryDto, UserSession } from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface CbsSyncedCollateralViewProps {
  currentUser: UserSession;
  onOpenDetail: (col: Collateral) => void;
  onOpenEnrichment: (col: Collateral) => void;
  onOpenInsurance: (col: Collateral) => void;
}

export const CbsSyncedCollateralView: React.FC<CbsSyncedCollateralViewProps> = ({
  currentUser,
  onOpenDetail,
  onOpenEnrichment,
  onOpenInsurance,
}) => {
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedQualityStatus, setSelectedQualityStatus] = useState('ALL');
  const [selectedInsuranceStatus, setSelectedInsuranceStatus] = useState('ALL');

  // Summary state
  const [summary, setSummary] = useState<CbsDataQualitySummaryDto | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const isCroOrMaker = currentUser.role?.includes('CRO') || currentUser.role?.includes('Maker') || currentUser.role?.includes('Admin');

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await cimsApi.getDataQualitySummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load data quality summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadCollaterals = async () => {
    setLoading(true);
    try {
      const resp = await cimsApi.getCbsSyncedCollaterals({
        page: currentPage,
        size: pageSize,
        search: search.trim() || undefined,
        segment: selectedSegment !== 'ALL' ? selectedSegment : undefined,
        district: selectedDistrict !== 'ALL' ? selectedDistrict : undefined,
        branch: selectedBranch !== 'ALL' ? selectedBranch : undefined,
        dataQualityStatus: selectedQualityStatus !== 'ALL' ? selectedQualityStatus : undefined,
        insuranceStatus: selectedInsuranceStatus !== 'ALL' ? selectedInsuranceStatus : undefined,
      });
      setCollaterals(resp.content || []);
      setTotalElements(resp.totalElements || 0);
      setTotalPages(resp.totalPages || 1);
    } catch (err) {
      console.error('Failed to load CBS collaterals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadCollaterals();
  }, [currentPage, pageSize, selectedSegment, selectedDistrict, selectedBranch, selectedQualityStatus, selectedInsuranceStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    loadCollaterals();
  };

  const getQualityBadge = (status?: string) => {
    switch (status) {
      case 'COMPLETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Complete
          </span>
        );
      case 'INCOMPLETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Incomplete
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            Under Review
          </span>
        );
      case 'ORGANIZATIONAL_MAPPING_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Building className="w-3 h-3 text-purple-600" />
            Org Required
          </span>
        );
      case 'CLASSIFICATION_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Layers className="w-3 h-3 text-rose-600" />
            Classify Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            {status || 'Not Assessed'}
          </span>
        );
    }
  };

  const getInsuranceBadge = (col: Collateral) => {
    if (col.insuredAmount > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Shield className="w-3 h-3 text-emerald-600" />
          {col.insuranceStatus || 'Insured'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <ShieldAlert className="w-3 h-3 text-rose-600" />
        Uninsured
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary Cards (Section 4.3) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total CBS Synced</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-slate-900">{summary?.totalCbsImported ?? '—'}</p>
          <span className="text-[11px] text-slate-500">Read-only CBS Origin</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Complete</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-emerald-700">{summary?.completeCount ?? '—'}</p>
          <span className="text-[11px] text-emerald-600">All rules satisfied</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Incomplete</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-amber-700">{summary?.incompleteCount ?? '—'}</p>
          <span className="text-[11px] text-amber-600">Pending CRO data</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Checker Queue</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-700">{summary?.pendingCheckerCount ?? '—'}</p>
          <span className="text-[11px] text-blue-600">Awaiting approval</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Org Unassigned</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-purple-700">{summary?.missingOrgAssignmentCount ?? '—'}</p>
          <span className="text-[11px] text-purple-600">Missing Branch/CRO</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Uninsured</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-bold text-rose-700">{summary?.insuranceNotRegisteredCount ?? '—'}</p>
          <span className="text-[11px] text-rose-600">Draft policy required</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by CBAIMS ID, CBS Ref, Description, or Customer CIF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedQualityStatus}
              onChange={(e) => { setSelectedQualityStatus(e.target.value); setCurrentPage(0); }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Quality Statuses</option>
              <option value="COMPLETE">Complete</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="ORGANIZATIONAL_MAPPING_REQUIRED">Org Required</option>
              <option value="CLASSIFICATION_REVIEW">Classify Review</option>
            </select>

            <select
              value={selectedInsuranceStatus}
              onChange={(e) => { setSelectedInsuranceStatus(e.target.value); setCurrentPage(0); }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Insurance Statuses</option>
              <option value="Uninsured">Uninsured</option>
              <option value="Adequately Insured">Adequately Insured</option>
              <option value="Underinsured">Underinsured</option>
            </select>

            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
            >
              Filter
            </button>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedSegment('ALL');
                setSelectedDistrict('ALL');
                setSelectedBranch('ALL');
                setSelectedQualityStatus('ALL');
                setSelectedInsuranceStatus('ALL');
                setCurrentPage(0);
                loadSummary();
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh and Reset Filters"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">CBAIMS ID / CBS Ref</th>
                <th className="py-3 px-3">Customer CIF / Owner</th>
                <th className="py-3 px-3">Classification & Description</th>
                <th className="py-3 px-3">Org (Branch / Segment)</th>
                <th className="py-3 px-3">Valuation / Haircut</th>
                <th className="py-3 px-3">Data Quality</th>
                <th className="py-3 px-3">Insurance</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading CBS Synced Collateral records...
                  </td>
                </tr>
              ) : collaterals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    No CBS-imported collateral records match the selected filters.
                  </td>
                </tr>
              ) : (
                collaterals.map((col) => (
                  <tr key={col.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 font-mono">
                      <div className="font-semibold text-slate-900">{col.code}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Database className="w-3 h-3 text-blue-500" />
                        {col.cbsCollateralRef || 'CBS-FEED'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{col.customerId || '—'}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                        {col.owners && col.owners.length > 0 ? col.owners[0].name : col.ownerType}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{col.type || col.category}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={col.description}>
                        {col.description || 'No description provided in CBS'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800">{col.branch || 'Unassigned'}</div>
                      <div className="text-[11px] text-slate-500">{col.owningSegment || 'Corporate'}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">
                        {col.currency || 'ETB'} {formatEtbNumber(col.valuationAmount ?? 0)}
                      </div>
                      <div className="text-[11px] text-slate-500">Haircut: {col.haircut ?? 0}%</div>
                    </td>

                    <td className="py-3 px-3">
                      {getQualityBadge(col.dataQualityStatus)}
                    </td>

                    <td className="py-3 px-3">
                      {getInsuranceBadge(col)}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenDetail(col)}
                          className="px-2 py-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md font-medium text-xs transition-colors flex items-center gap-1 border border-slate-200"
                          title="View Collateral 360 & CBS Snapshot"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          360
                        </button>

                        {isCroOrMaker && (
                          <button
                            onClick={() => onOpenEnrichment(col)}
                            className="px-2 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md font-medium text-xs transition-colors flex items-center gap-1 border border-blue-200 shadow-2xs"
                            title="Complete or Correct CBAIMS Data"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Enrich
                          </button>
                        )}

                        <button
                          onClick={() => onOpenInsurance(col)}
                          className="px-2 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md font-medium text-xs transition-colors flex items-center gap-1 border border-emerald-200 shadow-2xs"
                          title="Register or Link Insurance Policy"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Insure
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
          <div>
            Showing <span className="font-semibold">{collaterals.length > 0 ? currentPage * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold">{Math.min((currentPage + 1) * pageSize, totalElements)}</span> of{' '}
            <span className="font-semibold">{totalElements}</span> CBS-imported records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0}
              className="p-1 rounded-md border border-slate-300 hover:bg-white disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-700">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage >= totalPages - 1}
              className="p-1 rounded-md border border-slate-300 hover:bg-white disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

