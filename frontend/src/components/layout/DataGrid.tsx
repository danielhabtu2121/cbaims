import React, { useState, useMemo } from 'react';
import { Search, Download, Eye, ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
}

interface ServerSidePagination {
  totalItems: number;
  currentPage: number; // 1-indexed
  pageSize: number;
  searchQuery: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSearchChange: (q: string) => void;
}

interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  onRowClick?: (item: T) => void;
  pageSizeOptions?: number[];
  searchPlaceholder?: string;
  serverSide?: ServerSidePagination;
}

export function DataGrid<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  title,
  subtitle,
  actions,
  onRowClick,
  pageSizeOptions = [25, 50, 100],
  searchPlaceholder = 'Search records...',
  serverSide,
}: DataGridProps<T>) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    columns.forEach((col, idx) => {
      init[col.header || String(idx)] = true;
    });
    return init;
  });
  const [showColToggle, setShowColToggle] = useState(false);

  const effectiveSearch = serverSide ? serverSide.searchQuery : search;
  const effectivePageSize = serverSide ? serverSide.pageSize : pageSize;

  // Search filter with deep extraction and multi-term tokenized matching (client-side only)
  const filteredData = useMemo(() => {
    if (serverSide) return data;
    if (!search.trim()) return data;
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

    const extractStrings = (val: any): string[] => {
      if (val === null || val === undefined) return [];
      if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return [String(val).toLowerCase()];
      }
      if (Array.isArray(val)) {
        return val.flatMap(extractStrings);
      }
      if (typeof val === 'object') {
        return Object.values(val).flatMap(extractStrings);
      }
      return [];
    };

    return data.filter((item) => {
      const allText = extractStrings(item).join(' ');
      return terms.every((term) => allText.includes(term));
    });
  }, [data, search]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      const res = valA < valB ? -1 : 1;
      return sortOrder === 'asc' ? res : -res;
    });
  }, [filteredData, sortKey, sortOrder]);

  // Pagination with safePage clamp
  const totalCount = serverSide ? serverSide.totalItems : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / effectivePageSize));
  const safePage = Math.min(Math.max(1, serverSide ? serverSide.currentPage : currentPage), totalPages);
  const pagedData = useMemo(() => {
    if (serverSide) return sortedData;
    const start = (safePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [serverSide, sortedData, safePage, pageSize]);

  const handleSort = (key?: string) => {
    if (!key) return;
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // CSV Export
  const exportCSV = () => {
    const activeCols = columns.filter((col, idx) => visibleColumns[col.header || String(idx)]);
    const headers = activeCols.map((c) => `"${c.header}"`).join(',');
    const rows = sortedData.map((row) =>
      activeCols
        .map((c) => {
          const val = c.accessorKey ? row[c.accessorKey as string] : '';
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(title || 'cims_export').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {title && <h2 className="text-base font-bold text-[#00205B]">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          {actions}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={effectiveSearch}
              onChange={(e) => {
                if (serverSide) {
                  serverSide.onSearchChange(e.target.value);
                } else {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }
              }}
              className="pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#D48806] focus:border-[#D48806] w-48 md:w-64 text-slate-800 transition-colors"
            />
            {effectiveSearch && (
              <button
                onClick={() => {
                  if (serverSide) {
                    serverSide.onSearchChange('');
                  } else {
                    setSearch('');
                    setCurrentPage(1);
                  }
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Columns Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColToggle(!showColToggle)}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors font-medium shadow-2xs"
              title="Show/Hide Columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Columns</span>
            </button>
            {showColToggle && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-xs font-bold text-slate-700 pb-1.5 border-b border-slate-100 mb-1.5 px-1">
                  Toggle Columns
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                  {columns.map((col, idx) => {
                    const key = col.header || String(idx);
                    return (
                      <label key={key} className="flex items-center gap-2 py-1.5 px-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors">
                        <input
                          type="checkbox"
                          checked={visibleColumns[key] ?? true}
                          onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                          className="rounded text-[#00205B] focus:ring-[#D48806]"
                        />
                        <span className="font-medium truncate">{col.header}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <button
            onClick={exportCSV}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors font-medium shadow-2xs"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold text-xs select-none">
              {columns.map((col, idx) => {
                const key = col.header || String(idx);
                if (visibleColumns[key] === false) return null;
                return (
                  <th
                    key={key}
                    onClick={() => col.sortable !== false && col.accessorKey && handleSort(col.accessorKey as string)}
                    className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.sortable !== false && col.accessorKey ? 'cursor-pointer hover:bg-slate-100/80 transition-colors' : ''
                      }`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span className="font-bold text-[#00205B]">{col.header}</span>
                      {col.sortable !== false && col.accessorKey && (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-70" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-slate-400 text-xs font-medium">
                  No records found matching criteria.
                </td>
              </tr>
            ) : (
              pagedData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-slate-50/80 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col, idx) => {
                    const key = col.header || String(idx);
                    if (visibleColumns[key] === false) return null;
                    return (
                      <td
                        key={key}
                        className={`py-3 px-4 text-slate-700 ${col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                      >
                        {col.cell ? col.cell(row) : (col.accessorKey ? row[col.accessorKey as string] : '')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div>
          Showing <span className="font-bold text-slate-800 tabular-nums">{totalCount > 0 ? (safePage - 1) * effectivePageSize + 1 : 0}</span> to{' '}
          <span className="font-bold text-slate-800 tabular-nums">{Math.min(safePage * effectivePageSize, totalCount)}</span> of{' '}
          <span className="font-bold text-slate-800 tabular-nums">{totalCount.toLocaleString()}</span> entries
          {serverSide?.loading && <span className="ml-2 text-[#00205B] font-medium">Loading...</span>}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={effectivePageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (serverSide) {
                  serverSide.onPageSizeChange(newSize);
                } else {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#D48806]"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const prev = Math.max(1, safePage - 1);
                if (serverSide) serverSide.onPageChange(prev);
                else setCurrentPage(prev);
              }}
              disabled={safePage === 1}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-[#00205B] tabular-nums">
              {safePage.toLocaleString()} / {totalPages.toLocaleString()}
            </span>
            <button
              onClick={() => {
                const next = Math.min(totalPages, safePage + 1);
                if (serverSide) serverSide.onPageChange(next);
                else setCurrentPage(next);
              }}
              disabled={safePage === totalPages}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
