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
  ShieldAlert,
  Send,
  HelpCircle,
  Calendar,
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
  onRegisterCollateral: (col: Partial<Collateral>, allocations?: any[], documents?: any[]) => Promise<void>;
  onAddLink: (loanId: string, collateralId: string, amount: number) => Promise<void>;
  onRemoveLink: (linkId: string) => Promise<void>;
  onValidateRelease: (collateralId: string) => Promise<{ canRelease: boolean; pendingExposure: number; activeLoans: string[]; message: string }>;
  onInitiateTransfer: (collateralId: string, destSegment: string, reason: string) => Promise<void>;
  onMaintainCollateral?: (collateralId: string, changes: Record<string, any>) => Promise<void>;
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
  onRegisterCollateral,
  onAddLink,
  onRemoveLink,
  onValidateRelease,
  onInitiateTransfer,
  onMaintainCollateral,
}) => {
  const [selectedCol, setSelectedCol] = useState<Collateral | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'exposure' | 'links' | 'policies' | 'documents' | 'exceptions'>('details');
  const [exposureSummary, setExposureSummary] = useState<ExposureAdequacySummary | null>(null);
  const [loadingExposure, setLoadingExposure] = useState(false);

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

  // Document upload modal state (in 360 modal)
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadDocType, setUploadDocType] = useState('Title Deed / Property Ownership Certificate');
  const [uploadDocExpiry, setUploadDocExpiry] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Link modal state (in 360 modal)
  const [linkLoanId, setLinkLoanId] = useState('');
  const [linkAmount, setLinkAmount] = useState(5000000);
  const [linkSubmitting, setLinkSubmitting] = useState(false);

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

  const defaultCurrency = systemParameters.find((p) => p.paramKey === 'default_currency')?.paramValue || 'ETB';

  const [newCol, setNewCol] = useState<Partial<Collateral>>({
    code: `COL-${Math.floor(100000 + Math.random() * 900000)}`,
    category: taxonomies?.[0]?.category || 'Immovable Properties',
    type: 'Buildings',
    description: '',
    location: '',
    registrationNumber: '',
    titleDeedNumber: '',
    valuationAmount: 10000000,
    haircut: 20,
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
  });

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
  });

  const [destSegment, setDestSegment] = useState('Retail Banking');
  const [transferReason, setTransferReason] = useState('');
  const [releaseCheck, setReleaseCheck] = useState<{ canRelease: boolean; pendingExposure: number; activeLoans: string[]; message: string } | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(false);

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
    if (!custIdOrCif) return facilities;
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
      const matchCat = catName.toLowerCase() === chosenCat.toLowerCase() ||
                       catName.toLowerCase().includes(chosenCat.toLowerCase()) ||
                       chosenCat.toLowerCase().includes(catName.toLowerCase());
      if (matchCat) {
        const rawSub = t.subCategory || t.category;
        if (rawSub) {
          rawSub.split(/[,;\n/]+/).forEach((part) => {
            const trimmed = part.trim();
            if (trimmed && !list.includes(trimmed) && trimmed.toLowerCase() !== chosenCat.toLowerCase()) {
              list.push(trimmed);
            }
          });
        }
      }
    });

    const standardMatch = Object.entries(DEFAULT_SUBTYPES_BY_CATEGORY).find(([catName]) =>
      catName.toLowerCase() === chosenCat.toLowerCase() ||
      catName.toLowerCase().includes(chosenCat.toLowerCase()) ||
      chosenCat.toLowerCase().includes(catName.toLowerCase())
    );

    if (standardMatch && standardMatch[1]) {
      standardMatch[1].forEach((sub) => {
        if (!list.includes(sub)) {
          list.push(sub);
        }
      });
    }

    return list.length > 0 ? list : [chosenCat];
  };

  // Active sub-types configured under the chosen category from backend taxonomy
  const availableTaxonomyTypes = useMemo(() => {
    return getSubtypesForCategory(newCol.category);
  }, [taxonomies, newCol.category]);

  // Helper to determine mandatory documents configured in Admin for category + type + ownership
  const getRequiredDocs = (category?: string, type?: string, ownershipType?: string): MandatoryDocumentRule[] => {
    const cat = (category || newCol.category || 'Immovable Properties').toLowerCase().trim();
    const isThirdParty = (ownershipType || ownerDetails.ownershipType) === 'Third-party-owned';

    // 1. Match directly from Admin configured rules (mandatoryDocRules)
    const activeRules = (mandatoryDocRules || []).filter((r) => r.mandatory !== false);
    const matched = activeRules.filter((r) => {
      const rc = (r.collateralCategory || '').toLowerCase().trim();
      if (rc === 'all' || rc === 'all categories') return true;
      if (rc === cat || rc.includes(cat) || cat.includes(rc)) return true;
      if (isThirdParty && (rc.includes('third') || rc.includes('consent') || rc.includes('pledge'))) return true;
      return false;
    });

    const results: MandatoryDocumentRule[] = [...matched];

    // 2. If no admin rules configured yet, provide baseline regulatory mandatory document rules
    if (results.length === 0) {
      if (cat.includes('immovable') || cat.includes('real') || cat.includes('building') || cat.includes('land')) {
        results.push({ id: 'rule-bld-1', collateralCategory: 'Immovable Properties', documentType: 'Title Deed / Property Ownership Certificate', mandatory: true });
        results.push({ id: 'rule-bld-2', collateralCategory: 'Immovable Properties', documentType: 'Approved Building Plan', mandatory: true });
        results.push({ id: 'rule-bld-3', collateralCategory: 'Immovable Properties', documentType: 'Valuation Report', mandatory: true });
      } else if (cat.includes('movable') || cat.includes('vehicle')) {
        results.push({ id: 'rule-veh-1', collateralCategory: 'Movable Properties', documentType: 'Vehicle Registration Certificate / Logbook', mandatory: true });
        results.push({ id: 'rule-veh-2', collateralCategory: 'Movable Properties', documentType: 'Valuation Report', mandatory: true });
      } else if (cat.includes('machin') || cat.includes('business mortgage')) {
        results.push({ id: 'rule-mac-1', collateralCategory: 'Business Mortgages', documentType: 'Machinery Ownership Certificate', mandatory: true });
        results.push({ id: 'rule-mac-2', collateralCategory: 'Business Mortgages', documentType: 'Purchase Document / Invoice', mandatory: true });
        results.push({ id: 'rule-mac-3', collateralCategory: 'Business Mortgages', documentType: 'Valuation Report', mandatory: true });
      } else if (cat.includes('guarantee')) {
        results.push({ id: 'rule-gar-1', collateralCategory: 'Guarantees', documentType: 'Guarantee Contract / Agreement', mandatory: true });
      } else if (cat.includes('financial')) {
        results.push({ id: 'rule-fin-1', collateralCategory: 'Financial Assets', documentType: 'Fixed Deposit Certificate / Treasury Instrument', mandatory: true });
      } else {
        results.push({ id: 'rule-gen-1', collateralCategory: 'All', documentType: 'Ownership Document / Certificate', mandatory: true });
      }
    }

    // 3. For third-party owned collateral, ensure Third-Party Consent & Pledge is required
    if (isThirdParty) {
      if (!results.some((r) => r.documentType.toLowerCase().includes('consent') || r.documentType.toLowerCase().includes('pledge'))) {
        results.push({ id: 'rule-tp-1', collateralCategory: 'Third-Party', documentType: 'Third-Party Consent and Pledge Agreement', mandatory: true });
      }
    }

    return results;
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
        (d) => d.isMandatory && (d.type.toLowerCase().includes(rule.documentType.toLowerCase()) || rule.documentType.toLowerCase().includes(d.type.toLowerCase()))
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
        (d.type.toLowerCase().includes(req.documentType.toLowerCase()) || req.documentType.toLowerCase().includes(d.type.toLowerCase())) &&
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
    if (newCol.haircut === undefined || Number(newCol.haircut) < 0 || Number(newCol.haircut) > 95) errors.push('Haircut Percentage must be between 0% and 95%.');
    return errors;
  };

  const getStep4Errors = (): string[] => {
    const errors: string[] = [];
    if (ownerDetails.ownershipType === 'Third-party-owned') {
      if (!ownerDetails.name || ownerDetails.name.trim() === '') errors.push('Third-party Legal Owner Name is mandatory.');
      if (!ownerDetails.idNumber || ownerDetails.idNumber.trim() === '') errors.push('Third-party Owner ID / Passport / Registration Number is mandatory.');
      if (!ownerDetails.relationshipToBorrower) errors.push('Relationship to Borrower is mandatory.');
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
        <div className="flex items-center gap-2 font-semibold text-brand-900">
          <Building2 className="w-4 h-4 text-brand-700" />
          <span>{c.code}</span>
        </div>
      ),
    },
    {
      header: 'Customer / CIF',
      accessorKey: 'customerId',
      cell: (c) => {
        const cust = customers.find((cu) => cu.id === c.customerId || cu.cif === c.customerId);
        return (
          <div>
            <div className="font-semibold text-text-primary">{cust?.name || c.customerId || '—'}</div>
            <div className="text-[11px] text-text-secondary">{cust?.cif || c.customerId}</div>
          </div>
        );
      },
    },
    {
      header: 'Category / Type',
      accessorKey: 'category',
      cell: (c) => (
        <div>
          <div className="font-semibold text-text-primary">{c.category}</div>
          <div className="text-[11px] text-text-secondary">{c.type || c.category}</div>
        </div>
      ),
    },
    {
      header: 'Market Valuation',
      accessorKey: 'valuationAmount',
      cell: (c) => (
        <div className="tabular-nums font-semibold text-brand-900">
          {c.currency || 'ETB'} {c.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: 'Haircut',
      accessorKey: 'haircut',
      cell: (c) => (
        <div className="text-xs font-semibold tabular-nums text-text-secondary">
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
        return (
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCol(c);
            setShowDetailModal(true);
            loadExposureSummary(c.id);
          }}
          className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
        >
          <Eye className="w-3.5 h-3.5" />
          Collateral 360
        </button>
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
      titleDeedNumber: '',
      valuationAmount: 10000000,
      haircut: 20,
      valuationDate: new Date().toISOString().substring(0, 10),
      valuationMethod: 'Independent Professional Valuation',
      currency: defaultCurrency,
      owningSegment: segments?.find((s) => s.active !== false)?.name || 'Corporate Banking',
      branch: currentUser.branch || 'Bole Special Branch',
      status: 'Pending Approval',
      insuranceStatus: 'Uninsured',
      gpsX: undefined,
      gpsY: undefined,
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
    });
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
    if (missingMandatoryDocs.length > 0) {
      alert(
        `Cannot submit: Missing uploaded files for mandatory document(s) configured in Admin:\n\n• ` +
          missingMandatoryDocs.map((m) => m.documentType).join('\n• ') +
          `\n\nPlease attach valid files for all mandatory documents before submitting.`
      );
      setWizardStep(6);
      return;
    }

    const allocationsList = Object.entries(facilityAllocations)
      .filter(([_, amt]) => Number(amt) > 0)
      .map(([facId, amt]) => ({
        facilityId: facId,
        allocatedAmount: Number(amt),
        linkageType: 'Primary',
      }));

    // Prepare owner entity
    const ownerToSave: CollateralOwner = {
      name: ownerDetails.ownershipType === 'Borrower-owned' ? selectedCustomer?.name || 'Borrower' : ownerDetails.name || 'Third-Party Owner',
      ownershipType: ownerDetails.ownershipType || 'Borrower-owned',
      ownerType: ownerDetails.ownerType || 'Corporate',
      idNumber: ownerDetails.idNumber || selectedCustomer?.nationalId || selectedCustomer?.businessRegNo,
      tin: ownerDetails.tin || selectedCustomer?.taxIdNo,
      phone: ownerDetails.phone || selectedCustomer?.phone,
      contactInfo: ownerDetails.contactInfo || selectedCustomer?.address,
      percentage: Number(ownerDetails.percentage || 100),
      relationship: ownerDetails.ownershipType === 'Borrower-owned' ? 'Borrower' : ownerDetails.relationshipToBorrower || 'Third-Party Guarantor',
      relationshipToBorrower: ownerDetails.relationshipToBorrower,
      consentInfo: ownerDetails.consentInfo,
      pledgeAgreementRef: ownerDetails.pledgeAgreementRef,
      remarks: ownerDetails.remarks,
      verificationStatus: 'Recorded',
      gpsX: newCol.gpsX,
      gpsY: newCol.gpsY,
    };

    setWizardRegistering(true);
    try {
      const colToSave: Partial<Collateral> = {
        ...newCol,
        customerId: selectedCustomerId,
        ownerType: ownerDetails.ownershipType,
        owners: [ownerToSave],
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
      alert(`Collateral ${colToSave.code} registered and submitted for Checker authorization (Status: Pending Approval).`);
      setShowRegisterWizard(false);
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
      await onAddLink(linkLoanId, selectedCol.id, linkAmount);
      alert('Facility linked successfully.');
      setShowAddLinkModal(false);
      loadExposureSummary(selectedCol.id);
    } catch (e: any) {
      alert(`Failed to link facility: ${e?.message || e}`);
    } finally {
      setLinkSubmitting(false);
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

  return (
    <div className="p-6 space-y-6">
      <DataGrid
        title="Collateral Master & Securities"
        subtitle="Manage Pledged Assets, Multi-Facility Security Allocations, Haircuts, Mandatory Documents, and Insurance Coverages"
        data={collaterals}
        columns={collateralColumns}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => {
          setSelectedCol(c);
          setShowDetailModal(true);
          loadExposureSummary(c.id);
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

      {/* Collateral 360 Detail Modal */}
      {showDetailModal && selectedCol && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-border shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
            {/* Header */}
            <div className="p-5 bg-brand-900 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold">
                    {selectedCol.code} — {selectedCol.category}
                  </h2>
                  <StatusChip
                    label={selectedCol.authStat === 'A' ? 'Active / Authorized' : selectedCol.authStat === 'R' ? 'Rejected' : 'Pending Authorization'}
                    variant={selectedCol.authStat === 'A' ? 'success' : selectedCol.authStat === 'R' ? 'danger' : 'warning'}
                  />
                  <StatusChip
                    label={selectedCol.insuranceStatus || selectedCol.status || 'Uninsured'}
                    variant={(selectedCol.insuranceStatus || '').toLowerCase().includes('fully') ? 'success' : 'warning'}
                  />
                </div>
                <div className="text-xs text-blue-200 mt-1 flex gap-4">
                  <span>
                    Customer: {customers.find((c) => c.id === selectedCol.customerId || c.cif === selectedCol.customerId)?.name || selectedCol.customerId}
                  </span>
                  <span>Owning Segment: {selectedCol.owningSegment}</span>
                  <span>Branch: {selectedCol.branch}</span>
                  <span>Currency: {selectedCol.currency || 'ETB'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {isMaker && selectedCol.authStat === 'A' && (
                  <>
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
                      className="btn-ghost py-1 px-2.5 text-xs text-white border border-white/30 rounded flex items-center gap-1 hover:bg-white/10"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Maintain Details
                    </button>
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="btn-ghost py-1 px-2.5 text-xs text-white border border-white/30 rounded flex items-center gap-1 hover:bg-white/10"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Transfer Segment
                    </button>
                    <button
                      onClick={handleOpenReleaseModal}
                      disabled={loadingRelease}
                      className="btn-ghost py-1 px-2.5 text-xs text-white border border-white/30 rounded flex items-center gap-1 hover:bg-white/10"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      {loadingRelease ? 'Validating…' : 'Release Security'}
                    </button>
                  </>
                )}
                <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-gray-300 text-lg ml-2">
                  ✕
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border bg-brand-50 px-6 gap-2 pt-2">
              {(['details', 'exposure', 'links', 'policies', 'documents', 'exceptions'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2.5 px-3 font-semibold border-b-2 capitalize transition-colors ${
                    activeTab === tab ? 'border-brand-900 text-brand-900' : 'border-transparent text-text-secondary hover:text-brand-900'
                  }`}
                >
                  {tab === 'details' && 'Overview & Valuation'}
                  {tab === 'exposure' && 'Exposure & Adequacy'}
                  {tab === 'links' && `Facility Allocations (${colLinks.length})`}
                  {tab === 'policies' && `Insurance Coverages (${colPolicies.length})`}
                  {tab === 'documents' && `DMS Documents (${colDocs.length})`}
                  {tab === 'exceptions' && `Exceptions (${colExceptions.length})`}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="cims-card p-4 space-y-2">
                      <h4 className="font-bold text-text-primary border-b border-border pb-1">Valuation & Security</h4>
                      <div>
                        <span className="text-text-secondary">Valuation Amount:</span>{' '}
                        <strong className="text-brand-900 tabular-nums">ETB {selectedCol.valuationAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Haircut Applied:</span> <strong>{selectedCol.haircut ?? 20}%</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Net Collateral Value:</span>{' '}
                        <strong className="text-emerald-700 tabular-nums">
                          ETB {((selectedCol.valuationAmount || 0) * (1.0 - ((selectedCol.haircut || 0) / 100.0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Current Allocated Amount:</span>{' '}
                        <strong className="text-blue-800 tabular-nums">ETB {(selectedCol.currentAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Utilization:</span> <strong>{(selectedCol.utilizationPercentage || 0).toFixed(1)}%</strong>
                      </div>
                    </div>

                    <div className="cims-card p-4 space-y-2">
                      <h4 className="font-bold text-text-primary border-b border-border pb-1">Asset Metadata</h4>
                      <div>
                        <span className="text-text-secondary">Category:</span> <strong>{selectedCol.category}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Subtype:</span> <strong>{selectedCol.type || selectedCol.category}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Ownership Type:</span> <strong>{selectedCol.ownerType}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Owning Segment:</span> <strong>{selectedCol.owningSegment}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Branch:</span> <strong>{selectedCol.branch}</strong>
                      </div>
                      {selectedCol.gpsCoordinates && (
                        <div>
                          <span className="text-text-secondary">GPS Coordinates:</span> <strong>{selectedCol.gpsCoordinates}</strong>
                        </div>
                      )}
                    </div>

                    <div className="cims-card p-4 space-y-2">
                      <h4 className="font-bold text-text-primary border-b border-border pb-1">Governance & Audit</h4>
                      <div>
                        <span className="text-text-secondary">Maker:</span> <strong>{selectedCol.makerId || 'CRO_USER'}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Creation Date:</span> <strong>{selectedCol.makerDtStamp?.substring(0, 10) || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Checker:</span> <strong>{selectedCol.checkerId || 'Pending'}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Auth Status:</span> <strong>{selectedCol.authStat === 'A' ? 'Authorized' : 'Pending Authorization'}</strong>
                      </div>
                      <div>
                        <span className="text-text-secondary">Verification Status:</span> <strong>{selectedCol.verificationStatus || 'Recorded'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'exposure' && (
                <div>
                  {loadingExposure ? (
                    <div className="p-8 text-center text-text-secondary">Computing exposure & adequacy metrics…</div>
                  ) : exposureSummary ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-4 gap-4">
                        <div className="cims-card p-4 bg-brand-50 border-brand-100">
                          <div className="text-[11px] text-brand-700 font-semibold uppercase">Total Outstanding Exposure</div>
                          <div className="text-base font-bold text-brand-900 mt-1 tabular-nums">
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
                    </div>
                  ) : (
                    <div className="p-6 text-center text-text-secondary">Exposure breakdown not available.</div>
                  )}
                </div>
              )}

              {activeTab === 'links' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-text-primary">Linked Core Banking Credit Facilities</h4>
                    {isMaker && (
                      <button
                        onClick={() => {
                          const customerFacs = selectedCol ? getFacilitiesForCustomer(selectedCol.customerId) : [];
                          const candidateList = customerFacs.length > 0 ? customerFacs : facilities;
                          if (candidateList.length > 0) {
                            setLinkLoanId(candidateList[0].id);
                          }
                          setShowAddLinkModal(true);
                        }}
                        className="btn-primary py-1 px-2.5 text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Link Credit Facility
                      </button>
                    )}
                  </div>
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                        <tr>
                          <th className="p-2.5">Facility / Line Code</th>
                          <th className="p-2.5">Linkage Type</th>
                          <th className="p-2.5 text-right">Allocated Security Amount</th>
                          <th className="p-2.5">Status</th>
                          {isMaker && <th className="p-2.5 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {colLinks.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-text-secondary">
                              No credit facilities linked to this collateral.
                            </td>
                          </tr>
                        ) : (
                          colLinks.map((l) => (
                            <tr key={l.id} className="hover:bg-brand-50">
                              <td className="p-2.5 font-semibold text-brand-900">{l.facilityId || l.loanAccountId}</td>
                              <td className="p-2.5">{l.linkageType || 'Primary'}</td>
                              <td className="p-2.5 text-right tabular-nums font-semibold text-brand-900">
                                ETB {(l.linkedAmount || l.allocatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5">
                                <StatusChip label={l.status || 'Active'} />
                              </td>
                              {isMaker && (
                                <td className="p-2.5 text-right">
                                  <button
                                    onClick={async () => {
                                      if (confirm(`Are you sure you want to unlink facility ${l.facilityId || l.loanAccountId}?`)) {
                                        await onRemoveLink(l.id);
                                        loadExposureSummary(selectedCol.id);
                                      }
                                    }}
                                    className="text-red-600 hover:text-red-800 font-semibold text-[11px]"
                                  >
                                    Unlink
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'policies' && (
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                      <tr>
                        <th className="p-2.5">Policy Number</th>
                        <th className="p-2.5">Insurer</th>
                        <th className="p-2.5">Coverage Type</th>
                        <th className="p-2.5 text-right">Insured Amount</th>
                        <th className="p-2.5">Expiry Date</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {colPolicies.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-text-secondary">
                            No insurance policies found for this collateral.
                          </td>
                        </tr>
                      ) : (
                        colPolicies.map((p) => (
                          <tr key={p.id} className="hover:bg-brand-50">
                            <td className="p-2.5 font-semibold text-brand-900">{p.policyNumber}</td>
                            <td className="p-2.5">{p.insurerName}</td>
                            <td className="p-2.5">{p.coverageType}</td>
                            <td className="p-2.5 text-right tabular-nums font-semibold text-emerald-700">
                              ETB {p.insuredAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5">{p.expiryDate}</td>
                            <td className="p-2.5">
                              <StatusChip label={p.status} />
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
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-text-primary">DMS Ownership & Compliance Documents</h4>
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
                  <div className="cims-card overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                        <tr>
                          <th className="p-2.5">Document Title</th>
                          <th className="p-2.5">Document Type</th>
                          <th className="p-2.5">Version</th>
                          <th className="p-2.5">Verification Status</th>
                          <th className="p-2.5">Upload Date</th>
                          <th className="p-2.5">Expiry Date</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {colDocs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-text-secondary">
                              No documents uploaded.
                            </td>
                          </tr>
                        ) : (
                          colDocs.map((d) => (
                            <tr key={d.id} className="hover:bg-brand-50">
                              <td className="p-2.5 font-semibold text-brand-900 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-brand-600" />
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
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'exceptions' && (
                <div className="cims-card overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-brand-50 border-b border-border text-text-secondary font-semibold">
                      <tr>
                        <th className="p-2.5">Exception Type</th>
                        <th className="p-2.5">Severity</th>
                        <th className="p-2.5">Description</th>
                        <th className="p-2.5">Identified Date</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {colExceptions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-text-secondary">
                            No open exceptions logged.
                          </td>
                        </tr>
                      ) : (
                        colExceptions.map((e) => (
                          <tr key={e.id} className="hover:bg-brand-50">
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
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8-Step Guided Collateral Registration Wizard Modal
          ========================================================================= */}
      {showRegisterWizard && (
        <div className="fixed inset-0 bg-brand-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-border shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Register Collateral</h3>
                <p className="text-[11px] text-blue-200">
                  Step {wizardStep} of 8: Production Capture &amp; Four-Eyes Control Flow
                </p>
              </div>
              <button onClick={() => setShowRegisterWizard(false)} className="text-white hover:text-gray-300 text-lg">
                ✕
              </button>
            </div>

            {/* Stepper Navigation Indicator */}
            <div className="grid grid-cols-8 bg-brand-50 border-b border-border text-center py-2 text-[10px] font-semibold divide-x divide-border/60">
              <div className={wizardStep === 1 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                1. Customer
              </div>
              <div className={wizardStep === 2 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                2. Facility
              </div>
              <div className={wizardStep === 3 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                3. Collateral
              </div>
              <div className={wizardStep === 4 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                4. Ownership
              </div>
              <div className={wizardStep === 5 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                5. Allocation
              </div>
              <div className={wizardStep === 6 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                6. Documents
              </div>
              <div className={wizardStep === 7 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                7. Validation
              </div>
              <div className={wizardStep === 8 ? 'text-brand-900 font-bold bg-white shadow-xs' : 'text-text-secondary'}>
                8. Submit
              </div>
            </div>

            {/* Wizard Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* -------------------------------------------------------------------
                  STEP 1: CUSTOMER SELECTION & CBS MASTER INFORMATION
                  ------------------------------------------------------------------- */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                        <User className="w-4 h-4 text-brand-700" />
                        Step 1: Select Borrower / Customer
                      </h4>
                      <p className="text-text-secondary text-[11px]">
                        Search and select existing customer from Core Banking System (CBS) master records.
                      </p>
                    </div>
                  </div>

                  {/* Customer Search Box */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by Customer Name, CIF Number, ID, Segment, or Branch..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-border rounded text-xs bg-slate-50 focus:bg-white"
                    />
                  </div>

                  {/* Customers Dropdown / Selection Grid */}
                  <div>
                    <label className="block font-semibold text-text-primary mb-1">
                      Choose Customer Record <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => {
                        const newCustId = e.target.value;
                        setSelectedCustomerId(newCustId);
                        setSelectedFacilityIds([]);
                        setFacilityAllocations({});
                        const cust = customers.find((c) => c.id === newCustId || c.cif === newCustId);
                        if (cust) {
                          setOwnerDetails((prev) => ({
                            ...prev,
                            name: cust.name,
                            ownerType: cust.customerType || 'Corporate',
                            idNumber: cust.nationalId || cust.businessRegNo || '',
                            tin: cust.taxIdNo || '',
                            phone: cust.phone || '',
                            contactInfo: cust.address || '',
                          }));
                        }
                      }}
                      className="w-full p-2.5 border border-border rounded font-semibold text-xs bg-white"
                    >
                      <option value="">-- Select Existing Verified Customer --</option>
                      {filteredCustomers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.cif} — {c.name} ({c.customerType} | {c.segment} | {c.branch})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Display CBS Master Information for Selected Customer */}
                  {selectedCustomer ? (
                    <div className="p-4 bg-brand-50 border border-brand-200 rounded-lg space-y-3">
                      <div className="font-bold text-brand-900 border-b border-brand-200 pb-1.5 flex items-center justify-between">
                        <span>Core Banking Customer Master Information</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          Status: {selectedCustomer.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-text-secondary block">Customer Name:</span>
                          <strong className="text-slate-900 text-sm">{selectedCustomer.name}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">CIF Number:</span>
                          <strong className="font-mono text-brand-900">{selectedCustomer.cif}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Customer Type:</span>
                          <strong>{selectedCustomer.customerType}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Business Segment:</span>
                          <strong>{selectedCustomer.segment}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Branch / Center:</span>
                          <strong>{selectedCustomer.branch}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">District:</span>
                          <strong>{selectedCustomer.district || 'Central Addis District'}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Responsible RM:</span>
                          <strong>{selectedCustomer.responsibleRm || selectedCustomer.makerId || 'Senior RM - Corporate'}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Responsible RO:</span>
                          <strong>{selectedCustomer.responsibleRo || 'Relationship Officer'}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Tax / TIN ID:</span>
                          <strong className="font-mono">{selectedCustomer.taxIdNo || 'TIN-4891029'}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-dashed border-border rounded-lg text-center text-text-secondary">
                      Please select a customer from the dropdown above to display master profile and retrieve authorized credit facilities.
                    </div>
                  )}
                </div>
              )}

              {/* -------------------------------------------------------------------
                  STEP 2: CUSTOMER FACILITIES & LOANS SELECTION
                  ------------------------------------------------------------------- */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-brand-700" />
                        Step 2: Customer Authorized Facilities & Loan Accounts
                      </h4>
                      <p className="text-text-secondary text-[11px]">
                        Select one or multiple credit facilities strictly belonging to {selectedCustomer?.name || 'the customer'}.
                      </p>
                    </div>
                    <div className="text-xs text-text-secondary">
                      Selected: <strong>{selectedFacilityIds.length}</strong> / {customerFacilities.length} Facilities
                    </div>
                  </div>

                  {customerFacilities.length === 0 ? (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-center space-y-2">
                      <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto" />
                      <p className="font-bold">No Active Credit Facilities in CBS for this Customer</p>
                      <p className="text-[11px] text-amber-800">
                        You can still register this collateral and allocate it to loan accounts later after loan approval.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customerFacilities.map((fac) => {
                        const isSelected = selectedFacilityIds.includes(fac.id);
                        return (
                          <div
                            key={fac.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedFacilityIds(selectedFacilityIds.filter((id) => id !== fac.id));
                                const updatedAlloc = { ...facilityAllocations };
                                delete updatedAlloc[fac.id];
                                setFacilityAllocations(updatedAlloc);
                              } else {
                                setSelectedFacilityIds([...selectedFacilityIds, fac.id]);
                              }
                            }}
                            className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                              isSelected ? 'bg-brand-50 border-brand-400 shadow-2xs' : 'bg-white border-border hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="rounded border-border text-brand-900 focus:ring-brand-700"
                                />
                                <div>
                                  <div className="font-bold text-text-primary text-xs">
                                    {fac.lineCode} — {fac.facilityType}
                                  </div>
                                  <div className="text-[11px] text-text-secondary flex gap-3 mt-0.5">
                                    <span>Loan Ref: <strong className="font-mono">{fac.loanReference}</strong></span>
                                    <span>Takedown Acc: <strong className="font-mono">{fac.takedownAccountNumber || fac.id}</strong></span>
                                    <span>Segment: <strong>{fac.segment}</strong></span>
                                    <span>Branch: <strong>{fac.branch}</strong></span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[11px] text-text-secondary">
                                  Approved Limit: <strong className="text-slate-900">ETB {fac.approvedLimit?.toLocaleString()}</strong>
                                </div>
                                <div className="text-[11px] font-bold text-red-700">
                                  Outstanding: ETB {fac.outstandingBalance?.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-text-secondary">
                                  Maturity: {fac.lineExpiryDate || '2028-12-31'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* -------------------------------------------------------------------
                  STEP 3: COLLATERAL BASIC INFORMATION & TAXONOMY
                  ------------------------------------------------------------------- */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-brand-700" />
                      Step 3: Collateral Basic Information & Taxonomy
                    </h4>
                    <p className="text-text-secondary text-[11px]">
                      Select active category and dynamic collateral subtype. Fill in category-specific attributes.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-text-primary mb-1">
                        Collateral Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newCol.category || 'Immovable Properties'}
                        onChange={(e) => {
                          const cat = e.target.value;
                          const subList = getSubtypesForCategory(cat);
                          const firstSub = subList[0] || cat;
                          setNewCol({ ...newCol, category: cat, type: firstSub });
                          populateDefaultDocs(cat, firstSub, ownerDetails.ownershipType);
                        }}
                        className="w-full p-2 border border-border rounded font-semibold text-xs bg-white"
                      >
                        {(taxonomies.length > 0
                          ? Array.from(new Set(taxonomies.map((t) => t.category)))
                          : [
                              'Immovable Properties',
                              'Movable Properties',
                              'Business Mortgages',
                              'Financial Assets',
                              'Agricultural / Other',
                              'Guarantees',
                            ]
                        ).map((cat, idx) => (
                          <option key={idx} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-1">
                        Collateral Type / Subtype <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newCol.type || availableTaxonomyTypes[0] || newCol.category}
                        onChange={(e) => {
                          const typ = e.target.value;
                          setNewCol({ ...newCol, type: typ });
                          populateDefaultDocs(newCol.category, typ, ownerDetails.ownershipType);
                        }}
                        className="w-full p-2 border border-border rounded font-semibold text-xs bg-white"
                      >
                        {availableTaxonomyTypes.length > 0 ? (
                          availableTaxonomyTypes.map((sub: string, idx: number) => (
                            <option key={idx} value={sub}>
                              {sub}
                            </option>
                          ))
                        ) : (
                          <option value={newCol.category}>{newCol.category}</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-1">
                        Collateral Code (Auto-Generated) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newCol.code || ''}
                        onChange={(e) => setNewCol({ ...newCol, code: e.target.value })}
                        className="w-full p-2 border border-border rounded font-mono font-bold text-brand-900"
                      />
                    </div>
                  </div>

                  {/* Valuation & Haircut Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-text-primary mb-1">
                        Estimated Market Valuation ({newCol.currency || 'ETB'}) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newCol.valuationAmount || ''}
                        onChange={(e) => setNewCol({ ...newCol, valuationAmount: Number(e.target.value) })}
                        className="w-full p-2 border border-border rounded font-bold tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-1">
                        Haircut Percentage (%) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={newCol.haircut ?? 20}
                        onChange={(e) => setNewCol({ ...newCol, haircut: Number(e.target.value) })}
                        className="w-full p-2 border border-border rounded font-bold tabular-nums"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-text-primary mb-1">Valuation Method</label>
                      <select
                        value={newCol.valuationMethod || 'Independent Professional Valuation'}
                        onChange={(e) => setNewCol({ ...newCol, valuationMethod: e.target.value })}
                        className="w-full p-2 border border-border rounded text-xs"
                      >
                        <option value="Independent Professional Valuation">Independent Professional Valuation</option>
                        <option value="Depreciated Replacement Cost">Depreciated Replacement Cost</option>
                        <option value="Market Comparable Sales">Market Comparable Sales</option>
                        <option value="Discounted Cash Flow (DCF)">Discounted Cash Flow (DCF)</option>
                        <option value="Book Value / Historical Cost">Book Value / Historical Cost</option>
                      </select>
                    </div>
                  </div>

                  {/* Real-Time Net Collateral Value Banner */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-emerald-800">Net Security Value (Available Allocation Capacity)</div>
                      <div className="text-base font-extrabold text-emerald-900 tabular-nums">
                        {newCol.currency || 'ETB'} {netCollateralValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <ShieldCheck className="w-7 h-7 text-emerald-700" />
                  </div>

                  {/* Category-Specific Dynamic Fields */}
                  <div className="p-4 bg-slate-50 border border-border rounded-lg space-y-3">
                    <h5 className="font-bold text-text-primary text-xs uppercase tracking-wide">
                      {newCol.category} Category-Specific Attributes
                    </h5>

                    {/* Building / Immovable Properties */}
                    {(newCol.category?.toLowerCase().includes('immovable') || newCol.category?.toLowerCase().includes('building')) && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Title Deed / Certificate Number</label>
                          <input
                            type="text"
                            placeholder="e.g. TD-99210-AA"
                            value={newCol.titleDeedNumber || ''}
                            onChange={(e) => setNewCol({ ...newCol, titleDeedNumber: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Property Location / Address</label>
                          <input
                            type="text"
                            placeholder="e.g. Bole Subcity, Woreda 03, Addis Ababa"
                            value={newCol.location || ''}
                            onChange={(e) => setNewCol({ ...newCol, location: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Registration Number</label>
                          <input
                            type="text"
                            placeholder="e.g. REG-881902"
                            value={newCol.registrationNumber || ''}
                            onChange={(e) => setNewCol({ ...newCol, registrationNumber: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs"
                          />
                        </div>
                        {/* OPTIONAL GPS Section (Not mandatory) */}
                        <div className="col-span-3 p-2.5 bg-blue-50/70 border border-blue-200 rounded space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-blue-900 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-blue-700" />
                            <span>Building GPS Coordinates (Optional Location Attribute)</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-text-secondary">GPS X (Longitude - Optional)</label>
                              <input
                                type="number"
                                step="any"
                                placeholder="e.g. 38.7578"
                                value={newCol.gpsX ?? ''}
                                onChange={(e) => setNewCol({ ...newCol, gpsX: e.target.value ? Number(e.target.value) : undefined })}
                                className="w-full p-1.5 border border-border rounded text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-text-secondary">GPS Y (Latitude - Optional)</label>
                              <input
                                type="number"
                                step="any"
                                placeholder="e.g. 9.0054"
                                value={newCol.gpsY ?? ''}
                                onChange={(e) => setNewCol({ ...newCol, gpsY: e.target.value ? Number(e.target.value) : undefined })}
                                className="w-full p-1.5 border border-border rounded text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div className="text-[10px] text-blue-700 italic">
                            Note: GPS is purely optional. Registration is not blocked if GPS coordinates are not provided.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Vehicles / Movable Properties */}
                    {(newCol.category?.toLowerCase().includes('movable') || newCol.category?.toLowerCase().includes('vehicle')) && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Plate / Registration Number</label>
                          <input
                            type="text"
                            placeholder="e.g. 3-B92810-AA"
                            value={newCol.registrationNumber || ''}
                            onChange={(e) => setNewCol({ ...newCol, registrationNumber: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Engine Number</label>
                          <input
                            type="text"
                            placeholder="e.g. ENG-449102"
                            value={newCol.engineNumber || ''}
                            onChange={(e) => setNewCol({ ...newCol, engineNumber: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Chassis / VIN Number</label>
                          <input
                            type="text"
                            placeholder="e.g. VIN-77881920"
                            value={newCol.chassisNumber || ''}
                            onChange={(e) => setNewCol({ ...newCol, chassisNumber: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Machinery / Business Mortgages */}
                    {(newCol.category?.toLowerCase().includes('machin') || newCol.category?.toLowerCase().includes('business mortgage')) && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Machinery Serial Number</label>
                          <input
                            type="text"
                            placeholder="e.g. SN-889912-CAT"
                            value={newCol.machinerySerialNo || ''}
                            onChange={(e) => setNewCol({ ...newCol, machinerySerialNo: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Purchase Date / Reference</label>
                          <input
                            type="date"
                            value={newCol.machineryPurchaseDate || ''}
                            onChange={(e) => setNewCol({ ...newCol, machineryPurchaseDate: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Registration / Certificate Ref</label>
                          <input
                            type="text"
                            placeholder="e.g. MOC-338192"
                            value={newCol.registrationNumber || ''}
                            onChange={(e) => setNewCol({ ...newCol, registrationNumber: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Financial Assets */}
                    {newCol.category?.toLowerCase().includes('financial') && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Instrument / Account Reference</label>
                          <input
                            type="text"
                            placeholder="e.g. Treasury Bill #TB-99120 / Blocked Acc #011299"
                            value={newCol.financialInstrumentRef || ''}
                            onChange={(e) => setNewCol({ ...newCol, financialInstrumentRef: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">Issuing Entity / Bank</label>
                          <input
                            type="text"
                            placeholder="e.g. National Bank of Ethiopia"
                            value={newCol.issuingEntity || ''}
                            onChange={(e) => setNewCol({ ...newCol, issuingEntity: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------------
                  STEP 4: OWNERSHIP STRUCTURE (BORROWER VS THIRD-PARTY)
                  ------------------------------------------------------------------- */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-brand-700" />
                      Step 4: Collateral Legal Ownership & Consent
                    </h4>
                    <p className="text-text-secondary text-[11px]">
                      Capture legal owner details. Distinguish between Borrower-Owned and Third-Party-Owned assets.
                    </p>
                  </div>

                  {/* Ownership Type Radio Toggle */}
                  <div className="grid grid-cols-2 gap-4">
                    <label
                      className={`p-3.5 rounded-lg border cursor-pointer flex items-start gap-3 transition-colors ${
                        ownerDetails.ownershipType === 'Borrower-owned'
                          ? 'bg-brand-50 border-brand-400 shadow-2xs'
                          : 'bg-white border-border hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ownershipType"
                        value="Borrower-owned"
                        checked={ownerDetails.ownershipType === 'Borrower-owned'}
                        onChange={() => {
                          setOwnerDetails({
                            ...ownerDetails,
                            ownershipType: 'Borrower-owned',
                            name: selectedCustomer?.name || '',
                            ownerType: selectedCustomer?.customerType || 'Corporate',
                            idNumber: selectedCustomer?.nationalId || selectedCustomer?.businessRegNo || '',
                            tin: selectedCustomer?.taxIdNo || '',
                            phone: selectedCustomer?.phone || '',
                            contactInfo: selectedCustomer?.address || '',
                            percentage: 100,
                            relationship: 'Borrower',
                            verificationStatus: 'Recorded',
                          });
                          populateDefaultDocs(newCol.category, newCol.type, 'Borrower-owned');
                        }}
                        className="mt-0.5 text-brand-900 focus:ring-brand-700"
                      />
                      <div>
                        <div className="font-bold text-text-primary text-xs">Borrower-Owned Collateral</div>
                        <div className="text-[11px] text-text-secondary">
                          The selected customer / borrower ({selectedCustomer?.name}) is the 100% legal owner of this asset.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-3.5 rounded-lg border cursor-pointer flex items-start gap-3 transition-colors ${
                        ownerDetails.ownershipType === 'Third-party-owned'
                          ? 'bg-purple-50 border-purple-400 shadow-2xs'
                          : 'bg-white border-border hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ownershipType"
                        value="Third-party-owned"
                        checked={ownerDetails.ownershipType === 'Third-party-owned'}
                        onChange={() => {
                          setOwnerDetails({
                            ...ownerDetails,
                            ownershipType: 'Third-party-owned',
                            name: '',
                            ownerType: 'Individual',
                            idNumber: '',
                            tin: '',
                            phone: '',
                            contactInfo: '',
                            percentage: 100,
                            relationship: 'Third-Party Owner',
                            relationshipToBorrower: 'Shareholder',
                            consentInfo: 'Pledge consent letter signed and witnessed',
                            pledgeAgreementRef: 'PA-2026-001',
                            verificationStatus: 'Recorded',
                          });
                          populateDefaultDocs(newCol.category, newCol.type, 'Third-party-owned');
                        }}
                        className="mt-0.5 text-purple-900 focus:ring-purple-700"
                      />
                      <div>
                        <div className="font-bold text-purple-950 text-xs">Third-Party-Owned Collateral</div>
                        <div className="text-[11px] text-purple-800">
                          Asset belongs to a third party (Shareholder, Parent Company, Director, Guarantor, Spouse, etc.).
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Borrower-Owned Display */}
                  {ownerDetails.ownershipType === 'Borrower-owned' ? (
                    <div className="p-4 bg-slate-50 border border-border rounded-lg space-y-3">
                      <div className="font-bold text-text-primary border-b border-border pb-1.5 flex justify-between items-center">
                        <span>Borrower Legal Owner Summary</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                          Ownership Status: Recorded (Pending Future Verification)
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-text-secondary block">Legal Owner:</span>
                          <strong className="text-brand-900">{selectedCustomer?.name}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Owner Type:</span>
                          <strong>{selectedCustomer?.customerType}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Ownership Percentage:</span>
                          <strong className="text-emerald-700">100.0%</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">National ID / Reg No:</span>
                          <strong className="font-mono">{selectedCustomer?.nationalId || selectedCustomer?.businessRegNo || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">TIN Number:</span>
                          <strong className="font-mono">{selectedCustomer?.taxIdNo || 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-text-secondary block">Contact Phone:</span>
                          <strong>{selectedCustomer?.phone || 'N/A'}</strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Third-Party Ownership Form */
                    <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-lg space-y-3">
                      <div className="font-bold text-purple-950 border-b border-purple-200 pb-1.5 flex justify-between items-center">
                        <span>Third-Party Owner Information & Borrower Relationship</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-200 text-purple-900 font-bold">
                          Ownership Status: Recorded
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">
                            Third-Party Legal Owner Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Full Legal Name / Company Name"
                            value={ownerDetails.name || ''}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, name: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs font-semibold bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">
                            Owner Type <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={ownerDetails.ownerType || 'Individual'}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, ownerType: e.target.value as any })}
                            className="w-full p-1.5 border border-border rounded text-xs bg-white font-semibold"
                          >
                            <option value="Individual">Individual</option>
                            <option value="Corporate">Corporate / Enterprise</option>
                            <option value="Government">Government / Public Body</option>
                            <option value="Joint">Joint Owners</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">
                            Relationship to Borrower ({selectedCustomer?.name}) <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={ownerDetails.relationshipToBorrower || 'Shareholder'}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, relationshipToBorrower: e.target.value as any })}
                            className="w-full p-1.5 border border-border rounded text-xs font-bold text-purple-900 bg-white"
                          >
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
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">
                            National ID / Passport / Business Reg No <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. ET-ID-881920"
                            value={ownerDetails.idNumber || ''}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, idNumber: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs font-mono bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">TIN Number</label>
                          <input
                            type="text"
                            placeholder="e.g. 008910281"
                            value={ownerDetails.tin || ''}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, tin: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs font-mono bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">Contact Phone / Address</label>
                          <input
                            type="text"
                            placeholder="+251 9... / Addis Ababa"
                            value={ownerDetails.phone || ''}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, phone: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs bg-white"
                          />
                        </div>
                      </div>

                      {/* Consent & Pledge Recording */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-200">
                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">
                            Third-Party Consent Agreement Information
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Formal Consent Letter dated 2026-08-10 signed before notary"
                            value={ownerDetails.consentInfo || ''}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, consentInfo: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-text-primary mb-1">
                            Pledge Agreement Reference
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. PLEDGE-AGR-2026-99"
                            value={ownerDetails.pledgeAgreementRef || ''}
                            onChange={(e) => setOwnerDetails({ ...ownerDetails, pledgeAgreementRef: e.target.value })}
                            className="w-full p-1.5 border border-border rounded text-xs bg-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* -------------------------------------------------------------------
                  STEP 5: FACILITY-COLLATERAL ALLOCATION
                  ------------------------------------------------------------------- */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                        <Percent className="w-4 h-4 text-brand-700" />
                        Step 5: Facility-Collateral Allocation & Capacity
                      </h4>
                      <p className="text-text-secondary text-[11px]">
                        Allocate collateral security amounts across selected customer credit facilities.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-text-secondary">
                        Net Collateral Value: <strong className="text-emerald-700">ETB {netCollateralValue.toLocaleString()}</strong>
                      </div>
                      <div className="text-[11px] text-text-secondary">
                        Total Allocated:{' '}
                        <strong className={isAllocationOverflow ? 'text-red-600' : 'text-blue-800'}>
                          ETB {totalAllocatedAmount.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {selectedFacilityIds.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-border rounded text-center text-text-secondary">
                      No facilities were selected in Step 2. You can allocate 0 ETB now and link facilities after registration.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customerFacilities
                        .filter((f) => selectedFacilityIds.includes(facIdOrRef(f)))
                        .map((f) => {
                          const allocatedAmt = facilityAllocations[f.id] || 0;
                          const allocPct = netCollateralValue > 0 ? ((allocatedAmt / netCollateralValue) * 100).toFixed(1) : '0.0';

                          return (
                            <div key={f.id} className="p-3.5 bg-white border border-border rounded-lg space-y-2">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <div className="font-bold text-text-primary text-xs">
                                    {f.lineCode} — {f.facilityType} ({f.loanReference})
                                  </div>
                                  <div className="text-[11px] text-text-secondary flex gap-3 mt-0.5">
                                    <span>Approved Limit: ETB {f.approvedLimit?.toLocaleString()}</span>
                                    <span>Outstanding: <strong className="text-red-700">ETB {f.outstandingBalance?.toLocaleString()}</strong></span>
                                  </div>
                                </div>
                                <div className="w-56">
                                  <label className="block text-[10px] font-semibold text-text-secondary mb-0.5">
                                    Allocated Security Amount (ETB)
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      placeholder="0.00"
                                      value={facilityAllocations[f.id] ?? ''}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setFacilityAllocations({
                                          ...facilityAllocations,
                                          [f.id]: val,
                                        });
                                      }}
                                      className="w-full p-1.5 border border-border rounded font-bold tabular-nums text-right text-xs"
                                    />
                                    <span className="text-[11px] font-mono text-text-secondary w-12 text-right">
                                      {allocPct}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {isAllocationOverflow && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2 text-xs">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        <strong>Allocation Overflow Error:</strong> Total allocated amount (ETB {totalAllocatedAmount.toLocaleString()}) exceeds Net Collateral Value (ETB {netCollateralValue.toLocaleString()}).
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* -------------------------------------------------------------------
                  STEP 6: DOCUMENTS (MANDATORY RESOLVED + ADDITIONAL SUPPORTING)
                  ------------------------------------------------------------------- */}
              {wizardStep === 6 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                        <FileBadge className="w-4 h-4 text-brand-700" />
                        Step 6: Document Uploads & Version Control (DMS)
                      </h4>
                      <p className="text-text-secondary text-[11px]">
                        Part A: Admin-Configured Mandatory Documents. Part B: Additional Supporting Legal Files.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => populateDefaultDocs(newCol.category, newCol.type, ownerDetails.ownershipType)}
                      className="btn-ghost text-brand-900 font-semibold text-xs flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reset Mandatory Slots
                    </button>
                  </div>

                  {/* Part A: Admin Mandatory Documents Status Banner */}
                  <div
                    className={`p-3.5 rounded-lg border flex items-center justify-between ${
                      missingMandatoryDocs.length === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <ShieldCheck className={`w-4 h-4 ${missingMandatoryDocs.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`} />
                        <span>Part A: Mandatory Document Rules ({mandatoryRulesList.length} Rules Active)</span>
                      </div>
                      <div className="text-[11px]">
                        {missingMandatoryDocs.length === 0 ? (
                          <span className="text-emerald-700 font-semibold">
                            ✓ All {mandatoryRulesList.length} mandatory document files attached.
                          </span>
                        ) : (
                          <span className="text-amber-800 font-medium">
                            Mandatory Upload Required: <strong>{missingMandatoryDocs.map((m) => m.documentType).join(', ')}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-bold ${
                          missingMandatoryDocs.length === 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {mandatoryRulesList.length - missingMandatoryDocs.length} / {mandatoryRulesList.length} Uploaded
                      </span>
                    </div>
                  </div>

                  {/* Document Ingestion Slots */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <span className="font-bold text-text-primary text-xs block">Attached Document Files ({wizardDocuments.length})</span>
                        <span className="text-[11px] text-text-secondary">Mandatory Admin Rules + Additional Supporting Documents</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newDoc: WizardDocItem = {
                            id: `doc-wiz-extra-${Date.now()}-${wizardDocuments.length}`,
                            name: '',
                            type: 'Valuation Report',
                            expiryDate: new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000).toISOString().substring(0, 10),
                            remarks: 'Additional supporting document',
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
                        + Add Other / Supporting Document
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
                                : 'bg-white border-border'
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
                                      <label className="block text-[10px] font-semibold text-text-secondary">Document Type</label>
                                      {doc.isMandatory ? (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                                          Mandatory
                                        </span>
                                      ) : (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-900 font-bold border border-blue-200">
                                          Supporting
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
                                      className="w-full p-1 border border-border rounded text-xs font-semibold"
                                    >
                                      {allConfiguredDocTypes.map((typ: string, tIdx: number) => (
                                        <option key={tIdx} value={typ}>
                                          {typ}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-text-secondary">Document Title / Ref</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Official Deed #TD-99120"
                                      value={doc.name}
                                      onChange={(e) => {
                                        const updated = [...wizardDocuments];
                                        updated[idx].name = e.target.value;
                                        setWizardDocuments(updated);
                                      }}
                                      className="w-full p-1 border border-border rounded text-xs"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-semibold text-text-secondary">Expiry Date</label>
                                    <input
                                      type="date"
                                      value={doc.expiryDate}
                                      onChange={(e) => {
                                        const updated = [...wizardDocuments];
                                        updated[idx].expiryDate = e.target.value;
                                        setWizardDocuments(updated);
                                      }}
                                      className="w-full p-1 border border-border rounded text-xs"
                                    />
                                  </div>
                                </div>
                              </div>

                              {!doc.isMandatory ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWizardDocuments(wizardDocuments.filter((_, i) => i !== idx));
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Remove supporting document slot"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : null}
                            </div>

                            {/* Digital File Attachment Control */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] bg-slate-50 p-2 rounded">
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  id={`file-col-wizard-${doc.id}`}
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff"
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
                                        if (!updated[idx].name || updated[idx].name.trim().length === 0) {
                                          updated[idx].name = file.name.replace(/\.[^/.]+$/, '');
                                        }
                                        setWizardDocuments(updated);
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`file-col-wizard-${doc.id}`}
                                  className={`cursor-pointer py-1 px-3 rounded font-semibold flex items-center gap-1.5 text-xs shadow-2xs transition-colors ${
                                    hasFile
                                      ? 'bg-white border border-emerald-400 text-emerald-900 hover:bg-emerald-50'
                                      : doc.isMandatory
                                      ? 'bg-brand-900 text-white hover:bg-brand-800'
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
                                ) : doc.isMandatory ? (
                                  <span className="text-amber-800 font-bold text-[11px] flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    Mandatory Document - Upload Required
                                  </span>
                                ) : (
                                  <span className="text-text-secondary italic text-[11px]">
                                    Optional Supporting Document
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
                            id: `doc-wiz-extra-${Date.now()}-${wizardDocuments.length}`,
                            name: '',
                            type: 'Valuation Report',
                            expiryDate: new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000).toISOString().substring(0, 10),
                            remarks: 'Additional supporting document',
                            fileName: '',
                            fileSize: '',
                            fileSizeNum: 0,
                            contentType: 'application/pdf',
                            fileContent: '',
                            isMandatory: false,
                          };
                          setWizardDocuments([...wizardDocuments, newDoc]);
                        }}
                        className="w-full py-3 px-4 border-2 border-dashed border-brand-400 hover:border-brand-700 bg-brand-50/60 hover:bg-brand-100/70 rounded-lg text-brand-900 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs group"
                      >
                        <div className="p-1 rounded-full bg-brand-200 group-hover:bg-brand-300 text-brand-900">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span>+ Add Other / Supporting Document (Power of Attorney, Site Photos, Valuation, Legal Agreements, etc.)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------------
                  STEP 7: PRE-SUBMISSION VALIDATION SUMMARY
                  ------------------------------------------------------------------- */}
              {wizardStep === 7 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-700" />
                      Step 7: Pre-Submission Completeness Validation Checklist
                    </h4>
                    <p className="text-text-secondary text-[11px]">
                      Review all mandatory fields, relationships, allocations, and documents before maker submission.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="cims-card p-4 space-y-2">
                      <h5 className="font-bold text-text-primary border-b border-border pb-1">Customer & Facility Relationship</h5>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Customer Selected:</span>
                        <strong className="text-brand-900">✓ {selectedCustomer?.name} ({selectedCustomer?.cif})</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Customer Isolation Check:</span>
                        <strong className="text-emerald-700">✓ Verified (All Facilities Belong to Customer)</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Selected Facilities:</span>
                        <strong>{selectedFacilityIds.length} Linked Facility(ies)</strong>
                      </div>
                    </div>

                    <div className="cims-card p-4 space-y-2">
                      <h5 className="font-bold text-text-primary border-b border-border pb-1">Collateral & Ownership Status</h5>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Category & Type:</span>
                        <strong>{newCol.category} ({newCol.type})</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Ownership Type:</span>
                        <strong>{ownerDetails.ownershipType}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Ownership Verification Status:</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold text-[10px]">
                          Recorded (Pending Future Verification)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="cims-card p-4 space-y-2">
                      <h5 className="font-bold text-text-primary border-b border-border pb-1">Financial & Capacity Allocation</h5>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Market Valuation:</span>
                        <strong className="font-mono text-brand-900">ETB {Number(newCol.valuationAmount || 0).toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Net Collateral Value:</span>
                        <strong className="font-mono text-emerald-700">ETB {netCollateralValue.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Allocated Security:</span>
                        <strong className="font-mono text-blue-800">ETB {totalAllocatedAmount.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Allocation Capacity Status:</span>
                        <strong className="text-emerald-700">✓ Valid Capacity (No Overflow)</strong>
                      </div>
                    </div>

                    <div className="cims-card p-4 space-y-2">
                      <h5 className="font-bold text-text-primary border-b border-border pb-1">Document Ingestion Summary</h5>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Mandatory Documents:</span>
                        <strong className="text-emerald-700">
                          {mandatoryRulesList.length - missingMandatoryDocs.length} / {mandatoryRulesList.length} Uploaded ✓
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Additional Supporting Docs:</span>
                        <strong>{wizardDocuments.filter((d) => !d.isMandatory && d.fileContent).length} File(s)</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-text-secondary">Document Verification Status:</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                          Uploaded / Pending Verification
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------------
                  STEP 8: SUBMISSION & MAKER-CHECKER ROUTING
                  ------------------------------------------------------------------- */}
              {wizardStep === 8 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-brand-700" />
                      Step 8: Maker Submission & Checker Routing
                    </h4>
                    <p className="text-text-secondary text-[11px]">
                      Under the Four-Eyes Principle, this collateral registration will be submitted in <strong>Pending Approval</strong> state to the Branch Manager inbox.
                    </p>
                  </div>

                  <div className="p-4 bg-brand-50 border border-brand-200 rounded-lg space-y-3">
                    <div className="font-bold text-brand-900 border-b border-brand-200 pb-1 flex justify-between items-center">
                      <span>Registration Workflow Summary</span>
                      <span className="text-[11px] font-mono font-bold text-brand-900">{newCol.code}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-text-secondary block">Maker User:</span> <strong>{currentUser.username} ({currentUser.role})</strong></div>
                      <div><span className="text-text-secondary block">Submission Target:</span> <strong>Branch Manager / Checker Queue</strong></div>
                      <div><span className="text-text-secondary block">Initial Status:</span> <strong className="text-amber-700">Pending Approval</strong></div>
                      <div><span className="text-text-secondary block">Next State (Post-Approval):</span> <strong className="text-emerald-700">Active (Eligible for Insurance)</strong></div>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-700 flex-shrink-0" />
                    <span>
                      Completing submission will atomically persist the collateral, legal ownership record, multi-facility allocation links, and digital DMS documents.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
            <div className="p-4 bg-slate-50 border-t border-border flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  if (wizardStep > 1) setWizardStep((wizardStep - 1) as any);
                  else setShowRegisterWizard(false);
                }}
                className="btn-secondary"
              >
                {wizardStep === 1 ? 'Cancel' : 'Back'}
              </button>

              <div className="flex gap-2">
                {wizardStep < 8 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1) {
                        const errs = getStep1Errors();
                        if (errs.length > 0) {
                          alert('Cannot proceed to Step 2:\n\n• ' + errs.join('\n• '));
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
                          alert('Cannot proceed to Step 4:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                      }
                      if (wizardStep === 4) {
                        const errs = getStep4Errors();
                        if (errs.length > 0) {
                          alert('Cannot proceed to Step 5:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                      }
                      if (wizardStep === 5) {
                        const errs = getStep5Errors();
                        if (errs.length > 0) {
                          alert('Cannot proceed to Step 6:\n\n• ' + errs.join('\n• '));
                          return;
                        }
                      }
                      if (wizardStep === 6 && missingMandatoryDocs.length > 0) {
                        alert(
                          `Cannot proceed to Step 7: You must attach valid files for all mandatory document rules configured in Admin.\n\nMissing:\n• ` +
                            missingMandatoryDocs.map((m) => m.documentType).join('\n• ')
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
                    disabled={wizardRegistering}
                    onClick={handleFinishWizard}
                    className="btn-primary bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {wizardRegistering ? 'Submitting to Checker…' : 'Submit for Checker Authorization'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Facility Modal */}
      {showAddLinkModal && selectedCol && (
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Link Credit Facility</h3>
                <p className="text-[11px] text-blue-200">{selectedCol.code} — Pledge to Active Facility</p>
              </div>
              <button onClick={() => setShowAddLinkModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-text-primary mb-1">Select Facility (M)</label>
                <select
                  value={linkLoanId}
                  onChange={(e) => setLinkLoanId(e.target.value)}
                  className="w-full p-2 border border-border rounded"
                >
                  <option value="">-- Choose Credit Facility --</option>
                  {(() => {
                    const custFacs = selectedCol ? getFacilitiesForCustomer(selectedCol.customerId) : [];
                    const displayList = custFacs.length > 0 ? custFacs : facilities;
                    return displayList.map((f) => {
                      const isOwner = selectedCol ? isFacilityOwnedByCustomer(f, selectedCol.customerId) : true;
                      return (
                        <option key={f.id} value={f.id}>
                          {f.lineCode} — {f.facilityType} (Limit: ETB {f.approvedLimit?.toLocaleString()}){' '}
                          {!isOwner ? ' [Other Customer]' : ''}
                        </option>
                      );
                    });
                  })()}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-text-primary mb-1">Allocated Security Amount (ETB) (M)</label>
                <input
                  type="number"
                  min="1"
                  value={linkAmount}
                  onChange={(e) => setLinkAmount(Number(e.target.value))}
                  className="w-full p-2 border border-border rounded font-bold tabular-nums"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button onClick={() => setShowAddLinkModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button disabled={linkSubmitting} onClick={handleAddLinkSubmit} className="btn-primary disabled:opacity-60">
                  {linkSubmitting ? 'Linking…' : 'Link Facility'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal (in 360 view) */}
      {showUploadDocModal && selectedCol && (
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Upload Document (DMS)</h3>
                <p className="text-[11px] text-blue-200">{selectedCol.code} — Attach to Repository</p>
              </div>
              <button onClick={() => setShowUploadDocModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block font-semibold text-text-primary mb-1">Document Title (M)</label>
                <input
                  type="text"
                  placeholder="e.g. Title Deed Certificate"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  className="w-full p-2 border border-border rounded"
                />
              </div>
              <div>
                <label className="block font-semibold text-text-primary mb-1">Document Type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full p-2 border border-border rounded"
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
                <label className="block font-semibold text-text-primary mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={uploadDocExpiry}
                  onChange={(e) => setUploadDocExpiry(e.target.value)}
                  className="w-full p-2 border border-border rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Maintain Collateral Details</h3>
                <p className="text-[11px] text-blue-200">{selectedCol.code} — Maker Amendment</p>
              </div>
              <button onClick={() => setShowMaintainModal(false)} className="text-white hover:text-gray-300">
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
                <label className="block font-semibold text-text-primary mb-1">Market Valuation Amount (ETB)</label>
                <input
                  type="number"
                  min="1"
                  value={maintainFields.valuationAmount || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, valuationAmount: Number(e.target.value) })}
                  className="w-full p-2 border border-border rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-text-primary mb-1">Haircut Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={maintainFields.haircut ?? 20}
                  onChange={(e) => setMaintainFields({ ...maintainFields, haircut: Number(e.target.value) })}
                  className="w-full p-2 border border-border rounded font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-text-primary mb-1">Review Date</label>
                <input
                  type="date"
                  value={maintainFields.reviewDate || ''}
                  onChange={(e) => setMaintainFields({ ...maintainFields, reviewDate: e.target.value })}
                  className="w-full p-2 border border-border rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Transfer Collateral Segment</h3>
                <p className="text-[11px] text-blue-200">{selectedCol.code} — Ownership Segment Transfer</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-white hover:text-gray-300">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="text-text-secondary block mb-1">Current Segment:</span>
                <strong className="text-brand-900 text-sm">{selectedCol.owningSegment}</strong>
              </div>
              <div>
                <label className="block font-semibold text-text-primary mb-1">Destination Segment (M)</label>
                <select
                  value={destSegment}
                  onChange={(e) => setDestSegment(e.target.value)}
                  className="w-full p-2 border border-border rounded"
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
                <label className="block font-semibold text-text-primary mb-1">Transfer Reason (M)</label>
                <textarea
                  rows={3}
                  placeholder="Reason for segment re-alignment..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full p-2 border border-border rounded"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
        <div className="fixed inset-0 bg-brand-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-md w-full overflow-hidden text-xs">
            <div className="p-4 bg-brand-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold">Release Security Obligation</h3>
                <p className="text-[11px] text-blue-200">{selectedCol.code} — Settlement & Release Engine</p>
              </div>
              <button onClick={() => setShowReleaseModal(false)} className="text-white hover:text-gray-300">
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
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
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
    </div>
  );
};

// Helper for facility matching
function facIdOrRef(f: LoanAccount): string {
  return f.id;
}
