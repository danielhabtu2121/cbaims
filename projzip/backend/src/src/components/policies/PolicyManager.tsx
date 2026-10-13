import React, { useState, useEffect } from 'react';
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
  ArrowUpRight,
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
  CollateralTaxonomy,
  InsuranceComplianceDto,
  StructuredPolicyHistoryItem,
  ValidationCheckItemDto,
  PolicyPreValidationResultDto,
  EntryTimeExceptionRequest,
} from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { CircularProgress } from '../layout/CircularProgress';
import { cimsApi } from '../../api/cimsApi';
import { DocumentPreviewModal } from '../documents/DocumentPreviewModal';

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

interface DocumentAttachmentZoneProps {
  title: string;
  description?: string;
  defaultDocType: string;
  documents: WizardDocItem[];
  onChange: (docs: WizardDocItem[]) => void;
  required?: boolean;
  maxFiles?: number;
}

const DocumentAttachmentZone: React.FC<DocumentAttachmentZoneProps> = ({
  title,
  description = 'Attach supporting evidence, schedules, or approval memos (PDF, DOCX, JPG, PNG up to 25MB)',
  defaultDocType,
  documents,
  onChange,
  required = false,
  maxFiles = 3,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = `file-input-${defaultDocType.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const newDocs: WizardDocItem[] = [...documents];

    Array.from(fileList).forEach((file) => {
      if (newDocs.length >= maxFiles) return;
      const reader = new FileReader();
      reader.onload = () => {
        newDocs.push({
          id: `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: defaultDocType,
          expiryDate: '',
          remarks: '',
          fileName: file.name,
          fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          fileSizeNum: file.size,
          contentType: file.type || 'application/pdf',
          fileContent: reader.result as string,
          isMandatory: required,
        });
        onChange([...newDocs]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeDoc = (id: string) => {
    onChange(documents.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block font-semibold text-[#101828] text-xs flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-[#1F4E7A]" />
          {title} {required && <span className="text-red-600">*</span>}
        </label>
        <span className="text-[10px] text-[#5B6472]">
          {documents.length} of {maxFiles} files attached
        </span>
      </div>

      {/* Drag & Drop Upload Zone */}
      {documents.length < maxFiles && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-xl p-3.5 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-[#1F4E7A] bg-[#EFF5FB]'
              : 'border-[#CBD5E1] bg-slate-50 hover:bg-[#EFF5FB]/60 hover:border-[#1F4E7A]/60'
          }`}
          onClick={() => {
            const el = document.getElementById(inputId);
            if (el) el.click();
          }}
        >
          <input
            id={inputId}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff"
            multiple={maxFiles > 1}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center justify-center gap-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-[#1F4E7A] mb-0.5">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-[#102E4A]">
              Click to browse or drag &amp; drop document
            </div>
            <div className="text-[10px] text-[#5B6472]">{description}</div>
          </div>
        </div>
      )}

      {/* Attached Files List */}
      {documents.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {documents.map((doc) => {
            const isPdf = doc.fileName?.toLowerCase().endsWith('.pdf') || doc.contentType?.includes('pdf');
            const isImg = doc.fileName?.match(/\.(jpg|jpeg|png|tif|tiff)$/i) || doc.contentType?.includes('image');

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2.5 bg-white border border-[#CBD5E1] rounded-lg shadow-2xs hover:border-[#94A3B8] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                      isPdf
                        ? 'bg-rose-100 text-rose-700'
                        : isImg
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {isPdf ? 'PDF' : isImg ? 'IMG' : 'DOC'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#101828] truncate max-w-[220px]" title={doc.fileName}>
                      {doc.fileName || doc.name}
                    </div>
                    <div className="text-[10px] text-[#5B6472] flex items-center gap-1.5">
                      <span>{doc.fileSize}</span>
                      <span>•</span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3 text-emerald-600" /> Ready to Attach
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => removeDoc(doc.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded"
                    title="Remove file"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface PolicyManagerProps {
  policies: InsurancePolicy[];
  endorsements: PolicyEndorsement[];
  collaterals: Collateral[];
  customers: Customer[];
  insurers: ApprovedInsurer[];
  documents: OwnershipDocument[];
  systemParameters?: SystemParameter[];
  taxonomies?: CollateralTaxonomy[];
  currentUser: UserSession;
  initialPolicyId?: string | null;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
  onCreatePolicyDraft: (policy: Partial<InsurancePolicy>, documents?: any[]) => Promise<void>;
  onSubmitPolicy: (policyId: string) => Promise<void>;
  onAmendPolicy: (policyId: string, policy: Partial<InsurancePolicy>, reason: string, documents?: any[]) => Promise<void>;
  onRenewPolicy: (policyId: string, newAmount: number, newPremium: number, newExpiryDate: string, documents?: any[]) => Promise<void>;
  onEndorsePolicy?: (policyId: string, endorsementNo: string, description: string, effectiveDate?: string, documentId?: string, documents?: any[]) => Promise<void>;
  onReplacePolicy?: (policyId: string, replacement: any, reason: string, documents?: any[]) => Promise<void>;
  onCancelPolicy?: (policyId: string, reason: string, documents?: any[]) => Promise<void>;
  onClosePolicy?: (policyId: string, reason: string, documents?: any[]) => Promise<void>;
  onReopenPolicy?: (policyId: string, reason: string, documents?: any[]) => Promise<void>;
  onReload?: () => Promise<void>;
}

export const PolicyManager: React.FC<PolicyManagerProps> = ({
  policies,
  endorsements,
  collaterals,
  customers,
  insurers,
  documents,
  systemParameters = [],
  taxonomies = [],
  currentUser,
  initialPolicyId,
  onNavigate,
  onCreatePolicyDraft,
  onSubmitPolicy,
  onAmendPolicy,
  onRenewPolicy,
  onEndorsePolicy,
  onReplacePolicy,
  onCancelPolicy,
  onClosePolicy,
  onReopenPolicy,
  onReload,
}) => {
  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const defaultEffectiveDate = isoDate(today);
  const defaultExpiryDate = isoDate(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));

  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'financials' | 'endorsements' | 'documents' | 'history'>('financials');

  useEffect(() => {
    if (initialPolicyId && policies.length > 0) {
      const found = policies.find(
        (p) => p.id === initialPolicyId || p.policyNumber === initialPolicyId
      );
      if (found) {
        setSelectedPolicy(found);
        setShowDetailModal(true);
        loadPolicyHistory(found.id);
        loadDetailCompliance(found);
      }
    }
  }, [initialPolicyId, policies]);

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
  const [detailCompliance, setDetailCompliance] = useState<InsuranceComplianceDto | null>(null);
  const [loadingDetailCompliance, setLoadingDetailCompliance] = useState(false);

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

  const loadDetailCompliance = async (policy: InsurancePolicy) => {
    if (!policy.collateralId) return;
    setLoadingDetailCompliance(true);
    try {
      const comp = await cimsApi.evaluatePolicyCompliance(policy.collateralId, policy, policy.loanAccountId);
      setDetailCompliance(comp);
    } catch (e) {
      console.warn('Unable to evaluate policy compliance', e);
    } finally {
      setLoadingDetailCompliance(false);
    }
  };

  // =========================================================================
  // Guided Insurance Registration Wizard State (6 Steps)
  // =========================================================================
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [wizardCustomerId, setWizardCustomerId] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [collateralSearchQuery, setCollateralSearchQuery] = useState('');
  const [wizardColId, setWizardColId] = useState('');
  const [wizardExposure, setWizardExposure] = useState<ExposureAdequacySummary | null>(null);
  const [loadingWizardExposure, setLoadingWizardExposure] = useState(false);
  const [wizardCompliance, setWizardCompliance] = useState<InsuranceComplianceDto | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [wizardSubmitting, setWizardSubmitting] = useState(false);

  const defaultCurrency = systemParameters.find((p) => p.paramKey === 'default_currency')?.paramValue || 'ETB';

  const activeApprovedInsurers = (insurers || []).filter((i) => i.active !== false);

  const [wizardPolicy, setWizardPolicy] = useState<Partial<InsurancePolicy>>({
    policyNumber: '',
    insurerId: '',
    insurerName: '',
    coverageType: '',
    insuredAmount: 0,
    premium: 0,
    effectiveDate: defaultEffectiveDate,
    expiryDate: defaultExpiryDate,
    status: 'Pending Approval',
    loanAccountId: '',
  });

  const evaluateWizardCompliance = async () => {
    if (!wizardColId) return;
    setLoadingCompliance(true);
    try {
      const comp = await cimsApi.evaluatePolicyCompliance(wizardColId, wizardPolicy, wizardPolicy.loanAccountId);
      setWizardCompliance(comp);
    } catch (e) {
      console.warn('Unable to evaluate wizard compliance', e);
    } finally {
      setLoadingCompliance(false);
    }
  };

  const [wizardDocuments, setWizardDocuments] = useState<WizardDocItem[]>([]);
  const [acknowledgedUnderinsurance, setAcknowledgedUnderinsurance] = useState(false);

  // Document upload modal state (in detail modal)
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadDocType, setUploadDocType] = useState('Insurance Policy Schedule');
  const [uploadDocExpiry, setUploadDocExpiry] = useState(defaultExpiryDate);
  const [uploadDocRemarks, setUploadDocRemarks] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileContent, setUploadFileContent] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Action states
  const [amendData, setAmendData] = useState<Partial<InsurancePolicy>>({});
  const [amendReason, setAmendReason] = useState('Policy coverage adjustment');
  const [amendSubmitting, setAmendSubmitting] = useState(false);
  const [amendDocuments, setAmendDocuments] = useState<WizardDocItem[]>([]);

  const [renewAmount, setRenewAmount] = useState(0);
  const [renewPremium, setRenewPremium] = useState(0);
  const [renewExpiryDate, setRenewExpiryDate] = useState(defaultExpiryDate);
  const [renewSubmitting, setRenewSubmitting] = useState(false);
  const [renewDocuments, setRenewDocuments] = useState<WizardDocItem[]>([]);

  const [endorsementNo, setEndorsementNo] = useState(`END-${Date.now()}`);
  const [endorsementDesc, setEndorsementDesc] = useState('Bank sole loss payee clause endorsement');
  const [endorsementEffDate, setEndorsementEffDate] = useState(defaultEffectiveDate);
  const [endorsementDocId, setEndorsementDocId] = useState('');
  const [endorseSubmitting, setEndorseSubmitting] = useState(false);
  const [endorseDocuments, setEndorseDocuments] = useState<WizardDocItem[]>([]);

  const [replacementPolicy, setReplacementPolicy] = useState<Partial<InsurancePolicy>>({});
  const [replacementReason, setReplacementReason] = useState('Change of Insurer');
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);
  const [replaceDocuments, setReplaceDocuments] = useState<WizardDocItem[]>([]);

  const [cancelReason, setCancelReason] = useState('Borrower requested cancellation');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelDocuments, setCancelDocuments] = useState<WizardDocItem[]>([]);

  const [closeReason, setCloseReason] = useState('Loan facility fully settled');
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [closeDocuments, setCloseDocuments] = useState<WizardDocItem[]>([]);

  const [reopenDocuments, setReopenDocuments] = useState<WizardDocItem[]>([]);
  const [docPreviewTarget, setDocPreviewTarget] = useState<OwnershipDocument | null>(null);
  const [showDocPreviewModal, setShowDocPreviewModal] = useState<boolean>(false);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [batchDragOver, setBatchDragOver] = useState<boolean>(false);
  const [uninsuredFilterOnly, setUninsuredFilterOnly] = useState<boolean>(false);

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

  const wizardCol = collaterals.find((c) => c.id === wizardColId || c.code === wizardColId);

  const derivedCustomer = wizardCol
    ? customers.find(
        (cu) => (cu.id && cu.id === wizardCol.customerId) || (cu.cif && cu.cif === wizardCol.customerId)
      )
    : selectedCustomer;

  const availableCollaterals = collaterals.filter((c) => {
    if (c.status === 'Released' || c.status === 'Draft') return false;
    if (uninsuredFilterOnly) {
      const insStat = (c.insuranceStatus || '').toLowerCase();
      if (insStat && insStat !== 'uninsured' && insStat !== 'expired' && insStat !== 'gap') return false;
    }
    if (wizardCustomerId) {
      const matchesCust = c.customerId === wizardCustomerId || (selectedCustomer && (c.customerId === selectedCustomer.cif || c.customerId === selectedCustomer.id));
      if (!matchesCust) return false;
    }
    if (collateralSearchQuery.trim()) {
      const q = collateralSearchQuery.toLowerCase();
      const cust = customers.find(
        (cu) => (cu.id && cu.id === c.customerId) || (cu.cif && cu.cif === c.customerId)
      );
      const codeMatch = (c.code || '').toLowerCase().includes(q);
      const catMatch = (c.category || '').toLowerCase().includes(q);
      const typeMatch = (c.type || '').toLowerCase().includes(q);
      const custMatch = (c.customerId || '').toLowerCase().includes(q);
      const custNameMatch = (cust?.name || '').toLowerCase().includes(q);
      const custCifMatch = (cust?.cif || '').toLowerCase().includes(q);
      const branchMatch = (c.branch || '').toLowerCase().includes(q);
      const locMatch = (c.location || '').toLowerCase().includes(q);
      const descMatch = (c.description || '').toLowerCase().includes(q);
      return codeMatch || catMatch || typeMatch || custMatch || custNameMatch || custCifMatch || branchMatch || locMatch || descMatch;
    }
    return true;
  });

  const filteredCollaterals = wizardCustomerId
    ? collaterals.filter(
        (c) =>
          (c.customerId === wizardCustomerId || (selectedCustomer && (c.customerId === selectedCustomer.cif || c.customerId === selectedCustomer.id))) &&
          c.status !== 'Released' &&
          c.status !== 'Draft'
      )
    : availableCollaterals;

  // Determine standard mandatory insurance coverage type by collateral category using configured taxonomies
  const getStandardCoverageForCategory = (cat?: string): string => {
    if (taxonomies && taxonomies.length > 0 && cat) {
      const match = taxonomies.find(
        (t) => t.category?.toLowerCase() === cat.toLowerCase() && t.mandatoryCoverageType && t.mandatoryCoverageType.trim().length > 0
      );
      if (match?.mandatoryCoverageType) return match.mandatoryCoverageType;
    }
    const c = (cat || '').toLowerCase();
    if (c.includes('immovable') || c.includes('building') || c.includes('real')) {
      return 'Fire & Allied Perils';
    }
    if (c.includes('movable') || c.includes('vehicle') || c.includes('motor')) {
      return 'Comprehensive Motor';
    }
    if (c.includes('machin') || c.includes('business mortgage') || c.includes('equipment')) {
      return 'All-Risk Comprehensive Machinery Breakdown';
    }
    if (c.includes('inventory') || c.includes('merchandise') || c.includes('warehouse')) {
      return 'Fire, Lightning, Burglary & Spontaneous Combustion';
    }
    if (c.includes('financial') || c.includes('cash') || c.includes('guarantee')) {
      return 'No Insurance Required (Exempt Category)';
    }
    return 'Fire & Allied Perils';
  };

  // Dynamically configured coverage types from taxonomy
  const availableCoverageTypes = React.useMemo(() => {
    const list = new Set<string>();
    if (taxonomies && wizardCol) {
      taxonomies
        .filter((t) => t.category?.toLowerCase() === wizardCol.category?.toLowerCase())
        .forEach((t) => {
          if (t.mandatoryCoverageType && t.mandatoryCoverageType.trim()) {
            list.add(t.mandatoryCoverageType.trim());
          }
        });
    }
    if (wizardCompliance?.requiredCoverageType) {
      list.add(wizardCompliance.requiredCoverageType.trim());
    }
    if (wizardPolicy.coverageType && wizardPolicy.coverageType.trim()) {
      list.add(wizardPolicy.coverageType.trim());
    }
    (taxonomies || []).forEach((t) => {
      if (t.mandatoryCoverageType && t.mandatoryCoverageType.trim()) {
        list.add(t.mandatoryCoverageType.trim());
      }
    });
    [
      'Fire & Allied Perils',
      'Fire, Lightning & Burglary',
      'Comprehensive Motor',
      'All-Risk Comprehensive Machinery Breakdown',
      'Fire, Lightning, Burglary & Spontaneous Combustion',
      'Burglary & Housebreaking',
      'All Risks',
      'Goods in Transit',
    ].forEach((t) => list.add(t));
    return Array.from(list);
  }, [taxonomies, wizardCol, wizardCompliance, wizardPolicy.coverageType]);

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

      // Evaluate compliance from backend for authoritative mandatory coverage type
      let mandatoryCov = '';
      try {
        const comp = await cimsApi.evaluatePolicyCompliance(colId);
        if (comp) {
          setWizardCompliance(comp);
          if (comp.requiredCoverageType) {
            mandatoryCov = comp.requiredCoverageType;
          }
        }
      } catch (e) {
        console.warn('Backend compliance evaluation fallback:', e);
      }

      const stdCoverage = mandatoryCov || getStandardCoverageForCategory(chosenCol?.category);
      const exposureAmt = summary?.totalOutstandingExposure || 0;
      const colVal = chosenCol?.valuationAmount || 0;
      const isMandatory = isInsuranceMandatoryForCategory(chosenCol?.category);
      const requiredAmt = isMandatory ? Math.max(exposureAmt, colVal) : 0;

      setWizardPolicy((prev) => ({
        ...prev,
        coverageType: stdCoverage || prev.coverageType || 'Fire & Allied Perils',
        insuredAmount: prev.insuredAmount && prev.insuredAmount > 0 ? prev.insuredAmount : requiredAmt,
        premium: prev.premium && prev.premium > 0 ? prev.premium : Math.round(requiredAmt * 0.005),
        policyNumber:
          prev.policyNumber && prev.policyNumber.trim().length > 0
            ? prev.policyNumber
            : `POL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
        insurerId: prev.insurerId || activeApprovedInsurers[0]?.id || '',
        insurerName: prev.insurerName || activeApprovedInsurers[0]?.name || '',
      }));
    } catch (err) {
      console.error('Failed to load exposure for wizard:', err);
    } finally {
      setLoadingWizardExposure(false);
    }
  };

  // =========================================================================
  // Real-Time Pre-Validation & Entry-Time Exception Management State
  // =========================================================================
  const [preValidationResult, setPreValidationResult] = useState<PolicyPreValidationResultDto | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [showExceptionModal, setShowExceptionModal] = useState<boolean>(false);
  const [exceptionSubmitting, setExceptionSubmitting] = useState<boolean>(false);
  const [exceptionForm, setExceptionForm] = useState<{
    exceptionType: string;
    failedRequirement: string;
    reason: string;
    comments: string;
    evidenceDocument: string;
    evidenceFileContent?: string;
  }>({
    exceptionType: 'Missing Mandatory Document',
    failedRequirement: '',
    reason: '',
    comments: '',
    evidenceDocument: '',
    evidenceFileContent: '',
  });

  const runPreValidation = async () => {
    if (!wizardColId) return;
    setIsValidating(true);
    try {
      const selectedCol = collaterals.find((c) => c.id === wizardColId || c.code === wizardColId);
      const custId = wizardCustomerId || selectedCol?.customerId;

      const draftPol: Partial<InsurancePolicy> = {
        policyNumber: wizardPolicy.policyNumber,
        insurerName: wizardPolicy.insurerName,
        coverageType: wizardPolicy.coverageType || getStandardCoverageForCategory(selectedCol?.category || '') || 'Fire & Allied Perils',
        insuredAmount: Number(wizardPolicy.insuredAmount) || 0,
        premium: Number(wizardPolicy.premium) || 0,
        effectiveDate: wizardPolicy.effectiveDate || defaultEffectiveDate,
        expiryDate: wizardPolicy.expiryDate || defaultExpiryDate,
        collateralId: wizardColId,
        customerId: custId,
      };

      const docsPayload = (wizardDocuments || []).map((d) => ({
        type: d.type,
        name: d.name || d.fileName || d.type,
        fileName: d.fileName || '',
        fileContent: d.fileContent || '',
      }));

      const res = await cimsApi.preValidatePolicy(draftPol, docsPayload);
      setPreValidationResult(res);

      const firstOverrideable = res.checks?.find((c) => !c.passed && c.overrideable);
      if (firstOverrideable) {
        setExceptionForm((prev) => ({
          ...prev,
          exceptionType: firstOverrideable.exceptionType || 'Missing Mandatory Document',
          failedRequirement: firstOverrideable.failedRequirement || firstOverrideable.ruleName || '',
        }));
      }
    } catch (err: any) {
      console.warn('Pre-validation check failed:', err);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (wizardStep === 6 && showWizardModal && wizardColId) {
      runPreValidation();
    }
  }, [
    wizardStep,
    showWizardModal,
    wizardColId,
    wizardPolicy.insuredAmount,
    wizardPolicy.insurerName,
    wizardPolicy.effectiveDate,
    wizardPolicy.expiryDate,
    wizardDocuments,
  ]);

  const handleOpenExceptionModal = (overrideCheck?: ValidationCheckItemDto) => {
    const targetCheck = overrideCheck || preValidationResult?.checks?.find((c) => !c.passed && c.overrideable);
    setExceptionForm({
      exceptionType: targetCheck?.exceptionType || 'Missing Mandatory Document',
      failedRequirement: targetCheck?.failedRequirement || targetCheck?.ruleName || 'Validation Rule Exception',
      reason: '',
      comments: '',
      evidenceDocument: '',
      evidenceFileContent: '',
    });
    setShowExceptionModal(true);
  };

  const handleSubmitExceptionRequest = async () => {
    if (!exceptionForm.reason.trim()) {
      alert('Validation Error: Reason / justification is mandatory when requesting an exception.');
      return;
    }
    if (!exceptionForm.comments.trim()) {
      alert('Validation Error: Exception comments / operational remarks are mandatory.');
      return;
    }
    const selectedCol = collaterals.find((c) => c.id === wizardColId || c.code === wizardColId);
    if (!selectedCol) {
      alert('Validation Error: A valid collateral must be selected.');
      return;
    }

    setExceptionSubmitting(true);
    try {
      const coverage = wizardPolicy.coverageType || getStandardCoverageForCategory(selectedCol.category) || 'Fire & Allied Perils';
      const draftPol: Partial<InsurancePolicy> = {
        ...wizardPolicy,
        coverageType: coverage,
        collateralId: selectedCol.id,
        customerId: selectedCol.customerId || wizardCustomerId,
        status: 'Pending Exception Approval',
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

      if (exceptionForm.evidenceDocument && exceptionForm.evidenceFileContent) {
        docsToSave.push({
          name: exceptionForm.evidenceDocument,
          type: 'Exception Supporting Evidence',
          expiryDate: wizardPolicy.expiryDate || defaultExpiryDate,
          remarks: 'Attached to Exception Request for ' + exceptionForm.failedRequirement,
          fileName: exceptionForm.evidenceDocument,
          fileSize: 102400,
          contentType: 'application/pdf',
          fileContent: exceptionForm.evidenceFileContent,
          isMandatory: true,
        });
      }

      const reqPayload: EntryTimeExceptionRequest = {
        policy: draftPol,
        exceptionType: exceptionForm.exceptionType,
        failedRequirement: exceptionForm.failedRequirement,
        reason: exceptionForm.reason.trim(),
        comments: exceptionForm.comments.trim(),
        evidenceDocument: exceptionForm.evidenceDocument,
        documents: docsToSave,
      };

      const res = await cimsApi.submitPolicyExceptionRequest(reqPayload, currentUser?.username || 'CRO_USER');
      alert(`✓ Exception Created Successfully!\n\nException ID: ${res.exceptionId}\nStatus: Pending Exception Approval\n\nPolicy ${draftPol.policyNumber} has been saved and routed to the configured approver. Upon exception approval, the transaction will automatically resume into the standard workflow without re-keying.`);

      setShowExceptionModal(false);
      setShowWizardModal(false);
      if (onReload) {
        await onReload();
      }
    } catch (err: any) {
      alert(`Exception submission failed: ${err.message || err}`);
    } finally {
      setExceptionSubmitting(false);
    }
  };

  const handleStartWizard = () => {
    setWizardStep(1);
    setWizardCustomerId('');
    setCustomerSearchQuery('');
    setCollateralSearchQuery('');
    setWizardColId('');
    setWizardExposure(null);
    setWizardCompliance(null);
    setUninsuredFilterOnly(false);
    setPreValidationResult(null);
    setShowExceptionModal(false);

    const initialPolicyNo = `POL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    setWizardPolicy({
      policyNumber: initialPolicyNo,
      insurerId: activeApprovedInsurers[0]?.id || '',
      insurerName: activeApprovedInsurers[0]?.name || '',
      coverageType: 'Fire & Allied Perils',
      insuredAmount: 0,
      premium: 0,
      effectiveDate: defaultEffectiveDate,
      expiryDate: defaultExpiryDate,
      status: 'Pending Approval',
      loanAccountId: '',
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

  const handleFileForSlot = (file: File, slotIndex: number) => {
    const reader = new FileReader();
    reader.onload = () => {
      setWizardDocuments((prev) => {
        const updated = [...prev];
        if (!updated[slotIndex]) return prev;
        updated[slotIndex] = {
          ...updated[slotIndex],
          fileName: file.name,
          fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          fileSizeNum: file.size,
          contentType: file.type || 'application/pdf',
          fileContent: reader.result as string,
          name: updated[slotIndex].name || file.name.replace(/\.[^/.]+$/, ''),
        };
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleBatchDropFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        setWizardDocuments((prev) => {
          const updated = [...prev];
          if (index < updated.length) {
            updated[index] = {
              ...updated[index],
              fileName: file.name,
              fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
              fileSizeNum: file.size,
              contentType: file.type || 'application/pdf',
              fileContent: reader.result as string,
              name: updated[index].name || file.name.replace(/\.[^/.]+$/, ''),
            };
            return updated;
          } else {
            return [
              ...updated,
              {
                id: `doc-pol-extra-${Date.now()}-${index}`,
                name: file.name.replace(/\.[^/.]+$/, ''),
                type: 'Endorsement Certificate',
                expiryDate: wizardPolicy.expiryDate || defaultExpiryDate,
                remarks: 'Additional policy document',
                fileName: file.name,
                fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                fileSizeNum: file.size,
                contentType: file.type || 'application/pdf',
                fileContent: reader.result as string,
                isMandatory: false,
              },
            ];
          }
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const missingPolicyDocs = wizardDocuments.filter((d) => d.isMandatory && (!d.fileContent || !d.fileName));

  const getStep1Errors = (): string[] => {
    const errors: string[] = [];
    if (!wizardColId) errors.push('Please select a pledged collateral asset.');
    return errors;
  };

  const getStep2Errors = (): string[] => {
    const errors: string[] = [];
    if (!wizardCol) errors.push('Pledged collateral details could not be resolved.');
    return errors;
  };

  const getStep3Errors = (): string[] => {
    const errors: string[] = [];
    if (loadingWizardExposure) errors.push('Please wait while collateral exposure calculations are retrieved.');
    return errors;
  };

  const getStep4Errors = (): string[] => {
    const errors: string[] = [];
    if (!wizardPolicy.policyNumber || wizardPolicy.policyNumber.trim() === '') {
      errors.push('Policy Number is mandatory.');
    } else if (isDuplicatePolicy(wizardPolicy.policyNumber)) {
      errors.push(`A policy with number "${wizardPolicy.policyNumber}" already exists.`);
    }

    if (!wizardPolicy.insurerId && !wizardPolicy.insurerName) {
      errors.push('Approved Insurer selection is mandatory.');
    } else {
      const isApproved = activeApprovedInsurers.some(
        (i) => (wizardPolicy.insurerId && i.id === wizardPolicy.insurerId) ||
               i.name.trim().toLowerCase() === (wizardPolicy.insurerName || '').trim().toLowerCase()
      );
      if (!isApproved) errors.push('Selected insurer is not an active approved insurance company.');
    }

    if (!wizardPolicy.coverageType || wizardPolicy.coverageType.trim() === '') {
      errors.push('Coverage Type is mandatory.');
    }

    if (!wizardPolicy.insuredAmount || Number(wizardPolicy.insuredAmount) <= 0) {
      errors.push('Insured Amount must be greater than zero.');
    }
    if (wizardPolicy.premium === undefined || wizardPolicy.premium === null || Number(wizardPolicy.premium) <= 0) {
      errors.push('Annual Premium must be specified and greater than zero.');
    }
    if (!wizardPolicy.effectiveDate) errors.push('Effective Date is mandatory.');
    if (!wizardPolicy.expiryDate) errors.push('Expiry Date is mandatory.');

    if (wizardPolicy.effectiveDate && wizardPolicy.expiryDate) {
      const eff = new Date(wizardPolicy.effectiveDate);
      const exp = new Date(wizardPolicy.expiryDate);
      if (exp <= eff) {
        errors.push('Expiry Date must be strictly after Effective Date.');
      }
      const days = Math.ceil((exp.getTime() - eff.getTime()) / (1000 * 3600 * 24));
      if (days < 360) {
        errors.push('Standard policy validity must be at least 1 year (365 days).');
      }
    }
    return errors;
  };

  const getStep5Errors = (): string[] => {
    const errors: string[] = [];
    if (requiredInsuranceAmount > 0 && wizardInsAmount < requiredInsuranceAmount) {
      errors.push(
        `Under-insurance is strictly prohibited. Insured amount (${defaultCurrency} ${wizardInsAmount.toLocaleString()}) must be at least ${defaultCurrency} ${requiredInsuranceAmount.toLocaleString()} (deficit: ${defaultCurrency} ${(requiredInsuranceAmount - wizardInsAmount).toLocaleString()}).`
      );
    }
    if (missingPolicyDocs.length > 0) {
      errors.push(
        `Missing digital file attachments for mandatory document(s): ` +
        missingPolicyDocs.map((m) => m.type).join(', ')
      );
    }
    return errors;
  };

  const handleFinishWizard = async () => {
    if (!wizardColId) {
      alert('Please select a pledged collateral asset in Step 1.');
      setWizardStep(1);
      return;
    }
    const insAmt = Number(wizardPolicy.insuredAmount || 0);
    if (insAmt <= 0) {
      alert('Insured amount must be greater than zero.');
      setWizardStep(4);
      return;
    }
    if (requiredInsuranceAmount > 0 && insAmt < requiredInsuranceAmount) {
      alert(
        `Cannot submit: Under-insurance is strictly prohibited by Credit Policy.\n\n` +
        `• Required Sum Insured: ${defaultCurrency} ${requiredInsuranceAmount.toLocaleString()}\n` +
        `• Current Insured Amount: ${defaultCurrency} ${insAmt.toLocaleString()}\n` +
        `• Shortfall Deficit: ${defaultCurrency} ${(requiredInsuranceAmount - insAmt).toLocaleString()}\n\n` +
        `Please increase the insured amount to at least ${defaultCurrency} ${requiredInsuranceAmount.toLocaleString()} before submitting.`
      );
      setWizardStep(4);
      return;
    }
    if (missingPolicyDocs.length > 0) {
      alert(
        `Cannot submit: Missing uploaded files for mandatory policy document(s):\n\n• ` +
          missingPolicyDocs.map((m) => m.type).join('\n• ') +
          `\n\nPlease attach valid digital files before submitting.`
      );
      setWizardStep(5);
      return;
    }

    setWizardSubmitting(true);
    try {
      const selectedCol = collaterals.find((c) => c.id === wizardColId || c.code === wizardColId);
      if (!selectedCol) {
        alert('Selected collateral asset was not found.');
        return;
      }
      const coverage = wizardPolicy.coverageType || getStandardCoverageForCategory(selectedCol.category) || 'Fire & Allied Perils';
      const policyData: Partial<InsurancePolicy> = {
        ...wizardPolicy,
        coverageType: coverage,
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
        const colTarget = col ? col.id : p.collateralId;
        return (
          <div>
            {colTarget ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onNavigate) {
                    onNavigate('collateral', { collateralId: colTarget, id: colTarget });
                  }
                }}
                className="font-semibold text-blue-700 hover:text-blue-900 underline text-left flex items-center gap-1 cursor-pointer"
                title="Click to view collateral asset"
              >
                <span>{col?.code || p.collateralId}</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </button>
            ) : (
              <div className="font-semibold text-[#102E4A]">—</div>
            )}
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
            loadDetailCompliance(p);
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
          loadDetailCompliance(p);
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
                  {selectedPolicy.collateralId && (
                    <span className="flex items-center gap-1">
                      Collateral:{' '}
                      <button
                        onClick={() => {
                          if (onNavigate) {
                            setShowDetailModal(false);
                            onNavigate('collateral', { collateralId: selectedPolicy.collateralId, id: selectedPolicy.collateralId });
                          }
                        }}
                        className="underline hover:text-white font-mono font-bold bg-blue-900/60 px-1.5 py-0.5 rounded cursor-pointer inline-flex items-center gap-0.5"
                        title="Click to view collateral"
                      >
                        {selectedPolicy.collateralId}
                        <ArrowUpRight className="w-3 h-3 opacity-70" />
                      </button>
                    </span>
                  )}
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
                            setAmendDocuments([]);
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
                            setRenewDocuments([]);
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
                            setEndorseDocuments([]);
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
                            setReplaceDocuments([]);
                            setShowReplaceModal(true);
                          }}
                          className="btn-ghost py-1 px-2 text-xs text-blue-300 border border-blue-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Replace
                        </button>
                        <button
                          onClick={() => {
                            setCancelDocuments([]);
                            setShowCancelModal(true);
                          }}
                          className="btn-ghost py-1 px-2 text-xs text-red-300 border border-red-300/40 rounded flex items-center gap-1 hover:bg-white/10"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            setCloseDocuments([]);
                            setShowCloseModal(true);
                          }}
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
                          setReopenDocuments([]);
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
                <div className="space-y-4">
                  {/* Live Compliance & Exposure Adequacy Evaluation Card */}
                  <div className="cims-card p-4 space-y-3 bg-[#EFF5FB]/70 border border-[#B9D3EB]">
                    <div className="flex justify-between items-center border-b border-[#B9D3EB]/60 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-[#1F4E7A]" />
                        <h4 className="font-bold text-[#102E4A] text-xs uppercase tracking-wide">
                          Authoritative Insurance Compliance & Exposure Adequacy
                        </h4>
                      </div>
                      <StatusChip
                        label={
                          detailCompliance?.coverageStatus === 'ADEQUATELY_INSURED'
                            ? 'Adequately Insured'
                            : detailCompliance?.coverageStatus === 'UNDERINSURED'
                            ? 'Underinsured'
                            : detailCompliance?.coverageStatus === 'EXCESS_INSURANCE'
                            ? 'Excess Insurance'
                            : detailCompliance?.coverageStatus === 'NOT_REQUIRED'
                            ? 'Insurance Not Required'
                            : detailCompliance?.coverageStatus || 'Evaluating…'
                        }
                        variant={
                          detailCompliance?.coverageStatus === 'ADEQUATELY_INSURED' || detailCompliance?.coverageStatus === 'EXCESS_INSURANCE'
                            ? 'success'
                            : detailCompliance?.coverageStatus === 'UNDERINSURED'
                            ? 'danger'
                            : 'neutral'
                        }
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[#5B6472] block text-[10px] font-semibold">REQUIRED SUM INSURED</span>
                        <strong className="text-[#102E4A] font-mono text-sm">
                          {defaultCurrency} {(detailCompliance?.requiredInsuranceAmount ?? 0).toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px] font-semibold">POLICY COVERAGE</span>
                        <strong className="text-emerald-700 font-mono text-sm">
                          {defaultCurrency} {(detailCompliance?.insuredAmount ?? selectedPolicy.insuredAmount ?? 0).toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px] font-semibold">COVERAGE ADEQUACY</span>
                        <strong
                          className={`text-sm ${
                            (detailCompliance?.coveragePercentage ?? 0) < 100
                              ? 'text-red-700 font-bold'
                              : 'text-emerald-700 font-bold'
                          }`}
                        >
                          {(detailCompliance?.coveragePercentage ?? 0).toFixed(1)}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px] font-semibold">COVERAGE GAP / SHORTFALL</span>
                        <strong
                          className={`text-sm ${
                            (detailCompliance?.coverageGap ?? 0) > 0 ? 'text-red-700 font-mono' : 'text-emerald-700'
                          }`}
                        >
                          {(detailCompliance?.coverageGap ?? 0) > 0
                            ? `ETB ${detailCompliance?.coverageGap.toLocaleString()}`
                            : 'None (Adequate)'}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#B9D3EB]/50 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle
                          className={`w-3.5 h-3.5 ${
                            detailCompliance?.approvedInsurerStatus === 'APPROVED' ? 'text-emerald-600' : 'text-amber-500'
                          }`}
                        />
                        <span>
                          Approved Insurer: <strong>{detailCompliance?.approvedInsurerStatus || 'Verified'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle
                          className={`w-3.5 h-3.5 ${
                            detailCompliance?.policyValidityStatus === 'VALID' ? 'text-emerald-600' : 'text-amber-500'
                          }`}
                        />
                        <span>
                          Term Validity: <strong>{detailCompliance?.policyValidityStatus || 'Valid (365+ Days)'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle
                          className={`w-3.5 h-3.5 ${
                            detailCompliance?.mandatoryDocumentStatus === 'SATISFIED' ? 'text-emerald-600' : 'text-amber-500'
                          }`}
                        />
                        <span>
                          Mandatory Documents: <strong>{detailCompliance?.mandatoryDocumentStatus || 'Verified'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

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
                        <span className="text-[#5B6472]">Pledged Collateral Asset:</span>{' '}
                        {selectedPolicy.collateralId ? (
                          <button
                            onClick={() => {
                              if (onNavigate) {
                                setShowDetailModal(false);
                                onNavigate('collateral', { collateralId: selectedPolicy.collateralId, id: selectedPolicy.collateralId });
                              }
                            }}
                            className="font-bold text-blue-700 hover:text-blue-900 underline ml-1 inline-flex items-center gap-1 cursor-pointer"
                            title="Click to view collateral asset"
                          >
                            {selectedPolicy.collateralId}
                            <ArrowUpRight className="w-3 h-3 opacity-70" />
                          </button>
                        ) : (
                          <strong>—</strong>
                        )}
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Customer CIF:</span>{' '}
                        {selectedPolicy.customerId ? (
                          <button
                            onClick={() => {
                              if (onNavigate) {
                                setShowDetailModal(false);
                                onNavigate('customers', { customerId: selectedPolicy.customerId, cif: selectedPolicy.customerId, id: selectedPolicy.customerId });
                              }
                            }}
                            className="font-bold text-blue-700 hover:text-blue-900 underline ml-1 inline-flex items-center gap-1 cursor-pointer"
                            title="Click to view Customer 360"
                          >
                            {selectedPolicy.customerId}
                            <ArrowUpRight className="w-3 h-3 opacity-70" />
                          </button>
                        ) : (
                          <strong>—</strong>
                        )}
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
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {policyDocs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-[#5B6472]">
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
                              <td className="p-2.5 text-right">
                                <button
                                  onClick={() => {
                                    setDocPreviewTarget(d);
                                    setShowDocPreviewModal(true);
                                  }}
                                  className="btn-ghost py-0.5 px-2 text-[11px] text-[#1F4E7A] hover:text-[#102E4A] border border-[#B9D3EB] hover:bg-[#EFF5FB] rounded inline-flex items-center gap-1 font-semibold"
                                  title="Preview Document File"
                                >
                                  <Eye className="w-3 h-3" /> Preview
                                </button>
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
                                  {item.previousStatus && item.newStatus && (
                                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                                      <span className="text-[#5B6472]">Status:</span>
                                      <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                        {item.previousStatus}
                                      </span>
                                      <span className="text-[#5B6472]">→</span>
                                      <span className="font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px]">
                                        {item.newStatus}
                                      </span>
                                    </div>
                                  )}
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
                  Step {wizardStep} of 6: Collateral-Centric Insurance &amp; Four-Eyes Governance
                </p>
              </div>
              <button onClick={() => setShowWizardModal(false)} className="text-white hover:text-gray-300 text-lg">
                ✕
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="grid grid-cols-6 bg-[#EFF5FB] border-b border-[#E2E8F0] text-center py-2 text-[10px] font-semibold divide-x divide-[#E2E8F0]/60">
              <div className={wizardStep === 1 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                1. Asset &amp; Borrower
              </div>
              <div className={wizardStep === 2 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                2. Collateral Details
              </div>
              <div className={wizardStep === 3 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                3. Facility Exposure
              </div>
              <div className={wizardStep === 4 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                4. Insurance Terms
              </div>
              <div className={wizardStep === 5 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                5. Upload Documents
              </div>
              <div className={wizardStep === 6 ? 'text-[#102E4A] font-bold bg-white shadow-xs' : 'text-[#5B6472]'}>
                6. Review &amp; Submit
              </div>
            </div>

            {/* Step Body */}
            <div className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
              {/* STEP 1: CUSTOMER FROM COLLATERAL */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#1F4E7A]" />
                      Step 1: Select Pledged Collateral Asset &amp; Derived Borrower
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Select an authorized pledged collateral asset. Borrower identity is authoritatively derived from the asset record to prevent cross-borrower collateral assignment.
                    </p>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#5B6472] absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search by Collateral Code, Category, Type, Location, or Borrower..."
                          value={collateralSearchQuery}
                          onChange={(e) => setCollateralSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 border border-[#E2E8F0] rounded text-xs bg-slate-50 focus:bg-white focus:border-[#1F4E7A] outline-none"
                        />
                        {collateralSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCollateralSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                            title="Clear search"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div>
                        <select
                          value={wizardCustomerId}
                          onChange={(e) => {
                            setWizardCustomerId(e.target.value);
                            setWizardColId('');
                            setWizardExposure(null);
                          }}
                          className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-slate-50 focus:bg-white focus:border-[#1F4E7A] outline-none"
                        >
                          <option value="">-- All Active Borrowers / Customers --</option>
                          {customers.map((cu) => (
                            <option key={cu.id} value={cu.id}>
                              {cu.cif} — {cu.name} ({cu.segment})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick filter chips & count */}
                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUninsuredFilterOnly(false)}
                          className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                            !uninsuredFilterOnly ? 'bg-[#102E4A] text-white font-bold shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          All Eligible ({collaterals.filter(c => c.status !== 'Released' && c.status !== 'Draft').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setUninsuredFilterOnly(true)}
                          className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                            uninsuredFilterOnly ? 'bg-amber-700 text-white font-bold shadow-2xs' : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          Needs Insurance ({collaterals.filter(c => c.status !== 'Released' && c.status !== 'Draft' && (!c.insuranceStatus || c.insuranceStatus === 'Uninsured' || c.insuranceStatus === 'Expired')).length})
                        </button>
                      </div>
                      <span className="text-[#5B6472]">
                        Showing <strong>{availableCollaterals.length}</strong> matching asset{availableCollaterals.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {/* Collateral Selection List */}
                  <div className="space-y-2">
                    <label className="block font-semibold text-[#101828]">
                      Select Pledged Collateral Asset <span className="text-red-500">*</span>
                    </label>

                    {availableCollaterals.length > 0 ? (
                      <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
                        {availableCollaterals.map((c) => {
                          const isSelected = wizardColId === c.id || wizardColId === c.code;
                          const cust = customers.find(
                            (cu) => (cu.id && cu.id === c.customerId) || (cu.cif && cu.cif === c.customerId)
                          );
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setWizardColId(c.id);
                                setWizardCustomerId(c.customerId || '');
                                loadWizardExposure(c.id);
                              }}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#EFF5FB] border-[#1F4E7A] border-l-4 border-l-[#1F4E7A] shadow-md ring-2 ring-[#1F4E7A]/20'
                                  : 'bg-white border-[#E2E8F0] hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2.5">
                                  <Building2 className={`w-4 h-4 ${isSelected ? 'text-[#1F4E7A]' : 'text-slate-400'}`} />
                                  <div>
                                    <div className="font-bold text-[#101828] text-xs flex items-center gap-2">
                                      <span>{c.code} — {c.category} ({c.type || c.category})</span>
                                      {isSelected && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Selected Asset
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-[#5B6472] flex gap-3 mt-0.5">
                                      <span>Borrower: <strong className="text-[#102E4A]">{cust?.name || c.customerId} ({cust?.cif || c.customerId})</strong></span>
                                      <span>Branch: <strong>{c.branch}</strong></span>
                                      <span>Status: <strong className={c.insuranceStatus === 'Insured' ? 'text-emerald-700' : 'text-amber-700'}>{c.insuranceStatus || 'Uninsured'}</strong></span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[10px] text-[#5B6472]">Market Valuation</div>
                                  <div className="text-xs font-bold text-[#102E4A]">
                                    ETB {c.valuationAmount?.toLocaleString()}
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
                        <span>No eligible pledged collateral assets found. Please adjust search filters or ensure collateral assets are authorized.</span>
                      </div>
                    )}
                  </div>

                  {/* Derived Customer Card */}
                  {wizardCol && derivedCustomer && (
                    <div className="p-3.5 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg space-y-2">
                      <div className="flex justify-between items-center border-b border-[#B9D3EB]/60 pb-1.5">
                        <div className="font-bold text-[#102E4A] text-xs flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-[#1F4E7A]" />
                          Authoritatively Derived Customer Profile (Strict Non-Mismatch Guarantee)
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          1:1 Legal Linkage Verified
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                        <div>
                          <span className="text-[#5B6472] block text-[10px]">BORROWER NAME</span>
                          <strong className="text-[#101828]">{derivedCustomer.name}</strong>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[10px]">CIF NUMBER</span>
                          <strong className="text-[#102E4A] font-mono">{derivedCustomer.cif || derivedCustomer.id}</strong>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[10px]">BUSINESS SEGMENT &amp; BRANCH</span>
                          <strong className="text-[#101828]">{derivedCustomer.segment} | {derivedCustomer.branch}</strong>
                        </div>
                      </div>
                      <div className="text-[10px] text-blue-900 bg-white/70 p-2 rounded border border-[#DCE9F5]">
                        🔒 <strong>Regulatory Assurance:</strong> The insurance policy will be registered strictly under CIF <strong>{derivedCustomer.cif || derivedCustomer.id}</strong> tied to Collateral Asset <strong>{wizardCol.code}</strong>.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: COLLATERAL DETAILS */}
              {wizardStep === 2 && wizardCol && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#1F4E7A]" />
                      Step 2: Pledged Collateral Details &amp; Valuation
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Authoritative valuation, haircut, net security value (NSV), and taxonomy-based insurance requirements.
                    </p>
                  </div>

                  {/* Collateral Metrics Card */}
                  <div className="cims-card p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                      <div>
                        <span className="text-xs font-bold text-[#102E4A]">{wizardCol.code}</span>
                        <span className="text-xs text-[#5B6472] ml-2">({wizardCol.category} — {wizardCol.type || wizardCol.category})</span>
                      </div>
                      <StatusChip label={wizardCol.insuranceStatus || 'Uninsured'} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">MARKET VALUATION</span>
                        <strong className="text-base font-bold text-[#102E4A] font-mono">
                          ETB {wizardCol.valuationAmount?.toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">REGULATORY HAIRCUT</span>
                        <strong className="text-base font-bold text-amber-700">
                          {wizardCol.haircut || 0}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">NET SECURITY VALUE (NSV)</span>
                        <strong className="text-base font-bold text-emerald-700 font-mono">
                          ETB {((wizardCol.valuationAmount || 0) * (1 - (wizardCol.haircut || 0) / 100)).toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#E2E8F0]">
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">OWNERSHIP &amp; VERIFICATION</span>
                        <span className="font-semibold text-[#101828]">{wizardCol.ownerType || 'Direct Customer'} ({wizardCol.verificationStatus || 'Verified'})</span>
                      </div>
                      <div>
                        <span className="text-[#5B6472] block text-[10px]">ASSET LOCATION / BRANCH</span>
                        <span className="font-semibold text-[#101828]">{wizardCol.location || 'Addis Ababa'} ({wizardCol.branch})</span>
                      </div>
                    </div>
                  </div>

                  {/* Taxonomy Mandatory Rule Card */}
                  <div className="p-4 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#102E4A] text-xs uppercase tracking-wide">
                        Collateral Taxonomy Insurance Mandate
                      </span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        isInsuranceMandatoryForCategory(wizardCol.category)
                          ? 'bg-blue-200 text-blue-900'
                          : 'bg-slate-200 text-slate-800'
                      }`}>
                        {isInsuranceMandatoryForCategory(wizardCol.category) ? 'Mandatory Insurance Required' : 'Insurance Exempt'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-[#DCE9F5] rounded text-xs space-y-1">
                      <div>
                        <span className="text-[#5B6472]">Mandatory Coverage Type:</span>{' '}
                        <strong className="text-[#102E4A]">{getStandardCoverageForCategory(wizardCol.category)}</strong>
                      </div>
                      <div className="text-[11px] text-[#5B6472]">
                        {isInsuranceMandatoryForCategory(wizardCol.category)
                          ? `Asset category "${wizardCol.category}" mandates continuous, approved insurance coverage covering 100% of required credit risk exposure.`
                          : `Financial, cash, and deposit collaterals do not require commercial casualty insurance.`}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: LINKED FACILITY EXPOSURE */}
              {wizardStep === 3 && wizardCol && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-[#1F4E7A]" />
                      Step 3: Secured Credit Facilities &amp; Exposure Allocation
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Required Insurance Rule: <strong>MAX(Total Outstanding Loan Balance, Collateral Market Valuation)</strong>
                    </p>
                  </div>

                  {loadingWizardExposure ? (
                    <div className="p-6 text-center text-[#5B6472]">Computing credit facility exposure...</div>
                  ) : (
                    <div className="space-y-3">
                      {/* Linked Facilities Table */}
                      <div className="cims-card overflow-hidden">
                        <div className="p-3 bg-slate-50 border-b border-[#E2E8F0] font-bold text-xs flex justify-between items-center">
                          <span>Secured Core Banking Credit Facilities</span>
                          <span className="font-mono text-red-700">
                            Total Secured Exposure: ETB {outstandingExposure.toLocaleString()}
                          </span>
                        </div>

                        {wizardExposure?.facilityBreakdowns && wizardExposure.facilityBreakdowns.length > 0 ? (
                          <div className="divide-y divide-[#E2E8F0] text-xs">
                            {wizardExposure.facilityBreakdowns.map((fac: any, idx: number) => (
                              <div key={idx} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                                <div>
                                  <strong className="text-[#102E4A]">{fac.loanReference || fac.facilityId}</strong>
                                  <span className="text-[#5B6472] ml-2">({fac.facilityType || 'Term Loan'})</span>
                                </div>
                                <div className="flex gap-4">
                                  <span className="text-[#5B6472]">Limit: ETB {(fac.approvedLimit || 0).toLocaleString()}</span>
                                  <span>Outstanding: <strong className="text-red-700 font-mono">ETB {(fac.outstandingBalance || 0).toLocaleString()}</strong></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center text-[#5B6472] text-xs">
                            No credit facilities currently linked to this collateral asset. Collateral market valuation governs requirement.
                          </div>
                        )}
                      </div>

                      {/* Required Insurance Formula Box */}
                      <div className="p-4 bg-[#EFF5FB] border border-[#B9D3EB] rounded-lg space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#102E4A] text-xs uppercase tracking-wide">
                            Insurance Requirement Calculation
                          </span>
                          <span className="px-2 py-0.5 rounded bg-blue-200 text-blue-900 font-bold text-[10px]">
                            Category: {wizardCol.category}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                          <div>
                            <span className="text-[#5B6472] block text-[10px]">TOTAL OUTSTANDING EXPOSURE</span>
                            <strong className="font-mono text-red-700 text-sm">ETB {outstandingExposure.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[10px]">COLLATERAL MARKET VALUATION</span>
                            <strong className="font-mono text-[#102E4A] text-sm">ETB {collateralMarketVal.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-[#5B6472] block text-[10px]">REQUIRED SUM INSURED</span>
                            <strong className="font-mono text-emerald-700 text-sm font-bold">
                              ETB {requiredInsuranceAmount.toLocaleString()}
                            </strong>
                          </div>
                        </div>

                        <div className="p-2.5 bg-white border border-[#DCE9F5] rounded text-[11px] text-[#102E4A] space-y-1">
                          <div>
                            Rule: Required Insurance = <code>MAX(Outstanding Loan Balance, Collateral Valuation)</code>
                          </div>
                          <div className="text-[#5B6472]">
                            = MAX(ETB {outstandingExposure.toLocaleString()}, ETB {collateralMarketVal.toLocaleString()}) = <strong>ETB {requiredInsuranceAmount.toLocaleString()}</strong>
                          </div>
                          <div className="text-blue-900 text-[10px] font-semibold pt-1">
                            ℹ Standard credit risk policy requires 100% coverage. Under-insurance is strictly prohibited.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: INSURANCE INFORMATION */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-[#1F4E7A]" />
                      Step 4: Insurance Policy Terms &amp; Approved Insurer Selection
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Enter authentic policy terms. Insurer must be selected from the active approved insurers registry. No silent fallback defaults.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-[#101828]">
                          Policy Number <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const genNo = `POL-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
                            setWizardPolicy((prev) => ({ ...prev, policyNumber: genNo }));
                          }}
                          className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold underline flex items-center gap-1 cursor-pointer"
                          title="Generate unique policy reference"
                        >
                          <RotateCw className="w-3 h-3" /> Auto-Generate
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. POL-2026-9901"
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
                        value={wizardPolicy.insurerId || ''}
                        onChange={(e) => {
                          const insId = e.target.value;
                          const found = activeApprovedInsurers.find((i) => i.id === insId);
                          setWizardPolicy({
                            ...wizardPolicy,
                            insurerId: insId,
                            insurerName: found?.name || '',
                          });
                        }}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-semibold bg-white"
                      >
                        <option value="">-- Choose Approved Insurer --</option>
                        {activeApprovedInsurers.map((ins) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.name} ({ins.rating || 'Tier-1 Approved'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#101828] mb-1">
                        Coverage Type (Taxonomy-Driven) <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={wizardPolicy.coverageType || availableCoverageTypes[0] || ''}
                        onChange={(e) => setWizardPolicy({ ...wizardPolicy, coverageType: e.target.value })}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-semibold bg-white"
                      >
                        {availableCoverageTypes.map((cov, idx) => (
                          <option key={idx} value={cov}>
                            {cov}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-[#101828]">
                          Insured Amount ({defaultCurrency}) <span className="text-red-500">*</span>
                        </label>
                        {requiredInsuranceAmount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setWizardPolicy((prev) => ({
                                ...prev,
                                insuredAmount: requiredInsuranceAmount,
                                premium: prev.premium && prev.premium > 0 ? prev.premium : Math.round(requiredInsuranceAmount * 0.0045),
                              }))
                            }
                            className="text-[10px] text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer"
                          >
                            Set to Required: ETB {requiredInsuranceAmount.toLocaleString()}
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 15000000"
                        value={wizardPolicy.insuredAmount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setWizardPolicy((prev) => ({
                            ...prev,
                            insuredAmount: val,
                            premium: (!prev.premium || prev.premium === 0) ? Math.round(val * 0.0045) : prev.premium,
                          }));
                        }}
                        className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums text-emerald-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-[#101828]">
                          Annual Premium ({defaultCurrency}) <span className="text-red-500">*</span>
                        </label>
                        {wizardInsAmount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const est = Math.round(wizardInsAmount * 0.0045);
                              setWizardPolicy((prev) => ({ ...prev, premium: est }));
                            }}
                            className="text-[10px] text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer"
                            title="Recalculate 0.45% market rate"
                          >
                            Est (0.45%)
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 67500"
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
                        onChange={(e) => {
                          const newEff = e.target.value;
                          let newExp = wizardPolicy.expiryDate;
                          if (newEff) {
                            const d = new Date(newEff);
                            if (!isNaN(d.getTime())) {
                              d.setFullYear(d.getFullYear() + 1);
                              newExp = d.toISOString().split('T')[0];
                            }
                          }
                          setWizardPolicy({ ...wizardPolicy, effectiveDate: newEff, expiryDate: newExp });
                        }}
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
                      {isUnderinsured && (
                        <div className="text-[11px] text-red-600 font-semibold mt-0.5">
                          ⚠️ Shortfall: Deficit of ETB {(requiredInsuranceAmount - wizardInsAmount).toLocaleString()}. Under-insurance is strictly prohibited.
                        </div>
                      )}
                    </div>
                    <CircularProgress value={Math.min(100, wizardCoveragePct)} size={44} strokeWidth={5} />
                  </div>
                </div>
              )}

              {/* STEP 5: DOCUMENT INGESTION */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <FileBadge className="w-4 h-4 text-[#1F4E7A]" />
                      Step 5: Mandatory &amp; Supporting Policy Documents Ingestion
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Attach authentic digital policy documents (Insurance Policy Schedule, Premium Payment Settlement Receipt, Endorsements) before pre-flight compliance verification.
                    </p>
                  </div>

                  {/* Exception Guidance Banner */}
                  <div className="p-3 bg-amber-50/80 border border-amber-300 rounded-lg flex items-center justify-between text-xs text-amber-950">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <div>
                        <strong>Don't have a mandatory document right now?</strong>
                        <div className="text-[11px] text-amber-800">
                          You do not need to attach it now. You can click <strong>"Continue to Pre-Flight Review &amp; Exception →"</strong> to submit the transaction as an <strong>Authorized Exception</strong>, or request the exception directly.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenExceptionModal()}
                      className="px-3 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer shrink-0 ml-3"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Request Exception Now
                    </button>
                  </div>

                  {/* Mandatory Documents Checklist & Uploads */}
                  <div id="wizard-documents-section" className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <h5 className="font-bold text-[#101828] text-xs flex items-center gap-1.5">
                          <FileBadge className="w-4 h-4 text-[#1F4E7A]" />
                          Mandatory &amp; Supporting Policy Documents ({wizardDocuments.length})
                        </h5>
                        <p className="text-[#5B6472] text-[11px]">
                          Mandatory: Insurance Policy Schedule &amp; Premium Payment Settlement Receipt.
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
                        className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1 font-bold shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Add Document
                      </button>
                    </div>

                    {/* Batch Drag-and-Drop Ingestion Zone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setBatchDragOver(true);
                      }}
                      onDragLeave={() => setBatchDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setBatchDragOver(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleBatchDropFiles(e.dataTransfer.files);
                        }
                      }}
                      className={`p-4 border-2 border-dashed rounded-xl text-center transition-all ${
                        batchDragOver
                          ? 'border-[#1F4E7A] bg-blue-50/80 scale-[1.01]'
                          : 'border-slate-300 bg-slate-50/70 hover:bg-slate-50 hover:border-[#1F4E7A]/50'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <UploadCloud className={`w-7 h-7 ${batchDragOver ? 'text-[#1F4E7A] animate-bounce' : 'text-slate-400'}`} />
                        <div className="text-xs font-bold text-[#102E4A]">
                          Drag &amp; drop policy documents here, or{' '}
                          <label htmlFor="batch-policy-file-input" className="text-blue-700 underline cursor-pointer hover:text-blue-900">
                            browse files
                          </label>
                        </div>
                        <div className="text-[11px] text-[#5B6472]">
                          Supports PDF, DOC, DOCX, JPG, PNG (automatically populates Policy Schedule &amp; Premium Receipt)
                        </div>
                        <input
                          id="batch-policy-file-input"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleBatchDropFiles(e.target.files);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {wizardDocuments.map((doc, idx) => {
                        const hasFile = Boolean(doc.fileContent && doc.fileName);
                        const isSlotDragging = draggingSlotId === doc.id;
                        const isPdf = doc.fileName?.toLowerCase().endsWith('.pdf');
                        const isImg = doc.fileName?.match(/\.(jpg|jpeg|png)$/i);

                        return (
                          <div
                            key={doc.id}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDraggingSlotId(doc.id);
                            }}
                            onDragLeave={() => {
                              if (draggingSlotId === doc.id) setDraggingSlotId(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDraggingSlotId(null);
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                handleFileForSlot(e.dataTransfer.files[0], idx);
                              }
                            }}
                            className={`p-3 rounded-lg border space-y-2 transition-all ${
                              isSlotDragging
                                ? 'bg-blue-50/80 border-[#1F4E7A] ring-2 ring-[#1F4E7A]/40'
                                : hasFile
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

                            {/* Digital File Attachment Trigger & Drag Feedback */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] bg-slate-50 p-2 rounded">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="file"
                                  id={`file-pol-wizard-${doc.id}`}
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleFileForSlot(e.target.files[0], idx);
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
                                  {hasFile ? 'Replace File' : 'Attach Digital File (or Drag & Drop)'}
                                </label>

                                {hasFile ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 uppercase">
                                      {isPdf ? 'PDF' : isImg ? 'IMG' : 'DOC'}
                                    </span>
                                    <span className="font-mono text-emerald-700 font-bold flex items-center gap-1">
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                      {doc.fileName} ({doc.fileSize})
                                    </span>
                                    <span className="text-[10px] text-[#5B6472] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                                      Pending DMS Verification
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...wizardDocuments];
                                        updated[idx].fileName = '';
                                        updated[idx].fileContent = '';
                                        updated[idx].fileSize = '';
                                        updated[idx].fileSizeNum = 0;
                                        setWizardDocuments(updated);
                                      }}
                                      className="text-gray-400 hover:text-red-600 text-xs ml-1"
                                      title="Remove uploaded file"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-amber-800 font-semibold text-[11px] flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    <span>File not uploaded yet — <span className="text-slate-600 font-normal">Attach file or proceed to submit as Exception</span></span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 6: PRE-FLIGHT VALIDATION & SUBMISSION */}
              {wizardStep === 6 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-[#101828] text-sm flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-700" />
                      Step 6: Pre-Flight Compliance Validation &amp; Final Review
                    </h4>
                    <p className="text-[#5B6472] text-[11px]">
                      Under the Four-Eyes Principle, the policy will be submitted in <strong>Pending Approval</strong> state for Branch Manager checker sign-off.
                    </p>
                  </div>

                  {/* Real-time Enterprise Pre-Validation Card */}
                  <div className="space-y-3">
                    {isValidating && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-xs text-blue-900">
                        <RefreshCw className="w-5 h-5 animate-spin text-[#1F4E7A] flex-shrink-0" />
                        <div>
                          <strong>Evaluating Enterprise Pre-Validation Rules...</strong>
                          <div className="text-[11px] text-blue-700">
                            Validating customer KYC, collateral asset, approved insurer, coverage adequacy, validity dates, mandatory documents, and duplicate policy registers.
                          </div>
                        </div>
                      </div>
                    )}

                    {!isValidating && preValidationResult && (
                      <>
                        {preValidationResult.valid ? (
                          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <span className="font-bold text-emerald-900 text-sm">Validation Passed</span>
                              </div>
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                All Requirements Satisfied
                              </span>
                            </div>
                            <p className="text-xs text-emerald-800">
                              {preValidationResult.summaryMessage || 'All mandatory requirements satisfied. The transaction can now be submitted into the normal four-eyes approval workflow.'}
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {preValidationResult.checks.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 bg-emerald-100/70 border border-emerald-200 text-emerald-800 rounded text-[10px] font-semibold flex items-center gap-1">
                                  ✓ {c.ruleName}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className={`p-4 rounded-xl border space-y-3 ${preValidationResult.hasHardBlock ? 'bg-red-50/80 border-red-300' : 'bg-amber-50/80 border-amber-300'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={`w-5 h-5 ${preValidationResult.hasHardBlock ? 'text-red-600' : 'text-amber-600'}`} />
                                <span className={`font-bold text-sm ${preValidationResult.hasHardBlock ? 'text-red-900' : 'text-amber-900'}`}>
                                  ⚠ Mandatory requirement(s) not satisfied
                                </span>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${preValidationResult.hasHardBlock ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                                {preValidationResult.hasHardBlock ? 'Hard Policy Block' : 'Overrideable with Exception Approval'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-700">
                              {preValidationResult.summaryMessage}
                            </p>

                            {/* Detailed list of failed checks */}
                            <div className="space-y-1.5 pt-1">
                              {preValidationResult.checks.filter(c => !c.passed).map((c, i) => (
                                <div key={i} className="flex items-start justify-between gap-2 p-2.5 bg-white/90 border border-slate-200 rounded text-xs shadow-2xs">
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-[#102E4A] flex items-center gap-1.5">
                                      <span className="text-red-600">•</span>
                                      <span>{c.ruleName}</span>
                                      <span className="text-[10px] text-slate-500 font-normal">({c.category})</span>
                                    </div>
                                    <div className="text-[#5B6472] pl-2">{c.message}</div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                                    c.overrideable ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-red-100 text-red-800 border border-red-200'
                                  }`}>
                                    {c.overrideable ? 'Overrideable' : 'Hard Block'}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Action Buttons for RO */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setWizardStep(5)}
                                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded font-semibold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                >
                                  <Upload className="w-3.5 h-3.5 text-[#1F4E7A]" />
                                  Upload Missing Document
                                </button>

                                <button
                                  type="button"
                                  onClick={runPreValidation}
                                  className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs flex items-center gap-1 cursor-pointer"
                                  title="Re-run validation checks"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                                  Re-evaluate
                                </button>
                              </div>

                              {preValidationResult.canSubmitAsException && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenExceptionModal()}
                                  className="px-4 py-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                                >
                                  <Shield className="w-4 h-4" />
                                  Submit as Exception
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Pre-Flight Compliance Breakdown Summary */}
                    <div className="cims-card p-3 space-y-2 bg-[#EFF5FB]/60 border border-[#B9D3EB]">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[#5B6472] block text-[10px] font-semibold">REQUIRED SUM INSURED</span>
                          <strong className="text-[#102E4A] font-mono text-sm">
                            ETB {requiredInsuranceAmount.toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[10px] font-semibold">PROPOSED SUM INSURED</span>
                          <strong className="text-emerald-700 font-mono text-sm">
                            ETB {wizardInsAmount.toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#5B6472] block text-[10px] font-semibold">COVERAGE ADEQUACY</span>
                          <strong className={`text-sm ${isUnderinsured ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}`}>
                            {wizardCoveragePct.toFixed(1)}%
                          </strong>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#B9D3EB]/50 text-[11px]">
                        <div>Insurer: <strong>✓ {wizardPolicy.insurerName}</strong></div>
                        <div>Validity: <strong>✓ {wizardPolicy.effectiveDate} to {wizardPolicy.expiryDate}</strong></div>
                        <div>Unique Number: <strong>✓ No Duplicates</strong></div>
                      </div>
                    </div>

                    {/* Summary of attached documents */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#102E4A] flex items-center gap-1.5">
                          <FileBadge className="w-3.5 h-3.5 text-[#1F4E7A]" />
                          Attached Documents ({wizardDocuments.filter(d => Boolean(d.fileContent || d.fileName)).length} / {wizardDocuments.length} files attached)
                        </span>
                        <button
                          type="button"
                          onClick={() => setWizardStep(5)}
                          className="text-blue-700 hover:text-blue-900 underline font-semibold text-[11px] cursor-pointer"
                        >
                          Modify Documents in Step 5 →
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                        {wizardDocuments.map((d, i) => {
                          const has = Boolean(d.fileContent || d.fileName);
                          return (
                            <span key={i} className={`px-2 py-0.5 rounded border text-[10px] font-semibold flex items-center gap-1 ${
                              has ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : d.isMandatory ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                            }`}>
                              {has ? '✓' : '⚠️'} {d.type}: {d.fileName || '(No file attached)'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
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
                {wizardStep < 6 ? (
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
                          alert('Cannot proceed:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                      }
                      if (wizardStep === 3) {
                        const errs = getStep3Errors();
                        if (errs.length > 0) {
                          alert('Notice:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                      }
                      if (wizardStep === 4) {
                        const errs = getStep4Errors();
                        if (errs.length > 0) {
                          alert('Cannot proceed:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                        evaluateWizardCompliance();
                      }
                      // When leaving Step 5, advance smoothly to Step 6 (Pre-Flight Review)
                      setWizardStep((wizardStep + 1) as any);
                    }}
                    className="btn-primary"
                  >
                    {wizardStep === 5 ? 'Continue to Pre-Flight Review & Exception →' : 'Continue'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {preValidationResult && preValidationResult.canSubmitAsException && (
                      <button
                        type="button"
                        disabled={exceptionSubmitting}
                        onClick={() => handleOpenExceptionModal()}
                        className="btn-primary bg-[#F59E0B] hover:bg-[#D97706] text-white flex items-center gap-1.5 shadow-sm font-bold cursor-pointer"
                        title="Submit transaction as an authorized exception for management approval"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        Submit as Exception
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={
                        wizardSubmitting ||
                        (preValidationResult
                          ? !preValidationResult.valid
                          : (isUnderinsured || missingPolicyDocs.length > 0))
                      }
                      onClick={handleFinishWizard}
                      className="btn-primary bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 flex items-center gap-1.5"
                      title={
                        preValidationResult && !preValidationResult.valid
                          ? 'Submission blocked: Mandatory requirements not satisfied. Either upload missing documents or submit as an exception.'
                          : isUnderinsured
                          ? 'Submission blocked: Under-insurance is strictly prohibited.'
                          : missingPolicyDocs.length > 0
                          ? 'Submission blocked: Attach digital files for all mandatory documents.'
                          : 'Submit for Checker Authorization'
                      }
                    >
                      <Send className="w-3.5 h-3.5" />
                      {wizardSubmitting ? 'Submitting to Checker…' : 'Submit for Checker Authorization'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exception Request Submission Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-[#102E4A]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            {/* Header */}
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold">Exception Details</h3>
                  <p className="text-[11px] text-blue-200">
                    Request Authorized Management Override &amp; Approval
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExceptionModal(false)}
                className="text-white hover:text-gray-300 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                <strong>Controlled Validation Override:</strong> Bank policy allows temporary waiver of specific requirements subject to authorized management review and full audit logging.
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Exception Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={exceptionForm.exceptionType}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, exceptionType: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded bg-white text-xs font-semibold"
                >
                  <option value="Missing Mandatory Document">Missing Mandatory Document</option>
                  <option value="Underinsured Collateral">Underinsured Collateral</option>
                  <option value="Unapproved Insurer">Unapproved Insurer</option>
                  <option value="Policy Inconsistency">Policy Inconsistency</option>
                  <option value="Expired Policy Exception">Expired Policy Exception</option>
                  <option value="Other Exception">Other Business Exception</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Failed Requirement
                </label>
                <input
                  type="text"
                  value={exceptionForm.failedRequirement}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, failedRequirement: e.target.value })}
                  placeholder="e.g. Title Deed / Coverage Adequacy Threshold"
                  className="w-full p-2 border border-[#E2E8F0] rounded bg-slate-50 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Reason / Justification <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={exceptionForm.reason}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                  placeholder="Provide detailed business justification, credit memo sanction reference, or temporary waiver rationale..."
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Supporting Document / Evidence (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="exception-evidence-file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = () => {
                          setExceptionForm({
                            ...exceptionForm,
                            evidenceDocument: file.name,
                            evidenceFileContent: reader.result as string,
                          });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="exception-evidence-file"
                    className="cursor-pointer py-1.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#1F4E7A]" />
                    {exceptionForm.evidenceDocument ? 'Replace Evidence File' : 'Attach Supporting Memo'}
                  </label>
                  {exceptionForm.evidenceDocument && (
                    <span className="text-emerald-700 font-mono text-xs flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {exceptionForm.evidenceDocument}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">
                  Exception Comments <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={exceptionForm.comments}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, comments: e.target.value })}
                  placeholder="Additional operational remarks or conditions for the assigned approval authority..."
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                />
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900 space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                  Approval Hierarchy Routing:
                </div>
                <div>
                  This request will be dynamically assigned to the configured approver according to Exception Type + Business Segment + Branch Hierarchy. Once approved, the transaction automatically resumes in the normal workflow without requiring re-entry.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-[#E2E8F0] flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => setShowExceptionModal(false)}
                className="btn-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={exceptionSubmitting || !exceptionForm.reason.trim() || !exceptionForm.comments.trim()}
                onClick={handleSubmitExceptionRequest}
                className="btn-primary bg-[#F59E0B] hover:bg-[#D97706] text-white disabled:opacity-50 flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {exceptionSubmitting ? 'Submitting Exception…' : 'Submit Exception for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Policy Document Modal */}
      {showUploadDocModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload Policy Document (DMS)</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Direct File Attachment</p>
              </div>
              <button onClick={() => setShowUploadDocModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Document Title <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Endorsement Certificate / Policy Schedule"
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
                  className="w-full p-2 border border-[#E2E8F0] rounded bg-white text-xs"
                >
                  <option value="Insurance Policy Schedule">Insurance Policy Schedule (with Loss Payee Clause)</option>
                  <option value="Premium Payment Receipt">Premium Payment Receipt</option>
                  <option value="Endorsement Certificate">Endorsement Certificate</option>
                  <option value="Insurer Coverage Confirmation Letter">Insurer Coverage Confirmation Letter</option>
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

              {/* Digital File Drop Zone */}
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Attach Digital File <span className="text-red-600">*</span></label>
                <div
                  className="border-2 border-dashed border-[#CBD5E1] bg-slate-50 hover:bg-[#EFF5FB]/60 rounded-xl p-3.5 text-center cursor-pointer transition-all"
                  onClick={() => document.getElementById('upload-modal-file-input')?.click()}
                >
                  <input
                    id="upload-modal-file-input"
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const f = e.target.files[0];
                        setUploadFile(f);
                        if (!uploadDocName.trim()) setUploadDocName(f.name.replace(/\.[^/.]+$/, ''));
                        const r = new FileReader();
                        r.onload = () => setUploadFileContent(r.result as string);
                        r.readAsDataURL(f);
                      }
                    }}
                  />
                  {uploadFile ? (
                    <div className="flex items-center justify-between bg-white p-2 border border-emerald-300 rounded-lg">
                      <div className="flex items-center gap-2 text-left">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900 truncate max-w-[220px]">{uploadFile.name}</div>
                          <div className="text-[10px] text-slate-500">{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                          setUploadFileContent('');
                        }}
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <UploadCloud className="w-5 h-5 text-[#1F4E7A]" />
                      <div className="font-bold text-[#102E4A]">Click to select PDF or image file</div>
                      <div className="text-[10px] text-slate-500">PDF, JPG, PNG up to 25MB</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="Optional archival remarks or memo reference..."
                  value={uploadDocRemarks}
                  onChange={(e) => setUploadDocRemarks(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  onClick={() => {
                    setShowUploadDocModal(false);
                    setUploadFile(null);
                    setUploadFileContent('');
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  disabled={uploadingDoc || !uploadDocName.trim()}
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
                        uploadDocExpiry || undefined,
                        currentUser.username || 'COLLDOCOFF_USER',
                        uploadFile ? {
                          fileName: uploadFile.name,
                          fileSize: uploadFile.size,
                          contentType: uploadFile.type || 'application/pdf',
                          fileContent: uploadFileContent,
                          remarks: uploadDocRemarks,
                        } : undefined
                      );
                      alert('Policy document uploaded to DMS successfully (Status: Pending Verification).');
                      setShowUploadDocModal(false);
                      setUploadDocName('');
                      setUploadFile(null);
                      setUploadFileContent('');
                      setUploadDocRemarks('');
                    } catch (e: any) {
                      alert(`Failed to upload document: ${e?.message || e}`);
                    } finally {
                      setUploadingDoc(false);
                    }
                  }}
                  className="btn-primary disabled:opacity-60"
                >
                  {uploadingDoc ? 'Uploading…' : 'Upload File to DMS'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Amend Policy Modal */}
      {showAmendModal && selectedPolicy && (
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Amend Insurance Policy</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Modify Terms &amp; Attach Proof</p>
              </div>
              <button onClick={() => setShowAmendModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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
                      value={amendData.insurerId || activeApprovedInsurers.find(i => i.name === selectedPolicy.insurerName)?.id || ''}
                      onChange={(e) => {
                        const found = activeApprovedInsurers.find(i => i.id === e.target.value);
                        setAmendData({
                          ...amendData,
                          insurerId: e.target.value,
                          insurerName: found?.name || selectedPolicy.insurerName,
                        });
                      }}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                    >
                      {activeApprovedInsurers.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center py-1.5 border-b border-[#E2E8F0]/60">
                  <div>
                    <div className="text-[10px] text-[#5B6472]">Coverage Type</div>
                    <div className="font-semibold text-[#101828]">{selectedPolicy.coverageType}</div>
                  </div>
                  <div>
                    <select
                      value={amendData.coverageType || selectedPolicy.coverageType}
                      onChange={(e) => setAmendData({ ...amendData, coverageType: e.target.value })}
                      className="w-full p-1.5 border border-[#E2E8F0] rounded text-xs bg-white"
                    >
                      {availableCoverageTypes.map((cov, idx) => (
                        <option key={idx} value={cov}>
                          {cov}
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
                  placeholder="e.g. Valuation increase adjustment / updated cover terms"
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              {/* Digital File Attachment Zone */}
              <DocumentAttachmentZone
                title="Supporting Amendment Document(s)"
                description="Upload amended policy schedule, revised endorsement letter, or adjustment memo"
                defaultDocType="Policy Amendment Document"
                documents={amendDocuments}
                onChange={setAmendDocuments}
              />

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
                      await onAmendPolicy(selectedPolicy.id, amendData, amendReason, amendDocuments);
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
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Renew Insurance Policy</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Annual Extension &amp; Lifecycle Record</p>
              </div>
              <button onClick={() => setShowRenewModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Previous Policy Lifecycle Summary */}
              <div className="bg-[#EFF5FB] p-3 rounded-lg border border-[#B9D5F0] space-y-1.5">
                <div className="text-[11px] font-bold text-[#102E4A] uppercase tracking-wider mb-1">
                  Master Policy Being Renewed (Renewed From)
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-[#5B6472]">Policy Number:</span> <span className="font-semibold text-[#101828] font-mono">{selectedPolicy.policyNumber}</span></div>
                  <div><span className="text-[#5B6472]">Insurer:</span> <span className="font-semibold text-[#101828]">{selectedPolicy.insurerName}</span></div>
                  <div><span className="text-[#5B6472]">Coverage Type:</span> <span className="font-semibold text-[#101828]">{selectedPolicy.coverageType}</span></div>
                  <div><span className="text-[#5B6472]">Current Expiry:</span> <span className="font-semibold text-amber-700">{selectedPolicy.expiryDate}</span></div>
                  <div><span className="text-[#5B6472]">Current Insured:</span> <span className="font-semibold text-[#101828]">{defaultCurrency} {selectedPolicy.insuredAmount?.toLocaleString()}</span></div>
                  <div><span className="text-[#5B6472]">Current Premium:</span> <span className="font-semibold text-[#101828]">{defaultCurrency} {selectedPolicy.premium?.toLocaleString()}</span></div>
                </div>
                <div className="text-[10px] text-blue-700 pt-1 border-t border-[#B9D5F0]">
                  🔗 New policy record will be linked with <code className="font-mono bg-blue-100 px-1 rounded">renewedFromPolicyId: {selectedPolicy.id}</code> retaining full renewal history.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Renewed Insured Amount ({defaultCurrency}) <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  min="1"
                  value={renewAmount || selectedPolicy.insuredAmount}
                  onChange={(e) => setRenewAmount(Number(e.target.value))}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Renewed Annual Premium ({defaultCurrency}) <span className="text-red-600">*</span></label>
                <input
                  type="number"
                  min="0"
                  value={renewPremium || selectedPolicy.premium}
                  onChange={(e) => setRenewPremium(Number(e.target.value))}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">New Expiry Date <span className="text-red-600">*</span></label>
                <input
                  type="date"
                  value={renewExpiryDate}
                  onChange={(e) => setRenewExpiryDate(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-semibold"
                />
              </div>

              {/* Digital File Attachment Zone */}
              <DocumentAttachmentZone
                title="Supporting Renewal Document(s)"
                description="Upload renewed policy schedule, certificate of cover, or premium payment receipt"
                defaultDocType="Policy Renewal Schedule"
                documents={renewDocuments}
                onChange={setRenewDocuments}
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowRenewModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={renewSubmitting || !renewExpiryDate || (renewAmount || selectedPolicy.insuredAmount) <= 0}
                  onClick={async () => {
                    const finalAmount = renewAmount || selectedPolicy.insuredAmount;
                    const finalPremium = renewPremium || selectedPolicy.premium;
                    if (finalAmount <= 0) {
                      alert('Renewed insured amount must be greater than 0.');
                      return;
                    }
                    if (!renewExpiryDate) {
                      alert('New expiry date is required.');
                      return;
                    }
                    setRenewSubmitting(true);
                    try {
                      await onRenewPolicy(selectedPolicy.id, finalAmount, finalPremium, renewExpiryDate, renewDocuments);
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
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Issue Policy Endorsement</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Schedule Addition &amp; Document Evidence</p>
              </div>
              <button onClick={() => setShowEndorseModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Endorsement Number <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  value={endorsementNo}
                  onChange={(e) => setEndorsementNo(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Endorsement Description <span className="text-red-600">*</span></label>
                <textarea
                  rows={3}
                  value={endorsementDesc}
                  onChange={(e) => setEndorsementDesc(e.target.value)}
                  placeholder="e.g. Bank sole loss payee clause endorsement"
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
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Link Existing Document from Repository (Optional)</label>
                <select
                  value={endorsementDocId}
                  onChange={(e) => setEndorsementDocId(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded bg-white text-xs"
                >
                  <option value="">-- Associate Document from Repository (Optional) --</option>
                  {(documents || [])
                    .filter(d => d.entityId === selectedPolicy.id || d.entityId === selectedPolicy.collateralId || d.type?.toLowerCase().includes('endorsement'))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name || d.type} ({d.type} — v{d.version || 1})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-[#5B6472] mt-1">Associates endorsement certificate with the document repository record.</p>
              </div>

              {/* Digital File Attachment Zone */}
              <DocumentAttachmentZone
                title="Or Attach New Endorsement Certificate (Digital File)"
                description="Upload the signed endorsement schedule or bank sole loss payee endorsement"
                defaultDocType="Policy Endorsement Certificate"
                documents={endorseDocuments}
                onChange={setEndorseDocuments}
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowEndorseModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={endorseSubmitting || !endorsementNo.trim() || !endorsementDesc.trim()}
                  onClick={async () => {
                    if (onEndorsePolicy) {
                      setEndorseSubmitting(true);
                      try {
                        await onEndorsePolicy(selectedPolicy.id, endorsementNo, endorsementDesc, endorsementEffDate, endorsementDocId || undefined, endorseDocuments);
                        alert('Endorsement registered successfully.');
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
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Replace Insurance Policy (Novation)</h3>
                <p className="text-[11px] text-blue-200">Replaces {selectedPolicy.policyNumber}</p>
              </div>
              <button onClick={() => setShowReplaceModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-[#EFF5FB] p-3 rounded-lg border border-[#B9D5F0] space-y-1">
                <div className="text-[11px] font-bold text-[#102E4A] uppercase tracking-wider">
                  Replaced Policy (Will be linked via replacesPolicyId)
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-[#5B6472]">Old Policy:</span> <span className="font-mono font-semibold">{selectedPolicy.policyNumber}</span></div>
                  <div><span className="text-[#5B6472]">Old Insurer:</span> <span className="font-semibold">{selectedPolicy.insurerName}</span></div>
                  <div><span className="text-[#5B6472]">Old Amount:</span> <span className="font-semibold">{defaultCurrency} {selectedPolicy.insuredAmount?.toLocaleString()}</span></div>
                  <div><span className="text-[#5B6472]">Old Expiry:</span> <span className="font-semibold">{selectedPolicy.expiryDate}</span></div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">New Policy Number (System Generated / Editable)</label>
                <input
                  type="text"
                  value={replacementPolicy.policyNumber || `POL-REP-${Math.floor(100000 + Math.random() * 900000)}`}
                  onChange={(e) => setReplacementPolicy({ ...replacementPolicy, policyNumber: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">New Approved Insurer <span className="text-red-600">*</span></label>
                  <select
                    value={replacementPolicy.insurerId || activeApprovedInsurers.find(i => i.name === (replacementPolicy.insurerName || selectedPolicy.insurerName))?.id || ''}
                    onChange={(e) => {
                      const ins = activeApprovedInsurers.find(i => i.id === e.target.value);
                      setReplacementPolicy({
                        ...replacementPolicy,
                        insurerId: e.target.value,
                        insurerName: ins?.name || replacementPolicy.insurerName,
                      });
                    }}
                    className="w-full p-2 border border-[#E2E8F0] rounded bg-white text-xs"
                  >
                    {activeApprovedInsurers.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">New Coverage Type <span className="text-red-600">*</span></label>
                  <select
                    value={replacementPolicy.coverageType || selectedPolicy.coverageType}
                    onChange={(e) => setReplacementPolicy({ ...replacementPolicy, coverageType: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded bg-white text-xs"
                  >
                    {availableCoverageTypes.map((cov, idx) => (
                      <option key={idx} value={cov}>
                        {cov}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">New Insured Amount ({defaultCurrency}) <span className="text-red-600">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={replacementPolicy.insuredAmount || selectedPolicy.insuredAmount}
                    onChange={(e) => setReplacementPolicy({ ...replacementPolicy, insuredAmount: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">New Premium ({defaultCurrency})</label>
                  <input
                    type="number"
                    min="0"
                    value={replacementPolicy.premium ?? selectedPolicy.premium}
                    onChange={(e) => setReplacementPolicy({ ...replacementPolicy, premium: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">New Effective Date <span className="text-red-600">*</span></label>
                  <input
                    type="date"
                    value={replacementPolicy.effectiveDate || defaultEffectiveDate}
                    onChange={(e) => setReplacementPolicy({ ...replacementPolicy, effectiveDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">New Expiry Date <span className="text-red-600">*</span></label>
                  <input
                    type="date"
                    value={replacementPolicy.expiryDate || defaultExpiryDate}
                    onChange={(e) => setReplacementPolicy({ ...replacementPolicy, expiryDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#101828] mb-1">Replacement Reason <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Changed to lower premium approved insurer"
                  value={replacementReason}
                  onChange={(e) => setReplacementReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>

              {/* Digital File Attachment Zone */}
              <DocumentAttachmentZone
                title="Supporting Replacement / Novation Schedule"
                description="Attach replacement policy schedule, transition memo, or insurer confirmation"
                defaultDocType="Policy Replacement Schedule"
                documents={replaceDocuments}
                onChange={setReplaceDocuments}
              />

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowReplaceModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={replaceSubmitting || !replacementReason.trim()}
                  onClick={async () => {
                    if (!replacementReason.trim()) {
                      alert('Replacement reason is mandatory.');
                      return;
                    }
                    if (onReplacePolicy) {
                      setReplaceSubmitting(true);
                      try {
                        const ins = activeApprovedInsurers.find(i => i.id === replacementPolicy.insurerId) || activeApprovedInsurers[0];
                        const fullReplacement = {
                          policyNumber: replacementPolicy.policyNumber || `POL-REP-${Math.floor(100000 + Math.random() * 900000)}`,
                          insurerId: ins?.id,
                          insurerName: ins?.name || selectedPolicy.insurerName,
                          coverageType: replacementPolicy.coverageType || selectedPolicy.coverageType,
                          insuredAmount: replacementPolicy.insuredAmount || selectedPolicy.insuredAmount,
                          premium: replacementPolicy.premium ?? selectedPolicy.premium,
                          effectiveDate: replacementPolicy.effectiveDate || defaultEffectiveDate,
                          expiryDate: replacementPolicy.expiryDate || defaultExpiryDate,
                          replacesPolicyId: selectedPolicy.id,
                          collateralId: selectedPolicy.collateralId,
                          customerId: selectedPolicy.customerId,
                          status: 'Pending Approval',
                        };
                        await onReplacePolicy(selectedPolicy.id, fullReplacement, replacementReason, replaceDocuments);
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
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Cancel Policy Cover</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber}</p>
              </div>
              <button onClick={() => setShowCancelModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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

              {/* Digital File Attachment Zone */}
              <DocumentAttachmentZone
                title="Supporting Cancellation Notice / Memo"
                description="Attach borrower cancellation request, facility release memo, or insurer cancellation notice"
                defaultDocType="Policy Cancellation Notice"
                documents={cancelDocuments}
                onChange={setCancelDocuments}
              />

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
                        await onCancelPolicy(selectedPolicy.id, cancelReason, cancelDocuments);
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
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Close Policy (Matured / Settled)</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber}</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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

              {/* Digital File Attachment Zone */}
              <DocumentAttachmentZone
                title="Supporting Settlement / Closure Proof"
                description="Attach loan payoff confirmation, certificate of maturity, or discharge letter"
                defaultDocType="Policy Closure Proof"
                documents={closeDocuments}
                onChange={setCloseDocuments}
              />

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
                        await onClosePolicy(selectedPolicy.id, closeReason, closeDocuments);
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
        <div className="fixed inset-0 bg-[#102E4A]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-[#102E4A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Reopen Closed Policy</h3>
                <p className="text-[11px] text-blue-200">{selectedPolicy.policyNumber} — Request Reactivation</p>
              </div>
              <button onClick={() => setShowReopenModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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

              {/* Digital File Attachment Zone */}
              <DocumentAttachmentZone
                title="Supporting Reopening Authorization"
                description="Attach management reactivation authorization or compliance approval letter"
                defaultDocType="Policy Reopening Authorization"
                documents={reopenDocuments}
                onChange={setReopenDocuments}
              />

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
                        await onReopenPolicy(selectedPolicy.id, reopenReason, reopenDocuments);
                      } else {
                        await cimsApi.reopenPolicy(selectedPolicy.id, reopenReason, currentUser.username, reopenDocuments);
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

      {/* Embedded Document Preview Modal */}
      {showDocPreviewModal && docPreviewTarget && (
        <DocumentPreviewModal
          document={docPreviewTarget}
          isOpen={showDocPreviewModal}
          collaterals={collaterals}
          onClose={() => {
            setShowDocPreviewModal(false);
            setDocPreviewTarget(null);
          }}
          onDownload={(doc) => {
            if (doc.fileContent && doc.fileContent.startsWith('data:') && !doc.fileContent.includes('dummyContent')) {
              const link = document.createElement('a');
              link.href = doc.fileContent;
              link.download = doc.fileName || `${doc.name}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else {
              const link = document.createElement('a');
              link.href = `/api/documents/${encodeURIComponent(doc.id)}/download`;
              link.download = doc.fileName || `${doc.name}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
        />
      )}
    </div>
  );
};
