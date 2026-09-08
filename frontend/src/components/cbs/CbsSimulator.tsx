import React, { useState } from 'react';
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
} from 'lucide-react';
import { CbsCustomer, CbsFacility, CbsCollateral, CbsSyncLog } from '../../types';
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

  const handleSync = async (type: string, id: string) => {
    setSyncingId(id);
    try {
      await onSyncEntity(type, id);
    } finally {
      setSyncingId(null);
    }
  };

  const handleBatchSync = async () => {
    setBatchSyncing(true);
    try {
      await onSyncAll();
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
              setSelectedCust(r);
              setShowCustModal(true);
            }}
            className="btn-ghost py-1 px-2 text-xs"
          >
            Edit
          </button>
          <button
            onClick={() => handleSync('Customer', r.id)}
            disabled={syncingId === r.id}
            className="btn-primary py-1 px-2 text-xs"
          >
            <RotateCw className={`w-3 h-3 ${syncingId === r.id ? 'animate-spin' : ''}`} />
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
              setSelectedFac(r);
              setShowFacModal(true);
            }}
            className="btn-ghost py-1 px-2 text-xs"
          >
            Edit
          </button>
          <button
            onClick={() => handleSync('Facility', r.id)}
            disabled={syncingId === r.id}
            className="btn-primary py-1 px-2 text-xs"
          >
            <RotateCw className={`w-3 h-3 ${syncingId === r.id ? 'animate-spin' : ''}`} />
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
    { header: 'Type', accessorKey: 'collateralType' },
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
              setSelectedCol(r);
              setShowColModal(true);
            }}
            className="btn-ghost py-1 px-2 text-xs"
          >
            Edit
          </button>
          <button
            onClick={() => handleSync('Collateral', r.id)}
            disabled={syncingId === r.id}
            className="btn-primary py-1 px-2 text-xs"
          >
            <RotateCw className={`w-3 h-3 ${syncingId === r.id ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      ),
    },
  ];

  // Sync Log Columns
  const logColumns: ColumnDef<CbsSyncLog>[] = [
    {
      header: 'Timestamp',
      accessorKey: 'timestamp',
      cell: (r) => r.timestamp?.replace('T', ' ').substring(0, 19),
    },
    { header: 'Entity Type', accessorKey: 'entityType' },
    { header: 'Entity Code / ID', accessorKey: 'entityId' },
    { header: 'Direction', accessorKey: 'direction' },
    {
      header: 'Result',
      accessorKey: 'result',
      cell: (r) => <StatusChip label={r.result} />,
    },
    { header: 'Error Message', accessorKey: 'errorMessage', cell: (r) => r.errorMessage || '—' },
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
            Data entered here represents mock core-banking data for testing. Use <strong>Sync</strong> on any record or{' '}
            <strong>Sync All Pending</strong> to push it into CIMS.
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

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 bg-white px-4 pt-3 rounded-t-lg">
        <button
          onClick={() => setActiveTab('customers')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'customers' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Master ({customers.length})
        </button>
        <button
          onClick={() => setActiveTab('facilities')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'facilities' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Facility Master ({facilities.length})
        </button>
        <button
          onClick={() => setActiveTab('collaterals')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'collaterals' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Collateral Master ({collaterals.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'logs' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-text-primary'
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
                setSelectedCust({
                  cif: `CIF-${Math.floor(100000 + Math.random() * 900000)}`,
                  customerType: 'Individual',
                  customerStatus: 'Active',
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
                setSelectedFac({
                  lineCode: `FAC-${Math.floor(1000 + Math.random() * 9000)}`,
                  loanRefNo: `LN-CORP-2026-${Math.floor(100 + Math.random() * 900)}`,
                  facilityType: 'Term Loan',
                  lineCurrency: 'ETB',
                  approvedLimit: 10000000,
                  outstandingAmount: 7500000,
                  businessSegment: 'Corporate Banking',
                  branch: 'Bole Special Branch',
                  limitStatus: 'Active',
                  lineStartDate: '2026-01-01',
                  lineExpiryDate: '2029-01-01',
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
                setSelectedCol({
                  collateralCode: `COL-2026-${Math.floor(100000 + Math.random() * 900000)}`,
                  category: 'Immovable Properties',
                  collateralType: 'Borrower-owned',
                  currency: 'ETB',
                  collateralValue: 15000000,
                  haircut: 20,
                  businessSegment: 'Corporate Banking',
                  branch: 'Bole Special Branch',
                  startDate: '2026-01-15',
                  tangible: true,
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
        <DataGrid
          title="CBS to CIMS Synchronization History"
          subtitle="Detailed audit of every sync attempt and API payload"
          data={syncLogs}
          columns={logColumns}
          keyExtractor={(l) => l.id}
        />
      )}

      {/* Customer Create/Edit Modal */}
      {showCustModal && selectedCust && (
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold">Create/Edit Simulated CBS Customer</h3>
              <button onClick={() => setShowCustModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onSaveCustomer(selectedCust);
                setShowCustModal(false);
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">CIF (Customer ID) (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCust.cif || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, cif: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Customer Type (M)</label>
                  <select
                    value={selectedCust.customerType || 'Individual'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, customerType: e.target.value as any })}
                    className="w-full text-xs p-2 border border-border rounded"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Business">Business</option>
                    <option value="Government">Government</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Full / Business Name (M)</label>
                <input
                  type="text"
                  required
                  value={selectedCust.fullName || ''}
                  onChange={(e) => setSelectedCust({ ...selectedCust, fullName: e.target.value })}
                  className="w-full text-xs p-2 border border-border rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">National ID / Passport (O)</label>
                  <input
                    type="text"
                    value={selectedCust.nationalId || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, nationalId: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Business Reg No. (O)</label>
                  <input
                    type="text"
                    value={selectedCust.businessRegNo || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, businessRegNo: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Phone Number (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCust.phone || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, phone: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Email</label>
                  <input
                    type="email"
                    value={selectedCust.email || ''}
                    onChange={(e) => setSelectedCust({ ...selectedCust, email: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Business Segment (M)</label>
                  <select
                    value={selectedCust.businessSegment || 'Corporate Banking'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, businessSegment: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  >
                    <option value="Corporate Banking">Corporate Banking</option>
                    <option value="Retail Banking">Retail Banking</option>
                    <option value="MSME Banking">MSME Banking</option>
                    <option value="Interest-Free Banking (IFB)">Interest-Free Banking (IFB)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Branch (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCust.branch || 'Bole Special Branch'}
                    onChange={(e) => setSelectedCust({ ...selectedCust, branch: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold">Create/Edit Simulated Facility (GETM_FACILITY)</h3>
              <button onClick={() => setShowFacModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onSaveFacility(selectedFac);
                setShowFacModal(false);
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Line Code (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedFac.lineCode || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, lineCode: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Customer CIF (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedFac.customerCif || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, customerCif: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Loan Ref No. (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedFac.loanRefNo || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, loanRefNo: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Facility Type (M)</label>
                  <select
                    value={selectedFac.facilityType || 'Term Loan'}
                    onChange={(e) => setSelectedFac({ ...selectedFac, facilityType: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  >
                    <option value="Term Loan">Term Loan</option>
                    <option value="Overdraft">Overdraft</option>
                    <option value="Revolving Credit">Revolving Credit</option>
                    <option value="Trade Finance">Trade Finance</option>
                    <option value="Mortgage">Mortgage</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Approved Limit (M)</label>
                  <input
                    type="number"
                    required
                    value={selectedFac.approvedLimit || 0}
                    onChange={(e) => setSelectedFac({ ...selectedFac, approvedLimit: Number(e.target.value) })}
                    className="w-full text-xs p-2 border border-border rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Outstanding Amount (M)</label>
                  <input
                    type="number"
                    required
                    value={selectedFac.outstandingAmount || 0}
                    onChange={(e) => setSelectedFac({ ...selectedFac, outstandingAmount: Number(e.target.value) })}
                    className="w-full text-xs p-2 border border-border rounded tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Start Date (M)</label>
                  <input
                    type="date"
                    required
                    value={selectedFac.lineStartDate || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, lineStartDate: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Expiry Date (M)</label>
                  <input
                    type="date"
                    required
                    value={selectedFac.lineExpiryDate || ''}
                    onChange={(e) => setSelectedFac({ ...selectedFac, lineExpiryDate: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <h3 className="text-sm font-bold">Create/Edit Simulated Collateral (GETM_COLLAT)</h3>
              <button onClick={() => setShowColModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onSaveCollateral(selectedCol);
                setShowColModal(false);
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Collateral Code (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCol.collateralCode || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, collateralCode: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Customer CIF (M)</label>
                  <input
                    type="text"
                    required
                    value={selectedCol.customerCif || ''}
                    onChange={(e) => setSelectedCol({ ...selectedCol, customerCif: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">Description (M)</label>
                <textarea
                  required
                  rows={2}
                  value={selectedCol.description || ''}
                  onChange={(e) => setSelectedCol({ ...selectedCol, description: e.target.value })}
                  className="w-full text-xs p-2 border border-border rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Category (M)</label>
                  <select
                    value={selectedCol.category || 'Immovable Properties'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, category: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  >
                    <option value="Immovable Properties">Immovable Properties</option>
                    <option value="Movable Properties">Movable Properties</option>
                    <option value="Business Mortgages">Business Mortgages</option>
                    <option value="Financial Assets">Financial Assets</option>
                    <option value="Agricultural/Other">Agricultural/Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Owner Type (M)</label>
                  <select
                    value={selectedCol.collateralType || 'Borrower-owned'}
                    onChange={(e) => setSelectedCol({ ...selectedCol, collateralType: e.target.value })}
                    className="w-full text-xs p-2 border border-border rounded"
                  >
                    <option value="Borrower-owned">Borrower-owned</option>
                    <option value="Third-party-owned">Third-party-owned</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Collateral Value (M)</label>
                  <input
                    type="number"
                    required
                    value={selectedCol.collateralValue || 0}
                    onChange={(e) => setSelectedCol({ ...selectedCol, collateralValue: Number(e.target.value) })}
                    className="w-full text-xs p-2 border border-border rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">Haircut % (O)</label>
                  <input
                    type="number"
                    value={selectedCol.haircut || 0}
                    onChange={(e) => setSelectedCol({ ...selectedCol, haircut: Number(e.target.value) })}
                    className="w-full text-xs p-2 border border-border rounded tabular-nums"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
    </div>
  );
};
