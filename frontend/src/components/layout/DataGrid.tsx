import React, { useState, useMemo } from 'react';
import { Search, Download, Eye, ArrowUpDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
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

  // Search filter
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const lower = search.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some((val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') return false;
        return String(val).toLowerCase().includes(lower);
      })
    );
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

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
    <div className="cims-card overflow-hidden">
      {/* Header bar */}
      <div className="p-4 border-b border-border bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {title && <h2 className="text-base font-semibold text-text-primary">{title}</h2>}
          {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {actions}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-secondary" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-4 py-1.5 text-xs bg-brand-50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 w-48 md:w-64 text-text-primary"
            />
          </div>

          {/* Columns Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColToggle(!showColToggle)}
              className="btn-secondary py-1.5 px-3 text-xs"
              title="Show/Hide Columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Columns
            </button>
            {showColToggle && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-border rounded-md shadow-lg p-2 z-50">
                <div className="text-xs font-semibold text-text-secondary pb-1 border-b border-border mb-1">
                  Toggle Columns
                </div>
                {columns.map((col, idx) => {
                  const key = col.header || String(idx);
                  return (
                    <label key={key} className="flex items-center gap-2 py-1 px-1 text-xs text-text-primary cursor-pointer hover:bg-brand-50 rounded">
                      <input
                        type="checkbox"
                        checked={visibleColumns[key] ?? true}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                        className="rounded text-brand-900 focus:ring-brand-500"
                      />
                      {col.header}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <button onClick={exportCSV} className="btn-secondary py-1.5 px-3 text-xs" title="Export CSV">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-brand-50 border-b border-border text-text-secondary font-semibold text-xs select-none">
              {columns.map((col, idx) => {
                const key = col.header || String(idx);
                if (visibleColumns[key] === false) return null;
                return (
                  <th
                    key={key}
                    onClick={() => col.sortable !== false && col.accessorKey && handleSort(col.accessorKey as string)}
                    className={`py-3 px-4 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${
                      col.sortable !== false && col.accessorKey ? 'cursor-pointer hover:bg-brand-100/50' : ''
                    }`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.header}</span>
                      {col.sortable !== false && col.accessorKey && (
                        <ArrowUpDown className="w-3 h-3 text-text-secondary opacity-60" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {pagedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-text-secondary text-sm">
                  No records found matching criteria.
                </td>
              </tr>
            ) : (
              pagedData.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-brand-50/70 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col, idx) => {
                    const key = col.header || String(idx);
                    if (visibleColumns[key] === false) return null;
                    return (
                      <td
                        key={key}
                        className={`py-3 px-4 ${col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : 'text-left'}`}
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
      <div className="p-3 border-t border-border bg-white flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-secondary">
        <div>
          Showing <span className="font-semibold text-text-primary tabular-nums">{(currentPage - 1) * pageSize + (sortedData.length > 0 ? 1 : 0)}</span> to{' '}
          <span className="font-semibold text-text-primary tabular-nums">{Math.min(currentPage * pageSize, sortedData.length)}</span> of{' '}
          <span className="font-semibold text-text-primary tabular-nums">{sortedData.length}</span> entries
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-brand-50 border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
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
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded border border-border bg-white text-text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-text-primary tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded border border-border bg-white text-text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
