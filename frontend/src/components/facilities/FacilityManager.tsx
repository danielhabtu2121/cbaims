import React, { useState } from 'react';
import { CreditCard, Building2, Eye, ShieldCheck, AlertCircle, FileCheck, Layers } from 'lucide-react';
import { LoanAccount, Customer, Collateral, LoanCollateralLink, InsurancePolicy } from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { CircularProgress } from '../layout/CircularProgress';

interface FacilityManagerProps {
  facilities: LoanAccount[];
  customers: Customer[];
  collaterals: Collateral[];
  links: LoanCollateralLink[];
  policies: InsurancePolicy[];
}

export const FacilityManager: React.FC<FacilityManagerProps> = ({
  facilities,
  customers,
  collaterals,
  links,
  policies,
}) => {
  const [selectedFacility, setSelectedFacility] = useState<LoanAccount | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'collateral' | 'policies'>('details');

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
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFacility(r);
            setShowDetailModal(true);
          }}
          className="btn-ghost py-1 px-2 text-xs"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
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
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-border shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
            <div className="p-5 bg-brand-900 text-white flex justify-between items-start">
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
              <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-gray-300 text-lg">
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-brand-50 px-6 gap-2 pt-2">
              <button
                onClick={() => setActiveTab('details')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'details' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-brand-900'
                }`}
              >
                Facility Details (CBS Core)
              </button>
              <button
                onClick={() => setActiveTab('collateral')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'collateral' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-brand-900'
                }`}
              >
                Linked Collateral Securities ({linkedCollaterals.length})
              </button>
              <button
                onClick={() => setActiveTab('policies')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeTab === 'policies' ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-brand-900'
                }`}
              >
                Securing Insurance Policies ({linkedPolicies.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'details' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="cims-card p-4 space-y-2">
                    <h4 className="font-bold text-text-primary text-xs border-b border-border pb-1">Facility Limits & Balances</h4>
                    <div><span className="text-text-secondary">Approved Limit:</span> <strong className="tabular-nums">{selectedFacility.lineCurrency} {selectedFacility.approvedLimit?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-text-secondary">Outstanding Balance:</span> <strong className="tabular-nums text-brand-900 font-bold">{selectedFacility.lineCurrency} {selectedFacility.outstandingBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-text-secondary">Available Amount:</span> <strong className="tabular-nums text-emerald-700">{selectedFacility.lineCurrency} {selectedFacility.availableAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
                    <div><span className="text-text-secondary">Revolving Line:</span> <strong>{selectedFacility.revolvingLine ? 'Yes' : 'No'}</strong></div>
                  </div>
                  <div className="cims-card p-4 space-y-2">
                    <h4 className="font-bold text-text-primary text-xs border-b border-border pb-1">Schedule & Relationship</h4>
                    <div><span className="text-text-secondary">Start Date:</span> <strong>{selectedFacility.lineStartDate}</strong></div>
                    <div><span className="text-text-secondary">Expiry Date:</span> <strong>{selectedFacility.lineExpiryDate}</strong></div>
                    <div><span className="text-text-secondary">Next Review Date:</span> <strong>{selectedFacility.nextReviewDueDate || '—'}</strong></div>
                    <div><span className="text-text-secondary">Relationship Manager:</span> <strong>{selectedFacility.rmUserId || '—'}</strong></div>
                  </div>
                </div>
              )}

              {activeTab === 'collateral' && (
                <div className="space-y-4">
                  {/* Aggregate Exposure Summary Card */}
                  <div className="cims-card p-4 bg-brand-50 border-brand-100 flex items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold uppercase text-brand-700 tracking-wider">
                        Facility Exposure & Collateral Security Allocation
                      </div>
                      <div className="text-xs text-text-secondary">
                        Outstanding Loan Exposure:{' '}
                        <strong className="text-text-primary tabular-nums font-bold">
                          {selectedFacility.lineCurrency} {outstandingExposure.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="text-xs text-text-secondary">
                        Total Pledged Collateral Valuation:{' '}
                        <strong className="text-text-primary tabular-nums">
                          {selectedFacility.lineCurrency} {totalPledgedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="text-xs text-text-secondary">
                        Total Allocated Security Limit:{' '}
                        <strong className="text-emerald-700 tabular-nums font-bold">
                          {selectedFacility.lineCurrency} {totalAllocatedSecurity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>

                    {/* Circular Coverage Gauge */}
                    <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-border">
                      <CircularProgress value={Math.min(100, coveragePct)} size={72} strokeWidth={7} label="Coverage" />
                      <div className="text-xs space-y-1">
                        <div className="font-bold text-text-primary">
                          {coveragePct >= 100 ? 'Adequately Insured' : coveragePct >= 70 ? 'Underinsured' : 'Uninsured / Critical'}
                        </div>
                        <div className="text-[11px] text-text-secondary">
                          Coverage: <strong>{coveragePct.toFixed(1)}%</strong> (Min: 100.0%)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Linked Collateral Grid */}
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                        <tr>
                          <th className="p-2.5">Collateral Code</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5 text-right">Market Valuation</th>
                          <th className="p-2.5 text-right">Allocated Security Amount</th>
                          <th className="p-2.5">Linkage Type</th>
                          <th className="p-2.5">Insurance Status</th>
                          <th className="p-2.5">Auth Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {linkedCollaterals.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-6 text-text-secondary">
                              No collateral pledged for this facility.
                            </td>
                          </tr>
                        ) : (
                          linkedCollaterals.map((c) => {
                            const link = facilityLinks.find((l) => l.collateralId === c.id || l.collateralId === c.code);
                            return (
                              <tr key={c.id} className="hover:bg-brand-50">
                                <td className="p-2.5 font-semibold text-brand-900">{c.code}</td>
                                <td className="p-2.5">{c.category}</td>
                                <td className="p-2.5 text-right tabular-nums">
                                  {c.currency || 'ETB'} {c.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 text-right tabular-nums font-bold text-emerald-700">
                                  {c.currency || 'ETB'} {(link?.allocatedAmount || link?.linkedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5">{link?.linkageType || 'Primary'}</td>
                                <td className="p-2.5"><StatusChip label={c.insuranceStatus || c.status} /></td>
                                <td className="p-2.5"><StatusChip label={c.authStat === 'A' ? 'Authorized' : 'Pending'} /></td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'policies' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-text-primary">Active Insurance Policies Securing Pledged Collateral</h4>
                    <span className="text-[11px] text-text-secondary">
                      Total Insured Amount: <strong className="text-emerald-700">ETB {totalInsuredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                    </span>
                  </div>
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                        <tr>
                          <th className="p-2.5">Policy Number</th>
                          <th className="p-2.5">Insurer Name</th>
                          <th className="p-2.5">Coverage Type</th>
                          <th className="p-2.5 text-right">Insured Amount</th>
                          <th className="p-2.5">Collateral Code</th>
                          <th className="p-2.5">Expiry Date</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {linkedPolicies.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-6 text-text-secondary">
                              No insurance policies linked to the pledged collateral securing this facility.
                            </td>
                          </tr>
                        ) : (
                          linkedPolicies.map((p) => {
                            const col = collaterals.find(c => c.id === p.collateralId || c.code === p.collateralId);
                            return (
                              <tr key={p.id} className="hover:bg-brand-50">
                                <td className="p-2.5 font-semibold text-brand-900 flex items-center gap-1.5">
                                  <FileCheck className="w-3.5 h-3.5 text-brand-600" />
                                  {p.policyNumber}
                                </td>
                                <td className="p-2.5">{p.insurerName}</td>
                                <td className="p-2.5">{p.coverageType}</td>
                                <td className="p-2.5 text-right tabular-nums font-bold text-emerald-700">
                                  ETB {p.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 font-mono">{col?.code || p.collateralId}</td>
                                <td className="p-2.5">{p.expiryDate}</td>
                                <td className="p-2.5"><StatusChip label={p.status} /></td>
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
    </div>
  );
};
