import React, { useState, useMemo, useEffect } from 'react';
import {
  User,
  Building,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Link2,
  Upload,
  Search,
  ArrowLeft,
  ArrowRight,
  Save,
  Check,
  Calendar,
  DollarSign,
  Layers,
  Briefcase,
  Clock,
  Plus,
  Trash2,
  HelpCircle,
  Info,
  Eye,
  Download,
  RefreshCw,
  Truck,
  Scale,
  Award,
  Users,
  ChevronRight,
  Lock,
} from 'lucide-react';
import {
  Collateral,
  Customer,
  LoanAccount,
  OwnershipDocument,
  CollateralTaxonomy,
  MandatoryDocumentRule,
  BusinessSegment,
  Branch,
  SystemParameter,
  UserSession,
  PolicyPreValidationResultDto,
  ValidationCheckItemDto,
  CollateralOwner,
} from '../../../types';
import { authenticatedFetch } from '../../../api/cimsApi';
import { FileUploadPreviewModal, FilePreviewData } from '../../common/FileUploadPreviewModal';

export interface CollateralRegistrationWizardProps {
  currentUser: UserSession;
  customers: Customer[];
  facilities: LoanAccount[];
  branches: Branch[];
  segments: BusinessSegment[];
  taxonomies?: CollateralTaxonomy[];
  mandatoryDocRules?: MandatoryDocumentRule[];
  systemParameters?: SystemParameter[];
  onClose: () => void;
  onSuccess: (collateral: Collateral) => void;
}

export interface WizardDocItem {
  id: string;
  name: string;
  type: string;
  fileName?: string;
  fileSize?: number;
  fileContent?: string;
  fileUrl?: string;
  referenceNumber?: string;
  documentDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  remarks?: string;
  verificationStatus: string;
  isMandatory: boolean;
  ruleId?: string;
  exceptionAllowed?: boolean;
}

export interface SupportingDocItem {
  id: string;
  name: string;
  type: string;
  fileName?: string;
  fileSize?: number;
  fileContent?: string;
  fileUrl?: string;
  referenceNumber?: string;
  documentDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  remarks?: string;
  verificationStatus: string;
}

// Canonical 6 Categories and Subtypes (Part 3)
const CANONICAL_TAXONOMY: Record<string, string[]> = {
  'Immovable Properties': [
    'Buildings - Commercial',
    'Buildings - Residential',
    'Buildings - Mixed-use',
    'Coffee Sites',
    'Land Use Rights',
  ],
  'Movable Properties': [
    'Vehicles',
    'Construction Machineries',
  ],
  'Business Mortgages': [
    'Industrial Machinery',
    'Office Machinery',
    'Furniture',
  ],
  'Financial Assets': [
    'Marketable Shares - Banks',
    'Marketable Shares - Insurance Companies',
    'Negotiable Bills of Payments',
    'Cash and Cash Substitutes - Blocked Accounts',
    'Cash and Cash Substitutes - Treasury Bills',
  ],
  'Agricultural/Other': [
    'Livestock',
    'Farm Products',
    'Warehouse Receipts',
    'Intellectual Property Rights',
  ],
  'Guarantees': [
    'Personal Guarantee',
  ],
};

const RELATIONSHIP_TYPES = [
  'Shareholder',
  'Parent Company',
  'Director',
  'Guarantor',
  'Spouse',
  'Family Member',
  'Business Partner',
  'Other',
];

export const CollateralRegistrationWizard: React.FC<CollateralRegistrationWizardProps> = ({
  currentUser,
  customers,
  facilities,
  branches,
  segments,
  taxonomies = [],
  mandatoryDocRules = [],
  systemParameters = [],
  onClose,
  onSuccess,
}) => {
  // 11 Wizard Steps
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Reference Code & Initiation
  const [regCode] = useState<string>(() => `COL-${Math.floor(100000 + Math.random() * 900000)}`);
  const [regDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [selectedBranch, setSelectedBranch] = useState<string>(currentUser.branch || 'Bole Special Branch');
  const [selectedSegment, setSelectedSegment] = useState<string>(
    segments.find((s) => s.active !== false)?.name || 'Corporate Banking'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('Immovable Properties');
  const [selectedSubtype, setSelectedSubtype] = useState<string>('Buildings - Commercial');
  const [regStatus, setRegStatus] = useState<string>('Pending Approval');

  // Borrower Selection (Page 2)
  const [borrowerSearchQuery, setBorrowerSearchQuery] = useState<string>('');
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>('');

  // Legal Collateral Owner (Page 3)
  const [ownershipType, setOwnershipType] = useState<'Borrower-owned' | 'Third-party-owned' | 'Jointly-owned'>('Borrower-owned');
  const [tpIsExistingCustomer, setTpIsExistingCustomer] = useState<boolean>(false);
  const [tpCustomerSearchQuery, setTpCustomerSearchQuery] = useState<string>('');
  const [tpSelectedCustomerId, setTpSelectedCustomerId] = useState<string>('');
  const [tpOwnerForm, setTpOwnerForm] = useState<{
    ownerType: 'Individual' | 'Business Organization';
    name: string;
    idNumber: string;
    businessRegNo: string;
    tin: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    percentage: number;
    relationshipToBorrower: string;
    relationshipDescription: string;
  }>({
    ownerType: 'Individual',
    name: '',
    idNumber: '',
    businessRegNo: '',
    tin: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    percentage: 100,
    relationshipToBorrower: 'Guarantor',
    relationshipDescription: '',
  });

  // Joint Owners list
  const [jointOwners, setJointOwners] = useState<CollateralOwner[]>([]);
  const [newJointOwner, setNewJointOwner] = useState<Partial<CollateralOwner>>({
    name: '',
    ownerType: 'Individual',
    idNumber: '',
    tin: '',
    phone: '',
    relationshipToBorrower: 'Shareholder',
    percentage: 50,
  });

  // Asset Details (Page 4)
  const [assetDetails, setAssetDetails] = useState<Partial<Collateral>>({
    description: '',
    location: '',
    locationRegion: 'Addis Ababa',
    locationZone: 'Zone 1',
    locationCity: 'Addis Ababa',
    locationSubcity: 'Bole Subcity',
    locationWoreda: 'Woreda 03',
    locationKebele: 'Kebele 08',
    locationAddress: '',
    gpsCoordinates: '9.0125, 38.7610',
    propertyCertNumber: '',
    titleDeedNumber: '',
    registrationNumber: '',
    tinNumber: '',
    buildingType: 'Commercial',
    buildingUse: 'Office & Retail Complex',
    isUnderConstruction: false,
    constructionCompletionPct: 0,
    constructionRemainingPct: 100,
    constructionInspectionDate: '',
    expectedCompletionDate: '',
    engineeringReportDocId: '',
    // Movables & Machineries
    vehicleType: 'Sedan',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: 2022,
    vehiclePlateNumber: '',
    vehicleChassisNumber: '',
    vehicleEngineNumber: '',
    machineryType: 'Excavator',
    machineryManufacturer: '',
    machineryModel: '',
    machinerySerialNo: '',
    machineryPurchaseDate: '',
    machineryOwnershipCertRef: '',
    machineryPurchaseDocRef: '',
    furnitureType: 'Office Workstations & Executive Desks',
    furnitureQuantity: 25,
    // Financial Assets
    shareIssuer: 'Dashen Bank S.C.',
    shareType: 'Ordinary Shares',
    shareQuantity: 5000,
    shareFaceValue: 1000,
    shareCertRef: '',
    billDrawer: '',
    billDrawee: '',
    billIssueDate: '',
    billMaturityDate: '',
    billFaceValue: 0,
    billReference: '',
    billPaymentPlace: 'Addis Ababa',
    blockedAccountNumber: '',
    depositAmount: 0,
    depositCurrency: 'ETB',
    depositMaturityDate: '',
    pledgeConfirmationRef: '',
    treasuryBillSeries: '',
    treasuryBillFaceValue: 0,
    treasuryBillIssueDate: '',
    treasuryBillMaturityDate: '',
    custodyAccountRef: '',
    // Agricultural / Other
    livestockTagNumber: '',
    livestockBreed: 'Boran / Zebu Cross',
    livestockQuantity: 100,
    veterinaryHealthCertDate: '',
    farmCropType: 'Export Quality Arabica Coffee',
    farmLandHoldingCert: '',
    farmQuantity: 500,
    farmStorageLocation: 'Central Warehouse Oromia',
    farmHarvestSeason: '2025/2026',
    warehouseReceiptNumber: '',
    warehouseName: 'Ethiopian Commodity Exchange (ECX) Hawassa Silo',
    warehouseCommodityType: 'Specialty Grade 1 Washed Coffee',
    warehouseQuantity: 120,
    warehouseReceiptDate: '',
    warehouseExpiryDate: '',
    warehouseInspectionRef: '',
    ipRegistrationNumber: '',
    ipTitle: '',
    ipType: 'Trademark',
    ipFilingDate: '',
    ipRegistrationDate: '',
    ipExpiryDate: '',
    ipAuthority: 'Ethiopian Intellectual Property Authority (EIPA)',
    // Guarantees
    guarantorName: '',
    guarantorCif: '',
    guarantorIdNumber: '',
    guarantorTin: '',
    guarantorContact: '',
    guarantorAddress: '',
    guaranteeAgreementRef: '',
    guaranteeAmount: 0,
    guaranteeEffectiveDate: '',
    guaranteeExpiryDate: '',
    boardResolutionRef: '',
    // Coffee Sites & Land Use Rights
    coffeeSiteLocation: '',
    coffeeSiteCertRef: '',
    landUseRightCertRef: '',
  });

  // Valuation (Page 5)
  const [estimatedValue, setEstimatedValue] = useState<number>(5000000);
  const [estimatedValueSource, setEstimatedValueSource] = useState<string>('Market Price Benchmark');
  const [bankAssessedValue, setBankAssessedValue] = useState<number>(4500000);
  const [landValue, setLandValue] = useState<number>(1000000);
  const [insuranceValue, setInsuranceValue] = useState<number>(3500000);
  const [haircutPct, setHaircutPct] = useState<number>(20);
  const [valuationDate, setValuationDate] = useState<string>(regDate);
  const [valuationReportRef, setValuationReportRef] = useState<string>(`VAL-REP-${Math.floor(10000 + Math.random() * 90000)}`);
  const [valuatorOfficer, setValuatorOfficer] = useState<string>('Senior Bank Valuation Engineer');
  const [valuationReviewDate, setValuationReviewDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().substring(0, 10);
  });

  // Net Collateral Value Calculation: Valuation Amount * (1 - Haircut / 100)
  const netCollateralValue = useMemo(() => {
    const val = Number(bankAssessedValue) || 0;
    const hc = Number(haircutPct) || 0;
    return Math.round(val * (1.0 - hc / 100.0) * 100.0) / 100.0;
  }, [bankAssessedValue, haircutPct]);

  // Security Rank & Mortgages (Page 6)
  const [securityRank, setSecurityRank] = useState<'1st' | '2nd'>('1st');
  const [isFirstDegreeInternal, setIsFirstDegreeInternal] = useState<boolean>(true);
  const [firstDegreeCollateralId, setFirstDegreeCollateralId] = useState<string>('');
  const [firstDegreeHolderName, setFirstDegreeHolderName] = useState<string>('');
  const [firstDegreeFacilityRef, setFirstDegreeFacilityRef] = useState<string>('');
  const [firstDegreeOutstandingBalance, setFirstDegreeOutstandingBalance] = useState<number>(0);
  const [firstDegreeBalanceAsOfDate, setFirstDegreeBalanceAsOfDate] = useState<string>('');
  const [registeredMortgageAmount, setRegisteredMortgageAmount] = useState<number>(0);
  const [mortgageRegistrationNumber, setMortgageRegistrationNumber] = useState<string>('');
  const [mortgageRegistrationDate, setMortgageRegistrationDate] = useState<string>('');
  const [firstDegreePolicyNumber, setFirstDegreePolicyNumber] = useState<string>('');
  const [firstDegreeInsurer, setFirstDegreeInsurer] = useState<string>('');
  const [firstDegreePolicyExpiry, setFirstDegreePolicyExpiry] = useState<string>('');
  const [bankNotedAsSecondMortgagee, setBankNotedAsSecondMortgagee] = useState<boolean>(false);

  // Documents (Page 7)
  const [documentsList, setDocumentsList] = useState<WizardDocItem[]>([]);
  const [supportingDocumentsList, setSupportingDocumentsList] = useState<SupportingDocItem[]>([]);
  const [showAddSupportingDocModal, setShowAddSupportingDocModal] = useState<boolean>(false);
  const [preUploadPreview, setPreUploadPreview] = useState<FilePreviewData | null>(null);
  const [showPreUploadModal, setShowPreUploadModal] = useState<boolean>(false);
  const [supportingDocForm, setSupportingDocForm] = useState<Partial<SupportingDocItem>>({
    name: '',
    type: 'Valuation Report',
    referenceNumber: '',
    documentDate: regDate,
    expiryDate: '',
    issuingAuthority: '',
    remarks: '',
    verificationStatus: 'Pending Verification',
  });

  // Facility Linkages & Allocations (Page 8)
  const [facilitySearchQuery, setFacilitySearchQuery] = useState<string>('');
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);
  const [facilityAllocations, setFacilityAllocations] = useState<Record<string, number>>({});
  const [facilityLinkageTypes, setFacilityLinkageTypes] = useState<Record<string, string>>({});

  // Validation Results (Page 9)
  const [preValidationResult, setPreValidationResult] = useState<PolicyPreValidationResultDto | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Exception Request (Page 10)
  const [exceptionForm, setExceptionForm] = useState<{
    exceptionType: string;
    failedRequirement: string;
    reason: string;
    comments: string;
    validityDays: number;
    evidenceDocument: string;
    evidenceFileContent: string;
  }>({
    exceptionType: 'Missing Mandatory Document',
    failedRequirement: '',
    reason: '',
    comments: '',
    validityDays: 90,
    evidenceDocument: '',
    evidenceFileContent: '',
  });
  const [exceptionSubmitted, setExceptionSubmitted] = useState<boolean>(false);
  const [isSubmittingException, setIsSubmittingException] = useState<boolean>(false);
  const [exceptionMessage, setExceptionMessage] = useState<string>('');

  // Per-Requirement Exception Tracking (Page 7 & Page 11)
  const [collateralExceptions, setCollateralExceptions] = useState<{
    ruleId?: string;
    exceptionType?: string;
    failedRequirement: string;
    documentType: string;
    reason: string;
    comments?: string;
    validityDays?: number;
    evidenceDocument?: string;
  }[]>([]);
  const [activeModalException, setActiveModalException] = useState<{
    ruleId?: string;
    documentType: string;
    isEdit?: boolean;
  } | null>(null);
  const [modalExceptionReason, setModalExceptionReason] = useState<string>('');
  const [modalExceptionComments, setModalExceptionComments] = useState<string>('');
  const [modalExceptionDays, setModalExceptionDays] = useState<number>(30);
  const [modalExceptionEvidence, setModalExceptionEvidence] = useState<string>('');

  // Normalized document type matcher
  const docTypeMatches = (ruleType?: string, actualType?: string): boolean => {
    if (!ruleType || !actualType) return false;
    const r = ruleType.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    const a = actualType.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (r === a) return true;

    const rIsPledge = r.includes('consent') && (r.includes('pledge') || r.includes('third party') || r.includes('thirdparty'));
    const aIsPledge = a.includes('consent') && (a.includes('pledge') || a.includes('third party') || a.includes('thirdparty'));
    if (rIsPledge && aIsPledge) return true;

    const rIsLetter = r.includes('letter') && r.includes('consent');
    const aIsLetter = a.includes('letter') && a.includes('consent');
    if (rIsLetter && aIsLetter) return true;

    const rIsTitle = r.includes('title deed') || r.includes('property ownership') || r.includes('ownership cert');
    const aIsTitle = a.includes('title deed') || a.includes('property ownership') || a.includes('ownership cert');
    if (rIsTitle && aIsTitle) return true;
    if (rIsTitle !== aIsTitle && (rIsTitle || aIsTitle)) {
      if (a.includes('valuation') || a.includes('building plan') || a.includes('logbook') || a.includes('vehicle reg')) return false;
    }

    const rIsPlan = r.includes('building plan') || r.includes('cadastral') || r.includes('site plan');
    const aIsPlan = a.includes('building plan') || a.includes('cadastral') || a.includes('site plan');
    if (rIsPlan && aIsPlan) return true;
    if (rIsPlan !== aIsPlan && (rIsPlan || aIsPlan)) {
      if (a.includes('title deed') || a.includes('valuation') || a.includes('vehicle')) return false;
    }

    const rIsVehicle = r.includes('vehicle') || r.includes('logbook') || r.includes('libre');
    const aIsVehicle = a.includes('vehicle') || a.includes('logbook') || a.includes('libre');
    if (rIsVehicle && aIsVehicle) return true;
    if (rIsVehicle !== aIsVehicle && (rIsVehicle || aIsVehicle)) {
      if (a.includes('title deed') || a.includes('building') || a.includes('machinery')) return false;
    }

    const rIsVal = r.includes('valuation');
    const aIsVal = a.includes('valuation');
    if (rIsVal && aIsVal) return true;
    if (rIsVal !== aIsVal && (rIsVal || aIsVal)) {
      if (a.includes('title deed') || a.includes('building plan') || a.includes('logbook')) return false;
    }

    const rIsMach = r.includes('machinery');
    const aIsMach = a.includes('machinery') || a.includes('purchase invoice') || a.includes('bill of sale');
    if (rIsMach && aIsMach) return true;

    const rIsMortgage = r.includes('mortgage') && (r.includes('registration') || r.includes('confirmation'));
    const aIsMortgage = a.includes('mortgage') && (a.includes('registration') || a.includes('confirmation'));
    if (rIsMortgage && aIsMortgage) return true;

    return r.includes(a) || a.includes(r);
  };

  // Final Submission (Page 11)
  const [isSubmittingFinal, setIsSubmittingFinal] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Selected Borrower Object
  const selectedBorrower = useMemo(() => {
    return customers.find((c: Customer) => c.id === selectedBorrowerId || c.cif === selectedBorrowerId);
  }, [customers, selectedBorrowerId]);

  // Selected Third-Party Owner Object (if existing customer)
  const selectedTpCustomer = useMemo(() => {
    return customers.find((c: Customer) => c.id === tpSelectedCustomerId || c.cif === tpSelectedCustomerId);
  }, [customers, tpSelectedCustomerId]);

  // Subtype catalog based on chosen Category
  const availableSubtypes = useMemo(() => {
    const list: string[] = [];
    (taxonomies || []).forEach((t) => {
      if ((t.category || '').trim().toLowerCase() === selectedCategory.trim().toLowerCase() && t.subCategory) {
        const sub = t.subCategory.trim();
        if (!list.includes(sub) && sub.toLowerCase() !== selectedCategory.toLowerCase()) {
          list.push(sub);
        }
      }
    });
    if (list.length > 0) return list;
    return CANONICAL_TAXONOMY[selectedCategory] || ['General'];
  }, [selectedCategory, taxonomies]);

  // Ensure subtype remains valid when category changes
  useEffect(() => {
    if (availableSubtypes.length > 0 && !availableSubtypes.includes(selectedSubtype)) {
      setSelectedSubtype(availableSubtypes[0]);
    }
  }, [availableSubtypes, selectedSubtype]);

  // Build Dynamic Document Checklist exclusively from Admin-Configured Mandatory Rules (Directive 1)
  const dynamicDocumentChecklist = useMemo(() => {
    if (!mandatoryDocRules || mandatoryDocRules.length === 0) return [];

    const cat = (selectedCategory || '').toLowerCase().trim();
    const sub = (selectedSubtype || '').toLowerCase().trim();
    const isUnderCon = !!assetDetails.isUnderConstruction;
    const isTp = ownershipType === 'Third-party-owned';
    const isSecDegree = securityRank === '2nd';

    // Only active rules configured in Admin
    const activeRules = mandatoryDocRules.filter((r) => r.mandatory !== false);

    return activeRules
      .filter((rule) => {
        const rc = (rule.collateralCategory || '').toLowerCase().trim();
        const rt = (rule.collateralType || '').toLowerCase().trim();
        const oc = (rule.ownershipCondition || '').toLowerCase().trim();
        const ac = (rule.applicabilityCondition || '').toLowerCase().trim();

        // 1. Category match
        const catMatch = !rc || rc === 'all' || rc === 'all categories' || rc === cat || rc.includes(cat) || cat.includes(rc);
        if (!catMatch) return false;

        // 2. Subtype match if specified
        if (rt && rt !== 'all' && rt !== 'all types') {
          const typeMatch = rt === sub || rt.includes(sub) || sub.includes(rt);
          if (!typeMatch) return false;
        }

        // 3. Ownership condition if specified
        if (oc && oc !== 'all' && oc !== 'any') {
          if (oc.includes('third') && !isTp) return false;
          if (oc.includes('borrower') && isTp) return false;
        }

        // 4. Applicability condition if specified
        if (ac && ac !== 'none' && ac !== 'all') {
          if (ac.includes('construction') && !isUnderCon) return false;
          if (ac.includes('lease') && !sub.includes('lease') && !(assetDetails.propertyCertNumber || '').toLowerCase().includes('lease')) return false;
          if ((ac.includes('second') || ac.includes('2nd')) && !isSecDegree) return false;
        }

        return true;
      })
      .map((rule) => ({
        name: rule.documentType,
        type: rule.documentType,
        isMandatory: rule.mandatory !== false,
        reason: rule.applicabilityCondition || rule.collateralCategory || 'Admin Mandatory Document Policy',
        ruleId: rule.id,
        exceptionAllowed: rule.exceptionAllowed !== false,
      }));
  }, [
    mandatoryDocRules,
    selectedCategory,
    selectedSubtype,
    assetDetails.isUnderConstruction,
    assetDetails.propertyCertNumber,
    ownershipType,
    securityRank,
  ]);

  // Synchronize documentsList when dynamic checklist changes
  useEffect(() => {
    setDocumentsList((prev) => {
      const existingMap = new Map(prev.map((d) => [d.type.toLowerCase(), d]));

      const updated: WizardDocItem[] = dynamicDocumentChecklist.map((item, idx) => {
        const existing = existingMap.get(item.type.toLowerCase());
        if (existing) {
          return {
            ...existing,
            name: item.name,
            remarks: item.reason,
            isMandatory: item.isMandatory,
            ruleId: item.ruleId,
            exceptionAllowed: item.exceptionAllowed,
          };
        }
        return {
          id: `doc-wiz-${Math.floor(10000 + Math.random() * 90000)}-${idx}`,
          name: item.name,
          type: item.type,
          referenceNumber: '',
          documentDate: regDate,
          expiryDate: '',
          issuingAuthority: '',
          remarks: item.reason,
          verificationStatus: 'Not Uploaded',
          isMandatory: item.isMandatory,
          ruleId: item.ruleId,
          exceptionAllowed: item.exceptionAllowed,
        };
      });

      // Preserve any custom user-added documents that have content
      prev
        .filter(
          (d) =>
            !dynamicDocumentChecklist.some((item) => item.type.toLowerCase() === d.type.toLowerCase()) &&
            (d.fileName || d.fileContent)
        )
        .forEach((customDoc) => updated.push(customDoc));

      return updated;
    });
  }, [dynamicDocumentChecklist, regDate]);

  // Filter CBS loans for borrower
  const eligibleLoans = useMemo(() => {
    if (!selectedBorrowerId) return [];
    return facilities.filter((l: LoanAccount) => {
      const matchCust =
        l.customerId === selectedBorrowerId ||
        (selectedBorrower && l.customerId === selectedBorrower.cif) ||
        (selectedBorrower && l.customerId === selectedBorrower.id);
      if (!matchCust) return false;
      if (!facilitySearchQuery) return true;
      const q = facilitySearchQuery.toLowerCase();
      return (
        l.loanReference.toLowerCase().includes(q) ||
        (l.facilityType && l.facilityType.toLowerCase().includes(q))
      );
    });
  }, [facilities, selectedBorrowerId, selectedBorrower, facilitySearchQuery]);

  // Total allocated security amount
  const totalAllocated = useMemo(() => {
    return Object.values(facilityAllocations).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [facilityAllocations]);

  const remainingCapacity = useMemo(() => {
    return Math.max(0, netCollateralValue - totalAllocated);
  }, [netCollateralValue, totalAllocated]);

  const isAllocationOverflow = useMemo(() => {
    return totalAllocated > netCollateralValue + 0.01;
  }, [totalAllocated, netCollateralValue]);

  // Construct Final Collateral Payload
  const buildCollateralPayload = (statusToSet: string): Collateral => {
    // Owners list
    const owners: CollateralOwner[] = [];
    if (ownershipType === 'Borrower-owned' && selectedBorrower) {
      owners.push({
        id: `own-${regCode}-borrower`,
        collateralId: regCode,
        name: selectedBorrower.name,
        ownershipType: 'Borrower-owned',
        ownerType: selectedBorrower.customerType || 'Corporate',
        phone: selectedBorrower.phone || '+251911000000',
        relationship: 'Borrower',
        relationshipToBorrower: 'Borrower',
        percentage: 100,
        verificationStatus: 'Recorded',
        makerId: currentUser.username,
      });
    } else if (ownershipType === 'Third-party-owned') {
      if (tpIsExistingCustomer && selectedTpCustomer) {
        owners.push({
          id: `own-${regCode}-tp-cbs`,
          collateralId: regCode,
          name: selectedTpCustomer.name,
          ownershipType: 'Third-party-owned',
          ownerType: selectedTpCustomer.customerType || 'Individual',
          phone: selectedTpCustomer.phone || '+251911000000',
          idNumber: selectedTpCustomer.nationalId || selectedTpCustomer.businessRegNo || '',
          tin: selectedTpCustomer.taxIdNo || '',
          relationship: tpOwnerForm.relationshipToBorrower,
          relationshipToBorrower: tpOwnerForm.relationshipToBorrower,
          relationshipDescription: tpOwnerForm.relationshipDescription,
          percentage: 100,
          consentInfo: 'Signed Tripartite Collateral Pledge',
          verificationStatus: 'Recorded',
          makerId: currentUser.username,
        });
      } else {
        owners.push({
          id: `own-${regCode}-tp-manual`,
          collateralId: regCode,
          name: tpOwnerForm.name || 'Third-Party Asset Owner',
          ownershipType: 'Third-party-owned',
          ownerType: tpOwnerForm.ownerType,
          phone: tpOwnerForm.phone || '+251911000000',
          idNumber: tpOwnerForm.idNumber,
          businessRegNo: tpOwnerForm.businessRegNo,
          tin: tpOwnerForm.tin,
          relationship: tpOwnerForm.relationshipToBorrower,
          relationshipToBorrower: tpOwnerForm.relationshipToBorrower,
          relationshipDescription: tpOwnerForm.relationshipDescription,
          percentage: tpOwnerForm.percentage || 100,
          consentInfo: 'Signed Notarized Third-Party Consent',
          verificationStatus: 'Recorded',
          makerId: currentUser.username,
        });
      }
    } else if (ownershipType === 'Jointly-owned') {
      jointOwners.forEach((jo, idx) => {
        owners.push({
          ...jo,
          id: jo.id || `own-${regCode}-joint-${idx + 1}`,
          collateralId: regCode,
          makerId: currentUser.username,
          verificationStatus: 'Recorded',
        });
      });
    }

    return {
      id: `col-${regCode.toLowerCase()}`,
      code: regCode,
      category: selectedCategory,
      type: selectedSubtype,
      description: assetDetails.description || `${selectedSubtype} secured under ${regCode}`,
      customerId: selectedBorrower ? (selectedBorrower.id || selectedBorrower.cif) : '',
      branch: selectedBranch,
      owningSegment: selectedSegment as any,
      currency: 'ETB',
      status: statusToSet,
      ownerType: ownershipType,
      tangible: selectedCategory !== 'Financial Assets' && selectedCategory !== 'Guarantees',
      secured: true,
      chargeType: 'Mortgage',
      valuationAmount: bankAssessedValue,
      haircut: haircutPct,
      nsv: netCollateralValue,
      limitContribution: netCollateralValue,
      valuationDate: valuationDate,
      valuationMethod: 'Bank Approved Independent Valuation',
      insuredAmount: insuranceValue,
      netInsuranceCoveragePct: bankAssessedValue > 0 ? (insuranceValue / bankAssessedValue) * 100 : 0,
      insuranceStatus: insuranceValue >= bankAssessedValue ? 'Adequately Insured' : 'Underinsured',
      verificationStatus: statusToSet === 'Draft' ? 'Pending' : 'Recorded',
      makerId: currentUser.username,
      makerDtStamp: new Date().toISOString(),
      recordStat: 'U',
      authStat: 'U',
      owners: owners,
      // Valuation fields
      estimatedValue: estimatedValue,
      estimatedValueSource: estimatedValueSource,
      insurableValue: bankAssessedValue,
      landValue: landValue,
      // Security rank fields
      collateralRank: securityRank,
      isFirstDegreeInternal: isFirstDegreeInternal,
      firstDegreeCollateralId: firstDegreeCollateralId,
      firstDegreeHolderName: firstDegreeHolderName,
      firstDegreeFacilityRef: firstDegreeFacilityRef,
      firstDegreeOutstandingBalance: firstDegreeOutstandingBalance,
      firstDegreeBalanceAsOfDate: firstDegreeBalanceAsOfDate,
      registeredMortgageAmount: registeredMortgageAmount,
      mortgageRegistrationNumber: mortgageRegistrationNumber,
      mortgageRegistrationDate: mortgageRegistrationDate,
      firstDegreePolicyNumber: firstDegreePolicyNumber,
      firstDegreeInsurer: firstDegreeInsurer,
      firstDegreePolicyExpiry: firstDegreePolicyExpiry,
      bankNotedAsSecondMortgagee: bankNotedAsSecondMortgagee,
      // Asset details
      ...assetDetails,
    };
  };

  // Convert wizard documents for backend DMS payload
  const buildDocumentsPayload = () => {
    const mandatoryPayload = documentsList
      .filter((d) => d.fileContent || d.fileName)
      .map((d) => ({
        name: d.name,
        type: d.type,
        docName: d.name,
        docType: d.type,
        fileName: d.fileName || `${d.type.replace(/\s+/g, '_')}.pdf`,
        fileContent: d.fileContent || 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
        fileSize: d.fileSize || 102400,
        referenceNumber: d.referenceNumber,
        expiryDate: d.expiryDate,
        remarks: d.remarks,
        verificationStatus: d.verificationStatus || 'Pending Verification',
      }));

    const supportingPayload = supportingDocumentsList
      .filter((d) => d.fileContent || d.fileName)
      .map((d) => ({
        name: d.name,
        type: d.type,
        docName: d.name,
        docType: d.type,
        fileName: d.fileName || `${d.type.replace(/\s+/g, '_')}.pdf`,
        fileContent: d.fileContent || 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
        fileSize: d.fileSize || 102400,
        referenceNumber: d.referenceNumber,
        expiryDate: d.expiryDate,
        remarks: d.remarks || 'Supporting Document — Not a Mandatory Rule',
        verificationStatus: d.verificationStatus || 'Pending Verification',
      }));

    return [...mandatoryPayload, ...supportingPayload];
  };

  // Convert allocations for backend payload
  const buildAllocationsPayload = () => {
    return selectedFacilityIds.map((facId) => ({
      facilityId: facId,
      loanAccountId: facId,
      allocatedAmount: facilityAllocations[facId] || 0,
      linkageType: facilityLinkageTypes[facId] || 'Primary',
    }));
  };

  // Run Pre-Validation (Page 9)
  const runPreValidation = async () => {
    setIsValidating(true);
    setErrorMessage('');
    try {
      const colPayload = buildCollateralPayload(regStatus);
      const docsPayload = buildDocumentsPayload();
      const allocsPayload = buildAllocationsPayload();
      const ownersPayload = colPayload.owners?.map((o: CollateralOwner) => ({
        name: o.name,
        ownerType: o.ownerType,
        idNumber: o.idNumber,
        businessRegistrationNumber: o.businessRegNo,
        tin: o.tin,
        relationshipToBorrower: o.relationshipToBorrower || o.relationship,
        percentage: o.percentage,
        status: 'Active',
      })) || [];

      const res = await authenticatedFetch('/api/collateral/pre-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collateral: colPayload,
          documents: docsPayload,
          allocations: allocsPayload,
          owners: ownersPayload,
          exceptions: collateralExceptions,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Validation request failed' }));
        throw new Error(err.message || `Validation failed (${res.status})`);
      }

      const valResult: PolicyPreValidationResultDto = await res.json();
      setPreValidationResult(valResult);

      // Auto-populate exception target if there are overrideable failures
      const firstOverrideable = valResult.checks?.find((c: ValidationCheckItemDto) => !c.passed && c.overrideable);
      if (firstOverrideable) {
        setExceptionForm((prev) => ({
          ...prev,
          exceptionType: firstOverrideable.exceptionType || 'Missing Mandatory Document',
          failedRequirement: firstOverrideable.failedRequirement || firstOverrideable.exceptionTarget || firstOverrideable.ruleName || firstOverrideable.name || 'Missing Requirement',
        }));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Validation request failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Submit Exception Request (Page 10)
  const handleSubmitException = async () => {
    if (!exceptionForm.reason.trim()) {
      alert('Business justification / reason is mandatory when requesting an exception.');
      return;
    }
    if (!exceptionForm.comments.trim()) {
      alert('Risk mitigation comments / remarks are mandatory.');
      return;
    }

    setIsSubmittingException(true);
    setExceptionMessage('');
    try {
      const colPayload = buildCollateralPayload('Pending Exception Approval');
      const docsPayload = buildDocumentsPayload();

      const payload = {
        exceptionType: exceptionForm.exceptionType,
        failedRequirement: exceptionForm.failedRequirement,
        reason: exceptionForm.reason,
        comments: exceptionForm.comments,
        entityType: 'Collateral',
        entityId: colPayload.id,
        customerId: colPayload.customerId,
        collateral: colPayload,
        documents: docsPayload,
      };

      const res = await authenticatedFetch(`/api/collateral/submit-exception-request?userId=${encodeURIComponent(currentUser.username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Exception request failed');
      }

      setExceptionSubmitted(true);
      setExceptionMessage(`Exception requested successfully. Routed to Checker / Credit Risk Approver for approval. (Task: ${data.workflowTaskId || 'WF-EXP-01'})`);
    } catch (err: any) {
      alert(err.message || 'Failed to submit exception request');
    } finally {
      setIsSubmittingException(false);
    }
  };

  // Save Draft Collateral
  const handleSaveDraft = async () => {
    try {
      const colPayload = buildCollateralPayload('Draft');
      const docsPayload = buildDocumentsPayload();
      const allocsPayload = buildAllocationsPayload();

      const res = await authenticatedFetch(`/api/collateral/register-with-allocations?userId=${encodeURIComponent(currentUser.username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collateral: colPayload,
          documents: docsPayload,
          allocations: allocsPayload,
          exceptions: collateralExceptions,
          isDraft: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Failed to save draft');
      }

      alert(`Collateral Draft saved successfully with reference: ${colPayload.code}`);
      setRegStatus('Draft');
    } catch (err: any) {
      alert(err.message || 'Error saving collateral draft');
    }
  };

  // Submit Final Registration (Page 11)
  const handleFinalSubmit = async () => {
    setIsSubmittingFinal(true);
    setErrorMessage('');
    try {
      const targetStatus = collateralExceptions.length > 0 ? 'Pending Exception Approval' : 'Pending Approval';
      const colPayload = buildCollateralPayload(targetStatus);
      const docsPayload = buildDocumentsPayload();
      const allocsPayload = buildAllocationsPayload();

      const res = await authenticatedFetch(`/api/collateral/register-with-allocations?userId=${encodeURIComponent(currentUser.username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collateral: colPayload,
          documents: docsPayload,
          allocations: allocsPayload,
          exceptions: collateralExceptions,
          isDraft: false,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Registration failed');
      }

      setSubmissionResult(data);
      if (data.collateral) {
        onSuccess(data.collateral);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission failed');
    } finally {
      setIsSubmittingFinal(false);
      setShowConfirmModal(false);
    }
  };

  // Handle Mock File Upload for Documents
  const handleDocumentFileChange = (docIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      setDocumentsList((prev) => {
        const copy = [...prev];
        copy[docIndex] = {
          ...copy[docIndex],
          fileName: file.name,
          fileSize: file.size,
          fileContent: base64,
          fileUrl: dataUrl,
          verificationStatus: 'Pending Verification',
        };
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  // Run validation automatically when arriving at Page 9
  useEffect(() => {
    if (currentStep === 9) {
      runPreValidation();
    }
  }, [currentStep]);

  return (
    <div className="fixed inset-0 bg-[#00205B]/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden text-xs">
        {/* Modal Top Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#00205B] to-[#0E284E] text-white flex justify-between items-center border-b border-[#00205B]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg shadow-inner border border-white/15">
              <Building className="w-5 h-5 text-[#D48806]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Collateral Registration</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/30 text-slate-200 border border-white/20">
                  {regCode}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#D48806]/20 text-[#D48806] border border-[#D48806]/40">
                  {regStatus}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Step {currentStep} of 11: Banking-Grade Collateral Perfection &amp; Four-Eyes Dual Control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        {/* 11-Stage Navigation Stepper */}
        <div className="grid grid-cols-11 bg-slate-50 border-b border-slate-200 text-center text-[10px] font-semibold divide-x divide-slate-200 select-none overflow-x-auto">
          {[
            { step: 1, label: '1. Initiation' },
            { step: 2, label: '2. Borrower' },
            { step: 3, label: '3. Legal Owner' },
            { step: 4, label: '4. Asset Details' },
            { step: 5, label: '5. Valuation' },
            { step: 6, label: '6. Security Rank' },
            { step: 7, label: '7. Documents' },
            { step: 8, label: '8. Facilities' },
            { step: 9, label: '9. Validation' },
            { step: 10, label: '10. Exceptions' },
            { step: 11, label: '11. Review' },
          ].map((s) => (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step)}
              className={`py-2.5 px-1 transition-all ${currentStep === s.step
                  ? 'bg-white text-[#00205B] font-bold shadow-xs border-b-2 border-[#D48806]'
                  : currentStep > s.step
                    ? 'text-[#00205B] hover:bg-slate-100 font-semibold'
                    : 'text-slate-400 hover:bg-slate-100/50'
                }`}
            >
              <div className="truncate">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Wizard Main Content Area */}
        <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto bg-slate-50/30">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* =========================================================================
              PAGE 1: REGISTRATION INITIATION
              ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00205B]" />
                  Page 1: Registration Initiation &amp; Asset Classification
                </h4>
                <p className="text-[#5B6472] text-[11px]">
                  Initialize the collateral registration session and select the authoritative category and subtype.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registration Reference</label>
                  <input
                    type="text"
                    disabled
                    value={regCode}
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-[#00205B]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registration Date</label>
                  <input
                    type="date"
                    disabled
                    value={regDate}
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initiator (Maker)</label>
                  <input
                    type="text"
                    disabled
                    value={`${currentUser.fullName || currentUser.username} (${currentUser.role})`}
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Registration Status</label>
                  <span className="inline-block mt-1 px-2.5 py-1 rounded bg-blue-50 text-[#00205B] font-bold border border-blue-200">
                    {regStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Branch / Organizational Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id || b.code} value={b.name}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Business Segment <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedSegment}
                    onChange={(e) => setSelectedSegment(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {segments.map((s) => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Collateral Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      const newCat = e.target.value;
                      setSelectedCategory(newCat);
                      const subs = CANONICAL_TAXONOMY[newCat] || ['General'];
                      setSelectedSubtype(subs[0]);
                    }}
                    className="w-full p-2 border border-slate-300 rounded font-semibold text-[#00205B] focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {Object.keys(CANONICAL_TAXONOMY).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Collateral Subtype <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedSubtype}
                    onChange={(e) => setSelectedSubtype(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded font-semibold text-[#00205B] focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {availableSubtypes.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded text-blue-900 text-[11px] flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  The registration reference <strong className="font-mono">{regCode}</strong> is generated and locked for this registration. It will remain consistent across all 11 stages.
                </span>
              </div>
            </div>
          )}

          {/* =========================================================================
              PAGE 2: BORROWER INFORMATION
              ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-[#00205B]" />
                  Page 2: Borrower Information (Core Banking System)
                </h4>
                <p className="text-[#5B6472] text-[11px]">
                  Identify the borrower whose credit facility will be secured by this collateral asset.
                </p>
              </div>

              {/* CBS Customer Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search CBS master records by Customer Name, CIF Number, TIN, or National ID..."
                  value={borrowerSearchQuery}
                  onChange={(e) => setBorrowerSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Customer Dropdown */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Customer / Borrower Record <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedBorrowerId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedBorrowerId(id);
                    setSelectedFacilityIds([]);
                    setFacilityAllocations({});
                  }}
                  className="w-full p-2 border border-slate-300 rounded bg-white font-medium"
                >
                  <option value="">-- Choose Borrower from CBS --</option>
                  {customers
                    .filter((c) => {
                      if (!borrowerSearchQuery) return true;
                      const q = borrowerSearchQuery.toLowerCase();
                      return (
                        c.name.toLowerCase().includes(q) ||
                        (c.cif && c.cif.toLowerCase().includes(q)) ||
                        (c.taxIdNo && c.taxIdNo.toLowerCase().includes(q))
                      );
                    })
                    .map((c) => (
                      <option key={c.id || c.cif} value={c.id || c.cif}>
                        {c.name} (CIF: {c.cif || c.id}) · {c.customerType || 'Corporate'} · {c.branch || 'Bole'}
                      </option>
                    ))}
                </select>
              </div>

              {/* Borrower Details Card */}
              {selectedBorrower ? (
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="font-bold text-[#00205B] text-sm">{selectedBorrower.name}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-50 text-[#00205B] border border-blue-200">
                      CIF: {selectedBorrower.cif || selectedBorrower.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-700">
                    <div>
                      <span className="block text-[10px] text-slate-500">Customer Type</span>
                      <span className="font-semibold">{selectedBorrower.customerType || 'Corporate'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">National ID / Passport</span>
                      <span className="font-semibold">{selectedBorrower.nationalId || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Business Registration No</span>
                      <span className="font-semibold">{selectedBorrower.businessRegNo || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">TIN (Tax ID)</span>
                      <span className="font-semibold font-mono">{selectedBorrower.taxIdNo || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Mobile Phone</span>
                      <span className="font-semibold">{selectedBorrower.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Email Address</span>
                      <span className="font-semibold">{selectedBorrower.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Customer Segment</span>
                      <span className="font-semibold">{selectedBorrower.segment || 'Corporate'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">Home Branch</span>
                      <span className="font-semibold">{selectedBorrower.branch || 'Bole Special Branch'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    <strong>Registered Address:</strong> {selectedBorrower.address || 'Bole Road, Addis Ababa, Ethiopia'}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 border border-dashed border-slate-300 rounded-lg">
                  Please search and select a borrower to view Core Banking details.
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Strict Separation:</strong> The borrower is the credit obligor. The legal owner of the collateral will be recorded separately on Page 3.
                </span>
              </div>
            </div>
          )}

          {/* =========================================================================
              PAGE 3: LEGAL COLLATERAL OWNER
              ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#00205B]" />
                  Page 3: Legal Collateral Owner &amp; Ownership Distribution
                </h4>
                <p className="text-[#5B6472] text-[11px]">
                  Capture who legally owns the asset (Borrower-owned, Third-Party owned, or Jointly owned).
                </p>
              </div>

              {/* Ownership Type Radio Selector */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { type: 'Borrower-owned', title: 'Borrower-owned', desc: 'Asset is 100% owned by the selected borrower' },
                  { type: 'Third-party-owned', title: 'Third-party-owned', desc: 'Asset is owned by an external third party' },
                  { type: 'Jointly-owned', title: 'Jointly-owned', desc: 'Asset is owned by two or more co-owners' },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setOwnershipType(opt.type as any)}
                    className={`p-3 rounded-lg border text-left transition ${ownershipType === opt.type
                        ? 'border-[#00205B] bg-slate-50 shadow-xs ring-1 ring-[#00205B]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                  >
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={ownershipType === opt.type}
                        onChange={() => { }}
                        className="text-[#00205B]"
                      />
                      {opt.title}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* 3.2 Borrower-owned view */}
              {ownershipType === 'Borrower-owned' && (
                <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Borrower and Legal Owner are the same legal entity (100% Share)
                  </div>
                  {selectedBorrower ? (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">
                      <div><strong>Legal Name:</strong> {selectedBorrower.name}</div>
                      <div><strong>CIF:</strong> {selectedBorrower.cif || selectedBorrower.id}</div>
                      <div><strong>Identification / TIN:</strong> {selectedBorrower.nationalId || selectedBorrower.taxIdNo || 'Verified CBS Profile'}</div>
                      <div><strong>Ownership Percentage:</strong> 100.00%</div>
                    </div>
                  ) : (
                    <div className="text-amber-700">Please select a borrower on Page 2 first.</div>
                  )}
                </div>
              )}

              {/* 3.3 Third-Party Owned view */}
              {ownershipType === 'Third-party-owned' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-4">
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-3">
                    <span className="font-semibold text-slate-700">Is the third-party owner an existing Bank customer?</span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="radio"
                        checked={tpIsExistingCustomer}
                        onChange={() => setTpIsExistingCustomer(true)}
                      />
                      Yes (Has CBS CIF)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="radio"
                        checked={!tpIsExistingCustomer}
                        onChange={() => setTpIsExistingCustomer(false)}
                      />
                      No (Non-customer Owner)
                    </label>
                  </div>

                  {tpIsExistingCustomer ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search CBS for Third-Party Owner by Name or CIF..."
                          value={tpCustomerSearchQuery}
                          onChange={(e) => setTpCustomerSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-xs"
                        />
                      </div>
                      <select
                        value={tpSelectedCustomerId}
                        onChange={(e) => setTpSelectedCustomerId(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded"
                      >
                        <option value="">-- Choose Third-Party Owner from CBS --</option>
                        {customers
                          .filter((c) => {
                            if (!tpCustomerSearchQuery) return true;
                            const q = tpCustomerSearchQuery.toLowerCase();
                            return c.name.toLowerCase().includes(q) || (c.cif && c.cif.toLowerCase().includes(q));
                          })
                          .map((c) => (
                            <option key={c.id || c.cif} value={c.id || c.cif}>
                              {c.name} (CIF: {c.cif || c.id}) · {c.customerType}
                            </option>
                          ))}
                      </select>

                      {selectedTpCustomer && (
                        <div className="p-3 bg-blue-50/50 rounded border border-blue-200 text-slate-700">
                          <div><strong>Selected Owner:</strong> {selectedTpCustomer.name} (CIF: {selectedTpCustomer.cif || selectedTpCustomer.id})</div>
                          <div><strong>TIN:</strong> {selectedTpCustomer.taxIdNo || 'N/A'} | <strong>National ID:</strong> {selectedTpCustomer.nationalId || 'N/A'}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 font-medium">
                          <input
                            type="radio"
                            checked={tpOwnerForm.ownerType === 'Individual'}
                            onChange={() => setTpOwnerForm({ ...tpOwnerForm, ownerType: 'Individual' })}
                          />
                          Individual Owner
                        </label>
                        <label className="flex items-center gap-1.5 font-medium">
                          <input
                            type="radio"
                            checked={tpOwnerForm.ownerType === 'Business Organization'}
                            onChange={() => setTpOwnerForm({ ...tpOwnerForm, ownerType: 'Business Organization' })}
                          />
                          Business Organization / Corporate
                        </label>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">
                            {tpOwnerForm.ownerType === 'Individual' ? 'Full Legal Name' : 'Registered Entity Name'} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={tpOwnerForm.name}
                            onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, name: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="Enter legal owner name"
                          />
                        </div>

                        {tpOwnerForm.ownerType === 'Individual' ? (
                          <div>
                            <label className="block font-semibold mb-1">National ID / Passport Number</label>
                            <input
                              type="text"
                              value={tpOwnerForm.idNumber}
                              onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, idNumber: e.target.value })}
                              className="w-full p-2 border border-slate-300 rounded"
                              placeholder="e.g. ET-ID-99214"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block font-semibold mb-1">Business Registration Number</label>
                            <input
                              type="text"
                              value={tpOwnerForm.businessRegNo}
                              onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, businessRegNo: e.target.value })}
                              className="w-full p-2 border border-slate-300 rounded"
                              placeholder="e.g. BR-88210"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block font-semibold mb-1">TIN (Tax ID Number)</label>
                          <input
                            type="text"
                            value={tpOwnerForm.tin}
                            onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, tin: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded font-mono"
                            placeholder="e.g. 0089218412"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1">Mobile Contact Number</label>
                          <input
                            type="text"
                            value={tpOwnerForm.phone}
                            onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, phone: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="+251911..."
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1">Email Address</label>
                          <input
                            type="email"
                            value={tpOwnerForm.email}
                            onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, email: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="owner@domain.com"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold mb-1">Registered Address</label>
                          <input
                            type="text"
                            value={tpOwnerForm.address}
                            onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, address: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="City, Woreda, Kebele"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Relationship to Borrower */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Relationship to Borrower <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={tpOwnerForm.relationshipToBorrower}
                        onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, relationshipToBorrower: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded font-semibold text-[#00205B]"
                      >
                        {RELATIONSHIP_TYPES.map((rel) => (
                          <option key={rel} value={rel}>
                            {rel}
                          </option>
                        ))}
                      </select>
                    </div>

                    {tpOwnerForm.relationshipToBorrower === 'Other' && (
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Relationship Description <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={tpOwnerForm.relationshipDescription}
                          onChange={(e) => setTpOwnerForm({ ...tpOwnerForm, relationshipDescription: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                          placeholder="Describe documented commercial/legal relationship"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 3.5 Joint Ownership Table */}
              {ownershipType === 'Jointly-owned' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-xs">Joint Legal Owners Register</span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-xs font-bold ${Math.abs(jointOwners.reduce((s, o) => s + (o.percentage || 0), 0) - 100) < 0.01
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                        }`}
                    >
                      Combined Share: {jointOwners.reduce((s, o) => s + (o.percentage || 0), 0).toFixed(2)}%
                    </span>
                  </div>

                  <table className="w-full text-left border border-slate-200 rounded divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 font-semibold text-slate-700">
                      <tr>
                        <th className="p-2">Owner Legal Name</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">National ID / TIN</th>
                        <th className="p-2">Relationship</th>
                        <th className="p-2">Ownership %</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {jointOwners.map((o, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 font-semibold text-[#00205B]">{o.name}</td>
                          <td className="p-2">{o.ownerType}</td>
                          <td className="p-2 font-mono">{o.idNumber || o.tin || 'N/A'}</td>
                          <td className="p-2">{o.relationshipToBorrower || o.relationship || 'Co-Owner'}</td>
                          <td className="p-2 font-bold">{o.percentage}%</td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => setJointOwners(jointOwners.filter((_, i) => i !== idx))}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {jointOwners.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">
                            No joint owners added yet. Minimum 2 owners required for joint ownership.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Add Co-Owner Form */}
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Legal Name</label>
                      <input
                        type="text"
                        placeholder="Co-Owner Name"
                        value={newJointOwner.name || ''}
                        onChange={(e) => setNewJointOwner({ ...newJointOwner, name: e.target.value })}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">ID / Passport</label>
                      <input
                        type="text"
                        placeholder="National ID"
                        value={newJointOwner.idNumber || ''}
                        onChange={(e) => setNewJointOwner({ ...newJointOwner, idNumber: e.target.value })}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Relationship</label>
                      <select
                        value={newJointOwner.relationshipToBorrower || 'Shareholder'}
                        onChange={(e) => setNewJointOwner({ ...newJointOwner, relationshipToBorrower: e.target.value })}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs"
                      >
                        {RELATIONSHIP_TYPES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Share %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newJointOwner.percentage || 50}
                        onChange={(e) => setNewJointOwner({ ...newJointOwner, percentage: Number(e.target.value) })}
                        className="w-full p-1.5 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!newJointOwner.name) return alert('Owner name is required');
                          setJointOwners([
                            ...jointOwners,
                            {
                              id: `own-joint-${Math.floor(10000 + Math.random() * 90000)}`,
                              name: newJointOwner.name || '',
                              ownershipType: 'Jointly-owned',
                              ownerType: newJointOwner.ownerType || 'Individual',
                              idNumber: newJointOwner.idNumber || '',
                              tin: newJointOwner.tin || '',
                              phone: newJointOwner.phone || '+251911000000',
                              relationship: newJointOwner.relationshipToBorrower || 'Co-Owner',
                              relationshipToBorrower: newJointOwner.relationshipToBorrower || 'Co-Owner',
                              percentage: Number(newJointOwner.percentage) || 50,
                              verificationStatus: 'Recorded',
                            },
                          ]);
                          setNewJointOwner({ name: '', idNumber: '', percentage: 50 });
                        }}
                        className="w-full py-1.5 px-3 bg-[#00205B] text-white rounded font-bold hover:bg-[#00205B]"
                      >
                        + Add Owner
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PAGE 4: ASSET-SPECIFIC COLLATERAL DETAILS
              ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00205B]" />
                  Page 4: Asset-Specific Details · {selectedCategory} ({selectedSubtype})
                </h4>
                <p className="text-[#5B6472] text-[11px]">
                  Capture granular technical specifications unique to the selected asset classification.
                </p>
              </div>

              {/* 5.1 IMMOVABLE PROPERTIES */}
              {selectedCategory === 'Immovable Properties' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <label className="block font-semibold mb-1">Property Description <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={assetDetails.description || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, description: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                        placeholder="e.g. G+7 Multi-Purpose Commercial Complex"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Building Type</label>
                      <select
                        value={assetDetails.buildingType || 'Commercial'}
                        onChange={(e) => setAssetDetails({ ...assetDetails, buildingType: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                      >
                        <option value="Commercial">Commercial</option>
                        <option value="Residential">Residential</option>
                        <option value="Mixed-use">Mixed-use</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Building Use</label>
                      <input
                        type="text"
                        value={assetDetails.buildingUse || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, buildingUse: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                        placeholder="e.g. Retail, Offices, Hotel"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Region</label>
                      <input
                        type="text"
                        value={assetDetails.locationRegion || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, locationRegion: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">City / Town</label>
                      <input
                        type="text"
                        value={assetDetails.locationCity || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, locationCity: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Sub-City / Woreda</label>
                      <input
                        type="text"
                        value={assetDetails.locationSubcity || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, locationSubcity: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">GPS Coordinates</label>
                      <input
                        type="text"
                        value={assetDetails.gpsCoordinates || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, gpsCoordinates: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded font-mono"
                        placeholder="Latitude, Longitude"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Property Certificate Number</label>
                      <input
                        type="text"
                        value={assetDetails.propertyCertNumber || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, propertyCertNumber: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                        placeholder="e.g. CERT-AA-89214"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Title Deed Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={assetDetails.titleDeedNumber || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, titleDeedNumber: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                        placeholder="e.g. TD-99214/2018"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Property Registration Number</label>
                      <input
                        type="text"
                        value={assetDetails.registrationNumber || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, registrationNumber: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                        placeholder="e.g. REG-CAD-7721"
                      />
                    </div>
                  </div>

                  {/* Under Construction Toggle & Conditional Fields */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-xs">Is the Building Currently Under Construction?</span>
                        <p className="text-[10px] text-slate-500">
                          Toggling &quot;Yes&quot; reveals milestone progress fields and mandates a certified Bill of Quantities (BOQ).
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!assetDetails.isUnderConstruction}
                          onChange={(e) => setAssetDetails({ ...assetDetails, isUnderConstruction: e.target.checked })}
                          className="w-4 h-4 text-[#00205B] rounded"
                        />
                        <span className="font-bold text-xs">
                          {assetDetails.isUnderConstruction ? 'Yes (Under Construction)' : 'No (Completed Structure)'}
                        </span>
                      </label>
                    </div>

                    {assetDetails.isUnderConstruction && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Completed Work (%)</label>
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={assetDetails.constructionCompletionPct || 65}
                            onChange={(e) => {
                              const comp = Number(e.target.value);
                              setAssetDetails({
                                ...assetDetails,
                                constructionCompletionPct: comp,
                                constructionRemainingPct: Math.max(0, 100 - comp),
                              });
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Remaining Work (%)</label>
                          <input
                            type="number"
                            disabled
                            value={assetDetails.constructionRemainingPct || 35}
                            className="w-full p-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Inspection Date</label>
                          <input
                            type="date"
                            value={assetDetails.constructionInspectionDate || regDate}
                            onChange={(e) => setAssetDetails({ ...assetDetails, constructionInspectionDate: e.target.value })}
                            className="w-full p-1.5 border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Expected Completion Date</label>
                          <input
                            type="date"
                            value={assetDetails.expectedCompletionDate || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, expectedCompletionDate: e.target.value })}
                            className="w-full p-1.5 border border-slate-300 rounded text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5.2 MOVABLE PROPERTIES */}
              {selectedCategory === 'Movable Properties' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-4">
                  {selectedSubtype.toLowerCase().includes('vehicle') ? (
                    <div className="space-y-3">
                      <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-[#00205B]" />
                        Vehicle Identity Specifications
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">Vehicle Make <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={assetDetails.vehicleMake || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, vehicleMake: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="e.g. Toyota / Isuzu"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Vehicle Model <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={assetDetails.vehicleModel || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, vehicleModel: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="e.g. Land Cruiser Prado"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Manufacturing Year</label>
                          <input
                            type="number"
                            value={assetDetails.vehicleYear || 2023}
                            onChange={(e) => setAssetDetails({ ...assetDetails, vehicleYear: Number(e.target.value) })}
                            className="w-full p-2 border border-slate-300 rounded"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Plate Number <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={assetDetails.vehiclePlateNumber || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, vehiclePlateNumber: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                            placeholder="e.g. 3-B88210 AA"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block font-semibold mb-1">Chassis Number / VIN <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={assetDetails.vehicleChassisNumber || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, vehicleChassisNumber: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                            placeholder="e.g. JTEBU25J9841209"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block font-semibold mb-1">Engine Number <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={assetDetails.vehicleEngineNumber || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, vehicleEngineNumber: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                            placeholder="e.g. 1KD-FTV-89412"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h5 className="font-bold text-slate-800 text-xs">Construction Machinery Identification</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">Machinery Type</label>
                          <input
                            type="text"
                            value={assetDetails.machineryType || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, machineryType: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="e.g. Crawler Excavator / Wheel Loader"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Manufacturer</label>
                          <input
                            type="text"
                            value={assetDetails.machineryManufacturer || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, machineryManufacturer: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded"
                            placeholder="e.g. Caterpillar / Komatsu"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Serial Number <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={assetDetails.machinerySerialNo || ''}
                            onChange={(e) => setAssetDetails({ ...assetDetails, machinerySerialNo: e.target.value })}
                            className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                            placeholder="e.g. CAT-320D-981240"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5.3 BUSINESS MORTGAGES */}
              {selectedCategory === 'Business Mortgages' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Equipment Description</label>
                      <input
                        type="text"
                        value={assetDetails.description || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, description: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                        placeholder="e.g. Industrial Milling Line / Office Furniture"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Serial Number / Asset Tag</label>
                      <input
                        type="text"
                        value={assetDetails.machinerySerialNo || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, machinerySerialNo: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded font-mono"
                        placeholder="e.g. SER-98214"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Quantity / Count</label>
                      <input
                        type="number"
                        value={assetDetails.furnitureQuantity || 1}
                        onChange={(e) => setAssetDetails({ ...assetDetails, furnitureQuantity: Number(e.target.value) })}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5.4 FINANCIAL ASSETS */}
              {selectedCategory === 'Financial Assets' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Issuing Entity / Bank</label>
                      <input
                        type="text"
                        value={assetDetails.shareIssuer || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, shareIssuer: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Reference / Account / Bill No</label>
                      <input
                        type="text"
                        value={assetDetails.blockedAccountNumber || assetDetails.shareCertRef || assetDetails.billReference || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, blockedAccountNumber: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Maturity / Expiry Date</label>
                      <input
                        type="date"
                        value={assetDetails.depositMaturityDate || assetDetails.billMaturityDate || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, depositMaturityDate: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5.5 AGRICULTURAL / OTHER */}
              {selectedCategory === 'Agricultural/Other' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-3">
                  {selectedSubtype.toLowerCase().includes('livestock') && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Plastic Ear-Tag Numbers / Range <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={assetDetails.livestockTagNumber || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, livestockTagNumber: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                          placeholder="e.g. TAG-00100 through TAG-00200"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Head Count (Quantity)</label>
                        <input
                          type="number"
                          value={assetDetails.livestockQuantity || 100}
                          onChange={(e) => setAssetDetails({ ...assetDetails, livestockQuantity: Number(e.target.value) })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Breed / Type</label>
                        <input
                          type="text"
                          value={assetDetails.livestockBreed || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, livestockBreed: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Veterinary Health Cert Date</label>
                        <input
                          type="date"
                          value={assetDetails.veterinaryHealthCertDate || regDate}
                          onChange={(e) => setAssetDetails({ ...assetDetails, veterinaryHealthCertDate: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {selectedSubtype.toLowerCase().includes('farm') && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Crop / Commodity Type</label>
                        <input
                          type="text"
                          value={assetDetails.farmCropType || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, farmCropType: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                          placeholder="e.g. Export Coffee Grade 1"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Land Holding Cert Number <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={assetDetails.farmLandHoldingCert || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, farmLandHoldingCert: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                          placeholder="e.g. LHC-OR-99120"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Storage Location</label>
                        <input
                          type="text"
                          value={assetDetails.farmStorageLocation || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, farmStorageLocation: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {selectedSubtype.toLowerCase().includes('warehouse') && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">Warehouse Receipt Number <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={assetDetails.warehouseReceiptNumber || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, warehouseReceiptNumber: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                          placeholder="e.g. WHR-ECX-8921"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Warehouse Operator Name</label>
                        <input
                          type="text"
                          value={assetDetails.warehouseName || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, warehouseName: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Receipt Expiry Date</label>
                        <input
                          type="date"
                          value={assetDetails.warehouseExpiryDate || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, warehouseExpiryDate: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  )}

                  {selectedSubtype.toLowerCase().includes('intellectual') && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">IP Registration Number <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={assetDetails.ipRegistrationNumber || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, ipRegistrationNumber: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                          placeholder="e.g. EIPA-TM-2024-91"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">IP Title / Brand</label>
                        <input
                          type="text"
                          value={assetDetails.ipTitle || ''}
                          onChange={(e) => setAssetDetails({ ...assetDetails, ipTitle: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Registration Date</label>
                        <input
                          type="date"
                          value={assetDetails.ipRegistrationDate || regDate}
                          onChange={(e) => setAssetDetails({ ...assetDetails, ipRegistrationDate: e.target.value })}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5.6 GUARANTEES */}
              {selectedCategory === 'Guarantees' && (
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">Guarantor Legal Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={assetDetails.guarantorName || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, guarantorName: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                        placeholder="Full guarantor name"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Guarantee Agreement Reference <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={assetDetails.guaranteeAgreementRef || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, guaranteeAgreementRef: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded font-mono"
                        placeholder="e.g. GA-2026-99"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">Guarantee Expiry Date</label>
                      <input
                        type="date"
                        value={assetDetails.guaranteeExpiryDate || ''}
                        onChange={(e) => setAssetDetails({ ...assetDetails, guaranteeExpiryDate: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PAGE 5: VALUATION INFORMATION
              ========================================================================= */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#00205B]" />
                  Page 5: Valuation Information &amp; Haircut Calculation
                </h4>
                <p className="text-[#5B6472] text-[11px]">
                  Clearly distinguish between Estimated Market Value, Bank-Assessed Insurable Value, and Insurance Coverage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 6.1 Estimated Value Card */}
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-2 shadow-xs">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    6.1 Estimated Market Value
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Estimated reference market value. Does not replace bank-assessed insurable value for adequacy.
                  </p>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Estimated Value (ETB)</label>
                    <input
                      type="number"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Valuation Source / Ref</label>
                    <input
                      type="text"
                      value={estimatedValueSource}
                      onChange={(e) => setEstimatedValueSource(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                {/* 6.2 Bank-Assessed Value Card */}
                <div className="bg-white p-4 border border-blue-200 rounded-lg space-y-2 shadow-xs ring-1 ring-blue-100">
                  <span className="font-bold text-[#00205B] text-xs flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-[#00205B]" />
                    6.2 Bank-Assessed Insurable Value <span className="text-red-500">*</span>
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Represents insurable structure value (excluding land value for real estate buildings).
                  </p>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-700 mb-1">Insurable Value (ETB)</label>
                    <input
                      type="number"
                      value={bankAssessedValue}
                      onChange={(e) => setBankAssessedValue(Number(e.target.value))}
                      className="w-full p-2 border border-blue-300 rounded text-xs font-mono font-bold text-[#00205B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Land Value (ETB, Excluded)</label>
                    <input
                      type="number"
                      value={landValue}
                      onChange={(e) => setLandValue(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                {/* 6.3 Insurance Value Card */}
                <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-2 shadow-xs">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    6.3 Insurance Coverage Value
                  </span>
                  <p className="text-[10px] text-slate-500">
                    Sourced from active insurance policy schedule when available.
                  </p>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">Insurance Amount (ETB)</label>
                    <input
                      type="number"
                      value={insuranceValue}
                      onChange={(e) => setInsuranceValue(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                  </div>
                  <div className="pt-2 text-[10px] text-slate-600">
                    Coverage Adequacy: <strong>{bankAssessedValue > 0 ? ((insuranceValue / bankAssessedValue) * 100).toFixed(1) : 0}%</strong>
                  </div>
                </div>
              </div>

              {/* 6.4 Haircut and Net Collateral Value Live Calculation */}
              <div className="p-4 bg-[#EFF5FB] border border-[#CBDCEB] rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="block font-semibold text-[#00205B] mb-1">Haircut Percentage (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={haircutPct}
                      onChange={(e) => setHaircutPct(Number(e.target.value))}
                      className="w-full p-2 border border-blue-300 rounded font-bold text-xs"
                    />
                  </div>
                  <div className="col-span-2 p-3 bg-white rounded border border-blue-200 flex justify-between items-center">
                    <div>
                      <span className="block text-[10px] text-slate-500 font-semibold">FORMULA: Valuation Amount × (1 – Haircut / 100)</span>
                      <span className="text-xs text-slate-700">
                        ETB {bankAssessedValue.toLocaleString()} × (1 - {haircutPct}%)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-[#00205B] font-bold">NET COLLATERAL VALUE (NSV)</span>
                      <span className="text-base font-extrabold text-[#00205B] font-mono">
                        ETB {netCollateralValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6.5 Valuation Report Metadata */}
              <div className="bg-white p-4 border border-slate-200 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Valuation Date</label>
                  <input
                    type="date"
                    value={valuationDate}
                    onChange={(e) => setValuationDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Valuation Report Reference</label>
                  <input
                    type="text"
                    value={valuationReportRef}
                    onChange={(e) => setValuationReportRef(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Valuator / Assessing Officer</label>
                  <input
                    type="text"
                    value={valuatorOfficer}
                    onChange={(e) => setValuatorOfficer(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1">Review Date (Annual)</label>
                  <input
                    type="date"
                    value={valuationReviewDate}
                    onChange={(e) => setValuationReviewDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PAGE 6: SECURITY RANK AND MORTGAGE INFORMATION
              ========================================================================= */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#00205B]" />
                  Page 6: Security Rank &amp; Mortgage Priority
                </h4>
                <p className="text-[#5B6472] text-[11px]">
                  Specify whether Dashen Bank holds a 1st-degree charge or a 2nd-degree charge behind an existing institutional lien.
                </p>
              </div>

              {/* Rank Selector */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSecurityRank('1st')}
                  className={`p-4 rounded-lg border text-left transition ${securityRank === '1st'
                      ? 'border-[#00205B] bg-slate-50 ring-1 ring-[#00205B]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={securityRank === '1st'} onChange={() => { }} />
                    <span className="font-bold text-xs text-slate-900">First-Degree Security (1st Degree Charge)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Dashen Bank holds senior first-degree mortgage priority over the asset.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSecurityRank('2nd')}
                  className={`p-4 rounded-lg border text-left transition ${securityRank === '2nd'
                      ? 'border-[#00205B] bg-slate-50 ring-1 ring-[#00205B]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={securityRank === '2nd'} onChange={() => { }} />
                    <span className="font-bold text-xs text-slate-900">Second-Degree Security (2nd Degree Charge)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Asset has an existing 1st-degree mortgage. Requires complete first-degree mortgage details.
                  </p>
                </button>
              </div>

              {/* Internal vs External First-Degree Selector */}
              <div className="bg-white p-4 border border-slate-200 rounded-lg space-y-4">
                <div className="flex items-center gap-6 border-b border-slate-100 pb-3">
                  <span className="font-semibold text-slate-700">1st-Degree Charge Holder Type:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      checked={isFirstDegreeInternal}
                      onChange={() => setIsFirstDegreeInternal(true)}
                    />
                    Internal (Held by Dashen Bank S.C.)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      checked={!isFirstDegreeInternal}
                      onChange={() => setIsFirstDegreeInternal(false)}
                    />
                    External (Held by Another Financial Institution)
                  </label>
                </div>

                {!isFirstDegreeInternal || securityRank === '2nd' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">
                          1st-Degree Institution / Holder <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={firstDegreeHolderName}
                          onChange={(e) => setFirstDegreeHolderName(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded"
                          placeholder="e.g. Financial Institution / Bank Name"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">1st-Degree Facility Reference</label>
                        <input
                          type="text"
                          value={firstDegreeFacilityRef}
                          onChange={(e) => setFirstDegreeFacilityRef(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                          placeholder="e.g. EXT-LN-8821"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">
                          1st-Degree Outstanding Balance (ETB) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={firstDegreeOutstandingBalance}
                          onChange={(e) => setFirstDegreeOutstandingBalance(Number(e.target.value))}
                          className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Balance As-Of Date</label>
                        <input
                          type="date"
                          value={firstDegreeBalanceAsOfDate}
                          onChange={(e) => setFirstDegreeBalanceAsOfDate(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Registered Mortgage Amount (ETB)</label>
                        <input
                          type="number"
                          value={registeredMortgageAmount}
                          onChange={(e) => setRegisteredMortgageAmount(Number(e.target.value))}
                          className="w-full p-2 border border-slate-300 rounded font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Mortgage Registration Number</label>
                        <input
                          type="text"
                          value={mortgageRegistrationNumber}
                          onChange={(e) => setMortgageRegistrationNumber(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block font-semibold mb-1">1st-Degree Policy Number</label>
                        <input
                          type="text"
                          value={firstDegreePolicyNumber}
                          onChange={(e) => setFirstDegreePolicyNumber(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Insurance Company</label>
                        <input
                          type="text"
                          value={firstDegreeInsurer}
                          onChange={(e) => setFirstDegreeInsurer(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Policy Expiry Date</label>
                        <input
                          type="date"
                          value={firstDegreePolicyExpiry}
                          onChange={(e) => setFirstDegreePolicyExpiry(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded"
                        />
                      </div>
                    </div>

                    {/* Second Mortgagee Notation Checkbox */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="notedSecMortgagee"
                          checked={bankNotedAsSecondMortgagee}
                          onChange={(e) => setBankNotedAsSecondMortgagee(e.target.checked)}
                          className="w-4 h-4 text-[#00205B] rounded"
                        />
                        <label htmlFor="notedSecMortgagee" className="font-bold text-amber-900 text-xs cursor-pointer">
                          Dashen Bank S.C. is officially noted as Second Mortgagee in Land Registry extract
                        </label>
                      </div>
                      <span className="text-[10px] text-amber-700 font-medium">Part 7.2 Requirement</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded text-slate-600 text-xs">
                    Senior first-degree charge is held internally by Dashen Bank S.C. No external charge clearance required.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              PAGE 7: DOCUMENTS & EXCEPTIONS
              ========================================================================= */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#00205B]" />
                    Page 7: Documents &amp; Exceptions
                  </h4>
                  <p className="text-[#5B6472] text-[11px]">
                    Admin-configured mandatory document rules for {selectedCategory} ({selectedSubtype}). Attach supporting documents or request authorized management exceptions with justification.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-100 text-[#00205B]">
                    {documentsList.filter((d) => d.fileContent || d.fileName).length + supportingDocumentsList.filter((d) => d.fileContent || d.fileName).length} Attached (Pending Verification)
                  </span>
                  {collateralExceptions.length > 0 && (
                    <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-amber-600" />
                      {collateralExceptions.length} Exception(s) Requested
                    </span>
                  )}
                </div>
              </div>

              {/* SECTION A: Admin-Configured Mandatory Documents */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#00205B]">Section A: Mandatory Documents (Admin-Configured Matrix)</span>
                    <span className="text-[10px] bg-blue-50 text-[#00205B] px-2 py-0.5 rounded font-semibold border border-blue-200">
                      Single Authoritative Source
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    All mandatory documents must be attached OR have an approved management exception request.
                  </span>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left divide-y divide-slate-200 text-xs">
                    <thead className="bg-[#EFF5FB] text-slate-700 font-semibold">
                      <tr>
                        <th className="p-2.5">Document Requirement</th>
                        <th className="p-2.5">Admin Applicability / Rule</th>
                        <th className="p-2.5">Reference No</th>
                        <th className="p-2.5">Compliance Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documentsList.map((doc, idx) => {
                        const isAttached = !!(doc.fileContent || doc.fileName);
                        const matchingExc = collateralExceptions.find(
                          (e) =>
                            (doc.ruleId && e.ruleId === doc.ruleId) ||
                            docTypeMatches(doc.type, e.failedRequirement) ||
                            docTypeMatches(doc.type, e.documentType)
                        );

                        return (
                          <tr key={doc.id || idx} className="hover:bg-slate-50/70">
                            <td className="p-2.5 font-semibold text-[#00205B]">
                              <div className="flex items-center gap-1.5">
                                {doc.isMandatory && <span className="text-red-500 font-bold">*</span>}
                                <span>{doc.name}</span>
                              </div>
                              {doc.fileName && (
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  File: {doc.fileName} ({(Number(doc.fileSize || 102400) / 1024).toFixed(1)} KB)
                                </div>
                              )}
                              {matchingExc && !isAttached && (
                                <div className="text-[10px] text-amber-800 mt-1 bg-amber-50 p-1.5 rounded border border-amber-200 flex items-start gap-1">
                                  <Shield className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold">Exception Justification:</span> {matchingExc.reason}
                                    {matchingExc.validityDays ? ` (${matchingExc.validityDays} days grace period)` : ''}
                                    {matchingExc.evidenceDocument ? ` | Ref: ${matchingExc.evidenceDocument}` : ''}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-slate-500 text-[11px] max-w-xs">{doc.remarks}</td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                placeholder="Ref / Cert No"
                                value={doc.referenceNumber || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDocumentsList((prev) => {
                                    const c = [...prev];
                                    c[idx].referenceNumber = val;
                                    return c;
                                  });
                                }}
                                className="p-1 border border-slate-200 rounded text-[11px] w-28"
                              />
                            </td>
                            <td className="p-2.5">
                              {isAttached ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Attached (Pending Verification)
                                </span>
                              ) : matchingExc ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                                  <Shield className="w-3 h-3 text-amber-600" /> Exception Requested (Pending Approval)
                                </span>
                              ) : doc.isMandatory ? (
                                doc.exceptionAllowed === false ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 flex items-center gap-1 w-fit" title="Admin policy prohibits exceptions for this document">
                                    <AlertTriangle className="w-3 h-3 text-red-600" /> Exception Prohibited (Admin Policy)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                                    <AlertTriangle className="w-3 h-3 text-red-600" /> Missing Mandatory
                                  </span>
                                )
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                  Optional
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Preview Button if attached */}
                                {(doc.fileName || doc.fileContent) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPreUploadPreview({
                                        fileName: doc.fileName || doc.name || doc.type,
                                        fileSize: doc.fileSize,
                                        fileContent: doc.fileContent,
                                        fileUrl: doc.fileUrl,
                                        fileType: doc.type,
                                      });
                                      setShowPreUploadModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[11px] font-bold transition shadow-xs"
                                    title="Preview attached document before submit"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Preview</span>
                                  </button>
                                )}

                                {/* Upload / Replace button */}
                                <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-[#00205B] text-white rounded text-[11px] font-bold hover:bg-[#00205B] transition shadow-xs">
                                  <Upload className="w-3 h-3" />
                                  <span>{doc.fileName ? 'Replace' : 'Upload'}</span>
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.tiff"
                                    onChange={(e) => handleDocumentFileChange(idx, e)}
                                    className="hidden"
                                  />
                                </label>

                                {/* Request Exception Button (if mandatory and not attached) */}
                                {!isAttached && doc.isMandatory && !matchingExc && (
                                  doc.exceptionAllowed === false ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-semibold border border-slate-300 cursor-not-allowed"
                                      title="Admin policy prohibits exceptions for this document. File upload is mandatory."
                                    >
                                      <XCircle className="w-3 h-3 text-red-500" />
                                      <span>No Exception</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveModalException({
                                          ruleId: doc.ruleId,
                                          documentType: doc.type,
                                          isEdit: false,
                                        });
                                        setModalExceptionReason('');
                                        setModalExceptionComments('');
                                        setModalExceptionDays(30);
                                        setModalExceptionEvidence('');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded text-[11px] font-bold hover:bg-amber-700 transition shadow-xs"
                                    >
                                      <Shield className="w-3 h-3" />
                                      <span>Request Exception</span>
                                    </button>
                                  )
                                )}

                                {/* Edit / Remove Exception Buttons */}
                                {matchingExc && !isAttached && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveModalException({
                                          ruleId: doc.ruleId,
                                          documentType: doc.type,
                                          isEdit: true,
                                        });
                                        setModalExceptionReason(matchingExc.reason);
                                        setModalExceptionComments(matchingExc.comments || '');
                                        setModalExceptionDays(matchingExc.validityDays || 30);
                                        setModalExceptionEvidence(matchingExc.evidenceDocument || '');
                                      }}
                                      className="px-2 py-1 border border-amber-300 text-amber-800 rounded text-[11px] font-semibold hover:bg-amber-50"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCollateralExceptions((prev) =>
                                          prev.filter(
                                            (e) =>
                                              !(
                                                (doc.ruleId && e.ruleId === doc.ruleId) ||
                                                docTypeMatches(doc.type, e.failedRequirement) ||
                                                docTypeMatches(doc.type, e.documentType)
                                              )
                                          )
                                        );
                                      }}
                                      className="px-2 py-1 border border-red-300 text-red-700 rounded text-[11px] font-semibold hover:bg-red-50"
                                      title="Cancel exception request"
                                    >
                                      Remove
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {documentsList.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="font-semibold text-slate-700">No Admin Mandatory Document Rules Configured</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              The administrator has not marked any documents as mandatory for category &quot;{selectedCategory}&quot; ({selectedSubtype}). Registration can proceed without document attachments.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION B: Other Supporting Documents */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#00205B]">Section B: Other Supporting Documents (Optional / Ad-Hoc)</span>
                    <p className="text-[10px] text-slate-500">
                      Attach auxiliary documentation (site photos, power of attorney, board resolutions, marriage certificates, spouse consent). These documents will be preserved in DMS but do not substitute for Admin mandatory rules.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSupportingDocForm({
                        name: '',
                        type: 'Other Supporting Document',
                        referenceNumber: '',
                        documentDate: regDate,
                        expiryDate: '',
                        issuingAuthority: '',
                        remarks: '',
                        verificationStatus: 'Pending Verification',
                      });
                      setShowAddSupportingDocModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#00205B] text-white rounded text-xs font-bold hover:bg-[#00205B] flex items-center gap-1 shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Other Supporting Document</span>
                  </button>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                  <table className="w-full text-left divide-y divide-slate-200 text-xs">
                    <thead className="bg-[#F8FAFC] text-slate-700 font-semibold">
                      <tr>
                        <th className="p-2.5">Document Name</th>
                        <th className="p-2.5">Document Type</th>
                        <th className="p-2.5">Reference No</th>
                        <th className="p-2.5">Issuing Authority</th>
                        <th className="p-2.5">File Details</th>
                        <th className="p-2.5">Compliance Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supportingDocumentsList.map((sDoc, sIdx) => (
                        <tr key={sDoc.id || sIdx} className="hover:bg-slate-50/70">
                          <td className="p-2.5 font-semibold text-[#00205B]">{sDoc.name}</td>
                          <td className="p-2.5 text-slate-600">{sDoc.type}</td>
                          <td className="p-2.5 font-mono text-slate-700">{sDoc.referenceNumber || '—'}</td>
                          <td className="p-2.5 text-slate-600">{sDoc.issuingAuthority || '—'}</td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-500">
                            {sDoc.fileName ? `${sDoc.fileName} (${(Number(sDoc.fileSize || 102400) / 1024).toFixed(1)} KB)` : 'No file'}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#00205B] flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-[#00205B]" /> Attached (Pending Verification)
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {(sDoc.fileName || sDoc.fileContent) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreUploadPreview({
                                      fileName: sDoc.fileName || sDoc.name,
                                      fileSize: sDoc.fileSize,
                                      fileContent: sDoc.fileContent,
                                      fileUrl: sDoc.fileUrl,
                                      fileType: sDoc.type,
                                    });
                                    setShowPreUploadModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[11px] font-bold transition shadow-xs"
                                  title="Preview document before submit"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Preview</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setSupportingDocumentsList((prev) => prev.filter((_, idx) => idx !== sIdx));
                                }}
                                className="px-2 py-1 border border-red-300 text-red-700 rounded text-[11px] font-semibold hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {supportingDocumentsList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400">
                            No additional supporting documents added. Click &quot;+ Add Other Supporting Document&quot; above to attach supplementary files.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PAGE 8: FACILITY LINKAGE AND ALLOCATIONS
              ========================================================================= */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-[#00205B]" />
                    Page 8: Facility Linkage &amp; Cross-Collateralization
                  </h4>
                  <p className="text-[#5B6472] text-[11px]">
                    Link this collateral asset to one or more CBS loan accounts and allocate security coverage.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">NET SECURITY VALUE CAPACITY</span>
                  <span className="font-mono font-extrabold text-[#00205B] text-sm">
                    ETB {netCollateralValue.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Capacity Usage Gauge */}
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Total Allocated: <strong className="font-mono text-[#00205B]">ETB {totalAllocated.toLocaleString()}</strong></span>
                  <span className={isAllocationOverflow ? 'text-red-600 font-bold' : 'text-slate-600'}>
                    Remaining Capacity: <strong className="font-mono">ETB {remainingCapacity.toLocaleString()}</strong>
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${isAllocationOverflow ? 'bg-red-600' : 'bg-[#00205B]'
                      }`}
                    style={{
                      width: `${Math.min(100, netCollateralValue > 0 ? (totalAllocated / netCollateralValue) * 100 : 0)}%`,
                    }}
                  />
                </div>
                {isAllocationOverflow && (
                  <p className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Allocation Overflow: Total allocated security exceeds Net Collateral Value! A risk waiver exception is required.
                  </p>
                )}
              </div>

              {/* CBS Facilities Table */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-xs">Eligible Borrower Facilities ({eligibleLoans.length})</span>
                  <input
                    type="text"
                    placeholder="Filter facilities by reference or type..."
                    value={facilitySearchQuery}
                    onChange={(e) => setFacilitySearchQuery(e.target.value)}
                    className="p-1 px-2 border border-slate-300 rounded text-xs w-64 bg-white"
                  />
                </div>

                <table className="w-full text-left divide-y divide-slate-200 text-xs">
                  <thead className="bg-[#EFF5FB] text-slate-700 font-semibold">
                    <tr>
                      <th className="p-2.5 text-center w-10">Link</th>
                      <th className="p-2.5">Facility Reference</th>
                      <th className="p-2.5">Product Type</th>
                      <th className="p-2.5">Sanctioned Limit</th>
                      <th className="p-2.5">Outstanding Balance</th>
                      <th className="p-2.5">Linkage Type</th>
                      <th className="p-2.5">Allocated Security (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleLoans.map((loan) => {
                      const isLinked = selectedFacilityIds.includes(loan.id);
                      return (
                        <tr key={loan.id} className={isLinked ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isLinked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFacilityIds([...selectedFacilityIds, loan.id]);
                                  const alloc = Math.min(
                                    loan.outstandingBalance || loan.sanctionedLimit || 1000000,
                                    remainingCapacity > 0 ? remainingCapacity : 1000000
                                  );
                                  setFacilityAllocations({ ...facilityAllocations, [loan.id]: alloc });
                                  setFacilityLinkageTypes({ ...facilityLinkageTypes, [loan.id]: 'Primary' });
                                } else {
                                  setSelectedFacilityIds(selectedFacilityIds.filter((id) => id !== loan.id));
                                  const copy = { ...facilityAllocations };
                                  delete copy[loan.id];
                                  setFacilityAllocations(copy);
                                }
                              }}
                              className="w-4 h-4 text-[#00205B] rounded"
                            />
                          </td>
                          <td className="p-2.5 font-mono font-bold text-[#00205B]">{loan.loanReference}</td>
                          <td className="p-2.5">{loan.facilityType || 'Term Loan'}</td>
                          <td className="p-2.5 font-mono">ETB {(loan.sanctionedLimit || 0).toLocaleString()}</td>
                          <td className="p-2.5 font-mono font-semibold">ETB {(loan.outstandingBalance || 0).toLocaleString()}</td>
                          <td className="p-2.5">
                            {isLinked ? (
                              <select
                                value={facilityLinkageTypes[loan.id] || 'Primary'}
                                onChange={(e) => setFacilityLinkageTypes({ ...facilityLinkageTypes, [loan.id]: e.target.value })}
                                className="p-1 border border-slate-300 rounded text-xs bg-white"
                              >
                                <option value="Primary">Primary</option>
                                <option value="Secondary">Secondary</option>
                                <option value="Pari-Passu">Pari-Passu</option>
                              </select>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {isLinked ? (
                              <input
                                type="number"
                                value={facilityAllocations[loan.id] || 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setFacilityAllocations({ ...facilityAllocations, [loan.id]: val });
                                }}
                                className="w-32 p-1 border border-blue-300 rounded font-mono font-bold text-xs"
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {eligibleLoans.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-400">
                          No eligible facilities found for this borrower in Core Banking records.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              PAGE 9: VALIDATION RESULTS
              ========================================================================= */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00205B]" />
                    Page 9: Real-Time Registration Validation Results
                  </h4>
                  <p className="text-[#5B6472] text-[11px]">
                    Evaluated against internal CIMS policy rules, taxonomy checks, and mandatory document completeness.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runPreValidation}
                  disabled={isValidating}
                  className="px-3 py-1.5 bg-[#00205B] text-white rounded font-bold hover:bg-[#00205B] flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                  <span>Re-Validate</span>
                </button>
              </div>

              {/* Summary Card */}
              {preValidationResult && (
                <div
                  className={`p-4 rounded-lg border ${preValidationResult.valid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : preValidationResult.hasHardBlock
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {preValidationResult.valid ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                      <span>{preValidationResult.summaryMessage}</span>
                    </div>
                    {preValidationResult.canSubmitAsException && (
                      <button
                        type="button"
                        onClick={() => setCurrentStep(10)}
                        className="px-3 py-1 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 text-xs shadow-xs"
                      >
                        Request Exception (Page 10) →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Validation Check Items List */}
              <div className="space-y-2">
                {preValidationResult?.checks?.map((check: ValidationCheckItemDto, idx: number) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border flex items-start justify-between ${check.passed
                        ? 'bg-white border-slate-200'
                        : check.overrideable
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-red-50/40 border-red-200'
                      }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {check.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : check.overrideable ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{check.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                            {check.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">{check.message}</p>
                      </div>
                    </div>
                    <div>
                      {check.passed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Passed
                        </span>
                      ) : check.overrideable ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Exception Eligible
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                          Hard Block
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              PAGE 10: EXCEPTION REQUEST AND MANAGEMENT
              ========================================================================= */}
          {currentStep === 10 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600" />
                  Page 10: Exception Request &amp; Management
                </h4>
                <p className="text-[#5B6472] text-[11px]">
                  Submit an authorized management exception for missing mandatory documents or policy waivers (such as capacity limit adjustments).
                </p>
              </div>

              {/* List of existing requested exceptions */}
              {collateralExceptions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#00205B] flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-600" />
                      Exceptions in Current Registration Package ({collateralExceptions.length})
                    </span>
                    <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-semibold">
                      Requires Checker / Risk Approval
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {collateralExceptions.map((exc, idx) => (
                      <div key={idx} className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-1.5 text-xs shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900">{exc.failedRequirement || exc.documentType}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                            Pending Exception Approval
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-700">
                          <strong>Justification:</strong> {exc.reason}
                        </div>
                        {exc.comments && (
                          <div className="text-[11px] text-slate-600">
                            <strong>Mitigation:</strong> {exc.comments}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-amber-100">
                          <span>Grace Period: {exc.validityDays || 30} days {exc.evidenceDocument ? `| Ref: ${exc.evidenceDocument}` : ''}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCollateralExceptions((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exceptionSubmitted ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-3">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h5 className="font-bold text-emerald-900 text-sm">Exception Request Saved &amp; Ready for Submission</h5>
                  <p className="text-emerald-800 text-xs max-w-lg mx-auto">{exceptionMessage}</p>
                  <p className="text-slate-500 text-[11px]">
                    Under four-eyes segregation of duties, the transaction will be routed to an authorized Checker / Credit Risk Approver. The maker cannot approve their own exception.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(11)}
                    className="px-4 py-2 bg-[#00205B] text-white rounded font-bold hover:bg-[#00205B] text-xs shadow-xs"
                  >
                    Proceed to Final Review (Page 11) →
                  </button>
                </div>
              ) : (
                <div className="bg-white p-5 border border-slate-200 rounded-lg space-y-4 shadow-xs">
                  <span className="font-bold text-xs text-[#00205B] block border-b pb-2">
                    {collateralExceptions.length > 0 ? 'Add Another Exception / Policy Waiver' : 'Capture Exception Justification'}
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Exception Type <span className="text-red-500">*</span></label>
                      <select
                        value={exceptionForm.exceptionType}
                        onChange={(e) => setExceptionForm({ ...exceptionForm, exceptionType: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded font-semibold text-xs"
                      >
                        <option value="Missing Mandatory Document">Missing Mandatory Document</option>
                        <option value="Capacity Overflow">Collateral Capacity Overflow Waiver</option>
                        <option value="Unapproved Insurer">Unapproved Insurer Exception</option>
                        <option value="Underinsured Collateral">Underinsured Collateral Waiver</option>
                        <option value="Short Policy Tenor">Short Policy Tenor Exception</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Failed Target Requirement</label>
                      <input
                        type="text"
                        value={exceptionForm.failedRequirement}
                        onChange={(e) => setExceptionForm({ ...exceptionForm, failedRequirement: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                        placeholder="e.g. Title Deed / Property Ownership Certificate"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Business Justification / Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={exceptionForm.reason}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                      placeholder="Explain the commercial justification and why this collateral registration should proceed prior to document submission..."
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Risk Mitigation &amp; Remarks <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={exceptionForm.comments}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, comments: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                      placeholder="State commitments, undertaking letter dates, or additional security held as mitigation..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Requested Validity Period (Days)</label>
                      <input
                        type="number"
                        min="7"
                        max="365"
                        value={exceptionForm.validityDays}
                        onChange={(e) => setExceptionForm({ ...exceptionForm, validityDays: Number(e.target.value) })}
                        className="w-full p-2 border border-slate-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Supporting Undertaking Document</label>
                      <input
                        type="text"
                        placeholder="Undertaking Letter Reference No"
                        value={exceptionForm.evidenceDocument}
                        onChange={(e) => setExceptionForm({ ...exceptionForm, evidenceDocument: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (!exceptionForm.reason.trim()) {
                          alert('Business justification / reason is mandatory.');
                          return;
                        }
                        const newExc = {
                          failedRequirement: exceptionForm.failedRequirement || exceptionForm.exceptionType,
                          documentType: exceptionForm.failedRequirement || exceptionForm.exceptionType,
                          reason: exceptionForm.reason.trim(),
                          comments: exceptionForm.comments.trim() || exceptionForm.reason.trim(),
                          validityDays: exceptionForm.validityDays || 30,
                          evidenceDocument: exceptionForm.evidenceDocument.trim(),
                        };
                        setCollateralExceptions((prev) => [...prev, newExc]);
                        setExceptionForm({
                          exceptionType: 'Missing Mandatory Document',
                          failedRequirement: '',
                          reason: '',
                          comments: '',
                          validityDays: 90,
                          evidenceDocument: '',
                          evidenceFileContent: '',
                        });
                        alert('Exception added to collateral registration package.');
                      }}
                      className="px-4 py-2 bg-slate-800 text-white rounded font-bold hover:bg-slate-900 text-xs shadow-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Exception to Package</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSubmitException}
                      disabled={isSubmittingException}
                      className="px-4 py-2 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 text-xs shadow-xs flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{isSubmittingException ? 'Submitting Exception...' : 'Save & Route Exception to Risk Approver'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PAGE 11: FINAL REVIEW AND SUBMISSION
              ========================================================================= */}
          {currentStep === 11 && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-[#101828] text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#00205B]" />
                    Page 11: Comprehensive Final Review &amp; Maker-Checker Submission
                  </h4>
                  <p className="text-[#5B6472] text-[11px]">
                    Verify all registration data across classification, borrower, legal ownership, valuation, security rank, facilities, and documents.
                  </p>
                </div>
              </div>

              {submissionResult ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-900 text-base">Collateral Successfully Registered!</h4>
                  <p className="text-emerald-800 text-xs max-w-lg mx-auto">{submissionResult.message}</p>
                  <div className="p-3 bg-white rounded border border-emerald-200 text-slate-700 text-xs max-w-md mx-auto space-y-1">
                    <div><strong>Asset Code:</strong> {submissionResult.collateral?.code}</div>
                    <div>
                      <strong>Status:</strong>{' '}
                      <span className={`font-bold ${submissionResult.submissionType === 'EXCEPTION_BASED' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {submissionResult.collateral?.status || (submissionResult.submissionType === 'EXCEPTION_BASED' ? 'Pending Exception Approval' : 'Pending Approval')}
                      </span>
                    </div>
                    <div><strong>Submission Type:</strong> <span className="font-semibold">{submissionResult.submissionType || 'NORMAL'}</span></div>
                    {submissionResult.exceptionsCount ? (
                      <div><strong>Exceptions Created:</strong> <span className="font-bold text-amber-700">{submissionResult.exceptionsCount} request(s)</span></div>
                    ) : null}
                    <div><strong>Workflow Task ID:</strong> <span className="font-mono text-[#00205B]">{submissionResult.workflowTaskId || 'Pending Checker'}</span></div>
                    <div><strong>Segregation of Duties:</strong> Awaiting independent four-eyes authorization by Checker / Approver.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (submissionResult.collateral) onSuccess(submissionResult.collateral);
                      onClose();
                    }}
                    className="px-5 py-2 bg-[#00205B] text-white rounded-lg font-bold hover:bg-[#00205B] text-xs shadow-md"
                  >
                    Close Wizard &amp; View in Collateral Register
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Executive Submission Compliance Banner */}
                  {(() => {
                    const missingMandatoryRules = dynamicDocumentChecklist.filter(
                      (item) => item.isMandatory && !documentsList.some((d) => docTypeMatches(item.type, d.type) && (d.fileContent || d.fileName))
                    );
                    const prohibitedMissingDocs = missingMandatoryRules.filter((item) => item.exceptionAllowed === false);
                    const unexcusedMissingDocs = missingMandatoryRules.filter(
                      (item) => !collateralExceptions.some((e) => (item.ruleId && e.ruleId === item.ruleId) || docTypeMatches(item.type, e.failedRequirement) || docTypeMatches(item.type, e.documentType))
                    );
                    const isCapacityBlocked = isAllocationOverflow && !collateralExceptions.some((e) => e.failedRequirement?.toLowerCase().includes('capacity') || e.exceptionType?.toLowerCase().includes('capacity'));
                    const isBlocked = prohibitedMissingDocs.length > 0 || unexcusedMissingDocs.length > 0 || isCapacityBlocked;
                    const isExcSubmission = !isBlocked && (collateralExceptions.length > 0 || isAllocationOverflow);

                    if (prohibitedMissingDocs.length > 0) {
                      return (
                        <div className="p-3 bg-red-50 border border-red-300 rounded-lg flex items-start justify-between gap-3 text-red-900">
                          <div className="flex items-start gap-2.5">
                            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-bold text-xs">Submission Hard-Blocked: Policy Prohibits Exceptions for Mandatory Documents</h5>
                              <p className="text-[11px] text-red-800 mt-0.5">
                                Admin policy strictly forbids exceptions for the following mandatory document(s). Physical/digital file upload is required before registration:
                              </p>
                              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] font-semibold text-red-700">
                                {prohibitedMissingDocs.map((doc, i) => (
                                  <li key={i}>{doc.name} (Exception Prohibited per Admin Matrix)</li>
                                ))}
                              </ul>
                              <p className="text-[10px] text-red-600 mt-1">
                                Return to Page 7 to attach these required files.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(7)}
                            className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 text-xs shrink-0 shadow-xs"
                          >
                            Go to Page 7 →
                          </button>
                        </div>
                      );
                    }

                    if (unexcusedMissingDocs.length > 0) {
                      return (
                        <div className="p-3 bg-red-50 border border-red-300 rounded-lg flex items-start justify-between gap-3 text-red-900">
                          <div className="flex items-start gap-2.5">
                            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-bold text-xs">Submission Blocked: Missing Mandatory Document Requirements</h5>
                              <p className="text-[11px] text-red-800 mt-0.5">
                                Admin policy requires the following mandatory document(s) before this collateral can be submitted:
                              </p>
                              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] font-semibold text-red-700">
                                {unexcusedMissingDocs.map((doc, i) => (
                                  <li key={i}>{doc.name}</li>
                                ))}
                              </ul>
                              <p className="text-[10px] text-red-600 mt-1">
                                Return to Page 7 to attach these files or request an authorized management exception with justification.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(7)}
                            className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 text-xs shrink-0 shadow-xs"
                          >
                            Go to Page 7 →
                          </button>
                        </div>
                      );
                    }

                    if (isCapacityBlocked) {
                      return (
                        <div className="p-3 bg-red-50 border border-red-300 rounded-lg flex items-start justify-between gap-3 text-red-900">
                          <div className="flex items-start gap-2.5">
                            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-bold text-xs">Submission Blocked: Facility Allocation Exceeds Net Collateral Value</h5>
                              <p className="text-[11px] text-red-800 mt-0.5">
                                Total allocated security (ETB {totalAllocated.toLocaleString()}) exceeds Net Collateral Value capacity (ETB {netCollateralValue.toLocaleString()}) by ETB {(totalAllocated - netCollateralValue).toLocaleString()}.
                              </p>
                              <p className="text-[10px] text-red-600 mt-1">
                                Adjust allocations on Page 8 or request a Collateral Capacity Overflow Waiver on Page 10.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(8)}
                            className="px-3 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 text-xs shrink-0 shadow-xs"
                          >
                            Go to Page 8 →
                          </button>
                        </div>
                      );
                    }

                    if (isExcSubmission) {
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2.5 text-amber-900">
                          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <h5 className="font-bold text-xs flex items-center gap-1.5">
                              <span>Path B: Exception-Based Submission Mode</span>
                              <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[10px] font-bold">
                                {collateralExceptions.length} Exception(s)
                              </span>
                            </h5>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              This registration includes <strong>{collateralExceptions.length}</strong> justified exception request(s) for missing mandatory documents. The collateral will be routed to Credit Risk / Branch Management under action <code className="bg-amber-100 px-1 rounded font-mono">APPROVE_COLLATERAL_AND_EXCEPTION</code> with status <span className="font-bold">Pending Exception Approval</span>.
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {collateralExceptions.map((exc, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-medium text-amber-800">
                                  <Shield className="w-2.5 h-2.5 text-amber-600" />
                                  <span>{exc.failedRequirement}: {exc.reason} ({exc.validityDays || 30} days)</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2.5 text-emerald-900">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <h5 className="font-bold text-xs">Path A: Normal Submission Mode — All Mandatory Requirements Satisfied</h5>
                          <p className="text-[11px] text-emerald-800 mt-0.5">
                            All Admin-configured mandatory documents are attached (pending verification). The registration will be submitted for standard Maker-Checker authorization with status <span className="font-bold">Pending Approval</span>.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Summary Grid Cards (9 Comprehensive Sections) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Card 1: Initiation */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <Shield className="w-3.5 h-3.5 text-[#00205B]" /> 1. Registration Initiation
                      </span>
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <div>Ref: <strong className="font-mono">{regCode}</strong></div>
                        <div>Date: <strong>{regDate}</strong></div>
                        <div>Category: <strong>{selectedCategory}</strong></div>
                        <div>Subtype: <strong>{selectedSubtype}</strong></div>
                        <div>Branch: <strong>{selectedBranch}</strong></div>
                        <div>Segment: <strong>{selectedSegment}</strong></div>
                      </div>
                    </div>

                    {/* Card 2: Borrower */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <User className="w-3.5 h-3.5 text-[#00205B]" /> 2. Borrower Information
                      </span>
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <div>Name: <strong>{selectedBorrower?.name || 'N/A'}</strong></div>
                        <div>CIF: <strong className="font-mono">{selectedBorrower?.cif || selectedBorrower?.id || 'N/A'}</strong></div>
                        <div>Type: <strong>{selectedBorrower?.customerType || 'Corporate'}</strong></div>
                        <div>TIN: <strong className="font-mono">{selectedBorrower?.taxIdNo || 'N/A'}</strong></div>
                      </div>
                    </div>

                    {/* Card 3: Legal Owner */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <Users className="w-3.5 h-3.5 text-[#00205B]" /> 3. Legal Collateral Owner
                      </span>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div>Ownership Type: <strong className="text-[#00205B]">{ownershipType}</strong></div>
                        {ownershipType === 'Borrower-owned' && (
                          <div>Owner: Same as borrower (100% share)</div>
                        )}
                        {ownershipType === 'Third-party-owned' && (
                          <div>
                            Owner: <strong>{tpIsExistingCustomer ? selectedTpCustomer?.name : tpOwnerForm.name}</strong> | Rel: <strong>{tpOwnerForm.relationshipToBorrower}</strong>
                          </div>
                        )}
                        {ownershipType === 'Jointly-owned' && (
                          <div>Joint Co-Owners: {jointOwners.map((o) => `${o.name} (${o.percentage}%)`).join(', ')}</div>
                        )}
                      </div>
                    </div>

                    {/* Card 4: Valuation & NSV */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <DollarSign className="w-3.5 h-3.5 text-[#00205B]" /> 4. Valuation &amp; Net Value
                      </span>
                      <div className="space-y-1 text-[11px] text-slate-700">
                        <div>Assessed: <strong>ETB {bankAssessedValue.toLocaleString()}</strong></div>
                        <div>Haircut: <strong>{haircutPct}%</strong></div>
                        <div className="pt-1 border-t border-slate-100 flex justify-between font-bold">
                          <span>NSV Capacity:</span>
                          <span className="font-mono text-[#00205B]">ETB {netCollateralValue.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 5: Security Rank */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <Award className="w-3.5 h-3.5 text-[#00205B]" /> 5. Security Rank &amp; Priority
                      </span>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div>Rank: <strong className="text-[#00205B]">{securityRank} Degree</strong> ({isFirstDegreeInternal ? 'Internal' : 'External'})</div>
                        {!isFirstDegreeInternal && (
                          <div>Senior Holder: <strong>{firstDegreeHolderName}</strong> (Bal: ETB {firstDegreeOutstandingBalance.toLocaleString()})</div>
                        )}
                        {bankNotedAsSecondMortgagee && (
                          <div className="text-emerald-700 font-bold">✓ Dashen Bank noted as 2nd mortgagee in registry</div>
                        )}
                      </div>
                    </div>

                    {/* Card 6: Mandatory Documents */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <FileText className="w-3.5 h-3.5 text-[#00205B]" /> 6. Mandatory Documents Compliance
                      </span>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div>Admin Rules: <strong>{dynamicDocumentChecklist.filter(d => d.isMandatory).length} configured</strong></div>
                        <div>Attached: <strong>{documentsList.filter(d => d.isMandatory && (d.fileContent || d.fileName)).length}</strong> (Pending Verification)</div>
                        {collateralExceptions.length > 0 && (
                          <div className="text-amber-700 font-semibold">
                            Exceptions: <strong>{collateralExceptions.length}</strong> (Awaiting Approval)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card 7: Other Supporting Documents */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <FileText className="w-3.5 h-3.5 text-blue-600" /> 7. Supporting Documents (Ad-Hoc)
                      </span>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div>Auxiliary Attached: <strong>{supportingDocumentsList.length}</strong></div>
                        {supportingDocumentsList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                            {supportingDocumentsList.map((sd, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px] border border-blue-200 font-medium truncate max-w-[120px]" title={sd.name}>
                                {sd.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic text-[10px]">None attached (optional)</div>
                        )}
                      </div>
                    </div>

                    {/* Card 8: Facilities & Cross-Collateralization */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <Link2 className="w-3.5 h-3.5 text-[#00205B]" /> 8. Facilities &amp; Allocation
                      </span>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div>Linked Accounts: <strong>{selectedFacilityIds.length}</strong></div>
                        <div>Total Allocated: <strong className="font-mono text-[#00205B]">ETB {totalAllocated.toLocaleString()}</strong></div>
                        {isAllocationOverflow ? (
                          <div className="text-red-600 font-bold">Overflow: ETB {(totalAllocated - netCollateralValue).toLocaleString()}</div>
                        ) : (
                          <div className="text-emerald-700 font-semibold">Remaining: ETB {remainingCapacity.toLocaleString()}</div>
                        )}
                      </div>
                    </div>

                    {/* Card 9: Dual-Control Routing */}
                    <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-xs">
                      <span className="font-bold text-[#00205B] text-xs flex items-center gap-1 border-b pb-1 mb-2">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" /> 9. Segregation of Duties
                      </span>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div>Maker: <strong>{currentUser.username}</strong> ({currentUser.role})</div>
                        <div>Target Status: <span className="font-bold text-[#00205B]">{collateralExceptions.length > 0 ? 'Pending Exception Approval' : 'Pending Approval'}</span></div>
                        <div className="text-[10px] text-slate-500 pt-1 border-t">
                          Checker approval required. Maker self-approval strictly prevented.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Bottom Controls */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs">
          <div>
            {currentStep > 1 && !submissionResult && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-3.5 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-200 font-semibold flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!submissionResult && (
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-3.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1 shadow-xs"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" /> Save Draft
              </button>
            )}

            {currentStep < 11 && !submissionResult && (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 2 && !selectedBorrowerId) {
                    alert('Please select a borrower before continuing.');
                    return;
                  }
                  setCurrentStep(currentStep + 1);
                }}
                className="px-4 py-1.5 bg-[#00205B] text-white rounded font-bold hover:bg-[#00205B] flex items-center gap-1 shadow-xs"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 11 && !submissionResult && (() => {
              const missingMandatoryRules = dynamicDocumentChecklist.filter(
                (item) => item.isMandatory && !documentsList.some((d) => docTypeMatches(item.type, d.type) && (d.fileContent || d.fileName))
              );
              const prohibitedMissingDocs = missingMandatoryRules.filter((item) => item.exceptionAllowed === false);
              const unexcusedMissingDocs = missingMandatoryRules.filter(
                (item) => !collateralExceptions.some((e) => (item.ruleId && e.ruleId === item.ruleId) || docTypeMatches(item.type, e.failedRequirement) || docTypeMatches(item.type, e.documentType))
              );
              const isCapacityBlocked = isAllocationOverflow && !collateralExceptions.some((e) => e.failedRequirement?.toLowerCase().includes('capacity') || e.exceptionType?.toLowerCase().includes('capacity'));
              const isBlocked = prohibitedMissingDocs.length > 0 || unexcusedMissingDocs.length > 0 || isCapacityBlocked;
              const isExcSubmission = !isBlocked && (collateralExceptions.length > 0 || isAllocationOverflow);

              if (isBlocked) {
                return (
                  <button
                    type="button"
                    disabled
                    className="px-5 py-1.5 bg-slate-300 text-slate-500 rounded font-bold cursor-not-allowed flex items-center gap-1.5 shadow-none"
                    title={`Submission blocked: ${prohibitedMissingDocs.length > 0 ? 'Policy prohibits exception for missing document' : unexcusedMissingDocs.length > 0 ? 'Missing mandatory documents' : 'Capacity overflow'}`}
                  >
                    <XCircle className="w-4 h-4 text-slate-500" />
                    <span>Submission Blocked (Requirements Unmet)</span>
                  </button>
                );
              }

              if (isExcSubmission) {
                return (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="px-5 py-1.5 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 flex items-center gap-1.5 shadow-md transition"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Submit Collateral + Exception(s) for Authorization</span>
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="px-5 py-1.5 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-800 flex items-center gap-1.5 shadow-md transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Submit Collateral for Checker Authorization</span>
                </button>
              );
            })()}
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (() => {
          const isExcSubmission = collateralExceptions.length > 0;
          return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4">
              <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full p-5 space-y-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${isExcSubmission ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-[#00205B]'}`}>
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {isExcSubmission ? 'Confirm Exception-Based Submission' : 'Confirm Collateral Registration'}
                    </h4>
                    <p className="text-slate-500 text-[11px]">Maker-Checker Four-Eyes Verification</p>
                  </div>
                </div>

                <div className={`p-3 rounded border text-slate-700 leading-relaxed ${isExcSubmission ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  {isExcSubmission ? (
                    <div className="space-y-1.5">
                      <p>
                        You are submitting registration for collateral <strong>{regCode}</strong> with <strong>{collateralExceptions.length}</strong> mandatory document exception request(s).
                      </p>
                      <p className="text-[11px] text-amber-800 font-semibold">
                        This transaction will enter the workflow as <em>&quot;Pending Exception Approval&quot;</em> and must be independently authorized by an authorized Checker before perfection.
                      </p>
                    </div>
                  ) : (
                    <p>
                      Please confirm that you have reviewed the collateral classification, borrower and owner information, asset details, valuation, supporting documents, security information, and linked facilities. All mandatory document requirements have been satisfied.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 rounded font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={isSubmittingFinal}
                    className={`px-4 py-1.5 rounded font-bold shadow-xs flex items-center gap-1.5 text-white ${isExcSubmission ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-700 hover:bg-emerald-800'
                      }`}
                  >
                    {isExcSubmission ? <Shield className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    <span>
                      {isSubmittingFinal
                        ? 'Submitting to Approver...'
                        : isExcSubmission
                          ? 'Confirm & Submit with Exceptions'
                          : 'Confirm & Submit for Authorization'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add Supporting Document Modal (Page 7) */}
        {showAddSupportingDocModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-70 p-4">
            <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg text-[#00205B]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Add Other Supporting Document</h4>
                    <p className="text-slate-500 text-[11px]">Attach auxiliary documentation to collateral record</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSupportingDocModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Document Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={supportingDocForm.name || ''}
                      onChange={(e) => setSupportingDocForm({ ...supportingDocForm, name: e.target.value })}
                      placeholder="e.g. Site Inspection Photo Sheet"
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Document Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={supportingDocForm.type || 'Other Supporting Document'}
                      onChange={(e) => setSupportingDocForm({ ...supportingDocForm, type: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="Site Plan / Layout">Site Plan / Layout</option>
                      <option value="Building Permit">Building Permit</option>
                      <option value="Valuation Report">Valuation Report (Supporting)</option>
                      <option value="Tax Clearance Certificate">Tax Clearance Certificate</option>
                      <option value="Commercial Registration">Commercial Registration</option>
                      <option value="Trade License">Trade License</option>
                      <option value="Power of Attorney">Power of Attorney</option>
                      <option value="Board Resolution">Board Resolution</option>
                      <option value="Spouse Consent">Spouse Consent</option>
                      <option value="Marriage Certificate">Marriage Certificate</option>
                      <option value="Insurance Policy">Insurance Policy Schedule</option>
                      <option value="Borrower Undertaking Letter">Borrower Undertaking Letter</option>
                      <option value="Other Supporting Document">Other Supporting Document</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Reference / Cert Number</label>
                    <input
                      type="text"
                      value={supportingDocForm.referenceNumber || ''}
                      onChange={(e) => setSupportingDocForm({ ...supportingDocForm, referenceNumber: e.target.value })}
                      placeholder="e.g. DOC-REF-2026-99"
                      className="w-full p-2 border border-slate-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Issuing Authority</label>
                    <input
                      type="text"
                      value={supportingDocForm.issuingAuthority || ''}
                      onChange={(e) => setSupportingDocForm({ ...supportingDocForm, issuingAuthority: e.target.value })}
                      placeholder="e.g. City Administration"
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Document Date</label>
                    <input
                      type="date"
                      value={supportingDocForm.documentDate || regDate}
                      onChange={(e) => setSupportingDocForm({ ...supportingDocForm, documentDate: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Expiry Date (If applicable)</label>
                    <input
                      type="date"
                      value={supportingDocForm.expiryDate || ''}
                      onChange={(e) => setSupportingDocForm({ ...supportingDocForm, expiryDate: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Remarks / Purpose</label>
                  <input
                    type="text"
                    value={supportingDocForm.remarks || ''}
                    onChange={(e) => setSupportingDocForm({ ...supportingDocForm, remarks: e.target.value })}
                    placeholder="Auxiliary document attached for reference"
                    className="w-full p-2 border border-slate-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    File Upload (.pdf, .jpg, .png) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.tiff"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const dataUrl = reader.result as string;
                        const base64 = dataUrl.split(',')[1] || '';
                        setSupportingDocForm((prev) => ({
                          ...prev,
                          fileName: file.name,
                          fileSize: file.size,
                          fileContent: base64,
                          fileUrl: dataUrl,
                          verificationStatus: 'Pending Verification',
                        }));
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full p-1.5 border border-slate-300 rounded text-xs"
                  />
                  {supportingDocForm.fileName && (
                    <div className="flex items-center justify-between mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{supportingDocForm.fileName}</span>
                        <span className="text-[10px] text-slate-500 ml-2 font-mono">
                          ({(Number(supportingDocForm.fileSize || 0) / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreUploadPreview({
                            fileName: supportingDocForm.fileName || 'Supporting Document',
                            fileSize: supportingDocForm.fileSize,
                            fileContent: supportingDocForm.fileContent,
                            fileUrl: supportingDocForm.fileUrl,
                          });
                          setShowPreUploadModal(true);
                        }}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview File
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSupportingDocModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!supportingDocForm.name?.trim()) {
                      alert('Document Name is required.');
                      return;
                    }
                    const newDoc: SupportingDocItem = {
                      id: `sup-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
                      name: supportingDocForm.name.trim(),
                      type: supportingDocForm.type || 'Other Supporting Document',
                      referenceNumber: supportingDocForm.referenceNumber || '',
                      documentDate: supportingDocForm.documentDate || regDate,
                      expiryDate: supportingDocForm.expiryDate || '',
                      issuingAuthority: supportingDocForm.issuingAuthority || '',
                      remarks: supportingDocForm.remarks || 'Supporting Document — Not a Mandatory Rule',
                      fileName: supportingDocForm.fileName || 'supporting_document.pdf',
                      fileContent: supportingDocForm.fileContent || 'JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDw...',
                      fileSize: supportingDocForm.fileSize || 102400,
                      verificationStatus: 'Pending Verification',
                    };
                    setSupportingDocumentsList((prev) => [...prev, newDoc]);
                    setShowAddSupportingDocModal(false);
                  }}
                  className="px-4 py-1.5 bg-[#00205B] text-white rounded font-bold hover:bg-[#00205B] shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Supporting Document</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Per-Requirement Exception Request Modal (Page 7) */}
        {activeModalException && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-70 p-4">
            <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {activeModalException.isEdit ? 'Edit Exception Request' : 'Request Exception for Mandatory Document'}
                    </h4>
                    <p className="text-slate-500 text-[11px]">Authorized Management Override &amp; Risk Justification</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModalException(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Document Requirement</label>
                  <div className="p-2 bg-slate-100 rounded font-semibold text-slate-800 text-xs border border-slate-200">
                    {activeModalException.documentType}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Business Justification / Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={modalExceptionReason}
                    onChange={(e) => setModalExceptionReason(e.target.value)}
                    placeholder="State the commercial justification and why this collateral registration should proceed prior to document submission..."
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#D48806]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Risk Mitigation &amp; Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={modalExceptionComments}
                    onChange={(e) => setModalExceptionComments(e.target.value)}
                    placeholder="State commitments, undertaking letter dates, or additional security held as mitigation..."
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-[#D48806]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Grace Period (Days)</label>
                    <select
                      value={modalExceptionDays}
                      onChange={(e) => setModalExceptionDays(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value={15}>15 Days</option>
                      <option value={30}>30 Days (Standard)</option>
                      <option value={60}>60 Days</option>
                      <option value={90}>90 Days</option>
                      <option value={180}>180 Days (Long-term)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Supporting Undertaking / Ref</label>
                    <input
                      type="text"
                      value={modalExceptionEvidence}
                      onChange={(e) => setModalExceptionEvidence(e.target.value)}
                      placeholder="e.g. UND-2026-081"
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModalException(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!modalExceptionReason.trim()) {
                      alert('Business justification is required to request an exception.');
                      return;
                    }
                    const newExc = {
                      ruleId: activeModalException.ruleId,
                      failedRequirement: activeModalException.documentType,
                      documentType: activeModalException.documentType,
                      reason: modalExceptionReason.trim(),
                      comments: modalExceptionComments.trim() || modalExceptionReason.trim(),
                      validityDays: modalExceptionDays,
                      evidenceDocument: modalExceptionEvidence.trim(),
                    };

                    setCollateralExceptions((prev) => {
                      const filtered = prev.filter(
                        (e) =>
                          !(
                            (activeModalException.ruleId && e.ruleId === activeModalException.ruleId) ||
                            docTypeMatches(activeModalException.documentType, e.failedRequirement) ||
                            docTypeMatches(activeModalException.documentType, e.documentType)
                          )
                      );
                      return [...filtered, newExc];
                    });

                    setActiveModalException(null);
                  }}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded font-bold hover:bg-amber-700 shadow-xs flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Save Exception Request</span>
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Pre-Upload File Preview Modal (Preview before submit) */}
        <FileUploadPreviewModal
          isOpen={showPreUploadModal}
          onClose={() => {
            setShowPreUploadModal(false);
            setPreUploadPreview(null);
          }}
          fileData={preUploadPreview}
        />
      </div>
    </div>
  );
};
