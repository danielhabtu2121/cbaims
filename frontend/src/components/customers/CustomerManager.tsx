import React, { useState, useEffect, useMemo } from 'react';
import { Users, Eye, Plus, ShieldCheck, CreditCard, Building2, FileCheck, FolderOpen, History, AlertTriangle, CheckCircle, RefreshCw, ArrowUpRight, Shield, ExternalLink } from 'lucide-react';
import { Customer, LoanAccount, Collateral, InsurancePolicy, OwnershipDocument, UserSession, BusinessSegment, Branch, Customer360, WorkflowTask, CimsException, AuditLog, LoanCollateralLink } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { cimsApi } from '../../api/cimsApi';

interface CustomerManagerProps {
  customers: Customer[];
  facilities: LoanAccount[];
  collaterals: Collateral[];
  policies: InsurancePolicy[];
  documents: OwnershipDocument[];
  segments?: BusinessSegment[];
  branches?: Branch[];
  currentUser: UserSession;
  initialCustomerId?: string | null;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
  onRegisterManualCustomer: (cust: Partial<Customer>) => Promise<void>;
  onMaintainCustomer?: (customerId: string, changes: Record<string, any>) => Promise<void>;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({
  customers,
  facilities,
  collaterals,
  policies,
  documents,
  segments,
  branches,
  currentUser,
  initialCustomerId,
  onNavigate,
  onRegisterManualCustomer,
  onMaintainCustomer,
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customer360, setCustomer360] = useState<Customer360 | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [show360Modal, setShow360Modal] = useState(false);
  const [showManualRegModal, setShowManualRegModal] = useState(false);
  const [showMaintainModal, setShowMaintainModal] = useState(false);
  const [maintainFields, setMaintainFields] = useState<Partial<Customer>>({});
  const [maintainError, setMaintainError] = useState<string | null>(null);
  const [maintainSubmitting, setMaintainSubmitting] = useState(false);
  const [active360Tab, setActive360Tab] = useState<'overview' | 'facilities' | 'collateral' | 'policies' | 'documents' | 'approvals' | 'exceptions' | 'audit'>('overview');
  const [selected360Policy, setSelected360Policy] = useState<InsurancePolicy | null>(null);

  useEffect(() => {
    if (initialCustomerId && customers.length > 0) {
      const found = customers.find(
        (c) => c.id === initialCustomerId || c.cif === initialCustomerId
      );
      if (found) {
        load360Data(found);
      }
    }
  }, [initialCustomerId, customers]);

  const [newCust, setNewCust] = useState<Partial<Customer>>({
    cif: '',
    customerType: 'Individual',
    segment: segments?.find(s => s.active !== false)?.name || 'Corporate Banking',
    branch: currentUser.branch || 'Bole Special Branch',
    status: 'Active',
  });

  const isMakerRole = currentUser.canCreate !== false;
  const availableSegments = segments && segments.length ? segments.filter(s => s.active !== false) : [{ id: 'default-segment', name: currentUser.segment || 'Corporate Banking', active: true } as BusinessSegment];
  const availableBranches = branches && branches.length ? branches.filter(b => b.active !== false) : [{ id: 'current-branch', name: currentUser.branch || 'Bole Special Branch', active: true } as Branch];

  const canMaintain = isMakerRole && !!onMaintainCustomer;

  const openMaintainModal = (customer: Customer) => {
    setMaintainFields({
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      riskRating: customer.riskRating,
      segment: customer.segment,
      branch: customer.branch,
    });
    setMaintainError(null);
    setShowMaintainModal(true);
  };

  const submitMaintain = async () => {
    if (!selectedCustomer || !onMaintainCustomer) return;
    if (selectedCustomer.authStat && selectedCustomer.authStat !== 'A') {
      setMaintainError('This customer already has a transaction pending checker approval. Wait for it to clear before submitting another change.');
      return;
    }
    setMaintainSubmitting(true);
    setMaintainError(null);
    try {
      const changes: Record<string, any> = {};
      (Object.keys(maintainFields) as (keyof Customer)[]).forEach((k) => {
        if (maintainFields[k] !== (selectedCustomer as any)[k]) {
          changes[k as string] = maintainFields[k];
        }
      });
      if (Object.keys(changes).length === 0) {
        setMaintainError('No fields were changed.');
        setMaintainSubmitting(false);
        return;
      }
      await onMaintainCustomer(selectedCustomer.id, changes);
      setShowMaintainModal(false);
    } catch (e: any) {
      setMaintainError(e?.message || 'Unable to submit the change for approval.');
    } finally {
      setMaintainSubmitting(false);
    }
  };

  const load360Data = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShow360Modal(true);
    setLoading360(true);
    try {
      const data = await cimsApi.fetchCustomer360(customer.id);
      setCustomer360(data);
    } catch (err) {
      console.error('Failed to load customer 360 data:', err);
      // Fallback to local state
      const custCols = collaterals.filter(c => c.customerId === customer.id || c.customerId === customer.cif);
      const custColIds = new Set(custCols.flatMap(c => [c.id, c.code].filter(Boolean) as string[]));
      setCustomer360({
        customer,
        facilities: facilities.filter(f => f.customerId === customer.id || f.customerId === customer.cif),
        collaterals: custCols,
        collateralFacilityLinks: [],
        insurancePolicies: policies.filter(p => (customer.id && p.customerId === customer.id) || (customer.cif && p.customerId === customer.cif) || (p.collateralId && custColIds.has(p.collateralId))),
        documents: documents.filter(d => d.entityId === customer.id),
        pendingApprovals: [],
        exceptions: [],
        auditHistory: [],
      });
    } finally {
      setLoading360(false);
    }
  };

  const customerColumns: ColumnDef<Customer>[] = [
    { header: 'CIF', accessorKey: 'cif', sortable: true },
    { header: 'Customer Name', accessorKey: 'name', sortable: true },
    { header: 'Type', accessorKey: 'customerType' },
    { header: 'Segment', accessorKey: 'segment' },
    { header: 'Branch', accessorKey: 'branch' },
    { header: 'Phone', accessorKey: 'phone' },
    {
      header: 'Linked Facilities',
      align: 'center',
      cell: (r) => {
        const count = facilities.filter((f) => f.customerId === r.id || f.customerId === r.cif).length;
        return <span className="font-semibold tabular-nums">{count}</span>;
      },
    },
    {
      header: 'Linked Collateral',
      align: 'center',
      cell: (r) => {
        const count = collaterals.filter((c) => c.customerId === r.id || c.customerId === r.cif).length;
        return <span className="font-semibold tabular-nums">{count}</span>;
      },
    },
    {
      header: 'Active Policies',
      align: 'center',
      cell: (r) => {
        const custColIds = collaterals.filter((c) => c.customerId === r.id || c.customerId === r.cif).map((c) => c.id);
        const count = policies.filter((p) => p.customerId === r.id || p.customerId === r.cif || custColIds.includes(p.collateralId)).length;
        return <span className="font-semibold tabular-nums">{count}</span>;
      },
    },
    {
      header: 'Source',
      accessorKey: 'source',
      cell: (r) => (
        <span style={{ fontSize: '11px', color: '#5B6B82', fontWeight: 600 }}>
          {r.source === 'CBS_SIM' ? 'CBS-Synced' : 'Manual'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (r) => <StatusChip label={r.status} />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            load360Data(r);
          }}
          className="btn-secondary py-1 px-2.5 text-xs text-[#00205B] hover:text-[#00205B] font-semibold flex items-center gap-1.5 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View 360
        </button>
      ),
    },
  ];

  const currentFacilities = customer360?.facilities || facilities.filter(f => selectedCustomer && (f.customerId === selectedCustomer.id || f.customerId === selectedCustomer.cif));
  const currentCollaterals = customer360?.collaterals || collaterals.filter(c => selectedCustomer && (c.customerId === selectedCustomer.id || c.customerId === selectedCustomer.cif));

  const customerCollateralIds = useMemo(() => {
    const ids = new Set<string>();
    currentCollaterals.forEach(c => {
      if (c.id) ids.add(c.id.trim().toLowerCase());
      if (c.code) ids.add(c.code.trim().toLowerCase());
    });
    return ids;
  }, [currentCollaterals]);

  const currentPolicies = useMemo(() => {
    if (customer360?.insurancePolicies && customer360.insurancePolicies.length > 0) {
      return customer360.insurancePolicies;
    }
    const map = new Map<string, InsurancePolicy>();
    policies.forEach(p => {
      let matched = false;
      if (selectedCustomer) {
        const scId = (selectedCustomer.id || '').trim().toLowerCase();
        const scCif = (selectedCustomer.cif || '').trim().toLowerCase();
        const pCust = (p.customerId || '').trim().toLowerCase();
        if (pCust && (pCust === scId || pCust === scCif)) matched = true;
      }
      if (p.collateralId && customerCollateralIds.has(p.collateralId.trim().toLowerCase())) {
        matched = true;
      }
      if (matched && p.id) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values());
  }, [customer360?.insurancePolicies, policies, selectedCustomer, customerCollateralIds]);

  const currentDocuments = customer360?.documents || documents.filter(d => selectedCustomer && d.entityId === selectedCustomer.id);
  const currentLinks = customer360?.collateralFacilityLinks || [];
  const currentApprovals = customer360?.pendingApprovals || [];
  const currentExceptions = customer360?.exceptions || [];
  const currentAudits = customer360?.auditHistory || [];

  const totalFacilityLimit = currentFacilities.reduce((sum, f) => sum + (f.approvedLimit || 0), 0);
  const totalOutstanding = currentFacilities.reduce((sum, f) => sum + (f.outstandingBalance || 0), 0);
  const totalCollateralVal = currentCollaterals.reduce((sum, c) => sum + (c.valuationAmount || 0), 0);
  const totalInsuredAmt = currentPolicies.reduce((sum, p) => sum + (p.insuredAmount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <DataGrid
        title="Customer Master & 360 View"
        subtitle="Comprehensive Single Customer View across Credit Facilities, Pledged Collateral, Insurance Coverages, and Approvals"
        data={customers}
        columns={customerColumns}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => load360Data(c)}
        actions={
          isMakerRole ? (
            <button
              onClick={() => {
                setNewCust({
                  cif: '',
                  customerType: 'Individual',
                  segment: 'Corporate Banking',
                  branch: currentUser.branch || 'Bole Special Branch',
                  status: 'Active',
                });
                setShowManualRegModal(true);
              }}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Customer Manually
            </button>
          ) : undefined
        }
      />

      {/* Customer 360 Modal */}
      {show360Modal && selectedCustomer && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-6xl w-full h-[90vh] max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-start shrink-0">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">{selectedCustomer.name}</h2>
                  <StatusChip label={selectedCustomer.status} />
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/20 font-medium">
                    {selectedCustomer.segment}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1 flex gap-4">
                  <span>CIF: <strong className="text-white">{selectedCustomer.cif}</strong></span>
                  <span>Branch: <strong className="text-white">{selectedCustomer.branch}</strong></span>
                  <span>Source: <strong className="text-white">{selectedCustomer.source === 'CBS_SIM' ? 'CBS Core' : 'Manual Entry'}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {canMaintain && (
                  <button
                    onClick={() => openMaintainModal(selectedCustomer)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#D48806] hover:bg-[#b87405] text-white shadow-xs transition-colors"
                    title="Submit a change to this customer for checker approval"
                  >
                    Maintain / Edit
                  </button>
                )}
                <button
                  onClick={() => load360Data(selectedCustomer)}
                  className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition"
                  title="Refresh 360 Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading360 ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => setShow360Modal(false)} className="text-slate-300 hover:text-white text-lg font-bold">
                  ✕
                </button>
              </div>
            </div>

            {/* Quick KPI Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-50 border-b border-slate-200 p-3.5 text-center text-xs shrink-0 gap-3">
              <div className="min-w-0">
                <div className="text-slate-500 text-[11px] font-semibold truncate">Total Approved Limits</div>
                <div className="text-[#00205B] font-bold text-sm tabular-nums truncate">ETB {totalFacilityLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="min-w-0">
                <div className="text-slate-500 text-[11px] font-semibold truncate">Total Outstanding Exposure</div>
                <div className="text-[#00205B] font-bold text-sm tabular-nums truncate">ETB {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="min-w-0">
                <div className="text-slate-500 text-[11px] font-semibold truncate">Collateral Valuation</div>
                <div className="text-emerald-700 font-bold text-sm tabular-nums truncate">ETB {totalCollateralVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="min-w-0">
                <div className="text-slate-500 text-[11px] font-semibold truncate">Insured Coverage</div>
                <div className="text-[#00205B] font-bold text-sm tabular-nums truncate">ETB {totalInsuredAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* 360 Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 gap-2 pt-2 overflow-x-auto shrink-0 z-10 scrollbar-thin">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'facilities', label: `Facilities (${currentFacilities.length})` },
                { id: 'collateral', label: `Collateral (${currentCollaterals.length})` },
                { id: 'policies', label: `Insurance (${currentPolicies.length})` },
                { id: 'documents', label: `Documents (${currentDocuments.length})` },
                { id: 'approvals', label: `Approvals (${currentApprovals.length})` },
                { id: 'exceptions', label: `Exceptions (${currentExceptions.length})` },
                { id: 'audit', label: `Audit (${currentAudits.length})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActive360Tab(tab.id as any)}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${active360Tab === tab.id ? 'border-[#D48806] text-[#00205B] font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs min-w-0 max-w-full">
              {active360Tab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="cims-card p-4 space-y-2">
                    <h4 className="font-bold text-[#101828] text-xs border-b border-[#E2E8F0] pb-1">Customer Profile & KYC</h4>
                    <div><span className="text-[#5B6472]">Customer Type:</span> <strong>{selectedCustomer.customerType}</strong></div>
                    <div><span className="text-[#5B6472]">National ID / Passport:</span> <strong>{selectedCustomer.nationalId || '—'}</strong></div>
                    <div><span className="text-[#5B6472]">Business Registration No:</span> <strong>{selectedCustomer.businessRegNo || '—'}</strong></div>
                    <div><span className="text-[#5B6472]">TIN:</span> <strong>{selectedCustomer.taxIdNo || '—'}</strong></div>
                    <div><span className="text-[#5B6472]">Phone:</span> <strong>{selectedCustomer.phone}</strong></div>
                    <div><span className="text-[#5B6472]">Email:</span> <strong>{selectedCustomer.email || '—'}</strong></div>
                  </div>
                  <div className="cims-card p-4 space-y-2">
                    <h4 className="font-bold text-[#101828] text-xs border-b border-[#E2E8F0] pb-1">Portfolio & Risk Summary</h4>
                    <div><span className="text-[#5B6472]">Business Segment:</span> <strong>{selectedCustomer.segment}</strong></div>
                    <div><span className="text-[#5B6472]">Operating Branch:</span> <strong>{selectedCustomer.branch}</strong></div>
                    <div><span className="text-[#5B6472]">Risk Rating:</span> <strong>{selectedCustomer.riskRating || 'Medium'}</strong></div>
                    <div><span className="text-[#5B6472]">Credit Facilities Count:</span> <strong>{currentFacilities.length}</strong></div>
                    <div><span className="text-[#5B6472]">Collateral Assets Pledged:</span> <strong>{currentCollaterals.length}</strong></div>
                    <div><span className="text-[#5B6472]">Insurance Policies Active:</span> <strong>{currentPolicies.filter(p => p.status === 'Active').length}</strong></div>
                  </div>
                </div>
              )}

              {active360Tab === 'facilities' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[750px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Line Code / Ref</th>
                        <th className="p-2.5">Facility Type</th>
                        <th className="p-2.5 text-right">Approved Limit</th>
                        <th className="p-2.5 text-right">Outstanding</th>
                        <th className="p-2.5 text-right">Available</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentFacilities.length === 0 ? (
                        <tr><td colSpan={8} className="p-4 text-center text-[#5B6472]">No credit facilities found.</td></tr>
                      ) : (
                        currentFacilities.map((f) => (
                          <tr key={f.id} className="hover:bg-[#EFF5FB] group">
                            <td className="p-2.5 font-semibold">
                              <button
                                onClick={() => {
                                  if (onNavigate) {
                                    setShow360Modal(false);
                                    onNavigate('facilities', { facilityId: f.id, id: f.id });
                                  }
                                }}
                                className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer text-left"
                                title="Click to view facility details"
                              >
                                <span>{f.lineCode || f.loanReference}</span>
                                <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                              </button>
                            </td>
                            <td className="p-2.5">{f.facilityType}</td>
                            <td className="p-2.5 text-right tabular-nums font-semibold">
                              {f.lineCurrency || 'ETB'} {f.approvedLimit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right tabular-nums">
                              {f.lineCurrency || 'ETB'} {f.outstandingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right tabular-nums">
                              {f.lineCurrency || 'ETB'} {f.availableAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5">{f.lineExpiryDate || (f as any).maturityDate || '—'}</td>
                            <td className="p-2.5"><StatusChip label={f.status} /></td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => {
                                  if (onNavigate) {
                                    setShow360Modal(false);
                                    onNavigate('facilities', { facilityId: f.id, id: f.id });
                                  }
                                }}
                                className="btn-ghost py-0.5 px-2 text-[11px] text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-300 rounded inline-flex items-center gap-1"
                              >
                                View Facility <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {active360Tab === 'collateral' && (
                <div className="space-y-4">
                  <div className="cims-card overflow-x-auto w-full max-w-full">
                    <table className="w-full text-left text-xs min-w-[950px]">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5 whitespace-nowrap">Code</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5 whitespace-nowrap">Category</th>
                          <th className="p-2.5 text-right whitespace-nowrap">Market Value</th>
                          <th className="p-2.5 text-center whitespace-nowrap">Haircut %</th>
                          <th className="p-2.5 text-right whitespace-nowrap">Net Value</th>
                          <th className="p-2.5 text-right whitespace-nowrap">Allocated</th>
                          <th className="p-2.5 whitespace-nowrap">Insurance</th>
                          <th className="p-2.5 whitespace-nowrap">Status</th>
                          <th className="p-2.5 text-right whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {currentCollaterals.length === 0 ? (
                          <tr><td colSpan={10} className="p-4 text-center text-[#5B6472]">No collateral pledged.</td></tr>
                        ) : (
                          currentCollaterals.map((c) => {
                            const net = c.valuationAmount * (1.0 - ((c.haircut || 0) / 100.0));
                            const colPolicy = currentPolicies.find((p) =>
                              (p.collateralId && c.id && p.collateralId.trim().toLowerCase() === c.id.trim().toLowerCase()) ||
                              (p.collateralId && c.code && p.collateralId.trim().toLowerCase() === c.code.trim().toLowerCase())
                            ) || policies.find((p) =>
                              (p.collateralId && c.id && p.collateralId.trim().toLowerCase() === c.id.trim().toLowerCase()) ||
                              (p.collateralId && c.code && p.collateralId.trim().toLowerCase() === c.code.trim().toLowerCase())
                            );
                            return (
                              <tr key={c.id} className="hover:bg-[#EFF5FB] group">
                                <td className="p-2.5 font-semibold whitespace-nowrap">
                                  <button
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShow360Modal(false);
                                        onNavigate('collateral', { collateralId: c.id, id: c.id });
                                      }
                                    }}
                                    className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer text-left font-mono"
                                    title="Click to view collateral asset"
                                  >
                                    <span>{c.code}</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                                  </button>
                                  {/* Ownership Badge */}
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {(c.ownerType === 'Third Party' || (c.ownerCif && selectedCustomer && c.ownerCif !== selectedCustomer.cif)) ? (
                                      <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-medium border border-purple-200">
                                        Third-Party ({c.ownerName || c.ownerCif || 'External'})
                                      </span>
                                    ) : (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                                        Borrower-Owned
                                      </span>
                                    )}
                                    {currentLinks.filter(l => l.collateralId === c.id || (c.code && l.collateralCode === c.code)).length > 1 && (
                                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium border border-blue-200">
                                        Shared Asset ({currentLinks.filter(l => l.collateralId === c.id || (c.code && l.collateralCode === c.code)).length} Facilities)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5 max-w-[220px]">
                                  <div className="truncate font-medium text-slate-800" title={c.description}>{c.description}</div>
                                  {/* Secured Facilities list for shared / linked assets */}
                                  {(() => {
                                    const linkedFacs = currentLinks.filter(l => l.collateralId === c.id || (c.code && l.collateralCode === c.code));
                                    if (linkedFacs.length === 0) return null;
                                    return (
                                      <div className="mt-1 text-[10px] text-slate-500">
                                        <span className="font-semibold text-slate-700">Secures: </span>
                                        {linkedFacs.map((lf, idx) => (
                                          <span key={lf.id || idx} className="inline-block bg-slate-100 text-slate-700 px-1 rounded mr-1">
                                            {lf.accountNumber || lf.facilityId || lf.loanAccountId}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-2.5 whitespace-nowrap">{c.category}</td>
                                <td className="p-2.5 text-right tabular-nums whitespace-nowrap">
                                  {c.currency || 'ETB'} {c.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 text-center font-semibold whitespace-nowrap">{c.haircut || 0}%</td>
                                <td className="p-2.5 text-right tabular-nums font-semibold text-[#00205B] whitespace-nowrap">
                                  {c.currency || 'ETB'} {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 text-right tabular-nums whitespace-nowrap">
                                  {c.currency || 'ETB'} {(c.currentAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 whitespace-nowrap">
                                  {colPolicy ? (
                                    <button
                                      onClick={() => setSelected360Policy(colPolicy)}
                                      className="flex items-center gap-1 group/pol cursor-pointer text-left hover:opacity-85 transition"
                                      title={`Click to inspect policy: ${colPolicy.policyNumber}`}
                                    >
                                      <StatusChip label={c.insuranceStatus || colPolicy.status || 'Insured'} />
                                      <Eye className="w-3.5 h-3.5 text-blue-600 opacity-70 group-hover/pol:opacity-100" />
                                    </button>
                                  ) : (
                                    <StatusChip label={c.insuranceStatus || 'Uninsured'} />
                                  )}
                                </td>
                                <td className="p-2.5 whitespace-nowrap"><StatusChip label={c.status} /></td>
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShow360Modal(false);
                                        onNavigate('collateral', { collateralId: c.id, id: c.id });
                                      }
                                    }}
                                    className="btn-ghost py-0.5 px-2 text-[11px] text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-300 rounded inline-flex items-center gap-1"
                                  >
                                    View Collateral <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {currentLinks.length > 0 && (
                    <div className="cims-card p-4 space-y-2 bg-slate-50 border border-[#E2E8F0]">
                      <h4 className="font-bold text-[#101828] text-xs">Facility-Collateral Allocations</h4>
                      <div className="overflow-x-auto w-full max-w-full">
                        <table className="w-full text-left text-xs min-w-[750px]">
                          <thead className="text-[#5B6472] font-semibold border-b border-[#E2E8F0] pb-1">
                            <tr>
                              <th className="p-1.5 whitespace-nowrap">Facility Ref / Line</th>
                              <th className="p-1.5 whitespace-nowrap">Collateral</th>
                              <th className="p-1.5 whitespace-nowrap">Linkage Type</th>
                              <th className="p-1.5 text-right whitespace-nowrap">Allocated Security Amount</th>
                              <th className="p-1.5 whitespace-nowrap">Status</th>
                              <th className="p-1.5 text-right whitespace-nowrap">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {currentLinks.map(lnk => (
                              <tr key={lnk.id} className="hover:bg-white/80 group">
                                <td className="p-1.5 font-semibold whitespace-nowrap">
                                  <button
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShow360Modal(false);
                                        onNavigate('facilities', { facilityId: lnk.facilityId || lnk.loanAccountId, id: lnk.facilityId || lnk.loanAccountId });
                                      }
                                    }}
                                    className="font-bold text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1 cursor-pointer"
                                    title="Click to view facility"
                                  >
                                    <span>{lnk.facilityId || lnk.loanAccountId}</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-60" />
                                  </button>
                                </td>
                                <td className="p-1.5 whitespace-nowrap">
                                  <button
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShow360Modal(false);
                                        onNavigate('collateral', { collateralId: lnk.collateralId, id: lnk.collateralId });
                                      }
                                    }}
                                    className="font-bold text-blue-700 hover:text-blue-900 underline inline-flex items-center gap-1 cursor-pointer font-mono"
                                    title="Click to view collateral"
                                  >
                                    <span>{lnk.collateralId}</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-60" />
                                  </button>
                                </td>
                                <td className="p-1.5 whitespace-nowrap">{lnk.linkageType || 'Primary'}</td>
                                <td className="p-1.5 text-right tabular-nums font-semibold whitespace-nowrap">ETB {(lnk.linkedAmount || lnk.allocatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                <td className="p-1.5 whitespace-nowrap"><StatusChip label={lnk.status || 'Active'} /></td>
                                <td className="p-1.5 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => {
                                      if (onNavigate) {
                                        setShow360Modal(false);
                                        onNavigate('collateral', { collateralId: lnk.collateralId, id: lnk.collateralId });
                                      }
                                    }}
                                    className="btn-ghost py-0.5 px-1.5 text-[10px] text-blue-700 hover:text-blue-900 border border-blue-200 rounded inline-flex items-center gap-0.5"
                                  >
                                    Asset <ArrowUpRight className="w-2.5 h-2.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {active360Tab === 'policies' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[780px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Policy Number</th>
                        <th className="p-2.5">Linked Collateral</th>
                        <th className="p-2.5">Insurer</th>
                        <th className="p-2.5">Coverage Type</th>
                        <th className="p-2.5 text-right">Insured Amount</th>
                        <th className="p-2.5 text-right">Annual Premium</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5 text-center">Adequacy</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentPolicies.length === 0 ? (
                        <tr><td colSpan={10} className="p-6 text-center text-[#5B6472]">No insurance policies found for this customer or pledged assets.</td></tr>
                      ) : (
                        currentPolicies.map((p) => {
                          const matchedCol = currentCollaterals.find(c =>
                            (c.id && p.collateralId && c.id.trim().toLowerCase() === p.collateralId.trim().toLowerCase()) ||
                            (c.code && p.collateralId && c.code.trim().toLowerCase() === p.collateralId.trim().toLowerCase())
                          ) || collaterals.find(c =>
                            (c.id && p.collateralId && c.id.trim().toLowerCase() === p.collateralId.trim().toLowerCase()) ||
                            (c.code && p.collateralId && c.code.trim().toLowerCase() === p.collateralId.trim().toLowerCase())
                          );
                          const isAdequate = matchedCol && matchedCol.valuationAmount > 0
                            ? (p.insuredAmount || 0) >= matchedCol.valuationAmount
                            : null;

                          return (
                            <tr key={p.id} className="hover:bg-[#EFF5FB] group">
                              <td className="p-2.5 font-semibold">
                                <button
                                  onClick={() => setSelected360Policy(p)}
                                  className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1 cursor-pointer text-left"
                                  title="Click to inspect policy preview"
                                >
                                  <span>{p.policyNumber}</span>
                                  <Eye className="w-3 h-3 opacity-60 group-hover:opacity-100 text-blue-600" />
                                </button>
                              </td>
                              <td className="p-2.5">
                                {matchedCol ? (
                                  <span className="font-mono text-xs font-bold text-[#00205B]" title={matchedCol.description}>
                                    {matchedCol.code}
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-mono text-[11px]">{p.collateralId || '—'}</span>
                                )}
                              </td>
                              <td className="p-2.5">{p.insurerName}</td>
                              <td className="p-2.5">{p.coverageType}</td>
                              <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">
                                ETB {p.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5 text-right tabular-nums">
                                ETB {p.premium?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5">{p.expiryDate}</td>
                              <td className="p-2.5 text-center">
                                {isAdequate === true && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Adequate</span>
                                )}
                                {isAdequate === false && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Under-Insured</span>
                                )}
                                {isAdequate === null && (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="p-2.5"><StatusChip label={p.status} /></td>
                              <td className="p-2.5 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  onClick={() => setSelected360Policy(p)}
                                  className="btn-ghost py-0.5 px-2 text-[11px] text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-300 rounded inline-flex items-center gap-1"
                                  title="Inspect policy details inside 360 view"
                                >
                                  <Eye className="w-3 h-3" /> Quick View
                                </button>
                                {onNavigate && (
                                  <button
                                    onClick={() => {
                                      setShow360Modal(false);
                                      onNavigate('insurance', { policyId: p.id, id: p.id });
                                    }}
                                    className="btn-ghost py-0.5 px-2 text-[11px] text-slate-700 hover:text-[#00205B] border border-slate-200 hover:border-slate-300 rounded inline-flex items-center gap-1"
                                    title="Open policy in full Insurance Manager"
                                  >
                                    <ExternalLink className="w-3 h-3 text-slate-500" /> Full Manage
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
              )}

              {active360Tab === 'documents' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Document Title</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Version</th>
                        <th className="p-2.5">Upload Date</th>
                        <th className="p-2.5">Verification</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentDocuments.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-[#5B6472]">No documents uploaded.</td></tr>
                      ) : (
                        currentDocuments.map((d) => (
                          <tr key={d.id} className="hover:bg-[#EFF5FB]">
                            <td className="p-2.5 font-semibold">{d.name}</td>
                            <td className="p-2.5">{d.type}</td>
                            <td className="p-2.5">v{d.version || 1}</td>
                            <td className="p-2.5">{d.uploadDate?.substring(0, 10)}</td>
                            <td className="p-2.5"><StatusChip label={d.verificationStatus || 'Pending'} /></td>
                            <td className="p-2.5"><StatusChip label={d.status} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {active360Tab === 'approvals' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Action Type</th>
                        <th className="p-2.5">Entity</th>
                        <th className="p-2.5">Maker</th>
                        <th className="p-2.5">Assigned Checker Role</th>
                        <th className="p-2.5">Submitted At</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentApprovals.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-[#5B6472]">No pending approvals for this customer.</td></tr>
                      ) : (
                        currentApprovals.map((a) => (
                          <tr key={a.id} className="hover:bg-[#EFF5FB]">
                            <td className="p-2.5 font-semibold">{a.actionType}</td>
                            <td className="p-2.5">{a.entityType} ({a.entityId})</td>
                            <td className="p-2.5">{a.makerId}</td>
                            <td className="p-2.5 font-semibold text-[#00205B]">{a.candidateRole}</td>
                            <td className="p-2.5">{a.submittedAt}</td>
                            <td className="p-2.5"><StatusChip label={a.status} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {active360Tab === 'exceptions' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Severity</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Assigned Role</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentExceptions.length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center text-[#5B6472]">No exceptions logged for this customer.</td></tr>
                      ) : (
                        currentExceptions.map((exc) => (
                          <tr key={exc.id} className="hover:bg-[#EFF5FB]">
                            <td className="p-2.5 font-semibold">{exc.exceptionType}</td>
                            <td className="p-2.5"><StatusChip label={exc.severity} /></td>
                            <td className="p-2.5">{exc.description}</td>
                            <td className="p-2.5">{exc.assignedToRole}</td>
                            <td className="p-2.5"><StatusChip label={exc.status} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {active360Tab === 'audit' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[750px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Timestamp</th>
                        <th className="p-2.5">Actor</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">Field</th>
                        <th className="p-2.5">Old Value</th>
                        <th className="p-2.5">New Value</th>
                        <th className="p-2.5">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentAudits.length === 0 ? (
                        <tr><td colSpan={7} className="p-4 text-center text-[#5B6472]">No audit entries found.</td></tr>
                      ) : (
                        currentAudits.map((aud) => (
                          <tr key={aud.id} className="hover:bg-[#EFF5FB]">
                            <td className="p-2.5 font-mono text-[11px]">{aud.timestamp?.substring(0, 19)}</td>
                            <td className="p-2.5">{aud.userId} ({aud.roleCode})</td>
                            <td className="p-2.5 font-semibold">{aud.actionType}</td>
                            <td className="p-2.5">{aud.fieldName || '—'}</td>
                            <td className="p-2.5 text-[#5B6472]">{aud.oldValue || '—'}</td>
                            <td className="p-2.5 font-semibold">{aud.newValue || '—'}</td>
                            <td className="p-2.5">{aud.comments}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline Policy Details Modal within Customer 360 */}
      {selected360Policy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[70] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden text-xs">
            <div className="bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white p-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#D48806]" />
                  <h3 className="font-bold text-base">{selected360Policy.policyNumber}</h3>
                  <StatusChip label={selected360Policy.status} />
                </div>
                <p className="text-slate-300 text-xs mt-0.5">{selected360Policy.insurerName} • {selected360Policy.coverageType}</p>
              </div>
              <button
                onClick={() => setSelected360Policy(null)}
                className="text-white hover:text-slate-300 text-lg font-bold p-1"
                title="Close policy preview"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500">Sum Insured:</span>
                  <div className="font-bold text-sm text-emerald-700 tabular-nums">
                    ETB {selected360Policy.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Annual Premium:</span>
                  <div className="font-bold text-sm text-[#00205B] tabular-nums">
                    ETB {selected360Policy.premium?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Effective Date:</span>
                  <div className="font-medium text-slate-800">{selected360Policy.effectiveDate || '—'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Expiry Date:</span>
                  <div className="font-medium text-slate-800 flex items-center gap-1.5">
                    <span>{selected360Policy.expiryDate || '—'}</span>
                    {selected360Policy.expiryDate && new Date(selected360Policy.expiryDate) < new Date() && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Expired</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Linked Collateral Info */}
              {(() => {
                const matchedCol = currentCollaterals.find(c =>
                  (c.id && selected360Policy.collateralId && c.id.trim().toLowerCase() === selected360Policy.collateralId.trim().toLowerCase()) ||
                  (c.code && selected360Policy.collateralId && c.code.trim().toLowerCase() === selected360Policy.collateralId.trim().toLowerCase())
                ) || collaterals.find(c =>
                  (c.id && selected360Policy.collateralId && c.id.trim().toLowerCase() === selected360Policy.collateralId.trim().toLowerCase()) ||
                  (c.code && selected360Policy.collateralId && c.code.trim().toLowerCase() === selected360Policy.collateralId.trim().toLowerCase())
                );
                if (!matchedCol) return null;
                const covPct = matchedCol.valuationAmount > 0
                  ? ((selected360Policy.insuredAmount || 0) / matchedCol.valuationAmount) * 100
                  : 0;
                return (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                    <div className="font-bold text-xs text-[#00205B] flex items-center justify-between">
                      <span>Pledged Collateral Asset</span>
                      <span className="font-mono text-[#00205B] font-bold">{matchedCol.code}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Category:</span> {matchedCol.category}</div>
                      <div><span className="text-slate-500">Market Value:</span> ETB {matchedCol.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="col-span-2"><span className="text-slate-500">Asset Description:</span> {matchedCol.description}</div>
                      <div className="col-span-2 pt-1 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-slate-500">Insurance Coverage Ratio:</span>
                        <span className={`font-bold ${covPct >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {covPct.toFixed(1)}% {covPct >= 100 ? '(Adequate)' : '(Under-Insured)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">
                <div><span className="text-slate-500">Policy Version:</span> <strong>v{selected360Policy.version || 1}</strong></div>
                <div><span className="text-slate-500">Authorization:</span> <strong>{selected360Policy.authStat === 'A' ? 'Authorized' : 'Pending'}</strong></div>
                <div><span className="text-slate-500">Record Status:</span> <strong>{selected360Policy.recordStat === 'O' ? 'Open' : 'Closed'}</strong></div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => setSelected360Policy(null)}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Close Preview
              </button>
              {onNavigate && (
                <button
                  onClick={() => {
                    const polId = selected360Policy.id;
                    setSelected360Policy(null);
                    setShow360Modal(false);
                    onNavigate('insurance', { policyId: polId, id: polId });
                  }}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-[#00205B] hover:bg-[#0E284E] text-white rounded-lg font-semibold"
                >
                  <span>Open in Full Insurance Manager</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register Customer Manually Modal (Maker Action) */}
      {showManualRegModal && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Register Customer Manually</h3>
                <p className="text-[11px] text-slate-300">Routes to Checker Approval before activation</p>
              </div>
              <button onClick={() => setShowManualRegModal(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanCif = newCust.cif?.trim() ? newCust.cif.trim() : undefined;
                if (!cleanCif && !newCust.nationalId?.trim() && !newCust.taxIdNo?.trim() && !newCust.businessRegNo?.trim()) {
                  alert('National ID, TIN, or Business Registration Number is required when registering a non-CIF third-party owner.');
                  return;
                }
                const cleanCust = {
                  ...newCust,
                  cif: cleanCif,
                  identificationType: cleanCif ? 'CBS_CIF' : (newCust.nationalId?.trim() ? 'NATIONAL_ID' : (newCust.taxIdNo?.trim() ? 'TIN' : 'UNREGISTERED_THIRD_PARTY')),
                };
                await onRegisterManualCustomer(cleanCust);
                setShowManualRegModal(false);
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">
                    CIF (Customer ID) <span className="font-normal text-slate-500 text-[10px]">(Optional for 3rd-Party Owners)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CIF-102934 (Leave blank if third-party owner)"
                    value={newCust.cif || ''}
                    onChange={(e) => setNewCust({ ...newCust, cif: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Customer Type (M)</label>
                  <select
                    value={newCust.customerType || 'Individual'}
                    onChange={(e) => setNewCust({ ...newCust, customerType: e.target.value as any })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Business Organization">Business Organization</option>
                    <option value="Government Entity">Government Entity</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Full Name / Business Name (M)</label>
                <input
                  type="text"
                  required
                  value={newCust.name || ''}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              {/* Conditional fields based on Customer Type */}
              {newCust.customerType === 'Individual' ? (
                <>
                  <div>
                    <label className="block font-semibold text-[#101828] mb-1">Gender</label>
                    <select
                      value={newCust.gender || ''}
                      onChange={(e) => setNewCust({ ...newCust, gender: e.target.value })}
                      className="w-full p-2 border border-[#E2E8F0] rounded"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">National ID / Passport</label>
                      <input
                        type="text"
                        value={newCust.nationalId || ''}
                        onChange={(e) => setNewCust({ ...newCust, nationalId: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">Tax ID / TIN</label>
                      <input
                        type="text"
                        value={newCust.taxIdNo || ''}
                        onChange={(e) => setNewCust({ ...newCust, taxIdNo: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">Date of Incorporation</label>
                      <input
                        type="date"
                        value={newCust.dobOrIncorp || ''}
                        onChange={(e) => setNewCust({ ...newCust, dobOrIncorp: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">Business Registration Number</label>
                      <input
                        type="text"
                        value={newCust.businessRegNo || ''}
                        onChange={(e) => setNewCust({ ...newCust, businessRegNo: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#101828] mb-1">Tax ID / TIN</label>
                    <input
                      type="text"
                      value={newCust.taxIdNo || ''}
                      onChange={(e) => setNewCust({ ...newCust, taxIdNo: e.target.value })}
                      className="w-full p-2 border border-[#E2E8F0] rounded"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Phone Number (M)</label>
                  <input
                    type="text"
                    required
                    value={newCust.phone || ''}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newCust.email || ''}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Address / Registered Location</label>
                <textarea
                  value={newCust.address || ''}
                  onChange={(e) => setNewCust({ ...newCust, address: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Business Segment (M)</label>
                  <select
                    value={newCust.segment || 'Corporate Banking'}
                    onChange={(e) => setNewCust({ ...newCust, segment: e.target.value as any })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    {availableSegments.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Operating Branch (M)</label>
                  <select
                    value={newCust.branch || currentUser.branch || 'Bole Special Branch'}
                    onChange={(e) => setNewCust({ ...newCust, branch: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    {availableBranches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded text-[11px] text-blue-800">
                <strong>Controlled Organizational Assignment:</strong> District, RM, and RO are assigned systematically via organizational portfolio structures upon checker authorization.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowManualRegModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit to Checker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintain / Edit Customer Modal (Maker Action - post-registration amendment) */}
      {showMaintainModal && selectedCustomer && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Maintain Customer Details</h3>
                <p className="text-[11px] text-slate-300">{selectedCustomer.name} ({selectedCustomer.cif}) — changes route to Checker Approval</p>
              </div>
              <button onClick={() => setShowMaintainModal(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); submitMaintain(); }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
            >
              {maintainError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-2.5 text-[11px] font-medium">
                  {maintainError}
                </div>
              )}

              {/* Source System Classification Banner */}
              {selectedCustomer.source === 'CBS_SIM' || selectedCustomer.cbsSyncStatus ? (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center justify-between">
                  <span><strong>CBS-Originated Customer:</strong> Core master fields are synced from Core Banking and read-only.</span>
                  <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-semibold text-[10px]">CBS SOURCE</span>
                </div>
              ) : (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 flex items-center justify-between">
                  <span><strong>Manual / CIMS Originated Customer:</strong> Core identity master fields remain read-only post-authorization.</span>
                  <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded font-semibold text-[10px]">CIMS MANUAL</span>
                </div>
              )}

              {/* Read-Only Master Identity Section */}
              <div className="p-3 bg-gray-50 border border-[#E2E8F0] rounded space-y-2">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center justify-between">
                  <span>Customer Master Identity (Read-Only)</span>
                  <span className="text-[10px] text-gray-500 font-normal">Controlled Master Data</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500 block">CIF:</span>
                    <span className="font-semibold text-gray-800">{selectedCustomer.cif}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Customer Type:</span>
                    <span className="font-semibold text-gray-800">{selectedCustomer.customerType}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 block">Full / Business Name:</span>
                    <span className="font-semibold text-gray-800">{selectedCustomer.name}</span>
                  </div>
                  {selectedCustomer.taxIdNo && (
                    <div>
                      <span className="text-gray-500 block">TIN / Tax ID:</span>
                      <span className="font-semibold text-gray-800">{selectedCustomer.taxIdNo}</span>
                    </div>
                  )}
                  {selectedCustomer.nationalId && (
                    <div>
                      <span className="text-gray-500 block">National ID / Passport:</span>
                      <span className="font-semibold text-gray-800">{selectedCustomer.nationalId}</span>
                    </div>
                  )}
                  {selectedCustomer.businessRegNo && (
                    <div>
                      <span className="text-gray-500 block">Business Reg No:</span>
                      <span className="font-semibold text-gray-800">{selectedCustomer.businessRegNo}</span>
                    </div>
                  )}
                  {selectedCustomer.dobOrIncorp && (
                    <div>
                      <span className="text-gray-500 block">{selectedCustomer.customerType === 'Individual' ? 'Date of Birth' : 'Date of Incorporation'}:</span>
                      <span className="font-semibold text-gray-800">{selectedCustomer.dobOrIncorp}</span>
                    </div>
                  )}
                  {selectedCustomer.gender && (
                    <div>
                      <span className="text-gray-500 block">Gender:</span>
                      <span className="font-semibold text-gray-800">{selectedCustomer.gender}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Editable CIMS Maintenance Section */}
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide pt-1">
                CIMS-Maintained Relationship & Contact Details
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Phone (CIMS Maintained)</label>
                <input
                  value={maintainFields.phone || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, phone: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Email (CIMS Maintained)</label>
                <input
                  value={maintainFields.email || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, email: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Address (CIMS Maintained)</label>
                <textarea
                  value={maintainFields.address || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, address: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Risk Rating (CIMS Maintained)</label>
                  <select
                    value={maintainFields.riskRating || ''}
                    onChange={(e) => setMaintainFields({ ...maintainFields, riskRating: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    {['Low', 'Medium', 'High', 'Watch'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Segment (CIMS Maintained)</label>
                  <select
                    value={maintainFields.segment || ''}
                    onChange={(e) => setMaintainFields({ ...maintainFields, segment: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    {availableSegments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Operating Branch (CIMS Maintained)</label>
                <select
                  value={maintainFields.branch || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, branch: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                >
                  {availableBranches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button type="button" onClick={() => setShowMaintainModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={maintainSubmitting} className="btn-primary disabled:opacity-60">
                  {maintainSubmitting ? 'Submitting…' : 'Submit to Checker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
