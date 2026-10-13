import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  RotateCw,
  Plus,
  ArrowRight,
  Database,
  Users,
  CreditCard,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Search,
  Filter,
  ShieldCheck,
  Activity,
  Info,
  RefreshCw,
} from 'lucide-react';
import { CbsCustomer, CbsFacility, CbsCollateral, CbsSyncLog, CbsSyncStatus } from '../../types';
import { cimsApi } from '../../api/cimsApi';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';

interface CbsSimulatorProps {
  customers: CbsCustomer[];
  facilities: CbsFacility[];
  collaterals: CbsCollateral[];
  syncLogs: CbsSyncLog[];
  onSyncEntity: (type: string, id: string) => Promise<void>;
  onSyncAll: () => Promise<void>;
  onSaveCustomer: (cust: Partial<CbsCustomer>) => Promise<void>;
  onSaveFacility: (fac: Partial<CbsFacility>) => Promise<void>;
  onSaveCollateral: (col: Partial<CbsCollateral>) => Promise<void>;
}

export const CbsSimulator: React.FC<CbsSimulatorProps> = ({
  customers,
  facilities,
  collaterals,
  syncLogs,
  onSyncEntity,
  onSyncAll,
  onSaveCustomer,
  onSaveFacility,
  onSaveCollateral,
}) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'facilities' | 'collaterals' | 'logs'>('customers');
  const [showCustModal, setShowCustModal] = useState(false);
  const [showFacModal, setShowFacModal] = useState(false);
  const [showColModal, setShowColModal] = useState(false);
  const [selectedCust, setSelectedCust] = useState<Partial<CbsCustomer> | null>(null);
  const [selectedFac, setSelectedFac] = useState<Partial<CbsFacility> | null>(null);
  const [selectedCol, setSelectedCol] = useState<Partial<CbsCollateral> | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);

  // Module 1 Enhancements
  const [liveStatus, setLiveStatus] = useState<CbsSyncStatus | null>(null);
  const [inspectedLog, setInspectedLog] = useState<CbsSyncLog | null>(null);
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logResultFilter, setLogResultFilter] = useState<'ALL' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED'>('ALL');
  const [logEntityFilter, setLogEntityFilter] = useState<'ALL' | 'Customer' | 'Facility' | 'Collateral' | 'Link'>('ALL');
  const [modalError, setModalError] = useState<string | null>(null);

  const loadStatus = async () => {
    try {
      const s = await cimsApi.fetchCbsSyncStatus();
      if (s) setLiveStatus(s);
    } catch (err) {
      console.warn('Failed to load CBS sync status', err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [syncLogs]);

  const handleSync = async (type: string, id: string) => {
    setSyncingId(id);
    try {
      await onSyncEntity(type, id);
      await loadStatus();
    } finally {
      setSyncingId(null);
    }
  };

  const handleBatchSync = async () => {
    setBatchSyncing(true);
    try {
      await onSyncAll();
      await loadStatus();
    } finally {
      setBatchSyncing(false);
    }
  };

  // Customer Columns
  const customerColumns: ColumnDef<CbsCustomer>[] = [
    { header: 'CIF', accessorKey: 'cif', sortable: true },
    { header: 'Customer Name', accessorKey: 'fullName', sortable: true },
    { header: 'Type', accessorKey: 'customerType' },
    { header: 'National ID / Reg No.', accessorKey: 'nationalId', cell: (r) => r.nationalId || r.businessRegNo || '—' },
    { header: 'Segment', accessorKey: 'businessSegment' },
    { header: 'Branch', accessorKey: 'branch' },
    {
      header: 'Status',
      accessorKey: 'customerStatus',
      cell: (r) => <StatusChip label={r.customerStatus} />,
    },
    {
      header: 'Sync Status',
      accessorKey: 'syncStatus',
      cell: (r) => <StatusChip label={r.syncStatus} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setModalError(null);
              setSelectedCust(r);
              setShowCustModal(true);
            }}
            className="btn-ghost py-1 px-2 text-xs"
          >
            Edit
          </button>
          <button
            onClick={() => handleSync('Customer', r.cif || r.id)}
            disabled={syncingId === (r.cif || r.id) || syncingId === r.id}
            className="btn-primary py-1 px-2 text-xs"
          >
            <RotateCw className={`w-3 h-3 ${(syncingId === (r.cif || r.id) || syncingId === r.id) ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      ),
    },
  ];

  // Facility Columns
  const facilityColumns: ColumnDef<CbsFacility>[] = [
    { header: 'Line Code', accessorKey: 'lineCode', sortable: true },
    { header: 'Loan Ref No.', accessorKey: 'loanRefNo', sortable: true },
    { header: 'Customer CIF', accessorKey: 'customerCif' },
    { header: 'Facility Type', accessorKey: 'facilityType' },
    {
      header: 'Approved Limit',
      accessorKey: 'approvedLimit',
      align: 'right',
      cell: (r) => `${r.lineCurrency} ${r.approvedLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Outstanding',
      accessorKey: 'outstandingAmount',
      align: 'right',
      cell: (r) => `${r.lineCurrency} ${r.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    { header: 'Segment', accessorKey: 'businessSegment' },
    { header: 'Branch', accessorKey: 'branch' },
    {
      header: 'Limit Status',
      accessorKey: 'limitStatus',
      cell: (r) => <StatusChip label={r.limitStatus} />,
    },
    {
      header: 'Sync Status',
      accessorKey: 'syncStatus',
      cell: (r) => <StatusChip label={r.syncStatus} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setModalError(null);
              setSelectedFac(r);
              setShowFacModal(true);
            }}
            className="btn-ghost py-1 px-2 text-xs"
          >
            Edit
          </button>
          <button
            onClick={() => handleSync('Facility', r.loanRefNo || r.lineCode || r.id)}
            disabled={syncingId === (r.loanRefNo || r.lineCode || r.id) || syncingId === r.id}
            className="btn-primary py-1 px-2 text-xs"
          >
            <RotateCw className={`w-3 h-3 ${(syncingId === (r.loanRefNo || r.lineCode || r.id) || syncingId === r.id) ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      ),
    },
  ];

  // Collateral Columns
  const collateralColumns: ColumnDef<CbsCollateral>[] = [
    { header: 'Collateral Code', accessorKey: 'collateralCode', sortable: true },
    { header: 'Description', accessorKey: 'description' },
    { header: 'Category', accessorKey: 'category' },
    { header: 'Customer CIF', accessorKey: 'customerCif' },
    {
      header: 'Collateral Value',
      accessorKey: 'collateralValue',
      align: 'right',
      cell: (r) => `${r.currency} ${r.collateralValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Haircut %',
      accessorKey: 'haircut',
      align: 'right',
      cell: (r) => `${r.haircut}%`,
    },
    { header: 'Collateral Type', accessorKey: 'collateralType' },
    { header: 'Ownership', accessorKey: 'ownershipType' },
    { header: 'Segment', accessorKey: 'businessSegment' },
    {
      header: 'Sync Status',
      accessorKey: 'syncStatus',
      cell: (r) => <StatusChip label={r.syncStatus} />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setModalError(null);
              setSelectedCol(r);
              setShowColModal(true);
            }}
            className="btn-ghost py-1 px-2 text-xs"
          >
            Edit
          </button>
          <button
            onClick={() => handleSync('Collateral', r.collateralCode || r.id)}
            disabled={syncingId === (r.collateralCode || r.id) || syncingId === r.id}
            className="btn-primary py-1 px-2 text-xs"
          >
            <RotateCw className={`w-3 h-3 ${(syncingId === (r.collateralCode || r.id) || syncingId === r.id) ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      ),
    },
  ];

  // Filtered logs
  const filteredLogs = syncLogs.filter((l) => {
    if (logResultFilter !== 'ALL' && l.result?.toUpperCase() !== logResultFilter) return false;
    if (logEntityFilter !== 'ALL' && l.entityType?.toUpperCase() !== logEntityFilter.toUpperCase()) return false;
    if (logSearchTerm.trim()) {
      const term = logSearchTerm.trim().toLowerCase();
      const matchId = l.entityId?.toLowerCase().includes(term);
      const matchType = l.entityType?.toLowerCase().includes(term);
      const matchErr = l.errorMessage?.toLowerCase().includes(term);
      const matchLogId = l.id?.toLowerCase().includes(term);
      if (!matchId && !matchType && !matchErr && !matchLogId) return false;
    }
    return true;
  });

  // Enriched Sync Log Columns
  const logColumns: ColumnDef<CbsSyncLog>[] = [
    {
      header: 'Timestamp',
      accessorKey: 'timestamp',
      cell: (r) => r.timestamp?.replace('T', ' ').substring(0, 19),
    },
    { header: 'Entity Type', accessorKey: 'entityType' },
    { header: 'Entity Code / ID', accessorKey: 'entityId' },
    {
      header: 'Source',
      accessorKey: 'sourceSystem',
      cell: (r) => (
        <span className="font-mono text-[11px] text-[#5B6472]">
          {r.sourceSystem || 'CBS_SIM'}
        </span>
      ),
    },
    { header: 'Direction', accessorKey: 'direction' },
    {
      header: 'Result',
      accessorKey: 'result',
      cell: (r) => <StatusChip label={r.result} />,
    },
    {
      header: 'Records Succeeded / Processed',
      accessorKey: 'recordsProcessed',
      cell: (r) => (
        <span className="text-xs">
          {r.recordsProcessed ? `${r.recordsSucceeded || 0} / ${r.recordsProcessed}` : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <button
          onClick={() => setInspectedLog(r)}
          className="btn-ghost py-1 px-2 text-xs flex items-center gap-1 text-[#102E4A] hover:bg-blue-50"
        >
          <Eye className="w-3.5 h-3.5" />
          Inspect
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Persistent Amber Warning Banner */}
      <div
        style={{
          backgroundColor: '#FFF6DF',
          border: '1px solid #B8860B',
          borderRadius: '8px',
          padding: '14px 18px',
          color: '#0F172A',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <AlertTriangle style={{ width: '24px', height: '24px', color: '#B8860B', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '13px', color: '#B8860B' }}>
            ⚠ Simulated CBS Environment (Core Banking Stand-in)
          </strong>
          <p style={{ fontSize: '12px', color: '#5B6B82', margin: '2px 0 0 0' }}>
            Data entered here represents mock core-banking source data for development &amp; testing.
            The integration boundary follows the single <code>CbsAdapter</code> contract. Use <strong>Sync</strong> on any record or{' '}
            <strong>Sync All Pending</strong> to push into CIMS canonical tables.
          </p>
        </div>
        <button
          onClick={handleBatchSync}
          disabled={batchSyncing}
          className="btn-primary py-1.5 px-3 text-xs"
          style={{ backgroundColor: '#B8860B', borderColor: '#B8860B' }}
        >
          <RotateCw className={`w-3.5 h-3.5 ${batchSyncing ? 'animate-spin' : ''}`} />
          {batchSyncing ? 'Syncing...' : 'Sync All Pending'}
        </button>
      </div>

      {/* Module 1: CBS Integration Status Area */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Adapter Mode & Connection Status */}
        <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#5B6472]">CBS Adapter Mode</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
              {liveStatus?.cbsMode || 'SIMULATOR'}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  liveStatus?.connectionStatus === 'AVAILABLE'
                    ? 'bg-emerald-500'
                    : liveStatus?.connectionStatus === 'NOT_CONFIGURED'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-xs font-bold text-[#101828]">
                {liveStatus?.connectionStatus || 'AVAILABLE'}
              </span>
            </div>
            <p className="text-[11px] text-[#5B6472] mt-1 line-clamp-2">
              {liveStatus?.connectionMessage || 'CBS Simulator active and connected to cbs_sim schema.'}
            </p>
          </div>
        </div>

        {/* Card 2: Last Sync History & Results */}
        <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm">
          <span className="text-xs font-semibold text-[#5B6472]">Sync Execution Status</span>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#5B6472]">Last Result:</span>
              <StatusChip label={liveStatus?.lastResult || 'NONE'} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#5B6472]">Last Success:</span>
              <span className="font-mono text-[11px] text-[#101828]">
                {liveStatus?.lastSuccessfulSync
                  ? liveStatus.lastSuccessfulSync.replace('T', ' ').substring(0, 19)
                  : 'None'}
              </span>
            </div>
            {liveStatus?.lastFailedSync && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-rose-600">Last Failure:</span>
                <span className="font-mono text-[11px] text-rose-700">
                  {liveStatus.lastFailedSync.replace('T', ' ').substring(0, 19)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: CIMS Master Records Synchronized */}
        <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm">
          <span className="text-xs font-semibold text-[#5B6472]">CIMS Master Records</span>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#F8FAFC] p-1.5 rounded border border-[#E2E8F0]">
              <span className="text-[10px] text-[#5B6472] block">Customers</span>
              <span className="font-bold text-sm text-[#101828]">{liveStatus?.syncedCustomersCount ?? customers.length}</span>
            </div>
            <div className="bg-[#F8FAFC] p-1.5 rounded border border-[#E2E8F0]">
              <span className="text-[10px] text-[#5B6472] block">Facilities</span>
              <span className="font-bold text-sm text-[#101828]">{liveStatus?.syncedLoansCount ?? facilities.length}</span>
            </div>
            <div className="bg-[#F8FAFC] p-1.5 rounded border border-[#E2E8F0]">
              <span className="text-[10px] text-[#5B6472] block">Collaterals</span>
              <span className="font-bold text-sm text-[#101828]">{liveStatus?.syncedCollateralsCount ?? collaterals.length}</span>
            </div>
            <div className="bg-[#F8FAFC] p-1.5 rounded border border-[#E2E8F0]">
              <span className="text-[10px] text-[#5B6472] block">Relationships</span>
              <span className="font-bold text-sm text-[#101828]">{liveStatus?.syncedLinksCount ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Sync Strategy & Operations */}
        <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-[#5B6472]">Integration Trigger</span>
            <div className="text-[11px] text-[#5B6472] mt-1">
              Sync Mode: <span className="font-bold text-[#101828]">{liveStatus?.syncMode || 'MANUAL'}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleBatchSync}
              disabled={batchSyncing}
              className="btn-primary py-1.5 px-3 text-xs flex-1 flex items-center justify-center gap-1.5"
            >
              <RotateCw className={`w-3.5 h-3.5 ${batchSyncing ? 'animate-spin' : ''}`} />
              {batchSyncing ? 'Syncing...' : 'Sync All Pending'}
            </button>
            <button
              onClick={loadStatus}
              title="Refresh Status"
              className="btn-ghost p-1.5 text-xs border border-[#E2E8F0] rounded"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#5B6472]" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] gap-2 bg-white px-4 pt-3 rounded-t-lg">
        <button
          onClick={() => setActiveTab('customers')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'customers' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Master ({customers.length})
        </button>
        <button
          onClick={() => setActiveTab('facilities')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'facilities' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Facility Master ({facilities.length})
        </button>
        <button
          onClick={() => setActiveTab('collaterals')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'collaterals' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Collateral Master ({collaterals.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'logs' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
          }`}
        >
          <Clock className="w-4 h-4" />
          Sync Log ({syncLogs.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'customers' && (
        <DataGrid
          title="Simulated Customer Master"
          subtitle="Core Banking Customer Records"
          data={customers}
          columns={customerColumns}
          keyExtractor={(c) => c.id}
          actions={
            <button
              onClick={() => {
                setModalError(null);
                setSelectedCust({
                  cif: `CIF-${Math.floor(100000 + Math.random() * 900000)}`,
                  customerType: 'Individual',
                  fullName: '',
                  nationalId: '',
                  businessRegNo: '',
                  taxIdNo: '',
                  dobOrIncorp: '1988-06-15',
                  gender: 'Male',
                  phone: '+251 91 123 4567',
                  email: '',
                  address: 'Addis Ababa, Kirkos Subcity, Woreda 03',
                  customerStatus: 'Active',
                  riskRating: 'Low',
                  businessSegment: 'Corporate Banking',
                  branch: 'Bole Special Branch',
                });
                setShowCustModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Create CBS Customer
            </button>
          }
        />
      )}

      {activeTab === 'facilities' && (
        <DataGrid
          title="Simulated Credit Facility Master (GETM_FACILITY)"
          subtitle="Core Banking Line & Credit Facilities"
          data={facilities}
          columns={facilityColumns}
          keyExtractor={(f) => f.id}
          actions={
            <button
              onClick={() => {
                setModalError(null);
                const approved = 10000000;
                const outstanding = 7500000;
                setSelectedFac({
                  lineCode: `FAC-${Math.floor(1000 + Math.random() * 9000)}`,
                  loanRefNo: `LN-CORP-2026-${Math.floor(100 + Math.random() * 900)}`,
                  facilityType: 'Term Loan',
                  lineCurrency: 'ETB',
                  revolvingLine: false,
                  approvedLimit: approved,
                  outstandingAmount: outstanding,
                  availableAmount: approved - outstanding,
                  collateralContribution: approved,
                  collateralPct: 100,
                  businessSegment: 'Corporate Banking',
                  branch: 'Bole Special Branch',
                  relationshipManager: 'Abebe Kebede',
                  limitStatus: 'Active',
                  lineStartDate: '2026-01-01',
                  lineExpiryDate: '2029-01-01',
                  nextReviewDate: '2026-12-31',
                  customerCif: customers[0]?.cif || 'CIF-000101',
                });
                setShowFacModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Create CBS Facility
            </button>
          }
        />
      )}

      {activeTab === 'collaterals' && (
        <DataGrid
          title="Simulated Collateral Master (GETM_COLLAT / CLTB_ACC_COLL_LINK_DTLS)"
          subtitle="Core Banking Pledged Collateral Records"
          data={collaterals}
          columns={collateralColumns}
          keyExtractor={(c) => c.id}
          actions={
            <button
              onClick={() => {
                setModalError(null);
                const val = 15000000;
                const hc = 20;
                setSelectedCol({
                  collateralCode: `COL-2026-${Math.floor(100000 + Math.random() * 900000)}`,
                  category: 'Immovable Properties',
                  collateralType: 'Building',
                  ownershipType: 'Borrower-owned',
                  currency: 'ETB',
                  collateralValue: val,
                  haircut: hc,
                  limitContribution: Math.round(val * (1 - hc / 100)),
                  businessSegment: 'Corporate Banking',
                  branch: 'Bole Special Branch',
                  startDate: '2026-01-15',
                  reviewDate: '2027-01-15',
                  tangible: true,
                  linkedLoanRefs: 'LN-CORP-2026-101',
                  linkedAccountNo: '0132089456200',
                  linkageType: 'Primary',
                  customerCif: customers[0]?.cif || 'CIF-000101',
                });
                setShowColModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Create CBS Collateral
            </button>
          }
        />
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-[#5B6472]" />
              <input
                type="text"
                value={logSearchTerm}
                onChange={(e) => setLogSearchTerm(e.target.value)}
                placeholder="Search logs by Entity ID, Sync ID, or Error message..."
                className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[#5B6472] font-semibold">Result:</label>
              <select
                value={logResultFilter}
                onChange={(e) => setLogResultFilter(e.target.value as any)}
                className="p-1.5 border border-[#E2E8F0] rounded text-xs"
              >
                <option value="ALL">All Results</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="PARTIAL_SUCCESS">PARTIAL_SUCCESS</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[#5B6472] font-semibold">Entity:</label>
              <select
                value={logEntityFilter}
                onChange={(e) => setLogEntityFilter(e.target.value as any)}
                className="p-1.5 border border-[#E2E8F0] rounded text-xs"
              >
                <option value="ALL">All Entities</option>
                <option value="Customer">Customer</option>
                <option value="Facility">Facility</option>
                <option value="Collateral">Collateral</option>
                <option value="ALL">Batch / All</option>
              </select>
            </div>
            {(logSearchTerm || logResultFilter !== 'ALL' || logEntityFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setLogSearchTerm('');
                  setLogResultFilter('ALL');
                  setLogEntityFilter('ALL');
                }}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>

          <DataGrid
            title="CBS to CIMS Synchronization History"
            subtitle={`Showing ${filteredLogs.length} audit records with operational metrics`}
            data={filteredLogs}
            columns={logColumns}
            keyExtractor={(l) => l.id}
          />
        </div>
      )}

      {/* Customer Create/Edit Modal */}
      {showCustModal && selectedCust && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Create/Edit Simulated CBS Customer Master</h3>
                <p className="text-[11px] text-blue-200">CBS Source-System Customer Records</p>
              </div>
              <button onClick={() => setShowCustModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setModalError(null);
                if (!selectedCust.cif?.trim()) {
                  setModalError('Customer CIF is required.');
                  return;
                }
                if (!selectedCust.fullName?.trim()) {
                  setModalError('Customer Full Name is required.');
                  return;
                }
                try {
                  await onSaveCustomer(selectedCust);
                  setShowCustModal(false);
                } catch (err: any) {
                  setModalError(err?.message || 'Failed to save customer in CBS simulator.');
                }
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
            >
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="text-xs font-semibold">{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">CIF (Customer ID) (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCust.cif || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, cif: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Customer Type (M)</label>
                  <select
                    value={selectedCust.customerType || 'Individual'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, customerType: e.target.value as any })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Business">Business</option>
                    <option value="Government">Government</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Full Name / Business Name (M)</label>
                <input
                  type="text"
                  required
                  value={selectedCust.fullName || ''}
                  onChange={(e) => setSelectedCust({ ...selectedCust, fullName: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">National ID / Passport (O)</label>
                  <input
                    type="text"
                    value={selectedCust.nationalId || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, nationalId: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Business Reg No. (O)</label>
                  <input
                    type="text"
                    value={selectedCust.businessRegNo || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, businessRegNo: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Tax ID / TIN (O)</label>
                  <input
                    type="text"
                    value={selectedCust.taxIdNo || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, taxIdNo: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Date of Birth / Incorporation</label>
                  <input
                    type="date"
                    value={selectedCust.dobOrIncorp || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, dobOrIncorp: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Gender</label>
                  <select
                    value={selectedCust.gender || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, gender: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Customer Status (CBS Master)</label>
                  <select
                    value={selectedCust.customerStatus || 'Active'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, customerStatus: e.target.value as any })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-semibold"
                  >
                    <option value="Active">Active</option>
                    <option value="Dormant">Dormant</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Phone Number (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCust.phone || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, phone: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Email</label>
                  <input
                    type="email"
                    value={selectedCust.email || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, email: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Address / Registered Location</label>
                <textarea
                  rows={2}
                  value={selectedCust.address || ''}
                  onChange={(e) => setSelectedCust({ ...selectedCust, address: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Business Segment (M)</label>
                  <select
                    value={selectedCust.businessSegment || 'Corporate Banking'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, businessSegment: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Corporate Banking">Corporate Banking</option>
                    <option value="Retail Banking">Retail Banking</option>
                    <option value="MSME Banking">MSME Banking</option>
                    <option value="Interest-Free Banking (IFB)">Interest-Free Banking (IFB)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Branch (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCust.branch || 'Bole Special Branch'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, branch: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Risk Rating (CBS Master)</label>
                  <select
                    value={selectedCust.riskRating || 'Low'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, riskRating: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-semibold"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Watch">Watch</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowCustModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Facility Create/Edit Modal */}
      {showFacModal && selectedFac && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Create/Edit Simulated Facility (GETM_FACILITY)</h3>
                <p className="text-[11px] text-blue-200">Core Banking Facility Master Data</p>
              </div>
              <button onClick={() => setShowFacModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setModalError(null);
                if (!selectedFac.lineCode?.trim()) {
                  setModalError('Facility Line Code is required.');
                  return;
                }
                if (!selectedFac.loanRefNo?.trim()) {
                  setModalError('Loan Reference Number is required.');
                  return;
                }
                if (!selectedFac.customerCif?.trim()) {
                  setModalError('Customer CIF is required.');
                  return;
                }
                const cifExists = customers.some(
                  (c) => c.cif?.trim().toLowerCase() === selectedFac.customerCif?.trim().toLowerCase()
                );
                if (!cifExists) {
                  setModalError(`Customer with CIF "${selectedFac.customerCif}" does not exist in CBS customer master. Please create the customer first.`);
                  return;
                }
                if ((selectedFac.approvedLimit || 0) < 0) {
                  setModalError('Approved Limit cannot be negative.');
                  return;
                }
                if ((selectedFac.outstandingAmount || 0) < 0) {
                  setModalError('Outstanding Amount cannot be negative.');
                  return;
                }
                try {
                  await onSaveFacility(selectedFac);
                  setShowFacModal(false);
                } catch (err: any) {
                  setModalError(err?.message || 'Failed to save facility in CBS simulator.');
                }
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
            >
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="text-xs font-semibold">{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Line Code (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedFac.lineCode || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, lineCode: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Customer CIF (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedFac.customerCif || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, customerCif: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Loan Ref No. (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedFac.loanRefNo || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, loanRefNo: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Facility Type (M)</label>
                  <select
                    value={selectedFac.facilityType || 'Term Loan'}
                    onChange={(e) => setSelectedFac({ ...selectedFac, facilityType: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Term Loan">Term Loan</option>
                    <option value="Overdraft">Overdraft</option>
                    <option value="Revolving Credit">Revolving Credit</option>
                    <option value="Trade Finance">Trade Finance</option>
                    <option value="Mortgage">Mortgage</option>
                    <option value="Working Capital">Working Capital</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Line Currency</label>
                  <select
                    value={selectedFac.lineCurrency || 'ETB'}
                    onChange={(e) => setSelectedFac({ ...selectedFac, lineCurrency: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="ETB">ETB</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="revolvingLineCheckbox"
                    checked={!!selectedFac.revolvingLine}
                    onChange={(e) => setSelectedFac({ ...selectedFac, revolvingLine: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <label htmlFor="revolvingLineCheckbox" className="font-semibold text-[#101828]">Revolving Credit Line</label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Approved Limit (M)</label>
                  <input
                    type="number"
                    required
                    value={selectedFac.approvedLimit || 0}
                    onChange={(e) => {
                      const app = Number(e.target.value);
                      const out = selectedFac.outstandingAmount || 0;
                      setSelectedFac({ ...selectedFac, approvedLimit: app, availableAmount: Math.max(0, app - out) });
                    }}
                    className="w-full p-2 border border-[#E2E8F0] rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Outstanding Amount (M)</label>
                  <input
                    type="number"
                    required
                    value={selectedFac.outstandingAmount || 0}
                    onChange={(e) => {
                      const out = Number(e.target.value);
                      const app = selectedFac.approvedLimit || 0;
                      setSelectedFac({ ...selectedFac, outstandingAmount: out, availableAmount: Math.max(0, app - out) });
                    }}
                    className="w-full p-2 border border-[#E2E8F0] rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Available Amount (Derived)</label>
                  <input
                    type="number"
                    readOnly
                    value={selectedFac.availableAmount !== undefined ? selectedFac.availableAmount : Math.max(0, (selectedFac.approvedLimit || 0) - (selectedFac.outstandingAmount || 0))}
                    className="w-full p-2 border border-[#E2E8F0] bg-gray-50 rounded tabular-nums font-semibold text-gray-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Collateral Contribution</label>
                  <input
                    type="number"
                    value={selectedFac.collateralContribution || 0}
                    onChange={(e) => setSelectedFac({ ...selectedFac, collateralContribution: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E2E8F0] rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Collateral % Required</label>
                  <input
                    type="number"
                    value={selectedFac.collateralPct || 100}
                    onChange={(e) => setSelectedFac({ ...selectedFac, collateralPct: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E2E8F0] rounded tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Business Segment (M)</label>
                  <select
                    value={selectedFac.businessSegment || 'Corporate Banking'}
                    onChange={(e) => setSelectedFac({ ...selectedFac, businessSegment: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Corporate Banking">Corporate Banking</option>
                    <option value="Retail Banking">Retail Banking</option>
                    <option value="MSME Banking">MSME Banking</option>
                    <option value="Interest-Free Banking (IFB)">Interest-Free Banking (IFB)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Branch (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedFac.branch || 'Bole Special Branch'}
                    onChange={(e) => setSelectedFac({ ...selectedFac, branch: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Relationship Manager</label>
                  <input
                    type="text"
                    value={selectedFac.relationshipManager || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, relationshipManager: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Start Date (M)</label>
                  <input
                    type="date"
                    required
                    value={selectedFac.lineStartDate || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, lineStartDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Expiry Date (M)</label>
                  <input
                    type="date"
                    required
                    value={selectedFac.lineExpiryDate || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, lineExpiryDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Next Review Date</label>
                  <input
                    type="date"
                    value={selectedFac.nextReviewDate || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, nextReviewDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Limit Status (CBS Master)</label>
                <select
                  value={selectedFac.limitStatus || 'Active'}
                  onChange={(e) => setSelectedFac({ ...selectedFac, limitStatus: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-semibold"
                >
                  <option value="Active">Active</option>
                  <option value="Frozen">Frozen</option>
                  <option value="Closed">Closed</option>
                  <option value="Matured">Matured</option>
                  <option value="Default">Default</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowFacModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collateral Create/Edit Modal */}
      {showColModal && selectedCol && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Create/Edit Simulated Collateral (GETM_COLLAT)</h3>
                <p className="text-[11px] text-blue-200">Core Banking Collateral Master Data</p>
              </div>
              <button onClick={() => setShowColModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setModalError(null);
                if (!selectedCol.collateralCode?.trim()) {
                  setModalError('Collateral Code is required.');
                  return;
                }
                if (!selectedCol.customerCif?.trim()) {
                  setModalError('Customer CIF is required.');
                  return;
                }
                const cifExists = customers.some(
                  (c) => c.cif?.trim().toLowerCase() === selectedCol.customerCif?.trim().toLowerCase()
                );
                if (!cifExists) {
                  setModalError(`Customer with CIF "${selectedCol.customerCif}" does not exist in CBS customer master. Please create the customer first.`);
                  return;
                }
                const val = selectedCol.collateralValue || 0;
                if (val <= 0) {
                  setModalError('Collateral Value must be greater than zero.');
                  return;
                }
                const hc = selectedCol.haircut || 0;
                if (hc < 0 || hc > 100) {
                  setModalError('Haircut percentage must be between 0% and 100%.');
                  return;
                }
                const derivedLimit = Math.round(val * (1 - hc / 100));
                try {
                  await onSaveCollateral({
                    ...selectedCol,
                    limitContribution: derivedLimit,
                    currency: selectedCol.currency || 'ETB',
                    collateralType: selectedCol.collateralType || 'Building',
                    ownershipType: selectedCol.ownershipType || 'Borrower-owned',
                  });
                  setShowColModal(false);
                } catch (err: any) {
                  setModalError(err?.message || 'Failed to save collateral in CBS simulator.');
                }
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
            >
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span className="text-xs font-semibold">{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Collateral Code (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCol.collateralCode || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, collateralCode: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Customer CIF (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCol.customerCif || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, customerCif: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Description (M)</label>
                <textarea
                  required
                  rows={2}
                  value={selectedCol.description || ''}
                  onChange={(e) => setSelectedCol({ ...selectedCol, description: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Category (M)</label>
                  <select
                    value={selectedCol.category || 'Immovable Properties'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, category: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Immovable Properties">Immovable Properties</option>
                    <option value="Movable Properties">Movable Properties</option>
                    <option value="Business Mortgages">Business Mortgages</option>
                    <option value="Financial Assets">Financial Assets</option>
                    <option value="Agricultural/Other">Agricultural/Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Collateral Type (Asset Type)</label>
                  <select
                    value={selectedCol.collateralType || 'Building'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, collateralType: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Building">Building</option>
                    <option value="Vehicle">Vehicle</option>
                    <option value="Construction Machinery">Construction Machinery</option>
                    <option value="Industrial Machinery">Industrial Machinery</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Marketable Shares">Marketable Shares</option>
                    <option value="Treasury Bills">Treasury Bills</option>
                    <option value="Livestock">Livestock</option>
                    <option value="Warehouse Receipt">Warehouse Receipt</option>
                    <option value="IP Rights">IP Rights</option>
                    <option value="Cash Deposit">Cash Deposit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Ownership Type (M)</label>
                  <select
                    value={selectedCol.ownershipType || 'Borrower-owned'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, ownershipType: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Borrower-owned">Borrower-owned</option>
                    <option value="Third-party-owned">Third-party-owned</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Currency</label>
                  <select
                    value={selectedCol.currency || 'ETB'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, currency: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="ETB">ETB</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Collateral Value (M)</label>
                  <input
                    type="number"
                    required
                    value={selectedCol.collateralValue || 0}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const hc = selectedCol.haircut || 0;
                      setSelectedCol({ ...selectedCol, collateralValue: v, limitContribution: Math.round(v * (1 - hc / 100)) });
                    }}
                    className="w-full p-2 border border-[#E2E8F0] rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Haircut %</label>
                  <input
                    type="number"
                    value={selectedCol.haircut || 0}
                    onChange={(e) => {
                      const hc = Number(e.target.value);
                      const v = selectedCol.collateralValue || 0;
                      setSelectedCol({ ...selectedCol, haircut: hc, limitContribution: Math.round(v * (1 - hc / 100)) });
                    }}
                    className="w-full p-2 border border-[#E2E8F0] rounded tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Limit Contribution (Derived from Value & Haircut)</label>
                <input
                  type="number"
                  readOnly
                  value={Math.round((selectedCol.collateralValue || 0) * (1 - (selectedCol.haircut || 0) / 100))}
                  className="w-full p-2 border border-[#E2E8F0] bg-gray-50 rounded tabular-nums font-semibold text-gray-700"
                />
                <span className="text-[10px] text-gray-500">Calculated as Collateral Value × (1 - Haircut%)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Start Date (M)</label>
                  <input
                    type="date"
                    required
                    value={selectedCol.startDate || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, startDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Review Date</label>
                  <input
                    type="date"
                    value={selectedCol.reviewDate || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, reviewDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="tangibleCheckbox"
                    checked={selectedCol.tangible !== false}
                    onChange={(e) => setSelectedCol({ ...selectedCol, tangible: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <label htmlFor="tangibleCheckbox" className="font-semibold text-[#101828]">Tangible Asset</label>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Business Segment</label>
                  <select
                    value={selectedCol.businessSegment || 'Corporate Banking'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, businessSegment: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Corporate Banking">Corporate Banking</option>
                    <option value="Retail Banking">Retail Banking</option>
                    <option value="MSME Banking">MSME Banking</option>
                    <option value="Interest-Free Banking (IFB)">Interest-Free Banking (IFB)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Branch</label>
                  <input
                    type="text"
                    required
                    value={selectedCol.branch || 'Bole Special Branch'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, branch: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Linked Loan Reference(s)</label>
                  <input
                    type="text"
                    value={selectedCol.linkedLoanRefs || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, linkedLoanRefs: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Linked Account Number</label>
                  <input
                    type="text"
                    value={selectedCol.linkedAccountNo || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, linkedAccountNo: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Linkage Type</label>
                  <select
                    value={selectedCol.linkageType || 'Primary'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, linkageType: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Cross-Collateral">Cross-Collateral</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowColModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Inspection & Payload Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-300" />
                <div>
                  <h3 className="text-sm font-bold">Sync Operation Diagnostic Details</h3>
                  <p className="text-[11px] text-blue-200">Sync ID: {inspectedLog.id}</p>
                </div>
              </div>
              <button onClick={() => setInspectedLog(null)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
                  <span className="text-[#5B6472] block text-[11px]">Entity Domain</span>
                  <span className="font-bold text-[#101828] text-sm">{inspectedLog.entityType}</span>
                </div>
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
                  <span className="text-[#5B6472] block text-[11px]">Entity ID / Target</span>
                  <span className="font-bold font-mono text-[#101828] text-sm">{inspectedLog.entityId}</span>
                </div>
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
                  <span className="text-[#5B6472] block text-[11px]">Source System</span>
                  <span className="font-semibold text-[#101828]">{inspectedLog.sourceSystem || 'CBS_SIM'}</span>
                </div>
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
                  <span className="text-[#5B6472] block text-[11px]">Result Status</span>
                  <StatusChip label={inspectedLog.result} />
                </div>
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
                  <span className="text-[#5B6472] block text-[11px]">Start Time</span>
                  <span className="font-mono text-[#101828]">{inspectedLog.startTime ? inspectedLog.startTime.replace('T', ' ').substring(0, 19) : inspectedLog.timestamp?.replace('T', ' ').substring(0, 19)}</span>
                </div>
                <div className="bg-[#F8FAFC] p-2.5 rounded border border-[#E2E8F0]">
                  <span className="text-[#5B6472] block text-[11px]">Completion Time</span>
                  <span className="font-mono text-[#101828]">{inspectedLog.completionTime ? inspectedLog.completionTime.replace('T', ' ').substring(0, 19) : inspectedLog.timestamp?.replace('T', ' ').substring(0, 19)}</span>
                </div>
              </div>

              {/* Counts Breakdown if available */}
              {(inspectedLog.customerCount !== undefined || inspectedLog.recordsProcessed !== undefined) && (
                <div className="bg-[#F8FAFC] p-3 rounded border border-[#E2E8F0]">
                  <span className="font-bold text-[#101828] text-xs block mb-2">Batch Statistics</span>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#5B6472] block">Customers</span>
                      <span className="font-bold text-[#101828]">{inspectedLog.customerCount ?? '—'}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#5B6472] block">Facilities</span>
                      <span className="font-bold text-[#101828]">{inspectedLog.facilityCount ?? '—'}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#5B6472] block">Collaterals</span>
                      <span className="font-bold text-[#101828]">{inspectedLog.collateralCount ?? '—'}</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                      <span className="text-[10px] text-[#5B6472] block">Relationships</span>
                      <span className="font-bold text-[#101828]">{inspectedLog.relationshipCount ?? '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Information */}
              {inspectedLog.errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Error Diagnostic Log</span>
                  </div>
                  <pre className="text-[11px] whitespace-pre-wrap font-mono mt-1 overflow-x-auto">
                    {inspectedLog.errorMessage}
                  </pre>
                </div>
              )}

              {/* Payload Snapshot */}
              {inspectedLog.payloadJson && (
                <div>
                  <span className="font-bold text-[#101828] block mb-1">Payload / Execution Snapshot</span>
                  <pre className="bg-[#0F172A] text-slate-100 p-3 rounded font-mono text-[11px] overflow-x-auto max-h-48">
                    {inspectedLog.payloadJson}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setInspectedLog(null)}
                  className="btn-primary py-1.5 px-4"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
