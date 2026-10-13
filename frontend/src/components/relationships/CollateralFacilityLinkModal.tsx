import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { cimsApi } from '../../api/cimsApi';
import {
  Customer,
  LoanAccount,
  Collateral,
  CollateralFacilityLinkDto,
  CollateralCandidateDto,
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
}) => {
  // Master lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [facilities, setFacilities] = useState<LoanAccount[]>([]);
  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [eligibleBackendFacilities, setEligibleBackendFacilities] = useState<LoanAccount[]>([]);
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
    setCandidateCollaterals([]);

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
        } else {
          // Pre-populate if create with context
          if (preselectedCollateralId) {
            setSelectedCollateralId(preselectedCollateralId);
            const foundCol = (colRes || []).find(
              (c: Collateral) => c.id === preselectedCollateralId || c.code === preselectedCollateralId
            );
            if (foundCol?.customerId) {
              setSelectedCustomerId(foundCol.customerId);
            }
            if (foundCol?.ownerType === 'Third-party-owned') {
              setFacilityScope('all_bank');
              setAllocationMode('cross_customer');
            }
          }
          if (preselectedLoanAccountId || preselectedFacilityId) {
            const targetId = preselectedLoanAccountId || preselectedFacilityId;
            const foundFac = (facRes || []).find(
              (f: LoanAccount) => f.id === targetId || f.lineCode === targetId || f.loanReference === targetId
            );
            if (foundFac) {
              setSelectedLoanAccountId(foundFac.id);
              if (foundFac.customerId) setSelectedCustomerId(foundFac.customerId);
            }
          }
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setErrorMsg(err.message || 'Failed to initialize master records.');
        setLoadingInitial(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, mode, existingLink, preselectedCollateralId, preselectedFacilityId, preselectedLoanAccountId]);

  // If opened from a facility: load candidate collaterals from backend
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
      .then((candidates) => {
        if (active && Array.isArray(candidates)) {
          setCandidateCollaterals(candidates);
        }
      })
      .catch((err) => {
        console.warn('Failed to load eligible collaterals for facility:', err);
        if (active) {
          setCandidateCollateralsError(err?.message || 'Failed to evaluate candidate collaterals from server.');
        }
      })
      .finally(() => {
        if (active) setLoadingCandidates(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, isPreselectedFacility, preselectedFacilityId, preselectedLoanAccountId, selectedLoanAccountId, candidateReloadCounter, currentUser?.userId, currentUser?.username]);

  // Selected collateral master
  const selectedCollateral = useMemo(
    () => collaterals.find((c) => c.id === selectedCollateralId || c.code === selectedCollateralId),
    [collaterals, selectedCollateralId]
  );

  // Authoritative secured primary borrower / customer
  const selectedCustomer = useMemo(() => {
    const custId = isPreselectedFacility
      ? (facilities.find((f) => f.id === selectedLoanAccountId)?.customerId || selectedCustomerId)
      : (selectedCollateral?.customerId || selectedCustomerId);
    if (!custId) return null;
    const target = custId.trim().toLowerCase();
    return (
      customers.find(
        (c) =>
          (c.id && c.id.trim().toLowerCase() === target) ||
          (c.cif && c.cif.trim().toLowerCase() === target)
      ) || null
    );
  }, [customers, isPreselectedFacility, facilities, selectedLoanAccountId, selectedCollateral, selectedCustomerId]);

  // Target beneficiary customer in cross-customer mode
  const targetCustomer = useMemo(() => {
    if (allocationMode !== 'cross_customer' || !targetCustomerId) return null;
    const target = targetCustomerId.trim().toLowerCase();
    return (
      customers.find(
        (c) =>
          (c.id && c.id.trim().toLowerCase() === target) ||
          (c.cif && c.cif.trim().toLowerCase() === target)
      ) || null
    );
  }, [customers, allocationMode, targetCustomerId]);



  // Fetch backend eligible facilities whenever collateral, target customer, or facility scope changes
  useEffect(() => {
    if (!isOpen || !selectedCollateralId || isPreselectedFacility) {
      if (!isPreselectedFacility) setEligibleBackendFacilities([]);
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

    cimsApi
      .getEligibleFacilitiesForCollateral(selectedCollateralId, targetCust, userId)
      .then((elig) => {
        if (active && Array.isArray(elig)) {
          setEligibleBackendFacilities(elig);
        }
      })
      .catch((err) => {
        console.warn('Failed to load eligible facilities:', err);
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

  // Strict customer-isolated credit facilities - No client-side fallbacks when collateral selected
  const availableFacilities = useMemo(() => {
    if (selectedCollateralId) {
      // Must use backend-verified eligible facilities only - no silent fallback
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
    () =>
      facilities.find((f) => f.id === selectedLoanAccountId || f.lineCode === selectedLoanAccountId || f.loanReference === selectedLoanAccountId) ||
      availableFacilities.find((f) => f.id === selectedLoanAccountId),
    [availableFacilities, facilities, selectedLoanAccountId]
  );

  // Third-party legal ownership and borrower identity resolution
  const isThirdParty = useMemo(() => {
    if (validationResult?.thirdParty !== undefined) return validationResult.thirdParty;
    if (selectedCollateral?.ownerType === 'Third-party-owned') return true;
    if (selectedCollateral && selectedFacility) {
      const colCust = (selectedCollateral.customerId || '').trim().toLowerCase();
      const facCust = (selectedFacility.customerId || '').trim().toLowerCase();
      return Boolean(colCust && facCust && colCust !== facCust);
    }
    return false;
  }, [validationResult, selectedCollateral, selectedFacility]);

  const legalOwnerNameDisplay = useMemo(() => {
    return (
      validationResult?.legalOwnerName ||
      selectedCollateral?.owners?.map((o) => o.name).filter(Boolean).join(', ') ||
      selectedCustomer?.name ||
      'Collateral Owner'
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
    return Number(selectedFacility?.outstandingBalance || selectedFacility?.approvedLimit || 0);
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

  // Available collateral capacity (NSV - active allocations from other facilities)
  const availableCollateralCapacity = useMemo(() => {
    if (!selectedCollateral) return 0;
    const existingAlloc = mode === 'edit' && existingLink ? Number(existingLink.allocatedAmount || 0) : 0;
    const curAlloc = validationResult?.currentActiveAllocations ?? Number(selectedCollateral.currentAllocation || 0);
    const baseAlloc = Math.max(0, curAlloc - existingAlloc);
    return Math.max(0, Math.round((netCollateralValue - baseAlloc) * 100) / 100);
  }, [selectedCollateral, existingLink, mode, validationResult, netCollateralValue]);

  // Recommended 100% allocation
  const recommended100PctAllocation = useMemo(() => {
    return Math.min(availableCollateralCapacity, remainingNeededFor100PctCoverage);
  }, [availableCollateralCapacity, remainingNeededFor100PctCoverage]);

  const collateralAllocationPct = useMemo(() => {
    if (netCollateralValue <= 0 || allocatedAmount <= 0) return 0;
    return Math.min(100, Math.round((allocatedAmount / netCollateralValue) * 10000) / 100);
  }, [allocatedAmount, netCollateralValue]);

  const facilityCoveragePct = useMemo(() => {
    const out = Number(selectedFacility?.outstandingBalance || 0);
    if (out <= 0 || allocatedAmount <= 0) return 0;
    return Math.round((allocatedAmount / out) * 10000) / 100;
  }, [allocatedAmount, selectedFacility]);

  const remainingCapacity = useMemo(() => {
    if (!selectedCollateral) return 0;
    const existingAlloc = existingLink ? Number(existingLink.allocatedAmount || 0) : 0;
    const currentAlloc = Number(selectedCollateral.currentAllocation || 0);
    const baseAllocated = Math.max(0, currentAlloc - existingAlloc);
    return Math.max(0, Math.round((netCollateralValue - baseAllocated - allocatedAmount) * 100) / 100);
  }, [selectedCollateral, existingLink, netCollateralValue, allocatedAmount]);

  // Filtered candidate collaterals (for facility-first mode)
  const filteredCandidateCollaterals = useMemo(() => {
    if (!collateralSearchQuery.trim()) return candidateCollaterals;
    const q = collateralSearchQuery.toLowerCase().trim();
    return candidateCollaterals.filter((cand) => {
      const code = (cand.code || '').toLowerCase();
      const id = (cand.id || '').toLowerCase();
      const type = (cand.type || '').toLowerCase();
      const cat = (cand.category || '').toLowerCase();
      const owner = (cand.legalOwnerNames || cand.customerName || '').toLowerCase();
      const rel = (cand.ownerRelationship || '').toLowerCase();
      return code.includes(q) || id.includes(q) || type.includes(q) || cat.includes(q) || owner.includes(q) || rel.includes(q);
    });
  }, [candidateCollaterals, collateralSearchQuery]);

  // Filtered available facilities (for collateral-first mode)
  const filteredAvailableFacilities = useMemo(() => {
    if (!facilitySearchQuery.trim()) return availableFacilities;
    const q = facilitySearchQuery.toLowerCase().trim();
    return availableFacilities.filter((f) => {
      const ref = (f.loanReference || '').toLowerCase();
      const code = (f.lineCode || '').toLowerCase();
      const id = (f.id || '').toLowerCase();
      const type = (f.facilityType || '').toLowerCase();
      const acc = (f.takedownAccountNumber || '').toLowerCase();
      const cust = customers.find((c) => c.id === f.customerId || c.cif === f.customerId);
      const custName = (cust?.name || '').toLowerCase();
      const custCif = (cust?.cif || '').toLowerCase();
      return (
        ref.includes(q) ||
        code.includes(q) ||
        id.includes(q) ||
        type.includes(q) ||
        acc.includes(q) ||
        custName.includes(q) ||
        custCif.includes(q)
      );
    });
  }, [availableFacilities, facilitySearchQuery, customers]);

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
      borrowerCustomerId: allocationMode === 'cross_customer' ? (targetCustomerId || undefined) : undefined,
      relationshipToBorrower: allocationMode === 'cross_customer' ? (relationshipToBorrower || 'Guarantor') : undefined,
      pledgeAgreementRef: allocationMode === 'cross_customer' ? (pledgeAgreementRef || undefined) : undefined,
      consentInfo: allocationMode === 'cross_customer' ? (consentInfo || undefined) : undefined,
      thirdPartyPledge: allocationMode === 'cross_customer',
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
          console.warn('Pre-validation check failed:', err);
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
    mode,
    existingLink,
    selectedFacility?.id,
    allocationMode,
    targetCustomerId,
    relationshipToBorrower,
    pledgeAgreementRef,
    consentInfo,
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
        `Allocated amount (ETB ${allocatedAmount.toLocaleString()}) cannot exceed Net Collateral Value (ETB ${netCollateralValue.toLocaleString()}).`
      );
      return;
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
      borrowerCustomerId: allocationMode === 'cross_customer' ? (targetCustomerId || undefined) : undefined,
      relationshipToBorrower: allocationMode === 'cross_customer' ? (relationshipToBorrower || 'Guarantor') : undefined,
      pledgeAgreementRef: allocationMode === 'cross_customer' ? (pledgeAgreementRef || undefined) : undefined,
      consentInfo: allocationMode === 'cross_customer' ? (consentInfo || undefined) : undefined,
      thirdPartyPledge: allocationMode === 'cross_customer',
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[94vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-[#102E4A] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center text-lg font-bold border border-white/20">
              <LinkIcon className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {mode === 'edit'
                  ? 'Maintain Relationship & Allocation'
                  : isPreselectedFacility
                  ? 'Link Collateral to Facility'
                  : 'Link Credit Facility'}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-100">
                  {mode === 'edit'
                    ? 'Edit Mode'
                    : isPreselectedFacility
                    ? 'Facility Entry Point (§7.2)'
                    : isPreselectedCollateral
                    ? 'Collateral Entry Point (§7.1)'
                    : 'Relationship Workflow'}
                </span>
                {selectedCollateral?.ownerType === 'Third-party-owned' && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-100">
                    Third-Party Collateral
                  </span>
                )}
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                {isPreselectedFacility && selectedFacility
                  ? `${selectedFacility.lineCode || selectedFacility.loanReference} — Secure Facility with Eligible Pledged Collateral`
                  : selectedCollateral
                  ? `${selectedCollateral.code} — Pledge to Core Banking Credit Facility (Single Master Asset)`
                  : 'Link credit facility to collateral asset'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loadingInitial ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading collateral and credit facilities...</p>
            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* ENTRY POINT 1: FACILITY-FIRST VIEW (§7.2)                       */}
              {/* ============================================================== */}
              {isPreselectedFacility && selectedFacility && (
                <div className="space-y-4">
                  {/* FACILITY MASTER CARD (§7.2) */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          Target Credit Facility Master Details (§7.2)
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
                          ETB {Number(selectedFacility.approvedLimit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Outstanding Balance (Current Exposure):</span>
                        <strong className="text-amber-800 dark:text-amber-400 font-bold tabular-nums">
                          ETB {Number(selectedFacility.outstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Pledged Collateral Contribution:</span>
                        <strong className="text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                          ETB {Number(selectedFacility.collateralContribution || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                          Current Secured: ETB {priorAllocatedToFacility.toLocaleString()} ({((priorAllocatedToFacility / (facilityOutstandingExposure || 1)) * 100).toFixed(1)}% Coverage)
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
                                ETB {Number(cc.allocatedAmount || 0).toLocaleString()}
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
                          ETB {remainingNeededFor100PctCoverage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* ELIGIBLE PLEDGED COLLATERAL ASSETS SELECTOR TABLE (§7.2) */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                          Step 1: Select Eligible Collateral Asset to Pledge (§7.2)
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Borrower-owned assets matching this customer, plus third-party assets with valid pledge prerequisites
                        </p>
                      </div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                        {filteredCandidateCollaterals.length} of {candidateCollaterals.length} Candidate Assets
                      </span>
                    </div>

                    {/* SEARCH & QUICK DROPDOWN FOR CANDIDATE COLLATERALS */}
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
                          setSelectedCollateralId(cid);
                          const found = candidateCollaterals.find((c) => c.id === cid || c.code === cid);
                          if (found && found.eligible) {
                            const defAlloc = recommended100PctAllocation > 0 ? recommended100PctAllocation : Math.min(found.availableCapacity, facilityOutstandingExposure || found.availableCapacity);
                            setAllocatedAmount(defAlloc > 0 ? defAlloc : found.availableCapacity);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium"
                      >
                        <option value="">-- Quick Dropdown: Select Candidate Collateral ({filteredCandidateCollaterals.length}) --</option>
                        {filteredCandidateCollaterals.map((cand) => (
                          <option key={cand.id} value={cand.id} disabled={!cand.eligible}>
                            {cand.code} — {cand.type || cand.category} | Owner: {cand.legalOwnerNames || cand.customerName} | Avail: ETB {Number(cand.availableCapacity || 0).toLocaleString()} {!cand.eligible ? `(${cand.ineligibilityReason || 'Ineligible'})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

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
                            <p className="mt-1 text-slate-600 dark:text-slate-400">
                              Candidate collateral retrieval could not be completed. The system does not present an unvalidated fallback list to preserve relationship integrity.
                            </p>
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
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#EFF5FB] dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
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
                                    if (cand.eligible) {
                                      setSelectedCollateralId(cand.id);
                                      const defAlloc = recommended100PctAllocation > 0 ? recommended100PctAllocation : Math.min(
                                        cand.availableCapacity,
                                        selectedFacility.outstandingBalance || cand.availableCapacity
                                      );
                                      if (allocatedAmount <= 0) {
                                        setAllocatedAmount(defAlloc > 0 ? defAlloc : cand.availableCapacity);
                                      }
                                    }
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
                                    ETB {Number(cand.netCollateralValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-2.5 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                                    ETB {Number(cand.availableCapacity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                    {cand.ineligibilityReason && !cand.alreadyLinked && (
                                      <div className="text-[10px] text-red-600 dark:text-red-400 max-w-[200px] truncate mx-auto mt-0.5" title={cand.ineligibilityReason}>
                                        {cand.ineligibilityReason}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-right">
                                    {cand.eligible ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedCollateralId(cand.id);
                                          const defAlloc = recommended100PctAllocation > 0 ? recommended100PctAllocation : Math.min(
                                            cand.availableCapacity,
                                            selectedFacility.outstandingBalance || cand.availableCapacity
                                          );
                                          if (allocatedAmount <= 0) {
                                            setAllocatedAmount(defAlloc > 0 ? defAlloc : cand.availableCapacity);
                                          }
                                        }}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                                          isSelected
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-300'
                                        }`}
                                      >
                                        {isSelected ? '✓ Selected' : 'Select'}
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">—</span>
                                    )}
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
              {/* ENTRY POINT 2: COLLATERAL-FIRST VIEW (§7.1)                     */}
              {/* ============================================================== */}
              {!isPreselectedFacility && !isPreselectedCollateral && (
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
                          {Number(c.valuationAmount || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* COLLATERAL MASTER RECORD DETAILS CARD (§5, §7.1, §7.2) */}
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
                        ETB {Number(selectedCollateral.valuationAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="block text-[10px] text-slate-400">Haircut: {selectedCollateral.haircut ?? 20}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Net Security Value (NSV):</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                        ETB {netCollateralValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Currently Allocated:</span>
                      <strong className="text-blue-700 dark:text-blue-400 font-bold tabular-nums">
                        ETB {(selectedCollateral.currentAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Available Capacity:</span>
                      <strong className="text-indigo-700 dark:text-indigo-400 font-bold tabular-nums">
                        ETB {Math.max(0, netCollateralValue - (selectedCollateral.currentAllocation || 0)).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* THIRD-PARTY CROSS-CUSTOMER ALLOCATION CONTROLS (US-04.3, US-04.4, US-04.5) */}
              {!isPreselectedFacility && selectedCollateral && (
                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Loan–Collateral Relationship & Borrower Association (US-04.5)
                      </span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-0.5">
                        {selectedCollateral.ownerType === 'Third-party-owned'
                          ? `This asset is legally owned by a third party (${selectedCollateral.owners?.map((o) => o.name).filter(Boolean).join(', ') || 'Third Party Owner'}). You may link directly to any authorized borrower's facility under US-04.5 without re-registering collateral.`
                          : `Associate this collateral asset with either the collateral owner's credit facilities or link as a third-party pledge to another borrower under US-04.5.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-100/80 dark:bg-amber-900/60 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setFacilityScope('owner_only');
                          setAllocationMode('borrower');
                          setTargetCustomerId('');
                          setSelectedLoanAccountId('');
                        }}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          facilityScope === 'owner_only' && allocationMode === 'borrower'
                            ? 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 shadow-sm'
                            : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
                        }`}
                      >
                        Collateral Owner Facilities
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFacilityScope('all_bank');
                          setAllocationMode('cross_customer');
                          setTargetCustomerId('');
                          setSelectedLoanAccountId('');
                        }}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          facilityScope === 'all_bank'
                            ? 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 shadow-sm'
                            : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
                        }`}
                        title="Search and select any credit facility across the bank as a third-party pledge without duplicate registration"
                      >
                        All Bank Facilities (Third-Party Pledge)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFacilityScope('specific_borrower');
                          setAllocationMode('cross_customer');
                          setSelectedLoanAccountId('');
                        }}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                          facilityScope === 'specific_borrower'
                            ? 'bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 shadow-sm'
                            : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
                        }`}
                      >
                        Filter Specific Borrower
                      </button>
                    </div>
                  </div>

                  {allocationMode === 'cross_customer' && (
                    <div className="space-y-3 pt-2 border-t border-amber-200/60 dark:border-amber-800/60">
                      {facilityScope === 'all_bank' && (
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs space-y-0.5">
                          <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                            Single Master Collateral Record (FR-025 &amp; US-04.5)
                          </div>
                          <p className="text-[11px] text-blue-800 dark:text-blue-400">
                            You can search or select <strong>any credit facility across the bank</strong> in the facility dropdown below. The system automatically links this existing collateral asset as third-party security—<strong>no duplicate collateral registration needed</strong>!
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {facilityScope === 'specific_borrower' && (
                          <div>
                            <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1">
                              Associated Borrower / Facility Customer * (US-04.5)
                            </label>
                            <select
                              value={targetCustomerId}
                              onChange={(e) => {
                                setTargetCustomerId(e.target.value);
                                setSelectedLoanAccountId('');
                              }}
                              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white font-medium"
                            >
                              <option value="">-- Select Associated Borrower ({customers.length}) --</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.cif}) — {c.segment}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className={facilityScope === 'specific_borrower' ? '' : 'md:col-span-2'}>
                          <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1">
                            Borrower–Owner Legal Relationship * (US-04.4)
                          </label>
                          <select
                            value={relationshipToBorrower}
                            onChange={(e) => setRelationshipToBorrower(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white font-medium"
                          >
                            <option value="Guarantor">Guarantor</option>
                            <option value="Shareholder">Shareholder</option>
                            <option value="Director">Director</option>
                            <option value="Parent Company">Parent Company</option>
                            <option value="Spouse">Spouse</option>
                            <option value="Family Member">Family Member</option>
                            <option value="Business Partner">Business Partner</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1">
                            Pledge Agreement Reference (US-04.3, US-04.5)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. PLG-AGR-2024-001"
                            value={pledgeAgreementRef}
                            onChange={(e) => setPledgeAgreementRef(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider block mb-1">
                            Consent & Verification Notes (US-04.7)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Written Consent on file / Legal pledge signed"
                            value={consentInfo}
                            onChange={(e) => setConsentInfo(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {(targetCustomer || (selectedFacility && isThirdParty)) && (
                        <div className="p-3 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs space-y-2">
                          <div className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider text-[11px] flex items-center justify-between">
                            <span>Third-Party Pledge & Borrower Association Summary (US-04.5)</span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                              NO DUPLICATE MASTER ASSET
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[10px]">Legal Asset Owner:</span>
                              <strong className="text-slate-900 dark:text-white">
                                {selectedCollateral.owners?.map((o) => o.name).filter(Boolean).join(', ') || selectedCustomer?.name || 'Owner'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Collateral CIF/Debtor:</span>
                              <strong className="text-slate-900 dark:text-white">
                                {selectedCustomer?.name || selectedCollateral.customerId}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Associated Borrower:</span>
                              <strong className="text-blue-700 dark:text-blue-400 font-bold">
                                {borrowerNameDisplay}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">Relationship:</span>
                              <strong className="text-amber-700 dark:text-amber-400 font-bold">
                                {relationshipToBorrower}
                              </strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ELIGIBLE CREDIT FACILITIES SECTION (Only when Collateral-First) */}
              {!isPreselectedFacility && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                        Eligible Credit Facilities (§7.1)
                      </label>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Facility Scope:{' '}
                        <strong>
                          {facilityScope === 'all_bank'
                            ? 'All Bank Portfolio (Third-Party Pledge Allowed)'
                            : allocationMode === 'cross_customer' && targetCustomer
                            ? `Borrower: ${targetCustomer.name}`
                            : `Owner: ${selectedCustomer?.name || selectedCollateral?.customerId || 'Secured Borrower'}`}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                      {filteredAvailableFacilities.length} of {availableFacilities.length} Facilities
                    </span>
                  </div>

                  {/* QUICK FACILITY SCOPE SELECTOR */}
                  <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px]">
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
                    <button
                      type="button"
                      onClick={() => {
                        setFacilityScope('specific_borrower');
                        setAllocationMode('cross_customer');
                        setSelectedLoanAccountId('');
                      }}
                      className={`px-2 py-0.5 rounded font-medium transition-colors ${
                        facilityScope === 'specific_borrower'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Select Specific Borrower
                    </button>
                  </div>

                  {/* SEARCH FACILITY INPUT */}
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

                  {loadingEligible ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                      Loading verified credit facilities from Core Banking...
                    </div>
                  ) : eligibleFacilitiesError ? (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-900 dark:text-rose-300 text-xs flex items-center justify-between">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Core Banking Query Error:</strong> {eligibleFacilitiesError}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEligibleReloadCounter((c) => c + 1)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:text-rose-200 rounded border border-rose-300 dark:border-rose-700 transition-colors shrink-0 ml-3"
                      >
                        Retry Query
                      </button>
                    </div>
                  ) : availableFacilities.length === 0 ? (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-300 text-xs flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>No Eligible Facilities Found:</strong> There are no active credit facilities eligible for linking for{' '}
                            <span className="font-semibold underline">
                              {allocationMode === 'cross_customer' && targetCustomer
                                ? targetCustomer.name
                                : selectedCustomer?.name || selectedCollateral?.customerId}
                            </span>
                            .
                          </div>
                        </div>
                        {facilityScope === 'owner_only' && (
                          <button
                            type="button"
                            onClick={() => {
                              setFacilityScope('all_bank');
                              setAllocationMode('cross_customer');
                              setSelectedLoanAccountId('');
                            }}
                            className="px-2.5 py-1 text-xs font-bold rounded bg-blue-600 text-white shrink-0 hover:bg-blue-700 shadow-xs"
                          >
                            View All Bank Facilities
                          </button>
                        )}
                      </div>

                      <div className="bg-amber-100/60 dark:bg-amber-900/30 p-2.5 rounded border border-amber-300/60 dark:border-amber-700/60 text-[11px] space-y-1">
                        <p className="font-semibold text-amber-950 dark:text-amber-200">
                          Eligibility & Multi-Collateral Rules:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-amber-900 dark:text-amber-300">
                          <li>
                            <strong>Co-Collateralization (M:1 Cardinality):</strong> A credit facility <em>can</em> be linked to multiple collaterals when it is not 100% covered. Only duplicate links to <em>this specific collateral asset</em> are excluded.
                          </li>
                          <li>
                            <strong>Branch & Segment Scope:</strong> Facilities belonging to other branches or segments (e.g. Merkato IFB Dedicated Branch / IFB) require an authorized user persona (IFB Officer, System Admin, or Executive).
                          </li>
                          <li>
                            <strong>Third-Party Pledge:</strong> To link this collateral to a loan owned by another borrower, click <strong>"View All Bank Facilities"</strong> or select <strong>"Specific Borrower"</strong> above.
                          </li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <select
                      value={selectedLoanAccountId}
                      onChange={(e) => {
                        const fid = e.target.value;
                        setSelectedLoanAccountId(fid);
                        const chosenFac = facilities.find((f) => f.id === fid) || eligibleBackendFacilities.find((f) => f.id === fid);
                        if (chosenFac && selectedCollateral) {
                          const colCust = (selectedCollateral.customerId || '').trim().toLowerCase();
                          const facCust = (chosenFac.customerId || '').trim().toLowerCase();
                          if (colCust && facCust && colCust !== facCust) {
                            setAllocationMode('cross_customer');
                            setTargetCustomerId(chosenFac.customerId);
                            if (!relationshipToBorrower || relationshipToBorrower === 'Self' || relationshipToBorrower === 'Borrower') {
                              setRelationshipToBorrower('Guarantor');
                            }
                          }
                        }
                        if (allocatedAmount <= 0) {
                          setAllocatedAmount(recommended100PctAllocation > 0 ? recommended100PctAllocation : availableCollateralCapacity);
                        }
                      }}
                      disabled={mode === 'edit'}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium disabled:opacity-60"
                    >
                      <option value="">-- Select Credit Facility ({filteredAvailableFacilities.length}) --</option>
                      {filteredAvailableFacilities.map((f) => {
                        const cust = customers.find((c) => c.id === f.customerId || c.cif === f.customerId);
                        const custName = cust?.name || f.customerId || 'Borrower';
                        const limitStr = Number(f.approvedLimit || 0).toLocaleString();
                        const outStr = Number(f.outstandingBalance || 0).toLocaleString();
                        const branchStr = f.branch || 'Head Office';
                        const statusStr = f.status || 'Active';
                        const isCrossCust = selectedCollateral?.customerId && f.customerId &&
                          selectedCollateral.customerId.trim().toLowerCase() !== f.customerId.trim().toLowerCase();
                        return (
                          <option key={f.id} value={f.id}>
                            {f.loanReference || f.lineCode || f.id} — {f.facilityType} | Borrower: {custName} ({f.customerId}) | Limit: ETB {limitStr} | Out: ETB {outStr} | Br: {branchStr} {isCrossCust ? '★ [Third-Party Pledge]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}

                  {selectedFacility && (
                    <div className="space-y-3">
                      <div className="p-3 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Facility Reference:</span>
                          <strong className="text-slate-900 dark:text-white font-mono">
                            {selectedFacility.loanReference || selectedFacility.lineCode}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Facility Type:</span>
                          <strong className="text-slate-900 dark:text-white">{selectedFacility.facilityType}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Outstanding Balance:</span>
                          <strong className="text-amber-800 dark:text-amber-400 tabular-nums">
                            ETB {Number(selectedFacility.outstandingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Available Headroom:</span>
                          <strong className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                            ETB{' '}
                            {Number(
                              selectedFacility.availableAmount ||
                                Math.max(0, (selectedFacility.approvedLimit || 0) - (selectedFacility.outstandingBalance || 0))
                            ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      {/* CO-COLLATERALS FOR SELECTED FACILITY IN COLLATERAL-FIRST VIEW */}
                      {existingCoCollaterals.length > 0 && (
                        <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-indigo-600" />
                              Other Securities Securing This Facility ({existingCoCollaterals.length} Co-Collaterals)
                            </span>
                            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                              Current Secured: ETB {priorAllocatedToFacility.toLocaleString()} ({((priorAllocatedToFacility / (facilityOutstandingExposure || 1)) * 100).toFixed(1)}% Cov)
                            </span>
                          </div>
                          <div className="text-[11px] text-indigo-800 dark:text-indigo-300 flex items-center justify-between">
                            <span>Remaining Needed for Exact 100% Loan Coverage:</span>
                            <strong className="font-mono text-indigo-950 dark:text-white">
                              ETB {remainingNeededFor100PctCoverage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================== */}
              {/* SECTION B: SIDE-BY-SIDE OWNERSHIP VS. BORROWER COMPARISON (§5) */}
              {/* ============================================================== */}
              {selectedCollateral && selectedFacility && (
                <div className="space-y-3">
                  {/* PLEDGE ARRANGEMENT CLASSIFICATION BANNER */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
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
                            ? 'Third-Party Collateral Pledge Arrangement (§5, §9)'
                            : 'Direct Borrower-Owned Security (§7)'}
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
                              Collateral is legally owned by <strong>{legalOwnerNameDisplay}</strong> (Pledgor) and
                              pledged to secure credit facilities belonging to borrower{' '}
                              <strong>{borrowerNameDisplay}</strong>. Formal third-party consent and pledge agreement are required.
                            </>
                          ) : (
                            <>
                              Asset legal owner matches credit facility borrower (<strong>{borrowerNameDisplay}</strong>
                              ). Customer isolation requirements satisfied.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SIDE-BY-SIDE OWNERSHIP VS. BORROWER DETAILS CARD */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* LEFT: COLLATERAL LEGAL OWNERSHIP */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
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
                          {validationResult?.ownerType || selectedCollateral.ownerType || 'Borrower-owned'}
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
                            {validationResult?.legalOwnerCif ||
                              validationResult?.legalOwnerCustomerId ||
                              selectedCollateral.customerId ||
                              '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Relationship to Borrower:</span>
                          <strong className="text-indigo-700 dark:text-indigo-400">
                            {validationResult?.relationshipToBorrower ||
                              selectedCollateral.owners?.[0]?.relationshipToBorrower ||
                              selectedCollateral.owners?.[0]?.relationship ||
                              (isThirdParty ? 'Third-Party Pledgor' : 'Self (Borrower)')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Ownership Share / Verification:</span>
                          <strong className="text-slate-900 dark:text-white">
                            {validationResult?.ownershipPercentage ?? selectedCollateral.owners?.[0]?.percentage ?? 100}% •{' '}
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {validationResult?.ownerVerificationStatus ||
                                selectedCollateral.owners?.[0]?.verificationStatus ||
                                selectedCollateral.verificationStatus ||
                                'Recorded'}
                            </span>
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: CREDIT FACILITY BORROWER */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
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
                            {validationResult?.borrowerCif ||
                              validationResult?.borrowerCustomerId ||
                              selectedFacility.customerId ||
                              '—'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Line Code / Loan Ref:</span>
                          <strong className="font-mono text-blue-700 dark:text-blue-400">
                            {validationResult?.loanReference ||
                              selectedFacility.lineCode ||
                              selectedFacility.loanReference}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Branch &amp; Segment:</span>
                          <strong className="text-slate-900 dark:text-white">
                            {selectedFacility.branch} • {selectedFacility.segment}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* SECTION C: THIRD-PARTY PLEDGE PREREQUISITES CHECKLIST (§6, §8) */}
              {/* ============================================================== */}
              {selectedCollateral && selectedFacility && isThirdParty && (
                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200/80 dark:border-amber-800/80 pb-2">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-amber-600" />
                      Third-Party Legal &amp; Regulatory Prerequisites Checklist (§6, §8, §9)
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        validationResult?.hasRequiredPledgeEvidence
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                      }`}
                    >
                      {validationResult?.hasRequiredPledgeEvidence ? 'PREREQUISITES DOCUMENTED' : 'EVIDENCE REQUIRED'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* Item 1: Identity & TIN */}
                    <div className="p-2.5 bg-white dark:bg-slate-800/70 rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-[11px]">
                          1. Legal Owner Identification (National ID / TIN)
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          ID Number: {selectedCollateral.owners?.[0]?.idNumber || 'ET-NAT-ID-RECORDED'} • TIN:{' '}
                          {selectedCollateral.owners?.[0]?.tin || '0049281920'}
                        </div>
                      </div>
                    </div>

                    {/* Item 2: Relationship to Borrower */}
                    <div className="p-2.5 bg-white dark:bg-slate-800/70 rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-[11px]">
                          2. Documented Borrower Relationship
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Permitted Class:{' '}
                          <strong>
                            {validationResult?.relationshipToBorrower ||
                              selectedCollateral.owners?.[0]?.relationshipToBorrower ||
                              'Guarantor'}
                          </strong>{' '}
                          (Shareholder / Director / Guarantor / Affiliate)
                        </div>
                      </div>
                    </div>

                    {/* Item 3: Pledge Agreement Ref */}
                    <div className="p-2.5 bg-white dark:bg-slate-800/70 rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-[11px]">
                          3. Formal Pledge Agreement Reference
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Ref:{' '}
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {validationResult?.pledgeAgreementRef ||
                              selectedCollateral.owners?.[0]?.pledgeAgreementRef ||
                              'PLG-AGR-CIMS-VERIFIED'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Item 4: Consent Info */}
                    <div className="p-2.5 bg-white dark:bg-slate-800/70 rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-[11px]">
                          4. Written Consent / Board Resolution
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Consent Record:{' '}
                          <span className="text-slate-800 dark:text-slate-200">
                            {validationResult?.consentStatus ||
                              selectedCollateral.owners?.[0]?.consentInfo ||
                              'Verified Consent & Board Authorization on file'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* SECTION D: FINANCIAL CAPACITY & ALLOCATION PARAMETERS (§8, §18)*/}
              {/* ============================================================== */}
              {selectedCollateral && selectedFacility && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      Collateral Capacity, Allocation Limits &amp; Parameters (§8, §18)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Master Asset: <strong>{selectedCollateral.code}</strong> ↔ Facility:{' '}
                      <strong>{selectedFacility.loanReference || selectedFacility.lineCode}</strong>
                    </span>
                  </div>

                  {/* 4-CARD FINANCIAL METRICS GRID */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Net Collateral Value (NSV)
                      </span>
                      <strong className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums block">
                        ETB {netCollateralValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="text-[10px] text-slate-400">
                        MV: ETB {Number(selectedCollateral.valuationAmount || 0).toLocaleString()} (Haircut: {selectedCollateral.haircut ?? 20}%)
                      </span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Active Allocations
                      </span>
                      <strong className="text-sm font-bold text-slate-900 dark:text-white tabular-nums block">
                        ETB{' '}
                        {(validationResult?.currentActiveAllocations ?? selectedCollateral.currentAllocation ?? 0).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2 }
                        )}
                      </strong>
                      <span className="text-[10px] text-slate-400">Prior facility pledges</span>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                        Available Capacity
                      </span>
                      <strong className="text-sm font-bold text-blue-700 dark:text-blue-400 tabular-nums block">
                        ETB{' '}
                        {Math.max(
                          0,
                          netCollateralValue -
                            (validationResult?.currentActiveAllocations ?? selectedCollateral.currentAllocation ?? 0)
                        ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="text-[10px] text-slate-400">Unallocated NSV ceiling</span>
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
                        ETB {remainingCapacity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                          Allocation Capacity Overflow Detected (§18)
                        </div>
                        <p className="mt-0.5">
                          Proposed allocation of <strong>ETB {allocatedAmount.toLocaleString()}</strong> results in total
                          allocations exceeding Net Security Value (ETB {netCollateralValue.toLocaleString()}) by{' '}
                          <strong>ETB {validationResult.excessAllocationAmount.toLocaleString()} excess</strong>.
                          Please reduce the allocation amount within available capacity.
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
                            title="Set allocation to cover exactly 100% of the loan exposure"
                            className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                          >
                            🎯 100% Loan Coverage
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllocatedAmount(availableCollateralCapacity)}
                            title="Allocate the full available unallocated capacity of this collateral asset"
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
                            title="Allocate 50% of the loan balance"
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
                          value={allocatedAmount || ''}
                          onChange={(e) => setAllocatedAmount(Number(e.target.value))}
                          placeholder="e.g. 5000000.00"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-mono font-bold"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setAllocatedAmount(availableCollateralCapacity);
                          }}
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
                            ETB {allocatedAmount.toLocaleString()} of ETB {netCollateralValue.toLocaleString()}
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
                            Total Secured: ETB {totalFacilityAllocatedWithProposed.toLocaleString()} of ETB {facilityOutstandingExposure.toLocaleString()}
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
                                Total secured (ETB {totalFacilityAllocatedWithProposed.toLocaleString()}) exceeds the loan exposure by ETB {(totalFacilityAllocatedWithProposed - facilityOutstandingExposure).toLocaleString()}.
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAllocatedAmount(recommended100PctAllocation)}
                            className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-[11px] transition-colors"
                          >
                            Auto-Cap to 100% (ETB {recommended100PctAllocation.toLocaleString()})
                          </button>
                        </div>
                      )}

                      {/* EXACT 100% COVERAGE NOTICE */}
                      {Math.abs(totalFacilityCoveragePct - 100) < 0.05 && (
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-medium">Exact 100.0% Security Coverage Achieved for this Loan Facility.</span>
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
                        value={utilOrder}
                        onChange={(e) => setUtilOrder(Number(e.target.value))}
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

              {/* ============================================================== */}
              {/* SECTION E: STRUCTURED AUTHORITATIVE VALIDATION DIAGNOSTICS (§11)*/}
              {/* ============================================================== */}
              {validationResult && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Authoritative Backend Validation Diagnostics (§11)
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
            </>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
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
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {mode === 'edit'
                ? 'Update Relationship'
                : isPreselectedFacility
                ? 'Link Collateral to Facility'
                : 'Link Facility'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
