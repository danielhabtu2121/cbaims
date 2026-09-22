import React, { useState, useEffect } from 'react';
import { Users, Eye, Plus, ShieldCheck, CreditCard, Building2, FileCheck, FolderOpen, History, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
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

  const [newCust, setNewCust] = useState<Partial<Customer>>({
    cif: `CIF-${Math.floor(100000 + Math.random() * 900000)}`,
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
      setCustomer360({
        customer,
        facilities: facilities.filter(f => f.customerId === customer.id || f.customerId === customer.cif),
        collaterals: collaterals.filter(c => c.customerId === customer.id || c.customerId === customer.cif),
        collateralFacilityLinks: [],
        insurancePolicies: policies.filter(p => p.customerId === customer.id || p.customerId === customer.cif),
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
          className="btn-ghost py-1 px-2.5 text-xs text-[#1F4E7A] font-semibold flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          View 360
        </button>
      ),
    },
  ];

  const currentFacilities = customer360?.facilities || facilities.filter(f => selectedCustomer && (f.customerId === selectedCustomer.id || f.customerId === selectedCustomer.cif));
  const currentCollaterals = customer360?.collaterals || collaterals.filter(c => selectedCustomer && (c.customerId === selectedCustomer.id || c.customerId === selectedCustomer.cif));
  const currentPolicies = customer360?.insurancePolicies || policies.filter(p => selectedCustomer && (p.customerId === selectedCustomer.id || p.customerId === selectedCustomer.cif));
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
                  cif: `CIF-${Math.floor(100000 + Math.random() * 900000)}`,
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
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 bg-[#102E4A] text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">{selectedCustomer.name}</h2>
                  <StatusChip label={selectedCustomer.status} />
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1F4E7A] text-white font-medium">
                    {selectedCustomer.segment}
                  </span>
                </div>
                <div className="text-xs text-blue-200 mt-1 flex gap-4">
                  <span>CIF: <strong>{selectedCustomer.cif}</strong></span>
                  <span>Branch: <strong>{selectedCustomer.branch}</strong></span>
                  <span>Source: <strong>{selectedCustomer.source === 'CBS_SIM' ? 'CBS Core' : 'Manual Entry'}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {canMaintain && (
                  <button
                    onClick={() => openMaintainModal(selectedCustomer)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-500/90 text-[#0B2237] hover:bg-amber-400 transition"
                    title="Submit a change to this customer for checker approval"
                  >
                    Maintain / Edit
                  </button>
                )}
                <button
                  onClick={() => load360Data(selectedCustomer)}
                  className="p-1.5 text-blue-200 hover:text-white rounded hover:bg-[#173F63] transition"
                  title="Refresh 360 Data"
                >
                  <RefreshCw className={`w-4 h-4 ${loading360 ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => setShow360Modal(false)} className="text-white hover:text-gray-300 text-lg font-bold">
                  ✕
                </button>
              </div>
            </div>

            {/* Quick KPI Bar */}
            <div className="grid grid-cols-4 bg-[#EFF5FB] border-b border-[#E2E8F0] p-3 text-center text-xs">
              <div>
                <div className="text-[#5B6472] text-[11px] font-semibold">Total Approved Limits</div>
                <div className="text-[#102E4A] font-bold text-sm tabular-nums">ETB {totalFacilityLimit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-[#5B6472] text-[11px] font-semibold">Total Outstanding Exposure</div>
                <div className="text-[#102E4A] font-bold text-sm tabular-nums">ETB {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-[#5B6472] text-[11px] font-semibold">Collateral Valuation</div>
                <div className="text-emerald-700 font-bold text-sm tabular-nums">ETB {totalCollateralVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div>
                <div className="text-[#5B6472] text-[11px] font-semibold">Insured Coverage</div>
                <div className="text-blue-700 font-bold text-sm tabular-nums">ETB {totalInsuredAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
            </div>

            {/* 360 Tabs */}
            <div className="flex border-b border-[#E2E8F0] bg-slate-50 px-6 gap-2 pt-2 overflow-x-auto">
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
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                    active360Tab === tab.id ? 'border-[#102E4A] text-[#102E4A]' : 'border-transparent text-[#5B6472] hover:text-[#101828]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {active360Tab === 'overview' && (
                <div className="grid grid-cols-2 gap-4">
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
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Line Code / Ref</th>
                        <th className="p-2.5">Facility Type</th>
                        <th className="p-2.5 text-right">Approved Limit</th>
                        <th className="p-2.5 text-right">Outstanding</th>
                        <th className="p-2.5 text-right">Available</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentFacilities.length === 0 ? (
                        <tr><td colSpan={7} className="p-4 text-center text-[#5B6472]">No credit facilities found.</td></tr>
                      ) : (
                        currentFacilities.map((f) => (
                          <tr key={f.id} className="hover:bg-[#EFF5FB]">
                            <td className="p-2.5 font-semibold">{f.lineCode || f.loanReference}</td>
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {active360Tab === 'collateral' && (
                <div className="space-y-4">
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5">Code</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-right">Market Value</th>
                          <th className="p-2.5 text-center">Haircut %</th>
                          <th className="p-2.5 text-right">Net Value</th>
                          <th className="p-2.5 text-right">Allocated</th>
                          <th className="p-2.5">Insurance</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {currentCollaterals.length === 0 ? (
                          <tr><td colSpan={9} className="p-4 text-center text-[#5B6472]">No collateral pledged.</td></tr>
                        ) : (
                          currentCollaterals.map((c) => {
                            const net = c.valuationAmount * (1.0 - ((c.haircut || 0) / 100.0));
                            return (
                              <tr key={c.id} className="hover:bg-[#EFF5FB]">
                                <td className="p-2.5 font-semibold">{c.code}</td>
                                <td className="p-2.5">{c.description}</td>
                                <td className="p-2.5">{c.category}</td>
                                <td className="p-2.5 text-right tabular-nums">
                                  {c.currency || 'ETB'} {c.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 text-center font-semibold">{c.haircut || 0}%</td>
                                <td className="p-2.5 text-right tabular-nums font-semibold text-[#102E4A]">
                                  {c.currency || 'ETB'} {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 text-right tabular-nums">
                                  {c.currency || 'ETB'} {(c.currentAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5"><StatusChip label={c.insuranceStatus || 'Uninsured'} /></td>
                                <td className="p-2.5"><StatusChip label={c.status} /></td>
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
                      <table className="w-full text-left text-xs">
                        <thead className="text-[#5B6472] font-semibold border-b border-[#E2E8F0] pb-1">
                          <tr>
                            <th className="p-1.5">Facility Ref / Line</th>
                            <th className="p-1.5">Collateral</th>
                            <th className="p-1.5">Linkage Type</th>
                            <th className="p-1.5 text-right">Allocated Security Amount</th>
                            <th className="p-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                          {currentLinks.map(lnk => (
                            <tr key={lnk.id}>
                              <td className="p-1.5 font-semibold">{lnk.facilityId || lnk.loanAccountId}</td>
                              <td className="p-1.5">{lnk.collateralId}</td>
                              <td className="p-1.5">{lnk.linkageType || 'Primary'}</td>
                              <td className="p-1.5 text-right tabular-nums font-semibold">ETB {(lnk.linkedAmount || lnk.allocatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="p-1.5"><StatusChip label={lnk.status || 'Active'} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {active360Tab === 'policies' && (
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Policy Number</th>
                        <th className="p-2.5">Insurer</th>
                        <th className="p-2.5">Coverage Type</th>
                        <th className="p-2.5 text-right">Insured Amount</th>
                        <th className="p-2.5 text-right">Annual Premium</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5">Version</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {currentPolicies.length === 0 ? (
                        <tr><td colSpan={8} className="p-4 text-center text-[#5B6472]">No insurance policies found.</td></tr>
                      ) : (
                        currentPolicies.map((p) => (
                          <tr key={p.id} className="hover:bg-[#EFF5FB]">
                            <td className="p-2.5 font-semibold">{p.policyNumber}</td>
                            <td className="p-2.5">{p.insurerName}</td>
                            <td className="p-2.5">{p.coverageType}</td>
                            <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">
                              ETB {p.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right tabular-nums">
                              ETB {p.premium?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5">{p.expiryDate}</td>
                            <td className="p-2.5 font-semibold">v{p.version || 1}</td>
                            <td className="p-2.5"><StatusChip label={p.status} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {active360Tab === 'documents' && (
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
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
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
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
                            <td className="p-2.5 font-semibold text-[#102E4A]">{a.candidateRole}</td>
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
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
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
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
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

      {/* Register Customer Manually Modal (Maker Action) */}
      {showManualRegModal && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Register Customer Manually</h3>
                <p className="text-[11px] text-blue-200">Routes to Checker Approval before activation</p>
              </div>
              <button onClick={() => setShowManualRegModal(false)} className="text-white hover:text-gray-300">✕</button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onRegisterManualCustomer(newCust);
                setShowManualRegModal(false);
              }}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">CIF (Customer ID) (M)</label>
                  <input
                    type="text"
                    required
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
                  value={newCust.name || ''}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">National ID / Passport (O)</label>
                  <input
                    type="text"
                    value={newCust.nationalId || ''}
                    onChange={(e) => setNewCust({ ...newCust, nationalId: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Business Reg No. (O)</label>
                  <input
                    type="text"
                    value={newCust.businessRegNo || ''}
                    onChange={(e) => setNewCust({ ...newCust, businessRegNo: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  />
                </div>
              </div>

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
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Maintain Customer Details</h3>
                <p className="text-[11px] text-blue-200">{selectedCustomer.name} ({selectedCustomer.cif}) — changes route to Checker Approval</p>
              </div>
              <button onClick={() => setShowMaintainModal(false)} className="text-white hover:text-gray-300">✕</button>
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
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Phone</label>
                <input
                  value={maintainFields.phone || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, phone: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Email</label>
                <input
                  value={maintainFields.email || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, email: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Address</label>
                <textarea
                  value={maintainFields.address || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, address: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Risk Rating</label>
                  <select
                    value={maintainFields.riskRating || ''}
                    onChange={(e) => setMaintainFields({ ...maintainFields, riskRating: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded"
                  >
                    {['Low', 'Medium', 'High', 'Watch'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Segment</label>
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
                <label className="block font-semibold text-[#101828] mb-1">Operating Branch</label>
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
