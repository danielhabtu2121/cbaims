import { formatEtbNumber } from '../../utils/format.ts';
import { AmountInput } from '../common/AmountInput';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Link as LinkIcon,
  ShieldCheck,
  X,
  Layers,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  UserCheck,
  Users,
  FileText,
  AlertOctagon,
  Info,
  CheckSquare,
  Square,
  Scale,
  Search,
  Percent,
  Sparkles,
  Send,
  HelpCircle,
} from 'lucide-react';
import { cimsApi } from '../../api/cimsApi';
import {
  Customer,
  LoanAccount,
  Collateral,
  CollateralFacilityLinkDto,
  CollateralCandidateDto,
  FacilityCandidateDto,
  RelationshipRequestDto,
  RelationshipValidationResultDto,
  FacilityCollateralSummaryDto,
  UserSession,
} from '../../types';

interface CollateralFacilityLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: UserSession | null;
  mode?: 'create' | 'edit';
  existingLink?: CollateralFacilityLinkDto | null;
  preselectedCollateralId?: string;
  preselectedFacilityId?: string;
  preselectedLoanAccountId?: string;
  preselectedFacility?: LoanAccount | null;
  preselectedCollateral?: Collateral | null;
}

export const CollateralFacilityLinkModal: React.FC<CollateralFacilityLinkModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  mode = 'create',
  existingLink = null,
  preselectedCollateralId,
  preselectedFacilityId,
  preselectedLoanAccountId,
  preselectedFacility,
  preselectedCollateral,
}) => {
  // Master lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facilities, setFacilities] = useState<LoanAccount[]>([]);
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [eligibleBackendFacilities, setEligibleBackendFacilities] = useState<LoanAccount[]>([]);
  const [candidateFacilities, setCandidateFacilities] = useState<FacilityCandidateDto[]>([]);
  const [candidateCollaterals, setCandidateCollaterals] = useState<CollateralCandidateDto[]>([]);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingEligible, setLoadingEligible] = useState<boolean>(false);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);

  // Form selections & inputs
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedLoanAccountId, setSelectedLoanAccountId] = useState<string>('');
  const [selectedCollateralId, setSelectedCollateralId] = useState<string>('');

  // Search filter states for dropdowns and tables
  const [collateralSearchQuery, setCollateralSearchQuery] = useState<string>('');
  const [facilitySearchQuery, setFacilitySearchQuery] = useState<string>('');
  const [facilityStatusFilter, setFacilityStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'REQUIRES_THIRD_PARTY_INFO' | 'DUPLICATE'>('ALL');
  const [collateralStatusFilter, setCollateralStatusFilter] = useState<'ALL' | 'ELIGIBLE' | 'REQUIRES_THIRD_PARTY_INFO' | 'DUPLICATE'>('ALL');

  // Facility co-collaterals summary state
  const [facilitySecuringSummary, setFacilitySecuringSummary] = useState<FacilityCollateralSummaryDto | null>(null);
  const [loadingSecuringSummary, setLoadingSecuringSummary] = useState<boolean>(false);

  // Third-party cross-customer allocation controls (§5, §9, US-04.3, US-04.4, US-04.5)
  const [allocationMode, setAllocationMode] = useState<'borrower' | 'cross_customer'>('borrower');
  const [facilityScope, setFacilityScope] = useState<'owner_only' | 'all_bank' | 'specific_borrower'>('owner_only');
  const [targetCustomerId, setTargetCustomerId] = useState<string>('');
  const [relationshipToBorrower, setRelationshipToBorrower] = useState<string>('Guarantor');
  const [pledgeAgreementRef, setPledgeAgreementRef] = useState<string>('');
  const [consentInfo, setConsentInfo] = useState<string>('');
  const [eligibleFacilitiesError, setEligibleFacilitiesError] = useState<string | null>(null);
  const [candidateCollateralsError, setCandidateCollateralsError] = useState<string | null>(null);
  const [eligibleReloadCounter, setEligibleReloadCounter] = useState<number>(0);
  const [candidateReloadCounter, setCandidateReloadCounter] = useState<number>(0);

  const [allocatedAmount, setAllocatedAmount] = useState<number>(0);
  const [linkageType, setLinkageType] = useState<string>('Primary');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>('');
  const [utilOrder, setUtilOrder] = useState<number>(1);
  const [reinstateOrder, setReinstateOrder] = useState<number>(1);
  const [changeReason, setChangeReason] = useState<string>('');

  // Link-level Charge Priority & Degree Structure (1st vs 2nd Degree)
  const [collateralRank, setCollateralRank] = useState<'1st' | '2nd'>('1st');
  const [isFirstDegreeInternal, setIsFirstDegreeInternal] = useState<boolean>(true);
  const [firstDegreeCollateralId, setFirstDegreeCollateralId] = useState<string>('');
  const [firstDegreeHolderName, setFirstDegreeHolderName] = useState<string>('');
  const [firstDegreeFacilityRef, setFirstDegreeFacilityRef] = useState<string>('');
  const [firstDegreeOutstandingBalance, setFirstDegreeOutstandingBalance] = useState<number | undefined>(undefined);
  const [firstDegreeBalanceAsOfDate, setFirstDegreeBalanceAsOfDate] = useState<string>('');
  const [registeredMortgageAmount, setRegisteredMortgageAmount] = useState<number | undefined>(undefined);
  const [mortgageRegistrationNumber, setMortgageRegistrationNumber] = useState<string>('');
  const [mortgageRegistrationDate, setMortgageRegistrationDate] = useState<string>('');
  const [bankNotedAsSecondMortgagee, setBankNotedAsSecondMortgagee] = useState<boolean>(false);
  const [firstDegreeConfirmationDocId, setFirstDegreeConfirmationDocId] = useState<string>('');
  const [firstDegreeExtractDocId, setFirstDegreeExtractDocId] = useState<string>('');

  // Guided 8-Step Wizard State
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardViewMode, setWizardViewMode] = useState<'guided' | 'full'>('guided');
  const wizardContainerRef = useRef<HTMLDivElement>(null);
  const allocationFormRef = useRef<HTMLDivElement>(null);
  const [isCandidateListCollapsed, setIsCandidateListCollapsed] = useState<boolean>(false);
  const [isFacilityListCollapsed, setIsFacilityListCollapsed] = useState<boolean>(false);

  // Pre-validation state
  const [validationResult, setValidationResult] = useState<RelationshipValidationResultDto | null>(null);
  const [validating, setValidating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPreselectedCollateral = Boolean(preselectedCollateralId);
  const isPreselectedFacility = Boolean(preselectedFacilityId || preselectedLoanAccountId);

  // Load masters on open
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoadingInitial(true);
    setErrorMsg(null);
    setEligibleBackendFacilities([]);
    setCandidateFacilities([]);
    setCandidateCollaterals([]);
    setWizardStep(1);

    Promise.all([
      cimsApi.getCustomers(),
      cimsApi.getFacilities(),
      cimsApi.getCollaterals(),
    ])
      .then(([custRes, facRes, colRes]: [Customer[], LoanAccount[], Collateral[]]) => {
        if (!mounted) return;
        setCustomers(custRes || []);
        setFacilities(facRes || []);
        setCollaterals(colRes || []);
        setLoadingInitial(false);

        // Pre-populate if editing
        if (mode === 'edit' && existingLink) {
          const colId = existingLink.collateralId || '';
          setSelectedCollateralId(colId);
          setSelectedCustomerId(existingLink.customerId || '');
          setSelectedLoanAccountId(existingLink.loanAccountId || '');
          setAllocatedAmount(existingLink.allocatedAmount || 0);
          setLinkageType(existingLink.linkageType || 'Primary');
          setEffectiveDate(existingLink.effectiveDate || new Date().toISOString().split('T')[0]);
          setEndDate(existingLink.endDate || '');
          setUtilOrder(existingLink.utilOrder || 1);
          setReinstateOrder(existingLink.reinstateOrder || 1);
          setChangeReason(existingLink.changeReason || '');

          const targetCol = (colRes || []).find((c) => c.id === colId || c.code === colId);
          if (targetCol && existingLink.customerId !== targetCol.customerId) {
            setAllocationMode('cross_customer');
            setFacilityScope('all_bank');
            setTargetCustomerId(existingLink.customerId || '');
          }
          if (existingLink.relationshipToBorrower) {
            setRelationshipToBorrower(existingLink.relationshipToBorrower);
          }
          if (existingLink.pledgeAgreementRef) {
            setPledgeAgreementRef(existingLink.pledgeAgreementRef);
          }
          if (existingLink.consentInfo) {
            setConsentInfo(existingLink.consentInfo);
          }
          if (existingLink.collateralRank) {
            setCollateralRank((existingLink.collateralRank as any) || '1st');
          }
          if (existingLink.collateralRank === '2nd') {
            setIsFirstDegreeInternal(existingLink.isFirstDegreeInternal !== false);
            setFirstDegreeCollateralId(existingLink.firstDegreeCollateralId || '');
            setFirstDegreeHolderName(existingLink.firstDegreeHolderName || '');
            setFirstDegreeFacilityRef(existingLink.firstDegreeFacilityRef || '');
            setFirstDegreeOutstandingBalance(existingLink.firstDegreeOutstandingBalance);
            setFirstDegreeBalanceAsOfDate(existingLink.firstDegreeBalanceAsOfDate || '');
            setRegisteredMortgageAmount(existingLink.registeredMortgageAmount);
            setMortgageRegistrationNumber(existingLink.mortgageRegistrationNumber || '');
            setMortgageRegistrationDate(existingLink.mortgageRegistrationDate || '');
            setBankNotedAsSecondMortgagee(Boolean(existingLink.bankNotedAsSecondMortgagee));
            setFirstDegreeConfirmationDocId(existingLink.firstDegreeConfirmationDocId || '');
            setFirstDegreeExtractDocId(existingLink.firstDegreeExtractDocId || '');
          }
        } else if (preselectedCollateralId) {
          setSelectedCollateralId(preselectedCollateralId);
          const c = (colRes || []).find((item) => item.id === preselectedCollateralId || item.code === preselectedCollateralId);
          if (c) {
            if (c.customerId) setSelectedCustomerId(c.customerId);
            if (c.collateralRank === '2nd') {
              setCollateralRank('2nd');
              setIsFirstDegreeInternal(c.isFirstDegreeInternal !== false);
              setFirstDegreeCollateralId(c.firstDegreeCollateralId || '');
              setFirstDegreeHolderName(c.firstDegreeHolderName || '');
              setFirstDegreeFacilityRef(c.firstDegreeFacilityRef || '');
              setFirstDegreeOutstandingBalance(c.firstDegreeOutstandingBalance);
              setFirstDegreeBalanceAsOfDate(c.firstDegreeBalanceAsOfDate || '');
              setRegisteredMortgageAmount(c.registeredMortgageAmount);
              setMortgageRegistrationNumber(c.mortgageRegistrationNumber || '');
              setMortgageRegistrationDate(c.mortgageRegistrationDate || '');
              setBankNotedAsSecondMortgagee(Boolean(c.bankNotedAsSecondMortgagee));
              setFirstDegreeConfirmationDocId(c.firstDegreeConfirmationDocId || '');
              setFirstDegreeExtractDocId(c.firstDegreeExtractDocId || '');
            }
          }
        } else if (preselectedFacilityId || preselectedLoanAccountId) {
          const fid = preselectedLoanAccountId || preselectedFacilityId || '';
          setSelectedLoanAccountId(fid);
          const f = (facRes || []).find((item) => item.id === fid || item.lineCode === fid);
          if (f && f.customerId) {
            setSelectedCustomerId(f.customerId);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load initial masters:', err);
        if (mounted) {
          setErrorMsg('Failed to load relationship master data. Please close and re-open the dialog.');
          setLoadingInitial(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [
    isOpen,
    mode,
    existingLink,
    preselectedCollateralId,
    preselectedFacilityId,
    preselectedLoanAccountId,
  ]);

  // Fetch candidate collaterals whenever facility is preselected or selected in Direction 2
  useEffect(() => {
    if (!isOpen || !isPreselectedFacility) return;

    const facId = preselectedLoanAccountId || preselectedFacilityId || selectedLoanAccountId;
    if (!facId) return;

    let active = true;
    setLoadingCandidates(true);
    setCandidateCollateralsError(null);
    const userId = currentUser?.userId || currentUser?.username || undefined;

    cimsApi
      .getEligibleCollateralsForFacility(facId, userId)
      .then((cands) => {
        if (active && Array.isArray(cands)) {
          setCandidateCollaterals(cands);
        }
      })
      .catch((err) => {
        console.warn('Failed to load candidate collaterals:', err);
        if (active) {
          setCandidateCollateralsError(err?.message || 'Failed to evaluate candidate collateral records for this facility.');
        }
      })
      .finally(() => {
        if (active) setLoadingCandidates(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, isPreselectedFacility, preselectedFacilityId, preselectedLoanAccountId, selectedLoanAccountId, candidateReloadCounter, currentUser?.userId, currentUser?.username]);

  // Selected collateral
  const selectedCollateral = useMemo(() => {
    if (preselectedCollateral) return preselectedCollateral;
    const cid = selectedCollateralId || preselectedCollateralId;
    if (!cid) return null;
    return (
      collaterals.find((c) => c.id === cid || c.code === cid) || null
    );
  }, [collaterals, selectedCollateralId, preselectedCollateral, preselectedCollateralId]);

  // Strict customer-isolated credit facilities
  const availableFacilities = useMemo(() => {
    if (selectedCollateralId && eligibleBackendFacilities.length > 0) {
      return eligibleBackendFacilities;
    }

    const effectiveCustId =
      allocationMode === 'cross_customer' && targetCustomerId
        ? targetCustomerId
        : selectedCustomerId;

    if (!effectiveCustId) {
      return facilities;
    }

    const target = effectiveCustId.trim().toLowerCase();
    const cust = customers.find(
      (c) =>
        (c.id && c.id.trim().toLowerCase() === target) ||
        (c.cif && c.cif.trim().toLowerCase() === target)
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
  }, [
    selectedCollateralId,
    eligibleBackendFacilities,
    allocationMode,
    targetCustomerId,
    selectedCustomerId,
    customers,
    facilities,
  ]);

  // Selected facility
  const selectedFacility = useMemo(
    () => {
      if (preselectedFacility) return preselectedFacility;
      const fid = selectedLoanAccountId || preselectedLoanAccountId || preselectedFacilityId;
      if (!fid) return null;
      const found =
        facilities.find((f) => f.id === fid || f.lineCode === fid || f.loanReference === fid) ||
        availableFacilities.find((f) => f.id === fid);
      if (found) return found;
      const foundCand = candidateFacilities.find(
        (f) => f.id === fid || f.lineCode === fid || f.loanReference === fid
      );
      if (foundCand) {
        return {
          id: foundCand.id,
          lineCode: foundCand.lineCode || foundCand.id,
          loanReference: foundCand.loanReference || foundCand.id,
          customerId: foundCand.customerId || '',
          facilityType: foundCand.facilityType,
          lineCurrency: foundCand.lineCurrency || 'ETB',
          revolvingLine: false,
          lineStartDate: '',
          lineExpiryDate: foundCand.lineExpiryDate || '',
          approvedLimit: foundCand.approvedLimit,
          outstandingBalance: foundCand.outstandingBalance,
          availableAmount: foundCand.availableAmount,
          segment: (foundCand.segment || 'CORPORATE') as any,
          branch: foundCand.branch || 'Addis Ababa Main',
          status: foundCand.status,
          source: 'CBS_SIM',
        } as LoanAccount;
      }
      return null;
    },
    [
      availableFacilities,
      candidateFacilities,
      facilities,
      selectedLoanAccountId,
      preselectedFacility,
      preselectedLoanAccountId,
      preselectedFacilityId,
    ]
  );

  // Selected customer
  const selectedCustomer = useMemo(() => {
    const custId = isPreselectedFacility
      ? selectedFacility?.customerId || selectedCustomerId
      : selectedCustomerId || selectedCollateral?.customerId;
    if (!custId) return null;
    return (
      customers.find(
        (c) =>
          c.id === custId ||
          c.cif === custId ||
          (c.name && c.name.toLowerCase() === custId.toLowerCase())
      ) || null
    );
  }, [customers, isPreselectedFacility, selectedFacility, selectedCollateral, selectedCustomerId]);

  const targetCustomer = useMemo(() => {
    if (!targetCustomerId) return null;
    return (
      customers.find(
        (c) =>
          c.id === targetCustomerId ||
          c.cif === targetCustomerId ||
          (c.name && c.name.toLowerCase() === targetCustomerId.toLowerCase())
      ) || null
    );
  }, [customers, targetCustomerId]);

  // Fetch backend eligible facilities & candidates whenever collateral, target customer, or facility scope changes (Section 35)
  useEffect(() => {
    if (!isOpen || !selectedCollateralId || isPreselectedFacility) {
      if (!isPreselectedFacility) {
        setEligibleBackendFacilities([]);
        setCandidateFacilities([]);
      }
      return;
    }

    let active = true;
    setLoadingEligible(true);
    setEligibleFacilitiesError(null);
    let targetCust: string | undefined = undefined;
    if (facilityScope === 'all_bank') {
      targetCust = 'ALL';
    } else if (facilityScope === 'specific_borrower' || allocationMode === 'cross_customer') {
      targetCust = targetCustomerId || undefined;
    }
    const userId = currentUser?.userId || currentUser?.username || undefined;

    Promise.all([
      cimsApi.getCandidateFacilitiesForCollateral(selectedCollateralId, targetCust, userId),
      cimsApi.getEligibleFacilitiesForCollateral(selectedCollateralId, targetCust, userId)
    ])
      .then(([candList, eligList]) => {
        if (active) {
          if (Array.isArray(candList)) {
            setCandidateFacilities(candList);
          }
          if (Array.isArray(eligList)) {
            setEligibleBackendFacilities(eligList);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to load candidate facilities:', err);
        if (active) {
          setEligibleFacilitiesError(err?.message || 'Failed to retrieve eligible facilities from Core Banking.');
        }
      })
      .finally(() => {
        if (active) setLoadingEligible(false);
      });

    return () => {
      active = false;
    };
  }, [
    isOpen,
    selectedCollateralId,
    facilityScope,
    allocationMode,
    targetCustomerId,
    eligibleReloadCounter,
    isPreselectedFacility,
    currentUser?.userId,
    currentUser?.username,
  ]);

  // Filtered candidate facilities list (Section 35)
  const filteredCandidateFacilities = useMemo(() => {
    let list = candidateFacilities;
    if (facilityStatusFilter === 'ELIGIBLE') {
      list = list.filter((f) => f.candidateStatus === 'ELIGIBLE');
    } else if (facilityStatusFilter === 'REQUIRES_THIRD_PARTY_INFO') {
      list = list.filter((f) => f.candidateStatus === 'REQUIRES_THIRD_PARTY_INFO');
    } else if (facilityStatusFilter === 'DUPLICATE') {
      list = list.filter((f) => f.candidateStatus === 'DUPLICATE' || !f.eligible);
    }

    if (!facilitySearchQuery.trim()) return list;
    const q = facilitySearchQuery.toLowerCase().trim();
    return list.filter((f) => {
      const ref = (f.loanReference || '').toLowerCase();
      const code = (f.lineCode || '').toLowerCase();
      const id = (f.id || '').toLowerCase();
      const type = (f.facilityType || '').toLowerCase();
      const acc = (f.accountNumber || '').toLowerCase();
      const bName = (f.borrowerName || '').toLowerCase();
      const bCif = (f.borrowerCif || '').toLowerCase();
      return (
        ref.includes(q) ||
        code.includes(q) ||
        id.includes(q) ||
        type.includes(q) ||
        acc.includes(q) ||
        bName.includes(q) ||
        bCif.includes(q)
      );
    });
  }, [candidateFacilities, facilityStatusFilter, facilitySearchQuery]);


  // Third-party legal ownership and borrower identity resolution (Relationship-Specific)
  const isThirdParty = useMemo(() => {
    if (validationResult?.thirdParty !== undefined) return validationResult.thirdParty;
    if (selectedCollateral && selectedFacility) {
      const colCust = (selectedCollateral.customerId || '').trim().toLowerCase();
      const facCust = (selectedFacility.customerId || '').trim().toLowerCase();
      if (colCust && facCust && colCust === facCust) return false;
      const facCustomer = customers.find(c => c.id === selectedFacility.customerId || c.cif === selectedFacility.customerId);
      const facCustomerName = (facCustomer?.name || '').trim().toLowerCase();
      const ownerMatches = (selectedCollateral.owners || []).some((o) => {
        const oName = (o.name || '').trim().toLowerCase();
        return oName && (oName === facCust || (facCustomerName && oName === facCustomerName));
      });
      if (ownerMatches) return false;
      return Boolean(colCust && facCust && colCust !== facCust);
    }
    return false;
  }, [validationResult, selectedCollateral, selectedFacility, customers]);

  const legalOwnerNameDisplay = useMemo(() => {
    return (
      validationResult?.legalOwnerName ||
      selectedCollateral?.owners?.map((o) => o.name).filter(Boolean).join(', ') ||
      selectedCustomer?.name ||
      'Collateral Owner'
    );
  }, [validationResult, selectedCollateral, selectedCustomer]);

  const legalOwnerCifDisplay = useMemo(() => {
    return (
      validationResult?.legalOwnerCif ||
      selectedCollateral?.customerId ||
      selectedCustomer?.cif ||
      ''
    );
  }, [validationResult, selectedCollateral, selectedCustomer]);

  const borrowerNameDisplay = useMemo(() => {
    if (validationResult?.borrowerName) return validationResult.borrowerName;
    if (targetCustomer) return targetCustomer.name;
    const facCust = customers.find(
      (c) =>
        c.id === selectedFacility?.customerId ||
        c.cif === selectedFacility?.customerId
    );
    return facCust?.name || selectedFacility?.customerId || 'Borrower';
  }, [validationResult, targetCustomer, customers, selectedFacility]);

  const borrowerCifDisplay = useMemo(() => {
    return (
      validationResult?.borrowerCif ||
      targetCustomer?.cif ||
      selectedFacility?.customerId ||
      ''
    );
  }, [validationResult, targetCustomer, selectedFacility]);

  // Customer isolated collaterals (for generic fallback mode)
  const availableCollaterals = useMemo(() => {
    if (!selectedCustomerId) return collaterals;
    const target = selectedCustomerId.trim().toLowerCase();
    const cust = customers.find(
      (c) =>
        (c.id && c.id.trim().toLowerCase() === target) ||
        (c.cif && c.cif.trim().toLowerCase() === target)
    );
    const validIds = new Set<string>();
    validIds.add(target);
    if (cust) {
      if (cust.id) validIds.add(cust.id.trim().toLowerCase());
      if (cust.cif) validIds.add(cust.cif.trim().toLowerCase());
    }
    return collaterals.filter((c) => {
      if (!c.customerId) return false;
      return validIds.has(c.customerId.trim().toLowerCase());
    });
  }, [collaterals, selectedCustomerId, customers]);

  // Fetch co-collaterals securing the selected facility
  useEffect(() => {
    const facId = selectedFacility?.id || selectedLoanAccountId;
    if (!facId) {
      setFacilitySecuringSummary(null);
      return;
    }
    let active = true;
    setLoadingSecuringSummary(true);
    cimsApi
      .getFacilitySecuringCollaterals(facId)
      .then((res) => {
        if (active) setFacilitySecuringSummary(res);
      })
      .catch((err) => {
        console.warn('Could not load facility securing collaterals:', err);
      })
      .finally(() => {
        if (active) setLoadingSecuringSummary(false);
      });
    return () => {
      active = false;
    };
  }, [selectedFacility?.id, selectedLoanAccountId]);

  // Derived financial computations
  const netCollateralValue = useMemo(() => {
    if (!selectedCollateral) return 0;
    const valuation = Number(selectedCollateral.valuationAmount || 0);
    const haircut = Number(selectedCollateral.haircut ?? 20);
    return Math.round(valuation * (1 - haircut / 100) * 100) / 100;
  }, [selectedCollateral]);

  // Existing other collaterals pledged to this facility (co-collaterals)
  const existingCoCollaterals = useMemo(() => {
    if (!facilitySecuringSummary?.securingCollaterals) return [];
    return facilitySecuringSummary.securingCollaterals.filter((sc) => {
      if (mode === 'edit' && existingLink && (sc.id === existingLink.id || sc.collateralId === existingLink.collateralId)) {
        return false;
      }
      if (selectedCollateralId && (sc.collateralId === selectedCollateralId || sc.collateralCode === selectedCollateralId)) {
        return false;
      }
      return true;
    });
  }, [facilitySecuringSummary, existingLink, mode, selectedCollateralId]);

  // Total allocated to this facility by other existing collaterals
  const priorAllocatedToFacility = useMemo(() => {
    return existingCoCollaterals.reduce((sum, sc) => sum + Number(sc.allocatedAmount || 0), 0);
  }, [existingCoCollaterals]);

  // Facility outstanding exposure
  const facilityOutstandingExposure = useMemo(() => {
    return Number(selectedFacility?.outstandingBalance ?? selectedFacility?.approvedLimit ?? 0);
  }, [selectedFacility]);

  // Deficit remaining to reach 100% facility coverage
  const remainingNeededFor100PctCoverage = useMemo(() => {
    return Math.max(0, Math.round((facilityOutstandingExposure - priorAllocatedToFacility) * 100) / 100);
  }, [facilityOutstandingExposure, priorAllocatedToFacility]);

  // Total facility allocated security (prior co-collaterals + proposed allocation)
  const totalFacilityAllocatedWithProposed = useMemo(() => {
    return priorAllocatedToFacility + Number(allocatedAmount || 0);
  }, [priorAllocatedToFacility, allocatedAmount]);

  // Total facility coverage percentage
  const totalFacilityCoveragePct = useMemo(() => {
    if (facilityOutstandingExposure <= 0) return 0;
    return Math.round((totalFacilityAllocatedWithProposed / facilityOutstandingExposure) * 10000) / 100;
  }, [totalFacilityAllocatedWithProposed, facilityOutstandingExposure]);

  // Does total facility coverage exceed 100%?
  const isFacilityCoverageOver100 = useMemo(() => {
    return totalFacilityCoveragePct > 100.01;
  }, [totalFacilityCoveragePct]);

  const priorChargeDeduction = useMemo(() => {
    if (collateralRank !== '2nd') return 0;
    return Number(firstDegreeOutstandingBalance || 0);
  }, [collateralRank, firstDegreeOutstandingBalance]);

  // Rank-Aware Available Collateral Capacity (Rule 2.5)
  const availableCollateralCapacity = useMemo(() => {
    if (!selectedCollateral) return 0;
    const existingAlloc = mode === 'edit' && existingLink ? Number(existingLink.allocatedAmount || 0) : 0;
    const curAlloc = validationResult?.currentActiveAllocations ?? Number(selectedCollateral.currentAllocation || 0);
    const baseAlloc = Math.max(0, curAlloc - existingAlloc);
    const rankCeiling = collateralRank === '2nd'
      ? Math.max(0, netCollateralValue - priorChargeDeduction)
      : netCollateralValue;
    return Math.max(0, Math.round((rankCeiling - baseAlloc) * 100) / 100);
  }, [selectedCollateral, existingLink, mode, validationResult, netCollateralValue, collateralRank, priorChargeDeduction]);

  // Recommended 100% allocation
  const recommended100PctAllocation = useMemo(() => {
    return Math.min(availableCollateralCapacity, remainingNeededFor100PctCoverage);
  }, [availableCollateralCapacity, remainingNeededFor100PctCoverage]);

  const collateralAllocationPct = useMemo(() => {
    if (netCollateralValue <= 0 || allocatedAmount <= 0) return 0;
    return Math.min(100, Math.round((allocatedAmount / netCollateralValue) * 10000) / 100);
  }, [allocatedAmount, netCollateralValue]);

  const remainingCapacity = useMemo(() => {
    if (!selectedCollateral) return 0;
    const existingAlloc = existingLink ? Number(existingLink.allocatedAmount || 0) : 0;
    const currentAlloc = Number(selectedCollateral.currentAllocation || 0);
    const baseAllocated = Math.max(0, currentAlloc - existingAlloc);
    const rankCeiling = collateralRank === '2nd'
      ? Math.max(0, netCollateralValue - priorChargeDeduction)
      : netCollateralValue;
    return Math.max(0, Math.round((rankCeiling - baseAllocated - allocatedAmount) * 100) / 100);
  }, [selectedCollateral, existingLink, netCollateralValue, allocatedAmount, collateralRank, priorChargeDeduction]);

  const isSecondDegreeCeilingExceeded = useMemo(() => {
    if (collateralRank !== '2nd') return false;
    const rankCeiling = Math.max(0, netCollateralValue - priorChargeDeduction);
    const existingAlloc = existingLink ? Number(existingLink.allocatedAmount || 0) : 0;
    const currentAlloc = Number(selectedCollateral?.currentAllocation || 0);
    const otherAlloc = Math.max(0, currentAlloc - existingAlloc);
    return (otherAlloc + allocatedAmount) > rankCeiling;
  }, [collateralRank, netCollateralValue, priorChargeDeduction, existingLink, selectedCollateral, allocatedAmount]);

  // Filtered candidate collaterals (for facility-first mode)
  const filteredCandidateCollaterals = useMemo(() => {
    let list = candidateCollaterals;
    if (collateralStatusFilter === 'ELIGIBLE') {
      list = list.filter((c) => c.eligible && !c.thirdParty);
    } else if (collateralStatusFilter === 'REQUIRES_THIRD_PARTY_INFO') {
      list = list.filter((c) => c.thirdParty || c.candidateStatus === 'REQUIRES_THIRD_PARTY_INFO');
    } else if (collateralStatusFilter === 'DUPLICATE') {
      list = list.filter((c) => c.alreadyLinked || !c.eligible);
    }

    if (!collateralSearchQuery.trim()) return list;
    const q = collateralSearchQuery.toLowerCase().trim();
    return list.filter((cand) => {
      const code = (cand.code || '').toLowerCase();
      const id = (cand.id || '').toLowerCase();
      const type = (cand.type || '').toLowerCase();
      const cat = (cand.category || '').toLowerCase();
      const owner = (cand.legalOwnerNames || cand.customerName || '').toLowerCase();
      const rel = (cand.ownerRelationship || '').toLowerCase();
      return code.includes(q) || id.includes(q) || type.includes(q) || cat.includes(q) || owner.includes(q) || rel.includes(q);
    });
  }, [candidateCollaterals, collateralStatusFilter, collateralSearchQuery]);

  const handleSelectCollateral = (candId: string) => {
    setSelectedCollateralId(candId);
    const found = candidateCollaterals.find((c) => c.id === candId || c.code === candId);
    const fullCol = collaterals.find((c) => c.id === candId || c.code === candId);
    if (fullCol?.collateralRank === '2nd') {
      setCollateralRank('2nd');
      setIsFirstDegreeInternal(fullCol.isFirstDegreeInternal !== false);
      setFirstDegreeCollateralId(fullCol.firstDegreeCollateralId || '');
      setFirstDegreeHolderName(fullCol.firstDegreeHolderName || '');
      setFirstDegreeFacilityRef(fullCol.firstDegreeFacilityRef || '');
      setFirstDegreeOutstandingBalance(fullCol.firstDegreeOutstandingBalance);
      setFirstDegreeBalanceAsOfDate(fullCol.firstDegreeBalanceAsOfDate || '');
      setRegisteredMortgageAmount(fullCol.registeredMortgageAmount);
      setMortgageRegistrationNumber(fullCol.mortgageRegistrationNumber || '');
      setMortgageRegistrationDate(fullCol.mortgageRegistrationDate || '');
      setBankNotedAsSecondMortgagee(Boolean(fullCol.bankNotedAsSecondMortgagee));
      setFirstDegreeConfirmationDocId(fullCol.firstDegreeConfirmationDocId || '');
      setFirstDegreeExtractDocId(fullCol.firstDegreeExtractDocId || '');
    }
    if (found && found.eligible) {
      const facBalance = selectedFacility?.outstandingBalance ?? 0;
      const defAlloc = recommended100PctAllocation > 0 ? recommended100PctAllocation : Math.min(
        found.availableCapacity,
        facBalance > 0 ? facBalance : found.availableCapacity
      );
      if (allocatedAmount <= 0) {
        setAllocatedAmount(defAlloc > 0 ? defAlloc : found.availableCapacity);
      }
    }
    setWizardStep(1);
    setTimeout(() => {
      wizardContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSelectFacility = (facId: string) => {
    setSelectedLoanAccountId(facId);
    const foundCand = candidateFacilities.find((f) => f.id === facId || f.lineCode === facId || f.loanReference === facId);
    const fullFac = facilities.find((f) => f.id === facId || f.lineCode === facId || f.loanReference === facId);
    const effFac = fullFac || (foundCand ? {
      id: foundCand.id,
      lineCode: foundCand.lineCode || foundCand.id,
      loanReference: foundCand.loanReference || foundCand.id,
      customerId: foundCand.customerId || '',
      facilityType: foundCand.facilityType,
      lineCurrency: foundCand.lineCurrency || 'ETB',
      revolvingLine: false,
      lineStartDate: '',
      lineExpiryDate: foundCand.lineExpiryDate || '',
      approvedLimit: foundCand.approvedLimit,
      outstandingBalance: foundCand.outstandingBalance,
      availableAmount: foundCand.availableAmount,
      segment: (foundCand.segment || 'CORPORATE') as any,
      branch: foundCand.branch || 'Addis Ababa Main',
      status: foundCand.status,
      source: 'CBS_SIM',
    } as LoanAccount : null);

    if (foundCand && foundCand.thirdParty) {
      setAllocationMode('cross_customer');
      if (foundCand.customerId) {
        setTargetCustomerId(foundCand.customerId);
      }
    } else if (effFac && selectedCollateral && effFac.customerId !== selectedCollateral.customerId) {
      setAllocationMode('cross_customer');
      setTargetCustomerId(effFac.customerId);
    } else {
      setAllocationMode('borrower');
    }

    if (effFac) {
      const defAlloc = recommended100PctAllocation > 0 ? recommended100PctAllocation : Math.min(
        availableCollateralCapacity,
        effFac.outstandingBalance > 0 ? effFac.outstandingBalance : availableCollateralCapacity
      );
      if (allocatedAmount <= 0 && defAlloc > 0) {
        setAllocatedAmount(defAlloc);
      }
    }

    setWizardStep(1);
    setTimeout(() => {
      wizardContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Auto-validate whenever selections or amount change
  useEffect(() => {
    if (!selectedCollateralId || !selectedLoanAccountId || allocatedAmount <= 0) {
      setValidationResult(null);
      return;
    }

    const payload: RelationshipRequestDto = {
      id: mode === 'edit' && existingLink ? existingLink.id : undefined,
      collateralId: selectedCollateralId,
      loanAccountId: selectedLoanAccountId,
      facilityId: selectedFacility?.id,
      allocatedAmount: Number(allocatedAmount),
      linkageType,
      utilOrder,
      reinstateOrder,
      effectiveDate,
      endDate: endDate || undefined,
      changeReason: changeReason || (mode === 'create' ? 'Initial relationship validation' : 'Allocation adjustment'),
      borrowerCustomerId: selectedFacility?.customerId || (allocationMode === 'cross_customer' ? targetCustomerId : undefined),
      relationshipToBorrower: allocationMode === 'cross_customer' || isThirdParty ? (relationshipToBorrower || 'Guarantor') : undefined,
      pledgeAgreementRef: allocationMode === 'cross_customer' || isThirdParty ? (pledgeAgreementRef || undefined) : undefined,
      consentInfo: allocationMode === 'cross_customer' || isThirdParty ? (consentInfo || undefined) : undefined,
      thirdPartyPledge: allocationMode === 'cross_customer' || isThirdParty,
      relationshipContext: isThirdParty ? 'Third-party' : 'Borrower-owned',
      finalSubmission: false,
      collateralRank,
      isFirstDegreeInternal: collateralRank === '2nd' ? isFirstDegreeInternal : undefined,
      firstDegreeCollateralId: (collateralRank === '2nd' && isFirstDegreeInternal) ? firstDegreeCollateralId : undefined,
      firstDegreeHolderName: (collateralRank === '2nd' && !isFirstDegreeInternal) ? firstDegreeHolderName : (collateralRank === '2nd' ? 'Dashen Bank S.C.' : undefined),
      firstDegreeFacilityRef: collateralRank === '2nd' ? firstDegreeFacilityRef : undefined,
      firstDegreeOutstandingBalance: collateralRank === '2nd' ? firstDegreeOutstandingBalance : undefined,
      firstDegreeBalanceAsOfDate: collateralRank === '2nd' ? firstDegreeBalanceAsOfDate : undefined,
      registeredMortgageAmount: collateralRank === '2nd' ? registeredMortgageAmount : undefined,
      mortgageRegistrationNumber: collateralRank === '2nd' ? mortgageRegistrationNumber : undefined,
      mortgageRegistrationDate: collateralRank === '2nd' ? mortgageRegistrationDate : undefined,
      bankNotedAsSecondMortgagee: collateralRank === '2nd' ? bankNotedAsSecondMortgagee : undefined,
      firstDegreeConfirmationDocId: collateralRank === '2nd' ? firstDegreeConfirmationDocId : undefined,
      firstDegreeExtractDocId: collateralRank === '2nd' ? firstDegreeExtractDocId : undefined,
    };

    let active = true;
    setValidating(true);

    const timer = setTimeout(() => {
      cimsApi
        .validateCollateralFacilityLink(payload)
        .then((res) => {
          if (active) setValidationResult(res);
        })
        .catch((err) => {
          console.warn('Pre-validation failed:', err);
        })
        .finally(() => {
          if (active) setValidating(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    selectedCollateralId,
    selectedLoanAccountId,
    allocatedAmount,
    linkageType,
    utilOrder,
    reinstateOrder,
    effectiveDate,
    endDate,
    changeReason,
    allocationMode,
    targetCustomerId,
    relationshipToBorrower,
    pledgeAgreementRef,
    consentInfo,
    mode,
    existingLink,
    selectedFacility?.id,
    selectedFacility?.customerId,
    isThirdParty,
    collateralRank,
    isFirstDegreeInternal,
    firstDegreeCollateralId,
    firstDegreeHolderName,
    firstDegreeFacilityRef,
    firstDegreeOutstandingBalance,
    firstDegreeBalanceAsOfDate,
    registeredMortgageAmount,
    mortgageRegistrationNumber,
    mortgageRegistrationDate,
    bankNotedAsSecondMortgagee,
    firstDegreeConfirmationDocId,
    firstDegreeExtractDocId,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedCollateralId) {
      setErrorMsg('Please select a valid collateral asset.');
      return;
    }
    if (!selectedLoanAccountId) {
      setErrorMsg('Please select an eligible credit facility.');
      return;
    }
    if (allocatedAmount <= 0) {
      setErrorMsg('Allocated collateral amount must be greater than zero.');
      return;
    }
    if (allocatedAmount > netCollateralValue) {
      setErrorMsg(
        `Allocated amount (ETB ${formatEtbNumber(allocatedAmount)}) cannot exceed Net Collateral Value (ETB ${formatEtbNumber(netCollateralValue)}).`
      );
      return;
    }
    if (collateralRank === '2nd') {
      if (!isFirstDegreeInternal) {
        if (!firstDegreeHolderName.trim()) {
          setErrorMsg('Please specify the External 1st-Degree Holder Name.');
          return;
        }
        if (!firstDegreeFacilityRef.trim()) {
          setErrorMsg('Please specify the External 1st-Degree Facility Reference.');
          return;
        }
        if (!firstDegreeOutstandingBalance || firstDegreeOutstandingBalance <= 0) {
          setErrorMsg('External 1st-Degree Outstanding Balance must be greater than zero.');
          return;
        }
        if (!mortgageRegistrationNumber.trim()) {
          setErrorMsg('Cadastral / Mortgage Registration Number is mandatory for 2nd-degree charges.');
          return;
        }
      }
      if (isSecondDegreeCeilingExceeded) {
        const rankCeiling = Math.max(0, netCollateralValue - priorChargeDeduction);
        setErrorMsg(
          `Allocation exceeds 2nd-degree capacity ceiling (ETB ${formatEtbNumber(rankCeiling)}) after deducting 1st-degree prior charge exposure (ETB ${formatEtbNumber(priorChargeDeduction)}).`
        );
        return;
      }
    }
    if (mode === 'edit' && !changeReason.trim()) {
      setErrorMsg('Please specify a valid Change Reason for auditing relationship modifications.');
      return;
    }

    const targetCol = selectedCollateral || collaterals.find((c) => c.id === selectedCollateralId || c.code === selectedCollateralId);

    const payload: RelationshipRequestDto = {
      id: mode === 'edit' && existingLink ? existingLink.id : undefined,
      collateralId: targetCol?.id || selectedCollateralId,
      loanAccountId: selectedLoanAccountId,
      facilityId: selectedFacility?.id,
      allocatedAmount: Number(allocatedAmount),
      linkageType,
      utilOrder: Number(utilOrder),
      reinstateOrder: Number(reinstateOrder),
      effectiveDate,
      endDate: endDate || undefined,
      changeReason: changeReason || (mode === 'create' ? 'Initial relationship linkage' : 'Allocation maintenance'),
      source: 'CIMS',
      borrowerCustomerId: selectedFacility?.customerId || (allocationMode === 'cross_customer' ? targetCustomerId : undefined),
      relationshipToBorrower: allocationMode === 'cross_customer' || isThirdParty ? (relationshipToBorrower || 'Guarantor') : undefined,
      pledgeAgreementRef: allocationMode === 'cross_customer' || isThirdParty ? (pledgeAgreementRef || undefined) : undefined,
      consentInfo: allocationMode === 'cross_customer' || isThirdParty ? (consentInfo || undefined) : undefined,
      thirdPartyPledge: allocationMode === 'cross_customer' || isThirdParty,
      relationshipContext: isThirdParty ? 'Third-party' : 'Borrower-owned',
      finalSubmission: true,
      collateralRank,
      isFirstDegreeInternal: collateralRank === '2nd' ? isFirstDegreeInternal : undefined,
      firstDegreeCollateralId: (collateralRank === '2nd' && isFirstDegreeInternal) ? firstDegreeCollateralId : undefined,
      firstDegreeHolderName: (collateralRank === '2nd' && !isFirstDegreeInternal) ? firstDegreeHolderName : (collateralRank === '2nd' ? 'Dashen Bank S.C.' : undefined),
      firstDegreeFacilityRef: collateralRank === '2nd' ? firstDegreeFacilityRef : undefined,
      firstDegreeOutstandingBalance: collateralRank === '2nd' ? firstDegreeOutstandingBalance : undefined,
      firstDegreeBalanceAsOfDate: collateralRank === '2nd' ? firstDegreeBalanceAsOfDate : undefined,
      registeredMortgageAmount: collateralRank === '2nd' ? registeredMortgageAmount : undefined,
      mortgageRegistrationNumber: collateralRank === '2nd' ? mortgageRegistrationNumber : undefined,
      mortgageRegistrationDate: collateralRank === '2nd' ? mortgageRegistrationDate : undefined,
      bankNotedAsSecondMortgagee: collateralRank === '2nd' ? bankNotedAsSecondMortgagee : undefined,
      firstDegreeConfirmationDocId: collateralRank === '2nd' ? firstDegreeConfirmationDocId : undefined,
      firstDegreeExtractDocId: collateralRank === '2nd' ? firstDegreeExtractDocId : undefined,
    };

    setSubmitting(true);
    const userId = currentUser?.userId || currentUser?.username || 'CRO_OFFICER';

    try {
      if (mode === 'edit' && existingLink?.id) {
        await cimsApi.updateCollateralFacilityLink(existingLink.id, payload, userId);
      } else {
        await cimsApi.createCollateralFacilityLink(payload, userId);
      }
      setSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || 'Failed to submit relationship link.');
    }
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return 'Relationship Context';
      case 2: return 'Security Degree & Priority';
      case 3: return 'Third-Party Arrangement';
      case 4: return 'Senior Charge Details';
      case 5: return 'Financial Allocation & Limits';
      case 6: return 'Documents & DMS Evidence';
      case 7: return 'Backend Pre-Validation';
      case 8: return 'Final Review & Submit';
      default: return 'Linkage Wizard';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-[#102E4A] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center text-lg font-bold border border-white/20">
              <LinkIcon className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {mode === 'edit'
                    ? 'Maintain Loan–Collateral Relationship'
                    : isPreselectedFacility
                    ? 'Link Collateral Asset to Credit Facility'
                    : isPreselectedCollateral
                    ? 'Link Credit Facility to Collateral Asset'
                    : 'Create Loan–Collateral Relationship'}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  {isPreselectedFacility ? 'Direction 2: Facility → Collateral' : 'Direction 1: Collateral → Facility'}
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                {isPreselectedFacility && selectedFacility
                  ? `Pledging security for ${selectedFacility.facilityType} (${selectedFacility.loanReference}) belonging to ${selectedCustomer?.name || selectedFacility.customerId}`
                  : selectedCollateral
                  ? `Linking collateral ${selectedCollateral.code} (${selectedCollateral.type || selectedCollateral.category}) to authorized credit facilities`
                  : 'Establish authoritative security pledge with real-time exposure & DMS compliance verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loadingInitial ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading master relationships, facilities, and active collateral portfolio...
            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* ENTRY POINT 1: FACILITY-FIRST VIEW (Direction 2: Facility -> Col) */}
              {/* ============================================================== */}
              {isPreselectedFacility && selectedFacility && (
                <div className="space-y-4">
                  {/* FACILITY MASTER CARD */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Target Credit Facility Master Details
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {selectedFacility.facilityType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-slate-500">Line Code:</span>
                        <span className="px-2 py-0.5 rounded font-bold bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white">
                          {selectedFacility.lineCode || selectedFacility.id}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Primary Borrower:</span>
                        <strong className="text-slate-900 dark:text-white">
                          {selectedCustomer?.name || selectedFacility.customerId}{' '}
                          {selectedCustomer?.cif ? `(${selectedCustomer.cif})` : ''}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Loan Reference:</span>
                        <strong className="font-mono text-slate-900 dark:text-white">{selectedFacility.loanReference}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Operating Branch / Segment:</span>
                        <strong className="text-slate-900 dark:text-white">
                          {selectedFacility.branch} • {selectedFacility.segment}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Facility Currency:</span>
                        <strong className="text-blue-700 dark:text-blue-400 font-semibold">{selectedFacility.lineCurrency || 'ETB'}</strong>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[11px]">Approved Limit:</span>
                        <strong className="text-slate-900 dark:text-white font-bold tabular-nums">
                          ETB {formatEtbNumber(Number(selectedFacility.approvedLimit || 0))}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Outstanding Balance (Exposure):</span>
                        <strong className="text-amber-800 dark:text-amber-400 font-bold tabular-nums">
                          ETB {formatEtbNumber(Number(selectedFacility.outstandingBalance || 0))}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Pledged Collateral Contribution:</span>
                        <strong className="text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                          ETB {formatEtbNumber(Number(selectedFacility.collateralContribution || 0))}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Collateral Coverage %:</span>
                        <strong className="text-indigo-700 dark:text-indigo-400 font-bold">
                          {Number(selectedFacility.collateralPct || 0).toFixed(1)}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* CO-COLLATERALS ALREADY SECURING THIS LOAN FACILITY */}
                  {existingCoCollaterals.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          Existing Securities Pledged to this Facility ({existingCoCollaterals.length} Co-Collaterals)
                        </span>
                        <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                          Current Secured: ETB {formatEtbNumber(priorAllocatedToFacility)} ({((priorAllocatedToFacility / (facilityOutstandingExposure || 1)) * 100).toFixed(1)}% Coverage)
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        {existingCoCollaterals.map((cc) => (
                          <div key={cc.id} className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between shadow-2xs">
                            <div>
                              <div className="font-bold text-[#102E4A] dark:text-blue-300 font-mono text-[11px]">
                                {cc.collateralCode || cc.collateralId}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {cc.collateralType || 'Asset'} • {cc.linkageType || 'Primary'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold tabular-nums text-slate-900 dark:text-white text-[11px]">
                                ETB {formatEtbNumber(Number(cc.allocatedAmount || 0))}
                              </div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                {cc.facilityCoveragePct ? `${cc.facilityCoveragePct.toFixed(1)}% Loan Cov` : 'Active'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[11px] text-indigo-800 dark:text-indigo-300 flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                        <span>Deficit to Exactly 100% Loan Coverage:</span>
                        <strong className="font-mono text-indigo-900 dark:text-white">
                          ETB {formatEtbNumber(remainingNeededFor100PctCoverage)}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* CANDIDATE COLLATERALS TABLE */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Step 1: Select Collateral Asset to Pledge
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Borrower-owned assets, plus third-party assets with valid pledge prerequisites
                        </p>
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                        {filteredCandidateCollaterals.length} of {candidateCollaterals.length} Candidate Assets
                      </span>
                    </div>

                    {/* Filter Pills & Search */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] flex-wrap">
                      <span className="text-slate-500 px-1 font-medium">Filter:</span>
                      <button
                        type="button"
                        onClick={() => setCollateralStatusFilter('ALL')}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          collateralStatusFilter === 'ALL'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        All ({candidateCollaterals.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollateralStatusFilter('ELIGIBLE')}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          collateralStatusFilter === 'ELIGIBLE'
                            ? 'bg-emerald-600 text-white shadow-xs font-bold'
                            : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                        }`}
                      >
                        Borrower-Owned ({candidateCollaterals.filter((c) => c.eligible && !c.thirdParty).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollateralStatusFilter('REQUIRES_THIRD_PARTY_INFO')}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          collateralStatusFilter === 'REQUIRES_THIRD_PARTY_INFO'
                            ? 'bg-amber-600 text-white shadow-xs font-bold'
                            : 'text-amber-700 dark:text-amber-400 hover:text-amber-800'
                        }`}
                      >
                        Third-Party ({candidateCollaterals.filter((c) => c.thirdParty || c.candidateStatus === 'REQUIRES_THIRD_PARTY_INFO').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollateralStatusFilter('DUPLICATE')}
                        className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          collateralStatusFilter === 'DUPLICATE'
                            ? 'bg-slate-700 text-white shadow-xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Already Linked / Ineligible ({candidateCollaterals.filter((c) => c.alreadyLinked || !c.eligible).length})
                      </button>
                    </div>

                    {/* Search & Quick Dropdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={collateralSearchQuery}
                          onChange={(e) => setCollateralSearchQuery(e.target.value)}
                          placeholder="Search candidate collaterals by code, type, category, or legal owner..."
                          className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
                        />
                        {collateralSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setCollateralSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <select
                        value={selectedCollateralId}
                        onChange={(e) => {
                          const cid = e.target.value;
                          if (cid) handleSelectCollateral(cid);
                          else setSelectedCollateralId('');
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium"
                      >
                        <option value="">-- Quick Dropdown: Select Candidate Collateral ({filteredCandidateCollaterals.length}) --</option>
                        {filteredCandidateCollaterals.map((cand) => (
                          <option key={cand.id} value={cand.id} disabled={!cand.eligible}>
                            {cand.code} — {cand.type || cand.category} | Owner: {cand.legalOwnerNames || cand.customerName} | Avail: ETB {formatEtbNumber(Number(cand.availableCapacity || 0))} {!cand.eligible ? `(${cand.ineligibilityReason || 'Ineligible'})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selected Candidate Quick Action Banner */}
                    {selectedCollateral && (
                      <div className="p-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-slate-900 border-2 border-blue-400 dark:border-blue-600 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                Selected Collateral: <strong className="font-mono text-blue-700 dark:text-blue-300">{selectedCollateral.code}</strong>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                                {selectedCollateral.type || selectedCollateral.category}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>Owner: <strong>{selectedCollateral.owners?.[0]?.name || selectedCustomer?.name || 'Borrower'}</strong></span>
                              <span>NSV: <strong>ETB {formatEtbNumber(netCollateralValue)}</strong></span>
                              <span>Avail: <strong className="text-emerald-700 dark:text-emerald-400">ETB {formatEtbNumber(availableCollateralCapacity)}</strong></span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsCandidateListCollapsed(!isCandidateListCollapsed)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            {isCandidateListCollapsed ? `Show Candidates (${candidateCollaterals.length})` : 'Collapse Table'}
                          </button>
                          <button
                            type="button"
                            onClick={() => wizardContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                          >
                            <span>Open Linkage Wizard ↓</span>
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {loadingCandidates ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Evaluating collateral eligibility, ownership rules, and capacity limits...
                      </div>
                    ) : candidateCollateralsError ? (
                      <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-900 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Collateral Eligibility Evaluation Failed:</strong> {candidateCollateralsError}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCandidateReloadCounter((c) => c + 1)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:text-rose-200 rounded border border-rose-300 dark:border-rose-700 transition-colors shrink-0 ml-3"
                        >
                          Retry Evaluation
                        </button>
                      </div>
                    ) : candidateCollaterals.length === 0 ? (
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>No Candidate Collateral Records Found:</strong> No active collateral assets are registered
                          for borrower <strong>{selectedCustomer?.name || selectedFacility.customerId}</strong> or authorized third-party pledgors.
                        </div>
                      </div>
                    ) : isCandidateListCollapsed && selectedCollateral ? null : (
                      <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 scrollbar-thin">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#EFF5FB] dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                            <tr>
                              <th className="p-2.5">Collateral Asset</th>
                              <th className="p-2.5">Category &amp; Type</th>
                              <th className="p-2.5">Legal Owner &amp; Relationship</th>
                              <th className="p-2.5 text-right">Net Value (NSV)</th>
                              <th className="p-2.5 text-right">Available Capacity</th>
                              <th className="p-2.5 text-center">Eligibility Status</th>
                              <th className="p-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredCandidateCollaterals.map((cand) => {
                              const isSelected = selectedCollateralId === cand.id || selectedCollateralId === cand.code;
                              return (
                                <tr
                                  key={cand.id}
                                  className={`transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600'
                                      : cand.eligible
                                      ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                                      : 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50'
                                  }`}
                                  onClick={() => {
                                    if (cand.eligible) handleSelectCollateral(cand.id);
                                  }}
                                >
                                  <td className="p-2.5 font-semibold">
                                    <div className="flex items-center gap-1.5 font-mono text-[#102E4A] dark:text-blue-300">
                                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                      <span>{cand.code}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">{cand.id}</div>
                                  </td>
                                  <td className="p-2.5">
                                    <div className="font-medium text-slate-900 dark:text-white">{cand.type || cand.category}</div>
                                    <div className="text-[10px] text-slate-500">{cand.category}</div>
                                  </td>
                                  <td className="p-2.5">
                                    <div className="font-medium text-slate-900 dark:text-white">
                                      {cand.legalOwnerNames || cand.customerName || 'Borrower'}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                          cand.thirdParty
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                        }`}
                                      >
                                        {cand.thirdParty
                                          ? `Third-Party: ${cand.ownerRelationship || 'Guarantor'}`
                                          : 'Borrower-Owned'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-right tabular-nums font-semibold text-slate-900 dark:text-white">
                                    ETB {formatEtbNumber(Number(cand.netCollateralValue || 0))}
                                  </td>
                                  <td className="p-2.5 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                                    ETB {formatEtbNumber(Number(cand.availableCapacity || 0))}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    {cand.alreadyLinked ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                        Already Linked
                                      </span>
                                    ) : cand.eligible ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center justify-center gap-1 mx-auto w-fit">
                                        <CheckCircle className="w-3 h-3" /> Eligible
                                      </span>
                                    ) : (
                                      <span
                                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 inline-block"
                                        title={cand.ineligibilityReason}
                                      >
                                        Ineligible
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectCollateral(cand.id);
                                      }}
                                      disabled={!cand.eligible}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : cand.eligible
                                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                      }`}
                                    >
                                      {isSelected ? '✓ Selected' : cand.eligible ? 'Select' : 'Ineligible'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* ENTRY POINT 2: COLLATERAL-FIRST VIEW (Direction 1: Col -> Fac) */}
              {/* ============================================================== */}
              {!isPreselectedFacility && (
                <div className="space-y-4">
                  {/* Generic Customer/Collateral Selector if none preselected */}
                  {!isPreselectedCollateral && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Step 1: Primary Borrower / Customer
                        </label>
                        <select
                          value={selectedCustomerId}
                          onChange={(e) => {
                            setSelectedCustomerId(e.target.value);
                            setSelectedLoanAccountId('');
                            setSelectedCollateralId('');
                          }}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium"
                        >
                          <option value="">-- Select Customer --</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.cif}) — {c.segment}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Step 2: Pledged Collateral Asset
                        </label>
                        <select
                          value={selectedCollateralId}
                          onChange={(e) => setSelectedCollateralId(e.target.value)}
                          disabled={!selectedCustomerId}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium disabled:opacity-50"
                        >
                          <option value="">-- Select Collateral --</option>
                          {availableCollaterals.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} — {c.type || c.category} ({c.ownerType || 'Borrower-owned'}) — Val: ETB{' '}
                              {formatEtbNumber(c.valuationAmount || 0)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* COLLATERAL MASTER RECORD DETAILS CARD */}
                  {selectedCollateral && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Collateral Master Record Details
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              selectedCollateral.ownerType === 'Third-party-owned'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                            }`}
                          >
                            {selectedCollateral.ownerType || 'Borrower-owned'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-slate-500">Master Asset:</span>
                          <span className="px-2 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                            {selectedCollateral.code}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[11px]">Collateral ID / Code:</span>
                          <strong className="font-mono text-slate-900 dark:text-white">{selectedCollateral.code}</strong>
                          <span className="block text-[10px] text-slate-400 font-mono">({selectedCollateral.id})</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Registered Primary Debtor:</span>
                          <strong className="text-slate-900 dark:text-white">
                            {selectedCustomer?.name || selectedCollateral.customerId}{' '}
                            {selectedCustomer?.cif ? `(${selectedCustomer.cif})` : ''}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Category / Type:</span>
                          <strong className="text-slate-900 dark:text-white">
                            {selectedCollateral.category} • {selectedCollateral.type}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Legal Owner(s):</span>
                          <strong className="text-slate-900 dark:text-white">
                            {selectedCollateral.owners?.map((o) => o.name).filter(Boolean).join(', ') ||
                              selectedCustomer?.name ||
                              'Registered Debtor'}
                          </strong>
                        </div>

                        <div>
                          <span className="text-slate-500 block text-[11px]">Market Valuation:</span>
                          <strong className="text-slate-900 dark:text-white font-bold tabular-nums">
                            ETB {formatEtbNumber(Number(selectedCollateral.valuationAmount || 0))}
                          </strong>
                          <span className="block text-[10px] text-slate-400">Haircut: {selectedCollateral.haircut ?? 20}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Net Security Value (NSV):</span>
                          <strong className="text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                            ETB {formatEtbNumber(netCollateralValue)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Currently Allocated:</span>
                          <strong className="text-blue-700 dark:text-blue-400 font-bold tabular-nums">
                            ETB {formatEtbNumber((selectedCollateral.currentAllocation || 0))}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">Available Capacity:</span>
                          <strong className="text-indigo-700 dark:text-indigo-400 font-bold tabular-nums">
                            ETB {formatEtbNumber(Math.max(0, netCollateralValue - (selectedCollateral.currentAllocation || 0)))}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CANDIDATE FACILITIES TABLE (Section 35) */}
                  {selectedCollateral && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                            Candidate Credit Facilities (Section 35)
                          </label>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Search and select an eligible loan facility to secure with this collateral asset
                          </span>
                        </div>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {filteredCandidateFacilities.length} of {candidateFacilities.length} Candidate Facilities
                        </span>
                      </div>

                      {/* Filter Pills & Scope Selector */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Scope Selector */}
                        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
                          <span className="text-slate-500 font-medium px-1">Scope:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFacilityScope('owner_only');
                              setAllocationMode('borrower');
                              setTargetCustomerId('');
                              setSelectedLoanAccountId('');
                            }}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              facilityScope === 'owner_only'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                          >
                            Owner's Loans
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFacilityScope('all_bank');
                              setAllocationMode('cross_customer');
                              setSelectedLoanAccountId('');
                            }}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              facilityScope === 'all_bank'
                                ? 'bg-blue-600 text-white shadow-xs font-bold'
                                : 'text-slate-600 dark:text-slate-400 hover:text-blue-600'
                            }`}
                          >
                            ★ All Bank Facilities (Third-Party Pledge)
                          </button>
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
                          <button
                            type="button"
                            onClick={() => setFacilityStatusFilter('ALL')}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              facilityStatusFilter === 'ALL'
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            All ({candidateFacilities.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFacilityStatusFilter('ELIGIBLE')}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              facilityStatusFilter === 'ELIGIBLE'
                                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                            }`}
                          >
                            Eligible ({candidateFacilities.filter((f) => f.candidateStatus === 'ELIGIBLE').length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFacilityStatusFilter('REQUIRES_THIRD_PARTY_INFO')}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              facilityStatusFilter === 'REQUIRES_THIRD_PARTY_INFO'
                                ? 'bg-amber-600 text-white shadow-xs font-bold'
                                : 'text-amber-700 dark:text-amber-400 hover:text-amber-800'
                            }`}
                          >
                            Requires 3rd-Party ({candidateFacilities.filter((f) => f.candidateStatus === 'REQUIRES_THIRD_PARTY_INFO').length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setFacilityStatusFilter('DUPLICATE')}
                            className={`px-2 py-0.5 rounded font-medium transition-colors ${
                              facilityStatusFilter === 'DUPLICATE'
                                ? 'bg-slate-700 text-white shadow-xs font-bold'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Duplicate/Ineligible ({candidateFacilities.filter((f) => f.candidateStatus === 'DUPLICATE' || !f.eligible).length})
                          </button>
                        </div>
                      </div>

                      {/* Search Input & Quick Dropdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={facilitySearchQuery}
                            onChange={(e) => setFacilitySearchQuery(e.target.value)}
                            placeholder="Search facilities by loan reference, line code, type, borrower name or CIF..."
                            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
                          />
                          {facilitySearchQuery && (
                            <button
                              type="button"
                              onClick={() => setFacilitySearchQuery('')}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <select
                          value={selectedLoanAccountId}
                          onChange={(e) => {
                            const fid = e.target.value;
                            if (fid) handleSelectFacility(fid);
                            else setSelectedLoanAccountId('');
                          }}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium"
                        >
                          <option value="">-- Quick Dropdown: Select Candidate Facility ({filteredCandidateFacilities.length}) --</option>
                          {filteredCandidateFacilities.map((cand) => (
                            <option key={cand.id} value={cand.id} disabled={!cand.eligible}>
                              {cand.loanReference || cand.lineCode || cand.id} — {cand.facilityType} | Borrower: {cand.borrowerName || cand.customerId} | Out: ETB {formatEtbNumber(Number(cand.outstandingBalance || 0))} {!cand.eligible ? `(${cand.ineligibilityReason || 'Ineligible'})` : cand.thirdParty ? '[Requires 3rd-Party Info]' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Selected Facility Banner */}
                      {selectedFacility && (
                        <div className="p-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-slate-900 border-2 border-blue-400 dark:border-blue-600 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                              <CheckCircle className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  Selected Facility: <strong className="font-mono text-blue-700 dark:text-blue-300">{selectedFacility.loanReference || selectedFacility.lineCode}</strong>
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                                  {selectedFacility.facilityType}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                                <span>Borrower: <strong>{borrowerNameDisplay}</strong></span>
                                <span>Outstanding: <strong>ETB {formatEtbNumber(Number(selectedFacility.outstandingBalance || 0))}</strong></span>
                                <span>Approved Limit: <strong>ETB {formatEtbNumber(Number(selectedFacility.approvedLimit || 0))}</strong></span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setIsFacilityListCollapsed(!isFacilityListCollapsed)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                              {isFacilityListCollapsed ? `Show Facilities (${candidateFacilities.length})` : 'Collapse Table'}
                            </button>
                            <button
                              type="button"
                              onClick={() => wizardContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                            >
                              <span>Open Linkage Wizard ↓</span>
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Candidate Facilities Table (Section 35) */}
                      {loadingEligible ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Querying Core Banking credit facilities and evaluating candidate eligibility...
                        </div>
                      ) : eligibleFacilitiesError ? (
                        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-900 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <strong>Candidate Facility Evaluation Failed:</strong> {eligibleFacilitiesError}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEligibleReloadCounter((c) => c + 1)}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:text-rose-200 rounded border border-rose-300 dark:border-rose-700 transition-colors shrink-0 ml-3"
                          >
                            Retry Evaluation
                          </button>
                        </div>
                      ) : candidateFacilities.length === 0 ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>No Candidate Facilities Found:</strong> There are no credit facilities matching the selected criteria.
                          </div>
                        </div>
                      ) : isFacilityListCollapsed && selectedFacility ? null : (
                        <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 scrollbar-thin">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#EFF5FB] dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                              <tr>
                                <th className="p-2.5">Facility / Line Code</th>
                                <th className="p-2.5">Borrower (Name &amp; CIF)</th>
                                <th className="p-2.5">Type &amp; Balance</th>
                                <th className="p-2.5 text-center">Existing Collaterals</th>
                                <th className="p-2.5 text-center">Status &amp; Eligibility</th>
                                <th className="p-2.5 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {filteredCandidateFacilities.map((cand) => {
                                const isSelected = selectedLoanAccountId === cand.id || selectedLoanAccountId === cand.lineCode || selectedLoanAccountId === cand.loanReference;
                                const isEligible = cand.eligible;
                                return (
                                  <tr
                                    key={cand.id}
                                    className={`transition-colors ${
                                      isSelected
                                        ? 'bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-600'
                                        : isEligible
                                        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                                        : 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50'
                                    }`}
                                    onClick={() => {
                                      if (isEligible) handleSelectFacility(cand.id);
                                    }}
                                  >
                                    <td className="p-2.5 font-semibold">
                                      <div className="flex items-center gap-1.5 font-mono text-[#102E4A] dark:text-blue-300">
                                        <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                        <span>{cand.loanReference || cand.lineCode || cand.id}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        Line: {cand.lineCode || cand.id} • {cand.branch || 'Addis Ababa Main'}
                                      </div>
                                    </td>
                                    <td className="p-2.5">
                                      <div className="font-medium text-slate-900 dark:text-white">
                                        {cand.borrowerName || cand.customerId}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        CIF: {cand.borrowerCif || cand.customerId}
                                      </div>
                                    </td>
                                    <td className="p-2.5">
                                      <div className="font-semibold text-slate-900 dark:text-white">
                                        ETB {formatEtbNumber(Number(cand.outstandingBalance || 0))}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {cand.facilityType} • Limit: ETB {formatEtbNumber(Number(cand.approvedLimit || 0))}
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-center">
                                      {cand.linkedCollateralCount > 0 ? (
                                        <span
                                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300"
                                          title={cand.linkedCollateralCodes?.join(', ')}
                                        >
                                          {cand.linkedCollateralCount} Co-Securities
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400">0 Collaterals</span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      {cand.candidateStatus === 'DUPLICATE' ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                          Already Linked
                                        </span>
                                      ) : cand.candidateStatus === 'REQUIRES_THIRD_PARTY_INFO' ? (
                                        <span
                                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 flex items-center justify-center gap-1 mx-auto w-fit"
                                          title="Pledging this collateral asset for a different borrower requires third-party pledge information in Step 3"
                                        >
                                          <Users className="w-3 h-3" /> Requires 3rd-Party Info
                                        </span>
                                      ) : cand.candidateStatus === 'ELIGIBLE' ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center justify-center gap-1 mx-auto w-fit">
                                          <CheckCircle className="w-3 h-3" /> Eligible
                                        </span>
                                      ) : cand.candidateStatus === 'CAPACITY_EXCEEDED' ? (
                                        <span
                                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 inline-block"
                                          title={cand.ineligibilityReason}
                                        >
                                          Capacity Exceeded
                                        </span>
                                      ) : (
                                        <span
                                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 inline-block"
                                          title={cand.ineligibilityReason}
                                        >
                                          Ineligible Status ({cand.status})
                                        </span>
                                      )}
                                      {cand.ineligibilityReason && !isEligible && (
                                        <div className="text-[9px] text-red-500 mt-0.5 max-w-[140px] truncate mx-auto" title={cand.ineligibilityReason}>
                                          {cand.ineligibilityReason}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectFacility(cand.id);
                                        }}
                                        disabled={!isEligible}
                                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                                          isSelected
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : isEligible
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                        }`}
                                      >
                                        {isSelected ? '✓ Selected' : isEligible ? 'Select' : 'Ineligible'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* GUIDED 8-STEP LINKAGE WIZARD (Displayed when both are selected) */}
              {/* ============================================================== */}
              {selectedCollateral && selectedFacility && (
                <div ref={wizardContainerRef} className="space-y-4 pt-2">
                  {/* WIZARD NAVIGATION BAR */}
                  <div className="p-3 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-xl text-white border border-blue-800/40 shadow-sm space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black text-xs">
                          {wizardStep}
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                            Guided Loan–Collateral Linkage Workflow
                          </span>
                          <span className="text-[10px] text-slate-300 block">
                            Step {wizardStep} of 8: {getStepTitle(wizardStep)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white/10 p-0.5 rounded-lg text-[10px]">
                          <button
                            type="button"
                            onClick={() => setWizardViewMode('guided')}
                            className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                              wizardViewMode === 'guided' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Guided 8-Step
                          </button>
                          <button
                            type="button"
                            onClick={() => setWizardViewMode('full')}
                            className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                              wizardViewMode === 'full' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            Full View
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 8-Step Stepper Pills */}
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center text-[10px]">
                      {[
                        { num: 1, label: 'Context', desc: 'Entities' },
                        { num: 2, label: 'Degree Rank', desc: collateralRank === '2nd' ? '2nd-Degree' : '1st-Degree' },
                        { num: 3, label: '3rd-Party', desc: isThirdParty ? 'Required' : 'Borrower' },
                        { num: 4, label: 'Senior Debt', desc: collateralRank === '2nd' ? 'Required' : 'None' },
                        { num: 5, label: 'Allocation', desc: 'Limits & NSV' },
                        { num: 6, label: 'Documents', desc: 'DMS Evidence' },
                        { num: 7, label: 'Validation', desc: validationResult?.overallDecision || 'Checks' },
                        { num: 8, label: 'Review', desc: 'Maker-Checker' },
                      ].map((s) => {
                        const isActive = wizardStep === s.num;
                        const isPast = wizardStep > s.num;
                        return (
                          <button
                            key={s.num}
                            type="button"
                            onClick={() => setWizardStep(s.num)}
                            className={`p-1.5 rounded-lg border text-left transition-all ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-400/30 font-bold shadow-xs'
                                : isPast
                                ? 'bg-white/15 text-blue-100 border-white/20 hover:bg-white/25'
                                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[9px] opacity-75">{s.num}.</span>
                              {isPast ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : null}
                            </div>
                            <div className="font-bold truncate mt-0.5">{s.label}</div>
                            <div className="text-[9px] opacity-75 truncate">{s.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* STEP 1: RELATIONSHIP CONTEXT */}
                  {(wizardViewMode === 'full' || wizardStep === 1) && (
                    <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          Step 1: Relationship Context &amp; Entity Alignment
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">Read-Only Asset &amp; Credit Alignment</span>
                      </div>

                      {/* Arrangement Classification Banner */}
                      <div
                        className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                          isThirdParty
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                            : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isThirdParty ? (
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold flex items-center gap-2 uppercase tracking-wide text-[11px]">
                              {isThirdParty
                                ? 'Third-Party Collateral Pledge Arrangement'
                                : 'Direct Borrower-Owned Security'}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isThirdParty
                                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                                    : 'bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100'
                                }`}
                              >
                                {isThirdParty ? 'THIRD-PARTY PLEDGE' : 'BORROWER ASSET'}
                              </span>
                            </div>
                            <p className="text-[11px] opacity-90 mt-0.5">
                              {isThirdParty ? (
                                <>
                                  Collateral is legally owned by <strong>{legalOwnerNameDisplay}</strong> and pledged to secure credit facilities belonging to borrower <strong>{borrowerNameDisplay}</strong>. Formal third-party consent and pledge agreement are required in Step 3.
                                </>
                              ) : (
                                <>
                                  Asset legal owner matches credit facility borrower (<strong>{borrowerNameDisplay}</strong>). Customer isolation requirements satisfied.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Side-by-Side Context Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* LEFT: COLLATERAL LEGAL OWNERSHIP */}
                        <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
                            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-blue-600" />
                              Collateral Legal Ownership
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                isThirdParty
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              }`}
                            >
                              {selectedCollateral.ownerType || 'Borrower-owned'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[10px]">Legal Owner Name:</span>
                              <strong className="text-slate-900 dark:text-white block">{legalOwnerNameDisplay}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Owner CIF / ID:</span>
                              <strong className="font-mono text-slate-800 dark:text-slate-200">
                                {validationResult?.legalOwnerCif || selectedCollateral.customerId || '—'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Asset Category / Type:</span>
                              <strong className="text-slate-900 dark:text-white">
                                {selectedCollateral.category} • {selectedCollateral.type}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Net Value (NSV):</span>
                              <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                                ETB {formatEtbNumber(netCollateralValue)}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT: CREDIT FACILITY BORROWER */}
                        <div className="p-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5">
                            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                              Credit Facility Borrower
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                              {selectedFacility.facilityType || 'Credit Facility'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[10px]">Facility Borrower:</span>
                              <strong className="text-slate-900 dark:text-white block">{borrowerNameDisplay}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Borrower CIF / ID:</span>
                              <strong className="font-mono text-slate-800 dark:text-slate-200">
                                {validationResult?.borrowerCif || selectedFacility.customerId || '—'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Loan Reference / Line:</span>
                              <strong className="font-mono text-blue-700 dark:text-blue-400">
                                {selectedFacility.loanReference || selectedFacility.lineCode}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Outstanding Balance:</span>
                              <strong className="text-amber-800 dark:text-amber-400 font-mono">
                                ETB {formatEtbNumber(Number(selectedFacility.outstandingBalance || 0))}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Third-Party Notification Banner */}
                      {isThirdParty && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-semibold">Third-Party Collateral Pledge Detected:</strong>
                            <span>
                              This collateral is owned by <strong>{legalOwnerNameDisplay}</strong>{legalOwnerCifDisplay ? ` (CIF: ${legalOwnerCifDisplay})` : ''}. The selected facility belongs to <strong>{borrowerNameDisplay}</strong>{borrowerCifDisplay ? ` (CIF: ${borrowerCifDisplay})` : ''}. This linkage will therefore be treated as a third-party collateral pledge. <strong>The collateral's registered ownership will remain unchanged.</strong>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Co-Collaterals Summary */}
                      {existingCoCollaterals.length > 0 && (
                        <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-indigo-600" />
                              Other Securities Pledged to This Facility ({existingCoCollaterals.length} Co-Collaterals)
                            </span>
                            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                              Current Secured: ETB {formatEtbNumber(priorAllocatedToFacility)} ({((priorAllocatedToFacility / (facilityOutstandingExposure || 1)) * 100).toFixed(1)}% Coverage)
                            </span>
                          </div>
                          <div className="text-[11px] text-indigo-800 dark:text-indigo-300 flex items-center justify-between">
                            <span>Remaining Needed for Exact 100% Loan Coverage:</span>
                            <strong className="font-mono text-indigo-950 dark:text-white">
                              ETB {formatEtbNumber(remainingNeededFor100PctCoverage)}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 2: SECURITY DEGREE & CHARGE PRIORITY */}
                  {(wizardViewMode === 'full' || wizardStep === 2) && (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/20 dark:bg-slate-800/40 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                      <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-800 pb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          Step 2: Security Arrangement (Charge Priority &amp; Collateral Degree)
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          collateralRank === '2nd'
                            ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-900/60 dark:text-purple-200'
                            : 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/60 dark:text-blue-200'
                        }`}>
                          {collateralRank === '2nd' ? 'Subordinate 2nd-Degree' : 'Senior 1st-Degree'}
                        </span>
                      </div>

                      {/* Rank Selection Buttons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCollateralRank('1st')}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                            collateralRank !== '2nd'
                              ? 'bg-white dark:bg-slate-800 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                              : 'bg-white/60 dark:bg-slate-850 border-slate-200 dark:border-slate-700 hover:bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="modalCollateralRank"
                            checked={collateralRank !== '2nd'}
                            onChange={() => setCollateralRank('1st')}
                            className="mt-0.5 text-blue-600"
                          />
                          <div>
                            <strong className="block text-xs text-slate-900 dark:text-white">1st-Degree (Primary Charge)</strong>
                            <span className="text-[11px] text-slate-500">Dashen Bank holds senior first-ranking mortgage over this asset. No prior debt deductions apply.</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCollateralRank('2nd')}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                            collateralRank === '2nd'
                              ? 'bg-white dark:bg-slate-800 border-purple-600 ring-2 ring-purple-500/20 shadow-xs'
                              : 'bg-white/60 dark:bg-slate-850 border-slate-200 dark:border-slate-700 hover:bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="modalCollateralRank"
                            checked={collateralRank === '2nd'}
                            onChange={() => setCollateralRank('2nd')}
                            className="mt-0.5 text-purple-600"
                          />
                          <div>
                            <strong className="block text-xs text-slate-900 dark:text-white">2nd-Degree (Subordinate Charge)</strong>
                            <span className="text-[11px] text-slate-500">Subordinate to prior 1st-degree charge (internal or external). Available capacity is reduced by senior debt.</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: THIRD-PARTY ARRANGEMENT */}
                  {(wizardViewMode === 'full' || wizardStep === 3) && (
                    <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-800/80 pb-2">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-amber-600" />
                          Step 3: Third-Party Collateral Context &amp; Legal Relationship
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isThirdParty
                              ? 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          }`}
                        >
                          {isThirdParty ? 'THIRD-PARTY PLEDGE' : 'BORROWER-OWNED (N/A)'}
                        </span>
                      </div>

                      {!isThirdParty ? (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Direct Borrower-Owned Security: Legal asset owner matches credit facility borrower (<strong>{borrowerNameDisplay}</strong>). Third-party pledge documentation is not required.</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Third-Party Notification Banner */}
                          <div className="p-3 bg-amber-100/70 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                            <div className="flex items-center gap-2 font-bold text-xs text-amber-950 dark:text-amber-100 uppercase tracking-wide">
                              <Info className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Third-Party Collateral Pledge Workflow</span>
                            </div>
                            <p>
                              This collateral is owned by <strong>{legalOwnerNameDisplay}</strong>{legalOwnerCifDisplay ? ` (CIF: ${legalOwnerCifDisplay})` : ''}. The selected facility belongs to <strong>{borrowerNameDisplay}</strong>{borrowerCifDisplay ? ` (CIF: ${borrowerCifDisplay})` : ''}. This linkage will therefore be treated as a third-party collateral pledge. <strong>The collateral's registered ownership will remain unchanged.</strong>
                            </p>
                          </div>

                          {/* Read-Only Ownership & Borrower Context Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Collateral Legal Owner (Read-Only)</span>
                              <div className="font-semibold text-slate-900 dark:text-white">{legalOwnerNameDisplay}</div>
                              <div className="text-[11px] text-slate-500 font-mono">CIF / ID: {legalOwnerCifDisplay || '—'}</div>
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Source: Existing collateral registration (Unchanged)</div>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Facility Borrower (Read-Only)</span>
                              <div className="font-semibold text-slate-900 dark:text-white">{borrowerNameDisplay}</div>
                              <div className="text-[11px] text-slate-500 font-mono">CIF / ID: {borrowerCifDisplay || selectedFacility?.customerId || '—'}</div>
                              <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Source: Selected loan facility ({selectedFacility?.loanReference || selectedFacility?.lineCode})</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1">
                                Legal Relationship to Borrower * (US-04.4)
                              </label>
                              <select
                                value={relationshipToBorrower}
                                onChange={(e) => setRelationshipToBorrower(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white font-medium"
                              >
                                <option value="Shareholder">Shareholder</option>
                                <option value="Parent Company">Parent Company</option>
                                <option value="Director">Director</option>
                                <option value="Guarantor">Guarantor</option>
                                <option value="Spouse">Spouse</option>
                                <option value="Family Member">Family Member</option>
                                <option value="Business Partner">Business Partner</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1">
                                Formal Pledge Agreement Reference *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. PLG-AGR-2024-001"
                                value={pledgeAgreementRef}
                                onChange={(e) => setPledgeAgreementRef(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white font-mono"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1">
                                Written Consent &amp; Verification Notes
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Written Consent on file / Board resolution signed"
                                value={consentInfo}
                                onChange={(e) => setConsentInfo(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>

                          <div className="p-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg text-xs flex items-center justify-between">
                            <span className="text-amber-900 dark:text-amber-300 font-medium">Single Master Collateral Record Pledged as Third-Party Security</span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                              NO DUPLICATE ASSET CREATED
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 4: FIRST-DEGREE INFORMATION (SENIOR CHARGE) */}
                  {(wizardViewMode === 'full' || wizardStep === 4) && (
                    <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-purple-200/80 dark:border-purple-800/80 pb-2">
                        <span className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-purple-600" />
                          Step 4: Prior 1st-Degree Senior Charge Information
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            collateralRank === '2nd'
                              ? 'bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-100'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          }`}
                        >
                          {collateralRank === '2nd' ? '2ND-DEGREE CHARGE' : '1ST-DEGREE (N/A)'}
                        </span>
                      </div>

                      {collateralRank !== '2nd' ? (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Senior 1st-Degree Security: Dashen Bank holds senior first-ranking charge over this collateral. No senior charge deductions apply.</span>
                        </div>
                      ) : (
                        <div className="space-y-3 text-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-purple-100 dark:border-purple-800">
                            <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wide">
                              Prior 1st-Degree Charge Source
                            </span>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                                <input
                                  type="radio"
                                  name="modalIsInternalStep"
                                  checked={isFirstDegreeInternal}
                                  onChange={() => {
                                    setIsFirstDegreeInternal(true);
                                    setFirstDegreeHolderName('Dashen Bank S.C.');
                                  }}
                                />
                                <span>Internal (Dashen Bank)</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                                <input
                                  type="radio"
                                  name="modalIsInternalStep"
                                  checked={!isFirstDegreeInternal}
                                  onChange={() => {
                                    setIsFirstDegreeInternal(false);
                                    setFirstDegreeHolderName('');
                                    setFirstDegreeCollateralId('');
                                  }}
                                />
                                <span>External (Other Bank)</span>
                              </label>
                            </div>
                          </div>

                          {isFirstDegreeInternal ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  Select Internal 1st-Degree Collateral
                                </label>
                                <select
                                  value={firstDegreeCollateralId}
                                  onChange={(e) => {
                                    const cId = e.target.value;
                                    setFirstDegreeCollateralId(cId);
                                    const parent = collaterals.find((c) => c.id === cId || c.code === cId);
                                    if (parent) {
                                      setFirstDegreeHolderName('Dashen Bank S.C.');
                                      setFirstDegreeFacilityRef(parent.code);
                                      setFirstDegreeOutstandingBalance(parent.currentAllocation || parent.valuationAmount || 0);
                                      setFirstDegreeBalanceAsOfDate(new Date().toISOString().substring(0, 10));
                                      setRegisteredMortgageAmount(parent.valuationAmount || 0);
                                    }
                                  }}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                >
                                  <option value="">-- Choose Existing 1st-Degree Collateral --</option>
                                  {collaterals
                                    .filter((c) => c.collateralRank !== '2nd' && c.id !== selectedCollateral.id)
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.code} — {c.description || c.category} (Value: ETB {formatEtbNumber(c.valuationAmount)})
                                      </option>
                                    ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  1st-Degree Outstanding Debt (ETB)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={firstDegreeOutstandingBalance ?? ''}
                                  onChange={(e) => setFirstDegreeOutstandingBalance(e.target.value === '' ? undefined : Number(e.target.value))}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded font-bold font-mono bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                  placeholder="Auto-retrieved from CBS"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                    1st-Degree Holder Name *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. External Financial Institution"
                                    value={firstDegreeHolderName}
                                    onChange={(e) => setFirstDegreeHolderName(e.target.value)}
                                    className="w-full p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                    Facility Reference *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. EXT-LN-2024-001"
                                    value={firstDegreeFacilityRef}
                                    onChange={(e) => setFirstDegreeFacilityRef(e.target.value)}
                                    className="w-full p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                    1st-Degree Outstanding Balance (ETB) *
                                  </label>
                                  <AmountInput
                                    value={firstDegreeOutstandingBalance}
                                    onChange={(val) => setFirstDegreeOutstandingBalance(val)}
                                    placeholder="Enter amount"
                                    required
                                    className="py-1 px-2 text-xs"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                    Cadastral / Mortgage Reg No *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. CAD-MORT-88192"
                                    value={mortgageRegistrationNumber}
                                    onChange={(e) => setMortgageRegistrationNumber(e.target.value)}
                                    className="w-full p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                    Registered Mortgage Amount (ETB)
                                  </label>
                                  <AmountInput
                                    value={registeredMortgageAmount}
                                    onChange={(val) => setRegisteredMortgageAmount(val)}
                                    placeholder="Enter amount"
                                    className="py-1 px-2 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                                    Balance As-Of Date
                                  </label>
                                  <input
                                    type="date"
                                    value={firstDegreeBalanceAsOfDate}
                                    onChange={(e) => setFirstDegreeBalanceAsOfDate(e.target.value)}
                                    className="w-full p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="checkbox"
                                  id="modalBankNotedStep"
                                  checked={bankNotedAsSecondMortgagee}
                                  onChange={(e) => setBankNotedAsSecondMortgagee(e.target.checked)}
                                  className="rounded text-indigo-600"
                                />
                                <label htmlFor="modalBankNotedStep" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                  Bank officially noted as Second Mortgagee on Cadastral Registry
                                </label>
                              </div>
                            </div>
                          )}

                          {/* Rule 2.5 Ceiling Banner */}
                          <div className={`p-2.5 rounded-lg border text-xs ${
                            isSecondDegreeCeilingExceeded
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                              : 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                          }`}>
                            <div className="flex items-center justify-between font-bold pb-1 border-b border-black/10">
                              <span>Rule 2.5: 2nd-Degree Available Security Assessment</span>
                              <span className="font-mono">
                                Max Capacity Ceiling: ETB {formatEtbNumber(Math.max(0, netCollateralValue - priorChargeDeduction))}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                              <div>
                                <span className="text-slate-500 block text-[10px]">Net Collateral Value:</span>
                                <strong>ETB {formatEtbNumber(netCollateralValue)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">Less 1st-Degree Debt:</span>
                                <strong className="text-red-600">- ETB {formatEtbNumber(priorChargeDeduction)}</strong>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px]">Net Available for 2nd Degree:</span>
                                <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                                  ETB {formatEtbNumber(availableCollateralCapacity)}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 5: FINANCIAL CAPACITY & ALLOCATION PARAMETERS */}
                  {(wizardViewMode === 'full' || wizardStep === 5) && (
                    <div ref={allocationFormRef} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-blue-600" />
                          Step 5: Collateral Capacity, Allocation Limits &amp; Parameters
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {selectedCollateral.code} ↔ {selectedFacility.loanReference || selectedFacility.lineCode}
                        </span>
                      </div>

                      {/* 4-CARD FINANCIAL METRICS GRID */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Net Collateral Value (NSV)
                          </span>
                          <strong className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums block">
                            ETB {formatEtbNumber(netCollateralValue)}
                          </strong>
                          <span className="text-[10px] text-slate-400">
                            Haircut: {selectedCollateral.haircut ?? 20}%
                          </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Active Allocations
                          </span>
                          <strong className="text-sm font-bold text-slate-900 dark:text-white tabular-nums block">
                            ETB {formatEtbNumber((validationResult?.currentActiveAllocations ?? selectedCollateral.currentAllocation ?? 0))}
                          </strong>
                          <span className="text-[10px] text-slate-400">Prior facility pledges</span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Available Capacity
                          </span>
                          <strong className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums block">
                            ETB {formatEtbNumber(availableCollateralCapacity)}
                          </strong>
                          <span className="text-[10px] text-slate-400">
                            {collateralRank === '2nd' ? '2nd-degree ceiling' : 'NSV ceiling'}
                          </span>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                            Projected Remaining
                          </span>
                          <strong
                            className={`text-sm font-bold tabular-nums block ${
                              remainingCapacity > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'
                            }`}
                          >
                            ETB {formatEtbNumber(remainingCapacity)}
                          </strong>
                          <span className="text-[10px] text-slate-400">After proposed allocation</span>
                        </div>
                      </div>

                      {/* ALLOCATION OVERFLOW WARNING BANNER */}
                      {validationResult?.excessAllocationAmount && validationResult.excessAllocationAmount > 0 ? (
                        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5">
                          <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold uppercase tracking-wider text-[11px]">
                              Allocation Capacity Overflow Detected
                            </div>
                            <p className="mt-0.5">
                              Proposed allocation of <strong>ETB {formatEtbNumber(allocatedAmount)}</strong> results in total allocations exceeding Net Security Value by{' '}
                              <strong>ETB {formatEtbNumber(validationResult.excessAllocationAmount)} excess</strong>.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {/* FORM INPUTS */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="sm:col-span-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Allocated Security Amount (ETB) *
                            </label>
                            {/* QUICK PRESET PILLS */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setAllocatedAmount(recommended100PctAllocation)}
                                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                              >
                                🎯 100% Loan Coverage
                              </button>
                              <button
                                type="button"
                                onClick={() => setAllocatedAmount(availableCollateralCapacity)}
                                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                              >
                                🛡️ Max Capacity
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const half = Math.min(
                                    availableCollateralCapacity,
                                    Math.round(facilityOutstandingExposure * 0.5 * 100) / 100
                                  );
                                  setAllocatedAmount(half);
                                }}
                                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
                              >
                                50% Loan
                              </button>
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              max={netCollateralValue}
                              value={allocatedAmount !== undefined && allocatedAmount !== null ? allocatedAmount : ''}
                              onChange={(e) => setAllocatedAmount(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                              placeholder="e.g. 5000000.00"
                              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-mono font-bold"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setAllocatedAmount(availableCollateralCapacity)}
                              className="absolute right-2 top-1.5 px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                            >
                              Max Cap
                            </button>
                          </div>

                          {/* DUAL LIVE METERS */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                            {/* 1. COLLATERAL ALLOCATION METER */}
                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Collateral Allocated:</span>
                                <strong className={`font-mono ${collateralAllocationPct > 100 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                  {collateralAllocationPct.toFixed(1)}% of NSV
                                </strong>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    collateralAllocationPct > 100
                                      ? 'bg-red-600'
                                      : collateralAllocationPct > 80
                                      ? 'bg-amber-500'
                                      : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${Math.min(100, collateralAllocationPct)}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-slate-400">
                                ETB {formatEtbNumber(allocatedAmount)} of ETB {formatEtbNumber(netCollateralValue)}
                              </div>
                            </div>

                            {/* 2. FACILITY COVERAGE METER */}
                            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">Loan Coverage:</span>
                                <strong
                                  className={`font-mono ${
                                    totalFacilityCoveragePct >= 100
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-amber-600'
                                  }`}
                                >
                                  {totalFacilityCoveragePct.toFixed(1)}% of Balance
                                </strong>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    totalFacilityCoveragePct >= 100
                                      ? 'bg-emerald-500'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, totalFacilityCoveragePct)}%` }}
                                />
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Total Secured: ETB {formatEtbNumber(totalFacilityAllocatedWithProposed)} of ETB {formatEtbNumber(facilityOutstandingExposure)}
                              </div>
                            </div>
                          </div>

                          {/* COVERAGE OVER-100% ALERT & 1-CLICK AUTO-CAP */}
                          {isFacilityCoverageOver100 && (
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-start gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-bold text-[11px]">
                                    Facility Collateral Coverage Exceeds 100% ({totalFacilityCoveragePct.toFixed(1)}%)
                                  </div>
                                  <span className="text-[10px] text-amber-800 dark:text-amber-300">
                                    Total secured exceeds the loan balance by ETB {formatEtbNumber((totalFacilityAllocatedWithProposed - facilityOutstandingExposure))}.
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setAllocatedAmount(recommended100PctAllocation)}
                                className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-[11px] transition-colors"
                              >
                                Auto-Cap to 100% (ETB {formatEtbNumber(recommended100PctAllocation)})
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Linkage Type *
                          </label>
                          <select
                            value={linkageType}
                            onChange={(e) => setLinkageType(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium"
                          >
                            <option value="Primary">Primary</option>
                            <option value="Secondary">Secondary</option>
                            <option value="Cross-Collateral">Cross-Collateral</option>
                            <option value="Tertiary">Tertiary</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Effective Date *
                          </label>
                          <input
                            type="date"
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            End Date (Optional)
                          </label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Utilization Order
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={utilOrder !== undefined && utilOrder !== null ? utilOrder : ''}
                            onChange={(e) => setUtilOrder(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                            Change Reason / Audit Justification {mode === 'edit' && '*'}
                          </label>
                          <textarea
                            rows={2}
                            value={changeReason}
                            onChange={(e) => setChangeReason(e.target.value)}
                            placeholder={
                              mode === 'edit'
                                ? 'Mandatory: Explain the reason for adjusting the collateral allocation or relationship terms.'
                                : 'Optional justification note for relationship link auditing.'
                            }
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                            required={mode === 'edit'}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 6: DOCUMENTS & DMS EVIDENCE CHECKLIST */}
                  {(wizardViewMode === 'full' || wizardStep === 6) && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                          Step 6: Documents &amp; DMS Evidence Compliance Checklist
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {validationResult?.requiredDocuments?.length || 3} Required Documents
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#EFF5FB] dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                            <tr>
                              <th className="p-2.5">Document Type</th>
                              <th className="p-2.5">Applicability &amp; Regulatory Purpose</th>
                              <th className="p-2.5">Document Reference</th>
                              <th className="p-2.5 text-center">DMS Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            <tr>
                              <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                                Title Deed / Ownership Certificate
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                Mandatory proof of unencumbered legal title in legal owner's name
                              </td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                                {selectedCollateral.titleDeedNumber || selectedCollateral.registrationNumber || 'DMS-DEED-RECORDED'}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                  ✓ Verified in DMS
                                </span>
                              </td>
                            </tr>

                            <tr>
                              <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                                Professional Valuation Report
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                Approved valuation report supporting Net Security Value (ETB {formatEtbNumber(netCollateralValue)})
                              </td>
                              <td className="p-2.5 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                                {selectedCollateral.valuationDate ? `VAL-REP-${selectedCollateral.valuationDate}` : 'VAL-REP-CURRENT'}
                              </td>
                              <td className="p-2.5 text-center">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                  ✓ Verified in DMS
                                </span>
                              </td>
                            </tr>

                            {isThirdParty && (
                              <>
                                <tr>
                                  <td className="p-2.5 font-semibold text-amber-900 dark:text-amber-300">
                                    Third-Party Pledge Agreement *
                                  </td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                    Legally binding pledge agreement signed by {legalOwnerNameDisplay} in favor of borrower {borrowerNameDisplay}
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px] text-blue-700 dark:text-blue-300 font-bold">
                                    {pledgeAgreementRef || 'PLG-AGR-CIMS-VERIFIED'}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      pledgeAgreementRef
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                    }`}>
                                      {pledgeAgreementRef ? '✓ Documented' : 'Pending in Step 3'}
                                    </span>
                                  </td>
                                </tr>

                                <tr>
                                  <td className="p-2.5 font-semibold text-amber-900 dark:text-amber-300">
                                    Written Owner Consent / Board Resolution *
                                  </td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                    Documented consent and authority to hypothecate asset as security
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px] text-blue-700 dark:text-blue-300">
                                    {consentInfo || 'CONSENT-VERIFIED-ON-FILE'}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                      ✓ Verified on File
                                    </span>
                                  </td>
                                </tr>
                              </>
                            )}

                            {collateralRank === '2nd' && (
                              <>
                                <tr>
                                  <td className="p-2.5 font-semibold text-purple-900 dark:text-purple-300">
                                    1st-Degree Confirmation / No-Objection Letter *
                                  </td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                    Written confirmation of outstanding balance from senior charge holder ({firstDegreeHolderName || 'Dashen Bank'})
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px] text-purple-700 dark:text-purple-300 font-bold">
                                    {firstDegreeConfirmationDocId || (firstDegreeFacilityRef ? `CONF-${firstDegreeFacilityRef}` : 'CONF-PENDING')}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      firstDegreeOutstandingBalance ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      {firstDegreeOutstandingBalance ? '✓ Balance Confirmed' : 'Required in Step 4'}
                                    </span>
                                  </td>
                                </tr>

                                <tr>
                                  <td className="p-2.5 font-semibold text-purple-900 dark:text-purple-300">
                                    Cadastral Extract / Land Registry Deed *
                                  </td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                    Official extract noting mortgage registration ({mortgageRegistrationNumber || 'Registration Pending'})
                                  </td>
                                  <td className="p-2.5 font-mono text-[11px] text-purple-700 dark:text-purple-300 font-bold">
                                    {mortgageRegistrationNumber || 'CAD-MORT-PENDING'}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      mortgageRegistrationNumber ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      {mortgageRegistrationNumber ? '✓ Cadastral Recorded' : 'Required in Step 4'}
                                    </span>
                                  </td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* STEP 7: AUTHORITATIVE BACKEND PRE-VALIDATION */}
                  {(wizardViewMode === 'full' || wizardStep === 7) && validationResult && (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          Step 7: Authoritative Backend Pre-Validation Diagnostics
                          {validating && <span className="text-[10px] text-blue-500 animate-pulse">(re-checking...)</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                              validationResult.overallDecision === 'CAN_PROCEED' || validationResult.canProceed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                : validationResult.overallDecision === 'REQUIRES_CORRECTION'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                            }`}
                          >
                            {validationResult.overallDecision === 'CAN_PROCEED' || validationResult.canProceed ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5" /> CAN PROCEED
                              </>
                            ) : validationResult.overallDecision === 'REQUIRES_CORRECTION' ? (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" /> REQUIRES CORRECTION
                              </>
                            ) : (
                              <>
                                <AlertOctagon className="w-3.5 h-3.5" /> BLOCKED (HARD STOP)
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {validationResult.summaryMessage && (
                        <div
                          className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                            validationResult.canProceed
                              ? 'bg-emerald-50/60 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'bg-red-50/60 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                          }`}
                        >
                          <Info className="w-4 h-4 shrink-0" />
                          <span>{validationResult.summaryMessage}</span>
                        </div>
                      )}

                      {/* STRUCTURED CHECKS TABLE WITH SEVERITY PILLS */}
                      <div className="space-y-1.5 pt-1">
                        {validationResult.checks.map((c, i) => {
                          const severity = c.severity || (!c.passed ? 'HARD_STOP' : 'INFO');
                          return (
                            <div
                              key={i}
                              className={`p-2.5 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2 ${
                                c.passed
                                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40'
                                  : severity === 'HARD_STOP'
                                  ? 'bg-red-50/70 dark:bg-red-950/40 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-900/60'
                                  : 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-900/60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-bold text-sm shrink-0">{c.passed ? '✓' : '✕'}</span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {c.ruleName || c.checkName || c.ruleKey}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                      {c.category}
                                    </span>
                                  </div>
                                  <div className="text-[11px] mt-0.5 opacity-90">{c.message}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                                    severity === 'HARD_STOP'
                                      ? 'bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100'
                                      : severity === 'WARNING'
                                      ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                                      : 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                                  }`}
                                >
                                  {severity === 'HARD_STOP' ? 'HARD STOP' : severity}
                                </span>
                                {!c.passed && c.overrideable && (
                                  <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                                    Overrideable
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* STEP 8: FINAL REVIEW & SUBMIT FOR MAKER-CHECKER */}
                  {(wizardViewMode === 'full' || wizardStep === 8) && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          Step 8: Final Review &amp; Maker-Checker Submission
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                          Dual Control Required
                        </span>
                      </div>

                      {/* COMPREHENSIVE REVIEW SUMMARY CARD */}
                      <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Collateral Asset:</span>
                            <strong className="font-mono text-blue-700 dark:text-blue-300 text-sm block">
                              {selectedCollateral.code}
                            </strong>
                            <span className="text-[10px] text-slate-400">{selectedCollateral.type || selectedCollateral.category}</span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Credit Facility:</span>
                            <strong className="font-mono text-slate-900 dark:text-white text-sm block">
                              {selectedFacility.loanReference || selectedFacility.lineCode}
                            </strong>
                            <span className="text-[10px] text-slate-400">{selectedFacility.facilityType}</span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Charge Degree Rank:</span>
                            <strong className={`text-sm block ${collateralRank === '2nd' ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'}`}>
                              {collateralRank === '2nd' ? '2nd-Degree (Subordinate)' : '1st-Degree (Senior)'}
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              {collateralRank === '2nd' ? (isFirstDegreeInternal ? 'Internal Senior Debt' : 'External Senior Debt') : 'Primary Charge'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Ownership Arrangement:</span>
                            <strong className={`text-sm block ${isThirdParty ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
                              {isThirdParty ? `Third-Party (${relationshipToBorrower})` : 'Direct Borrower'}
                            </strong>
                            <span className="text-[10px] text-slate-400">Owner: {legalOwnerNameDisplay}</span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Net Collateral Value:</span>
                            <strong className="font-mono text-slate-900 dark:text-white">
                              ETB {formatEtbNumber(netCollateralValue)}
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Allocated Security:</span>
                            <strong className="font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                              ETB {formatEtbNumber(allocatedAmount)}
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Facility Coverage %:</span>
                            <strong className="font-mono text-indigo-700 dark:text-indigo-400">
                              {totalFacilityCoveragePct.toFixed(1)}% of Exposure
                            </strong>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Linkage Type:</span>
                            <strong className="text-slate-900 dark:text-white">
                              {linkageType} (Order: {utilOrder})
                            </strong>
                          </div>
                        </div>

                        {/* Maker-Checker Workflow Callout */}
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                          <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Maker-Checker Dual Control Note:</strong>
                            <p className="mt-0.5 text-[11px] opacity-90">
                              Initiated by Maker: <strong>{currentUser?.username || currentUser?.userId || 'CRO_OFFICER'}</strong>. Upon submission, this relationship link will enter <strong>"Pending Approval"</strong> status and be dispatched to the Credit Administration Checker queue. Pledged capacity is concurrency-locked until authorization.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Stepper Navigation Footer & Action Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>

              {selectedCollateral && selectedFacility && wizardViewMode === 'guided' && (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                  disabled={wizardStep === 1 || submitting}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedCollateral && selectedFacility && wizardViewMode === 'guided' && wizardStep < 8 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => Math.min(8, s + 1))}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5 transition-colors"
                >
                  <span>Next Step ({wizardStep + 1} of 8)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    loadingInitial ||
                    !selectedLoanAccountId ||
                    !selectedCollateralId ||
                    allocatedAmount <= 0 ||
                    (validationResult !== null && !validationResult.canProceed)
                  }
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <Send className="w-3.5 h-3.5" />
                  {mode === 'edit'
                    ? 'Update Relationship'
                    : 'Submit for Checker Authorization'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
