import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { DashboardPortfolioRow, PaginatedPortfolioResponse } from '../../../types';
import { cimsApi } from '../../../api/cimsApi';

interface PaginatedPortfolioGridProps {
  userId?: string;
  segment?: string;
  district?: string;
  branch?: string;
  onDrillToCollateral?: (collateralId: string) => void;
  onDrillToCustomer?: (cif: string) => void;
  className?: string;
}

export const PaginatedPortfolioGrid: React.FC<PaginatedPortfolioGridProps> = ({
  userId,
  segment,
  district,
  branch,
  onDrillToCollateral,
  onDrillToCustomer,
  className = '',
}) => {
  const [data, setData] = useState<PaginatedPortfolioResponse>({
    content: [],
    page: 0,
    size: 15,
    totalElements: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [category, setCategory] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(15);
  const [sortField, setSortField] = useState<string>('collateralCode');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  const fetchPortfolio = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await cimsApi.getDashboardPaginatedPortfolio({
        userId,
        segment: segment && segment !== 'ALL' ? segment : undefined,
        district: district && district !== 'ALL' ? district : undefined,
        branch: branch && branch !== 'ALL' ? branch : undefined,
        category: category !== 'ALL' ? category : undefined,
        status: status !== 'ALL' ? status : undefined,
        search: search.trim() || undefined,
        page,
        size: pageSize,
        sortField,
        sortDir,
      });
      setData(res);
    } catch (err: any) {
      console.error('Failed to load paginated portfolio:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, segment, district, branch, category, status, search, page, pageSize, sortField, sortDir]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(field);
      setSortDir('ASC');
    }
    setPage(0);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  const handleExportCsv = () => {
    const url = cimsApi.getDashboardExportUrl({
      userId,
      segment: segment && segment !== 'ALL' ? segment : undefined,
      district: district && district !== 'ALL' ? district : undefined,
      branch: branch && branch !== 'ALL' ? branch : undefined,
      category: category !== 'ALL' ? category : undefined,
      status: status !== 'ALL' ? status : undefined,
    });
    window.open(url, '_blank');
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '—';
    return `ETB ${Number(val).toLocaleString()}`;
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 ${className}`}>
      {/* Header & Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h4 className="font-extrabold text-sm text-slate-900">
            Scoped Collateral & Insurance Portfolio Grid
          </h4>
          <p className="text-xs text-slate-500">
            Server-side paginated asset portfolio matching authenticated security scope
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Scoped CSV</span>
          </button>
          <button
            onClick={fetchPortfolio}
            disabled={isLoading}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
            title="Refresh Portfolio Grid"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1 border-t border-slate-100">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search CIF, name, collateral code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs w-64 focus:outline-hidden focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchInput('');
                setPage(0);
              }}
              className="text-xs text-slate-500 hover:text-rose-600"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Category:</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
              className="py-1 px-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Real Estate">Real Estate</option>
              <option value="Vehicle">Vehicle</option>
              <option value="Machinery">Machinery</option>
              <option value="Goods">Inventory / Goods</option>
              <option value="Financial">Financial / Cash</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Adequacy:</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
              className="py-1 px-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Adequate">Adequately Insured</option>
              <option value="Underinsured">Underinsured</option>
              <option value="Uninsured">Uninsured</option>
              <option value="Expired">Expired Policy</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Page Size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="py-1 px-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-hidden focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
            <tr>
              <th
                onClick={() => handleSort('collateralCode')}
                className="p-3 cursor-pointer hover:text-blue-600"
              >
                <div className="flex items-center gap-1">
                  <span>Collateral Code</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('customerName')}
                className="p-3 cursor-pointer hover:text-blue-600"
              >
                <div className="flex items-center gap-1">
                  <span>Borrower / CIF</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3">Category</th>
              <th className="p-3">Branch & District</th>
              <th
                onClick={() => handleSort('marketValue')}
                className="p-3 cursor-pointer hover:text-blue-600"
              >
                <div className="flex items-center gap-1">
                  <span>Market Value</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('exposure')}
                className="p-3 cursor-pointer hover:text-blue-600"
              >
                <div className="flex items-center gap-1">
                  <span>Loan Exposure</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3">Required Cover</th>
              <th className="p-3">Active Cover</th>
              <th
                onClick={() => handleSort('insuranceGap')}
                className="p-3 cursor-pointer hover:text-blue-600"
              >
                <div className="flex items-center gap-1">
                  <span>Deficit (Gap)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3">Status</th>
              <th className="p-3">Expiry Date</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-blue-600" />
                  <span>Loading scoped records from database...</span>
                </td>
              </tr>
            ) : data.content.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-500">
                  No collateral or insurance records match the selected scope and criteria.
                </td>
              </tr>
            ) : (
              data.content.map((row) => {
                const activeCover = row.insuredAmount ?? 0;
                const adequacy = row.adequacyStatus || (row.insuranceGap > 0 ? (activeCover > 0 ? 'Underinsured' : 'Uninsured') : 'Adequate');
                const badgeClass =
                  adequacy === 'Adequate' || adequacy === 'Compliant'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : adequacy === 'Underinsured'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300';

                return (
                  <tr key={row.collateralId || row.collateralCode} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                      {row.collateralCode}
                    </td>
                    <td className="p-3">
                      <div
                        onClick={() => onDrillToCustomer && row.cif && onDrillToCustomer(row.cif)}
                        className={`font-semibold text-slate-900 ${
                          onDrillToCustomer ? 'hover:text-blue-600 cursor-pointer' : ''
                        }`}
                      >
                        {row.customerName}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{row.cif}</div>
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">{row.collateralCategory}</td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{row.branch}</div>
                      <div className="text-[10px] text-slate-500">{row.district}</div>
                    </td>
                    <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                      {formatCurrency(row.marketValue)}
                    </td>
                    <td className="p-3 font-bold text-blue-900 whitespace-nowrap">
                      {formatCurrency(row.outstandingExposure)}
                    </td>
                    <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                      {formatCurrency(row.insuranceRequired)}
                    </td>
                    <td className="p-3 font-bold text-emerald-800 whitespace-nowrap">
                      {formatCurrency(row.insuredAmount)}
                    </td>
                    <td className="p-3 font-bold whitespace-nowrap">
                      <span className={row.insuranceGap > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        {formatCurrency(row.insuranceGap)}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                        {adequacy}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      {row.expiryDate || '—'}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {onDrillToCollateral && (
                        <button
                          onClick={() => onDrillToCollateral(row.collateralId)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded border border-blue-200 text-xs transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
        <div>
          Showing{' '}
          <strong>
            {data.totalElements === 0 ? 0 : data.page * data.size + 1}
          </strong>{' '}
          to{' '}
          <strong>
            {Math.min((data.page + 1) * data.size, data.totalElements)}
          </strong>{' '}
          of <strong>{data.totalElements}</strong> assets
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={data.page === 0 || isLoading}
            className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 font-semibold text-slate-700">
            Page {data.page + 1} of {Math.max(1, data.totalPages)}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages - 1, p + 1))}
            disabled={data.page >= data.totalPages - 1 || isLoading}
            className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
