import React, { useState, useEffect } from 'react';
import { CreditCard, Building2, Eye, ShieldCheck, AlertCircle, FileCheck, Layers, ArrowUpRight, Plus } from 'lucide-react';
import {
  LoanAccount,
  Customer,
  Collateral,
  LoanCollateralLink,
  InsurancePolicy,
  FacilityCollateralSummaryDto,
  CollateralFacilityLinkDto,
  UserSession,
} from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { CircularProgress } from '../layout/CircularProgress';
import { cimsApi } from '../../api/cimsApi';
import { CollateralFacilityLinkModal } from '../relationships/CollateralFacilityLinkModal';
import { RelationshipHistoryModal } from '../relationships/RelationshipHistoryModal';
import { CbsRelationshipReconcileModal } from '../relationships/CbsRelationshipReconcileModal';

interface FacilityManagerProps {
  facilities: LoanAccount[];
  customers: Customer[];
  collaterals: Collateral[];
  links: LoanCollateralLink[];
  policies: InsurancePolicy[];
  initialFacilityId?: string | null;
  currentUser?: UserSession;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
}

export const FacilityManager: React.FC<FacilityManagerProps> = ({
  facilities,
  customers,
  collaterals,
  links,
  policies,
  initialFacilityId,
  currentUser,
  onNavigate,
}) => {
  const [selectedFacility, setSelectedFacility] = useState<LoanAccount | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'collateral' | 'policies'>('details');

  const [securingSummary, setSecuringSummary] = useState<FacilityCollateralSummaryDto | null>(null);
  const [loadingSecuring, setLoadingSecuring] = useState<boolean>(false);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [linkModalMode, setLinkModalMode] = useState<'create' | 'edit'>('create');
  const [linkToEdit, setLinkToEdit] = useState<CollateralFacilityLinkDto | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyLinkId, setHistoryLinkId] = useState<string>('');
  const [historyRef, setHistoryRef] = useState<string>('');
  const [showReconcileModal, setShowReconcileModal] = useState<boolean>(false);

  const loadSecuringCollaterals = async (facId: string) => {
    setLoadingSecuring(true);
    try {
      const data = await cimsApi.getFacilitySecuringCollaterals(facId);
      setSecuringSummary(data);
    } catch (e) {
      console.warn('Failed to load securing collaterals:', e);
    } finally {
      setLoadingSecuring(false);
    }
  };

  useEffect(() => {
    if (selectedFacility) {
      loadSecuringCollaterals(selectedFacility.id);
    } else {
      setSecuringSummary(null);
    }
  }, [selectedFacility]);

  useEffect(() => {
    if (initialFacilityId && facilities.length > 0) {
      const found = facilities.find(
        (f) =>
          f.id === initialFacilityId ||
          f.lineCode === initialFacilityId ||
          f.loanReference === initialFacilityId
      );
      if (found) {
        setSelectedFacility(found);
        setShowDetailModal(true);
      }
    }
  }, [initialFacilityId, facilities]);

  const facilityColumns: ColumnDef<LoanAccount>[] = [
    { header: 'Line Code', accessorKey: 'lineCode', sortable: true },
    { header: 'Loan Ref No.', accessorKey: 'loanReference', sortable: true },
    {
      header: 'Customer',
      cell: (r) => {
        const cust = customers.find((c) => c.id === r.customerId || c.cif === r.customerId);
        return <span>{cust ? cust.name : r.customerId}</span>;
      },
      sortable: true,
    },
    { header: 'Facility Type', accessorKey: 'facilityType' },
    {
      header: 'Approved Limit',
      accessorKey: 'approvedLimit',
      align: 'right',
      cell: (r) => `${r.lineCurrency} ${r.approvedLimit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Outstanding',
      accessorKey: 'outstandingBalance',
      align: 'right',
      cell: (r) => `${r.lineCurrency} ${r.outstandingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      header: 'Pledged Collateral',
      cell: (r) => {
        const facLinks = links.filter((l) =>
          l.loanAccountId === r.id || l.facilityId === r.id ||
          l.loanAccountId === r.lineCode || l.facilityId === r.lineCode ||
          l.loanAccountId === r.loanReference || l.facilityId === r.loanReference
        );
        const colCount = facLinks.length;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFacility(r);
              setActiveTab('collateral');
              setShowDetailModal(true);
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
            title="View linked collateral"
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>{colCount} {colCount === 1 ? 'Asset' : 'Assets'}</span>
          </button>
        );
      },
    },
    {
      header: 'Insurance Coverage',
      cell: (r) => {
        const facLinks = links.filter((l) =>
          l.loanAccountId === r.id || l.facilityId === r.id ||
          l.loanAccountId === r.lineCode || l.facilityId === r.lineCode ||
          l.loanAccountId === r.loanReference || l.facilityId === r.loanReference
        );
        const colIds = facLinks.map((l) => l.collateralId);
        const facCols = collaterals.filter((c) => colIds.includes(c.id) || colIds.includes(c.code));
        const facColIds = facCols.map((c) => c.id);
        const facColCodes = facCols.map((c) => c.code);
        const facPolicies = policies.filter((p) =>
          p.collateralId && (facColIds.includes(p.collateralId) || facColCodes.includes(p.collateralId) || colIds.includes(p.collateralId))
        );
        const totalCover = facPolicies.reduce((sum, p) => sum + (p.insuredAmount || 0), 0);
        const isCovered = (r.outstandingBalance || 0) > 0 && totalCover >= (r.outstandingBalance || 0);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFacility(r);
              setActiveTab('policies');
              setShowDetailModal(true);
            }}
            className="flex items-center gap-1 text-[11px] font-semibold hover:underline"
            title="View securing insurance policies"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${facPolicies.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>{facPolicies.length} {facPolicies.length === 1 ? 'Policy' : 'Policies'}</span>
          </button>
        );
      },
    },
    { header: 'Segment', accessorKey: 'segment' },
    { header: 'Branch', accessorKey: 'branch' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (r) => <StatusChip label={r.status} />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFacility(r);
              setShowDetailModal(true);
            }}
            className="btn-ghost py-1 px-2 text-xs flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFacility(r);
              setLinkToEdit(null);
              setLinkModalMode('create');
              setShowLinkModal(true);
            }}
            className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded"
            title="Allocate collateral security to this loan"
          >
            <Plus className="w-3.5 h-3.5" />
            Allocate Collateral
          </button>
        </div>
      ),
    },
  ];

  // Linked collateral items for the selected facility (matching by id, lineCode, and loanReference)
  const facilityLinks = selectedFacility
    ? links.filter((l) =>
        l.loanAccountId === selectedFacility.id ||
        l.facilityId === selectedFacility.id ||
        l.loanAccountId === selectedFacility.lineCode ||
        l.facilityId === selectedFacility.lineCode ||
        l.loanAccountId === selectedFacility.loanReference ||
        l.facilityId === selectedFacility.loanReference
      )
    : [];

  const linkedColIds = facilityLinks.map((l) => l.collateralId);
  const linkedCollaterals = collaterals.filter((c) =>
    linkedColIds.includes(c.id) || linkedColIds.includes(c.code)
  );

  // Linked policies for all collaterals securing this facility
  const linkedColIdList = linkedCollaterals.map(c => c.id);
  const linkedColCodeList = linkedCollaterals.map(c => c.code);
  const linkedPolicies = policies.filter(p =>
    p.collateralId && (
      linkedColIdList.includes(p.collateralId) ||
      linkedColCodeList.includes(p.collateralId) ||
      linkedColIds.includes(p.collateralId)
    )
  );

  // Compute aggregate metrics
  const totalPledgedValue = linkedCollaterals.reduce((sum, c) => sum + (c.valuationAmount || 0), 0);
  const totalAllocatedSecurity = facilityLinks.reduce((sum, l) => sum + (l.allocatedAmount || l.linkedAmount || 0), 0);
  const totalInsuredAmount = linkedPolicies.reduce((sum, p) => sum + (p.insuredAmount || 0), 0);
  const outstandingExposure = selectedFacility?.outstandingBalance || 0;
  const coveragePct = outstandingExposure > 0 ? (totalInsuredAmount / outstandingExposure) * 100 : totalInsuredAmount > 0 ? 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <DataGrid
        title="Credit Facilities & Loans (GETM_FACILITY)"
        subtitle="Core Banking Credit Lines, Pledged Securities, and Insurance Adequacy"
        data={facilities}
        columns={facilityColumns}
        keyExtractor={(f) => f.id}
        onRowClick={(f) => {
          setSelectedFacility(f);
          setShowDetailModal(true);
        }}
      />

      {/* Facility Detail Modal */}
      {showDetailModal && selectedFacility && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
            <div className="p-5 bg-[#102E4A] text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">{selectedFacility.lineCode} — {selectedFacility.facilityType}</h2>
                  <StatusChip label={selectedFacility.status} />
                </div>
                <div className="text-xs text-blue-200 mt-1 flex gap-4">
                  <span>Loan Ref: {selectedFacility.loanReference}</span>
                  <span>Segment: {selectedFacility.segment}</span>
                  <span>Branch: {selectedFacility.branch}</span>
                  <span>Currency: {selectedFacility.lineCurrency}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLinkToEdit(null);
                    setLinkModalMode('create');
                    setShowLinkModal(true);
                  }}
                  className="btn-primary py-1 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1 font-semibold shadow-xs"
                  title="Allocate collateral security to this loan"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Allocate Collateral
                </button>
                <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-gray-300 text-lg ml-1">
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#E2E8F0] bg-[#EFF5FB] px-6 gap-2 pt-2">
              <button
                onClick={() => setActiveTab('details')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'details' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#102E4A]'
                }`}
              >
                Facility Details (CBS Core)
              </button>
              <button
                onClick={() => setActiveTab('collateral')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'collateral' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#102E4A]'
                }`}
              >
                Linked Collateral Securities ({linkedCollaterals.length})
              </button>
              <button
                onClick={() => setActiveTab('policies')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'policies' ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#102E4A]'
                }`}
              >
                Securing Insurance Policies ({linkedPolicies.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {activeTab === 'details' && (() => {
                const linkedCust = customers.find(c => c.id === selectedFacility.customerId || c.cif === selectedFacility.customerId);
                return (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 flex items-center justify-between">
                      <span><strong>CBS-Sourced Facility Master:</strong> Facility limits and parameters are ingested directly from Core Banking System. Derived values are system-calculated.</span>
                      <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-semibold text-[10px]">CBS SOURCE</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Relationship & Customer Identity */}
                      <div className="cims-card p-4 space-y-2.5">
                        <h4 className="font-bold text-[#101828] text-xs border-b border-[#E2E8F0] pb-1 uppercase tracking-wide">
                          Relationship & Customer
                        </h4>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Customer:</span>
                          <strong className="text-sm text-[#102E4A]">{linkedCust ? `${linkedCust.name} (${linkedCust.cif})` : selectedFacility.customerId}</strong>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Loan Reference:</span>
                            <strong className="font-mono text-[#102E4A]">{selectedFacility.loanReference}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Line Code:</span>
                            <strong className="font-mono text-[#102E4A]">{selectedFacility.lineCode}</strong>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Facility Type:</span>
                            <strong>{selectedFacility.facilityType}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Facility Currency:</span>
                            <strong className="font-semibold text-blue-800">{selectedFacility.lineCurrency || 'ETB'}</strong>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Business Segment:</span>
                            <strong>{selectedFacility.segment}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Operating Branch:</span>
                            <strong>{selectedFacility.branch}</strong>
                          </div>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Relationship Manager (RM):</span>
                          <strong>{selectedFacility.rmUserId || 'Assigned via Portfolio'}</strong>
                        </div>
                      </div>

                      {/* Limits & Balances */}
                      <div className="cims-card p-4 space-y-2.5">
                        <h4 className="font-bold text-[#101828] text-xs border-b border-[#E2E8F0] pb-1 uppercase tracking-wide">
                          Limits & Balances (Derived Exposure)
                        </h4>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Approved Limit:</span>
                          <strong className="text-sm tabular-nums text-[#102E4A]">
                            {selectedFacility.lineCurrency} {selectedFacility.approvedLimit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Outstanding Balance (Current Exposure):</span>
                          <strong className="text-sm tabular-nums text-[#102E4A] font-bold">
                            {selectedFacility.lineCurrency} {selectedFacility.outstandingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Available Amount (Derived):</span>
                          <strong className="text-sm tabular-nums text-emerald-700 font-bold">
                            {selectedFacility.lineCurrency} {(selectedFacility.availableAmount !== undefined ? selectedFacility.availableAmount : Math.max(0, (selectedFacility.approvedLimit || 0) - (selectedFacility.outstandingBalance || 0)))?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Revolving Line:</span>
                            <strong>{selectedFacility.revolvingLine ? 'Yes (Revolving)' : 'No (Non-Revolving)'}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Limit Status:</span>
                            <StatusChip label={selectedFacility.status} />
                          </div>
                        </div>
                      </div>

                      {/* Collateral Requirements & Contributions */}
                      <div className="cims-card p-4 space-y-2.5">
                        <h4 className="font-bold text-[#101828] text-xs border-b border-[#E2E8F0] pb-1 uppercase tracking-wide">
                          Collateral Requirements & Security
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Collateral Contribution:</span>
                            <strong className="tabular-nums">
                              {selectedFacility.lineCurrency} {(selectedFacility.collateralContribution || totalAllocatedSecurity)?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Collateral % Required:</span>
                            <strong className="tabular-nums font-semibold text-blue-700">
                              {selectedFacility.collateralPct !== undefined ? selectedFacility.collateralPct : 100}%
                            </strong>
                          </div>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Total Pledged Collateral Valuation:</span>
                          <strong className="tabular-nums text-[#101828]">
                            {selectedFacility.lineCurrency} {totalPledgedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Allocated Security Limits:</span>
                          <strong className="tabular-nums text-emerald-700">
                            {selectedFacility.lineCurrency} {totalAllocatedSecurity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      {/* Lifecycle & Review Schedule */}
                      <div className="cims-card p-4 space-y-2.5">
                        <h4 className="font-bold text-[#101828] text-xs border-b border-[#E2E8F0] pb-1 uppercase tracking-wide">
                          Lifecycle & Review Schedule
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Start Date:</span>
                            <strong className="font-medium text-gray-800">{selectedFacility.lineStartDate || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[11px]">Expiry / Maturity Date:</span>
                            <strong className="font-medium text-gray-800">{selectedFacility.lineExpiryDate || '—'}</strong>
                          </div>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[11px]">Next Review Date:</span>
                          <strong className="text-amber-800 font-semibold">{selectedFacility.nextReviewDueDate || '—'}</strong>
                        </div>
                        <div className="pt-2 text-[11px] text-gray-500">
                          Data ingested via CBS interface table GETM_FACILITY. Maintenance and changes are initiated from Core Banking.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {activeTab === 'collateral' && (
                <div className="space-y-4">
                  {/* Facility Collateral Summary Cards (Section 17 & 19) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-700" />
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                          Securing Collateral &amp; Relationship Security Allocation
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800">
                          {securingSummary?.linkedCollateralCount ?? linkedCollaterals.length} Collaterals Pledged
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReconcileModal(true)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 transition-colors"
                        >
                          🔄 CBS Reconciliation
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Facility Outstanding Exposure</span>
                        <strong className="text-slate-900 font-bold tabular-nums text-sm">
                          {selectedFacility.lineCurrency} {outstandingExposure.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Approved Limit: ETB {selectedFacility.approvedLimit?.toLocaleString()}</span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-blue-700 block text-[10px] uppercase font-semibold">Total Collateral Allocation</span>
                        <strong className="text-blue-800 font-bold tabular-nums text-sm">
                          {selectedFacility.lineCurrency} {(securingSummary?.totalAllocatedCollateral ?? totalAllocatedSecurity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-blue-600 block mt-0.5">Pledged Security Support</span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Total Net Collateral (NSV)</span>
                        <strong className="text-emerald-800 font-bold tabular-nums text-sm">
                          {selectedFacility.lineCurrency} {(securingSummary?.totalNetCollateralValue ?? (totalPledgedValue * 0.8)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-emerald-600 block mt-0.5">Valuation less haircut</span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Collateral Coverage %</span>
                        <strong className="text-indigo-900 font-bold tabular-nums text-sm">
                          {(securingSummary?.collateralCoveragePct ?? (outstandingExposure > 0 ? (totalAllocatedSecurity / outstandingExposure) * 100 : 0)).toFixed(1)}%
                        </strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Allocated / Outstanding</span>
                      </div>
                    </div>

                    {/* Facility Insurance Adequacy Bar */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            Insurance Adequacy for Facility Exposure
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Recognized Insurance:{' '}
                            <strong className="text-emerald-700">
                              ETB {(securingSummary?.totalRecognizedInsurance ?? totalInsuredAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                            {' • '}
                            Requirement:{' '}
                            <strong>
                              ETB {(securingSummary?.insuranceRequirement ?? outstandingExposure).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                            {' • '}
                            Insurance Gap:{' '}
                            <strong className={(securingSummary?.insuranceGap ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}>
                              ETB {(securingSummary?.insuranceGap ?? Math.max(0, outstandingExposure - totalInsuredAmount)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            (securingSummary?.adequacyStatus === 'ADEQUATE' || (!securingSummary && coveragePct >= 100))
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {securingSummary?.adequacyStatus || (coveragePct >= 100 ? 'Adequately Insured' : 'Underinsured')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table Header and Action */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-[#101828]">Securing Collateral Assets</h4>
                      <p className="text-[11px] text-[#5B6472]">
                        Collateral assets pledged to secure this credit line with allocation breakdowns (Section 17 &amp; 19)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkToEdit(null);
                        setLinkModalMode('create');
                        setShowLinkModal(true);
                      }}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Link Collateral
                    </button>
                  </div>

                  {/* Securing Collateral Grid */}
                  <div className="cims-card overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[950px]">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5">Collateral ID &amp; Code</th>
                          <th className="p-2.5">Category &amp; Type</th>
                          <th className="p-2.5">Ownership</th>
                          <th className="p-2.5 text-right">Market Valuation</th>
                          <th className="p-2.5 text-right">Haircut &amp; NSV</th>
                          <th className="p-2.5 text-right">Allocated Security</th>
                          <th className="p-2.5 text-right">% of Collateral</th>
                          <th className="p-2.5">Insurance Status</th>
                          <th className="p-2.5">Linkage Type</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {loadingSecuring ? (
                          <tr>
                            <td colSpan={10} className="p-6 text-center text-slate-500">
                              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              Loading securing collateral relationships...
                            </td>
                          </tr>
                        ) : (!securingSummary?.securingCollaterals || securingSummary.securingCollaterals.length === 0) ? (
                          <tr>
                            <td colSpan={10} className="p-6 text-center text-slate-500">
                              No collateral currently pledged for this facility.
                            </td>
                          </tr>
                        ) : (
                          securingSummary.securingCollaterals.map((c) => (
                            <tr key={c.id} className="hover:bg-[#EFF5FB]/60 group">
                              <td className="p-2.5 font-semibold text-[#102E4A]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onNavigate) {
                                      setShowDetailModal(false);
                                      onNavigate('collateral', { collateralId: c.collateralId, id: c.collateralId });
                                    }
                                  }}
                                  className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 font-mono text-left cursor-pointer"
                                  title="Click to view this collateral asset"
                                >
                                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{c.collateralCode || c.collateralId}</span>
                                  <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                                </button>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{c.collateralId}</div>
                              </td>
                              <td className="p-2.5">
                                <div className="font-medium text-slate-900">{c.collateralType || c.collateralCategory}</div>
                                <div className="text-[10px] text-slate-500">{c.collateralCategory}</div>
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-col gap-1 items-start">
                                  <div className="font-semibold text-slate-900 text-xs">
                                    {c.legalOwnerNames || (c.thirdParty ? 'Third-Party Pledgor' : 'Borrower')}
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      (c.thirdParty || c.collateralOwnerType === 'Third-party-owned')
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {(c.thirdParty || c.collateralOwnerType === 'Third-party-owned')
                                        ? `Third-Party${c.relationshipToBorrower ? `: ${c.relationshipToBorrower}` : ''}`
                                        : (c.collateralOwnerType || 'Borrower-owned')}
                                    </span>
                                    {c.ownershipVerificationStatus && (
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                        c.ownershipVerificationStatus === 'Verified'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : c.ownershipVerificationStatus === 'Rejected'
                                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}>
                                        {c.ownershipVerificationStatus}
                                      </span>
                                    )}
                                  </div>
                                  {c.pledgeAgreementRef && (
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      Ref: {c.pledgeAgreementRef}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-2.5 text-right tabular-nums">
                                ETB {Number(c.collateralValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5 text-right tabular-nums">
                                <div className="font-semibold text-slate-900">
                                  ETB {Number(c.netCollateralValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-slate-400">Haircut: {c.collateralHaircut || 0}%</div>
                              </td>
                              <td className="p-2.5 text-right tabular-nums font-bold text-blue-700">
                                ETB {Number(c.allocatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5 text-right tabular-nums font-semibold text-slate-700">
                                {Number(c.collateralAllocationPct || 0).toFixed(1)}%
                              </td>
                              <td className="p-2.5">
                                <StatusChip label={c.insuranceStatus || 'Adequately Insured'} />
                              </td>
                              <td className="p-2.5">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                  {c.linkageType || 'Primary'}
                                </span>
                              </td>
                              <td className="p-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShowDetailModal(false);
                                        onNavigate('collateral', { collateralId: c.collateralId, id: c.collateralId });
                                      }
                                    }}
                                    className="py-1 px-2 text-[10px] font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 rounded"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHistoryLinkId(c.id);
                                      setHistoryRef(`${c.collateralCode || c.collateralId} ↔ ${selectedFacility.loanReference}`);
                                      setShowHistoryModal(true);
                                    }}
                                    className="py-1 px-2 text-[10px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
                                  >
                                    📜 History
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLinkToEdit(c);
                                      setLinkModalMode('edit');
                                      setShowLinkModal(true);
                                    }}
                                    className="py-1 px-2 text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const reason = prompt(`Enter change reason for ending link with ${c.collateralCode || c.collateralId}:`, 'Obligation settled or facility closed');
                                      if (reason === null) return;
                                      try {
                                        await cimsApi.endCollateralFacilityLink(c.id, reason);
                                        loadSecuringCollaterals(selectedFacility.id);
                                      } catch (err: any) {
                                        alert(`Failed to end relationship: ${err.message || 'Error'}`);
                                      }
                                    }}
                                    className="py-1 px-2 text-[10px] font-semibold text-red-600 hover:text-red-800 border border-red-200 rounded"
                                  >
                                    End
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Bottom Relationship Summary (Section 19) */}
                  {securingSummary && (
                    <div className="p-3 bg-slate-100 rounded-lg border border-slate-200 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Linked Collaterals</span>
                        <strong className="text-slate-900 font-bold">{securingSummary.linkedCollateralCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Total Allocated Support</span>
                        <strong className="text-blue-800 font-bold">ETB {securingSummary.totalAllocatedCollateral?.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Total Net Collateral (NSV)</span>
                        <strong className="text-emerald-800 font-bold">ETB {securingSummary.totalNetCollateralValue?.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Aggregate Insurance</span>
                        <strong className="text-slate-900 font-bold">ETB {securingSummary.totalRecognizedInsurance?.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Insurance Requirement</span>
                        <strong className="text-slate-900 font-bold">ETB {securingSummary.insuranceRequirement?.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Insurance Gap</span>
                        <strong className={securingSummary.insuranceGap > 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                          ETB {securingSummary.insuranceGap?.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'policies' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[#101828]">Active Insurance Policies Securing Pledged Collateral</h4>
                    <span className="text-[11px] text-[#5B6472]">
                      Total Insured Amount: <strong className="text-emerald-700">ETB {totalInsuredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </span>
                  </div>
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5">Policy Number</th>
                          <th className="p-2.5">Insurer Name</th>
                          <th className="p-2.5">Coverage Type</th>
                          <th className="p-2.5 text-right">Insured Amount</th>
                          <th className="p-2.5">Collateral Code</th>
                          <th className="p-2.5">Expiry Date</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {linkedPolicies.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-6 text-[#5B6472]">
                              No insurance policies linked to the pledged collateral securing this facility.
                            </td>
                          </tr>
                        ) : (
                          linkedPolicies.map((p) => {
                            const col = collaterals.find(c => c.id === p.collateralId || c.code === p.collateralId);
                            return (
                              <tr key={p.id} className="hover:bg-[#EFF5FB] group">
                                <td className="p-2.5 font-semibold text-[#102E4A]">
                                  <button
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShowDetailModal(false);
                                        onNavigate('insurance', { policyId: p.id, id: p.id });
                                      }
                                    }}
                                    className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1.5 text-left cursor-pointer"
                                    title="Click to view policy details"
                                  >
                                    <FileCheck className="w-3.5 h-3.5 text-[#2C6295]" />
                                    <span>{p.policyNumber}</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                                  </button>
                                </td>
                                <td className="p-2.5">{p.insurerName}</td>
                                <td className="p-2.5">{p.coverageType}</td>
                                <td className="p-2.5 text-right tabular-nums font-bold text-emerald-700">
                                  ETB {p.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 font-mono">
                                  {col ? (
                                    <button
                                      onClick={() => {
                                        if (onNavigate) {
                                          setShowDetailModal(false);
                                          onNavigate('collateral', { collateralId: col.id, id: col.id });
                                        }
                                      }}
                                      className="font-bold text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1 cursor-pointer"
                                      title="Click to view this collateral asset"
                                    >
                                      <span>{col.code}</span>
                                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                                    </button>
                                  ) : (
                                    p.collateralId || '—'
                                  )}
                                </td>
                                <td className="p-2.5">{p.expiryDate}</td>
                                <td className="p-2.5"><StatusChip label={p.status} /></td>
                                <td className="p-2.5 text-right">
                                  <button
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShowDetailModal(false);
                                        onNavigate('insurance', { policyId: p.id, id: p.id });
                                      }
                                    }}
                                    className="btn-ghost py-0.5 px-2 text-[11px] text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-300 rounded inline-flex items-center gap-1"
                                  >
                                    View Policy <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module 3: Relationship Modals */}
      {showLinkModal && selectedFacility && (
        <CollateralFacilityLinkModal
          isOpen={showLinkModal}
          onClose={() => {
            setShowLinkModal(false);
            setLinkToEdit(null);
          }}
          onSuccess={() => {
            loadSecuringCollaterals(selectedFacility.id);
          }}
          currentUser={currentUser}
          mode={linkModalMode}
          existingLink={linkToEdit}
          preselectedFacilityId={selectedFacility.id}
          preselectedLoanAccountId={selectedFacility.id}
        />
      )}

      {showHistoryModal && selectedFacility && (
        <RelationshipHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          linkId={historyLinkId}
          loanReference={historyRef}
        />
      )}

      {showReconcileModal && (
        <CbsRelationshipReconcileModal
          isOpen={showReconcileModal}
          onClose={() => setShowReconcileModal(false)}
        />
      )}
    </div>
  );
};
