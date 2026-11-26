import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Link as LinkIcon,
  FileCheck,
  FolderOpen,
  History,
  Unlock,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  FileText,
  UserCheck,
  Percent,
  TrendingUp,
  Upload,
  UploadCloud,
  Trash2,
  Edit,
  RefreshCw,
  Paperclip,
  Check,
  Search,
  User,
  CreditCard,
  Layers,
  MapPin,
  FileBadge,
  Shield,
  ShieldAlert,
  Send,
  HelpCircle,
  Calendar,
  ArrowUpRight,
  Info,
  Database,
  CheckCircle2,
} from 'lucide-react';
import {
  Collateral,
  CollateralOwner,
  LoanAccount,
  LoanCollateralLink,
  InsurancePolicy,
  OwnershipDocument,
  CimsException,
  UserSession,
  CollateralTaxonomy,
  MandatoryDocumentRule,
  BusinessSegment,
  Branch,
  SystemParameter,
  Customer,
  ExposureAdequacySummary,
  Collateral360Dto,
  PolicyPreValidationResultDto,
  ValidationCheckItemDto,
  EntryTimeExceptionRequest,
  CollateralFacilityLinkDto,
  CollateralSecuredFacilitiesSummaryDto,
  InsuranceAdequacyAssessment,
  PreReleaseImpactAssessment,
  InsuranceCoverageRule,
  InsuranceException,
  CollateralReleaseRequest,
} from '../../types';
import { DataGrid, ColumnDef } from '../layout/DataGrid';
import { StatusChip } from '../layout/StatusChip';
import { CircularProgress } from '../layout/CircularProgress';
import { cimsApi } from '../../api/cimsApi';
import { DocumentPreviewModal } from '../documents/DocumentPreviewModal';
import { CollateralFacilityLinkModal } from '../relationships/CollateralFacilityLinkModal';
import { RelationshipHistoryModal } from '../relationships/RelationshipHistoryModal';
import { CbsRelationshipReconcileModal } from '../relationships/CbsRelationshipReconcileModal';
import { CollateralRegistrationWizard } from './wizard/CollateralRegistrationWizard';
import { CbsSyncedCollateralView } from './cbs/CbsSyncedCollateralView';
import { DataQualityWorkbench } from './cbs/DataQualityWorkbench';
import { CollateralEnrichmentModal } from './cbs/CollateralEnrichmentModal';
import { CbsOriginalSnapshotModal } from './cbs/CbsOriginalSnapshotModal';

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

interface CollateralManagerProps {
  collaterals: Collateral[];
  facilities: LoanAccount[];
  links: LoanCollateralLink[];
  policies: InsurancePolicy[];
  documents: OwnershipDocument[];
  exceptions: CimsException[];
  taxonomies?: CollateralTaxonomy[];
  mandatoryDocRules?: MandatoryDocumentRule[];
  segments?: BusinessSegment[];
  branches?: Branch[];
  customers?: Customer[];
  systemParameters?: SystemParameter[];
  currentUser: UserSession;
  selectedSegment?: string;
  initialCollateralId?: string | null;
  onNavigate?: (page: string, params?: Record<string, any>) => void;
  onRegisterCollateral: (col: Partial<Collateral>, allocations?: any[], documents?: any[]) => Promise<void>;
  onAddLink: (loanId: string, collateralId: string, amount: number, linkageType?: string, effectiveDate?: string, endDate?: string) => Promise<void>;
  onRemoveLink: (linkId: string) => Promise<void>;
  onValidateRelease: (collateralId: string) => Promise<{ canRelease: boolean; pendingExposure: number; activeLoans: string[]; message: string }>;
  onInitiateTransfer: (collateralId: string, destSegment: string, reason: string) => Promise<void>;
  onMaintainCollateral?: (collateralId: string, changes: Record<string, any>) => Promise<void>;
  onRefreshData?: () => void | Promise<void>;
}

export const CollateralManager: React.FC<CollateralManagerProps> = ({
  collaterals,
  facilities,
  links,
  policies,
  documents,
  exceptions,
  taxonomies = [],
  mandatoryDocRules = [],
  segments = [],
  branches = [],
  customers = [],
  systemParameters = [],
  currentUser,
  selectedSegment,
  initialCollateralId,
  onNavigate,
  onRegisterCollateral,
  onAddLink,
  onRemoveLink,
  onValidateRelease,
  onInitiateTransfer,
  onMaintainCollateral,
  onRefreshData,
}) => {
  const [selectedCol, setSelectedCol] = useState<Collateral | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'exposure' | 'adequacy' | 'early-release' | 'links' | 'policies' | 'documents' | 'exceptions' | 'history'>('details');
  const [exposureSummary, setExposureSummary] = useState<ExposureAdequacySummary | null>(null);
  const [loadingExposure, setLoadingExposure] = useState(false);
  const [col360Data, setCol360Data] = useState<Collateral360Dto | null>(null);
  const [loading360, setLoading360] = useState(false);
  const [m3SecuredSummary, setM3SecuredSummary] = useState<CollateralSecuredFacilitiesSummaryDto | null>(null);
  const [loadingM3Secured, setLoadingM3Secured] = useState(false);
  const [showM3LinkModal, setShowM3LinkModal] = useState(false);
  const [m3LinkModalMode, setM3LinkModalMode] = useState<'create' | 'edit'>('create');
  const [m3LinkToEdit, setM3LinkToEdit] = useState<CollateralFacilityLinkDto | null>(null);
  const [showM3HistoryModal, setShowM3HistoryModal] = useState(false);
  const [m3HistoryLinkId, setM3HistoryLinkId] = useState('');
  const [m3HistoryRef, setM3HistoryRef] = useState('');
  const [showM3ReconcileModal, setShowM3ReconcileModal] = useState(false);

  const [pagedCollaterals, setPagedCollaterals] = useState<Collateral[]>(collaterals);
  const [totalCollaterals, setTotalCollaterals] = useState<number>(collaterals.length);
  const [colPage, setColPage] = useState<number>(1);
  const [colPageSize, setColPageSize] = useState<number>(25);
  const [colSearch, setColSearch] = useState<string>('');
  const [colLoading, setColLoading] = useState<boolean>(false);

  // --- Insurance Adequacy (BR-18, BR-03, BR-11) & Early Release States ---
  const [adequacyAssessment, setAdequacyAssessment] = useState<InsuranceAdequacyAssessment | null>(null);
  const [loadingAdequacy, setLoadingAdequacy] = useState(false);
  const [preReleaseImpact, setPreReleaseImpact] = useState<PreReleaseImpactAssessment | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [activeReleaseReq, setActiveReleaseReq] = useState<CollateralReleaseRequest | null>(null);
  const [loadingReleaseReq, setLoadingReleaseReq] = useState(false);

  // Exception modal state (BR-07 / BR-12)
  const [showAdequacyExceptionModal, setShowAdequacyExceptionModal] = useState(false);
  const [adequacyExceptionForm, setAdequacyExceptionForm] = useState({
    exceptionType: 'Underinsured Approved Exception',
    reason: '',
    approvedExceptionAmount: 0,
    validityMonths: 6,
    reviewDate: new Date(Date.now() + 180 * 86400000).toISOString().substring(0, 10),
    supportingDocRef: '',
  });
  const [submittingAdequacyException, setSubmittingAdequacyException] = useState(false);

  // Early release request modal state
  const [showEarlyReleaseModal, setShowEarlyReleaseModal] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseFacilityId, setReleaseFacilityId] = useState('');
  const [releaseDmsDocId, setReleaseDmsDocId] = useState('');
  const [submittingEarlyRelease, setSubmittingEarlyRelease] = useState(false);

  // Approver decision notes
  const [releaseApprovalComments, setReleaseApprovalComments] = useState('');
  const [processingReleaseApproval, setProcessingReleaseApproval] = useState(false);

  // Manual CBS update modal state
  const [showManualCbsModal, setShowManualCbsModal] = useState(false);
  const [manualCbsStatus, setManualCbsStatus] = useState<'COMPLETED' | 'PENDING' | 'FAILED'>('COMPLETED');
  const [manualCbsRef, setManualCbsRef] = useState('');
  const [manualCbsNotes, setManualCbsNotes] = useState('');
  const [submittingManualCbs, setSubmittingManualCbs] = useState(false);

  // Top-Level Sub-Tabs (Section 4)
  const [mainSubTab, setMainSubTab] = useState<'overview' | 'cbaims' | 'cbs' | 'quality'>('overview');
  const [filterOrigin, setFilterOrigin] = useState<'ALL' | 'CBAIMS_REGISTERED' | 'CBS_IMPORTED'>('ALL');

  // CBS Modals State
  const [showEnrichmentModal, setShowEnrichmentModal] = useState(false);
  const [colToEnrich, setColToEnrich] = useState<Collateral | null>(null);
  const [showCbsSnapshotModal, setShowCbsSnapshotModal] = useState(false);
  const [colForSnapshot, setColForSnapshot] = useState<Collateral | null>(null);

  const loadAdequacyAssessment = async (colId: string) => {
    setLoadingAdequacy(true);
    try {
      const data = await cimsApi.getInsuranceAdequacy(colId);
      setAdequacyAssessment(data);
    } catch (e) {
      console.warn('Failed to load adequacy assessment:', e);
    } finally {
      setLoadingAdequacy(false);
    }
  };

  const loadPreReleaseImpact = async (colId: string) => {
    setLoadingImpact(true);
    try {
      const data = await cimsApi.getPreReleaseImpactCheck(colId);
      setPreReleaseImpact(data);
    } catch (e) {
      console.warn('Failed to load pre-release impact:', e);
    } finally {
      setLoadingImpact(false);
    }
  };

  const loadActiveReleaseRequest = async (colId: string) => {
    setLoadingReleaseReq(true);
    try {
      const allReqs = await cimsApi.getAllReleaseRequests();
      const found = allReqs?.find((r: any) => r.collateralId === colId && r.approvalStatus !== 'REJECTED');
      setActiveReleaseReq(found || null);
    } catch (e) {
      console.warn('Failed to load release requests:', e);
    } finally {
      setLoadingReleaseReq(false);
    }
  };

  const loadM3SecuredFacilities = async (colId: string) => {
    setLoadingM3Secured(true);
    try {
      const summary = await cimsApi.getCollateralSecuredFacilities(colId);
      setM3SecuredSummary(summary);
    } catch (err) {
      console.warn('Failed to load M3 secured facilities summary:', err);
    } finally {
      setLoadingM3Secured(false);
    }
  };

  const loadCollateral360 = async (colId: string) => {
    setLoading360(true);
    try {
      const data = await cimsApi.getCollateral360(colId);
      setCol360Data(data);
    } catch (e) {
      console.warn('Collateral 360 load error:', e);
    } finally {
      setLoading360(false);
    }
  };

  useEffect(() => {
    if (initialCollateralId && collaterals.length > 0) {
      const found = collaterals.find(
        (c) => c.id === initialCollateralId || c.code === initialCollateralId
      );
      if (found) {
        setSelectedCol(found);
        setShowDetailModal(true);
        loadExposureSummary(found.id);
        loadCollateral360(found.id);
        loadM3SecuredFacilities(found.id);
        loadAdequacyAssessment(found.id);
        loadPreReleaseImpact(found.id);
        loadActiveReleaseRequest(found.id);
      }
    }
  }, [initialCollateralId, collaterals]);

  // Action Modals
  const [showRegisterWizard, setShowRegisterWizard] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [showMaintainModal, setShowMaintainModal] = useState(false);
  const [maintainFields, setMaintainFields] = useState<Partial<Collateral>>({});
  const [maintainError, setMaintainError] = useState<string | null>(null);
  const [maintainSubmitting, setMaintainSubmitting] = useState(false);

  // 1st / 2nd Degree Collateral Priority & Promotion States
  const [filterRank, setFilterRank] = useState<'ALL' | '1ST' | '2ND_INTERNAL' | '2ND_EXTERNAL' | 'PROMOTION_ELIGIBLE'>('ALL');
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promotingCol, setPromotingCol] = useState<Collateral | null>(null);
  const [promoteReviewNotes, setPromoteReviewNotes] = useState('');
  const [promoteSubmitting, setPromoteSubmitting] = useState(false);

  const [showRefreshBalModal, setShowRefreshBalModal] = useState(false);
  const [refreshingCol, setRefreshingCol] = useState<Collateral | null>(null);
  const [refreshBalAmt, setRefreshBalAmt] = useState<number>(0);
  const [refreshAsOfDate, setRefreshAsOfDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [refreshBalSubmitting, setRefreshBalSubmitting] = useState(false);

  // Document upload modal state (in 360 modal)
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadDocType, setUploadDocType] = useState('Title Deed / Property Ownership Certificate');
  const [uploadDocExpiry, setUploadDocExpiry] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Link modal state (in 360 modal)
  const [linkLoanId, setLinkLoanId] = useState('');
  const [linkAmount, setLinkAmount] = useState(5000000);
  const [linkLinkageType, setLinkLinkageType] = useState('Primary');
  const [linkEffectiveDate, setLinkEffectiveDate] = useState(new Date().toISOString().substring(0, 10));
  const [linkEndDate, setLinkEndDate] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // Owner verification modal state
  const [showVerifyOwnerModal, setShowVerifyOwnerModal] = useState(false);
  const [verifyingOwner, setVerifyingOwner] = useState<CollateralOwner | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<string>('Verified');
  const [verifyComments, setVerifyComments] = useState<string>('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  // =========================================================================
  // 8-Step Guided Collateral Registration Wizard State
  // =========================================================================
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [facilityAllocations, setFacilityAllocations] = useState<Record<string, number>>({});
  const [wizardDocuments, setWizardDocuments] = useState<WizardDocItem[]>([]);
  const [wizardRegistering, setWizardRegistering] = useState(false);

  // Module 4: Existing Collateral Duplicate Search in Wizard (§23, §24)
  const [existingColDuplicate, setExistingColDuplicate] = useState<Collateral | null>(null);
  const [searchingDuplicate, setSearchingDuplicate] = useState<boolean>(false);

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

  const defaultCurrency = systemParameters.find((p) => p.paramKey === 'default_currency')?.paramValue || 'ETB';

  const [newCol, setNewCol] = useState<Partial<Collateral>>({
    code: `COL-${Math.floor(100000 + Math.random() * 900000)}`,
    category: taxonomies?.[0]?.category || 'Immovable Properties',
    type: 'Buildings',
    description: '',
    location: '',
    registrationNumber: '',
    valuationAmount: undefined,
    haircut: undefined,
    valuationDate: new Date().toISOString().substring(0, 10),
    valuationMethod: 'Independent Professional Valuation',
    currency: defaultCurrency,
    owningSegment: segments?.find((s) => s.active !== false)?.name || 'Corporate Banking',
    branch: currentUser.branch || 'Bole Special Branch',
    status: 'Pending Approval',
    insuranceStatus: 'Uninsured',
    gpsX: undefined,
    gpsY: undefined,
    engineNumber: '',
    chassisNumber: '',
    machinerySerialNo: '',
    machineryPurchaseDate: '',
    financialInstrumentRef: '',
    issuingEntity: '',
    collateralRank: '1st',
    isFirstDegreeInternal: true,
    firstDegreeCollateralId: '',
    firstDegreeHolderName: '',
    firstDegreeFacilityRef: '',
    firstDegreeOutstandingBalance: undefined,
    firstDegreeBalanceAsOfDate: new Date().toISOString().substring(0, 10),
    registeredMortgageAmount: undefined,
    mortgageRegistrationNumber: '',
    mortgageRegistrationDate: new Date().toISOString().substring(0, 10),
    firstDegreePolicyNumber: '',
    firstDegreeInsurer: '',
    firstDegreePolicyExpiry: '',
    bankNotedAsSecondMortgagee: false,
    firstDegreeConfirmationDocId: '',
    firstDegreeExtractDocId: '',
    promotionEligible: false,
    // Dynamic Subtype Attributes
    livestockTagNumber: '',
    livestockBreed: '',
    livestockQuantity: undefined,
    veterinaryHealthCertDate: '',
    farmCropType: '',
    farmLandHoldingCert: '',
    warehouseReceiptNumber: '',
    warehouseName: '',
    warehouseCommodityType: '',
    warehouseExpiryDate: '',
    ipRegistrationNumber: '',
    ipTitle: '',
    ipFilingDate: '',
    ipExpiryDate: '',
    guarantorName: '',
    guaranteeAgreementRef: '',
    boardResolutionRef: '',
    guaranteeExpiryDate: '',
    ownerWithoutCif: false,
  });

  // Third-party Legal Owner selection state (Decoupling owner from borrower)
  const [thirdPartyOwnerMode, setThirdPartyOwnerMode] = useState<'CBS' | 'MANUAL'>('MANUAL');
  const [thirdPartyOwnerCustomerId, setThirdPartyOwnerCustomerId] = useState<string>('');

  const [ownerDetails, setOwnerDetails] = useState<Partial<CollateralOwner>>({
    ownershipType: 'Borrower-owned',
    name: '',
    ownerType: 'Corporate',
    idNumber: '',
    tin: '',
    phone: '',
    contactInfo: '',
    percentage: 100,
    relationship: 'Borrower',
    relationshipToBorrower: 'Other',
    consentInfo: '',
    pledgeAgreementRef: '',
    remarks: '',
    verificationStatus: 'Recorded',
    verificationDate: new Date().toISOString().substring(0, 10),
    verifyingOfficer: currentUser.name || currentUser.username,
  });

  // Multi-Owner Joint Ownership list
  const [ownersList, setOwnersList] = useState<Array<Partial<CollateralOwner>>>([
    {
      ownershipType: 'Borrower-owned',
      name: '',
      ownerType: 'Individual',
      idNumber: '',
      tin: '',
      phone: '',
      contactInfo: '',
      percentage: 100,
      relationship: 'Borrower',
      relationshipToBorrower: 'Self',
      consentInfo: '',
      pledgeAgreementRef: '',
      remarks: '',
      verificationStatus: 'Recorded',
      verificationDate: new Date().toISOString().substring(0, 10),
      verifyingOfficer: currentUser.name || currentUser.username,
    },
  ]);

  // Ownership Change Modal state
  const [showOwnershipChangeModal, setShowOwnershipChangeModal] = useState(false);
  const [ownershipChangeForm, setOwnershipChangeForm] = useState({
    newOwnerName: '',
    newOwnershipType: 'Third-party-owned',
    ownerType: 'Individual',
    idNumber: '',
    tin: '',
    phone: '',
    contactInfo: '',
    percentage: 100,
    relationshipToBorrower: '',
    effectiveDate: new Date().toISOString().substring(0, 10),
    changeReason: '',
    supportingDocument: '',
    remarks: '',
  });
  const [submittingOwnershipChange, setSubmittingOwnershipChange] = useState(false);
  const [ownershipChangeError, setOwnershipChangeError] = useState<string | null>(null);

  // Linkage metadata per facility
  const [facilityLinkMeta, setFacilityLinkMeta] = useState<Record<string, { linkageType: string; linkedAmount?: number; effectiveDate?: string; endDate?: string }>>({});

  const [destSegment, setDestSegment] = useState('Retail Banking');
  const [transferReason, setTransferReason] = useState('');
  const [releaseCheck, setReleaseCheck] = useState<{ canRelease: boolean; pendingExposure: number; activeLoans: string[]; message: string } | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(false);
  const [docPreviewTarget, setDocPreviewTarget] = useState<OwnershipDocument | null>(null);
  const [showDocPreviewModal, setShowDocPreviewModal] = useState<boolean>(false);

  const isMaker = currentUser.canCreate !== false;

  // Selected customer master details
  const selectedCustomer = customers.find(
    (c) => (c.id && c.id === selectedCustomerId) || (c.cif && c.cif === selectedCustomerId)
  );

  // Filtered customer search
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.cif && c.cif.toLowerCase().includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q)) ||
      (c.segment && c.segment.toLowerCase().includes(q)) ||
      (c.branch && c.branch.toLowerCase().includes(q))
    );
  });

  // Customer isolated facilities retrieval
  const getFacilitiesForCustomer = (custIdOrCif?: string): LoanAccount[] => {
    if (!custIdOrCif) return [];
    const target = custIdOrCif.trim().toLowerCase();

    const cust = customers.find(
      (c) => (c.id && c.id.trim().toLowerCase() === target) || (c.cif && c.cif.trim().toLowerCase() === target)
    );

    const validIds = new Set<string>();
    validIds.add(target);
    if (cust) {
      if (cust.id) validIds.add(cust.id.trim().toLowerCase());
      if (cust.cif) validIds.add(cust.cif.trim().toLowerCase());
    }

    return facilities.filter((f) => {
      if (!f.customerId) return false;
      const fCust = f.customerId.trim().toLowerCase();
      if (validIds.has(fCust)) return true;
      if (cust) {
        if (cust.id && cust.id.trim().toLowerCase() === fCust) return true;
        if (cust.cif && cust.cif.trim().toLowerCase() === fCust) return true;
      }
      return false;
    });
  };

  const isFacilityOwnedByCustomer = (facility: LoanAccount, custIdOrCif?: string): boolean => {
    if (!custIdOrCif) return true;
    const target = custIdOrCif.trim().toLowerCase();
    const cust = customers.find(
      (c) => (c.id && c.id.trim().toLowerCase() === target) || (c.cif && c.cif.trim().toLowerCase() === target)
    );
    const validIds = new Set<string>();
    validIds.add(target);
    if (cust) {
      if (cust.id) validIds.add(cust.id.trim().toLowerCase());
      if (cust.cif) validIds.add(cust.cif.trim().toLowerCase());
    }
    const fCust = (facility.customerId || '').trim().toLowerCase();
    return validIds.has(fCust);
  };

  const customerFacilities = selectedCustomerId ? getFacilitiesForCustomer(selectedCustomerId) : [];

  const netCollateralValue = (newCol.valuationAmount || 0) * (1.0 - ((newCol.haircut || 0) / 100.0));
  const totalAllocatedAmount = Object.values(facilityAllocations).reduce((sum, amt) => sum + (Number(amt) || 0), 0);
  const unallocatedAmount = Math.max(0, netCollateralValue - totalAllocatedAmount);
  const isAllocationOverflow = totalAllocatedAmount > netCollateralValue + 1e-6;

  // 1st / 2nd Degree Wizard Calculations
  const isSecondDegreeNew = newCol.collateralRank === '2nd';
  const firstDegreeOutstandingNew = isSecondDegreeNew ? (Number(newCol.firstDegreeOutstandingBalance) || 0) : 0;
  const wizardCombinedExposure = isSecondDegreeNew ? (firstDegreeOutstandingNew + totalAllocatedAmount) : totalAllocatedAmount;
  const isWizardExposureExceeded = isSecondDegreeNew && wizardCombinedExposure > (Number(newCol.valuationAmount) || 0);
  const wizardExcessExposure = isWizardExposureExceeded ? wizardCombinedExposure - (Number(newCol.valuationAmount) || 0) : 0;
  const isWizardInsuranceDeficient = isSecondDegreeNew && (Number(newCol.insuredAmount) || 0) < wizardCombinedExposure;

  // Standard full collateral subtype catalog per category
  const DEFAULT_SUBTYPES_BY_CATEGORY: Record<string, string[]> = {
    'Immovable Properties': [
      'Commercial Building (Office / Retail / Mall)',
      'Residential Villa / Single Family House',
      'Apartment / Condominium Unit',
      'Industrial Warehouse / Factory Plant',
      'Commercial Land / Developed Plot',
      'Agricultural Land / Farmland',
      'Hotel / Hospitality & Resort Facility',
      'Fuel Station / Petroleum Depot',
      'Hospital / Medical Clinic Complex',
      'School / University Educational Facility',
      'Mixed-Use Commercial & Residential Building',
    ],
    'Movable Properties': [
      'Private Passenger Vehicle (Sedan / SUV)',
      'Commercial Heavy Truck / Prime Mover / Trailer',
      'Commercial Bus / Public Transport Fleet',
      'Construction Machinery (Bulldozer / Excavator / Crane / Loader)',
      'Agricultural Machinery (Tractor / Combine Harvester)',
      'Light Commercial Delivery Van / Pickup',
      'Motorcycle & Delivery Fleet',
      'Aviation Aircraft / Cargo Helicopter',
      'Marine Vessel / Cargo Boat / Barge',
    ],
    'Business Mortgages': [
      'Manufacturing & Industrial Plant Machinery / Assembly Line',
      'Medical & Diagnostic Healthcare Equipment',
      'Printing, Packaging & Publishing Machinery',
      'Textile, Garment & Leather Processing Machinery',
      'Mining, Quarrying & Mineral Extraction Equipment',
      'Food & Beverage Processing Equipment',
      'Heavy Electrical Generators & Power Transformers',
      'Finished Goods Merchandise Stock / Inventory',
      'Raw Materials & Work-in-Progress Inventory',
    ],
    'Financial Assets': [
      'Fixed Term Deposit Receipt (TDR) / Certificate',
      'Government Treasury Bills (T-Bills)',
      'Government Treasury Bonds (T-Bonds)',
      'National Bank (NBE) Stabilization Bills',
      'Corporate Debt Bonds / Commercial Paper',
      'Listed Company Equities / Shares Certificate',
      'Cash Collateral / Blocked Margin Account',
      'Letter of Credit (LC) Cash Margin Deposit',
      'Life Insurance Policy Surrender Value',
    ],
    'Guarantees': [
      'Corporate Cross-Guarantee',
      'Personal Guarantee of Managing Director / Principal Shareholder',
      'First-Class Third-Party Bank Guarantee',
      'Sovereign / Ministry of Finance Guarantee',
      'Multilateral Development Agency Guarantee (e.g. Aceli, FSD, IFC)',
      'Export Credit Guarantee Facility',
    ],
    'Agricultural / Other': [
      'Warehouse Receipt System (ECX WRS Certificate)',
      'Export Coffee / Sesame / Pulse Commodity Stored in Warehouse',
      'Commercial Livestock & Dairy Breeding Herd',
      'Standing Crop / Commercial Plantation Mortgage',
      'Perishable Horticultural Export Goods',
    ],
  };

  const getSubtypesForCategory = (categoryName?: string): string[] => {
    const chosenCat = (categoryName || newCol.category || 'Immovable Properties').trim();
    const list: string[] = [];

    (taxonomies || []).forEach((t) => {
      const catName = (t.category || '').trim();
      const matchCat = catName.toLowerCase() === chosenCat.toLowerCase();
      if (matchCat && t.subCategory) {
        const trimmed = t.subCategory.trim();
        if (trimmed && !list.includes(trimmed) && trimmed.toLowerCase() !== chosenCat.toLowerCase()) {
          list.push(trimmed);
        }
      }
    });

    if (list.length > 0) return list;

    const standardMatch = Object.entries(DEFAULT_SUBTYPES_BY_CATEGORY).find(([catName]) =>
      catName.toLowerCase() === chosenCat.toLowerCase() ||
      catName.toLowerCase().includes(chosenCat.toLowerCase()) ||
      chosenCat.toLowerCase().includes(catName.toLowerCase())
    );

    if (standardMatch && standardMatch[1]) {
      return standardMatch[1];
    }

    return DEFAULT_SUBTYPES_BY_CATEGORY['Immovable Properties'] || [];
  };

  // Active sub-types configured under the chosen category from backend taxonomy
  const availableTaxonomyTypes = useMemo(() => {
    return getSubtypesForCategory(newCol.category);
  }, [taxonomies, newCol.category]);

  // Helper to determine mandatory documents configured in Admin for category + type + ownership
  // Authoritative Chain: Admin Configuration -> active mandatory-document rules -> registration wizard.
  // NO hardcoded fallback rules are permitted.
  const getRequiredDocs = (category?: string, type?: string, ownershipType?: string): MandatoryDocumentRule[] => {
    const cat = (category || newCol.category || '').toLowerCase().trim();
    const subType = (type || newCol.type || '').toLowerCase().trim();
    const isThirdParty = (ownershipType || ownerDetails.ownershipType) === 'Third-party-owned';

    // Match strictly from Admin configured rules (mandatoryDocRules)
    const activeRules = (mandatoryDocRules || []).filter((r) => r.mandatory !== false);
    return activeRules.filter((r) => {
      const rc = (r.collateralCategory || '').toLowerCase().trim();
      const rt = (r.collateralType || '').toLowerCase().trim();
      const oc = (r.ownershipCondition || '').toLowerCase().trim();

      // Check category match
      const catMatch = !rc || rc === 'all' || rc === 'all categories' || rc === cat || rc.includes(cat) || cat.includes(rc);
      if (!catMatch) return false;

      // Check type / subtype match if rule specifies one
      if (rt && rt !== 'all' && rt !== 'all types') {
        const typeMatch = rt === subType || rt.includes(subType) || subType.includes(rt);
        if (!typeMatch) return false;
      }

      // Check ownership condition if rule specifies one
      if (oc && oc !== 'all' && oc !== 'any') {
        if (oc.includes('third') && !isThirdParty) return false;
        if (oc.includes('borrower') && isThirdParty) return false;
      }

      return true;
    });
  };

  const allConfiguredDocTypes = useMemo(() => {
    const list = new Set<string>();
    (mandatoryDocRules || []).forEach((r) => {
      if (r.documentType && r.documentType.trim()) {
        list.add(r.documentType.trim());
      }
    });
    [
      'Title Deed / Property Ownership Certificate',
      'Approved Building Plan',
      'BOQ (Bill of Quantities)',
      'Third-Party Consent and Pledge Agreement',
      'Letter of Consent',
      'Valuation Report',
      'Vehicle Registration Certificate / Logbook',
      'Machinery Ownership Certificate',
      'Purchase Document / Invoice',
      'Lease Agreement',
      'Lease Payment Receipt',
      'Plastic Ear Tag Registration',
      'Land Holding Certificate',
      'Warehouse Receipt',
      'Fixed Term Deposit Certificate',
      'Guarantee Contract / Agreement',
      'Board Resolution Authorizing Pledge',
      'Court Documents / Power of Attorney',
      'Collateral Custody Agreement',
      'Other Ownership / Supporting Document',
    ].forEach((t) => list.add(t));
    return Array.from(list);
  }, [mandatoryDocRules]);

  const docTypeMatches = (ruleType?: string, actualType?: string): boolean => {
    if (!ruleType || !actualType) return false;
    const r = ruleType.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const a = actualType.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (r === a) return true;

    // Third-party consent and pledge agreement
    const rIsPledge = r.includes('consent') && (r.includes('pledge') || r.includes('third party') || r.includes('thirdparty'));
    const aIsPledge = a.includes('consent') && (a.includes('pledge') || a.includes('third party') || a.includes('thirdparty'));
    if (rIsPledge && aIsPledge) return true;

    // Letter of consent
    const rIsLetter = r.includes('letter') && r.includes('consent');
    const aIsLetter = a.includes('letter') && a.includes('consent');
    if (rIsLetter && aIsLetter) return true;

    // Title deed / property ownership certificate
    const rIsTitle = r.includes('title deed') || r.includes('property ownership') || r.includes('ownership cert');
    const aIsTitle = a.includes('title deed') || a.includes('property ownership') || a.includes('ownership cert');
    if (rIsTitle && aIsTitle) return true;
    if (rIsTitle !== aIsTitle && (rIsTitle || aIsTitle)) {
      if (a.includes('valuation') || a.includes('building plan') || a.includes('logbook') || a.includes('vehicle reg')) return false;
    }

    // Approved building plan
    const rIsPlan = r.includes('building plan') || r.includes('cadastral') || r.includes('site plan');
    const aIsPlan = a.includes('building plan') || a.includes('cadastral') || a.includes('site plan');
    if (rIsPlan && aIsPlan) return true;
    if (rIsPlan !== aIsPlan && (rIsPlan || aIsPlan)) {
      if (a.includes('title deed') || a.includes('valuation') || a.includes('vehicle')) return false;
    }

    // Vehicle registration / logbook / libre
    const rIsVehicle = r.includes('vehicle') || r.includes('logbook') || r.includes('libre');
    const aIsVehicle = a.includes('vehicle') || a.includes('logbook') || a.includes('libre');
    if (rIsVehicle && aIsVehicle) return true;
    if (rIsVehicle !== aIsVehicle && (rIsVehicle || aIsVehicle)) {
      if (a.includes('title deed') || a.includes('building') || a.includes('machinery')) return false;
    }

    // Valuation report
    const rIsVal = r.includes('valuation');
    const aIsVal = a.includes('valuation');
    if (rIsVal && aIsVal) return true;
    if (rIsVal !== aIsVal && (rIsVal || aIsVal)) {
      if (a.includes('title deed') || a.includes('building plan') || a.includes('logbook')) return false;
    }

    // Machinery ownership
    const rIsMach = r.includes('machinery');
    const aIsMach = a.includes('machinery') || a.includes('purchase invoice') || a.includes('bill of sale');
    if (rIsMach && aIsMach) return true;

    // Mortgage registration confirmation
    const rIsMortgage = r.includes('mortgage') && (r.includes('registration') || r.includes('confirmation'));
    const aIsMortgage = a.includes('mortgage') && (a.includes('registration') || a.includes('confirmation'));
    if (rIsMortgage && aIsMortgage) return true;

    // Custody agreement
    const rIsCustody = r.includes('custody') && r.includes('agreement');
    const aIsCustody = a.includes('custody') && a.includes('agreement');
    if (rIsCustody && aIsCustody) return true;

    // Guarantee
    const rIsGuar = r.includes('guarantee');
    const aIsGuar = a.includes('guarantee');
    if (rIsGuar && aIsGuar) return true;

    return false;
  };

  const populateDefaultDocs = (category?: string, type?: string, ownershipType?: string) => {
    const targetCat = category || newCol.category || 'Immovable Properties';
    const targetType = type || newCol.type;
    const targetOwnerType = ownershipType || ownerDetails.ownershipType;
    const defaultExpiry = new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000).toISOString().substring(0, 10);
    const reqRules = getRequiredDocs(targetCat, targetType, targetOwnerType);

    // Keep any existing uploaded additional docs
    const existingAdditional = wizardDocuments.filter((d) => !d.isMandatory);

    const mandatorySlots: WizardDocItem[] = reqRules.map((rule, idx) => {
      const prevMatch = wizardDocuments.find(
        (d) => d.isMandatory && docTypeMatches(rule.documentType, d.type)
      );
      return (
        prevMatch || {
          id: `doc-wiz-${Date.now()}-${idx}`,
          name: '',
          type: rule.documentType,
          expiryDate: defaultExpiry,
          remarks: `Admin Mandatory Rule for ${targetCat}`,
          fileName: '',
          fileSize: '',
          fileSizeNum: 0,
          contentType: 'application/pdf',
          fileContent: '',
          isMandatory: true,
        }
      );
    });

    setWizardDocuments([...mandatorySlots, ...existingAdditional]);
  };

  const mandatoryRulesList = getRequiredDocs(newCol.category, newCol.type, ownerDetails.ownershipType);
  const missingMandatoryDocs = mandatoryRulesList.filter((req) => {
    return !wizardDocuments.some(
      (d) =>
        d.isMandatory &&
        docTypeMatches(req.documentType, d.type) &&
        d.fileContent &&
        d.fileContent.trim().length > 0 &&
        d.fileName &&
        d.fileName.trim().length > 0
    );
  });

  // Validation helpers for wizard steps
  const getStep1Errors = (): string[] => {
    const errors: string[] = [];
    if (!selectedCustomerId) errors.push('Please select a customer / borrower.');
    return errors;
  };

  const getStep2Errors = (): string[] => {
    const errors: string[] = [];
    if (customerFacilities.length > 0 && selectedFacilityIds.length === 0) {
      errors.push('Please select at least one facility / loan account to secure, or confirm registering unlinked collateral.');
    }
    return errors;
  };

  const getStep3Errors = (): string[] => {
    const errors: string[] = [];
    if (!newCol.code || newCol.code.trim() === '') errors.push('Collateral Code is mandatory.');
    if (!newCol.category) errors.push('Collateral Category is mandatory.');
    if (!newCol.valuationAmount || Number(newCol.valuationAmount) <= 0) errors.push('Market Valuation Amount must be greater than zero.');
    if (newCol.haircut === undefined || newCol.haircut === null || Number(newCol.haircut) < 0 || Number(newCol.haircut) > 95) errors.push('Haircut Percentage must be specified between 0% and 95%.');

    // GPS Coordinate Range Validation
    if (newCol.gpsX !== undefined && (newCol.gpsX < -180 || newCol.gpsX > 180)) {
      errors.push('GPS Longitude (X coordinate) must be between -180 and +180 degrees.');
    }
    if (newCol.gpsY !== undefined && (newCol.gpsY < -90 || newCol.gpsY > 90)) {
      errors.push('GPS Latitude (Y coordinate) must be between -90 and +90 degrees.');
    }

    // Conditional Immovable Property Validation
    const isImmovable = (newCol.category || '').toLowerCase().includes('immovable') ||
                        (newCol.type || '').toLowerCase().includes('building') ||
                        (newCol.type || '').toLowerCase().includes('land');
    if (isImmovable) {
      if (!newCol.location || !newCol.location.trim()) {
        errors.push('Physical location/address is mandatory for immovable property collateral.');
      }
      const hasRegId = (newCol.titleDeedNumber && newCol.titleDeedNumber.trim()) ||
                       (newCol.registrationNumber && newCol.registrationNumber.trim());
      if (!hasRegId) {
        errors.push('Title deed number or property registration number is mandatory for immovable collateral.');
      }
    }

    // Conditional Vehicle Validation
    const isVehicle = (newCol.category || '').toLowerCase().includes('movable') &&
                      ((newCol.type || '').toLowerCase().includes('vehicle') || (newCol.type || '').toLowerCase().includes('truck') || (newCol.type || '').toLowerCase().includes('car'));
    if (isVehicle) {
      const hasVehId = (newCol.registrationNumber && newCol.registrationNumber.trim()) ||
                       (newCol.chassisNumber && newCol.chassisNumber.trim()) ||
                       (newCol.engineNumber && newCol.engineNumber.trim());
      if (!hasVehId) {
        errors.push('Vehicle plate, chassis, or engine registration number is mandatory for vehicle collateral.');
      }
    }

    // Conditional Under Construction Validation
    if (newCol.isUnderConstruction) {
      const completed = Number(newCol.constructionCompletionPct);
      const remaining = Number(newCol.constructionRemainingPct);
      if (isNaN(completed) || completed < 0 || completed > 100) {
        errors.push('Work completed percentage is mandatory for under-construction collateral (0% to 100%).');
      }
      if (isNaN(remaining) || remaining < 0 || remaining > 100) {
        errors.push('Work remaining percentage is mandatory for under-construction collateral (0% to 100%).');
      }
      if (!isNaN(completed) && !isNaN(remaining) && Math.abs((completed + remaining) - 100) > 0.01) {
        errors.push(`Construction completion (${completed}%) and remaining (${remaining}%) must sum to exactly 100%.`);
      }
      if (!newCol.constructionInspectionDate || !newCol.constructionInspectionDate.trim()) {
        errors.push('Engineering inspection date is mandatory for under-construction collateral.');
      }
      if (!newCol.expectedCompletionDate || !newCol.expectedCompletionDate.trim()) {
        errors.push('Expected completion date is mandatory for under-construction collateral.');
      }
    }

    // 1st / 2nd Degree Validation
    if (newCol.collateralRank === '2nd') {
      if (newCol.isFirstDegreeInternal) {
        if (!newCol.firstDegreeCollateralId || !newCol.firstDegreeCollateralId.trim()) {
          errors.push('Internal 2nd-degree collateral must link to an existing active CBAIMS first-degree collateral.');
        }
      } else {
        if (!newCol.firstDegreeHolderName || !newCol.firstDegreeHolderName.trim()) {
          errors.push('External 1st-degree holder financial institution name is mandatory.');
        }
        if (!newCol.firstDegreeFacilityRef || !newCol.firstDegreeFacilityRef.trim()) {
          errors.push('External 1st-degree facility reference is mandatory.');
        }
        if (!newCol.firstDegreeOutstandingBalance || Number(newCol.firstDegreeOutstandingBalance) <= 0) {
          errors.push('External 1st-degree outstanding balance must be greater than zero.');
        }
        if (!newCol.registeredMortgageAmount || Number(newCol.registeredMortgageAmount) <= 0) {
          errors.push('Registered mortgage amount is mandatory.');
        }
        if (!newCol.mortgageRegistrationNumber || !newCol.mortgageRegistrationNumber.trim()) {
          errors.push('Mortgage / Cadastral registration number is mandatory.');
        }
      }
    }

    // Agricultural / Livestock Validation
    const subLower = (newCol.type || '').toLowerCase();
    const catLower = (newCol.category || '').toLowerCase();
    if (subLower.includes('livestock') || catLower.includes('livestock')) {
      if (!newCol.livestockTagNumber && !newCol.registrationNumber) {
        errors.push('Livestock Ear Tag Number or Registration Number is mandatory for livestock collateral.');
      }
      if (!newCol.livestockBreed) {
        errors.push('Livestock Breed is mandatory for livestock collateral.');
      }
      if (!newCol.livestockQuantity || Number(newCol.livestockQuantity) <= 0) {
        errors.push('Livestock Head Count / Quantity must be greater than zero.');
      }
    }

    // Farm Products Validation
    if (subLower.includes('farm') || subLower.includes('crop') || subLower.includes('agricultural product')) {
      if (!newCol.farmCropType) {
        errors.push('Crop / Farm Product Type is mandatory for agricultural product collateral.');
      }
    }

    // Warehouse Receipt Validation
    if (subLower.includes('warehouse') || catLower.includes('warehouse')) {
      if (!newCol.warehouseReceiptNumber && !newCol.registrationNumber) {
        errors.push('Warehouse Receipt Number is mandatory.');
      }
      if (!newCol.warehouseName) {
        errors.push('Licensed Warehouse Operator / Facility Name is mandatory.');
      }
    }

    // Intellectual Property / Intangible Assets Validation
    if (catLower.includes('intangible') || catLower.includes('intellectual') || subLower.includes('patent') || subLower.includes('trademark') || subLower.includes('ip right')) {
      if (!newCol.ipRegistrationNumber && !newCol.registrationNumber) {
        errors.push('EIPA / Registry IP Registration Number is mandatory.');
      }
      if (!newCol.ipTitle && !newCol.description) {
        errors.push('Intellectual Property Title is mandatory.');
      }
    }

    // Guarantees Validation
    if (catLower.includes('guarantee') || subLower.includes('guarantee')) {
      if (!newCol.guarantorName) {
        errors.push('Guarantor Legal Entity / Person Name is mandatory for guarantee collateral.');
      }
      if (!newCol.guaranteeAgreementRef && !newCol.registrationNumber) {
        errors.push('Guarantee Agreement / Contract Reference is mandatory.');
      }
    }
    return errors;
  };

  const getStep4Errors = (): string[] => {
    const errors: string[] = [];
    if (ownerDetails.ownershipType === 'Third-party-owned') {
      if (thirdPartyOwnerMode === 'CBS' && !thirdPartyOwnerCustomerId) {
        errors.push('Please select the verified CBS Customer record who legally owns this collateral.');
      }
      if (ownersList.length === 0) {
        errors.push('At least one owner record must be provided.');
      } else {
        const totalPct = ownersList.reduce((sum, o) => sum + (Number(o.percentage) || 0), 0);
        if (Math.abs(totalPct - 100) > 0.01) {
          errors.push(`Total ownership percentage across all owners must equal 100.0% (Current total: ${totalPct.toFixed(1)}%).`);
        }
        ownersList.forEach((o, idx) => {
          if (!o.name || o.name.trim() === '') errors.push(`Owner #${idx + 1}: Legal Owner Name is mandatory.`);
          if (!o.idNumber || o.idNumber.trim() === '') errors.push(`Owner #${idx + 1}: National ID / Passport / Business Registration is mandatory.`);
          if (!o.phone || o.phone.trim() === '') errors.push(`Owner #${idx + 1}: Contact Phone is mandatory.`);
        });
      }
    } else {
      if (!selectedCustomer) errors.push('Borrower customer must be selected.');
    }
    return errors;
  };

  const getStep5Errors = (): string[] => {
    const errors: string[] = [];
    if (isAllocationOverflow) {
      errors.push(`Allocation Overflow: Total allocated security amount (ETB ${totalAllocatedAmount.toLocaleString()}) exceeds Net Collateral Value (ETB ${netCollateralValue.toLocaleString()}).`);
    }
    return errors;
  };

  const getStep6Errors = (): string[] => {
    const errors: string[] = [];
    if (missingMandatoryDocs.length > 0) {
      errors.push(`Missing mandatory document files: ${missingMandatoryDocs.map((m) => m.documentType).join(', ')}`);
    }
    return errors;
  };

  const runPreValidation = async () => {
    if (!selectedCustomerId || !newCol.category) return;
    setIsValidating(true);
    try {
      const allocationsList = Object.entries(facilityAllocations)
        .filter(([_, amt]) => Number(amt) > 0)
        .map(([facId, amt]) => {
          const meta = facilityLinkMeta[facId] || {};
          return {
            facilityId: facId,
            allocatedAmount: Number(amt),
            linkedAmount: meta.linkedAmount !== undefined ? Number(meta.linkedAmount) : Number(amt),
            linkageType: meta.linkageType || 'Primary',
            effectiveDate: meta.effectiveDate || new Date().toISOString().substring(0, 10),
            endDate: meta.endDate || undefined,
          };
        });

      const ownersToEval = (ownersList.length > 0 ? ownersList : [ownerDetails]).map((o) => {
        const isBorrowerOwned = o.ownershipType === 'Borrower-owned' || (!o.ownershipType && ownerDetails.ownershipType === 'Borrower-owned');
        return {
          name: isBorrowerOwned ? selectedCustomer?.name || 'Borrower' : o.name || '',
          ownershipType: o.ownershipType || ownerDetails.ownershipType || 'Borrower-owned',
          ownerType: o.ownerType || 'Individual',
          idNumber: isBorrowerOwned ? (o.idNumber || selectedCustomer?.nationalId || selectedCustomer?.businessRegNo || '') : (o.idNumber || ''),
          tin: isBorrowerOwned ? (o.tin || selectedCustomer?.taxIdNo || '') : (o.tin || ''),
          phone: isBorrowerOwned ? (o.phone || selectedCustomer?.phone || '') : (o.phone || ''),
          contactInfo: isBorrowerOwned ? (o.contactInfo || selectedCustomer?.address || '') : (o.contactInfo || ''),
          percentage: Number(o.percentage || 100),
          relationship: isBorrowerOwned ? 'Borrower' : o.relationshipToBorrower || o.relationship || 'Third-Party Owner',
          relationshipToBorrower: o.relationshipToBorrower || '',
          consentInfo: o.consentInfo || '',
          pledgeAgreementRef: o.pledgeAgreementRef || '',
          remarks: o.remarks || '',
          verificationStatus: o.verificationStatus || 'Recorded',
          verificationDate: o.verificationDate,
          verifyingOfficer: o.verifyingOfficer,
        };
      });

      const docsPayload = (wizardDocuments || []).map((d) => ({
        type: d.type,
        name: d.name || d.fileName || d.type,
        fileName: d.fileName || '',
        fileContent: d.fileContent || '',
        isMandatory: d.isMandatory,
      }));

      const draftCol: Partial<Collateral> = {
        ...newCol,
        gpsCoordinates: (newCol.gpsY !== undefined && newCol.gpsX !== undefined) ? `${newCol.gpsY}, ${newCol.gpsX}` : newCol.gpsCoordinates,
        customerId: selectedCustomerId,
        ownerType: ownerDetails.ownershipType,
      };

      const res = await cimsApi.preValidateCollateral(draftCol, docsPayload, allocationsList, ownersToEval);
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
      console.warn('Collateral pre-validation failed:', err);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if ((wizardStep === 7 || wizardStep === 8) && showRegisterWizard && selectedCustomerId) {
      runPreValidation();
    }
  }, [
    wizardStep,
    showRegisterWizard,
    selectedCustomerId,
    newCol.category,
    newCol.type,
    newCol.valuationAmount,
    newCol.haircut,
    facilityAllocations,
    wizardDocuments,
    ownersList,
  ]);

  // Module 4: Step 3 Duplicate Collateral Search against active repository (§23, §24)
  useEffect(() => {
    if (wizardStep !== 3 || !showRegisterWizard) {
      setExistingColDuplicate(null);
      return;
    }

    const titleDeed = newCol.titleDeedNumber?.trim();
    const regNo = newCol.registrationNumber?.trim();
    const code = newCol.code?.trim();

    if (!titleDeed && !regNo && !code) {
      setExistingColDuplicate(null);
      return;
    }

    let active = true;
    setSearchingDuplicate(true);

    const timer = setTimeout(() => {
      cimsApi
        .searchExistingCollateral({
          titleDeedNumber: titleDeed || undefined,
          registrationNumber: regNo || undefined,
          code: code || undefined,
        })
        .then((found) => {
          if (active) {
            setExistingColDuplicate(found || null);
            setSearchingDuplicate(false);
          }
        })
        .catch(() => {
          if (active) {
            setExistingColDuplicate(null);
            setSearchingDuplicate(false);
          }
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [wizardStep, showRegisterWizard, newCol.titleDeedNumber, newCol.registrationNumber, newCol.code]);

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

  const handleSubmitCollateralExceptionRequest = async () => {
    if (!exceptionForm.reason.trim()) {
      alert('Validation Error: Reason / justification is mandatory when requesting an exception.');
      return;
    }
    if (!exceptionForm.comments.trim()) {
      alert('Validation Error: Exception comments / operational remarks are mandatory.');
      return;
    }
    if (!selectedCustomerId) {
      alert('Validation Error: A customer must be selected.');
      return;
    }

    setExceptionSubmitting(true);
    try {
      const allocationsList = Object.entries(facilityAllocations)
        .filter(([_, amt]) => Number(amt) > 0)
        .map(([facId, amt]) => {
          const meta = facilityLinkMeta[facId] || {};
          return {
            facilityId: facId,
            allocatedAmount: Number(amt),
            linkedAmount: meta.linkedAmount !== undefined ? Number(meta.linkedAmount) : Number(amt),
            linkageType: meta.linkageType || 'Primary',
            effectiveDate: meta.effectiveDate || new Date().toISOString().substring(0, 10),
            endDate: meta.endDate || undefined,
          };
        });

      const ownersToSave: CollateralOwner[] = (ownersList.length > 0 ? ownersList : [ownerDetails]).map((o) => {
        const isBorrowerOwned = o.ownershipType === 'Borrower-owned' || (!o.ownershipType && ownerDetails.ownershipType === 'Borrower-owned');
        return {
          name: isBorrowerOwned ? selectedCustomer?.name || 'Borrower' : o.name || '',
          ownershipType: o.ownershipType || ownerDetails.ownershipType || 'Borrower-owned',
          ownerType: o.ownerType || 'Individual',
          idNumber: isBorrowerOwned ? (o.idNumber || selectedCustomer?.nationalId || selectedCustomer?.businessRegNo || '') : (o.idNumber || ''),
          tin: isBorrowerOwned ? (o.tin || selectedCustomer?.taxIdNo || '') : (o.tin || ''),
          phone: isBorrowerOwned ? (o.phone || selectedCustomer?.phone || '') : (o.phone || ''),
          contactInfo: isBorrowerOwned ? (o.contactInfo || selectedCustomer?.address || '') : (o.contactInfo || ''),
          percentage: Number(o.percentage || 100),
          relationship: isBorrowerOwned ? 'Borrower' : o.relationshipToBorrower || o.relationship || 'Third-Party Owner',
          relationshipToBorrower: o.relationshipToBorrower || '',
          consentInfo: o.consentInfo || '',
          pledgeAgreementRef: o.pledgeAgreementRef || '',
          remarks: o.remarks || '',
          verificationStatus: o.verificationStatus || 'Recorded',
          verificationDate: o.verificationDate,
          verifyingOfficer: o.verifyingOfficer,
          gpsX: newCol.gpsX,
          gpsY: newCol.gpsY,
        };
      });

      const draftCol: Partial<Collateral> = {
        ...newCol,
        customerId: selectedCustomerId,
        ownerType: ownerDetails.ownershipType,
        owners: ownersToSave,
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
          expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().substring(0, 10),
          remarks: 'Attached to Exception Request for ' + exceptionForm.failedRequirement,
          fileName: exceptionForm.evidenceDocument,
          fileSize: 102400,
          contentType: 'application/pdf',
          fileContent: exceptionForm.evidenceFileContent,
          isMandatory: true,
        });
      }

      const reqPayload: EntryTimeExceptionRequest = {
        collateral: draftCol,
        allocations: allocationsList,
        exceptionType: exceptionForm.exceptionType,
        failedRequirement: exceptionForm.failedRequirement,
        reason: exceptionForm.reason.trim(),
        comments: exceptionForm.comments.trim(),
        evidenceDocument: exceptionForm.evidenceDocument,
        documents: docsToSave,
      };

      const res = await cimsApi.submitCollateralExceptionRequest(reqPayload, currentUser?.username || 'CRO_USER');
      alert(`✓ Exception Created Successfully!\n\nException ID: ${res.exceptionId}\nStatus: Pending Exception Approval\n\nCollateral ${draftCol.code} has been saved and routed to the configured approver. Upon exception approval, the transaction will automatically resume into the standard workflow without re-keying.`);

      setShowExceptionModal(false);
      setShowRegisterWizard(false);
      window.location.reload();
    } catch (err: any) {
      alert(`Exception submission failed: ${err.message || err}`);
    } finally {
      setExceptionSubmitting(false);
    }
  };

  const loadExposureSummary = async (collateralId: string) => {
    setLoadingExposure(true);
    try {
      const data = await cimsApi.fetchCollateralExposureSummary(collateralId);
      setExposureSummary(data);
    } catch (e) {
      console.error('Exposure summary load error:', e);
    } finally {
      setLoadingExposure(false);
    }
  };

  const collateralColumns: ColumnDef<Collateral>[] = [
    {
      header: 'Collateral Code',
      accessorKey: 'code',
      cell: (c) => (
        <div className="flex items-center gap-2 font-bold text-[#00205B]">
          <Building2 className="w-4 h-4 text-[#00205B]" />
          <span>{c.code}</span>
        </div>
      ),
    },
    {
      header: 'Origin',
      accessorKey: 'originType',
      cell: (c) => {
        const isCbs = c.originType === 'CBS_IMPORTED';
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isCbs
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isCbs ? <Database className="w-3 h-3 text-blue-600" /> : <ShieldCheck className="w-3 h-3 text-emerald-600" />}
            {isCbs ? 'CBS Imported' : 'CBAIMS Registered'}
          </span>
        );
      },
    },
    {
      header: 'Customer / CIF',
      accessorKey: 'customerId',
      cell: (c) => {
        const cust = customers.find((cu) => cu.id === c.customerId || cu.cif === c.customerId);
        return (
          <div>
            <div className="font-semibold text-[#101828]">{cust?.name || c.customerId || '—'}</div>
            <div className="text-[11px] text-[#5B6472]">{cust?.cif || c.customerId}</div>
          </div>
        );
      },
    },
    {
      header: 'Category / Type',
      accessorKey: 'category',
      cell: (c) => (
        <div>
          <div className="font-semibold text-[#101828]">{c.category}</div>
          <div className="text-[11px] text-[#5B6472]">{c.type || c.category}</div>
        </div>
      ),
    },
    {
      header: 'Mortgage Rank',
      accessorKey: 'collateralRank',
      cell: (c) => {
        const is2nd = c.collateralRank === '2nd';
        const isInternal = c.isFirstDegreeInternal;
        return (
          <div className="flex flex-col gap-1 items-start">
            {!is2nd ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                1st Degree
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                isInternal 
                  ? 'bg-purple-100 text-purple-800 border-purple-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {isInternal ? '🔗 2nd (Internal)' : '🏛️ 2nd (External)'}
              </span>
            )}
            {c.promotionEligible && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                ⚡ Promotion Ready
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Market Valuation',
      accessorKey: 'valuationAmount',
      cell: (c) => (
        <div className="tabular-nums font-semibold text-[#00205B]">
          {c.currency || 'ETB'} {c.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: 'Haircut',
      accessorKey: 'haircut',
      cell: (c) => (
        <div className="text-xs font-semibold tabular-nums text-[#5B6472]">
          {c.haircut ?? 20}%
        </div>
      ),
    },
    {
      header: 'Net Security Value',
      accessorKey: 'limitContribution',
      cell: (c) => {
        const net = (c.valuationAmount || 0) * (1.0 - ((c.haircut || 0) / 100.0));
        return (
          <div className="tabular-nums font-bold text-emerald-700">
            {c.currency || 'ETB'} {net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        );
      },
    },
    {
      header: 'Allocated Security',
      accessorKey: 'currentAllocation',
      cell: (c) => (
        <div className="tabular-nums font-semibold text-blue-800">
          {c.currency || 'ETB'} {(c.currentAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: 'Ownership',
      accessorKey: 'ownerType',
      cell: (c) => (
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {c.ownerType || 'Borrower-owned'}
        </span>
      ),
    },
    {
      header: 'Insurance Status',
      accessorKey: 'insuranceStatus',
      cell: (c) => {
        const isFully = (c.insuranceStatus || '').toLowerCase().includes('fully') || (c.status || '').toLowerCase().includes('insured');
        const isUnder = (c.insuranceStatus || '').toLowerCase().includes('under') || (c.status || '').toLowerCase().includes('under');
        const colPol = policies.find((p) => p.collateralId === c.id || p.collateralId === c.code);
        return colPol ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNavigate) {
                onNavigate('insurance', { policyId: colPol.id, id: colPol.id });
              }
            }}
            className="flex items-center gap-1 group/pol cursor-pointer text-left"
            title={`Click to view policy: ${colPol.policyNumber}`}
          >
            <StatusChip
              label={c.insuranceStatus || c.status || 'Insured'}
              variant={isFully ? 'success' : isUnder ? 'warning' : 'neutral'}
            />
            <ArrowUpRight className="w-3 h-3 text-blue-600 opacity-60 group-hover/pol:opacity-100" />
          </button>
        ) : (
          <StatusChip
            label={c.insuranceStatus || c.status || 'Uninsured'}
            variant={isFully ? 'success' : isUnder ? 'warning' : 'neutral'}
          />
        );
      },
    },
    {
      header: 'Workflow State',
      accessorKey: 'authStat',
      cell: (c) => (
        <StatusChip
          label={c.authStat === 'A' ? 'Active / Authorized' : c.authStat === 'R' ? 'Rejected' : 'Pending Approval'}
          variant={c.authStat === 'A' ? 'success' : c.authStat === 'R' ? 'danger' : 'warning'}
        />
      ),
    },
    {
      header: 'Actions',
      cell: (c) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCol(c);
              setShowDetailModal(true);
              loadExposureSummary(c.id);
              loadCollateral360(c.id);
              loadM3SecuredFacilities(c.id);
              loadAdequacyAssessment(c.id);
              loadPreReleaseImpact(c.id);
              loadActiveReleaseRequest(c.id);
            }}
            className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            Collateral 360
          </button>
          {c.originType === 'CBS_IMPORTED' && isMaker && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setColToEnrich(c);
                setShowEnrichmentModal(true);
              }}
              className="py-1 px-2.5 text-xs flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded shadow-2xs"
              title="Complete or Correct CBAIMS Data"
            >
              <Edit className="w-3.5 h-3.5" />
              Enrich
            </button>
          )}
          {isMaker && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCol(c);
                setM3LinkToEdit(null);
                setM3LinkModalMode('create');
                setShowM3LinkModal(true);
              }}
              className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded"
              title="Link credit facility to this collateral"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Link Facility
            </button>
          )}
        </div>
      ),
    },
  ];

  const colLinks = selectedCol
    ? links.filter((l) => l.collateralId === selectedCol.id || l.collateralId === selectedCol.code)
    : [];
  const colPolicies = selectedCol
    ? policies.filter((p) => p.collateralId === selectedCol.id || p.collateralId === selectedCol.code)
    : [];
  const colDocs = selectedCol
    ? documents.filter((d) => d.entityId === selectedCol.id || d.collateralId === selectedCol.id || d.entityId === selectedCol.code || d.collateralId === selectedCol.code)
    : [];
  const colExceptions = selectedCol
    ? exceptions.filter((e) => e.entityId === selectedCol.id || e.entityId === selectedCol.code)
    : [];

  const handleOpenReleaseModal = async () => {
    if (!selectedCol) return;
    setLoadingRelease(true);
    try {
      const res = await onValidateRelease(selectedCol.id);
      setReleaseCheck(res);
      setShowReleaseModal(true);
    } finally {
      setLoadingRelease(false);
    }
  };

  const handleStartWizard = () => {
    setWizardStep(1);
    const initialCust = customers[0]?.id || '';
    setSelectedCustomerId(initialCust);
    setCustomerSearchQuery('');
    setSelectedFacilityIds([]);
    setFacilityAllocations({});
    const initialCategory = taxonomies?.[0]?.category || 'Immovable Properties';
    const initialType = 'Buildings';
    setNewCol({
      code: `COL-${Math.floor(100000 + Math.random() * 900000)}`,
      category: initialCategory,
      type: initialType,
      description: '',
      location: '',
      registrationNumber: '',
      valuationAmount: undefined,
      haircut: undefined,
      valuationDate: new Date().toISOString().substring(0, 10),
      valuationMethod: 'Independent Professional Valuation',
      currency: defaultCurrency,
      owningSegment: segments?.find((s) => s.active !== false)?.name || 'Corporate Banking',
      branch: currentUser.branch || 'Bole Special Branch',
      status: 'Pending Approval',
      insuranceStatus: 'Uninsured',
      gpsX: undefined,
      gpsY: undefined,
      collateralRank: '1st',
      isFirstDegreeInternal: true,
      firstDegreeCollateralId: '',
      firstDegreeHolderName: '',
      firstDegreeFacilityRef: '',
      firstDegreeOutstandingBalance: undefined,
      firstDegreeBalanceAsOfDate: new Date().toISOString().substring(0, 10),
      registeredMortgageAmount: undefined,
      mortgageRegistrationNumber: '',
      mortgageRegistrationDate: new Date().toISOString().substring(0, 10),
      firstDegreePolicyNumber: '',
      firstDegreeInsurer: '',
      firstDegreePolicyExpiry: '',
      bankNotedAsSecondMortgagee: false,
      firstDegreeConfirmationDocId: '',
      firstDegreeExtractDocId: '',
      promotionEligible: false,
    });
    setOwnerDetails({
      ownershipType: 'Borrower-owned',
      name: customers[0]?.name || '',
      ownerType: customers[0]?.customerType || 'Corporate',
      idNumber: customers[0]?.nationalId || customers[0]?.businessRegNo || '',
      tin: customers[0]?.taxIdNo || '',
      phone: customers[0]?.phone || '',
      contactInfo: customers[0]?.address || '',
      percentage: 100,
      relationship: 'Borrower',
      relationshipToBorrower: 'Other',
      consentInfo: '',
      pledgeAgreementRef: '',
      remarks: '',
      verificationStatus: 'Recorded',
      verificationDate: new Date().toISOString().substring(0, 10),
      verifyingOfficer: currentUser.name || currentUser.username,
    });
    setOwnersList([
      {
        ownershipType: 'Borrower-owned',
        name: customers[0]?.name || '',
        ownerType: customers[0]?.customerType || 'Corporate',
        idNumber: customers[0]?.nationalId || customers[0]?.businessRegNo || '',
        tin: customers[0]?.taxIdNo || '',
        phone: customers[0]?.phone || '',
        contactInfo: customers[0]?.address || '',
        percentage: 100,
        relationship: 'Borrower',
        relationshipToBorrower: 'Self',
        consentInfo: '',
        pledgeAgreementRef: '',
        remarks: '',
        verificationStatus: 'Recorded',
        verificationDate: new Date().toISOString().substring(0, 10),
        verifyingOfficer: currentUser.name || currentUser.username,
      },
    ]);
    setFacilityLinkMeta({});
    populateDefaultDocs(initialCategory, initialType, 'Borrower-owned');
    setShowRegisterWizard(true);
  };

  const handleFinishWizard = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (isAllocationOverflow) {
      alert('Total allocated security amount exceeds the Net Collateral Value.');
      return;
    }
    if (preValidationResult && !preValidationResult.valid) {
      alert(
        `Cannot submit to standard Checker:\n\n${preValidationResult.summaryMessage}\n\nPlease either attach the missing document(s) on Step 6 or submit this transaction as an Exception.`
      );
      setWizardStep(7);
      return;
    }
    if (missingMandatoryDocs.length > 0) {
      alert(
        `Cannot submit: Missing uploaded files for mandatory document(s) configured in Admin:\n\n• ` +
          missingMandatoryDocs.map((m) => m.documentType).join('\n• ') +
          `\n\nPlease attach valid files for all mandatory documents before submitting, or submit as an authorized exception.`
      );
      setWizardStep(7);
      return;
    }

    // Validate Joint and Third-Party Ownership
    if (ownerDetails.ownershipType === 'Third-party-owned') {
      const activeOwners = ownersList.length > 0 ? ownersList : [ownerDetails];
      if (!activeOwners || activeOwners.length === 0) {
        alert('Cannot submit: At least one legal owner is required for third-party collateral.');
        setWizardStep(4);
        return;
      }
      for (let i = 0; i < activeOwners.length; i++) {
        const o = activeOwners[i];
        if (!o.name || !o.name.trim()) {
          alert(`Cannot submit: Legal Owner #${i + 1} Name is mandatory.`);
          setWizardStep(4);
          return;
        }
        if (!o.idNumber?.trim() && !o.tin?.trim() && !o.businessRegNo?.trim()) {
          alert(`Cannot submit: Legal Owner #${i + 1} (${o.name}) must have valid identification (National ID / Business Reg / TIN).`);
          setWizardStep(4);
          return;
        }
        if (!o.relationshipToBorrower || !o.relationshipToBorrower.trim()) {
          alert(`Cannot submit: Legal Owner #${i + 1} (${o.name}) must have an explicitly selected relationship to borrower.`);
          setWizardStep(4);
          return;
        }
      }
      const totalPct = activeOwners.reduce((sum, o) => sum + (Number(o.percentage) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        alert(`Cannot submit: Total Ownership Percentage across third-party owners must equal exactly 100.0%. Current total: ${totalPct.toFixed(1)}%.`);
        setWizardStep(4);
        return;
      }
    } else if (ownerDetails.ownershipType === 'Joint' || ownerDetails.ownershipType === 'Jointly-owned' || ownersList.length > 1) {
      if (ownersList.length < 2) {
        alert('Cannot submit: Joint ownership requires at least two legal co-owners.');
        setWizardStep(4);
        return;
      }
      const totalPct = ownersList.reduce((sum, o) => sum + (Number(o.percentage) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        alert(`Cannot submit: Total Ownership Percentage across all joint owners must equal exactly 100.0%. Current total: ${totalPct.toFixed(1)}%.`);
        setWizardStep(4);
        return;
      }
    }

    const isThirdParty = ownerDetails.ownershipType === 'Third-party-owned';
    const allocationsList = Object.entries(facilityAllocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([facId, amt]) => {
        const meta = facilityLinkMeta[facId] || {};
        return {
          facilityId: facId,
          allocatedAmount: Number(amt),
          linkedAmount: meta.linkedAmount !== undefined ? Number(meta.linkedAmount) : Number(amt),
          linkageType: meta.linkageType || 'Primary',
          effectiveDate: meta.effectiveDate || new Date().toISOString().substring(0, 10),
          endDate: meta.endDate || undefined,
          collateralRank: newCol.collateralRank || '1st',
          isFirstDegreeInternal: newCol.isFirstDegreeInternal,
          firstDegreeCollateralId: newCol.firstDegreeCollateralId,
          firstDegreeHolderName: newCol.firstDegreeHolderName,
          firstDegreeFacilityRef: newCol.firstDegreeFacilityRef,
          firstDegreeOutstandingBalance: newCol.firstDegreeOutstandingBalance,
          firstDegreeBalanceAsOfDate: newCol.firstDegreeBalanceAsOfDate,
          registeredMortgageAmount: newCol.registeredMortgageAmount,
          mortgageRegistrationNumber: newCol.mortgageRegistrationNumber,
          mortgageRegistrationDate: newCol.mortgageRegistrationDate,
          bankNotedAsSecondMortgagee: newCol.bankNotedAsSecondMortgagee,
          borrowerCustomerId: selectedCustomerId,
          legalOwnerCustomerId: isThirdParty ? (thirdPartyOwnerMode === 'CBS' && thirdPartyOwnerCustomerId ? thirdPartyOwnerCustomerId : undefined) : selectedCustomerId,
          ownerWithoutCif: isThirdParty && thirdPartyOwnerMode === 'MANUAL',
        };
      });

    // Prepare owner entity list
    const ownersToSave: CollateralOwner[] = (ownersList.length > 0 ? ownersList : [ownerDetails]).map((o) => {
      const isBorrowerOwned = o.ownershipType === 'Borrower-owned' || (!o.ownershipType && ownerDetails.ownershipType === 'Borrower-owned');
      return {
        name: isBorrowerOwned ? selectedCustomer?.name || 'Borrower' : o.name || '',
        ownershipType: o.ownershipType || ownerDetails.ownershipType || 'Borrower-owned',
        ownerType: o.ownerType || 'Individual',
        idNumber: isBorrowerOwned ? (o.idNumber || selectedCustomer?.nationalId || selectedCustomer?.businessRegNo || '') : (o.idNumber || ''),
        tin: isBorrowerOwned ? (o.tin || selectedCustomer?.taxIdNo || '') : (o.tin || ''),
        phone: isBorrowerOwned ? (o.phone || selectedCustomer?.phone || '') : (o.phone || ''),
        contactInfo: isBorrowerOwned ? (o.contactInfo || selectedCustomer?.address || '') : (o.contactInfo || ''),
        percentage: Number(o.percentage || 100),
        relationship: isBorrowerOwned ? 'Borrower' : o.relationshipToBorrower || o.relationship || 'Third-Party Owner',
        relationshipToBorrower: o.relationshipToBorrower || '',
        consentInfo: o.consentInfo || '',
        pledgeAgreementRef: o.pledgeAgreementRef || '',
        remarks: o.remarks || '',
        verificationStatus: o.verificationStatus || 'Recorded',
        verificationDate: o.verificationDate,
        verifyingOfficer: o.verifyingOfficer,
        gpsX: newCol.gpsX,
        gpsY: newCol.gpsY,
      };
    });

    setWizardRegistering(true);
    try {
      const gpsFormatted = (newCol.gpsY !== undefined && newCol.gpsX !== undefined)
        ? `${newCol.gpsY}, ${newCol.gpsX}`
        : newCol.gpsCoordinates;
      const colToSave: Partial<Collateral> = {
        ...newCol,
        gpsCoordinates: gpsFormatted,
        customerId: isThirdParty
          ? (thirdPartyOwnerMode === 'CBS' && thirdPartyOwnerCustomerId ? thirdPartyOwnerCustomerId : undefined)
          : selectedCustomerId,
        ownerWithoutCif: isThirdParty && thirdPartyOwnerMode === 'MANUAL',
        ownerType: ownerDetails.ownershipType,
        owners: ownersToSave,
        verificationStatus: 'Recorded',
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
      await onRegisterCollateral(colToSave, allocationsList, docsToSave);
      setShowRegisterWizard(false);
      const shouldLink = window.confirm(
        `Collateral ${colToSave.code} registered and submitted for Checker authorization.\n\nWould you like to link this collateral to credit facilities or other securities now?`
      );
      if (shouldLink) {
        setSelectedCol(colToSave as Collateral);
        setM3LinkToEdit(null);
        setM3LinkModalMode('create');
        setShowM3LinkModal(true);
      }
    } catch (err: any) {
      alert(`Registration failed: ${err.message || err}`);
    } finally {
      setWizardRegistering(false);
    }
  };

  const handleAddLinkSubmit = async () => {
    if (!selectedCol) return;
    if (!linkLoanId) {
      alert('Please select a facility to link.');
      return;
    }
    if (linkAmount <= 0) {
      alert('Link amount must be greater than zero.');
      return;
    }
    setLinkSubmitting(true);
    try {
      await onAddLink(linkLoanId, selectedCol.id, linkAmount, linkLinkageType, linkEffectiveDate, linkEndDate);
      alert('Facility linked successfully.');
      setShowAddLinkModal(false);
      loadExposureSummary(selectedCol.id);
      loadCollateral360(selectedCol.id);
    } catch (e: any) {
      alert(`Failed to link facility: ${e?.message || e}`);
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleVerifyOwnerSubmit = async () => {
    if (!selectedCol || !verifyingOwner) return;
    setVerifySubmitting(true);
    try {
      await cimsApi.verifyCollateralOwner(
        selectedCol.id,
        verifyingOwner.id || '',
        verifyStatus,
        verifyComments,
        currentUser.username || currentUser.name || 'CRO_USER'
      );
      alert(`Owner "${verifyingOwner.name}" marked as ${verifyStatus}.`);
      setShowVerifyOwnerModal(false);
      setVerifyingOwner(null);
      setVerifyComments('');
      await loadCollateral360(selectedCol.id);
    } catch (e: any) {
      alert(`Owner verification failed: ${e?.message || e}`);
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleUploadDocSubmit = async () => {
    if (!selectedCol) return;
    if (!uploadDocName.trim()) {
      alert('Please enter a document title.');
      return;
    }
    setUploadingDoc(true);
    try {
      await cimsApi.uploadDocument('Collateral', selectedCol.id, uploadDocName, uploadDocType, uploadDocExpiry || undefined);
      alert('Document uploaded to DMS successfully (Status: Pending Verification).');
      setShowUploadDocModal(false);
      setUploadDocName('');
      window.location.reload();
    } catch (e: any) {
      alert(`Failed to upload document: ${e?.message || e}`);
    } finally {
      setUploadingDoc(false);
    }
  };

  const filteredCollaterals = useMemo(() => {
    return collaterals.filter((c) => {
      // Subtab filtering
      if (mainSubTab === 'cbaims' && c.originType === 'CBS_IMPORTED') return false;
      if (mainSubTab === 'overview' && filterOrigin === 'CBAIMS_REGISTERED' && c.originType === 'CBS_IMPORTED') return false;
      if (mainSubTab === 'overview' && filterOrigin === 'CBS_IMPORTED' && c.originType !== 'CBS_IMPORTED') return false;

      if (filterRank === '1ST') return c.collateralRank !== '2nd';
      if (filterRank === '2ND_INTERNAL') return c.collateralRank === '2nd' && c.isFirstDegreeInternal;
      if (filterRank === '2ND_EXTERNAL') return c.collateralRank === '2nd' && !c.isFirstDegreeInternal;
      if (filterRank === 'PROMOTION_ELIGIBLE') return Boolean(c.promotionEligible);
      return true;
    });
  }, [collaterals, filterRank, mainSubTab, filterOrigin]);

  useEffect(() => {
    if (filterRank !== 'ALL') return;
    let active = true;
    const timer = setTimeout(async () => {
      setColLoading(true);
      try {
        const originParam = mainSubTab === 'cbaims' ? 'CBAIMS_REGISTERED' : (filterOrigin !== 'ALL' ? filterOrigin : '');
        const segParam = selectedSegment && selectedSegment !== 'ALL' ? selectedSegment : '';
        const res = await cimsApi.getPagedCollaterals(colPage - 1, colPageSize, colSearch, segParam, originParam);
        if (active && res && Array.isArray(res.content)) {
          setPagedCollaterals(res.content);
          setTotalCollaterals(res.totalElements ?? res.content.length);
        }
      } catch (e) {
        if (active) {
          setPagedCollaterals(filteredCollaterals);
          setTotalCollaterals(filteredCollaterals.length);
        }
      } finally {
        if (active) setColLoading(false);
      }
    }, colSearch ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [colPage, colPageSize, colSearch, selectedSegment, mainSubTab, filterOrigin, filterRank, filteredCollaterals]);

  const count1st = collaterals.filter((c) => c.collateralRank !== '2nd').length;
  const count2ndInt = collaterals.filter((c) => c.collateralRank === '2nd' && c.isFirstDegreeInternal).length;
  const count2ndExt = collaterals.filter((c) => c.collateralRank === '2nd' && !c.isFirstDegreeInternal).length;
  const countPromo = collaterals.filter((c) => c.promotionEligible).length;

  return (
    <div className="p-6 space-y-6">
      {/* 4-Screen Navigation Sub-Tabs (Section 4) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setMainSubTab('overview')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
              mainSubTab === 'overview'
                ? 'bg-[#00205B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            1. Collateral Overview
          </button>

          <button
            type="button"
            onClick={() => setMainSubTab('cbaims')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
              mainSubTab === 'cbaims'
                ? 'bg-[#00205B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            2. CBAIMS Registered Collateral
          </button>

          <button
            type="button"
            onClick={() => setMainSubTab('cbs')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
              mainSubTab === 'cbs'
                ? 'bg-[#00205B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Database className="w-4 h-4 text-blue-400" />
            3. CBS Synced Collateral
          </button>

          <button
            type="button"
            onClick={() => setMainSubTab('quality')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold transition-all ${
              mainSubTab === 'quality'
                ? 'bg-[#00205B] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            4. Data Quality & Enrichment
          </button>
        </div>

        {mainSubTab === 'overview' && (
          <div className="flex items-center gap-1.5 text-xs pr-2">
            <span className="font-semibold text-slate-500">Origin Filter:</span>
            <select
              value={filterOrigin}
              onChange={(e) => setFilterOrigin(e.target.value as any)}
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-md font-medium text-slate-700"
            >
              <option value="ALL">All Origins</option>
              <option value="CBAIMS_REGISTERED">CBAIMS Registered</option>
              <option value="CBS_IMPORTED">CBS Imported</option>
            </select>
          </div>
        )}
      </div>

      {mainSubTab === 'cbs' ? (
        <CbsSyncedCollateralView
          currentUser={currentUser}
          onOpenDetail={(col) => {
            setSelectedCol(col);
            setShowDetailModal(true);
            loadExposureSummary(col.id);
            loadCollateral360(col.id);
            loadM3SecuredFacilities(col.id);
            loadAdequacyAssessment(col.id);
          }}
          onOpenEnrichment={(col) => {
            setColToEnrich(col);
            setShowEnrichmentModal(true);
          }}
          onOpenInsurance={(col) => {
            setSelectedCol(col);
            setShowDetailModal(true);
            setActiveTab('policies');
          }}
        />
      ) : mainSubTab === 'quality' ? (
        <DataQualityWorkbench
          currentUser={currentUser}
          facilities={facilities}
          onOpenDetail={(col) => {
            setSelectedCol(col);
            setShowDetailModal(true);
            loadExposureSummary(col.id);
            loadCollateral360(col.id);
          }}
          onOpenEnrichment={(col) => {
            setColToEnrich(col);
            setShowEnrichmentModal(true);
          }}
          onRefreshData={onRefreshData}
        />
      ) : (
        <>
          {/* 1st / 2nd Degree Mortgage Priority Quick Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Mortgage Rank Filter:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterRank('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  filterRank === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Charges ({filteredCollaterals.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterRank('1ST')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  filterRank === '1ST'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                1st Degree ({count1st})
              </button>
              <button
                type="button"
                onClick={() => setFilterRank('2ND_INTERNAL')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  filterRank === '2ND_INTERNAL'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                🔗 2nd Degree (Internal) ({count2ndInt})
              </button>
              <button
                type="button"
                onClick={() => setFilterRank('2ND_EXTERNAL')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  filterRank === '2ND_EXTERNAL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                🏛️ 2nd Degree (External) ({count2ndExt})
              </button>
              {countPromo > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterRank('PROMOTION_ELIGIBLE')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                    filterRank === 'PROMOTION_ELIGIBLE'
                      ? 'bg-emerald-600 text-white shadow-xs animate-none'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 animate-pulse'
                  }`}
                >
                  <span>⚡ Promotion Ready ({countPromo})</span>
                </button>
              )}
            </div>
          </div>

          <DataGrid
            title={mainSubTab === 'cbaims' ? 'CBAIMS Registered Collateral Portfolio' : 'Collateral Master & Securities Overview'}
            subtitle={mainSubTab === 'cbaims' ? 'Manual registration portfolio created and managed in CBAIMS' : 'Manage Consolidated Pledged Assets, First/Second Degree Priorities, Allocations, and CBS Imports'}
            data={filterRank === 'ALL' ? pagedCollaterals : filteredCollaterals}
            columns={collateralColumns}
            keyExtractor={(c) => c.id}
            searchPlaceholder="Search by Collateral Code, Description, or CIF..."
            serverSide={filterRank === 'ALL' ? {
              totalItems: totalCollaterals,
              currentPage: colPage,
              pageSize: colPageSize,
              searchQuery: colSearch,
              loading: colLoading,
              onPageChange: setColPage,
              onPageSizeChange: (sz) => { setColPageSize(sz); setColPage(1); },
              onSearchChange: (q) => { setColSearch(q); setColPage(1); },
            } : undefined}
            onRowClick={(c) => {
              setSelectedCol(c);
              setShowDetailModal(true);
              loadExposureSummary(c.id);
              loadCollateral360(c.id);
              loadM3SecuredFacilities(c.id);
            }}
            actions={
              isMaker ? (
                <button
                  onClick={handleStartWizard}
                  className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Register New Collateral
                </button>
              ) : undefined
            }
          />
        </>
      )}

      {/* Collateral 360 Detail Modal */}
      {showDetailModal && selectedCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-6xl 2xl:max-w-7xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs min-w-0">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex flex-col xl:flex-row xl:items-center justify-between gap-3 min-w-0 shrink-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-bold">
                    {selectedCol.code} — {selectedCol.category}
                  </h2>
                  {colPolicies.length > 0 ? (
                    <button
                      onClick={() => {
                        if (onNavigate) {
                          setShowDetailModal(false);
                          onNavigate('insurance', { policyId: colPolicies[0].id, id: colPolicies[0].id });
                        }
                      }}
                      className="cursor-pointer inline-flex items-center gap-1 group/chip"
                      title="Click to view securing insurance policy"
                    >
                      <StatusChip
                        label={selectedCol.insuranceStatus || selectedCol.status || 'Insured'}
                        variant={(selectedCol.insuranceStatus || '').toLowerCase().includes('fully') ? 'success' : 'warning'}
                      />
                      <ArrowUpRight className="w-3.5 h-3.5 text-blue-300 group-hover/chip:text-white" />
                    </button>
                  ) : (
                    <StatusChip
                      label={selectedCol.insuranceStatus || selectedCol.status || 'Uninsured'}
                      variant={(selectedCol.insuranceStatus || '').toLowerCase().includes('fully') ? 'success' : 'warning'}
                    />
                  )}
                </div>
                <div className="text-xs text-slate-300 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Customer: <strong className="text-white">{customers.find((c) => c.id === selectedCol.customerId || c.cif === selectedCol.customerId)?.name || selectedCol.customerId}</strong>
                  </span>
                  <span>Owning Segment: <strong className="text-white">{selectedCol.owningSegment}</strong></span>
                  <span>Branch: <strong className="text-white">{selectedCol.branch}</strong></span>
                  <span>Currency: <strong className="text-white">{selectedCol.currency || 'ETB'}</strong></span>
                </div>
              </div>

              {/* Action Buttons & Close */}
              <div className="flex items-center gap-2 justify-between xl:justify-end shrink-0 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {isMaker && selectedCol.authStat === 'A' && (
                    <>
                      <button
                        onClick={() => {
                          const firstOwner = selectedCol.owners?.[0];
                          setOwnershipChangeForm({
                            newOwnerName: '',
                            newOwnershipType: 'Third-party-owned',
                            ownerType: 'Individual',
                            idNumber: '',
                            tin: '',
                            phone: '',
                            contactInfo: '',
                            percentage: 100,
                            relationshipToBorrower: '',
                            effectiveDate: new Date().toISOString().substring(0, 10),
                            changeReason: '',
                            supportingDocument: '',
                            remarks: '',
                          });
                          setOwnershipChangeError(null);
                          setShowOwnershipChangeModal(true);
                        }}
                        className="py-1 px-2.5 text-xs text-white font-semibold bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Change Ownership
                      </button>
                      <button
                        onClick={() => {
                          setMaintainFields({
                            valuationAmount: selectedCol.valuationAmount,
                            haircut: selectedCol.haircut,
                            reviewDate: selectedCol.reviewDate,
                          });
                          setMaintainError(null);
                          setShowMaintainModal(true);
                        }}
                        className="py-1 px-2.5 text-xs text-white font-semibold bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Maintain Details
                      </button>
                      <button
                        onClick={() => setShowTransferModal(true)}
                        className="py-1 px-2.5 text-xs text-white font-semibold bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        Transfer Segment
                      </button>
                      <button
                        onClick={handleOpenReleaseModal}
                        disabled={loadingRelease}
                        className="py-1 px-2.5 text-xs text-white font-semibold bg-white/10 hover:bg-white/20 border border-white/30 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        {loadingRelease ? 'Validating…' : 'Release Security'}
                      </button>
                    </>
                  )}
                  {isMaker && (
                    <button
                      type="button"
                      onClick={() => {
                        setM3LinkToEdit(null);
                        setM3LinkModalMode('create');
                        setShowM3LinkModal(true);
                      }}
                      className="btn-primary py-1 px-3 text-xs bg-[#D48806] hover:bg-[#b87405] text-white rounded-lg flex items-center gap-1 font-semibold shadow-xs transition-colors"
                      title="Link credit facility to this collateral"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      + Link Facility
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="text-white hover:text-slate-300 text-lg px-2 py-1 rounded-lg hover:bg-white/10 shrink-0 transition"
                  title="Close 360 View"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 gap-2 pt-2 overflow-x-auto scrollbar-thin shrink-0">
              {(['details', 'exposure', 'adequacy', 'early-release', 'links', 'policies', 'documents', 'exceptions', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2.5 px-3 font-semibold border-b-2 capitalize transition-colors whitespace-nowrap ${
                    activeTab === tab ? 'border-[#D48806] text-[#00205B] font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab === 'details' && 'Overview & Valuation'}
                  {tab === 'exposure' && 'Exposure Metrics'}
                  {tab === 'adequacy' && (
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#00205B]" />
                      Insurance Adequacy (BR-18)
                      {adequacyAssessment && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Adequate'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Over insured'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus}
                        </span>
                      )}
                    </span>
                  )}
                  {tab === 'early-release' && (
                    <span className="flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5 text-purple-700" />
                      Early Release
                      {preReleaseImpact && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          (preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'CAN_PROCEED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'BLOCKED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')}
                        </span>
                      )}
                    </span>
                  )}
                  {tab === 'links' && `Secured Facilities (${m3SecuredSummary?.securedFacilities?.length ?? colLinks.length})`}
                  {tab === 'policies' && `Insurance Coverages (${colPolicies.length})`}
                  {tab === 'documents' && `DMS Documents (${colDocs.length})`}
                  {tab === 'exceptions' && `Exceptions (${colExceptions.length})`}
                  {tab === 'history' && `Audit History (${col360Data?.auditHistory?.length || 0})`}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 min-w-0 max-w-full">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  {/* Promotion Eligibility Alert Banner (Requirement 4) */}
                  {selectedCol.promotionEligible && (
                    <div className="p-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-xl text-white shadow-lg space-y-2 border border-emerald-500/60 animate-fadeIn">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-emerald-400 text-slate-900 shadow-sm animate-pulse flex items-center gap-1">
                            ⚡ PROMOTION ELIGIBLE
                          </span>
                          <span className="text-xs font-semibold text-emerald-200">
                            Preceding first-degree charge has been discharged / closed. Ready for promotion to 1st-Degree Priority.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPromotingCol(selectedCol);
                            setPromoteReviewNotes(selectedCol.promotionReason || 'Formally promote to 1st-degree mortgage priority following discharge of prior charge.');
                            setShowPromoteModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                        >
                          <span>Review &amp; Promote to 1st Degree</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-100">
                        {selectedCol.promotionReason || 'The internal first-degree collateral charge was released or settled. Subordinate charge is qualified for immediate rank elevation upon management signoff.'}
                      </p>
                    </div>
                  )}

                  {/* Mortgage Priority & Degree Information Card (Requirement 4) */}
                  <div className="cims-card p-4 space-y-3 bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 border border-indigo-100">
                    <div className="flex flex-wrap items-center justify-between border-b border-indigo-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-700" />
                        <h4 className="font-bold text-[#101828] text-sm">
                          Mortgage Charge Priority &amp; Ranking Structure
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                          selectedCol.collateralRank === '2nd'
                            ? selectedCol.isFirstDegreeInternal
                              ? 'bg-purple-100 text-purple-900 border-purple-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-blue-100 text-blue-900 border-blue-300'
                        }`}>
                          {selectedCol.collateralRank === '2nd'
                            ? selectedCol.isFirstDegreeInternal
                              ? '🔗 2nd-Degree (Internal Dashen Bank Charge)'
                              : '🏛️ 2nd-Degree (External Financial Institution)'
                            : 'Primary 1st-Degree Mortgage'}
                        </span>
                        {selectedCol.collateralRank === '2nd' && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (selectedCol.isFirstDegreeInternal) {
                                try {
                                  const userId = currentUser?.username || currentUser?.name || 'CRO_OFFICER';
                                  await cimsApi.refreshFirstDegreeBalance(selectedCol.id, undefined, undefined, userId);
                                  alert(`✓ 1st-Degree CBS Loan Balance refreshed successfully for ${selectedCol.code}!`);
                                  loadExposureSummary(selectedCol.id);
                                  loadCollateral360(selectedCol.id);
                                  onRefreshData?.();
                                } catch (err: any) {
                                  alert(`CBS balance refresh failed: ${err.message || err}`);
                                }
                              } else {
                                setRefreshingCol(selectedCol);
                                setRefreshBalAmt(selectedCol.firstDegreeOutstandingBalance || 0);
                                setRefreshAsOfDate(selectedCol.firstDegreeBalanceAsOfDate || new Date().toISOString().substring(0, 10));
                                setShowRefreshBalModal(true);
                              }
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                            title="Refresh first-degree loan balance"
                          >
                            <span>🔄 Refresh Balance</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {selectedCol.collateralRank === '2nd' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div className="p-2.5 bg-white rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block">1st-Degree Holder</span>
                            <strong className="text-slate-900 font-bold block mt-0.5">
                              {selectedCol.firstDegreeHolderName || (selectedCol.isFirstDegreeInternal ? 'Dashen Bank S.C.' : '—')}
                            </strong>
                            <span className="text-[10px] text-indigo-600">
                              {selectedCol.isFirstDegreeInternal ? 'Internal CBAIMS Record' : 'External Institution'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block">1st-Degree Facility Ref</span>
                            <strong className="text-slate-900 font-mono block mt-0.5">
                              {selectedCol.firstDegreeFacilityRef || (selectedCol.firstDegreeCollateralId ? `Parent: ${selectedCol.firstDegreeCollateralId}` : '—')}
                            </strong>
                            <span className="text-[10px] text-slate-500">Credit Reference</span>
                          </div>

                          <div className="p-2.5 bg-white rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block">1st-Degree Loan Balance</span>
                            <strong className="text-rose-700 font-bold block mt-0.5 tabular-nums">
                              ETB {(selectedCol.firstDegreeOutstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                            <span className="text-[10px] text-slate-500">
                              As of: {selectedCol.firstDegreeBalanceAsOfDate || '—'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Registered Mortgage</span>
                            <strong className="text-slate-900 font-bold block mt-0.5 tabular-nums">
                              ETB {(selectedCol.registeredMortgageAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Reg #{selectedCol.mortgageRegistrationNumber || '—'}
                            </span>
                          </div>
                        </div>

                        {/* Combined Exposure Metric Bar vs Valuation */}
                        {(() => {
                          const firstBal = selectedCol.firstDegreeOutstandingBalance || 0;
                          const secondBal = selectedCol.currentAllocation || 0;
                          const combined = firstBal + secondBal;
                          const val = selectedCol.valuationAmount || 0;
                          const isOver = combined > val;
                          const excess = isOver ? combined - val : 0;
                          return (
                            <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                              isOver ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}>
                              <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1.5">
                                  {isOver ? (
                                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                                  )}
                                  Combined Exposure vs Bank-Assessed Valuation
                                </span>
                                <span>
                                  Combined: ETB {combined.toLocaleString()} / Valuation: ETB {val.toLocaleString()}
                                </span>
                              </div>

                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                                <div
                                  className="bg-purple-600 h-2"
                                  style={{ width: `${Math.min(100, val > 0 ? (firstBal / val) * 100 : 0)}%` }}
                                  title={`1st Degree: ETB ${firstBal.toLocaleString()}`}
                                />
                                <div
                                  className="bg-blue-600 h-2"
                                  style={{ width: `${Math.min(100, val > 0 ? (secondBal / val) * 100 : 0)}%` }}
                                  title={`2nd Degree: ETB ${secondBal.toLocaleString()}`}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-600">
                                <span>🟣 1st Degree: ETB {firstBal.toLocaleString()}</span>
                                <span>🔵 2nd Degree: ETB {secondBal.toLocaleString()}</span>
                                <span className="font-bold">Total: ETB {combined.toLocaleString()}</span>
                              </div>

                              {isOver && (
                                <div className="p-2 bg-amber-100/90 rounded border border-amber-300 font-semibold text-amber-900 text-[11px]">
                                  ⚠️ WARNING: Combined exposure of ETB {combined.toLocaleString()} exceeds the Bank-assessed valuation of ETB {val.toLocaleString()} by ETB {excess.toLocaleString()}. Excess exposure warning is flagged for credit monitoring.
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* First-Degree Insurance Status & Second Mortgagee Endorsement */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">1st-Degree Policy No:</span>
                            <strong className="font-mono">{selectedCol.firstDegreePolicyNumber || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Insurer Name:</span>
                            <strong>{selectedCol.firstDegreeInsurer || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Policy Expiry:</span>
                            <strong>{selectedCol.firstDegreePolicyExpiry || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Second Mortgagee Endorsement:</span>
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              selectedCol.bankNotedAsSecondMortgagee ? 'text-emerald-700' : 'text-amber-700'
                            }`}>
                              {selectedCol.bankNotedAsSecondMortgagee ? '✓ Noted on Policy' : '⚠️ Not Formally Noted'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-950 flex items-center justify-between">
                        <div>
                          <strong>Primary 1st-Degree Mortgage Charge:</strong> Dashen Bank holds senior first-ranking mortgage priority over this collateral asset with direct enforcement rights.
                        </div>
                        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
                      </div>
                    )}
                  </div>

                  {/* Section 58 Third-Party Collateral Compliance Banner */}
                  {selectedCol.ownerType === 'Third-party-owned' && (() => {
                    const activeOwners = (col360Data?.activeOwners && col360Data.activeOwners.length > 0)
                      ? col360Data.activeOwners
                      : (selectedCol.owners || []).filter(o => !o.supersededDate && o.status !== 'Historical');
                    const hasPledgeDoc = colDocs.some(d => {
                      const t = (d.type || d.name || '').toLowerCase();
                      return t.includes('pledge') || t.includes('third-party consent');
                    });
                    const hasConsentDoc = colDocs.some(d => {
                      const t = (d.type || d.name || '').toLowerCase();
                      return t.includes('consent');
                    });
                    const isFullyCompliant = activeOwners.length > 0 &&
                      activeOwners.every(o => (o.idNumber || o.businessRegNo || o.tin) && o.relationshipToBorrower) &&
                      (hasPledgeDoc || hasConsentDoc);

                    return (
                      <div className="p-4 rounded-lg border border-purple-300 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 text-purple-950 space-y-3 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-purple-700 flex-shrink-0" />
                            <div>
                              <h5 className="font-bold text-sm text-purple-900 flex items-center gap-2">
                                Section 58 Third-Party Pledged Collateral Notice
                                {isFullyCompliant ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    Legally Compliant
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                    Action Required
                                  </span>
                                )}
                              </h5>
                              <p className="text-xs text-purple-800 mt-0.5">
                                This asset is pledged by a third-party legal owner to secure credit facility obligations of borrower <strong>{customers.find(c => c.id === selectedCol.customerId || c.cif === selectedCol.customerId)?.name || selectedCol.customerId}</strong> under Commercial Code / Banking Directives (Section 58).
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-purple-200/80 text-purple-900 rounded font-mono">
                            Section 58 Pledge
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                          <div className="p-2.5 bg-white/80 rounded border border-purple-200 space-y-1">
                            <span className="text-[10px] font-bold text-purple-700 uppercase block">Legal Owner(s)</span>
                            {activeOwners.length > 0 ? (
                              activeOwners.map((o, idx) => (
                                <div key={idx} className="font-medium text-slate-900">
                                  <strong>{o.name}</strong> ({o.percentage ?? 100}%)
                                  <div className="text-[11px] text-slate-600">
                                    Relationship: <span className="font-semibold text-purple-800">{o.relationshipToBorrower || o.relationship || 'Unspecified'}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-amber-800 font-semibold text-xs">⚠️ No legal owners registered</div>
                            )}
                          </div>

                          <div className="p-2.5 bg-white/80 rounded border border-purple-200 space-y-1">
                            <span className="text-[10px] font-bold text-purple-700 uppercase block">Owner Identity Verification</span>
                            {activeOwners.map((o, idx) => (
                              <div key={idx} className="text-slate-800">
                                <div>ID / Reg: <span className="font-mono font-semibold">{o.businessRegNo || o.idNumber || '—'}</span></div>
                                <div>TIN: <span className="font-mono">{o.tin || '—'}</span></div>
                              </div>
                            ))}
                          </div>

                          <div className="p-2.5 bg-white/80 rounded border border-purple-200 space-y-1">
                            <span className="text-[10px] font-bold text-purple-700 uppercase block">Statutory Documentation</span>
                            <div className="flex items-center gap-1.5">
                              {hasPledgeDoc ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              )}
                              <span>Third-Party Consent & Pledge Agmt</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {hasConsentDoc ? (
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              )}
                              <span>Letter of Consent</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-w-0">
                    <div className="cims-card p-4 space-y-2">
                      <h4 className="font-bold text-[#101828] border-b border-[#E2E8F0] pb-1 flex items-center justify-between">
                        <span>Valuation & Security</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">Regulatory Standard</span>
                      </h4>
                      <div>
                        <span className="text-slate-500">Collateral Value (Market):</span>{' '}
                        <strong className="text-[#00205B] tabular-nums">{selectedCol.currency || 'ETB'} {selectedCol.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Haircut Applied:</span>{' '}
                        <strong className="text-amber-800">{selectedCol.haircut ?? 20}%</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Net Security Value (NSV):</span>{' '}
                        <strong className="text-emerald-700 tabular-nums">
                          {selectedCol.currency || 'ETB'} {(selectedCol.nsv ?? ((selectedCol.valuationAmount || 0) * (1.0 - ((selectedCol.haircut || 0) / 100.0)))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded p-2 text-[11px] text-emerald-900">
                        <div className="flex items-center gap-1 font-semibold text-emerald-800">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          NSV Formula: Value × (1 - Haircut%)
                        </div>
                        <div className="font-mono text-[10px] text-emerald-700 mt-0.5">
                          ETB {selectedCol.valuationAmount?.toLocaleString()} × (1 - {selectedCol.haircut ?? 20}%) = <strong>ETB {(selectedCol.nsv ?? ((selectedCol.valuationAmount || 0) * (1.0 - ((selectedCol.haircut || 0) / 100.0)))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Total Allocated Amount:</span>{' '}
                        <strong className="text-blue-800 tabular-nums">{selectedCol.currency || 'ETB'} {(col360Data?.totalAllocatedAmount ?? selectedCol.currentAllocation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Remaining Capacity:</span>{' '}
                        <strong className="text-indigo-800 tabular-nums">{selectedCol.currency || 'ETB'} {(col360Data?.remainingCollateralCapacity ?? Math.max(0, (selectedCol.nsv ?? ((selectedCol.valuationAmount || 0) * 0.8)) - (selectedCol.currentAllocation || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Capacity Utilization:</span>{' '}
                        <strong className="tabular-nums">{(selectedCol.utilizationPercentage || 0).toFixed(1)}%</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Valuation Method:</span>{' '}
                        <strong className="text-[#00205B]">{selectedCol.valuationMethod || 'Certified Independent Appraisal'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500">Valuation Date:</span>{' '}
                        <strong className="text-[#00205B]">{selectedCol.valuationDate || selectedCol.startDate || '—'}</strong>
                      </div>
                    </div>

                    <div className="cims-card p-4 space-y-2">
                      <h4 className="font-bold text-[#101828] border-b border-[#E2E8F0] pb-1 flex items-center justify-between">
                        <span>Asset Metadata & Taxonomy</span>
                        <span className="text-[10px] font-mono text-[#5B6472]">{selectedCol.code}</span>
                      </h4>
                      <div>
                        <span className="text-[#5B6472]">Borrower / Customer:</span>{' '}
                        <strong className="text-[#101828]">{customers.find(c => c.id === selectedCol.customerId || c.cif === selectedCol.customerId)?.name || selectedCol.customerId}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Description:</span> <strong>{selectedCol.description || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Collateral Category:</span> <strong>{selectedCol.category}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Collateral Type:</span> <strong>{selectedCol.type || selectedCol.category}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Ownership Type:</span>{' '}
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-900 border border-blue-200">
                          {selectedCol.ownerType}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Charge Type:</span>{' '}
                        <strong>{col360Data?.collateral?.chargeType || selectedCol.chargeType || 'Mortgage / Fixed Charge'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Tangible Property:</span>{' '}
                        <strong>{selectedCol.tangible !== false ? 'Yes (Tangible Asset)' : 'No (Intangible/Financial)'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Secured Status:</span>{' '}
                        <strong>{selectedCol.secured !== false ? 'Secured' : 'Unsecured / Unpledged'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Source System:</span>{' '}
                        <span className="font-mono text-[#00205B] font-semibold">{selectedCol.sourceSystem || 'CBS / T24 Core'}</span>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">CBS Last Updated:</span>{' '}
                        <span className="font-mono text-[#5B6472] text-[11px]">{col360Data?.collateral?.cbsLastUpdated || selectedCol.cbsLastUpdated || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Owning Segment / Branch:</span> <strong>{selectedCol.owningSegment} / {selectedCol.branch}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Start Date / Review:</span> <strong>{selectedCol.startDate || '—'} / {selectedCol.reviewDate || '—'}</strong>
                      </div>
                      {selectedCol.gpsCoordinates && (
                        <div>
                          <span className="text-[#5B6472]">GPS Coordinates:</span> <strong>{selectedCol.gpsCoordinates}</strong>
                        </div>
                      )}
                    </div>

                    <div className="cims-card p-4 space-y-2">
                      <h4 className="font-bold text-[#101828] border-b border-[#E2E8F0] pb-1">Insurance & Governance</h4>
                      <div>
                        <span className="text-[#5B6472]">Insured Amount:</span>{' '}
                        <strong className="text-emerald-700 tabular-nums">{selectedCol.currency || 'ETB'} {(selectedCol.insuredAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        <div className="text-[10px] text-[#5B6472] italic">(Directly maintained baseline; synchronized with active policies)</div>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Insurance Status:</span> <strong>{selectedCol.insuranceStatus || 'Uninsured'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Maker:</span> <strong>{selectedCol.makerId || 'CRO_USER'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Creation Date:</span> <strong>{selectedCol.makerDtStamp?.substring(0, 10) || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Checker:</span> <strong>{selectedCol.checkerId || 'Pending'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Auth Status:</span> <strong>{selectedCol.authStat === 'A' ? 'Authorized' : 'Pending Authorization'}</strong>
                      </div>
                      <div>
                        <span className="text-[#5B6472]">Verification Status:</span> <strong>{selectedCol.verificationStatus || 'Recorded'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Collateral Legal Owners Breakdown & History */}
                  <div className="cims-card p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                      <div>
                        <h4 className="font-bold text-[#101828]">Legal Ownership & Verification Records</h4>
                        <p className="text-[11px] text-[#5B6472]">Multi-owner breakdown, joint percentage distribution (summing to 100%), and non-destructive ownership history.</p>
                      </div>
                      {isMaker && selectedCol.authStat === 'A' && (
                        <button
                          onClick={() => {
                            setOwnershipChangeForm({
                              newOwnerName: '',
                              newOwnershipType: 'Third-party-owned',
                              ownerType: 'Individual',
                              idNumber: '',
                              tin: '',
                              phone: '',
                              contactInfo: '',
                              percentage: 100,
                              relationshipToBorrower: '',
                              effectiveDate: new Date().toISOString().substring(0, 10),
                              changeReason: '',
                              supportingDocument: '',
                              remarks: '',
                            });
                            setOwnershipChangeError(null);
                            setShowOwnershipChangeModal(true);
                          }}
                          className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-[#00205B]" />
                          Initiate Ownership Change
                        </button>
                      )}
                    </div>

                    {(() => {
                      const displayOwners: CollateralOwner[] = (col360Data?.activeOwners && col360Data.activeOwners.length > 0)
                        ? [...col360Data.activeOwners, ...(col360Data.historicalOwners || [])]
                        : (selectedCol.owners || []);

                      if (displayOwners.length === 0) {
                        return (
                          <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded text-slate-600 text-xs">
                            No distinct owner records attached. Primary registered owner is <strong>{customers.find(c => c.id === selectedCol.customerId || c.cif === selectedCol.customerId)?.name || selectedCol.customerId}</strong> (100.0% Borrower-owned).
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                          <table className="w-full text-left text-xs min-w-[850px]">
                            <thead className="bg-slate-50 text-[#5B6472] border-b border-[#E2E8F0]">
                              <tr>
                                <th className="p-2">Owner Name</th>
                                <th className="p-2">Ownership Type</th>
                                <th className="p-2">Relationship</th>
                                <th className="p-2">ID / Reg No</th>
                                <th className="p-2">TIN</th>
                                <th className="p-2">Contact Phone</th>
                                <th className="p-2">Contact Address</th>
                                <th className="p-2 text-right">Share %</th>
                                <th className="p-2">Verification Details</th>
                                <th className="p-2">Record Status</th>
                                <th className="p-2 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0]">
                              {displayOwners.map((owner, idx) => {
                                const isSuperseded = !!owner.supersededDate || owner.status === 'Historical';
                                const isVerified = owner.verificationStatus === 'Verified';
                                return (
                                  <tr key={owner.id || idx} className={isSuperseded ? 'bg-slate-100/70 text-slate-500' : 'hover:bg-slate-50'}>
                                    <td className="p-2 font-bold text-[#101828]">
                                      {owner.name}
                                      {isSuperseded && <span className="ml-1.5 text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded font-normal">Historical</span>}
                                    </td>
                                    <td className="p-2">{owner.ownershipType || owner.ownerType || selectedCol.ownerType}</td>
                                    <td className="p-2">{owner.relationshipToBorrower || owner.relationship || 'Borrower'}</td>
                                    <td className="p-2 font-mono">{owner.businessRegNo || owner.idNumber || '—'}</td>
                                    <td className="p-2 font-mono">{owner.tin || '—'}</td>
                                    <td className="p-2">{owner.phone || '—'}</td>
                                    <td className="p-2">{owner.contactInfo || '—'}</td>
                                    <td className="p-2 text-right font-bold tabular-nums text-emerald-700">{owner.percentage ?? owner.ownershipPercentage}%</td>
                                    <td className="p-2">
                                      <div className="text-[11px]">
                                        <span className={`inline-block px-1.5 py-0.2 rounded font-semibold ${isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                          {owner.verificationStatus || 'Pending Verification'}
                                        </span>
                                        {owner.verificationDate && <span className="text-[#5B6472]"> ({owner.verificationDate})</span>}
                                        {owner.verifyingOfficer && <div className="text-[#5B6472] text-[10px]">Officer: {owner.verifyingOfficer}</div>}
                                        {owner.remarks && <div className="text-slate-500 text-[10px] italic">"{owner.remarks}"</div>}
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      {isSuperseded ? (
                                        <div className="text-[10px] text-amber-700 font-semibold">
                                          <div>Superseded: {owner.supersededDate || owner.effectiveTo || 'Historical'}</div>
                                          {owner.transferReason && <div className="text-slate-500 font-normal italic">{owner.transferReason}</div>}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-emerald-700 font-semibold">Active Owner</span>
                                      )}
                                    </td>
                                    <td className="p-2 text-right">
                                      {!isSuperseded && !isVerified && (
                                        <button
                                          onClick={() => {
                                            setVerifyingOwner(owner);
                                            setVerifyStatus('Verified');
                                            setVerifyComments('');
                                            setShowVerifyOwnerModal(true);
                                          }}
                                          className="btn-ghost py-0.5 px-2 text-[10px] text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-300 rounded inline-flex items-center gap-1 font-semibold"
                                        >
                                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Verify
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'exposure' && (
                <div>
                  {loadingExposure ? (
                    <div className="p-8 text-center text-[#5B6472]">Computing exposure & adequacy metrics…</div>
                  ) : exposureSummary ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs">
                          <div className="text-[11px] text-[#00205B] font-semibold uppercase">Total Outstanding Exposure</div>
                          <div className="text-base font-bold text-[#00205B] mt-1 tabular-nums">
                            ETB {exposureSummary.totalOutstandingExposure?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="cims-card p-4 bg-emerald-50 border-emerald-100">
                          <div className="text-[11px] text-emerald-700 font-semibold uppercase">Total Active Insurance</div>
                          <div className="text-base font-bold text-emerald-900 mt-1 tabular-nums">
                            ETB {exposureSummary.currentInsuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="cims-card p-4 bg-blue-50 border-blue-100">
                          <div className="text-[11px] text-blue-700 font-semibold uppercase">Required Insurance (Max[Exp, Val])</div>
                          <div className="text-base font-bold text-blue-900 mt-1 tabular-nums">
                            ETB {exposureSummary.requiredInsuranceAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="cims-card p-4 bg-purple-50 border-purple-100 flex items-center justify-between">
                          <div>
                            <div className="text-[11px] text-purple-700 font-semibold uppercase">Adequacy Coverage</div>
                            <div className="text-base font-bold text-purple-900 mt-1 tabular-nums">
                              {(exposureSummary.requiredInsuranceAmount > 0
                                ? (exposureSummary.currentInsuredAmount / exposureSummary.requiredInsuranceAmount) * 100
                                : exposureSummary.currentInsuredAmount > 0
                                ? 100
                                : 0
                              ).toFixed(1)}
                              %
                            </div>
                          </div>
                          <CircularProgress
                            value={Math.min(
                              100,
                              exposureSummary.requiredInsuranceAmount > 0
                                ? (exposureSummary.currentInsuredAmount / exposureSummary.requiredInsuranceAmount) * 100
                                : exposureSummary.currentInsuredAmount > 0
                                ? 100
                                : 0
                            )}
                            size={48}
                            strokeWidth={5}
                          />
                        </div>
                      </div>

                      {/* 1st / 2nd Degree Combined Exposure & Valuation Check (Requirement 4) */}
                      {(selectedCol.collateralRank === '2nd' || exposureSummary.collateralRank === '2nd') && (() => {
                        const firstBal = exposureSummary.firstDegreeOutstandingBalance ?? (selectedCol.firstDegreeOutstandingBalance || 0);
                        const secondBal = exposureSummary.secondDegreeExposure ?? (selectedCol.currentAllocation || 0);
                        const combined = exposureSummary.combinedExposure ?? (firstBal + secondBal);
                        const val = exposureSummary.collateralMarketValue ?? (selectedCol.valuationAmount || 0);
                        const isExceeded = exposureSummary.exposureWarning || combined > val;
                        const excess = Math.max(0, combined - val);

                        return (
                          <div className={`p-4 rounded-xl border space-y-3 ${
                            isExceeded ? 'bg-amber-50/80 border-amber-300' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between border-b border-black/10 pb-2">
                              <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-purple-700" />
                                <span className="font-bold text-xs uppercase tracking-wide text-slate-800">
                                  Subordinate Charge: 1st + 2nd Degree Combined Exposure Assessment
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isExceeded ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isExceeded ? '⚠️ Cap Exceeded (Warning Raised)' : '✓ Within Valuation Cap'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div className="p-2.5 bg-white rounded border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold block">1st-Degree Debt</span>
                                <strong className="text-purple-900 font-bold block mt-0.5 tabular-nums">
                                  ETB {firstBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </strong>
                                <span className="text-[10px] text-slate-500">Prior Charge Holder</span>
                              </div>

                              <div className="p-2.5 bg-white rounded border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold block">2nd-Degree Bank Debt</span>
                                <strong className="text-blue-900 font-bold block mt-0.5 tabular-nums">
                                  ETB {secondBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </strong>
                                <span className="text-[10px] text-slate-500">Dashen Bank Allocations</span>
                              </div>

                              <div className="p-2.5 bg-white rounded border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Combined Exposure</span>
                                <strong className="text-slate-900 font-black block mt-0.5 tabular-nums text-sm">
                                  ETB {combined.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </strong>
                                <span className="text-[10px] text-slate-500">Total Asset Liability</span>
                              </div>

                              <div className="p-2.5 bg-white rounded border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Bank-Assessed Valuation</span>
                                <strong className="text-emerald-800 font-bold block mt-0.5 tabular-nums">
                                  ETB {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </strong>
                                <span className="text-[10px] text-slate-500">Valuation Cap</span>
                              </div>
                            </div>

                            {/* Visual Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-slate-600">
                                <span>Combined Debt vs Valuation Cap</span>
                                <span className="font-bold">{val > 0 ? ((combined / val) * 100).toFixed(1) : 0}% of Valuation</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden flex">
                                <div
                                  className="bg-purple-600 h-2.5"
                                  style={{ width: `${Math.min(100, val > 0 ? (firstBal / val) * 100 : 0)}%` }}
                                  title={`1st Degree: ETB ${firstBal.toLocaleString()}`}
                                />
                                <div
                                  className={`${isExceeded ? 'bg-amber-500' : 'bg-blue-600'} h-2.5`}
                                  style={{ width: `${Math.min(100 - (val > 0 ? (firstBal / val) * 100 : 0), val > 0 ? (secondBal / val) * 100 : 0)}%` }}
                                  title={`2nd Degree: ETB ${secondBal.toLocaleString()}`}
                                />
                              </div>
                            </div>

                            {isExceeded && (
                              <div className="p-2.5 bg-amber-100 rounded-lg border border-amber-300 text-xs font-semibold text-amber-900 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <div>
                                  <strong>VALUATION CAP WARNING (Requirement 4):</strong> Combined exposure of ETB {combined.toLocaleString()} exceeds the Bank-assessed valuation of ETB {val.toLocaleString()} by ETB {excess.toLocaleString()}. Credit exposure warning raised for Credit Committee review.
                                </div>
                              </div>
                            )}

                            {exposureSummary.currentInsuredAmount < combined && (
                              <div className="p-2.5 bg-blue-100 rounded-lg border border-blue-300 text-xs font-semibold text-blue-900 flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                                <div>
                                  <strong>INSURANCE COMBINED ADEQUACY CHECK:</strong> Active insured amount of ETB {exposureSummary.currentInsuredAmount.toLocaleString()} is below the combined exposure of ETB {combined.toLocaleString()} (Deficit: ETB {(combined - exposureSummary.currentInsuredAmount).toLocaleString()}). Insurance coverage must adequately test against combined priority debt.
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-[#5B6472]">Exposure breakdown not available.</div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB: INSURANCE ADEQUACY ENGINE (BR-18, BR-03, BR-11)
                  ========================================================================= */}
              {activeTab === 'adequacy' && (
                <div className="space-y-4">
                  {/* Header & Status Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-[#00205B]" />
                        <h4 className="font-bold text-[#101828] text-sm">
                          Credit Policy Insurance Coverage Adequacy Determination (BR-18)
                        </h4>
                      </div>
                      <p className="text-[11px] text-[#5B6472] mt-0.5">
                        Authoritative evaluation comparing active insured amount against Bank-assessed insurable structure value (Primary) and aggregate secured exposure (Secondary).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (selectedCol) {
                            await loadAdequacyAssessment(selectedCol.id);
                          }
                        }}
                        disabled={loadingAdequacy}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                        title="Recompute adequacy based on active policies and Credit Policy rules"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingAdequacy ? 'animate-spin' : ''}`} />
                        Recalculate Adequacy
                      </button>

                      <button
                        onClick={() => {
                          setAdequacyExceptionForm({
                            exceptionType: 'Underinsured Approved Exception',
                            reason: '',
                            approvedExceptionAmount: adequacyAssessment ? Math.max(0, adequacyAssessment.requiredCoverageAmount - adequacyAssessment.totalInsuredAmount) : 0,
                            validityMonths: 6,
                            reviewDate: new Date(Date.now() + 180 * 86400000).toISOString().substring(0, 10),
                            supportingDocRef: '',
                          });
                          setShowAdequacyExceptionModal(true);
                        }}
                        className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Request Exception (BR-07 / BR-12)
                      </button>
                    </div>
                  </div>

                  {loadingAdequacy ? (
                    <div className="p-8 text-center text-[#5B6472]">Evaluating Credit Policy adequacy metrics…</div>
                  ) : adequacyAssessment ? (
                    <div className="space-y-4">
                      {/* Overall Status Banner */}
                      <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                        (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Adequate'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Over insured'
                          ? 'bg-blue-50 border-blue-300 text-blue-950'
                          : (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Underinsured'
                          ? 'bg-red-50 border-red-300 text-red-950'
                          : 'bg-slate-100 border-slate-300 text-slate-900'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                            (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Adequate'
                              ? 'bg-emerald-600 text-white'
                              : (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Over insured'
                              ? 'bg-blue-600 text-white'
                              : (adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Underinsured'
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-700 text-white'
                          }`}>
                            {adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus}
                          </span>
                          <div>
                            <strong className="block text-xs font-bold">
                              {(adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Adequate' && 'Collateral meets all Credit Policy coverage rules and aggregate facility exposure.'}
                              {(adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Over insured' && 'Total active sum insured exceeds required coverage by more than the configured tolerance.'}
                              {(adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Underinsured' && 'Active insurance sum insured is below the Credit Policy required coverage for the insurable structure.'}
                              {(adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Uninsured' && 'No qualifying active insurance policy found covering this collateral master record.'}
                              {(adequacyAssessment.overallAdequacyStatus || adequacyAssessment.adequacyStatus) === 'Missing Policy' && 'Insurance policy is required by Credit Policy but none is currently registered.'}
                            </strong>
                            <span className="text-[11px] opacity-80 block">
                              Applicable Rule: <strong>{adequacyAssessment.applicableRuleDescription || adequacyAssessment.applicableRuleCode || adequacyAssessment.applicableRuleId || 'Standard Default'}</strong> — Required Coverage: <strong>{adequacyAssessment.requiredCoveragePercentage ?? adequacyAssessment.requiredCoveragePct ?? 100}%</strong> of Insurable Value.
                            </span>
                          </div>
                        </div>

                        {/* Informational Over-Insurance Banner Note */}
                        {adequacyAssessment.isOverInsured && (
                          <div className="text-[11px] font-semibold text-blue-800 bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-300 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Informational Flag: Over-insurance does NOT block loan processing, disbursement, or release.</span>
                          </div>
                        )}
                      </div>

                      {/* Warnings if data missing */}
                      {(adequacyAssessment.missingDataWarnings || adequacyAssessment.dataWarnings) && (adequacyAssessment.missingDataWarnings || adequacyAssessment.dataWarnings)!.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1 text-xs text-amber-900">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Data Prerequisite &amp; Credit Policy Alerts:
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-2 text-amber-800">
                            {(adequacyAssessment.missingDataWarnings || adequacyAssessment.dataWarnings)!.map((w: string, idx: number) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 4 Core Metric KPI Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs">
                          <span className="text-[10px] text-[#00205B] font-bold uppercase block">
                            Bank-Assessed Insurable Value
                          </span>
                          <div className="text-base font-extrabold text-[#00205B] mt-1 tabular-nums">
                            ETB {Number(adequacyAssessment.bankAssessedInsurableValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            Structure Only {adequacyAssessment.landValue ? `(Land ETB ${Number(adequacyAssessment.landValue).toLocaleString()} excluded)` : ''}
                          </span>
                        </div>

                        <div className="cims-card p-4 bg-purple-50 border-purple-200">
                          <span className="text-[10px] text-purple-700 font-bold uppercase block">
                            Required Coverage ({adequacyAssessment.requiredCoveragePercentage ?? adequacyAssessment.requiredCoveragePct ?? 100}%)
                          </span>
                          <div className="text-base font-extrabold text-purple-900 mt-1 tabular-nums">
                            ETB {Number(adequacyAssessment.requiredCoverageAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[10px] text-purple-600 block mt-0.5">
                            Credit Policy Rule: {adequacyAssessment.applicableRuleDescription || adequacyAssessment.applicableRuleCode || adequacyAssessment.applicableRuleId || 'BR-18 Standard'}
                          </span>
                        </div>

                        <div className="cims-card p-4 bg-emerald-50 border-emerald-200">
                          <span className="text-[10px] text-emerald-700 font-bold uppercase block">
                            Total Active Insured Amount
                          </span>
                          <div className="text-base font-extrabold text-emerald-900 mt-1 tabular-nums">
                            ETB {Number(adequacyAssessment.totalInsuredAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[10px] text-emerald-600 block mt-0.5">
                            Aggregated from {(adequacyAssessment.contributingPolicies || adequacyAssessment.activePolicies)?.length || 0} active policy records
                          </span>
                        </div>

                        <div className="cims-card p-4 bg-blue-50 border-blue-200">
                          <span className="text-[10px] text-blue-700 font-bold uppercase block">
                            Aggregate Secured Exposure
                          </span>
                          <div className="text-base font-extrabold text-blue-900 mt-1 tabular-nums">
                            ETB {Number(adequacyAssessment.aggregateSecuredExposure || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <span className="text-[10px] text-blue-600 block mt-0.5">
                            Deduplicated across {(adequacyAssessment.contributingFacilities || adequacyAssessment.distinctFacilities)?.length || 0} distinct facilities
                          </span>
                        </div>
                      </div>

                      {/* Primary Test vs Secondary Test Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Primary Test Card */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 border-l-4 border-l-[#00205B] shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                              <strong className="block text-xs font-bold text-[#00205B]">
                                Primary Test: Bank-Assessed Insurable Value (BR-18)
                              </strong>
                              <span className="text-[10px] text-slate-500">
                                Compares Total Insured vs Insurable Structure Value × Rule Coverage %
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (adequacyAssessment.primaryTestPassed ?? adequacyAssessment.isPrimaryPass) ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {adequacyAssessment.primaryTestStatus || adequacyAssessment.primaryTestResult}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-500">Insurable Structure Value:</span>
                              <strong className="tabular-nums">ETB {Number(adequacyAssessment.bankAssessedInsurableValue || 0).toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-500">Required Coverage %:</span>
                              <strong>{adequacyAssessment.requiredCoveragePercentage ?? adequacyAssessment.requiredCoveragePct ?? 100}%</strong>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-500">Required Insured Amount:</span>
                              <strong className="text-purple-900 tabular-nums">ETB {Number(adequacyAssessment.requiredCoverageAmount || 0).toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-500">Total Active Insured Amount:</span>
                              <strong className="text-emerald-900 tabular-nums">ETB {Number(adequacyAssessment.totalInsuredAmount || 0).toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between py-1 font-bold">
                              <span>Primary Coverage Ratio:</span>
                              <span className={`tabular-nums text-sm ${(adequacyAssessment.primaryTestPassed ?? adequacyAssessment.isPrimaryPass) ? 'text-emerald-700' : 'text-red-700'}`}>
                                {adequacyAssessment.primaryCoverageRatio != null ? `${adequacyAssessment.primaryCoverageRatio.toFixed(1)}%` : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Secondary Test Card */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 border-l-4 border-l-blue-600 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                              <strong className="block text-xs font-bold text-[#00205B]">
                                Secondary Test: Aggregate Outstanding Exposure (BR-03 / BR-11)
                              </strong>
                              <span className="text-[10px] text-[#5B6472]">
                                Compares Total Insured vs Aggregate Balances of All Distinct Facilities
                              </span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (adequacyAssessment.secondaryTestPassed ?? adequacyAssessment.isSecondaryPass) ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {adequacyAssessment.secondaryTestStatus || adequacyAssessment.secondaryTestResult}
                            </span>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-500">Distinct Linked Facilities:</span>
                              <strong>{(adequacyAssessment.contributingFacilities || adequacyAssessment.distinctFacilities)?.length || 0} Facilities</strong>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-500">Aggregate Secured Exposure:</span>
                              <strong className="text-blue-900 tabular-nums">ETB {Number(adequacyAssessment.aggregateSecuredExposure || 0).toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100">
                              <span className="text-slate-500">Total Active Insured Amount:</span>
                              <strong className="text-emerald-900 tabular-nums">ETB {Number(adequacyAssessment.totalInsuredAmount || 0).toLocaleString()}</strong>
                            </div>
                            <div className="flex justify-between py-1 font-bold">
                              <span>Exposure Coverage Ratio:</span>
                              <span className={`tabular-nums text-sm ${(adequacyAssessment.secondaryTestPassed ?? adequacyAssessment.isSecondaryPass) ? 'text-emerald-700' : 'text-blue-700'}`}>
                                {(adequacyAssessment.secondaryCoverageRatio ?? adequacyAssessment.exposureCoverageRatio) != null ? `${(adequacyAssessment.secondaryCoverageRatio ?? adequacyAssessment.exposureCoverageRatio)!.toFixed(1)}%` : 'No Exposure'}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#5B6472] italic pt-1">
                              CBS Balances retrieved as-of live CBS synchronization. Deduplicated multi-allocations.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reference Estimated Value Notice Card */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-slate-500 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-800">
                              Estimated Market Value: ETB {Number(adequacyAssessment.estimatedValue || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              Source: {adequacyAssessment.estimatedValueSource || 'Valuation Report'} | Date: {adequacyAssessment.estimatedValuationDate || selectedCol.valuationDate || '—'}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase px-2 py-1 bg-slate-200 text-slate-700 rounded">
                          Reference Only — Not Used In Adequacy Determination
                        </span>
                      </div>

                      {/* Contributing Active Policies Table */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full max-w-full">
                        <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#00205B] flex justify-between items-center">
                          <span>Contributing Active Insurance Policies ({(adequacyAssessment.contributingPolicies || adequacyAssessment.activePolicies)?.length || 0})</span>
                          <span className="text-[10px] text-slate-500">Only policies in Active status are included</span>
                        </div>
                        {((adequacyAssessment.contributingPolicies || adequacyAssessment.activePolicies)?.length || 0) === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">No active insurance policies linked to this collateral.</div>
                        ) : (
                          <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full text-left text-xs min-w-[700px]">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5">Policy Number</th>
                                  <th className="p-2.5">Insurer Name</th>
                                  <th className="p-2.5">Insured Amount (ETB)</th>
                                  <th className="p-2.5">Start Date</th>
                                  <th className="p-2.5">Expiry Date</th>
                                  <th className="p-2.5">Policy Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(adequacyAssessment.contributingPolicies || adequacyAssessment.activePolicies)?.map((p: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-mono font-bold text-[#00205B]">{p.policyNumber}</td>
                                    <td className="p-2.5 font-semibold">{p.insurerName || p.insurer}</td>
                                    <td className="p-2.5 font-bold text-emerald-800 tabular-nums">
                                      ETB {Number(p.insuredAmount || 0).toLocaleString()}
                                    </td>
                                    <td className="p-2.5 text-slate-600">{p.startDate || p.effectiveDate || '—'}</td>
                                    <td className="p-2.5 text-slate-600">{p.expiryDate || '—'}</td>
                                    <td className="p-2.5">
                                      <StatusChip label={p.status || 'Active'} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Contributing Facilities & Balances Table */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full max-w-full">
                        <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#00205B] flex justify-between items-center">
                          <span>Contributing Credit Facilities &amp; CBS Outstanding Balances ({(adequacyAssessment.contributingFacilities || adequacyAssessment.distinctFacilities)?.length || 0})</span>
                          <span className="text-[10px] text-slate-500">Deduplicated facilities securing this collateral</span>
                        </div>
                        {((adequacyAssessment.contributingFacilities || adequacyAssessment.distinctFacilities)?.length || 0) === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">No active credit facilities linked to this collateral.</div>
                        ) : (
                          <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full text-left text-xs min-w-[700px]">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5">Facility Ref</th>
                                  <th className="p-2.5">Borrower</th>
                                  <th className="p-2.5">Approved Limit</th>
                                  <th className="p-2.5">CBS Outstanding Balance</th>
                                  <th className="p-2.5">CBS As-Of Date</th>
                                  <th className="p-2.5">Linkage Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(adequacyAssessment.contributingFacilities || adequacyAssessment.distinctFacilities)?.map((f: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-mono font-bold text-[#00205B]">{f.facilityNumber || f.loanReference || f.facilityId}</td>
                                    <td className="p-2.5 font-semibold">{f.borrowerName || f.facilityType || 'Standard Facility'}</td>
                                    <td className="p-2.5 tabular-nums">ETB {Number(f.approvedLimit || 0).toLocaleString()}</td>
                                    <td className="p-2.5 font-bold text-blue-900 tabular-nums">
                                      ETB {Number(f.outstandingBalance || 0).toLocaleString()}
                                    </td>
                                    <td className="p-2.5 text-slate-600">{f.asOfDate || 'Live CBS Feed'}</td>
                                    <td className="p-2.5 text-slate-600">{f.linkageDate || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Exceptions Section (BR-07 / BR-12) */}
                      <div className="cims-card p-4 space-y-3">
                        <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-2">
                          <div>
                            <h5 className="font-bold text-xs text-[#101828] flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 text-purple-700" />
                              Approved Insurance Coverage Exceptions (BR-07 / BR-12)
                            </h5>
                            <p className="text-[11px] text-[#5B6472]">
                              Maker-checker approved waivers permitting temporary underinsurance or overinsurance.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setAdequacyExceptionForm({
                                exceptionType: 'Underinsured Approved Exception',
                                reason: '',
                                approvedExceptionAmount: Math.max(0, adequacyAssessment.requiredCoverageAmount - adequacyAssessment.totalInsuredAmount),
                                validityMonths: 6,
                                reviewDate: new Date(Date.now() + 180 * 86400000).toISOString().substring(0, 10),
                                supportingDocRef: '',
                              });
                              setShowAdequacyExceptionModal(true);
                            }}
                            className="btn-secondary py-1 px-2.5 text-xs text-purple-900 border-purple-300 hover:bg-purple-50 font-semibold"
                          >
                            + Log Exception
                          </button>
                        </div>

                        {((adequacyAssessment.activeExceptions || (adequacyAssessment.hasActiveException && adequacyAssessment.activeExceptionDetails ? [adequacyAssessment.activeExceptionDetails] : []))?.length || 0) === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500">No active insurance exceptions on record for this collateral.</div>
                        ) : (
                          <div className="space-y-2">
                            {(adequacyAssessment.activeExceptions || (adequacyAssessment.hasActiveException && adequacyAssessment.activeExceptionDetails ? [adequacyAssessment.activeExceptionDetails] : []))?.map((ex: any) => (
                              <div key={ex.id} className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-purple-950">{ex.exceptionType}</span>
                                    <StatusChip label={ex.supervisorStatus || ex.approvalStatus || 'Pending'} />
                                    {ex.resolutionStatus && <StatusChip label={ex.resolutionStatus} />}
                                  </div>
                                  <p className="text-slate-600 mt-1">Reason: <strong>{ex.reason}</strong></p>
                                  <span className="text-[10px] text-slate-500 block mt-0.5">
                                    Amount: ETB {Number(ex.approvedExceptionAmount || 0).toLocaleString()} | Review Date: {ex.reviewDate || ex.validityEndDate} | Requester: {ex.requestingUser || ex.requestingUserId} {ex.supervisorApprover || ex.supervisorApproverId ? `| Approver: ${ex.supervisorApprover || ex.supervisorApproverId}` : ''}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {(ex.supervisorStatus === 'PENDING' || ex.approvalStatus === 'Pending') && (
                                    <>
                                      <button
                                        onClick={async () => {
                                          const notes = prompt('Enter supervisor approval comments:');
                                          if (notes !== null) {
                                            await cimsApi.approveInsuranceException(ex.id, notes);
                                            await loadAdequacyAssessment(selectedCol.id);
                                          }
                                        }}
                                        className="btn-primary py-1 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                      >
                                        Approve Exception
                                      </button>
                                      <button
                                        onClick={async () => {
                                          const reason = prompt('Enter supervisor rejection comments:');
                                          if (reason) {
                                            await cimsApi.rejectInsuranceException(ex.id, reason);
                                            await loadAdequacyAssessment(selectedCol.id);
                                          }
                                        }}
                                        className="btn-secondary py-1 px-2 text-[11px] text-red-700 hover:bg-red-50 border-red-200 font-bold"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}

                                  {(ex.supervisorStatus === 'APPROVED' || ex.approvalStatus === 'Approved') && ex.resolutionStatus !== 'RESOLVED' && (
                                    <button
                                      onClick={async () => {
                                        if (confirm('Mark this insurance exception as resolved? Insurance adequacy will be re-evaluated.')) {
                                          await cimsApi.resolveInsuranceException(ex.id, 'Resolved by user action');
                                          await loadAdequacyAssessment(selectedCol.id);
                                        }
                                      }}
                                      className="btn-secondary py-1 px-2 text-[11px] text-slate-700 font-semibold"
                                    >
                                      Mark Resolved
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No adequacy assessment found. Click "Recalculate Adequacy" above to trigger initial evaluation.
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                  TAB: EARLY COLLATERAL RELEASE MANAGEMENT
                  ========================================================================= */}
              {activeTab === 'early-release' && (
                <div className="space-y-4">
                  {/* Header Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <Unlock className="w-5 h-5 text-purple-700" />
                        <h4 className="font-bold text-[#101828] text-sm">
                          Early Collateral Release &amp; Pre-Release Impact Assessment
                        </h4>
                      </div>
                      <p className="text-[11px] text-[#5B6472] mt-0.5">
                        Maker-checker collateral release governance, comprehensive cross-collateral adequacy validation (BR-03), and manual CBS linkage removal tracking.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          if (selectedCol) {
                            await loadPreReleaseImpact(selectedCol.id);
                            await loadActiveReleaseRequest(selectedCol.id);
                          }
                        }}
                        disabled={loadingImpact}
                        className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingImpact ? 'animate-spin' : ''}`} />
                        Run Impact Check
                      </button>

                      {(!activeReleaseReq || activeReleaseReq.status === 'REJECTED' || activeReleaseReq.approvalStatus === 'REJECTED') && (
                        <button
                          onClick={() => {
                            setReleaseReason('');
                            setReleaseFacilityId('');
                            setReleaseDmsDocId('');
                            setShowEarlyReleaseModal(true);
                          }}
                          className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-[#00205B] hover:bg-[#0E284E] text-white font-semibold rounded-lg"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          Initiate Release Request
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pre-Release Impact Assessment Display */}
                  {loadingImpact ? (
                    <div className="p-8 text-center text-xs text-[#5B6472]">Evaluating pre-release impact across all linked facilities…</div>
                  ) : preReleaseImpact ? (
                    <div className="space-y-4">
                      {/* Overall Status Banner */}
                      <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                        (preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'CAN_PROCEED'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : (preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'BLOCKED'
                          ? 'bg-red-50 border-red-300 text-red-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                            (preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'CAN_PROCEED'
                              ? 'bg-emerald-600 text-white'
                              : (preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'BLOCKED'
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-500 text-slate-900'
                          }`}>
                            {preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')}
                          </span>
                          <div>
                            <strong className="block text-xs font-bold">
                              {(preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'CAN_PROCEED' && 'All release conditions verified. Remaining collateral adequately secures all linked facilities.'}
                              {(preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'BLOCKED' && 'Release is blocked by one or more mandatory Credit Policy conditions.'}
                              {(preReleaseImpact.overallStatus || (preReleaseImpact.hardBlocked ? 'BLOCKED' : preReleaseImpact.canProceedWithRelease ? 'CAN_PROCEED' : 'NEEDS_REVIEW')) === 'NEEDS_REVIEW' && 'Conditions require further credit committee or supervisor review.'}
                            </strong>
                            <span className="text-[11px] opacity-80 block">
                              Evaluated across {preReleaseImpact.affectedFacilities?.length || 0} cross-collateralized facilities.
                            </span>
                          </div>
                        </div>

                        {/* Status Chip */}
                        <span className="text-xs font-bold font-mono">
                          {preReleaseImpact.canProceedWithRelease || preReleaseImpact.canProceed ? 'ELIGIBLE FOR RELEASE' : 'RELEASE INELIGIBLE'}
                        </span>
                      </div>

                      {/* Blocking Reasons Alert */}
                      {preReleaseImpact.blockingReasons && preReleaseImpact.blockingReasons.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-300 rounded-lg space-y-1 text-xs text-red-950">
                          <div className="font-bold flex items-center gap-1.5 text-red-800">
                            <XCircle className="w-4 h-4 text-red-600" />
                            Mandatory Blocking Conditions (Release Cannot Be Approved):
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-2 text-red-800">
                            {preReleaseImpact.blockingReasons.map((reason, idx) => (
                              <li key={idx}><strong>{reason}</strong></li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Informational Warnings */}
                      {preReleaseImpact.informationalWarnings && preReleaseImpact.informationalWarnings.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg space-y-1 text-xs text-amber-950">
                          <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Pre-Release Warnings:
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-2 text-amber-800">
                            {preReleaseImpact.informationalWarnings.map((warn, idx) => (
                              <li key={idx}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Conditions A - E Verification Grid */}
                      <div className="cims-card p-4 space-y-3">
                        <h5 className="font-bold text-xs text-[#101828] uppercase tracking-wide">
                          Release Eligibility Validations (Conditions A — E)
                        </h5>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Condition A */}
                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-slate-800 flex items-center gap-1.5">
                                <UserCheck className="w-4 h-4 text-blue-600" />
                                Condition A: Authorized Credit Approval
                              </strong>
                              <StatusChip label={preReleaseImpact.conditionAAuthorizedCreditApproval ? 'PASSED' : preReleaseImpact.conditionA_CreditApproval?.status || 'PENDING'} />
                            </div>
                            <p className="text-[11px] text-slate-600">{preReleaseImpact.conditionADetails || preReleaseImpact.conditionA_CreditApproval?.message || 'Requires authorized approval from competent credit authority.'}</p>
                          </div>

                          {/* Condition B */}
                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-slate-800 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                Condition B: Remaining Collateral Adequacy
                              </strong>
                              <StatusChip label={preReleaseImpact.conditionBRemainingCollateralAdequacy ? 'PASSED' : preReleaseImpact.conditionB_RemainingAdequacy?.status || 'BLOCKED'} />
                            </div>
                            <p className="text-[11px] text-slate-600">{preReleaseImpact.conditionBDetails || preReleaseImpact.conditionB_RemainingAdequacy?.message || 'Remaining collateral must meet required coverage and margin thresholds.'}</p>
                          </div>

                          {/* Condition C */}
                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-slate-800 flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-purple-600" />
                                Condition C: Cross-Collateral Validation (BR-03)
                              </strong>
                              <StatusChip label={preReleaseImpact.conditionCCrossCollateralValidation ? 'PASSED' : preReleaseImpact.conditionC_CrossCollateralValidation?.status || 'BLOCKED'} />
                            </div>
                            <p className="text-[11px] text-slate-600">{preReleaseImpact.conditionCDetails || preReleaseImpact.conditionC_CrossCollateralValidation?.message || 'All linked facilities must maintain sufficient security post-release.'}</p>
                          </div>

                          {/* Condition D */}
                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-slate-800 flex items-center gap-1.5">
                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                Condition D: Insurance Exceptions &amp; Claims
                              </strong>
                              <StatusChip label={preReleaseImpact.conditionDExceptionsAndClaimsPassed ? 'PASSED' : preReleaseImpact.conditionD_InsuranceExceptionsAndClaims?.status || 'BLOCKED'} />
                            </div>
                            <p className="text-[11px] text-slate-600">{preReleaseImpact.conditionDDetails || preReleaseImpact.conditionD_InsuranceExceptionsAndClaims?.message || 'No unresolved insurance exceptions or pending claims permitted.'}</p>
                          </div>

                          {/* Condition E */}
                          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1 md:col-span-2">
                            <div className="flex items-center justify-between">
                              <strong className="text-slate-800 flex items-center gap-1.5">
                                <FileCheck className="w-4 h-4 text-indigo-600" />
                                Condition E: Release Documents in DMS
                              </strong>
                              <StatusChip label={preReleaseImpact.conditionEReleaseDocumentsFiled ? 'PASSED' : preReleaseImpact.conditionE_ReleaseDocuments?.status || 'BLOCKED'} />
                            </div>
                            <p className="text-[11px] text-slate-600">{preReleaseImpact.conditionEDetails || preReleaseImpact.conditionE_ReleaseDocuments?.message || 'Mandatory release deeds and approvals must be filed in DMS.'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Current vs Projected Post-Release Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="cims-card p-4 bg-slate-50 space-y-2 text-xs">
                          <h6 className="font-bold text-[#00205B] border-b border-slate-200 pb-1.5 uppercase text-[11px]">
                            Current Collateral Position
                          </h6>
                          <div className="flex justify-between py-1 border-b border-slate-200">
                            <span className="text-slate-500">Collateral Market Value:</span>
                            <strong className="tabular-nums">ETB {Number(preReleaseImpact.currentCollateralValuation ?? preReleaseImpact.currentCollateralValue ?? 0).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200">
                            <span className="text-slate-500">Insurable Structure Value:</span>
                            <strong className="tabular-nums">ETB {Number(preReleaseImpact.currentInsurableValue || 0).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200">
                            <span className="text-slate-500">Active Insured Amount:</span>
                            <strong className="text-emerald-800 tabular-nums">ETB {Number(preReleaseImpact.currentInsuredAmount || 0).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-200">
                            <span className="text-slate-500">Aggregate Secured Exposure:</span>
                            <strong className="text-blue-900 tabular-nums">ETB {Number(preReleaseImpact.currentAggregateExposure || 0).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between py-1 font-bold">
                            <span>Coverage Ratio:</span>
                            <span className="tabular-nums">
                              {preReleaseImpact.currentCoverageRatio != null 
                                ? preReleaseImpact.currentCoverageRatio.toFixed(1)
                                : preReleaseImpact.currentAggregateExposure > 0
                                ? ((preReleaseImpact.currentTotalAllocatedSecurity || preReleaseImpact.currentCollateralValuation) / preReleaseImpact.currentAggregateExposure * 100).toFixed(1)
                                : '100.0'}%
                            </span>
                          </div>
                        </div>

                        <div className="cims-card p-4 bg-purple-50/50 space-y-2 text-xs">
                          <h6 className="font-bold text-purple-950 border-b border-purple-200 pb-1.5 uppercase text-[11px]">
                            Projected Post-Release Position
                          </h6>
                          <div className="flex justify-between py-1 border-b border-purple-100">
                            <span className="text-slate-600">Remaining Collateral Security:</span>
                            <strong className="tabular-nums text-purple-950">ETB {Number(preReleaseImpact.projectedPostReleaseAllocatedSecurity ?? preReleaseImpact.projectedRemainingCollateralValue ?? 0).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-purple-100">
                            <span className="text-slate-600">Remaining Insurable Value:</span>
                            <strong className="tabular-nums text-purple-950">ETB {Number(preReleaseImpact.projectedRemainingInsurableValue || 0).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-purple-100">
                            <span className="text-slate-600">Projected Post-Release Exposure:</span>
                            <strong className="text-blue-900 tabular-nums">ETB {Number(preReleaseImpact.projectedPostReleaseAggregateExposure ?? preReleaseImpact.projectedPostReleaseExposure ?? 0).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between py-1 border-b border-purple-100">
                            <span className="text-slate-600">Projected Coverage Ratio:</span>
                            <strong className="tabular-nums text-purple-900">
                              {preReleaseImpact.projectedPostReleaseCoverageRatio != null
                                ? preReleaseImpact.projectedPostReleaseCoverageRatio.toFixed(1)
                                : preReleaseImpact.projectedPostReleaseAggregateExposure > 0
                                ? ((preReleaseImpact.projectedPostReleaseAllocatedSecurity / preReleaseImpact.projectedPostReleaseAggregateExposure) * 100).toFixed(1)
                                : '100.0'}%
                            </strong>
                          </div>
                          <div className="flex justify-between py-1 font-bold">
                            <span>Post-Release Margin:</span>
                            <span className="tabular-nums text-purple-900">{preReleaseImpact.projectedPostReleaseMarginPct != null ? preReleaseImpact.projectedPostReleaseMarginPct.toFixed(1) : '100.0'}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Affected Cross-Collateralized Facilities Table */}
                      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden w-full max-w-full">
                        <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#00205B] flex justify-between items-center">
                          <span>Cross-Collateralized Facilities Impact Analysis (BR-03)</span>
                          <span className="text-[10px] text-slate-500">Evaluates all facilities, not just proposed detachment</span>
                        </div>
                        {preReleaseImpact.affectedFacilities?.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">No linked facilities found.</div>
                        ) : (
                          <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full text-left text-xs min-w-[850px]">
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="p-2.5">Facility Ref</th>
                                  <th className="p-2.5">Facility Type</th>
                                  <th className="p-2.5">Pre-Release Balance</th>
                                  <th className="p-2.5">Pre-Release Ratio</th>
                                  <th className="p-2.5">Post-Release Collateral</th>
                                  <th className="p-2.5">Post-Release Ratio</th>
                                  <th className="p-2.5">Margin Result</th>
                                  <th className="p-2.5">Test Result</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {preReleaseImpact.affectedFacilities?.map((af: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-2.5 font-mono font-bold text-[#00205B]">{af.facilityNumber || af.loanReference || af.facilityId}</td>
                                    <td className="p-2.5 font-semibold">{af.borrowerName || af.facilityType || 'Standard'}</td>
                                    <td className="p-2.5 tabular-nums">ETB {Number(af.outstandingBalance ?? af.preReleaseBalance ?? 0).toLocaleString()}</td>
                                    <td className="p-2.5 tabular-nums">{af.preReleaseCoverageRatio != null ? af.preReleaseCoverageRatio.toFixed(1) : '0'}%</td>
                                    <td className="p-2.5 font-bold text-purple-900 tabular-nums">
                                      ETB {Number(af.postReleaseAllocatedSecurity ?? af.postReleaseAvailableCollateral ?? 0).toLocaleString()}
                                    </td>
                                    <td className="p-2.5 font-bold tabular-nums">{af.postReleaseCoverageRatio != null ? af.postReleaseCoverageRatio.toFixed(1) : '0'}%</td>
                                    <td className="p-2.5">
                                      <span className="font-semibold text-slate-700">{af.marginResult || (af.postReleasePassed ? `Req: ${af.requiredMarginPct}% (Pass)` : `Req: ${af.requiredMarginPct}% (Deficit)`)}</span>
                                    </td>
                                    <td className="p-2.5">
                                      <StatusChip label={af.testResult || (af.postReleasePassed ? 'PASSED' : 'FAILED')} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Active Release Request & Maker-Checker Workflow Card */}
                      {activeReleaseReq && (
                        <div className="cims-card p-4 space-y-3 border-2 border-indigo-200 bg-gradient-to-br from-white via-indigo-50/20 to-slate-50">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-indigo-900 text-sm">
                                  Release Request: {activeReleaseReq.id || activeReleaseReq.requestNumber}
                                </span>
                                <StatusChip label={activeReleaseReq.status || activeReleaseReq.approvalStatus || 'PENDING_APPROVAL'} />
                              </div>
                              <span className="text-[11px] text-slate-500 block mt-0.5">
                                Requested on {activeReleaseReq.createdAt || activeReleaseReq.requestDate} by {activeReleaseReq.requesterId || activeReleaseReq.requesterUser}
                              </span>
                            </div>

                            <div className="text-right text-xs">
                              <span className="text-slate-500 block">DMS Release Deed:</span>
                              <strong className="font-mono text-slate-800">{activeReleaseReq.supportingDocumentIds || activeReleaseReq.dmsDocumentReference || 'Verified in DMS'}</strong>
                            </div>
                          </div>

                          <div className="text-xs space-y-1">
                            <strong className="text-slate-700">Reason for Release:</strong>
                            <p className="p-2 bg-white rounded border border-slate-200 text-slate-800">{activeReleaseReq.reason}</p>
                          </div>

                          {/* Checker Approval Actions (if Pending) */}
                          {(activeReleaseReq.status === 'PENDING_APPROVAL' || activeReleaseReq.approvalStatus === 'PENDING_APPROVAL') && (
                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
                              <strong className="block text-xs font-bold text-indigo-950">
                                Supervisor / Checker Approval Action
                              </strong>
                              <input
                                type="text"
                                placeholder="Enter approval / rejection remarks…"
                                value={releaseApprovalComments}
                                onChange={(e) => setReleaseApprovalComments(e.target.value)}
                                className="w-full p-2 border border-indigo-300 rounded text-xs bg-white"
                              />

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  onClick={async () => {
                                    if (!releaseApprovalComments) {
                                      alert('Comments are required for rejection.');
                                      return;
                                    }
                                    setProcessingReleaseApproval(true);
                                    try {
                                      await cimsApi.rejectReleaseRequest(activeReleaseReq.id, releaseApprovalComments);
                                      if (selectedCol) {
                                        await loadActiveReleaseRequest(selectedCol.id);
                                        await loadPreReleaseImpact(selectedCol.id);
                                      }
                                      alert('Collateral release request rejected.');
                                    } catch (err: any) {
                                      alert(err?.message || 'Rejection failed');
                                    } finally {
                                      setProcessingReleaseApproval(false);
                                    }
                                  }}
                                  disabled={processingReleaseApproval}
                                  className="btn-secondary py-1.5 px-3 text-xs text-red-700 border-red-300 hover:bg-red-50 font-bold"
                                >
                                  Reject Request
                                </button>

                                <button
                                  onClick={async () => {
                                    if (!(preReleaseImpact.canProceedWithRelease || preReleaseImpact.canProceed)) {
                                      alert('Release is blocked by Credit Policy conditions. Approval is not permitted.');
                                      return;
                                    }
                                    setProcessingReleaseApproval(true);
                                    try {
                                      await cimsApi.approveReleaseRequest(activeReleaseReq.id, releaseApprovalComments || 'Approved by Credit Authority');
                                      if (selectedCol) {
                                        await loadActiveReleaseRequest(selectedCol.id);
                                        await loadPreReleaseImpact(selectedCol.id);
                                      }
                                      alert('Collateral release APPROVED. Please note that CBS loan-collateral linkage must be removed manually in CBS.');
                                    } catch (err: any) {
                                      alert(err?.message || 'Approval failed');
                                    } finally {
                                      setProcessingReleaseApproval(false);
                                    }
                                  }}
                                  disabled={processingReleaseApproval || !(preReleaseImpact.canProceedWithRelease || preReleaseImpact.canProceed)}
                                  className={`btn-primary py-1.5 px-3 text-xs font-bold text-white rounded flex items-center gap-1.5 ${
                                    (preReleaseImpact.canProceedWithRelease || preReleaseImpact.canProceed) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400 cursor-not-allowed'
                                  }`}
                                  title={!(preReleaseImpact.canProceedWithRelease || preReleaseImpact.canProceed) ? 'Cannot approve: release is blocked by Credit Policy conditions' : 'Approve Release Request'}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Approve Early Release
                                </button>
                              </div>
                            </div>
                          )}

                          {/* POST-APPROVAL NOTICE & MANUAL CBS UPDATE RECORDING */}
                          {(activeReleaseReq.status === 'APPROVED' || activeReleaseReq.approvalStatus === 'APPROVED') && (
                            <div className="space-y-3 pt-2">
                              {/* Prominent CBS Manual Action Warning Banner */}
                              <div className="p-3 bg-amber-50 border-2 border-amber-400 rounded-lg text-xs space-y-1 text-amber-950">
                                <div className="flex items-center gap-2 font-bold text-amber-900">
                                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                                  <span>CRITICAL: CBS Linkage Removal Must Be Performed Manually</span>
                                </div>
                                <p className="text-[11px] text-amber-800">
                                  CBAIMS approval authorizes the release of this collateral. However, removal of the collateral-to-loan linkage in the Core Banking System (CBS) must be executed manually by the authorized credit operations officer. CBAIMS does NOT automatically modify CBS linkages.
                                </p>
                              </div>

                              {/* Manual CBS Update Status Card */}
                              <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800">Manual CBS Update Status:</span>
                                    <StatusChip label={activeReleaseReq.cbsUpdateStatus || activeReleaseReq.manualCbsUpdateStatus || 'PENDING'} />
                                    {(activeReleaseReq.cbsReferenceNo || activeReleaseReq.manualCbsReference) && (
                                      <span className="font-mono text-slate-600">Ref: {activeReleaseReq.cbsReferenceNo || activeReleaseReq.manualCbsReference}</span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 block mt-0.5">
                                    {(activeReleaseReq.cbsUpdatedBy || activeReleaseReq.manualCbsUpdatedBy) ? `Recorded by ${activeReleaseReq.cbsUpdatedBy || activeReleaseReq.manualCbsUpdatedBy} on ${activeReleaseReq.cbsUpdatedAt || activeReleaseReq.manualCbsUpdatedAt}` : 'Awaiting manual CBS detachment confirmation'}
                                    {(activeReleaseReq.cbsUpdateNotes || activeReleaseReq.manualCbsNotes) ? ` | Note: ${activeReleaseReq.cbsUpdateNotes || activeReleaseReq.manualCbsNotes}` : ''}
                                  </span>
                                </div>

                                <button
                                  onClick={() => {
                                    setManualCbsStatus(((activeReleaseReq.cbsUpdateStatus || activeReleaseReq.manualCbsUpdateStatus) as any) || 'COMPLETED');
                                    setManualCbsRef(activeReleaseReq.cbsReferenceNo || activeReleaseReq.manualCbsReference || '');
                                    setManualCbsNotes(activeReleaseReq.cbsUpdateNotes || activeReleaseReq.manualCbsNotes || '');
                                    setShowManualCbsModal(true);
                                  }}
                                  className="btn-primary py-1.5 px-3 text-xs bg-[#00205B] hover:bg-[#0E284E] text-white font-semibold rounded-lg"
                                >
                                  Record Manual CBS Update
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Click "Run Impact Check" to evaluate remaining collateral adequacy and cross-collateral coverage.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'links' && (
                <div className="space-y-4">
                  {/* Module 4: Prominent SHARED / CROSS-COLLATERALIZED Banner (§21) */}
                  {((m3SecuredSummary?.linkedFacilityCount ?? colLinks.length) > 1) && (
                    <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-[#00205B] rounded-xl text-white shadow-lg space-y-3 border border-indigo-700/60">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-amber-400 text-slate-900 shadow-sm animate-pulse">
                            SHARED / CROSS-COLLATERALIZED
                          </span>
                          <span className="text-xs font-semibold text-blue-200">
                            Single master asset simultaneously securing multiple credit facilities
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-blue-200">
                          Master Asset Code: <strong className="text-white font-bold">{selectedCol.code}</strong>
                        </div>
                      </div>

                      {/* 7 Authoritative Aggregate Exposure & Insurance Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5 text-xs">
                        <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 min-w-0">
                          <span className="text-[10px] text-blue-200 uppercase font-semibold block truncate">1. Facilities</span>
                          <strong className="text-lg font-bold text-white block mt-0.5 truncate">
                            {m3SecuredSummary?.linkedFacilityCount ?? colLinks.length}
                          </strong>
                          <span className="text-[9px] text-blue-300 block truncate">Active Facilities</span>
                        </div>

                        <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 min-w-0">
                          <span className="text-[10px] text-blue-200 uppercase font-semibold block truncate">2. Aggregate Exposure</span>
                          <strong className="text-xs sm:text-sm font-bold text-amber-300 block mt-0.5 tabular-nums truncate">
                            ETB {(m3SecuredSummary?.aggregateSecuredExposure ?? (col360Data?.totalSecuredExposure || 0)).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                          <span className="text-[9px] text-blue-300 block truncate">Sum of Outstandings</span>
                        </div>

                        <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 min-w-0">
                          <span className="text-[10px] text-blue-200 uppercase font-semibold block truncate">3. Total Allocation</span>
                          <strong className="text-xs sm:text-sm font-bold text-emerald-300 block mt-0.5 tabular-nums truncate">
                            ETB {(m3SecuredSummary?.totalAllocatedSecurity ?? (col360Data?.totalAllocatedAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                          <span className="text-[9px] text-blue-300 block truncate">Pledged Security</span>
                        </div>

                        <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 min-w-0">
                          <span className="text-[10px] text-blue-200 uppercase font-semibold block truncate">4. Capacity Remaining</span>
                          <strong className="text-xs sm:text-sm font-bold text-cyan-300 block mt-0.5 tabular-nums truncate">
                            ETB {(m3SecuredSummary?.unallocatedSecurity ?? (col360Data?.remainingCollateralCapacity || 0)).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                          <span className="text-[9px] text-blue-300 block truncate">Unallocated Headroom</span>
                        </div>

                        <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 min-w-0">
                          <span className="text-[10px] text-blue-200 uppercase font-semibold block truncate">5. Insurance Required</span>
                          <strong className="text-xs sm:text-sm font-bold text-slate-200 block mt-0.5 tabular-nums truncate">
                            ETB {(m3SecuredSummary?.requiredInsuranceAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                          <span className="text-[9px] text-blue-300 block truncate">Min Coverage Need</span>
                        </div>

                        <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 min-w-0">
                          <span className="text-[10px] text-blue-200 uppercase font-semibold block truncate">6. Insurance Active</span>
                          <strong className="text-xs sm:text-sm font-bold text-emerald-300 block mt-0.5 tabular-nums truncate">
                            ETB {(m3SecuredSummary?.currentInsuredAmount ?? selectedCol.insuredAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                          <span className="text-[9px] text-blue-300 block truncate">Valid Policy Cover</span>
                        </div>

                        <div className="p-2.5 bg-white/10 rounded-lg border border-white/10 min-w-0">
                          <span className="text-[10px] text-blue-200 uppercase font-semibold block truncate">7. Insurance Gap</span>
                          <strong className={`text-xs sm:text-sm font-bold block mt-0.5 tabular-nums truncate ${
                            (m3SecuredSummary?.insuranceGap ?? 0) > 0 ? 'text-rose-400 font-black' : 'text-emerald-400'
                          }`}>
                            ETB {(m3SecuredSummary?.insuranceGap ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                          <span className="text-[9px] text-blue-300 block truncate">
                            {(m3SecuredSummary?.insuranceGap ?? 0) > 0 ? 'Deficit Warning' : 'Adequate'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Authoritative Relationship Summary & Cross-Collateral Engine (Section 18) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-700" />
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800">
                          Secured Facilities &amp; Cross-Collateral Relationship Engine
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800">
                          {m3SecuredSummary?.linkedFacilityCount ?? colLinks.length} Facilities Secured
                        </span>
                        {((m3SecuredSummary?.linkedFacilityCount ?? colLinks.length) > 1 || col360Data?.crossCollateralized) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-800">
                            Cross-Collateralized Asset
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowM3ReconcileModal(true)}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1 transition-colors"
                        >
                          🔄 CBS Reconciliation (Section 29)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Net Collateral Value</span>
                        <strong className="text-slate-900 font-bold tabular-nums text-sm">
                          ETB {(m3SecuredSummary?.netCollateralValue ?? (selectedCol.valuationAmount * (1 - (selectedCol.haircut || 20) / 100))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Allocation Ceiling (MV - {selectedCol.haircut || 20}%)</span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-blue-700 block text-[10px] uppercase font-semibold">Total Allocated Security</span>
                        <strong className="text-blue-800 font-bold tabular-nums text-sm">
                          ETB {(m3SecuredSummary?.totalAllocatedSecurity ?? (col360Data?.totalAllocatedAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-blue-600 block mt-0.5">Pledged Security Value</span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Unallocated Security</span>
                        <strong className="text-indigo-900 font-bold tabular-nums text-sm">
                          ETB {(m3SecuredSummary?.unallocatedSecurity ?? (col360Data?.remainingCollateralCapacity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Available Collateral Capacity</span>
                      </div>

                      <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-slate-500 block text-[10px] uppercase font-semibold">Aggregate Secured Exposure</span>
                        <strong className="text-slate-900 font-bold tabular-nums text-sm">
                          ETB {(m3SecuredSummary?.aggregateSecuredExposure ?? (col360Data?.totalSecuredExposure || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Sum of Active Linked Outstandings</span>
                      </div>
                    </div>

                    {/* Insurance Adequacy relative to aggregate secured exposure (Section 14 & 18) */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            Insurance Adequacy Monitoring (Aggregate Exposure Context)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Active Valid Insurance:{' '}
                            <strong className="text-emerald-700">
                              ETB {(m3SecuredSummary?.currentInsuredAmount ?? selectedCol.insuredAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                            {' • '}
                            Required:{' '}
                            <strong>
                              ETB {(m3SecuredSummary?.requiredInsuranceAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                            {' • '}
                            Insurance Gap:{' '}
                            <strong className={m3SecuredSummary && m3SecuredSummary.insuranceGap > 0 ? 'text-red-600' : 'text-emerald-600'}>
                              ETB {(m3SecuredSummary?.insuranceGap ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            (m3SecuredSummary?.adequacyStatus === 'ADEQUATE' || m3SecuredSummary?.adequacyStatus === 'Adequately Insured')
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {m3SecuredSummary?.adequacyStatus || selectedCol.insuranceStatus || 'Adequately Insured'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table Header and Action */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-[#101828]">Secured Core Banking Facilities &amp; Sub-Limits</h4>
                      <p className="text-[11px] text-[#5B6472]">
                        Authoritative relationship linkages: Customer → Facility → Loan Account ↔ Collateral Asset
                      </p>
                    </div>
                    {isMaker && (
                      <button
                        type="button"
                        onClick={() => {
                          setM3LinkToEdit(null);
                          setM3LinkModalMode('create');
                          setShowM3LinkModal(true);
                        }}
                        className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Link Credit Facility
                      </button>
                    )}
                  </div>

                  {/* Secured Facilities Table */}
                  <div className="cims-card overflow-x-auto w-full max-w-full">
                    <table className="w-full text-left text-xs min-w-[950px]">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5">Facility / Loan Ref</th>
                          <th className="p-2.5">Customer / Borrower</th>
                          <th className="p-2.5">Facility Type</th>
                          <th className="p-2.5 text-right">Limit &amp; Outstanding</th>
                          <th className="p-2.5 text-right">Allocated Security</th>
                          <th className="p-2.5 text-right">% of Collateral</th>
                          <th className="p-2.5 text-right">% Facility Covered</th>
                          <th className="p-2.5">Linkage &amp; Degree</th>
                          <th className="p-2.5">Status &amp; Source</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {loadingM3Secured ? (
                          <tr>
                            <td colSpan={10} className="p-6 text-center text-slate-500">
                              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                              Loading authoritative secured facilities...
                            </td>
                          </tr>
                        ) : (!m3SecuredSummary?.securedFacilities || m3SecuredSummary.securedFacilities.length === 0) ? (
                          <tr>
                            <td colSpan={10} className="p-6 text-center text-slate-500">
                              No credit facilities currently secured by this collateral asset.
                            </td>
                          </tr>
                        ) : (
                          m3SecuredSummary.securedFacilities.map((l) => {
                            const isThirdParty = Boolean(l.relationshipContext === 'Third-party' || l.thirdParty);
                            const borrowerName = l.borrowerName || l.customerName || (l.borrowerCif ? `Borrower (${l.borrowerCif})` : 'Borrower');
                            const borrowerCif = l.borrowerCif || l.customerCif || l.customerId || '—';
                            const legalOwner = l.legalOwnerNames || (selectedCol as any).legalOwnerNames || (selectedCol as any).owners?.map((o: any) => o.name).join(', ') || 'Collateral Legal Owner';
                            return (
                              <tr key={l.id} className="hover:bg-[#EFF5FB]/60 group">
                                <td className="p-2.5 font-semibold text-[#00205B]">
                                  <div className="flex items-center gap-1.5">
                                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="font-mono">{l.loanReference || l.facilityId}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    Acc: {l.accountNumber || l.loanAccountId || '—'}
                                  </div>
                                </td>
                                <td className="p-2.5">
                                  <button
                                    type="button"
                                    onClick={() => onNavigate && borrowerCif !== '—' && onNavigate('customers', { customerId: borrowerCif, cif: borrowerCif })}
                                    className="font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer text-left"
                                    title="Open Customer 360"
                                  >
                                    <span>{borrowerName}</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-60 inline" />
                                  </button>
                                  <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 mt-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>CIF: {borrowerCif}</span>
                                      {isThirdParty ? (
                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded font-semibold text-[9px]">
                                          Third-Party Pledge{l.relationshipToBorrower ? `: ${l.relationshipToBorrower}` : ''}
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium text-[9px]">
                                          Borrower-owned
                                        </span>
                                      )}
                                    </div>
                                    {isThirdParty && (
                                      <div className="text-[10px] text-slate-600 font-medium">
                                        Owner: <span className="text-slate-800 font-semibold">{legalOwner}</span>
                                        {l.pledgeAgreementRef && (
                                          <span className="text-slate-500 font-mono ml-1">({l.pledgeAgreementRef})</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-2.5">
                                  <div className="font-medium text-slate-800">{l.facilityType || 'Term Loan'}</div>
                                  <div className="text-[10px] text-slate-500">{l.businessSegment || '—'}</div>
                                </td>
                                <td className="p-2.5 text-right tabular-nums">
                                  <div className="font-semibold text-slate-900">
                                    ETB {Number(l.approvedLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </div>
                                  <div className="text-[10px] text-amber-700">
                                    Out: ETB {Number(l.outstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </div>
                                </td>
                                <td className="p-2.5 text-right tabular-nums font-bold text-blue-700">
                                  ETB {Number(l.allocatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2.5 text-right tabular-nums font-semibold text-slate-700">
                                  {Number(l.collateralAllocationPct || 0).toFixed(1)}%
                                </td>
                                <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">
                                  {Number(l.facilityCoveragePct || 0).toFixed(1)}%
                                </td>
                                <td className="p-2.5">
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                      {l.linkageType || 'Primary'}
                                    </span>
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                      l.collateralRank === '2nd'
                                        ? 'bg-purple-100 text-purple-900 border-purple-300'
                                        : 'bg-slate-100 text-slate-800 border-slate-300'
                                    }`}>
                                      {l.collateralRank === '2nd' ? '2nd-Degree' : '1st-Degree'}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-2.5">
                                  <div className="flex flex-col gap-0.5">
                                    <StatusChip label={l.relationshipStatus || 'Active'} />
                                    <span className="text-[9px] font-mono text-slate-400">Src: {l.source || 'CIMS'}</span>
                                  </div>
                                </td>
                                <td className="p-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onNavigate) {
                                          setShowDetailModal(false);
                                          onNavigate('facilities', { facilityId: l.facilityId || l.loanAccountId, id: l.facilityId || l.loanAccountId });
                                        }
                                      }}
                                      className="py-1 px-2 text-[10px] font-semibold text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-300 rounded inline-flex items-center gap-0.5"
                                      title="View Credit Facility"
                                    >
                                      View <ArrowUpRight className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setM3HistoryLinkId(l.id);
                                        setM3HistoryRef(`${selectedCol.code} ↔ ${l.loanReference || l.facilityId}`);
                                        setShowM3HistoryModal(true);
                                      }}
                                      className="py-1 px-2 text-[10px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded inline-flex items-center gap-0.5"
                                      title="View Relationship History"
                                    >
                                      📜 History
                                    </button>
                                    {isMaker && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setM3LinkToEdit(l);
                                            setM3LinkModalMode('edit');
                                            setShowM3LinkModal(true);
                                          }}
                                          className="py-1 px-2 text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded"
                                          title="Edit Relationship Allocation"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            const reason = prompt(`Enter change reason for ending link with ${l.loanReference || l.facilityId}:`, 'Obligation settled or facility closed');
                                            if (reason === null) return;
                                            try {
                                              const userId = currentUser?.userId || currentUser?.username || 'CRO_OFFICER';
                                              await cimsApi.endCollateralFacilityLink(l.id, reason, userId);
                                              loadM3SecuredFacilities(selectedCol.id);
                                              loadCollateral360(selectedCol.id);
                                              onRefreshData?.();
                                            } catch (err: any) {
                                              alert(`Failed to end relationship: ${err.message || 'Error'}`);
                                            }
                                          }}
                                          className="py-1 px-2 text-[10px] font-semibold text-red-600 hover:text-red-800 border border-red-200 rounded"
                                          title="End Relationship"
                                        >
                                          End
                                        </button>
                                      </>
                                    )}
                                  </div>
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

              {activeTab === 'policies' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[720px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Policy Number</th>
                        <th className="p-2.5">Insurer</th>
                        <th className="p-2.5">Coverage Type</th>
                        <th className="p-2.5 text-right">Insured Amount</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {colPolicies.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-[#5B6472]">
                            No insurance policies found for this collateral.
                          </td>
                        </tr>
                      ) : (
                        colPolicies.map((p) => (
                          <tr key={p.id} className="hover:bg-[#EFF5FB] group">
                            <td className="p-2.5 font-semibold text-[#00205B]">
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
                            <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">
                              ETB {p.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5">{p.expiryDate}</td>
                            <td className="p-2.5">
                              <StatusChip label={p.status} />
                            </td>
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-4">
                  {/* Regulatory Mandatory Document Checklist */}
                  {col360Data?.documentChecklist && col360Data.documentChecklist.length > 0 && (
                    <div className="cims-card p-4 space-y-3 bg-[#F8FAFC]">
                      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                        <div>
                          <h5 className="font-bold text-[#101828] flex items-center gap-1.5">
                            <FileCheck className="w-4 h-4 text-[#00205B]" />
                            Regulatory Mandatory Document Checklist
                          </h5>
                          <p className="text-[11px] text-[#5B6472]">
                            Prerequisite documentation required by Bank Credit Policy and NBE Directives for {selectedCol.category} — {selectedCol.type || selectedCol.category}
                            {selectedCol.ownerType === 'Third-party-owned' && ' (including Third-Party Consent/Pledge Contract)'}.
                          </p>
                        </div>
                        {col360Data.documentChecklist.every((d) => d.satisfied) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-xs">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            All Mandatory Documents Satisfied
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-semibold text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Pending Mandatory Verification
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {col360Data.documentChecklist.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border flex items-start gap-2.5 text-xs ${
                              item.satisfied
                                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                : item.mandatory
                                ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {item.satisfied ? (
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : item.mandatory ? (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            ) : (
                              <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold">{item.documentName}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                    item.mandatory
                                      ? 'bg-amber-200/80 text-amber-900'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {item.mandatory ? 'Mandatory' : 'Optional'}
                                </span>
                              </div>
                              <div className="text-[11px] text-[#5B6472] mt-0.5">{item.notes}</div>
                              {item.matchingDocumentNames && item.matchingDocumentNames.length > 0 && (
                                <div className="mt-1 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                  <Paperclip className="w-3 h-3 text-emerald-600" />
                                  <span>Attached: {item.matchingDocumentNames.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[#101828]">DMS Ownership & Compliance Documents</h4>
                    {isMaker && (
                      <button
                        onClick={() => setShowUploadDocModal(true)}
                        className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        + Upload Document
                      </button>
                    )}
                  </div>
                  <div className="cims-card overflow-x-auto w-full max-w-full">
                    <table className="w-full text-left text-xs min-w-[750px]">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5">Document Title</th>
                          <th className="p-2.5">Document Type</th>
                          <th className="p-2.5">Version</th>
                          <th className="p-2.5">Verification Status</th>
                          <th className="p-2.5">Upload Date</th>
                          <th className="p-2.5">Expiry Date</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {colDocs.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-[#5B6472]">
                              No documents uploaded.
                            </td>
                          </tr>
                        ) : (
                          colDocs.map((d) => (
                            <tr key={d.id} className="hover:bg-[#EFF5FB]">
                              <td className="p-2.5 font-semibold text-[#00205B] flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-[#2C6295]" />
                                {d.name}
                              </td>
                              <td className="p-2.5">{d.type}</td>
                              <td className="p-2.5">v{d.version || 1}</td>
                              <td className="p-2.5">
                                <StatusChip label={d.verificationStatus || 'Pending Verification'} variant="neutral" />
                              </td>
                              <td className="p-2.5">{d.uploadDate?.substring(0, 10)}</td>
                              <td className="p-2.5">{d.expiryDate?.substring(0, 10) || 'N/A'}</td>
                              <td className="p-2.5">
                                <StatusChip label={d.status || 'Active'} />
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  onClick={() => {
                                    setDocPreviewTarget(d);
                                    setShowDocPreviewModal(true);
                                  }}
                                  className="btn-ghost py-0.5 px-2 text-[11px] text-[#00205B] hover:text-[#D48806] border border-slate-200 hover:bg-slate-50 rounded inline-flex items-center gap-1 font-semibold"
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

              {activeTab === 'exceptions' && (
                <div className="cims-card overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-xs min-w-[650px]">
                    <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                      <tr>
                        <th className="p-2.5">Exception Type</th>
                        <th className="p-2.5">Severity</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Identified Date</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {colExceptions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-[#5B6472]">
                            No open exceptions logged.
                          </td>
                        </tr>
                      ) : (
                        colExceptions.map((e) => (
                          <tr key={e.id} className="hover:bg-[#EFF5FB]">
                            <td className="p-2.5 font-semibold">{e.exceptionType}</td>
                            <td className="p-2.5">
                              <StatusChip label={e.severity} />
                            </td>
                            <td className="p-2.5">{e.description}</td>
                            <td className="p-2.5">{e.detectedAt?.substring(0, 10)}</td>
                            <td className="p-2.5">
                              <StatusChip label={e.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-[#101828]">Collateral Audit Trail &amp; Lifecycle History</h4>
                      <p className="text-[11px] text-[#5B6472]">Complete four-eyes authorization history, valuation revisions, ownership changes, and facility linkages.</p>
                    </div>
                  </div>
                  <div className="cims-card overflow-x-auto w-full max-w-full">
                    <table className="w-full text-left text-xs min-w-[850px]">
                      <thead className="bg-[#EFF5FB] border-b border-[#E2E8F0] text-[#5B6472] font-semibold">
                        <tr>
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5">User</th>
                          <th className="p-2.5">Action Event</th>
                          <th className="p-2.5">Entity / Record</th>
                          <th className="p-2.5">Attribute Changed</th>
                          <th className="p-2.5">Old Value</th>
                          <th className="p-2.5">New Value</th>
                          <th className="p-2.5">Reason / Comments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {!col360Data?.auditHistory || col360Data.auditHistory.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-[#5B6472]">
                              No audit trail entries recorded for this collateral yet.
                            </td>
                          </tr>
                        ) : (
                          col360Data.auditHistory.map((h, idx) => (
                            <tr key={h.id || idx} className="hover:bg-[#EFF5FB]">
                              <td className="p-2.5 text-[#5B6472] font-mono whitespace-nowrap">
                                {h.timestamp?.replace('T', ' ').substring(0, 19) || '—'}
                              </td>
                              <td className="p-2.5 font-semibold text-[#101828]">
                                {h.username || 'System'}
                              </td>
                              <td className="p-2.5">
                                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded font-bold">
                                  {h.action}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-[#5B6472]">
                                {h.entityType}: {h.entityId}
                              </td>
                              <td className="p-2.5 font-semibold text-[#00205B]">
                                {h.fieldChanged || '—'}
                              </td>
                              <td className="p-2.5 font-mono text-slate-500 max-w-[120px] truncate">
                                {h.oldValue || '—'}
                              </td>
                              <td className="p-2.5 font-mono text-emerald-700 max-w-[120px] truncate">
                                {h.newValue || '—'}
                              </td>
                              <td className="p-2.5 text-slate-600 max-w-[200px] truncate">
                                {h.reason || '—'}
                              </td>
                            </tr>
                          ))
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

      {/* =========================================================================
          11-Step Banking-Grade Collateral Registration Wizard
          ========================================================================= */}
      {showRegisterWizard && (
        <CollateralRegistrationWizard
          currentUser={currentUser}
          customers={customers}
          facilities={facilities}
          branches={branches}
          segments={segments}
          taxonomies={taxonomies}
          mandatoryDocRules={mandatoryDocRules}
          systemParameters={systemParameters}
          onClose={() => setShowRegisterWizard(false)}
          onSuccess={(col) => {
            onRegisterCollateral?.(col);
            setShowRegisterWizard(false);
            onRefreshData?.();
          }}
        />
      )}

      {/* Exception Request Submission Modal */}
      {showExceptionModal && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#D48806]" />
                <div>
                  <h3 className="text-sm font-bold">Collateral Exception Details</h3>
                  <p className="text-[11px] text-slate-300">
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
                <strong>Controlled Validation Override:</strong> Bank credit policy allows temporary waiver of specific collateral registration requirements subject to authorized management review and full audit logging.
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
                  <option value="Valuation Date Expired">Valuation Date Expired</option>
                  <option value="Haircut Exemption">Haircut Exemption</option>
                  <option value="Customer KYC Verification Pending">Customer KYC Verification Pending</option>
                  <option value="Other Exception">Other Collateral Exception</option>
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
                  placeholder="e.g. Title Deed / Property Ownership Certificate"
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
                    id="col-exception-evidence-file"
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
                    htmlFor="col-exception-evidence-file"
                    className="cursor-pointer py-1.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#00205B]" />
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

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-[#E2E8F0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExceptionModal(false)}
                className="btn-secondary"
                disabled={exceptionSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitCollateralExceptionRequest}
                disabled={exceptionSubmitting}
                className="btn-primary bg-[#F59E0B] hover:bg-[#D97706] text-white flex items-center gap-1.5 font-bold cursor-pointer"
              >
                {exceptionSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Submitting Exception…
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    Submit Exception Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify Collateral Owner Modal */}
      {showVerifyOwnerModal && verifyingOwner && selectedCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Owner Legal Verification</h3>
                <p className="text-[11px] text-slate-300">
                  {verifyingOwner.name} — Four-Eyes Identity &amp; Title Verification
                </p>
              </div>
              <button onClick={() => setShowVerifyOwnerModal(false)} className="text-slate-300 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Owner Legal Name</label>
                <input
                  type="text"
                  disabled
                  value={verifyingOwner.name}
                  className="w-full p-2 border border-[#E2E8F0] rounded bg-slate-100 font-semibold"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">National ID / Business Reg No</label>
                <input
                  type="text"
                  disabled
                  value={verifyingOwner.businessRegNo || verifyingOwner.idNumber || '—'}
                  className="w-full p-2 border border-[#E2E8F0] rounded bg-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Verification Status</label>
                <select
                  value={verifyStatus}
                  onChange={(e) => setVerifyStatus(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                >
                  <option value="Verified">Verified (Satisfied / Authenticated)</option>
                  <option value="Pending Documentation">Pending Documentation</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Verifying Officer</label>
                <input
                  type="text"
                  disabled
                  value={currentUser.name || currentUser.username || 'CRO_USER'}
                  className="w-full p-2 border border-[#E2E8F0] rounded bg-slate-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Verification Remarks / Notes</label>
                <textarea
                  rows={3}
                  value={verifyComments}
                  onChange={(e) => setVerifyComments(e.target.value)}
                  placeholder="e.g. Identity and ownership documents verified against original register and registry portal..."
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowVerifyOwnerModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={verifySubmitting}
                  onClick={handleVerifyOwnerSubmit}
                  className="btn-primary disabled:opacity-60"
                >
                  {verifySubmitting ? 'Saving…' : 'Record Verification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal (in 360 view) */}
      {showUploadDocModal && selectedCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload Document (DMS)</h3>
                <p className="text-[11px] text-slate-300">{selectedCol.code} — Attach to Repository</p>
              </div>
              <button onClick={() => setShowUploadDocModal(false)} className="text-slate-300 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Document Title (M)</label>
                <input
                  type="text"
                  placeholder="e.g. Title Deed Certificate"
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
                  <option value="Title Deed / Property Ownership Certificate">Title Deed / Property Ownership Certificate</option>
                  <option value="Approved Building Plan">Approved Building Plan</option>
                  <option value="Valuation Report">Valuation Report</option>
                  <option value="Vehicle Registration / Logbook">Vehicle Registration / Logbook</option>
                  <option value="Machinery Ownership Certificate">Machinery Ownership Certificate</option>
                  <option value="Commercial Registration / Trade License">Commercial Registration / Trade License</option>
                  <option value="Guarantee Contract / Agreement">Guarantee Contract / Agreement</option>
                  <option value="Other Ownership / Supporting Document">Other Ownership / Supporting Document</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Expiry Date (Optional)</label>
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
                <button disabled={uploadingDoc} onClick={handleUploadDocSubmit} className="btn-primary disabled:opacity-60">
                  {uploadingDoc ? 'Uploading…' : 'Upload File'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintain Collateral Modal */}
      {showMaintainModal && selectedCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Maintain Collateral Details</h3>
                <p className="text-[11px] text-slate-300">{selectedCol.code} — Maker Amendment</p>
              </div>
              <button onClick={() => setShowMaintainModal(false)} className="text-slate-300 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              {maintainError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{maintainError}</span>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#101828]">Bank-Assessed Valuation Amount (ETB)</label>
                  {selectedCol.bankAssessedValueSource === 'CBS' && (
                    <span className="text-[9px] px-1.5 py-0.2 font-mono bg-blue-100 text-blue-800 rounded font-bold">
                      CBS Read-Only
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  readOnly={selectedCol.bankAssessedValueSource === 'CBS'}
                  value={maintainFields.valuationAmount ?? ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, valuationAmount: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className={`w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums ${selectedCol.bankAssessedValueSource === 'CBS' ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Insurable Structure (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Structure Only"
                    value={maintainFields.insurableValue ?? ''}
                    onChange={(e) => setMaintainFields({ ...maintainFields, insurableValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#101828] mb-1">Estimated Value (Ref Only)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Optional Ref"
                    value={maintainFields.estimatedValue ?? ''}
                    onChange={(e) => setMaintainFields({ ...maintainFields, estimatedValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="w-full p-2 border border-[#E2E8F0] rounded tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Haircut Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={maintainFields.haircut ?? ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, haircut: e.target.value === '' ? undefined : Number(e.target.value) })}
                  className="w-full p-2 border border-[#E2E8F0] rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Review Date</label>
                <input
                  type="date"
                  value={maintainFields.reviewDate || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, reviewDate: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowMaintainModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  disabled={maintainSubmitting}
                  onClick={async () => {
                    if (onMaintainCollateral) {
                      setMaintainSubmitting(true);
                      setMaintainError(null);
                      try {
                        await onMaintainCollateral(selectedCol.id, maintainFields);
                        alert('Collateral changes submitted for checker approval.');
                        setShowMaintainModal(false);
                      } catch (err: any) {
                        setMaintainError(err.message || 'Failed to submit changes');
                      } finally {
                        setMaintainSubmitting(false);
                      }
                    }
                  }}
                  className="btn-primary disabled:opacity-60"
                >
                  {maintainSubmitting ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Segment Modal */}
      {showTransferModal && selectedCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Transfer Collateral Segment</h3>
                <p className="text-[11px] text-slate-300">{selectedCol.code} — Ownership Segment Transfer</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-300 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="text-[#5B6472] block mb-1">Current Segment:</span>
                <strong className="text-[#00205B] text-sm">{selectedCol.owningSegment}</strong>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Destination Segment (M)</label>
                <select
                  value={destSegment}
                  onChange={(e) => setDestSegment(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                >
                  {(segments.length > 0 ? segments : [{ id: '1', name: 'Retail Banking' }, { id: '2', name: 'MSME Banking' }])
                    .filter((s) => s.name !== selectedCol.owningSegment)
                    .map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#101828] mb-1">Transfer Reason (M)</label>
                <textarea
                  rows={3}
                  placeholder="Reason for segment re-alignment..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full p-2 border border-[#E2E8F0] rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowTransferModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!transferReason.trim()) {
                      alert('Please provide a reason for transfer.');
                      return;
                    }
                    await onInitiateTransfer(selectedCol.id, destSegment, transferReason);
                    alert('Ownership transfer initiated and routed for HODEPT approval.');
                    setShowTransferModal(false);
                    setShowDetailModal(false);
                  }}
                  className="btn-primary"
                >
                  Initiate Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Release Collateral Modal */}
      {showReleaseModal && selectedCol && releaseCheck && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Release Security Obligation</h3>
                <p className="text-[11px] text-slate-300">{selectedCol.code} — Settlement & Release Engine</p>
              </div>
              <button onClick={() => setShowReleaseModal(false)} className="text-slate-300 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`p-4 rounded-lg border ${releaseCheck.canRelease ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                <div className="font-bold flex items-center gap-2">
                  {releaseCheck.canRelease ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
                  <span>{releaseCheck.message}</span>
                </div>
                {!releaseCheck.canRelease && (
                  <div className="mt-2 text-[11px] text-red-700">
                    Active Outstanding Loans: <strong>{releaseCheck.activeLoans.join(', ')}</strong>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button onClick={() => setShowReleaseModal(false)} className="btn-secondary">
                  Close
                </button>
                {releaseCheck.canRelease && (
                  <button
                    onClick={async () => {
                      try {
                        await cimsApi.requestCollateralRelease(selectedCol.id, 'Facility fully settled', currentUser.username);
                        alert('Collateral release requested and submitted for Checker approval.');
                        setShowReleaseModal(false);
                        setShowDetailModal(false);
                        window.location.reload();
                      } catch (e: any) {
                        alert(`Release request failed: ${e?.message || e}`);
                      }
                    }}
                    className="btn-primary bg-emerald-700 hover:bg-emerald-800"
                  >
                    Request Release
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Change Modal */}
      {showOwnershipChangeModal && selectedCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="p-4 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#D48806]" />
                  Initiate Collateral Ownership Change
                </h3>
                <p className="text-[11px] text-slate-300">
                  {selectedCol.code} — Historical ownership will be preserved in audit trail.
                </p>
              </div>
              <button
                onClick={() => setShowOwnershipChangeModal(false)}
                className="text-white hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!ownershipChangeForm.newOwnerName.trim()) {
                  setOwnershipChangeError('New Owner Name is mandatory.');
                  return;
                }
                if (!ownershipChangeForm.changeReason.trim()) {
                  setOwnershipChangeError('Reason for Ownership Change is mandatory.');
                  return;
                }
                if (!ownershipChangeForm.supportingDocument.trim()) {
                  setOwnershipChangeError('Supporting Document reference is mandatory.');
                  return;
                }
                if (ownershipChangeForm.newOwnershipType === 'Third-party-owned') {
                  if (!ownershipChangeForm.relationshipToBorrower || !ownershipChangeForm.relationshipToBorrower.trim()) {
                    setOwnershipChangeError('Documented Relationship to Borrower is mandatory for third-party ownership.');
                    return;
                  }
                  if (!ownershipChangeForm.idNumber?.trim() && !ownershipChangeForm.tin?.trim()) {
                    setOwnershipChangeError('Legal Owner Identity (National ID / Business Reg No / TIN) is mandatory for third-party ownership.');
                    return;
                  }
                }
                setSubmittingOwnershipChange(true);
                setOwnershipChangeError(null);
                try {
                  await cimsApi.changeCollateralOwnership(
                    selectedCol.id,
                    ownershipChangeForm,
                    currentUser.username
                  );
                  alert('Ownership change successfully processed. Previous owner retained in audit history.');
                  setShowOwnershipChangeModal(false);
                  setShowDetailModal(false);
                  window.location.reload();
                } catch (err: any) {
                  setOwnershipChangeError(err?.message || 'Failed to submit ownership change');
                } finally {
                  setSubmittingOwnershipChange(false);
                }
              }}
              className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto"
            >
              {ownershipChangeError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{ownershipChangeError}</span>
                </div>
              )}

              {/* Current Active Owner Display */}
              <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-lg">
                <span className="text-[10px] text-[#5B6472] uppercase font-bold tracking-wider block">Current Effective Owner</span>
                <div className="text-sm font-bold text-[#00205B] mt-0.5">
                  {selectedCol.owners?.find(o => !o.supersededDate)?.name || customers.find(c => c.id === selectedCol.customerId || c.cif === selectedCol.customerId)?.name || selectedCol.customerId}
                </div>
                <div className="text-[11px] text-[#5B6472]">
                  Type: {selectedCol.ownerType || 'Borrower-owned'} • Will be archived as historical record upon transfer
                </div>
              </div>

              {/* New Owner Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">
                    New Owner Full Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Legal individual or business name"
                    value={ownershipChangeForm.newOwnerName}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, newOwnerName: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">New Ownership Type</label>
                  <select
                    value={ownershipChangeForm.newOwnershipType}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, newOwnershipType: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white font-semibold"
                  >
                    <option value="Borrower-owned">Borrower-owned</option>
                    <option value="Third-party-owned">Third-party-owned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">Ownership Share (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={ownershipChangeForm.percentage ?? ''}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, percentage: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs font-bold tabular-nums"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">
                    Relationship to Borrower {ownershipChangeForm.newOwnershipType === 'Third-party-owned' && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={ownershipChangeForm.relationshipToBorrower || ''}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, relationshipToBorrower: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs bg-white font-semibold"
                    required={ownershipChangeForm.newOwnershipType === 'Third-party-owned'}
                  >
                    <option value="">-- Select Relationship to Borrower --</option>
                    <option value="Shareholder">Shareholder</option>
                    <option value="Parent Company">Parent Company</option>
                    <option value="Director">Director</option>
                    <option value="Guarantor">Guarantor</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Family Member">Family Member</option>
                    <option value="Business Partner">Business Partner</option>
                    <option value="Other">Other Documented Relationship</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">Ownership Effective Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={ownershipChangeForm.effectiveDate}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, effectiveDate: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">
                    National ID / Business Reg No {ownershipChangeForm.newOwnershipType === 'Third-party-owned' && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={ownershipChangeForm.idNumber}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, idNumber: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs font-mono"
                    required={ownershipChangeForm.newOwnershipType === 'Third-party-owned' && !ownershipChangeForm.tin}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">TIN Number</label>
                  <input
                    type="text"
                    value={ownershipChangeForm.tin}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, tin: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+251 9..."
                    value={ownershipChangeForm.phone}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, phone: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#101828] mb-1">Contact Address</label>
                  <input
                    type="text"
                    placeholder="Address / Location"
                    value={ownershipChangeForm.contactInfo}
                    onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, contactInfo: e.target.value })}
                    className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                  />
                </div>
              </div>

              {/* Reason & Supporting Documentation */}
              <div>
                <label className="block text-[11px] font-semibold text-[#101828] mb-1">
                  Reason for Ownership Change <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Asset sale, Court order transfer, Corporate restructuring"
                  value={ownershipChangeForm.changeReason}
                  onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, changeReason: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#101828] mb-1">
                  Supporting Legal Document Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Title Deed Amendment Cert #TD-9921 / Notarized Sale Contract"
                  value={ownershipChangeForm.supportingDocument}
                  onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, supportingDocument: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#101828] mb-1">Ownership Change Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Additional governance notes"
                  value={ownershipChangeForm.remarks}
                  onChange={(e) => setOwnershipChangeForm({ ...ownershipChangeForm, remarks: e.target.value })}
                  className="w-full p-2 border border-[#E2E8F0] rounded text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowOwnershipChangeModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOwnershipChange}
                  className="btn-primary flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {submittingOwnershipChange ? 'Processing Change…' : 'Execute Ownership Change'}
                </button>
              </div>
            </form>
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

      {/* Module 3: Relationship & Allocation Modals */}
      {showM3LinkModal && (
        <CollateralFacilityLinkModal
          isOpen={showM3LinkModal}
          onClose={() => {
            setShowM3LinkModal(false);
            setM3LinkToEdit(null);
          }}
          onSuccess={() => {
            if (selectedCol) {
              loadM3SecuredFacilities(selectedCol.id);
              loadCollateral360(selectedCol.id);
              loadExposureSummary(selectedCol.id);
            }
            onRefreshData?.();
          }}
          currentUser={currentUser}
          mode={m3LinkModalMode}
          existingLink={m3LinkToEdit}
          preselectedCollateralId={selectedCol?.id}
          preselectedCollateral={selectedCol}
        />
      )}

      {showM3HistoryModal && (
        <RelationshipHistoryModal
          isOpen={showM3HistoryModal}
          onClose={() => setShowM3HistoryModal(false)}
          linkId={m3HistoryLinkId}
          collateralCode={selectedCol?.code}
          loanReference={m3HistoryRef}
        />
      )}

      {showM3ReconcileModal && (
        <CbsRelationshipReconcileModal
          isOpen={showM3ReconcileModal}
          onClose={() => setShowM3ReconcileModal(false)}
        />
      )}

      {/* Promotion Review Modal (Requirement 4) */}
      {showPromoteModal && promotingCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-bold">
                  ⚡ 1st
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Promote Subordinate Collateral to 1st Degree
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Formally elevate charge priority following discharge of prior first-degree charge.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPromoteModal(false);
                  setPromotingCol(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block text-[10px]">Collateral Code:</span>
                  <strong className="font-mono text-slate-900">{promotingCol.code}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Category / Type:</span>
                  <strong className="text-slate-900">{promotingCol.category} — {promotingCol.type || promotingCol.category}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Current Priority:</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">
                    2nd Degree Subordinate
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Market Valuation:</span>
                  <strong className="text-emerald-700 font-bold">
                    ETB {promotingCol.valuationAmount?.toLocaleString()}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 text-[11px] text-emerald-950 bg-emerald-50/70 p-2 rounded">
                <strong>Discharge Verification Reason:</strong> {promotingCol.promotionReason || 'Prior first-degree charge was released / closed in CBAIMS, qualifying this collateral for promotion.'}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Management Review &amp; Justification Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={promoteReviewNotes}
                onChange={(e) => setPromoteReviewNotes(e.target.value)}
                placeholder="Enter formal justification, cadastral extract confirmation, or Credit Committee approval reference..."
                className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:border-emerald-500"
              />
            </div>

            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900">
              ℹ️ Promoting this collateral updates its rank from <strong>2nd</strong> to <strong>1st</strong>, removes the subordination link, and triggers real-time recalculation of limit contributions and insurance adequacy.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowPromoteModal(false);
                  setPromotingCol(null);
                }}
                disabled={promoteSubmitting}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={promoteSubmitting || !promoteReviewNotes.trim()}
                onClick={async () => {
                  setPromoteSubmitting(true);
                  try {
                    const userId = currentUser?.username || currentUser?.name || 'MGRCOLLDOC';
                    const res = await cimsApi.promoteCollateralToFirstDegree(promotingCol.id, promoteReviewNotes.trim(), userId);
                    alert(`✓ Success: ${res.message || 'Collateral formally promoted to 1st-degree mortgage priority!'}`);
                    setShowPromoteModal(false);
                    setPromotingCol(null);
                    setShowDetailModal(false);
                    onRefreshData?.();
                  } catch (err: any) {
                    alert(`Promotion failed: ${err.message || err}`);
                  } finally {
                    setPromoteSubmitting(false);
                  }
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded shadow-xs transition-colors"
              >
                {promoteSubmitting ? 'Promoting…' : 'Confirm Promotion to 1st Degree'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* External Balance Refresh Modal (Requirement 4) */}
      {showRefreshBalModal && refreshingCol && (
        <div className="fixed inset-0 bg-[#00205B]/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 text-xs animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-100 text-indigo-800 rounded-lg font-bold">
                  🔄
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Update External 1st-Degree Balance
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Refresh external institution outstanding debt balance periodically.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRefreshBalModal(false);
                  setRefreshingCol(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div>
                <span className="text-slate-500 block text-[10px]">External Institution:</span>
                <strong className="text-slate-900">{refreshingCol.firstDegreeHolderName || 'External Financial Institution'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Facility Reference:</span>
                <strong className="text-slate-900 font-mono">{refreshingCol.firstDegreeFacilityRef || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Previous Balance:</span>
                <strong className="text-rose-700 tabular-nums">
                  ETB {(refreshingCol.firstDegreeOutstandingBalance || 0).toLocaleString()} (as of {refreshingCol.firstDegreeBalanceAsOfDate || '—'})
                </strong>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Updated Outstanding Balance (ETB) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={refreshBalAmt ?? ''}
                  onChange={(e) => setRefreshBalAmt(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded font-bold tabular-nums text-xs bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Confirmation "As Of" Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={refreshAsOfDate}
                  onChange={(e) => setRefreshAsOfDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setShowRefreshBalModal(false);
                  setRefreshingCol(null);
                }}
                disabled={refreshBalSubmitting}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refreshBalSubmitting || refreshBalAmt < 0}
                onClick={async () => {
                  setRefreshBalSubmitting(true);
                  try {
                    const userId = currentUser?.username || currentUser?.name || 'CRO_USER';
                    await cimsApi.refreshFirstDegreeBalance(refreshingCol.id, refreshBalAmt, refreshAsOfDate, userId);
                    alert(`✓ External first-degree balance updated to ETB ${refreshBalAmt.toLocaleString()} (as of ${refreshAsOfDate})!`);
                    setShowRefreshBalModal(false);
                    setRefreshingCol(null);
                    loadExposureSummary(refreshingCol.id);
                    loadCollateral360(refreshingCol.id);
                    onRefreshData?.();
                  } catch (err: any) {
                    alert(`Balance update failed: ${err.message || err}`);
                  } finally {
                    setRefreshBalSubmitting(false);
                  }
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded shadow-xs transition-colors"
              >
                {refreshBalSubmitting ? 'Updating…' : 'Update & Recalculate'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* =========================================================================
          MODAL: REQUEST INSURANCE COVERAGE EXCEPTION (BR-07 / BR-12)
          ========================================================================= */}
      {showAdequacyExceptionModal && selectedCol && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-[#00205B] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#D48806]" />
                Request Insurance Coverage Exception (BR-07 / BR-12)
              </h3>
              <button
                onClick={() => setShowAdequacyExceptionModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg text-purple-950 text-[11px] space-y-1">
              <strong>Supervisor Approval Required:</strong> Exceptions allow temporary acceptance of underinsured or overinsured collateral subject to formal supervisor review and expiration date monitoring. Expired exceptions automatically trigger re-evaluation.
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Collateral Master</label>
                <input
                  type="text"
                  readOnly
                  value={`${selectedCol.code} — ${selectedCol.description || selectedCol.type}`}
                  className="w-full p-2 border border-slate-200 rounded bg-slate-100 font-mono text-slate-700 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Exception Type *</label>
                  <select
                    value={adequacyExceptionForm.exceptionType}
                    onChange={(e) => setAdequacyExceptionForm({ ...adequacyExceptionForm, exceptionType: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded bg-white font-semibold"
                  >
                    <option value="Underinsured Approved Exception">Underinsured Accepted (Deficit Waiver)</option>
                    <option value="Overinsured Informational Acceptance">Overinsured Acceptance</option>
                    <option value="Missing Policy Temporary Grace">Missing Policy Temporary Grace</option>
                    <option value="Valuation Expiry Grace Period">Valuation Expiry Grace Period</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Approved Exception Amount (ETB) *</label>
                  <input
                    type="number"
                    min="0"
                    value={adequacyExceptionForm.approvedExceptionAmount ?? ''}
                    onChange={(e) => setAdequacyExceptionForm({ ...adequacyExceptionForm, approvedExceptionAmount: e.target.value === '' ? ('' as any) : Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded font-bold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Justification &amp; Business Reason *</label>
                <textarea
                  rows={2}
                  placeholder="Detail the credit justification, risk mitigants, or customer circumstances…"
                  value={adequacyExceptionForm.reason}
                  onChange={(e) => setAdequacyExceptionForm({ ...adequacyExceptionForm, reason: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Validity Period (Months) *</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={adequacyExceptionForm.validityMonths}
                    onChange={(e) => {
                      const m = Number(e.target.value);
                      const revDate = new Date(Date.now() + m * 30 * 86400000).toISOString().substring(0, 10);
                      setAdequacyExceptionForm({ ...adequacyExceptionForm, validityMonths: m, reviewDate: revDate });
                    }}
                    className="w-full p-2 border border-slate-300 rounded font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Review Date *</label>
                  <input
                    type="date"
                    value={adequacyExceptionForm.reviewDate}
                    onChange={(e) => setAdequacyExceptionForm({ ...adequacyExceptionForm, reviewDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Supporting Document Reference / DMS Doc ID</label>
                <input
                  type="text"
                  placeholder="e.g. DMS-EXC-2026-99120 / Credit Committee Minute #88"
                  value={adequacyExceptionForm.supportingDocRef}
                  onChange={(e) => setAdequacyExceptionForm({ ...adequacyExceptionForm, supportingDocRef: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowAdequacyExceptionModal(false)}
                className="btn-secondary"
                disabled={submittingAdequacyException}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAdequacyException || !adequacyExceptionForm.reason.trim()}
                onClick={async () => {
                  setSubmittingAdequacyException(true);
                  try {
                    await cimsApi.submitInsuranceException({
                      collateralId: selectedCol.id,
                      exceptionType: adequacyExceptionForm.exceptionType,
                      reason: adequacyExceptionForm.reason,
                      approvedExceptionAmount: adequacyExceptionForm.approvedExceptionAmount,
                      validityPeriodMonths: adequacyExceptionForm.validityMonths,
                      reviewDate: adequacyExceptionForm.reviewDate,
                      supportingDocRef: adequacyExceptionForm.supportingDocRef,
                    });
                    alert('✓ Insurance exception request submitted for supervisor approval.');
                    setShowAdequacyExceptionModal(false);
                    await loadAdequacyAssessment(selectedCol.id);
                  } catch (err: any) {
                    alert(`Failed to submit exception: ${err.message || err}`);
                  } finally {
                    setSubmittingAdequacyException(false);
                  }
                }}
                className="btn-primary bg-purple-700 hover:bg-purple-800 text-white font-bold"
              >
                {submittingAdequacyException ? 'Submitting…' : 'Submit for Supervisor Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: INITIATE EARLY COLLATERAL RELEASE REQUEST
          ========================================================================= */}
      {showEarlyReleaseModal && selectedCol && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-[#00205B] flex items-center gap-2">
                <Unlock className="w-4 h-4 text-[#D48806]" />
                Initiate Early Collateral Release Request
              </h3>
              <button
                onClick={() => setShowEarlyReleaseModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-blue-950 text-[11px] space-y-1">
              <strong>Maker-Checker Governance Notice:</strong> Release requests are evaluated across all linked facilities (BR-03). Approval strictly requires all 5 conditions (A-E) to pass. Once approved, CBS linkage removal must be recorded manually.
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Collateral Proposed for Release</label>
                <input
                  type="text"
                  readOnly
                  value={`${selectedCol.code} — ${selectedCol.description || selectedCol.type} (Valuation: ETB ${Number(selectedCol.valuationAmount || 0).toLocaleString()})`}
                  className="w-full p-2 border border-slate-200 rounded bg-slate-100 font-mono text-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Related Credit Facility Scope</label>
                <select
                  value={releaseFacilityId}
                  onChange={(e) => setReleaseFacilityId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white font-semibold"
                >
                  <option value="">ALL Linked Facilities (Full Asset Release)</option>
                  {colLinks.map((l) => (
                    <option key={l.id} value={l.loanAccountId}>
                      Facility #{l.loanAccountId} (Allocated: ETB {Number(l.allocatedAmount || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Business Reason for Early Release *</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Loan #LN-99210 fully settled; substitute collateral registered under COL-88129; borrower request approved by Credit Committee…"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">DMS Release Deed / Approval Document Reference *</label>
                <input
                  type="text"
                  placeholder="e.g. DOC-REL-DEED-2026-091"
                  value={releaseDmsDocId}
                  onChange={(e) => setReleaseDmsDocId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Condition E requirement: Release document must be uploaded to DMS.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowEarlyReleaseModal(false)}
                className="btn-secondary"
                disabled={submittingEarlyRelease}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingEarlyRelease || !releaseReason.trim() || !releaseDmsDocId.trim()}
                onClick={async () => {
                  setSubmittingEarlyRelease(true);
                  try {
                    await cimsApi.submitEarlyReleaseRequest({
                      collateralId: selectedCol.id,
                      proposedFacilityIds: releaseFacilityId ? [releaseFacilityId] : undefined,
                      reason: releaseReason,
                      dmsDocumentReference: releaseDmsDocId,
                    });
                    alert('✓ Early collateral release request created and routed for checker approval.');
                    setShowEarlyReleaseModal(false);
                    await loadPreReleaseImpact(selectedCol.id);
                    await loadActiveReleaseRequest(selectedCol.id);
                  } catch (err: any) {
                    alert(`Failed to submit release request: ${err.message || err}`);
                  } finally {
                    setSubmittingEarlyRelease(false);
                  }
                }}
                className="btn-primary bg-[#00205B] hover:bg-[#0E284E] text-white font-bold"
              >
                {submittingEarlyRelease ? 'Submitting…' : 'Submit for Checker Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: RECORD MANUAL CBS UPDATE OUTCOME
          ========================================================================= */}
      {showManualCbsModal && activeReleaseReq && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-[#00205B] flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Record Manual Core Banking System (CBS) Update
              </h3>
              <button
                onClick={() => setShowManualCbsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-950 text-[11px] space-y-1">
              <strong>Audit Trail Mandate:</strong> Enter the journal or reference voucher generated when the collateral detachment was manually processed in CBS. This updates the audit trail and releases monitoring.
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Release Request Reference</label>
                <input
                  type="text"
                  readOnly
                  value={activeReleaseReq.requestNumber || (activeReleaseReq.id ? String(activeReleaseReq.id) : '')}
                  className="w-full p-2 border border-slate-200 rounded bg-slate-100 font-mono text-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">CBS Delinkage Status *</label>
                <select
                  value={manualCbsStatus}
                  onChange={(e) => setManualCbsStatus(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded bg-white font-semibold"
                >
                  <option value="COMPLETED">COMPLETED — Manually Removed from CBS Loan Records</option>
                  <option value="PENDING">PENDING — Waiting on Branch / Operations Officer Action</option>
                  <option value="FAILED">FAILED — Error Encountered in CBS Delinkage</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">CBS Journal / Transaction Reference *</label>
                <input
                  type="text"
                  placeholder="e.g. CBS-DELINK-TXN-991208 / JRN-88192"
                  value={manualCbsRef}
                  onChange={(e) => setManualCbsRef(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Operating Officer Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Notes regarding CBS delinking confirmation or branch correspondence…"
                  value={manualCbsNotes}
                  onChange={(e) => setManualCbsNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowManualCbsModal(false)}
                className="btn-secondary"
                disabled={submittingManualCbs}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingManualCbs || !manualCbsRef.trim()}
                onClick={async () => {
                  setSubmittingManualCbs(true);
                  try {
                    await cimsApi.recordManualCbsUpdate(activeReleaseReq.id, {
                      cbsUpdateStatus: manualCbsStatus,
                      cbsReferenceNumber: manualCbsRef,
                      notes: manualCbsNotes,
                    });
                    alert('✓ Manual CBS update outcome recorded successfully in audit trail.');
                    setShowManualCbsModal(false);
                    if (selectedCol) {
                      await loadActiveReleaseRequest(selectedCol.id);
                    }
                  } catch (err: any) {
                    alert(`Failed to record CBS update: ${err.message || err}`);
                  } finally {
                    setSubmittingManualCbs(false);
                  }
                }}
                className="btn-primary bg-[#00205B] hover:bg-[#0E284E] text-white font-bold"
              >
                {submittingManualCbs ? 'Saving…' : 'Save CBS Update Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEnrichmentModal && colToEnrich && (
        <CollateralEnrichmentModal
          collateral={colToEnrich}
          branches={branches}
          segments={segments}
          onClose={() => {
            setShowEnrichmentModal(false);
            setColToEnrich(null);
          }}
          onSuccess={(updated) => {
            if (onRefreshData) onRefreshData();
            setSelectedCol(updated);
          }}
        />
      )}

      {showCbsSnapshotModal && colForSnapshot && (
        <CbsOriginalSnapshotModal
          collateral={colForSnapshot}
          onClose={() => {
            setShowCbsSnapshotModal(false);
            setColForSnapshot(null);
          }}
        />
      )}
    </div>
  );
};

// Helper for facility matching
function facIdOrRef(f: LoanAccount): string {
  return f.id;
}
