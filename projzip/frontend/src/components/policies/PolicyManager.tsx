import React, { useState } from 'react';
import {
  FileCheck,
  Plus,
  Eye,
  Edit,
  RotateCw,
  AlertTriangle,
  FilePlus,
  CheckCircle,
  XCircle,
  FileText,
  Clock,
  Shield,
  ShieldCheck,
  RefreshCw,
  Ban,
  Archive,
  Play,
  Layers,
  Send,
  Upload,
  UploadCloud,
  Paperclip,
  Trash2,
  Search,
  User,
  Building2,
  Calendar,
  CreditCard,
  FileBadge,
  History,
  GitCommit,
} from 'lucide-react';
import {
  InsurancePolicy,
  PolicyEndorsement,
  Collateral,
  Customer,
  ApprovedInsurer,
  OwnershipDocument,
  UserSession,
  SystemParameter,
  ExposureAdequacySummary,
  LoanAccount,
} from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { CircularProgress } from '../layout/CircularProgress';
import { cimsApi } from '../../api/cimsApi';

interface WizardDocItem {
  id: string;
  name: string;
  type: string;
  expiryDate: string;
  remarks: string;
  fileName?: string;
  fileSize?: string;
  fileSizeNum?: number;
  contentType?: string;
  fileContent?: string;
  isMandatory?: boolean;
}

interface PolicyManagerProps {
  policies: InsurancePolicy[];
  endorsements: PolicyEndorsement[];
  collaterals: Collateral[];
  customers: Customer[];
  insurers: ApprovedInsurer[];
  documents: OwnershipDocument[];
  systemParameters?: SystemParameter[];
  currentUser: UserSession;
  onCreatePolicyDraft: (policy: Partial<InsurancePolicy>, documents?: any[]) => Promise<void>;
  onSubmitPolicy: (policyId: string) => Promise<void>;
  onAmendPolicy: (policyId: string, policy: Partial<InsurancePolicy>, reason: string) => Promise<void>;
  onRenewPolicy: (policyId: string, newAmount: number, newPremium: number, newExpiryDate: string) => Promise<void>;
  onEndorsePolicy?: (policyId: string, endorsementNo: string, description: string, effectiveDate?: string) => Promise<void>;
  onReplacePolicy?: (policyId: string, replacement: any, reason: string) => Promise<void>;
  onCancelPolicy?: (policyId: string, reason: string) => Promise<void>;
  onClosePolicy?: (policyId: string, reason: string) => Promise<void>;
  onReopenPolicy?: (policyId: string, reason: string) => Promise<void>;
}

export const PolicyManager: React.FC<PolicyManagerProps> = ({
  policies,
  endorsements,
  collaterals,
  customers,
  insurers,
  documents,
  systemParameters = [],
  currentUser,
  onCreatePolicyDraft,
  onSubmitPolicy,
  onAmendPolicy,
  onRenewPolicy,
  onEndorsePolicy,
  onReplacePolicy,
  onCancelPolicy,
  onClosePolicy,
  onReopenPolicy,
}) => {
  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const defaultEffectiveDate = isoDate(today);
  const defaultExpiryDate = isoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));

  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'financials' | 'endorsements' | 'documents' | 'history'>('financials');

  const [showWizardModal, setShowWizardModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);

  const [reopenReason, setReopenReason] = useState('Reopened for active facility coverage');
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [policyHistoryData, setPolicyHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadPolicyHistory = async (policyId: string) => {
    setLoadingHistory(true);
    try {
      const data = await cimsApi.getPolicyHistory(policyId);
      setPolicyHistoryData(data);
    } catch (e) {
      console.warn('Unable to load policy history', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // =========================================================================
  // Guided Insurance Registration Wizard State (5 Steps)
  // =========================================================================
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [wizardCustomerId, setWizardCustomerId] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [wizardColId, setWizardColId] = useState('');
  const [wizardExposure, setWizardExposure] = useState<ExposureAdequacySummary | null>(null);
  const [loadingWizardExposure, setLoadingWizardExposure] = useState(false);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const defaultCurrency = systemParameters.find((p) => p.paramKey === 'default_currency')?.paramValue || 'ETB';

  const activeApprovedInsurers = (insurers || []).filter((i) => i.active !== false);

  const [wizardPolicy, setWizardPolicy] = useState<Partial<InsurancePolicy>>({
    policyNumber: `POL-${Math.floor(100000 + Math.random() * 900000)}`,
    insurerName: activeApprovedInsurers[0]?.name || 'Nyala Insurance S.C.',
    coverageType: 'Fire & Allied Perils',
    insuredAmount: 10000000,
    premium: 45000,
    effectiveDate: defaultEffectiveDate,
    expiryDate: defaultExpiryDate,
    status: 'Pending Approval',
  });

  const [wizardDocuments, setWizardDocuments] = useState<WizardDocItem[]>([]);
  const [acknowledgedUnderinsurance, setAcknowledgedUnderinsurance] = useState(false);

  // Document upload modal state (in detail modal)
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadDocType, setUploadDocType] = useState('Insurance Policy Schedule');
  const [uploadDocExpiry, setUploadDocExpiry] = useState(defaultExpiryDate);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Action states
  const [amendData, setAmendData] = useState<Partial<InsurancePolicy>>({});
  const [amendReason, setAmendReason] = useState('Policy coverage adjustment');
  const [amendSubmitting, setAmendSubmitting] = useState(false);

  const [renewAmount, setRenewAmount] = useState(0);
  const [renewPremium, setRenewPremium] = useState(0);
  const [renewExpiryDate, setRenewExpiryDate] = useState(defaultExpiryDate);
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  const [endorsementNo, setEndorsementNo] = useState(`END-${Date.now()}`);
  const [endorsementDesc, setEndorsementDesc] = useState('Bank sole loss payee clause endorsement');
  const [endorsementEffDate, setEndorsementEffDate] = useState(defaultEffectiveDate);
  const [endorseSubmitting, setEndorseSubmitting] = useState(false);

  const [replacementPolicy, setReplacementPolicy] = useState<Partial<InsurancePolicy>>({});
  const [replacementReason, setReplacementReason] = useState('Change of Insurer');
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);

  const [cancelReason, setCancelReason] = useState('Borrower requested cancellation');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const [closeReason, setCloseReason] = useState('Loan facility fully settled');
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const isMaker = currentUser.canCreate !== false;
  const coverageThreshold = Number(systemParameters.find((p) => p.paramKey === 'min_coverage_adequacy_pct')?.paramValue ?? 100);

  const selectedCustomer = customers.find(
    (cu) => (cu.id && cu.id === wizardCustomerId) || (cu.cif && cu.cif === wizardCustomerId)
  );

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.cif && c.cif.toLowerCase().includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.segment && c.segment.toLowerCase().includes(q))
    );
  });

  const filteredCollaterals = wizardCustomerId
    ? collaterals.filter(
        (c) =>
          (c.customerId === wizardCustomerId || (selectedCustomer && c.customerId === selectedCustomer.cif)) &&
          c.status !== 'Released' &&
          c.status !== 'Draft'
      )
    : [];

  const wizardCol = collaterals.find((c) => c.id === wizardColId || c.code === wizardColId);

  // Determine standard mandatory insurance coverage type by collateral category
  const getStandardCoverageForCategory = (cat?: string): string => {
    const c = (cat || '').toLowerCase();
    if (c.includes('immovable') || c.includes('building') || c.includes('real')) {
      return 'Fire & Allied Perils';
    }
    if (c.includes('movable') || c.includes('vehicle')) {
      return 'Comprehensive Motor';
    }
    if (c.includes('machin') || c.includes('business mortgage')) {
      return 'All-Risk Comprehensive Machinery Breakdown';
    }
    if (c.includes('inventory') || c.includes('merchandise') || c.includes('warehouse')) {
      return 'Fire, Lightning, Burglary & Spontaneous Combustion';
    }
    if (c.includes('financial') || c.includes('cash') || c.includes('guarantee')) {
      return 'No Insurance Required (Exempt Category)';
    }
    return 'Comprehensive Cover';
  };

  const isInsuranceMandatoryForCategory = (cat?: string): boolean => {
    const c = (cat || '').toLowerCase();
    if (c.includes('financial') || c.includes('cash') || c.includes('guarantee') || c.includes('blocked')) {
      return false;
    }
    return true;
  };

  // Required Insurance = MAX(Outstanding Exposure, Collateral Value)
  const collateralMarketVal = wizardCol?.valuationAmount || 0;
  const outstandingExposure = wizardExposure?.totalOutstandingExposure || 0;
  const requiredInsuranceAmount = isInsuranceMandatoryForCategory(wizardCol?.category)
    ? Math.max(outstandingExposure, collateralMarketVal)
    : 0;

  const wizardInsAmount = Number(wizardPolicy.insuredAmount || 0);
  const wizardCoveragePct =
    requiredInsuranceAmount > 0
      ? (wizardInsAmount / requiredInsuranceAmount) * 100
      : wizardInsAmount > 0
      ? 100
      : 0;

  const isUnderinsured = requiredInsuranceAmount > 0 && wizardCoveragePct < coverageThreshold;

  // Duplicate policy detector
  const isDuplicatePolicy = (polNumber?: string): boolean => {
    if (!polNumber) return false;
    return policies.some(
      (p) =>
        p.policyNumber &&
        p.policyNumber.trim().toLowerCase() === polNumber.trim().toLowerCase() &&
        p.status !== 'Cancelled' &&
        p.status !== 'Closed' &&
        p.status !== 'Rejected'
    );
  };

  const loadWizardExposure = async (colId: string) => {
    setLoadingWizardExposure(true);
    try {
      const summary = await cimsApi.fetchCollateralExposureSummary(colId);
      setWizardExposure(summary);
      const chosenCol = collaterals.find((c) => c.id === colId || c.code === colId);
      const reqAmt = Math.max(summary?.totalOutstandingExposure || 0, chosenCol?.valuationAmount || 0);
      const stdCoverage = getStandardCoverageForCategory(chosenCol?.category);

      setWizardPolicy((prev) => ({
        ...prev,
        coverageType: stdCoverage,
        insuredAmount: reqAmt > 0 ? reqAmt : chosenCol?.valuationAmount || 10000000,
        premium: Math.round((reqAmt > 0 ? reqAmt : 10000000) * 0.0045),
      }));
    } catch (err) {
      console.error('Failed to load exposure for wizard:', err);
    } finally {
      setLoadingWizardExposure(false);
    }
  };

  const handleStartWizard = () => {
    setWizardStep(1);
    setWizardCustomerId('');
    setCustomerSearchQuery('');
    setWizardColId('');
    setWizardExposure(null);
    const polNum = `POL-${Math.floor(100000 + Math.random() * 900000)}`;
    const defaultInsurer = activeApprovedInsurers[0]?.name || 'Nyala Insurance S.C.';

    setWizardPolicy({
      policyNumber: polNum,
      insurerName: defaultInsurer,
      coverageType: 'Fire & Allied Perils',
      insuredAmount: 0,
      premium: 0,
      effectiveDate: defaultEffectiveDate,
      expiryDate: defaultExpiryDate,
      status: 'Pending Approval',
    });
    setAcknowledgedUnderinsurance(false);

    // Initial mandatory policy document slots (DMS)
    setWizardDocuments([
      {
        id: `doc-pol-${Date.now()}-1`,
        name: '',
        type: 'Insurance Policy Schedule',
        expiryDate: defaultExpiryDate,
        remarks: 'Official policy certificate with Bank Loss Payee clause',
        fileName: '',
        fileSize: '',
        fileSizeNum: 0,
        contentType: 'application/pdf',
        fileContent: '',
        isMandatory: true,
      },
      {
        id: `doc-pol-${Date.now()}-2`,
        name: '',
        type: 'Premium Payment Receipt',
        expiryDate: defaultExpiryDate,
        remarks: 'Annual premium payment settlement confirmation receipt',
        fileName: '',
        fileSize: '',
        fileSizeNum: 0,
        contentType: 'application/pdf',
        fileContent: '',
        isMandatory: true,
      },
    ]);
    setShowWizardModal(true);
  };

  const missingPolicyDocs = wizardDocuments.filter((d) => d.isMandatory && (!d.fileContent || !d.fileName));

  const getStep1Errors = (): string[] => {
    const errors: string[] = [];
    if (!wizardCustomerId) errors.push('Please select a customer.');
    if (!wizardColId) errors.push('Please select an authorized collateral asset belonging to the customer.');
    return errors;
  };

  const getStep2Errors = (): string[] => {
    const errors: string[] = [];
    if (requiredInsuranceAmount > 0 && wizardInsAmount <= 0) {
      errors.push('Required insurance amount is ETB ' + requiredInsuranceAmount.toLocaleString() + '. Insured amount must be greater than zero.');
    }
    return errors;
  };

  const getStep3Errors = (): string[] => {
    const errors: string[] = [];
    if (!wizardPolicy.policyNumber || wizardPolicy.policyNumber.trim() === '') errors.push('Policy Number is mandatory.');
    if (isDuplicatePolicy(wizardPolicy.policyNumber)) errors.push('A policy with number ' + wizardPolicy.policyNumber + ' already exists.');
    if (!wizardPolicy.insurerName || wizardPolicy.insurerName.trim() === '') errors.push('Approved Insurer selection is mandatory.');

    const isApproved = activeApprovedInsurers.some(
      (i) => i.name.trim().toLowerCase() === (wizardPolicy.insurerName || '').trim().toLowerCase()
    );
    if (!isApproved) errors.push('Selected insurer is not an active approved insurance company.');

    if (!wizardPolicy.insuredAmount || Number(wizardPolicy.insuredAmount) <= 0) errors.push('Insured Amount must be greater than zero.');
    if (!wizardPolicy.effectiveDate) errors.push('Effective Date is mandatory.');
    if (!wizardPolicy.expiryDate) errors.push('Expiry Date is mandatory.');

    if (wizardPolicy.effectiveDate && wizardPolicy.expiryDate) {
      const eff = new Date(wizardPolicy.effectiveDate);
      const exp = new Date(wizardPolicy.expiryDate);
      if (exp <= eff) {
        errors.push('Expiry Date must be strictly after Effective Date.');
      }
      const days = Math.ceil((exp.getTime() - eff.getTime()) / (1000 * 3600 * 24));
      if (days < 365) {
        errors.push('Standard policy validity must be at least 1 year (365 days) unless securing a specific short-term shipment.');
      }
    }
    return errors;
  };

  const handleFinishWizard = async () => {
    if (!wizardColId) {
      alert('Please select a pledged collateral asset.');
      return;
    }
    const insAmt = Number(wizardPolicy.insuredAmount || 0);
    if (insAmt <= 0) {
      alert('Insured amount must be greater than zero.');
      return;
    }
    if (missingPolicyDocs.length > 0) {
      alert(
        `Cannot submit: Missing uploaded files for mandatory policy document(s):\n\n• ` +
          missingPolicyDocs.map((m) => m.type).join('\n• ') +
          `\n\nPlease attach valid digital files before submitting.`
      );
      setWizardStep(4);
      return;
    }

    setWizardSubmitting(true);
    try {
      const selectedCol = collaterals.find((c) => c.id === wizardColId || c.code === wizardColId);
      if (!selectedCol) {
        alert('Selected collateral asset was not found.');
        return;
      }
      const policyData: Partial<InsurancePolicy> = {
        ...wizardPolicy,
        collateralId: selectedCol.id,
        customerId: selectedCol.customerId,
        status: 'Pending Approval',
      };

      const docsToSave = (wizardDocuments || []).map((d) => ({
        name: d.name || d.fileName || d.type,
        type: d.type,
        expiryDate: d.expiryDate,
        remarks: d.remarks,
        fileName: d.fileName,
        fileSize: d.fileSizeNum && d.fileSizeNum > 0 ? d.fileSizeNum : 102400,
        contentType: d.contentType || 'application/pdf',
        fileContent: d.fileContent,
        isMandatory: d.isMandatory,
      }));

      await onCreatePolicyDraft(policyData, docsToSave);
      alert(`Insurance policy ${policyData.policyNumber} submitted for Checker approval with ${wizardDocuments.length} DMS documents attached.`);
      setShowWizardModal(false);
    } catch (err: any) {
      alert(`Policy submission failed: ${err.message || err}`);
    } finally {
      setWizardSubmitting(false);
    }
  };

  const policyColumns: ColumnDef<InsurancePolicy>[] = [
    {
      header: 'Policy Number',
      accessorKey: 'policyNumber',
      cell: (p) => (
        <div className="font-semibold text-[#102E4A] flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-[#1F4E7A]" />
          <span>{p.policyNumber}</span>
        </div>
      ),
    },
    {
      header: 'Insurer Name',
      accessorKey: 'insurerName',
      cell: (p) => <div className="font-semibold text-[#101828]">{p.insurerName}</div>,
    },
    {
      header: 'Coverage Type',
      accessorKey: 'coverageType',
      cell: (p) => <div className="text-[#5B6472] text-xs">{p.coverageType}</div>,
    },
    {
      header: 'Insured Amount',
      accessorKey: 'insuredAmount',
      cell: (p) => (
        <div className="tabular-nums font-bold text-emerald-700">
          {defaultCurrency} {p.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: 'Annual Premium',
      accessorKey: 'premium',
      cell: (p) => (
        <div className="tabular-nums font-semibold text-[#101828]">
          {defaultCurrency} {p.premium?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: 'Collateral Ref',
      accessorKey: 'collateralId',
      cell: (p) => {
        const col = collaterals.find((c) => c.id === p.collateralId || c.code === p.collateralId);
        return (
          <div>
            <div className="font-semibold text-[#102E4A]">{col?.code || p.collateralId}</div>
            <div className="text-[11px] text-[#5B6472]">{col?.category || 'Collateral'}</div>
          </div>
        );
      },
    },
    {
      header: 'Expiry Date',
      accessorKey: 'expiryDate',
      cell: (p) => {
        const exp = new Date(p.expiryDate);
        const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 3600 * 24));
        const isExpired = daysLeft <= 0;
        const isExpiring = daysLeft > 0 && daysLeft <= 30;

        return (
          <div>
            <div className={`font-semibold ${isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : 'text-[#101828]'}`}>
              {p.expiryDate}
            </div>
            <div className="text-[10px] text-[#5B6472]">
              {isExpired ? 'Expired' : `${daysLeft} days remaining`}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (p) => (
        <StatusChip
          label={p.status}
          variant={
            p.status === 'Active'
              ? 'success'
              : p.status === 'Pending Approval' || p.status === 'Pending Renewal'
              ? 'warning'
              : p.status === 'Draft' || p.status === 'Returned'
              ? 'neutral'
              : 'danger'
          }
        />
      ),
    },
    {
      header: 'Auth Stat',
      accessorKey: 'authStat',
      cell: (p) => (
        <StatusChip
          label={p.authStat === 'A' ? 'Active / Authorized' : p.authStat === 'R' ? 'Rejected' : 'Pending Approval'}
          variant={p.authStat === 'A' ? 'success' : p.authStat === 'R' ? 'danger' : 'warning'}
        />
      ),
    },
    {
      header: 'Actions',
      cell: (p) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPolicy(p);
            loadPolicyHistory(p.id);
            setShowDetailModal(true);
          }}
          className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          Policy 360
        </button>
      ),
    },
  ];

  const policyEndorsements = selectedPolicy ? endorsements.filter((e) => e.policyId === selectedPolicy.id) : [];
  const policyDocs = selectedPolicy
    ? documents.filter(
        (d) =>
          d.entityId === selectedPolicy.id ||
          (selectedPolicy.collateralId && d.collateralId === selectedPolicy.collateralId)
      )
    : [];

  return (
    <div className="p-6 space-y-6">
      <DataGrid
        title="Insurance Policies Master"
        subtitle="Collateral-Pledged Insurance Coverage Lifecycle, Adequacy Guarantees, Renewals, and Endorsements"
        data={policies}
        columns={policyColumns}
        keyExtractor={(p) => p.id}
        onRowClick={(p) => {
          setSelectedPolicy(p);
          loadPolicyHistory(p.id);
          setShowDetailModal(true);
        }}
        actions={
          isMaker ? (
            <button
              onClick={handleStartWizard}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Register New Policy
            </button>
          ) : undefined
        }
      />

      {/* Policy 360 Detail Modal */}
      {showDetailModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="p-5 bg-[#102E4A] text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">
                    {selectedPolicy.policyNumber} — {selectedPolicy.insurerName}
                  </h2>
                  <StatusChip
                    label={selectedPolicy.status}
                    variant={
                      selectedPolicy.status === 'Active'
                        ? 'success'
                        : selectedPolicy.status === 'Pending Approval' || selectedPolicy.status === 'Pending Renewal'
                        ? 'warning'
                        : 'danger'
                    }
                  />
                  <StatusChip
                    label={selectedPolicy.authStat === 'A' ? 'Authorized' : selectedPolicy.authStat === 'R' ? 'Rejected' : 'Pending Authorization'}
                    variant={selectedPolicy.authStat === 'A' ? 'success' : selectedPolicy.authStat === 'R' ? 'danger' : 'warning'}
                  />
                </div>
                <div className="text-xs text-blue-200 mt-1 flex gap-4">
                  <span>Coverage: {selectedPolicy.coverageType}</span>
                  <span>
                    Effective: {selectedPolicy.effectiveDate} to {selectedPolicy.expiryDate}
                  </span>
                  <span>Collateral: {selectedPolicy.collateralId}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isMaker && (
                  <>
                    {(selectedPolicy.status === 'Draft' || selectedPolicy.status === 'Returned') && (
                      <button
                        onClick={async () => {
                          try {
                            await onSubmitPolicy(selectedPolicy.id);
                            alert(`Policy ${selectedPolicy.policyNumber} submitted for Checker authorization.`);
                            setShowDetailModal(false);
                          } catch (e: any) {
                            alert(`Submit failed: ${e?.message || e}`);
                          }
                        }}
                        className="btn-primary py-1 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-800 flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit for Approval
                      </button>
                    )}

                    {(selectedPolicy.status === 'Active' || selectedPolicy.status === 'Pending Renewal') && (
                      <>
                        <button
                          onClick={() => {
                            setAmendData({
                              insurerName: selectedPolicy.insurerName,
                              coverageType: selectedPolicy.coverageType,
                              insuredAmount: selectedPolicy.insuredAmount,
                              premium: selectedPolicy.premium,
                            });
                            setShowAmendModal(true);
                          }}
                          className="btn-ghost py-1 px-2 text-xs text-white border border-white/30 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          Amend
                        </button>
                        <button
                          onClick={() => {
                            setRenewAmount(selectedPolicy.insuredAmount);
                            setRenewPremium(selectedPolicy.premium);
                            setRenewExpiryDate(isoDate(new Date(new Date(selectedPolicy.expiryDate).getTime() + 365 * 24 * 3600 * 1000)));
                            setShowRenewModal(true);
                          }}
                          className="btn-ghost py-1 px-2 text-xs text-emerald-300 border border-emerald-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          Renew
                        </button>
                        <button
                          onClick={() => {
                            setEndorsementNo(`END-${Date.now()}`);
                            setEndorsementDesc('Additional bank interest endorsement');
                            setEndorsementEffDate(defaultEffectiveDate);
                            setShowEndorseModal(true);
                          }}
                          className="btn-ghost py-1 px-2 text-xs text-amber-300 border border-amber-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                          Endorse
                        </button>
                        <button
                          onClick={() => {
                            setReplacementPolicy({
                              insurerName: selectedPolicy.insurerName,
                              coverageType: selectedPolicy.coverageType,
                              insuredAmount: selectedPolicy.insuredAmount,
                              premium: selectedPolicy.premium,
                              effectiveDate: defaultEffectiveDate,
                              expiryDate: defaultExpiryDate,
                            });
                            setShowReplaceModal(true);
                          }}
                          className="btn-ghost py-1 px-2 text-xs text-blue-300 border border-blue-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Replace
                        </button>
                        <button
                          onClick={() => setShowCancelModal(true)}
                          className="btn-ghost py-1 px-2 text-xs text-red-300 border border-red-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          onClick={() => setShowCloseModal(true)}
                          className="btn-ghost py-1 px-2 text-xs text-slate-300 border border-slate-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Close
                        </button>
                      </>
                    )}

                    {selectedPolicy.status === 'Closed' && (
                      <button
                        onClick={() => {
                          setReopenReason('Reopened for active facility coverage');
                          setShowReopenModal(true);
                        }}
                        className="btn-ghost py-1 px-2.5 text-xs text-emerald-300 border border-emerald-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Reopen Policy
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-gray-300 text-lg ml-2">
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-[#E2E8F0] bg-[#EFF5FB] px-6 gap-2 pt-2">
              <button
                onClick={() => setActiveDetailTab('financials')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeDetailTab === 'financials'
                    ? 'border-[#102E4A] text-[#102E4A]'
                    : 'border-transparent text-[#5B6472] hover:text-[#102E4A]'
                }`}
              >
                Policy Financials & Governance
              </button>
              <button
                onClick={() => setActiveDetailTab('endorsements')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeDetailTab === 'endorsements'
                    ? 'border-[#102E4A] text-[#102E4A]'
                    : 'border-transparent text-[#5B6472] hover:text-[#102E4A]'
                }`}
              >
                Endorsements ({policyEndorsements.length})
              </button>
              <button
                onClick={() => setActiveDetailTab('documents')}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  activeDetailTab === 'documents'
                    ? 'border-[#102E4A] text-[#102E4A]'
                    : 'border-transparent text-[#5B6472] hover:text-[#102E4A]'
                }`}
              >
                Attached Documents ({policyDocs.length})
              </button>
              <button
                onClick={() => {
                  setActiveDetailTab('history');
                  if (selectedPolicy) loadPolicyHistory(selectedPolicy.id);
                }}
                className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeDetailTab === 'history'
                    ? 'border-[#102E4A] text-[#102E4A]'
                    : 'border-transparent text-[#5B6472] hover:text-[#102E4A]'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Lifecycle & History
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {activeDetailTab === 'financials' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="cims-card p-4 space-y-2">
                    <h4 className="font-bold text-[#101828] border-b border-[#E2E8F0] pb-1">Policy Financials</h4>
                    <div>
                      <span className="text-[#5B6472]">Insured Amount:</span>{' '}
                      <strong className="text-emerald-700 tabular-nums">
                        {defaultCurrency} {selectedPolicy.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6472]">Annual Premium:</span>{' '}
                      <strong className="tabular-nums">
                        {defaultCurrency} {selectedPolicy.premium?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6472]">Pledged Collateral Asset:</span> <strong>{selectedPolicy.collateralId}</strong>
                    </div>
                    <div>
                      <span className="text-[#5B6472]">Customer CIF:</span> <strong>{selectedPolicy.customerId || '—'}</strong>
                    </div>
                  </div>
                  <div className="cims-card p-4 space-y-2">
                    <h4 className="font-bold text-[#101828] border-b border-[#E2E8F0] pb-1">Governance & Audit</h4>
                    <div>
                      <span className="text-[#5B6472]">Maker:</span>{' '}
                      <strong>
                        {selectedPolicy.makerId || 'System'} ({selectedPolicy.makerDtStamp?.substring(0, 10) || '—'})
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6472]">Checker:</span>{' '}
                      <strong>
                        {selectedPolicy.checkerId || 'Pending'} ({selectedPolicy.checkerDtStamp?.substring(0, 10) || '—'})
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5B6472]">Authorization:</span>{' '}
                      <strong>{selectedPolicy.authStat === 'A' ? 'Authorized' : 'Pending Authorization'}</strong>
                    </div>
                    {selectedPolicy.cancellationReason && (
                      <div className="text-red-600">
                        <span className="text-[#5B6472]">Cancellation Reason:</span> <strong>{selectedPolicy.cancellationReason}</strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeDetailTab === 'endorsements' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[#101828]">Policy Endorsements & Schedule Adjustments</h4>
                    {isMaker && selectedPolicy.status === 'Active' && (
                      <button
                        onClick={() => {
                          setEndorsementNo(`END-${Date.now()}`);
                          setEndorsementDesc('Additional bank interest endorsement');
                          setEndorsementEffDate(defaultEffectiveDate);
                          setShowEndorseModal(true);
                        }}
                        className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Issue Endorsement
                      </button>
                    )}
                  </div>
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2">Endorsement No.</th>
                          <th className="p-2">Description</th>
                          <th className="p-2">Effective Date</th>
                          <th className="p-2">Maker</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {policyEndorsements.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-3 text-center text-[#5B6472]">
                              No endorsements issued for this policy.
                            </td>
                          </tr>
                        ) : (
                          policyEndorsements.map((e) => (
                            <tr key={e.id} className="hover:bg-[#EFF5FB]">
                              <td className="p-2 font-semibold text-[#102E4A]">{e.endorsementNo}</td>
                              <td className="p-2">{e.description}</td>
                              <td className="p-2">{e.effectiveDate}</td>
                              <td className="p-2">{e.makerId}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeDetailTab === 'documents' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[#101828]">Policy Schedules & Premium Receipts (DMS)</h4>
                    {isMaker && (
                      <button
                        onClick={() => setShowUploadDocModal(true)}
                        className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        + Upload Policy Document
                      </button>
                    )}
                  </div>
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5">Document Title</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Version</th>
                          <th className="p-2.5">Verification Status</th>
                          <th className="p-2.5">Upload Date</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {policyDocs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-[#5B6472]">
                              No documents uploaded for this policy.
                            </td>
                          </tr>
                        ) : (
                          policyDocs.map((d) => (
                            <tr key={d.id} className="hover:bg-[#EFF5FB]">
                              <td className="p-2.5 font-semibold text-[#102E4A] flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-[#2C6295]" />
                                {d.name}
                              </td>
                              <td className="p-2.5">{d.type}</td>
                              <td className="p-2.5">v{d.version || 1}</td>
                              <td className="p-2.5">
                                <StatusChip label={d.verificationStatus || 'Pending Verification'} variant="neutral" />
                              </td>
                              <td className="p-2.5">{d.uploadDate?.substring(0, 10)}</td>
                              <td className="p-2.5">
                                <StatusChip label={d.status || 'Active'} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeDetailTab === 'history' && (
                <div className="space-y-4">
                  {/* Predecessor / Successor Policy Chaining Links */}
                  {(policyHistoryData?.renewedFrom || policyHistoryData?.replaces || (policyHistoryData?.renewedInto && policyHistoryData.renewedInto.length > 0) || (policyHistoryData?.replacedBy && policyHistoryData.replacedBy.length > 0)) && (
                    <div className="p-3 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg space-y-2">
                      <div className="font-bold text-[#102E4A] flex items-center gap-1.5 text-xs">
                        <GitCommit className="w-4 h-4 text-[#1F4E7A]" />
                        Policy Chaining & Chained Lineage
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        {policyHistoryData?.renewedFrom && (
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">PREDECESSOR (RENEWED FROM)</span>
                            <span className="font-bold text-[#102E4A]">{policyHistoryData.renewedFrom.policyNumber}</span>
                            <span className="text-[#5B6472] ml-1">({policyHistoryData.renewedFrom.status})</span>
                          </div>
                        )}
                        {policyHistoryData?.replaces && (
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">PREDECESSOR (REPLACES)</span>
                            <span className="font-bold text-[#102E4A]">{policyHistoryData.replaces.policyNumber}</span>
                            <span className="text-[#5B6472] ml-1">({policyHistoryData.replaces.status})</span>
                          </div>
                        )}
                        {policyHistoryData?.renewedInto && policyHistoryData.renewedInto.length > 0 && (
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">SUCCESSOR (RENEWED INTO)</span>
                            {policyHistoryData.renewedInto.map((succ: any) => (
                              <div key={succ.id} className="font-bold text-emerald-800">
                                {succ.policyNumber} ({succ.status})
                              </div>
                            ))}
                          </div>
                        )}
                        {policyHistoryData?.replacedBy && policyHistoryData.replacedBy.length > 0 && (
                          <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                            <span className="text-[#5B6472] block text-[10px]">SUCCESSOR (REPLACED BY)</span>
                            {policyHistoryData.replacedBy.map((succ: any) => (
                              <div key={succ.id} className="font-bold text-blue-800">
                                {succ.policyNumber} ({succ.status})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lifecycle Metadata Header */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="cims-card p-3">
                      <div className="text-[10px] text-[#5B6472] font-semibold">CURRENT VERSION</div>
                      <div className="text-base font-bold text-[#102E4A]">v{selectedPolicy.version || 1}</div>
                    </div>
                    <div className="cims-card p-3">
                      <div className="text-[10px] text-[#5B6472] font-semibold">ENDORSEMENTS COUNT</div>
                      <div className="text-base font-bold text-[#102E4A]">{selectedPolicy.endorsementCount || 0}</div>
                    </div>
                    <div className="cims-card p-3">
                      <div className="text-[10px] text-[#5B6472] font-semibold">LIFECYCLE STATUS</div>
                      <div className="mt-1">
                        <StatusChip label={selectedPolicy.status} />
                      </div>
                    </div>
                    <div className="cims-card p-3">
                      <div className="text-[10px] text-[#5B6472] font-semibold">MAKER / CHECKER</div>
                      <div className="text-xs font-semibold text-[#101828] truncate">
                        {selectedPolicy.makerId || 'CRO_USER'} / {selectedPolicy.checkerId || 'Pending'}
                      </div>
                    </div>
                  </div>

                  {/* Chronological Timeline */}
                  <div className="cims-card p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                      <h4 className="font-bold text-[#101828] text-xs flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#1F4E7A]" />
                        Chronological Lifecycle Event History
                      </h4>
                      <button
                        onClick={() => loadPolicyHistory(selectedPolicy.id)}
                        className="btn-ghost py-0.5 px-2 text-[11px] text-[#1F4E7A] flex items-center gap-1"
                      >
                        <RotateCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>

                    {loadingHistory ? (
                      <div className="p-6 text-center text-[#5B6472]">Loading lifecycle history…</div>
                    ) : !policyHistoryData?.historyTimeline || policyHistoryData.historyTimeline.length === 0 ? (
                      <div className="p-6 text-center text-[#5B6472]">
                        No historical lifecycle events recorded yet for this policy.
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#B9D3EB]">
                        {policyHistoryData.historyTimeline.map((item: any, idx: number) => {
                          const eventType = item.event || (item.reason ? 'AMENDMENT' : 'LIFECYCLE_EVENT');
                          const isReg = eventType.includes('REGISTRATION');
                          const isAmend = eventType.includes('AMENDMENT');
                          const isEndorse = eventType.includes('ENDORSEMENT');
                          const isRenew = eventType.includes('RENEW');
                          const isReplace = eventType.includes('REPLACE');
                          const isCancel = eventType.includes('CANCEL');
                          const isClose = eventType.includes('CLOSE');
                          const isReopen = eventType.includes('REOPEN');
                          const isReject = eventType.includes('REJECT');

                          const badgeColor = isReject
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : isCancel
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : isReg
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : isAmend
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : isEndorse
                            ? 'bg-purple-50 text-purple-800 border-purple-300'
                            : isRenew
                            ? 'bg-teal-50 text-teal-800 border-teal-300'
                            : isReplace
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : isReopen
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-800 border-slate-300';

                          return (
                            <div key={idx} className="relative group">
                              <div className="absolute -left-[19px] top-1 w-3 h-3 rounded-full bg-[#2C6295] border-2 border-white shadow-xs" />
                              <div className="bg-[#EFF5FB]/50 border border-[#E2E8F0]/70 rounded-lg p-3 space-y-1.5 hover:bg-[#EFF5FB] transition-colors">
                                <div className="flex justify-between items-center flex-wrap gap-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                                    {eventType.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] text-[#5B6472] font-mono">
                                    {item.timestamp || item.amendedAt || '—'}
                                  </span>
                                </div>

                                <div className="text-xs text-[#101828]">
                                  {item.reason && (
                                    <div className="mt-1">
                                      <span className="font-semibold text-[#5B6472]">Mandatory Reason:</span>{' '}
                                      <span className="font-medium text-[#102E4A]">"{item.reason}"</span>
                                    </div>
                                  )}
                                  {item.comments && (
                                    <div className="mt-1">
                                      <span className="font-semibold text-[#5B6472]">Checker Comments:</span>{' '}
                                      <span className="font-medium text-[#102E4A]">"{item.comments}"</span>
                                    </div>
                                  )}
                                  {item.version && (
                                    <div className="text-[11px] text-[#5B6472]">
                                      Version: <strong>v{item.version}</strong>
                                      {item.insuredAmount && (
                                        <span className="ml-2">
                                          Insured: <strong>{defaultCurrency} {Number(item.insuredAmount).toLocaleString()}</strong>
                                        </span>
                                      )}
                                      {item.premium && (
                                        <span className="ml-2">
                                          Premium: <strong>{defaultCurrency} {Number(item.premium).toLocaleString()}</strong>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {item.endorsementNo && (
                                    <div className="text-[11px]">
                                      Endorsement: <strong>{item.endorsementNo}</strong> — {item.description}
                                    </div>
                                  )}
                                  {item.previousPolicyNumber && (
                                    <div className="text-[11px] text-[#173F63]">
                                      Linked Policy: <strong>{item.previousPolicyNumber}</strong>
                                    </div>
                                  )}
                                </div>

                                <div className="text-[10px] text-[#5B6472] pt-1 border-t border-[#E2E8F0]/40 flex gap-3">
                                  {item.makerId && <span>Initiated by: <strong>{item.makerId}</strong></span>}
                                  {item.checkerId && <span>Authorized by: <strong>{item.checkerId}</strong></span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          Guided Insurance Policy Registration Wizard Modal (5 Steps)
          ========================================================================= */}
      {showWizardModal && (
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Register Insurance Policy</h3>
                <p className="text-[11px] text-blue-200">
                  Step {wizardStep} of 5: Collateral-Centric Insurance &amp; Four-Eyes Control
                </p>
              </div>
              <button onClick={() => setShowWizardModal(false)} className="text-white hover:text-gray-300 text-lg">
                ✕
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="grid grid-cols-5 bg-[#EFF5FB] border-b border-[#E2E8F0] text-center py-2 text-[10px] font-semibold divide-x divide-[#E2E8F0]/60">
              <div className={wizardStep === 1 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                1. Customer & Collateral
              </div>
              <div className={wizardStep === 2 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                2. Exposure & Requirement
              </div>
              <div className={wizardStep === 3 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                3. Policy & Insurer
              </div>
              <div className={wizardStep === 4 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                4. Documents
              </div>
              <div className={wizardStep === 5 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                5. Submit
              </div>
            </div>

            {/* Step Body */}
            <div className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
              {/* STEP 1: CUSTOMER & COLLATERAL SELECTION */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#1F4E7A]" />
                      Step 1: Select Customer & Pledged Collateral Asset
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Identify the borrower first, then choose from eligible authorized collaterals belonging strictly to that customer.
                    </p>
                  </div>

                  {/* Customer Search & Select */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#5B6472] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search Customer by Name, CIF Number, Segment..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-[#E2E8F0] rounded text-xs bg-slate-50 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        1. Select Customer / Borrower <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={wizardCustomerId}
                        onChange={(e) => {
                          const newCustId = e.target.value;
                          setWizardCustomerId(newCustId);
                          setWizardColId('');
                          setWizardExposure(null);
                        }}
                        className="w-full p-2.5 border border-[#E2E8F0] rounded font-semibold text-xs bg-white"
                      >
                        <option value="">-- Choose Borrower / Customer (CIF) --</option>
                        {filteredCustomers.map((cu) => (
                          <option key={cu.id} value={cu.id}>
                            {cu.cif} — {cu.name} ({cu.segment} | {cu.branch})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Collateral Selection filtered strictly to Customer */}
                  {wizardCustomerId && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block font-semibold text-[#101828] mb-1">
                        2. Select Authorized Collateral Asset (Belonging to {selectedCustomer?.name || wizardCustomerId}) <span className="text-red-500">*</span>
                      </label>

                      {filteredCollaterals.length > 0 ? (
                        <div className="space-y-2">
                          {filteredCollaterals.map((c) => {
                            const isSelected = wizardColId === c.id || wizardColId === c.code;
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setWizardColId(c.id);
                                  loadWizardExposure(c.id);
                                }}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected ? 'bg-[#EFF5FB] border-[#5F97C7] shadow-2xs' : 'bg-white border-[#E2E8F0] hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2.5">
                                    <Building2 className={`w-4 h-4 ${isSelected ? 'text-[#1F4E7A]' : 'text-slate-400'}`} />
                                    <div>
                                      <div className="font-bold text-[#101828] text-xs">
                                        {c.code} — {c.category} ({c.type || c.category})
                                      </div>
                                      <div className="text-[11px] text-[#5B6472] flex gap-3 mt-0.5">
                                        <span>Ownership: <strong>{c.ownerType}</strong></span>
                                        <span>Branch: <strong>{c.branch}</strong></span>
                                        <span>Current Insurance: <strong>{c.insuranceStatus || 'Uninsured'}</strong></span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[11px] text-[#5B6472]">Market Valuation:</div>
                                    <div className="text-xs font-bold text-[#102E4A]">
                                      ETB {c.valuationAmount?.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-emerald-700 font-semibold">
                                      Net: ETB {((c.valuationAmount || 0) * (1 - (c.haircut || 0) / 100)).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>No active/authorized collateral assets found for this customer. Please register and approve a collateral asset first.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: EXPOSURE & INSURANCE REQUIREMENT FORMULA */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#1F4E7A]" />
                      Step 2: Exposure Breakdown & Required Insurance Calculation
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Required Insurance Rule: <strong>MAX(Total Outstanding Loan Balance, Collateral Market Value)</strong>
                    </p>
                  </div>

                  {loadingWizardExposure ? (
                    <div className="p-6 text-center text-[#5B6472]">Computing facility exposure and adequacy...</div>
                  ) : (
                    <div className="space-y-3">
                      {/* Linked Facilities Breakdown Table */}
                      <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-lg space-y-2">
                        <div className="font-bold text-[#101828] text-xs flex justify-between items-center">
                          <span>Secured Core Banking Facilities & Exposure</span>
                          <span className="font-mono text-red-700 font-bold">
                            Total Outstanding Exposure: ETB {outstandingExposure.toLocaleString()}
                          </span>
                        </div>

                        {wizardExposure?.facilityBreakdowns && wizardExposure.facilityBreakdowns.length > 0 ? (
                          <div className="space-y-1.5">
                            {wizardExposure.facilityBreakdowns.map((fac: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center p-2 bg-white rounded border border-slate-200 text-xs">
                                <div>
                                  <strong className="text-[#102E4A]">{fac.loanReference || fac.facilityId}</strong> — {fac.facilityType || 'Term Loan'}
                                </div>
                                <div className="flex gap-4">
                                  <span>Approved Limit: ETB {(fac.approvedLimit || 0).toLocaleString()}</span>
                                  <span>Outstanding: <strong className="text-red-700">ETB {(fac.outstandingBalance || 0).toLocaleString()}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-center text-[#5B6472] text-xs">
                            No credit facilities currently linked to this collateral asset.
                          </div>
                        )}
                      </div>

                      {/* Required Insurance Formula Box */}
                      <div className="p-4 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#102E4A] text-xs uppercase tracking-wide">
                            Insurance Requirement Evaluation
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-bold text-[10px]">
                            Category: {wizardCol?.category}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-[#5B6472] block">Total Outstanding Loan Exposure:</span>
                            <strong className="font-mono text-red-700">ETB {outstandingExposure.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block">Collateral Market Valuation:</span>
                            <strong className="font-mono text-[#102E4A]">ETB {collateralMarketVal.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block">Required Sum Insured:</span>
                            <strong className="font-mono text-emerald-700 text-sm">
                              ETB {requiredInsuranceAmount.toLocaleString()}
                            </strong>
                          </div>
                        </div>

                        <div className="p-2.5 bg-white border border-[#DCE9F5] rounded text-[11px] text-[#102E4A] space-y-1">
                          <div>
                            <strong>Mandatory Coverage Rule for {wizardCol?.category}:</strong> {getStandardCoverageForCategory(wizardCol?.category)}
                          </div>
                          <div className="text-[#5B6472]">
                            Rule: Required Insurance = MAX(ETB {outstandingExposure.toLocaleString()}, ETB {collateralMarketVal.toLocaleString()}) = <strong>ETB {requiredInsuranceAmount.toLocaleString()}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: POLICY INFORMATION & APPROVED INSURER */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-[#1F4E7A]" />
                      Step 3: Policy Information & Insurer Details
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Enter policy terms. Insurer must be selected from the active approved insurers registry.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        Policy Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={wizardPolicy.policyNumber || ''}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, policyNumber: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-mono font-bold text-[#102E4A]"
                      />
                      {isDuplicatePolicy(wizardPolicy.policyNumber) && (
                        <div className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Duplicate Policy Error: This policy number is already registered.
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        Approved Insurer (Strict Enforcement) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={wizardPolicy.insurerName || ''}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, insurerName: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-semibold bg-white"
                      >
                        {activeApprovedInsurers.map((ins) => (
                          <option key={ins.id} value={ins.name}>
                            {ins.name} (Approved)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        Coverage Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={wizardPolicy.coverageType || 'Fire & Allied Perils'}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, coverageType: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-semibold bg-white"
                      >
                        <option value="Fire & Allied Perils">Fire & Allied Perils</option>
                        <option value="Comprehensive Motor">Comprehensive Motor</option>
                        <option value="All-Risk Comprehensive Machinery Breakdown">All-Risk Comprehensive Machinery Breakdown</option>
                        <option value="Fire, Lightning, Burglary & Spontaneous Combustion">Fire, Lightning, Burglary & Spontaneous Combustion</option>
                        <option value="Burglary & Housebreaking">Burglary & Housebreaking</option>
                        <option value="All Risks">All Risks</option>
                        <option value="Goods in Transit">Goods in Transit</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        Insured Amount ({defaultCurrency}) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={wizardPolicy.insuredAmount || ''}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, insuredAmount: Number(e.target.value) })}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums text-emerald-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">Annual Premium ({defaultCurrency})</label>
                      <input
                        type="number"
                        min="0"
                        value={wizardPolicy.premium || ''}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, premium: Number(e.target.value) })}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        Effective Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={wizardPolicy.effectiveDate || defaultEffectiveDate}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, effectiveDate: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        Expiry Date (Min 1 Year) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={wizardPolicy.expiryDate || defaultExpiryDate}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, expiryDate: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded"
                      />
                    </div>
                  </div>

                  {/* Real-time Adequacy Gauge */}
                  <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-[#5B6472] uppercase">Coverage Adequacy Percentage</div>
                      <div className="text-base font-extrabold text-[#102E4A] tabular-nums">
                        {wizardCoveragePct.toFixed(1)}% (Required Threshold: {coverageThreshold}%)
                      </div>
                    </div>
                    <CircularProgress value={Math.min(100, wizardCoveragePct)} size={44} strokeWidth={5} />
                  </div>
                </div>
              )}

              {/* STEP 4: INSURANCE DOCUMENTS (MANDATORY & SUPPORTING) */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div>
                      <h4 className="font-bold text-[#101828] text-xs flex items-center gap-1.5">
                        <FileBadge className="w-4 h-4 text-[#1F4E7A]" />
                        Attached Insurance Documents ({wizardDocuments.length})
                      </h4>
                      <p className="text-[#5B6472] text-[11px]">
                        Mandatory: Insurance Policy Schedule & Premium Payment Receipt. Add any extra legal endorsements.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newDoc: WizardDocItem = {
                          id: `doc-pol-extra-${Date.now()}-${wizardDocuments.length}`,
                          name: '',
                          type: 'Endorsement Certificate',
                          expiryDate: wizardPolicy.expiryDate || defaultExpiryDate,
                          remarks: 'Additional policy document',
                          fileName: '',
                          fileSize: '',
                          fileSizeNum: 0,
                          contentType: 'application/pdf',
                          fileContent: '',
                          isMandatory: false,
                        };
                        setWizardDocuments([...wizardDocuments, newDoc]);
                      }}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      + Add Supporting Policy Document
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {wizardDocuments.map((doc, idx) => {
                      const hasFile = Boolean(doc.fileContent && doc.fileName);
                      return (
                        <div
                          key={doc.id}
                          className={`p-3.5 rounded-lg border space-y-2 transition-all ${
                            hasFile
                              ? 'bg-white border-emerald-300 shadow-2xs'
                              : doc.isMandatory
                              ? 'bg-amber-50/50 border-amber-300'
                              : 'bg-white border-[#E2E8F0]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 flex-1">
                              <Paperclip
                                className={`w-4 h-4 flex-shrink-0 ${
                                  hasFile ? 'text-emerald-600' : doc.isMandatory ? 'text-amber-600' : 'text-slate-400'
                                }`}
                              />
                              <div className="flex-1 grid grid-cols-3 gap-2">
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <label className="block text-[10px] font-semibold text-[#5B6472]">Document Type</label>
                                    {doc.isMandatory && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-bold">
                                        Mandatory
                                      </span>
                                    )}
                                  </div>
                                  <select
                                    value={doc.type}
                                    onChange={(e) => {
                                      const updated = [...wizardDocuments];
                                      updated[idx].type = e.target.value;
                                      setWizardDocuments(updated);
                                    }}
                                    className="w-full p-1 border border-[#E2E8F0] rounded text-xs font-semibold"
                                  >
                                    <option value="Insurance Policy Schedule">Insurance Policy Schedule (with Loss Payee Clause)</option>
                                    <option value="Premium Payment Receipt">Premium Payment Settlement Receipt</option>
                                    <option value="Endorsement Certificate">Endorsement Certificate</option>
                                    <option value="Insurer Coverage Confirmation Letter">Insurer Coverage Confirmation Letter</option>
                                    <option value="Other Policy Document">Other Policy Document</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-[#5B6472]">Document Title / Ref</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Policy Schedule #POL-9921"
                                    value={doc.name}
                                    onChange={(e) => {
                                      const updated = [...wizardDocuments];
                                      updated[idx].name = e.target.value;
                                      setWizardDocuments(updated);
                                    }}
                                    className="w-full p-1 border border-[#E2E8F0] rounded text-xs"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-semibold text-[#5B6472]">Expiry Date</label>
                                  <input
                                    type="date"
                                    value={doc.expiryDate}
                                    onChange={(e) => {
                                      const updated = [...wizardDocuments];
                                      updated[idx].expiryDate = e.target.value;
                                      setWizardDocuments(updated);
                                    }}
                                    className="w-full p-1 border border-[#E2E8F0] rounded text-xs"
                                  />
                                </div>
                              </div>
                            </div>

                            {!doc.isMandatory && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWizardDocuments(wizardDocuments.filter((_, i) => i !== idx));
                                }}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Remove slot"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {/* Digital File Attachment Trigger */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] bg-slate-50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                id={`file-pol-wizard-${doc.id}`}
                                className="hidden"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    const file = e.target.files[0];
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      const updated = [...wizardDocuments];
                                      updated[idx].fileName = file.name;
                                      updated[idx].fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
                                      updated[idx].fileSizeNum = file.size;
                                      updated[idx].contentType = file.type || 'application/pdf';
                                      updated[idx].fileContent = reader.result as string;
                                      if (!updated[idx].name) {
                                        updated[idx].name = file.name.replace(/\.[^/.]+$/, '');
                                      }
                                      setWizardDocuments(updated);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <label
                                htmlFor={`file-pol-wizard-${doc.id}`}
                                className={`cursor-pointer py-1 px-3 rounded font-semibold flex items-center gap-1.5 text-xs shadow-2xs transition-colors ${
                                  hasFile
                                    ? 'bg-white border border-emerald-400 text-emerald-900 hover:bg-emerald-50'
                                    : doc.isMandatory
                                    ? 'bg-[#102E4A] text-white hover:bg-[#173F63]'
                                    : 'bg-slate-700 text-white hover:bg-slate-800'
                                }`}
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                {hasFile ? 'Replace File' : 'Attach File (PDF / Images)'}
                              </label>

                              {hasFile ? (
                                <span className="font-mono text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  {doc.fileName} ({doc.fileSize}) — Status: Uploaded
                                </span>
                              ) : (
                                <span className="text-amber-800 font-bold text-[11px] flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  File Upload Required
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Prominent Add Supporting Document Card Button at Bottom */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newDoc: WizardDocItem = {
                          id: `doc-pol-extra-${Date.now()}-${wizardDocuments.length}`,
                          name: '',
                          type: 'Endorsement Certificate',
                          expiryDate: wizardPolicy.expiryDate || defaultExpiryDate,
                          remarks: 'Additional policy document',
                          fileName: '',
                          fileSize: '',
                          fileSizeNum: 0,
                          contentType: 'application/pdf',
                          fileContent: '',
                          isMandatory: false,
                        };
                        setWizardDocuments([...wizardDocuments, newDoc]);
                      }}
                      className="w-full py-3 px-4 border-2 border-dashed border-[#5F97C7] hover:border-[#1F4E7A] bg-[#EFF5FB]/60 hover:bg-[#DCE9F5]/70 rounded-lg text-[#102E4A] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="p-1 rounded-full bg-[#B9D3EB] group-hover:bg-[#8FB8DC] text-[#102E4A]">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span>+ Add Additional / Supporting Policy Document (Loss Payee Endorsement, Cover Note, Inspection Photos, etc.)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: VALIDATION SUMMARY & SUBMIT */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-700" />
                      Step 5: Policy Validation Summary & Submission
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Under the Four-Eyes Principle, the policy will be submitted in <strong>Pending Approval</strong> state.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="cims-card p-4 space-y-2">
                      <h5 className="font-bold text-[#101828] border-b border-[#E2E8F0] pb-1">Policy & Insurer Validation</h5>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Policy Number:</span>
                        <strong className="font-mono text-[#102E4A]">{wizardPolicy.policyNumber} ✓</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Approved Insurer:</span>
                        <strong className="text-emerald-700">✓ {wizardPolicy.insurerName}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Duplicate Check:</span>
                        <strong className="text-emerald-700">✓ No Duplicates Detected</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Policy Validity Period:</span>
                        <strong>{wizardPolicy.effectiveDate} to {wizardPolicy.expiryDate} (Valid)</strong>
                      </div>
                    </div>

                    <div className="cims-card p-4 space-y-2">
                      <h5 className="font-bold text-[#101828] border-b border-[#E2E8F0] pb-1">Coverage & Exposure Adequacy</h5>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Required Insurance:</span>
                        <strong className="font-mono text-[#102E4A]">ETB {requiredInsuranceAmount.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Policy Insured Amount:</span>
                        <strong className="font-mono text-emerald-700">ETB {wizardInsAmount.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Coverage Adequacy:</span>
                        <strong className={isUnderinsured ? 'text-amber-700' : 'text-emerald-700'}>
                          {wizardCoveragePct.toFixed(1)}% {isUnderinsured ? '(Underinsured)' : '(Adequate)'}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#5B6472]">Mandatory Documents:</span>
                        <strong className="text-emerald-700">{wizardDocuments.filter((d) => d.fileContent).length} File(s) Uploaded ✓</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0" />
                    <span>
                      Upon submission, policy status becomes <strong>Pending Approval</strong> and will appear in the Branch Manager checker queue. Checker approval will activate the policy and update Customer 360 metrics.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="p-4 bg-slate-50 border-t border-[#E2E8F0] flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  if (wizardStep > 1) setWizardStep((wizardStep - 1) as any);
                  else setShowWizardModal(false);
                }}
                className="btn-secondary"
              >
                {wizardStep === 1 ? 'Cancel' : 'Back'}
              </button>

              <div className="flex gap-2">
                {wizardStep < 5 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1) {
                        const errs = getStep1Errors();
                        if (errs.length > 0) {
                          alert('Cannot proceed:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                      }
                      if (wizardStep === 2) {
                        const errs = getStep2Errors();
                        if (errs.length > 0) {
                          alert('Notice:\n\n• ' + errs.join('\n• '));
                        }
                      }
                      if (wizardStep === 3) {
                        const errs = getStep3Errors();
                        if (errs.length > 0) {
                          alert('Cannot proceed:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                      }
                      if (wizardStep === 4 && missingPolicyDocs.length > 0) {
                        alert(
                          `Cannot proceed: You must attach valid digital files for all mandatory policy documents.\n\nMissing:\n• ` +
                            missingPolicyDocs.map((m) => m.type).join('\n• ')
                        );
                        return;
                      }
                      setWizardStep((wizardStep + 1) as any);
                    }}
                    className="btn-primary"
                  >
                    Continue to Step {wizardStep + 1}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={wizardSubmitting}
                    onClick={handleFinishWizard}
                    className="btn-primary bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {wizardSubmitting ? 'Submitting to Checker…' : 'Submit for Checker Authorization'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Policy Document Modal */}
      {showUploadDocModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload Policy Document (DMS)</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Attach File</p>
              </div>
              <button onClick={() => setShowUploadDocModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Document Title (M)</label>
                <input
                  type="text"
                  placeholder="e.g. Endorsement Certificate"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Document Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                >
                  <option value="Insurance Policy Schedule">Insurance Policy Schedule</option>
                  <option value="Premium Payment Receipt">Premium Payment Receipt</option>
                  <option value="Endorsement Certificate">Endorsement Certificate</option>
                  <option value="Other Policy Document">Other Policy Document</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={uploadDocExpiry}
                  onChange={(e) => setUploadDocExpiry(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowUploadDocModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={uploadingDoc}
                  onClick={async () => {
                    if (!uploadDocName.trim()) {
                      alert('Please enter a document title.');
                      return;
                    }
                    setUploadingDoc(true);
                    try {
                      await cimsApi.uploadDocument(
                        'Insurance Policy',
                        selectedPolicy.id,
                        uploadDocName,
                        uploadDocType,
                        uploadDocExpiry || undefined
                      );
                      alert('Policy document uploaded to DMS successfully (Status: Pending Verification).');
                      setShowUploadDocModal(false);
                      setUploadDocName('');
                      window.location.reload();
                    } catch (e: any) {
                      alert(`Failed to upload document: ${e?.message || e}`);
                    } finally {
                      setUploadingDoc(false);
                    }
                  }}
                  className="btn-primary disabled:opacity-60"
                >
                  {uploadingDoc ? 'Uploading…' : 'Upload File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Amend Policy Modal */}
      {showAmendModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Amend Insurance Policy</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Modify Terms</p>
              </div>
              <button onClick={() => setShowAmendModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-[#EFF5FB] p-3 rounded-lg border border-[#E2E8F0]">
                <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-[#5B6472] border-b border-[#E2E8F0] pb-1 mb-2">
                  <span>CURRENT VALUE</span>
                  <span>NEW VALUE</span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center py-1.5 border-b border-[#E2E8F0]/60">
                  <div>
                    <div className="text-[10px] text-[#5B6472]">Approved Insurer</div>
                    <div className="font-semibold text-[#101828]">{selectedPolicy.insurerName}</div>
                  </div>
                  <div>
                    <select
                      value={amendData.insurerName || selectedPolicy.insurerName}
                      onChange={(e) => setAmendData({ ...amendData, insurerName: e.target.value })}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs"
                    >
                      {activeApprovedInsurers.map((i) => (
                        <option key={i.id} value={i.name}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center py-1.5 border-b border-[#E2E8F0]/60">
                  <div>
                    <div className="text-[10px] text-[#5B6472]">Insured Amount</div>
                    <div className="font-semibold text-emerald-700">
                      {defaultCurrency} {selectedPolicy.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="1"
                      value={amendData.insuredAmount ?? selectedPolicy.insuredAmount}
                      onChange={(e) => setAmendData({ ...amendData, insuredAmount: Number(e.target.value) })}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded font-bold tabular-nums text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center py-1.5 border-b border-[#E2E8F0]/60">
                  <div>
                    <div className="text-[10px] text-[#5B6472]">Annual Premium</div>
                    <div className="font-semibold text-[#101828]">
                      {defaultCurrency} {selectedPolicy.premium?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={amendData.premium ?? selectedPolicy.premium}
                      onChange={(e) => setAmendData({ ...amendData, premium: Number(e.target.value) })}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded font-bold tabular-nums text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center py-1.5">
                  <div>
                    <div className="text-[10px] text-[#5B6472]">Expiry Date</div>
                    <div className="font-semibold text-[#101828]">{selectedPolicy.expiryDate}</div>
                  </div>
                  <div>
                    <input
                      type="date"
                      value={amendData.expiryDate || selectedPolicy.expiryDate}
                      onChange={(e) => setAmendData({ ...amendData, expiryDate: e.target.value })}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Amendment Reason <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Valuation increase adjustment"
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowAmendModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={amendSubmitting || !amendReason.trim()}
                  onClick={async () => {
                    if (!amendReason.trim()) {
                      alert('Amendment reason is mandatory.');
                      return;
                    }
                    setAmendSubmitting(true);
                    try {
                      await onAmendPolicy(selectedPolicy.id, amendData, amendReason);
                      alert('Policy amendment submitted for checker authorization.');
                      setShowAmendModal(false);
                      setShowDetailModal(false);
                    } catch (e: any) {
                      alert(`Amendment failed: ${e?.message || e}`);
                    } finally {
                      setAmendSubmitting(false);
                    }
                  }}
                  className="btn-primary disabled:opacity-60"
                >
                  {amendSubmitting ? 'Submitting…' : 'Submit Amendment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew Policy Modal */}
      {showRenewModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Renew Insurance Policy</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Annual Extension</p>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Renewed Insured Amount (ETB)</label>
                <input
                  type="number"
                  min="1"
                  value={renewAmount}
                  onChange={(e) => setRenewAmount(Number(e.target.value))}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Renewed Annual Premium (ETB)</label>
                <input
                  type="number"
                  min="0"
                  value={renewPremium}
                  onChange={(e) => setRenewPremium(Number(e.target.value))}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">New Expiry Date (M)</label>
                <input
                  type="date"
                  value={renewExpiryDate}
                  onChange={(e) => setRenewExpiryDate(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-semibold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowRenewModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={renewSubmitting}
                  onClick={async () => {
                    setRenewSubmitting(true);
                    try {
                      await onRenewPolicy(selectedPolicy.id, renewAmount, renewPremium, renewExpiryDate);
                      alert('Policy renewal submitted for checker authorization.');
                      setShowRenewModal(false);
                      setShowDetailModal(false);
                    } catch (e: any) {
                      alert(`Renewal failed: ${e?.message || e}`);
                    } finally {
                      setRenewSubmitting(false);
                    }
                  }}
                  className="btn-primary bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60"
                >
                  {renewSubmitting ? 'Renewing…' : 'Authorize Renewal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Endorse Policy Modal */}
      {showEndorseModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Issue Policy Endorsement</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Schedule Addition</p>
              </div>
              <button onClick={() => setShowEndorseModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Endorsement Number</label>
                <input
                  type="text"
                  value={endorsementNo}
                  onChange={(e) => setEndorsementNo(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Endorsement Description (M)</label>
                <textarea
                  rows={3}
                  value={endorsementDesc}
                  onChange={(e) => setEndorsementDesc(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Effective Date</label>
                <input
                  type="date"
                  value={endorsementEffDate}
                  onChange={(e) => setEndorsementEffDate(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowEndorseModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={endorseSubmitting}
                  onClick={async () => {
                    if (onEndorsePolicy) {
                      setEndorseSubmitting(true);
                      try {
                        await onEndorsePolicy(selectedPolicy.id, endorsementNo, endorsementDesc, endorsementEffDate);
                        alert('Endorsement registered.');
                        setShowEndorseModal(false);
                      } catch (e: any) {
                        alert(`Endorsement failed: ${e?.message || e}`);
                      } finally {
                        setEndorseSubmitting(false);
                      }
                    }
                  }}
                  className="btn-primary disabled:opacity-60"
                >
                  {endorseSubmitting ? 'Issuing…' : 'Issue Endorsement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replace Policy Modal */}
      {showReplaceModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Replace Insurance Policy</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Full Novation</p>
              </div>
              <button onClick={() => setShowReplaceModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">New Approved Insurer</label>
                <select
                  value={replacementPolicy.insurerName || selectedPolicy.insurerName}
                  onChange={(e) => setReplacementPolicy({ ...replacementPolicy, insurerName: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                >
                  {activeApprovedInsurers.map((i) => (
                    <option key={i.id} value={i.name}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">New Insured Amount (ETB)</label>
                <input
                  type="number"
                  min="1"
                  value={replacementPolicy.insuredAmount || selectedPolicy.insuredAmount}
                  onChange={(e) => setReplacementPolicy({ ...replacementPolicy, insuredAmount: Number(e.target.value) })}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Replacement Reason (M)</label>
                <input
                  type="text"
                  placeholder="e.g. Changed to lower premium approved insurer"
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowReplaceModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={replaceSubmitting}
                  onClick={async () => {
                    if (onReplacePolicy) {
                      setReplaceSubmitting(true);
                      try {
                        await onReplacePolicy(selectedPolicy.id, replacementPolicy, replacementReason);
                        alert('Replacement policy submitted for approval.');
                        setShowReplaceModal(false);
                        setShowDetailModal(false);
                      } catch (e: any) {
                        alert(`Replacement failed: ${e?.message || e}`);
                      } finally {
                        setReplaceSubmitting(false);
                      }
                    }
                  }}
                  className="btn-primary disabled:opacity-60"
                >
                  {replaceSubmitting ? 'Replacing…' : 'Submit Replacement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Policy Modal */}
      {showCancelModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Cancel Policy Cover</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber}</p>
              </div>
              <button onClick={() => setShowCancelModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Cancellation Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Mandatory cancellation reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowCancelModal(false)} className="btn-secondary">
                  Keep Policy
                </button>
                <button
                  disabled={cancelSubmitting || !cancelReason.trim()}
                  onClick={async () => {
                    if (!cancelReason.trim()) {
                      alert('Cancellation reason is mandatory.');
                      return;
                    }
                    if (onCancelPolicy) {
                      setCancelSubmitting(true);
                      try {
                        await onCancelPolicy(selectedPolicy.id, cancelReason);
                        alert('Policy cancellation request submitted for checker authorization.');
                        setShowCancelModal(false);
                        setShowDetailModal(false);
                      } catch (e: any) {
                        alert(`Cancellation failed: ${e?.message || e}`);
                      } finally {
                        setCancelSubmitting(false);
                      }
                    }
                  }}
                  className="btn-primary bg-red-700 hover:bg-red-800 disabled:opacity-60"
                >
                  {cancelSubmitting ? 'Cancelling…' : 'Submit Cancellation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Policy Modal */}
      {showCloseModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Close Policy (Matured / Settled)</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber}</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Closure Reason <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Mandatory closure reason"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowCloseModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={closeSubmitting || !closeReason.trim()}
                  onClick={async () => {
                    if (!closeReason.trim()) {
                      alert('Closure reason is mandatory.');
                      return;
                    }
                    if (onClosePolicy) {
                      setCloseSubmitting(true);
                      try {
                        await onClosePolicy(selectedPolicy.id, closeReason);
                        alert('Policy closure request submitted for checker authorization.');
                        setShowCloseModal(false);
                        setShowDetailModal(false);
                      } catch (e: any) {
                        alert(`Closure failed: ${e?.message || e}`);
                      } finally {
                        setCloseSubmitting(false);
                      }
                    }
                  }}
                  className="btn-primary bg-slate-700 hover:bg-slate-800 disabled:opacity-60"
                >
                  {closeSubmitting ? 'Closing…' : 'Submit Closure'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Policy Modal */}
      {showReopenModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Reopen Closed Policy</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Request Reactivation</p>
              </div>
              <button onClick={() => setShowReopenModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-[11px]">
                Reopening a closed policy requires checker authorization and validation of coverage adequacy.
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Reopening Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Reopened for active facility coverage"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowReopenModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={reopenSubmitting || !reopenReason.trim()}
                  onClick={async () => {
                    if (!reopenReason.trim()) {
                      alert('Reopening reason is mandatory.');
                      return;
                    }
                    setReopenSubmitting(true);
                    try {
                      if (onReopenPolicy) {
                        await onReopenPolicy(selectedPolicy.id, reopenReason);
                      } else {
                        await cimsApi.reopenPolicy(selectedPolicy.id, reopenReason, currentUser.username);
                      }
                      alert('Policy reopening request submitted for checker authorization.');
                      setShowReopenModal(false);
                      setShowDetailModal(false);
                    } catch (e: any) {
                      alert(`Reopening failed: ${e?.message || e}`);
                    } finally {
                      setReopenSubmitting(false);
                    }
                  }}
                  className="btn-primary bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60"
                >
                  {reopenSubmitting ? 'Submitting…' : 'Submit Reopen Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
