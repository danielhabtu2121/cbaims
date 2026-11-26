package com.bank.cims.service;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.cbs.CbsGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class CollateralFacilityRelationshipService {

    private static final Logger log = LoggerFactory.getLogger(CollateralFacilityRelationshipService.class);

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private LoanCollateralLinkHistoryRepository linkHistoryRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private CollateralOwnerRepository collateralOwnerRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    @Autowired
    private EffectiveInsuranceService effectiveInsuranceService;

    @Autowired
    private ConfigurationService configurationService;

    @Autowired
    private ValidationService validationService;

    @Autowired(required = false)
    private DashboardService dashboardService;

    @Autowired(required = false)
    private UserRepository userRepository;

    @Autowired
    private AuthorizationScopeService authorizationScopeService;

    @Autowired
    private RoleHierarchyService roleHierarchyService;

    @Autowired(required = false)
    private OwnershipDocumentRepository ownershipDocumentRepository;

    public static final Set<String> ELIGIBLE_FACILITY_STATUSES = Set.of(
            "ACTIVE", "APPROVED", "DISBURSED", "PERFORMING", "SANCTIONED"
    );

    public static boolean isEligibleFacilityStatus(String status) {
        if (status == null || status.isBlank()) return false;
        return ELIGIBLE_FACILITY_STATUSES.contains(status.trim().toUpperCase(Locale.ROOT));
    }

    private static final java.util.concurrent.atomic.AtomicLong HISTORY_SEQ = new java.util.concurrent.atomic.AtomicLong(System.currentTimeMillis() * 1000);

    private User resolveActor(String userId) {
        User actor = authorizationScopeService.currentUser();
        if (actor == null && userRepository != null && userId != null && !userId.isBlank()) {
            actor = userRepository.findById(userId).or(() -> userRepository.findByUsername(userId)).orElse(null);
        }
        return actor;
    }

    /** Uses the Admin-configured approval hierarchy; no hardcoded checker role is trusted. */
    private boolean isConfiguredLinkApprover(User actor, String actionType) {
        if (actor == null) return false;
        if ("SYSTEM".equalsIgnoreCase(actor.getUsername()) || "SYSTEM".equalsIgnoreCase(actor.getId())) return true;
        if (actor.getRole() == null || actor.getRole().isBlank()) return false;
        if (roleHierarchyService.isNeverApprovesRole(actor.getRole())) return false;
        String configuredRole = roleHierarchyService.resolveApproverRole(
                "PROC_COLLATERAL_LINK_CHANGE", actionType);
        return roleHierarchyService.isAuthorizedToActOn(actor.getRole(), configuredRole);
    }

    @Autowired(required = false)
    private CbsGateway cbsGateway;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private FirstDegreeSecondDegreeService firstDegreeSecondDegreeService;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private WorkflowExecutionService workflowExecutionService;

    // =========================================================================
    // 1. QUERY RELATIONSHIPS (BIDIRECTIONAL & COMPLETE)
    // =========================================================================

    public List<CollateralFacilityLinkDto> getRelationshipsForCollateral(String collateralId) {
        Collateral col = resolveCollateral(collateralId);
        if (col == null) return Collections.emptyList();

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
        if (links.isEmpty() && col.getCode() != null) {
            links = loanCollateralLinkRepository.findByCollateralId(col.getCode());
        }

        return links.stream()
                .map(l -> toDto(l, col, null))
                .collect(Collectors.toList());
    }

    public List<CollateralFacilityLinkDto> getRelationshipsForFacility(String facilityId) {
        LoanAccount facility = resolveFacility(facilityId);
        if (facility == null) return Collections.emptyList();

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByLoanAccountId(facility.getId());
        if (links.isEmpty() && facility.getLineCode() != null) {
            links = loanCollateralLinkRepository.findByFacilityId(facility.getLineCode());
        }

        return links.stream()
                .map(l -> toDto(l, null, facility))
                .collect(Collectors.toList());
    }

    public List<CollateralFacilityLinkDto> getAllRelationships(String collateralId, String facilityId, String customerId, String status) {
        List<LoanCollateralLink> links;
        if (collateralId != null && !collateralId.isBlank()) {
            links = loanCollateralLinkRepository.findByCollateralId(collateralId);
        } else if (facilityId != null && !facilityId.isBlank()) {
            links = loanCollateralLinkRepository.findByLoanAccountId(facilityId);
        } else if (customerId != null && !customerId.isBlank()) {
            links = loanCollateralLinkRepository.findByCustomerId(customerId);
        } else if (status != null && !status.isBlank()) {
            links = loanCollateralLinkRepository.findByStatus(status);
        } else {
            links = loanCollateralLinkRepository.findAll();
        }

        return links.stream()
                .filter(l -> status == null || status.isBlank() || status.equalsIgnoreCase(l.getStatus()))
                .map(l -> toDto(l, null, null))
                .collect(Collectors.toList());
    }

    public CollateralFacilityLinkDto getRelationshipById(String linkId) {
        LoanCollateralLink link = loanCollateralLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Relationship not found with ID: " + linkId));
        return toDto(link, null, null);
    }

    public List<LoanCollateralLinkHistory> getRelationshipHistory(String linkId) {
        return linkHistoryRepository.findByLinkIdOrderByMakerDtStampDesc(linkId);
    }

    // =========================================================================
    // 2. SUMMARIES FROM BOTH DIRECTIONS (SECTION 18 & 19)
    // =========================================================================

    public CollateralSecuredFacilitiesSummaryDto getCollateralSecuredFacilitiesSummary(String collateralId) {
        Collateral col = resolveCollateral(collateralId);
        if (col == null) {
            throw new IllegalArgumentException("Collateral not found: " + collateralId);
        }

        CollateralSecuredFacilitiesSummaryDto summary = new CollateralSecuredFacilitiesSummaryDto();
        summary.setCollateralId(col.getId());
        summary.setCollateralCode(col.getCode());
        summary.setDescription(col.getDescription());
        summary.setCategory(col.getCategory());
        summary.setType(col.getType());
        summary.setOwnerType(col.getOwnerType());
        summary.setCurrency(col.getCurrency() != null ? col.getCurrency() : "ETB");
        summary.setMarketValuation(col.getValuationAmount());
        summary.setHaircut(col.getHaircut());

        double nsv = col.getValuationAmount() * (1.0 - (col.getHaircut() / 100.0));
        summary.setNetCollateralValue(nsv);

        List<CollateralFacilityLinkDto> linkDtos = getRelationshipsForCollateral(col.getId());
        summary.setSecuredFacilities(linkDtos);

        // Filter active links for exposure and allocation
        List<CollateralFacilityLinkDto> activeLinks = linkDtos.stream()
                .filter(l -> "Active".equalsIgnoreCase(l.getRelationshipStatus()) || "Active".equalsIgnoreCase(l.getSource()))
                .collect(Collectors.toList());

        summary.setLinkedFacilityCount(activeLinks.size());

        double totalAllocated = activeLinks.stream().mapToDouble(CollateralFacilityLinkDto::getAllocatedAmount).sum();
        summary.setTotalAllocatedSecurity(totalAllocated);
        summary.setUnallocatedSecurity(Math.max(0, nsv - totalAllocated));
        summary.setUtilizationPct(nsv > 0 ? (totalAllocated / nsv) * 100.0 : 0.0);

        // Aggregate linked exposure across distinct facilities
        Map<String, CollateralFacilityLinkDto> distinctFacilities = new LinkedHashMap<>();
        for (CollateralFacilityLinkDto l : activeLinks) {
            distinctFacilities.putIfAbsent(l.getLoanAccountId(), l);
        }
        double aggregateExposure = distinctFacilities.values().stream()
                .mapToDouble(CollateralFacilityLinkDto::getOutstandingBalance).sum();
        double totalApprovedLimit = distinctFacilities.values().stream()
                .mapToDouble(CollateralFacilityLinkDto::getApprovedLimit).sum();

        summary.setAggregateSecuredExposure(aggregateExposure);
        summary.setTotalFacilityApprovedLimit(totalApprovedLimit);

        // Evaluate insurance adequacy relative to aggregate exposure
        boolean isMandatory = effectiveInsuranceService.isInsuranceMandatory(col.getCategory(), col.getType());
        double minAdequacyPct = configurationService.getMinimumCoverageAdequacyPct();
        double baseRequired = Math.max(aggregateExposure, col.getValuationAmount());
        double reqInsurance = isMandatory ? (baseRequired * (minAdequacyPct / 100.0)) : 0.0;
        summary.setRequiredInsuranceAmount(reqInsurance);

        List<InsurancePolicy> policies = insurancePolicyRepository.findByCollateralId(col.getId());
        if (policies.isEmpty() && col.getCode() != null) {
            policies = insurancePolicyRepository.findByCollateralId(col.getCode());
        }

        String today = LocalDate.now().toString();
        double activeInsurance = 0;
        boolean hasExpiredPolicy = false;
        for (InsurancePolicy p : policies) {
            if ("Active".equalsIgnoreCase(p.getStatus()) || "Approved".equalsIgnoreCase(p.getStatus())) {
                if (p.getExpiryDate() != null && p.getExpiryDate().compareTo(today) < 0) {
                    hasExpiredPolicy = true;
                } else {
                    activeInsurance += p.getInsuredAmount();
                }
            }
        }

        summary.setCurrentInsuredAmount(activeInsurance);
        double gap = Math.max(0, reqInsurance - activeInsurance);
        summary.setInsuranceGap(gap);
        summary.setCoveragePercentage(reqInsurance > 0 ? (activeInsurance / reqInsurance) * 100.0 : (activeInsurance > 0 ? 100.0 : 0.0));

        String adqStatus;
        if (!isMandatory) {
            adqStatus = "NOT REQUIRED";
        } else if (hasExpiredPolicy && activeInsurance < reqInsurance) {
            adqStatus = "EXPIRED";
        } else if (activeInsurance >= reqInsurance && reqInsurance > 0) {
            adqStatus = activeInsurance > (reqInsurance * 1.10) ? "EXCESS" : "ADEQUATE";
        } else {
            adqStatus = "UNDERINSURED";
        }
        summary.setAdequacyStatus(adqStatus);

        StringBuilder explanation = new StringBuilder();
        explanation.append(String.format(Locale.ROOT, "Collateral Valuation: ETB %,.2f less %.1f%% haircut yields Net Security Value of ETB %,.2f. ",
                col.getValuationAmount(), col.getHaircut(), nsv));
        explanation.append(String.format(Locale.ROOT, "Securing %d active credit facilities with Total Allocated Security of ETB %,.2f (Unallocated: ETB %,.2f). ",
                activeLinks.size(), totalAllocated, summary.getUnallocatedSecurity()));
        explanation.append(String.format(Locale.ROOT, "Aggregate Secured Exposure: ETB %,.2f across linked obligations. ",
                aggregateExposure));
        if (isMandatory) {
            explanation.append(String.format(Locale.ROOT, "Insurance requirement: Max(Aggregate Exposure ETB %,.2f, Collateral Value ETB %,.2f) = ETB %,.2f. Active Insured: ETB %,.2f -> Status: %s (Gap: ETB %,.2f).",
                    aggregateExposure, col.getValuationAmount(), reqInsurance, activeInsurance, adqStatus, gap));
        } else {
            explanation.append("Insurance is Not Mandatory for this collateral category.");
        }
        summary.setCalculationExplanation(explanation.toString());

        return summary;
    }

    public FacilityCollateralSummaryDto getFacilityCollateralSummary(String facilityId) {
        LoanAccount fac = resolveFacility(facilityId);
        if (fac == null) {
            throw new IllegalArgumentException("Credit facility not found: " + facilityId);
        }

        FacilityCollateralSummaryDto summary = new FacilityCollateralSummaryDto();
        summary.setFacilityId(fac.getId());
        summary.setLoanAccountId(fac.getId());
        summary.setLoanReference(fac.getLoanReference());
        summary.setLineCode(fac.getLineCode());
        summary.setAccountNumber(fac.getAccountNumber());
        summary.setCustomerId(fac.getCustomerId());
        summary.setFacilityType(fac.getFacilityType());
        summary.setCurrency(fac.getLineCurrency() != null ? fac.getLineCurrency() : "ETB");
        summary.setApprovedLimit(fac.getApprovedLimit());
        summary.setOutstandingBalance(fac.getOutstandingBalance());
        summary.setAvailableAmount(fac.getAvailableAmount() > 0 ? fac.getAvailableAmount() : Math.max(0, fac.getApprovedLimit() - fac.getOutstandingBalance()));
        summary.setBusinessSegment(fac.getSegment());
        summary.setBranch(fac.getBranch());
        summary.setStatus(fac.getStatus());

        customerRepository.findById(fac.getCustomerId())
                .or(() -> customerRepository.findFirstByCifIgnoreCase(fac.getCustomerId()))
                .ifPresent(c -> {
                    summary.setCustomerName(c.getName());
                    summary.setCustomerCif(c.getCif());
                });

        List<CollateralFacilityLinkDto> linkDtos = getRelationshipsForFacility(fac.getId());
        summary.setSecuringCollaterals(linkDtos);

        List<CollateralFacilityLinkDto> activeLinks = linkDtos.stream()
                .filter(l -> "Active".equalsIgnoreCase(l.getRelationshipStatus())
                        && !"Ended".equalsIgnoreCase(l.getRelationshipStatus())
                        && !"Released".equalsIgnoreCase(l.getRelationshipStatus())
                        && !"Historical".equalsIgnoreCase(l.getRelationshipStatus()))
                .collect(Collectors.toList());

        summary.setLinkedCollateralCount(activeLinks.size());

        double totalAllocated = activeLinks.stream().mapToDouble(CollateralFacilityLinkDto::getAllocatedAmount).sum();
        double totalNsv = activeLinks.stream().mapToDouble(CollateralFacilityLinkDto::getNetCollateralValue).sum();
        double totalMv = activeLinks.stream().mapToDouble(CollateralFacilityLinkDto::getCollateralValuation).sum();

        summary.setTotalAllocatedCollateral(totalAllocated);
        summary.setTotalNetCollateralValue(totalNsv);
        summary.setTotalMarketValuation(totalMv);
        summary.setCollateralCoveragePct(fac.getOutstandingBalance() > 0 ? (totalAllocated / fac.getOutstandingBalance()) * 100.0 : (totalAllocated > 0 ? 100.0 : 0.0));

        // Total active recognized insurance on securing collaterals
        double totalInsurance = activeLinks.stream().mapToDouble(CollateralFacilityLinkDto::getActiveInsuranceAmount).sum();
        summary.setTotalRecognizedInsurance(totalInsurance);

        double reqInsurance = fac.getOutstandingBalance();
        summary.setInsuranceRequirement(reqInsurance);
        double gap = Math.max(0, reqInsurance - totalInsurance);
        summary.setInsuranceGap(gap);
        summary.setInsuranceCoveragePct(reqInsurance > 0 ? (totalInsurance / reqInsurance) * 100.0 : (totalInsurance > 0 ? 100.0 : 0.0));

        if (totalInsurance >= reqInsurance && reqInsurance > 0) {
            summary.setAdequacyStatus(totalInsurance > (reqInsurance * 1.10) ? "EXCESS" : "ADEQUATE");
        } else if (totalInsurance > 0) {
            summary.setAdequacyStatus("UNDERINSURED");
        } else {
            summary.setAdequacyStatus("UNINSURED");
        }

        return summary;
    }

    public List<LoanAccount> getEligibleFacilitiesForCollateral(String collateralId) {
        return getEligibleFacilitiesForCollateral(collateralId, null, null);
    }

    public List<LoanAccount> getEligibleFacilitiesForCollateral(String collateralId, String targetCustomerId, String userId) {
        List<FacilityCandidateDto> candidates = getCandidateFacilitiesForCollateral(collateralId, targetCustomerId, userId);
        Set<String> eligibleIds = candidates.stream()
                .filter(FacilityCandidateDto::isEligible)
                .map(FacilityCandidateDto::getId)
                .filter(Objects::nonNull)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        return loanAccountRepository.findAll().stream()
                .filter(f -> f.getId() != null && eligibleIds.contains(f.getId().toLowerCase()))
                .collect(Collectors.toList());
    }

    public List<FacilityCandidateDto> getCandidateFacilitiesForCollateral(String collateralId, String targetCustomerId, String userId) {
        Collateral col = resolveCollateral(collateralId);
        if (col == null) {
            return Collections.emptyList();
        }

        // Calculate NSV and available capacity of this collateral
        double mv = col.getValuationAmount();
        double haircut = col.getHaircut();
        double nsv = mv * (1.0 - (haircut / 100.0));

        // Fetch already linked active facilities for this collateral
        List<LoanCollateralLink> activeLinksForCol = new ArrayList<>();
        activeLinksForCol.addAll(loanCollateralLinkRepository.findByCollateralId(col.getId()));
        if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
            activeLinksForCol.addAll(loanCollateralLinkRepository.findByCollateralId(col.getCode()));
        }

        double currentAlloc = activeLinksForCol.stream()
                .filter(l -> l.isCapacityConsuming() || "Active".equalsIgnoreCase(l.getStatus()) || "Pending Approval".equalsIgnoreCase(l.getStatus()))
                .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        double availableCapacity = Math.max(0, nsv - currentAlloc);

        Map<String, LoanCollateralLink> linkedFacilityMap = new HashMap<>();
        for (LoanCollateralLink l : activeLinksForCol) {
            if ("Active".equalsIgnoreCase(l.getStatus()) || "Pending Approval".equalsIgnoreCase(l.getStatus()) || l.isCapacityConsuming()) {
                if (l.getLoanAccountId() != null) linkedFacilityMap.put(l.getLoanAccountId().trim().toLowerCase(), l);
                if (l.getFacilityId() != null) linkedFacilityMap.put(l.getFacilityId().trim().toLowerCase(), l);
                if (l.getCbsFacilityRef() != null) linkedFacilityMap.put(l.getCbsFacilityRef().trim().toLowerCase(), l);
                if (l.getCbsLoanAccount() != null) linkedFacilityMap.put(l.getCbsLoanAccount().trim().toLowerCase(), l);
            }
        }

        // Scope resolution
        DashboardService.ResolvedScope userScope = null;
        if (userId != null && !userId.isBlank() && dashboardService != null) {
            try {
                userScope = dashboardService.resolveUserScope(userId, null, null, null);
            } catch (Exception ex) {
                log.debug("Scope resolution skipped for user {}: {}", userId, ex.getMessage());
            }
        }
        final DashboardService.ResolvedScope effScope = userScope;

        Set<String> targetCustIds = null;
        if (targetCustomerId != null && !targetCustomerId.isBlank() &&
            !"ALL".equalsIgnoreCase(targetCustomerId.trim()) &&
            !"ANY".equalsIgnoreCase(targetCustomerId.trim()) &&
            !"PORTFOLIO".equalsIgnoreCase(targetCustomerId.trim())) {
            targetCustIds = resolveCustomerIds(targetCustomerId);
        }

        List<LoanAccount> candidateSourceFacilities;
        if (targetCustIds != null && !targetCustIds.isEmpty()) {
            candidateSourceFacilities = loanAccountRepository.findByCustomerIdIn(targetCustIds);
        } else {
            String segFilter = (effScope != null && !effScope.isBankWide()) ? effScope.effectiveSegment : null;
            candidateSourceFacilities = loanAccountRepository.findPaged(
                    null, segFilter, false, List.of("__NONE__"), org.springframework.data.domain.PageRequest.of(0, 200)
            ).getContent();
        }

        // Build facility -> collateral links map ONLY for candidate facilities (avoids 315k-row findAll)
        List<String> candFacIds = candidateSourceFacilities.stream()
                .map(LoanAccount::getId)
                .filter(Objects::nonNull)
                .toList();
        List<LoanCollateralLink> scopedLinks = candFacIds.isEmpty()
                ? Collections.emptyList()
                : loanCollateralLinkRepository.findByLoanAccountIdIn(candFacIds);
        Map<String, List<String>> facilityToCollateralCodes = new HashMap<>();
        for (LoanCollateralLink link : scopedLinks) {
            if ("Active".equalsIgnoreCase(link.getStatus()) || "Pending Approval".equalsIgnoreCase(link.getStatus())) {
                String colCode = link.getCbsCollateralRef() != null ? link.getCbsCollateralRef() : link.getCollateralId();
                if (colCode != null) {
                    if (link.getLoanAccountId() != null) {
                        facilityToCollateralCodes.computeIfAbsent(link.getLoanAccountId().toLowerCase(), k -> new ArrayList<>()).add(colCode);
                    }
                    if (link.getFacilityId() != null && !link.getFacilityId().equalsIgnoreCase(link.getLoanAccountId())) {
                        facilityToCollateralCodes.computeIfAbsent(link.getFacilityId().toLowerCase(), k -> new ArrayList<>()).add(colCode);
                    }
                }
            }
        }

        List<FacilityCandidateDto> candidates = new ArrayList<>();

        for (LoanAccount f : candidateSourceFacilities) {
            if (targetCustIds != null && (f.getCustomerId() == null || !targetCustIds.contains(f.getCustomerId().trim().toLowerCase()))) {
                continue;
            }

            // User scope check
            if (effScope != null && !effScope.isBankWide()) {
                try {
                    dashboardService.checkLeafEntityAccess(effScope, f.getBranch(), f.getSegment());
                } catch (Exception ex) {
                    continue; // Skip out-of-scope facility
                }
            }

            FacilityCandidateDto dto = new FacilityCandidateDto();
            dto.setId(f.getId());
            dto.setLineCode(f.getLineCode());
            dto.setLoanReference(f.getLoanReference());
            dto.setAccountNumber(f.getAccountNumber());
            dto.setFacilityType(f.getFacilityType());
            dto.setCustomerId(f.getCustomerId());
            dto.setApprovedLimit(f.getApprovedLimit());
            dto.setOutstandingBalance(f.getOutstandingBalance());
            dto.setAvailableAmount(f.getAvailableAmount());
            dto.setLineCurrency(f.getLineCurrency() != null ? f.getLineCurrency() : "ETB");
            dto.setLineExpiryDate(f.getLineExpiryDate());
            dto.setStatus(f.getStatus());
            dto.setBranch(f.getBranch());
            dto.setSegment(f.getSegment());

            // Borrower details
            if (f.getCustomerId() != null) {
                customerRepository.findById(f.getCustomerId())
                        .or(() -> customerRepository.findFirstByCifIgnoreCase(f.getCustomerId()))
                        .ifPresent(cust -> {
                            dto.setBorrowerName(cust.getName());
                            dto.setBorrowerCif(cust.getCif());
                        });
            }

            // Co-collateral tracking
            List<String> linkedColCodes = new ArrayList<>();
            if (f.getId() != null && facilityToCollateralCodes.containsKey(f.getId().toLowerCase())) {
                linkedColCodes.addAll(facilityToCollateralCodes.get(f.getId().toLowerCase()));
            }
            if (f.getLineCode() != null && facilityToCollateralCodes.containsKey(f.getLineCode().toLowerCase())) {
                for (String c : facilityToCollateralCodes.get(f.getLineCode().toLowerCase())) {
                    if (!linkedColCodes.contains(c)) linkedColCodes.add(c);
                }
            }
            dto.setLinkedCollateralCount(linkedColCodes.size());
            dto.setLinkedCollateralCodes(linkedColCodes);

            // Ownership alignment - relationship-specific
            boolean isBorrowerOwner = checkBorrowerIsCollateralOwner(col, f);
            boolean isThirdParty = !isBorrowerOwner;
            dto.setThirdParty(isThirdParty);

            // 1. Check duplicate
            String fid = f.getId() != null ? f.getId().toLowerCase() : "";
            String fref = f.getLoanReference() != null ? f.getLoanReference().trim().toLowerCase() : "";
            String fcode = f.getLineCode() != null ? f.getLineCode().trim().toLowerCase() : "";
            String facc = f.getAccountNumber() != null ? f.getAccountNumber().trim().toLowerCase() : "";

            LoanCollateralLink existingLink = linkedFacilityMap.get(fid);
            if (existingLink == null && !fref.isBlank()) existingLink = linkedFacilityMap.get(fref);
            if (existingLink == null && !fcode.isBlank()) existingLink = linkedFacilityMap.get(fcode);
            if (existingLink == null && !facc.isBlank()) existingLink = linkedFacilityMap.get(facc);

            if (existingLink != null) {
                dto.setAlreadyLinked(true);
                dto.setExistingAllocationToThisCollateral(existingLink.getAllocatedAmount());
                dto.setEligible(false);
                dto.setCandidateStatus("DUPLICATE");
                dto.setIneligibilityReason("This credit facility is already actively linked to this collateral asset.");
                candidates.add(dto);
                continue;
            }

            // 2. Check operational status
            if (!isEligibleFacilityStatus(f.getStatus())) {
                dto.setEligible(false);
                dto.setCandidateStatus("INELIGIBLE_STATUS");
                dto.setIneligibilityReason("Facility status '" + f.getStatus() + "' is not eligible for collateral linkage. Must be Active/Approved.");
                candidates.add(dto);
                continue;
            }

            // 3. Check collateral capacity
            if (availableCapacity <= 0.01) {
                dto.setEligible(false);
                dto.setCandidateStatus("CAPACITY_EXCEEDED");
                dto.setIneligibilityReason("Collateral net security value is fully allocated (ETB 0.00 available capacity).");
                candidates.add(dto);
                continue;
            }

            // 4. Third-Party vs Direct Borrower
            if (isThirdParty) {
                dto.setEligible(true);
                dto.setRequiresInformation(true);
                dto.setCandidateStatus("REQUIRES_THIRD_PARTY_INFO");
                dto.setIneligibilityReason(null);
            } else {
                dto.setEligible(true);
                dto.setRequiresInformation(false);
                dto.setCandidateStatus("ELIGIBLE");
                dto.setIneligibilityReason(null);
            }

            candidates.add(dto);
        }

        // Sort candidates: ELIGIBLE first, then REQUIRES_THIRD_PARTY_INFO, then disabled
        candidates.sort((a, b) -> {
            int rankA = "ELIGIBLE".equals(a.getCandidateStatus()) ? 1 : "REQUIRES_THIRD_PARTY_INFO".equals(a.getCandidateStatus()) ? 2 : 3;
            int rankB = "ELIGIBLE".equals(b.getCandidateStatus()) ? 1 : "REQUIRES_THIRD_PARTY_INFO".equals(b.getCandidateStatus()) ? 2 : 3;
            if (rankA != rankB) return Integer.compare(rankA, rankB);
            String refA = a.getLoanReference() != null ? a.getLoanReference() : a.getLineCode() != null ? a.getLineCode() : "";
            String refB = b.getLoanReference() != null ? b.getLoanReference() : b.getLineCode() != null ? b.getLineCode() : "";
            return refA.compareToIgnoreCase(refB);
        });

        return candidates;
    }

    public List<CollateralCandidateDto> getEligibleCollateralsForFacility(String facilityId) {
        return getEligibleCollateralsForFacility(facilityId, null);
    }

    public List<CollateralCandidateDto> getEligibleCollateralsForFacility(String facilityId, String userId) {
        LoanAccount facility = resolveFacility(facilityId);
        if (facility == null) {
            throw new IllegalArgumentException("Credit facility not found: " + facilityId);
        }

        String borrowerCustomerId = facility.getCustomerId();
        Set<String> validBorrowerCustIds = resolveCustomerIds(borrowerCustomerId);

        // Fetch already linked active collateral IDs for this facility
        List<LoanCollateralLink> activeLinks = new ArrayList<>();
        activeLinks.addAll(loanCollateralLinkRepository.findByLoanAccountId(facility.getId()));
        if (facility.getLineCode() != null && !facility.getLineCode().equalsIgnoreCase(facility.getId())) {
            activeLinks.addAll(loanCollateralLinkRepository.findByFacilityId(facility.getLineCode()));
        }
        Map<String, LoanCollateralLink> activeLinksByColId = activeLinks.stream()
                .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
                .filter(l -> l.getCollateralId() != null)
                .collect(Collectors.toMap(
                        l -> l.getCollateralId().trim().toLowerCase(),
                        l -> l,
                        (existing, replacement) -> existing
                ));

        // Resolve user scope if provided
        DashboardService.ResolvedScope userScope = null;
        if (userId != null && !userId.isBlank() && dashboardService != null) {
            try {
                userScope = dashboardService.resolveUserScope(userId, null, null, null);
            } catch (Exception ex) {
                log.debug("Scope resolution skipped for {}: {}", userId, ex.getMessage());
            }
        }
        final DashboardService.ResolvedScope effScope = userScope;

        // Targeted candidate lookup: borrower's own collaterals + linked collaterals + bounded top-up (avoids 73k-row findAll + N+1 queries)
        Map<String, Collateral> candidateColMap = new LinkedHashMap<>();
        if (validBorrowerCustIds != null && !validBorrowerCustIds.isEmpty()) {
            for (Collateral c : collateralRepository.findByCustomerIdIn(validBorrowerCustIds)) {
                candidateColMap.put(c.getId(), c);
            }
        }
        if (!activeLinksByColId.isEmpty()) {
            Set<String> linkedIds = activeLinks.stream()
                    .map(LoanCollateralLink::getCollateralId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            for (Collateral c : collateralRepository.findAllById(linkedIds)) {
                candidateColMap.put(c.getId(), c);
            }
        }
        if (candidateColMap.size() < 100) {
            String segFilter = (effScope != null && !effScope.isBankWide()) ? effScope.effectiveSegment : null;
            for (Collateral c : collateralRepository.findPaged(
                    null, segFilter, null, false, List.of("__NONE__"), org.springframework.data.domain.PageRequest.of(0, 100)
            ).getContent()) {
                candidateColMap.putIfAbsent(c.getId(), c);
            }
        }

        Set<String> candCustIds = candidateColMap.values().stream()
                .map(Collateral::getCustomerId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Customer> custByIdMap = new HashMap<>();
        if (!candCustIds.isEmpty()) {
            for (Customer cust : customerRepository.findAllById(candCustIds)) {
                custByIdMap.put(cust.getId(), cust);
                if (cust.getCif() != null) {
                    custByIdMap.put(cust.getCif().trim().toUpperCase(), cust);
                }
            }
        }

        List<Collateral> allCollaterals = new ArrayList<>(candidateColMap.values());
        List<CollateralCandidateDto> candidates = new ArrayList<>();

        for (Collateral c : allCollaterals) {
            CollateralCandidateDto dto = new CollateralCandidateDto();
            dto.setId(c.getId());
            dto.setCode(c.getCode());
            dto.setDescription(c.getDescription());
            dto.setCategory(c.getCategory());
            dto.setType(c.getType());
            dto.setCustomerId(c.getCustomerId());
            dto.setOwnershipType(c.getOwnerType() != null ? c.getOwnerType() : "Borrower-owned");
            dto.setValuationAmount(c.getValuationAmount());
            dto.setHaircut(c.getHaircut());
            double nsv = c.getValuationAmount() * (1.0 - (c.getHaircut() / 100.0));
            dto.setNetCollateralValue(nsv);
            double currentAlloc = c.getCurrentAllocation();
            dto.setCurrentAllocation(currentAlloc);
            double remainingCap = Math.max(0, nsv - currentAlloc);
            dto.setAvailableCapacity(remainingCap);
            dto.setUtilizationPct(nsv > 0 ? (currentAlloc / nsv) * 100.0 : 0.0);

            // Customer Name (from batch map)
            if (c.getCustomerId() != null) {
                Customer cust = custByIdMap.get(c.getCustomerId());
                if (cust == null) {
                    cust = custByIdMap.get(c.getCustomerId().trim().toUpperCase());
                }
                if (cust != null) {
                    dto.setCustomerName(cust.getName());
                    dto.setCustomerCif(cust.getCif());
                }
            }

            // Owners
            List<CollateralOwner> owners = c.getOwners();
            if ((owners == null || owners.isEmpty()) && collateralOwnerRepository != null) {
                owners = collateralOwnerRepository.findByCollateralId(c.getId());
                if ((owners == null || owners.isEmpty()) && c.getCode() != null) {
                    owners = collateralOwnerRepository.findByCollateralId(c.getCode());
                }
            }
            if (owners != null && !owners.isEmpty()) {
                List<String> ownerNames = new ArrayList<>();
                for (CollateralOwner o : owners) {
                    if (o.getName() != null && !o.getName().isBlank()) {
                        ownerNames.add(o.getName());
                    }
                }
                dto.setLegalOwners(ownerNames);
                dto.setLegalOwnerNames(String.join(", ", ownerNames));
                dto.setOwnerRelationship(owners.get(0).getRelationshipToBorrower() != null
                        ? owners.get(0).getRelationshipToBorrower()
                        : owners.get(0).getRelationship());
            } else {
                dto.setLegalOwnerNames(dto.getCustomerName() != null ? dto.getCustomerName() : c.getCustomerId());
                dto.setOwnerRelationship("Borrower");
            }

            // 1. Check already linked
            String cIdLower = c.getId() != null ? c.getId().trim().toLowerCase() : "";
            String cCodeLower = c.getCode() != null ? c.getCode().trim().toLowerCase() : "";
            LoanCollateralLink existingLink = activeLinksByColId.get(cIdLower);
            if (existingLink == null && !cCodeLower.isBlank()) {
                existingLink = activeLinksByColId.get(cCodeLower);
            }

            // Linked facilities tracking
            List<String> linkedFacCodes = new ArrayList<>();
            List<LoanCollateralLink> cLinks = new ArrayList<>(loanCollateralLinkRepository.findByCollateralId(c.getId()));
            if (c.getCode() != null && !c.getCode().equalsIgnoreCase(c.getId())) {
                cLinks.addAll(loanCollateralLinkRepository.findByCollateralId(c.getCode()));
            }
            for (LoanCollateralLink cl : cLinks) {
                if ("Active".equalsIgnoreCase(cl.getStatus()) || "Pending Approval".equalsIgnoreCase(cl.getStatus())) {
                    String ref = cl.getCbsFacilityRef() != null ? cl.getCbsFacilityRef() : (cl.getLoanAccountId() != null ? cl.getLoanAccountId() : cl.getFacilityId());
                    if (ref != null && !linkedFacCodes.contains(ref)) linkedFacCodes.add(ref);
                }
            }
            dto.setLinkedFacilityCount(linkedFacCodes.size());
            dto.setLinkedFacilityCodes(linkedFacCodes);

            if (existingLink != null) {
                dto.setAlreadyLinked(true);
                dto.setExistingAllocationToThisFacility(existingLink.getAllocatedAmount());
                dto.setEligible(false);
                dto.setCandidateStatus("DUPLICATE");
                dto.setIneligibilityReason("This collateral is already actively linked to this credit facility.");
                candidates.add(dto);
                continue;
            }

            // 2. Check Status
            if (!"Active".equalsIgnoreCase(c.getStatus()) && !"Approved".equalsIgnoreCase(c.getStatus())) {
                dto.setEligible(false);
                dto.setCandidateStatus("INELIGIBLE_STATUS");
                dto.setIneligibilityReason("Collateral is not in Active status (" + c.getStatus() + ").");
                candidates.add(dto);
                continue;
            }

            // 3. User Scope Check
            if (effScope != null && !effScope.isBankWide()) {
                try {
                    dashboardService.checkLeafEntityAccess(effScope, c.getBranch(), c.getOwningSegment());
                } catch (IllegalArgumentException e) {
                    dto.setEligible(false);
                    dto.setCandidateStatus("INELIGIBLE_STATUS");
                    dto.setIneligibilityReason("Collateral asset is outside your authorized portfolio scope.");
                    candidates.add(dto);
                    continue;
                }
            }

            // 4. Ownership & Third-Party Rules (Relationship-specific determination)
            boolean isBorrowerOwner = checkBorrowerIsCollateralOwner(c, facility);
            boolean isThirdParty = !isBorrowerOwner;
            dto.setThirdParty(isThirdParty);

            if (isThirdParty) {
                // Cross-customer or third-party arrangement: check third-party prerequisites
                dto.setSatisfiesNormalOwnership(isBorrowerOwner);
                boolean hasEvidenceInDms = false;
                if (ownershipDocumentRepository != null) {
                    List<OwnershipDocument> cdocs = ownershipDocumentRepository.findByCollateralId(c.getId());
                    hasEvidenceInDms = cdocs.stream().anyMatch(d -> {
                        String dt = (d.getType() != null ? d.getType().toLowerCase() : "") + " " + (d.getName() != null ? d.getName().toLowerCase() : "");
                        return (dt.contains("pledge") || dt.contains("consent") || dt.contains("third-party") || dt.contains("third party")) &&
                               ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank()));
                    });
                }
                try {
                    validationService.validateThirdPartyOwnership(c);
                    dto.setThirdPartyValid(true);
                } catch (Exception ex) {
                    dto.setThirdPartyValid(hasEvidenceInDms);
                }
                // Allow candidate selection: require third-party information in linkage wizard
                dto.setEligible(true);
                dto.setRequiresInformation(true);
                dto.setCandidateStatus("REQUIRES_THIRD_PARTY_INFO");
                dto.setIneligibilityReason(null);
            } else {
                // Same customer / borrower-owned
                dto.setSatisfiesNormalOwnership(true);
                dto.setEligible(true);
                dto.setRequiresInformation(false);
                dto.setCandidateStatus("ELIGIBLE");
                dto.setIneligibilityReason(null);
            }

            // 5. Remaining capacity check
            if (remainingCap <= 0.01) {
                dto.setEligible(false);
                dto.setCandidateStatus("CAPACITY_EXCEEDED");
                dto.setIneligibilityReason("Collateral net security value is fully allocated (ETB 0.00 available capacity).");
                candidates.add(dto);
                continue;
            }

            // Passed all checks!
            candidates.add(dto);
        }

        // Sort candidates: ELIGIBLE first, then REQUIRES_THIRD_PARTY_INFO, then disabled
        candidates.sort((a, b) -> {
            int rankA = "ELIGIBLE".equals(a.getCandidateStatus()) ? 1 : "REQUIRES_THIRD_PARTY_INFO".equals(a.getCandidateStatus()) ? 2 : 3;
            int rankB = "ELIGIBLE".equals(b.getCandidateStatus()) ? 1 : "REQUIRES_THIRD_PARTY_INFO".equals(b.getCandidateStatus()) ? 2 : 3;
            if (rankA != rankB) return Integer.compare(rankA, rankB);
            return (a.getCode() != null ? a.getCode() : "").compareToIgnoreCase(b.getCode() != null ? b.getCode() : "");
        });

        return candidates;
    }

    public static class CollateralOwnershipInfo {
        private String primaryOwnerName;
        private String primaryOwnerCustomerId;
        private String primaryOwnerCif;
        private List<String> allOwnerNames = new ArrayList<>();
        private Set<String> allOwnerCustomerIdentifiers = new HashSet<>();
        private String registeredOwnerType;
        private String registeredRelationship = "Borrower";
        private String verificationStatus = "Recorded";
        private String pledgeAgreementRef;
        private String consentInfo;
        private double primaryOwnershipPct = 100.0;

        public String getPrimaryOwnerName() { return primaryOwnerName; }
        public void setPrimaryOwnerName(String primaryOwnerName) { this.primaryOwnerName = primaryOwnerName; }
        public String getPrimaryOwnerCustomerId() { return primaryOwnerCustomerId; }
        public void setPrimaryOwnerCustomerId(String primaryOwnerCustomerId) { this.primaryOwnerCustomerId = primaryOwnerCustomerId; }
        public String getPrimaryOwnerCif() { return primaryOwnerCif; }
        public void setPrimaryOwnerCif(String primaryOwnerCif) { this.primaryOwnerCif = primaryOwnerCif; }
        public List<String> getAllOwnerNames() { return allOwnerNames; }
        public Set<String> getAllOwnerCustomerIdentifiers() { return allOwnerCustomerIdentifiers; }
        public String getRegisteredOwnerType() { return registeredOwnerType; }
        public void setRegisteredOwnerType(String registeredOwnerType) { this.registeredOwnerType = registeredOwnerType; }
        public String getRegisteredRelationship() { return registeredRelationship; }
        public void setRegisteredRelationship(String registeredRelationship) { this.registeredRelationship = registeredRelationship; }
        public String getVerificationStatus() { return verificationStatus; }
        public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }
        public String getPledgeAgreementRef() { return pledgeAgreementRef; }
        public void setPledgeAgreementRef(String pledgeAgreementRef) { this.pledgeAgreementRef = pledgeAgreementRef; }
        public String getConsentInfo() { return consentInfo; }
        public void setConsentInfo(String consentInfo) { this.consentInfo = consentInfo; }
        public double getPrimaryOwnershipPct() { return primaryOwnershipPct; }
        public void setPrimaryOwnershipPct(double primaryOwnershipPct) { this.primaryOwnershipPct = primaryOwnershipPct; }
    }

    public CollateralOwnershipInfo resolveCollateralOwnership(Collateral col) {
        CollateralOwnershipInfo info = new CollateralOwnershipInfo();
        if (col == null) return info;

        info.setRegisteredOwnerType(col.getOwnerType() != null ? col.getOwnerType() : "Borrower-owned");
        info.setVerificationStatus(col.getVerificationStatus() != null ? col.getVerificationStatus() : "Recorded");
        info.setPrimaryOwnerCustomerId(col.getCustomerId());

        if (col.getCustomerId() != null && !col.getCustomerId().isBlank()) {
            info.getAllOwnerCustomerIdentifiers().addAll(resolveCustomerIds(col.getCustomerId()));
            customerRepository.findById(col.getCustomerId())
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(col.getCustomerId()))
                    .ifPresent(c -> {
                        info.setPrimaryOwnerName(c.getName());
                        info.setPrimaryOwnerCif(c.getCif());
                        if (c.getName() != null) info.getAllOwnerNames().add(c.getName().trim());
                        if (c.getCif() != null) info.getAllOwnerCustomerIdentifiers().add(c.getCif().trim().toLowerCase());
                        if (c.getId() != null) info.getAllOwnerCustomerIdentifiers().add(c.getId().trim().toLowerCase());
                    });
        }

        List<CollateralOwner> owners = col.getOwners();
        if ((owners == null || owners.isEmpty()) && collateralOwnerRepository != null) {
            owners = collateralOwnerRepository.findByCollateralId(col.getId());
            if ((owners == null || owners.isEmpty()) && col.getCode() != null) {
                owners = collateralOwnerRepository.findByCollateralId(col.getCode());
            }
        }

        if (owners != null && !owners.isEmpty()) {
            for (CollateralOwner o : owners) {
                if (o.getName() != null && !o.getName().isBlank()) {
                    String trimmedName = o.getName().trim();
                    if (!info.getAllOwnerNames().contains(trimmedName)) {
                        info.getAllOwnerNames().add(trimmedName);
                    }
                    customerRepository.findFirstByNameIgnoreCase(trimmedName).ifPresent(c -> {
                        if (c.getId() != null) info.getAllOwnerCustomerIdentifiers().add(c.getId().trim().toLowerCase());
                        if (c.getCif() != null) info.getAllOwnerCustomerIdentifiers().add(c.getCif().trim().toLowerCase());
                        if (c.getName() != null && !info.getAllOwnerNames().contains(c.getName().trim())) {
                            info.getAllOwnerNames().add(c.getName().trim());
                        }
                        if (info.getPrimaryOwnerCustomerId() == null) {
                            info.setPrimaryOwnerCustomerId(c.getId());
                            info.setPrimaryOwnerCif(c.getCif());
                        }
                    });
                }
                if (o.getIdNumber() != null && !o.getIdNumber().isBlank()) {
                    info.getAllOwnerCustomerIdentifiers().add(o.getIdNumber().trim().toLowerCase());
                }
                if (o.getTin() != null && !o.getTin().isBlank()) {
                    info.getAllOwnerCustomerIdentifiers().add(o.getTin().trim().toLowerCase());
                }
            }
            CollateralOwner primary = owners.get(0);
            if (primary.getName() != null && !primary.getName().isBlank()) {
                info.setPrimaryOwnerName(primary.getName().trim());
            }
            info.setRegisteredRelationship(primary.getRelationshipToBorrower() != null
                    ? primary.getRelationshipToBorrower() : primary.getRelationship());
            if (primary.getVerificationStatus() != null) info.setVerificationStatus(primary.getVerificationStatus());
            info.setConsentInfo(primary.getConsentInfo());
            info.setPledgeAgreementRef(primary.getPledgeAgreementRef());
            info.setPrimaryOwnershipPct(primary.getPercentage());
        }

        if (info.getPrimaryOwnerName() == null || info.getPrimaryOwnerName().isBlank()) {
            info.setPrimaryOwnerName(info.getPrimaryOwnerCustomerId());
        }

        return info;
    }

    public boolean checkBorrowerIsCollateralOwner(Collateral col, LoanAccount loan) {
        if (col == null || loan == null) return false;
        if ("Third-party-owned".equalsIgnoreCase(col.getOwnerType()) || "Third-party".equalsIgnoreCase(col.getOwnerType())) {
            return false;
        }
        String borrowerCustId = loan.getCustomerId();
        if (borrowerCustId == null || borrowerCustId.isBlank()) return false;

        // 1. Direct customer ID/CIF match on collateral.customerId
        if (isCustomerMatch(col.getCustomerId(), borrowerCustId)) {
            return true;
        }

        // 2. Match borrower identifiers against all registered owner identifiers
        Set<String> borrowerIdentifiers = resolveCustomerIds(borrowerCustId);
        CollateralOwnershipInfo ownerInfo = resolveCollateralOwnership(col);
        for (String bId : borrowerIdentifiers) {
            if (ownerInfo.getAllOwnerCustomerIdentifiers().contains(bId)) {
                return true;
            }
        }

        // 3. Name comparison if customer record is present
        Customer borrower = customerRepository.findById(borrowerCustId)
                .or(() -> customerRepository.findFirstByCifIgnoreCase(borrowerCustId))
                .orElse(null);
        if (borrower != null && borrower.getName() != null && !borrower.getName().isBlank()) {
            String bName = borrower.getName().trim().toLowerCase();
            for (String oName : ownerInfo.getAllOwnerNames()) {
                if (oName.trim().toLowerCase().equals(bName)) {
                    return true;
                }
            }
        }

        return false;
    }

    // =========================================================================
    // 3. VALIDATION SERVICE (CENTRALIZED RELATIONSHIP ENGINE - SECTION 11, 20, 30)
    // =========================================================================

    public RelationshipValidationResultDto validateRelationship(RelationshipRequestDto req) {
        RelationshipValidationResultDto result = new RelationshipValidationResultDto();

        if (req == null) {
            result.setValid(false);
            result.setCanProceed(false);
            result.setOverallDecision("BLOCKED");
            result.setSummaryMessage("Relationship request payload is required.");
            return result;
        }

        // 1. Resolve Collateral
        Collateral col = resolveCollateral(req.getCollateralId());
        if (col == null) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-01", "Collateral Asset Resolution", "Collateral", false, false,
                    "Specified collateral asset does not exist: " + req.getCollateralId(), null, "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
            result.setSummaryMessage("Collateral not found.");
            result.setOverallDecision("BLOCKED");
            return result;
        }

        // 2. Resolve Loan / Facility
        LoanAccount loan = resolveFacility(req.getLoanAccountId() != null ? req.getLoanAccountId() : req.getFacilityId());
        if (loan == null) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-02", "Facility / Loan Account Resolution", "Facility", false, false,
                    "Specified credit facility / loan account does not exist.", null, "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
            result.setSummaryMessage("Loan / facility not found.");
            result.setOverallDecision("BLOCKED");
            return result;
        }

        // Populate Entity Identity & Diagnostics
        result.setCollateralId(col.getId());
        result.setCollateralCode(col.getCode());
        result.setCollateralDescription(col.getDescription());
        result.setCollateralStatus(col.getStatus());
        result.setCollateralCurrency(col.getCurrency() != null ? col.getCurrency() : "ETB");

        result.setFacilityId(loan.getId());
        result.setLoanReference(loan.getLoanReference());
        result.setAccountNumber(loan.getAccountNumber());
        result.setFacilityStatus(loan.getStatus());
        result.setFacilityCurrency(loan.getLineCurrency() != null ? loan.getLineCurrency() : "ETB");

        // Borrower Identity
        result.setBorrowerCustomerId(loan.getCustomerId());
        customerRepository.findById(loan.getCustomerId())
                .or(() -> customerRepository.findFirstByCifIgnoreCase(loan.getCustomerId()))
                .ifPresent(c -> {
                    result.setBorrowerName(c.getName());
                    result.setBorrowerCif(c.getCif());
                });

        // Legal Owner Identity & Verification Status (Relationship-Specific Separation)
        CollateralOwnershipInfo ownerInfo = resolveCollateralOwnership(col);
        boolean isBorrowerOwner = checkBorrowerIsCollateralOwner(col, loan);
        boolean isThirdParty = !isBorrowerOwner;
        String relContext = isThirdParty ? "Third-party" : "Borrower-owned";

        String legalOwnerName = ownerInfo.getPrimaryOwnerName();
        String ownerRel = ownerInfo.getRegisteredRelationship();
        String ownerVerStatus = ownerInfo.getVerificationStatus();
        String consentInfo = ownerInfo.getConsentInfo();
        String pledgeRef = ownerInfo.getPledgeAgreementRef();
        double ownershipPct = ownerInfo.getPrimaryOwnershipPct();
        String ownerCustId = ownerInfo.getPrimaryOwnerCustomerId();

        result.setLegalOwnerName(legalOwnerName);
        result.setLegalOwnerCustomerId(ownerCustId);
        result.setLegalOwnerCif(ownerInfo.getPrimaryOwnerCif());
        result.setOwnerType(ownerInfo.getRegisteredOwnerType());
        result.setOwnershipPercentage(ownershipPct);
        result.setOwnerVerificationStatus(ownerVerStatus);
        result.setRelationshipToBorrower(ownerRel);
        result.setConsentStatus(consentInfo);
        result.setPledgeAgreementRef(pledgeRef);

        result.setRelationshipContext(relContext);
        result.setOwnerBorrowerMatch(isBorrowerOwner);
        result.setThirdParty(isThirdParty);

        // Financial master metrics
        double mv = col.getValuationAmount();
        double haircut = col.getHaircut();
        double nsv = mv * (1.0 - (haircut / 100.0));
        result.setNetCollateralValue(nsv);
        result.setRequestedAllocationAmount(req.getAllocatedAmount());
        result.setFacilityOutstandingBalance(loan.getOutstandingBalance());
        result.setFacilityApprovedLimit(loan.getApprovedLimit());

        // Existing active allocations excluding current link (if editing)
        List<LoanCollateralLink> existingActiveLinks = new ArrayList<>();
        existingActiveLinks.addAll(loanCollateralLinkRepository.findByCollateralId(col.getId()));
        if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
            existingActiveLinks.addAll(loanCollateralLinkRepository.findByCollateralId(col.getCode()));
        }
        existingActiveLinks = existingActiveLinks.stream()
                .filter(l -> l.isCapacityConsuming() || "Active".equalsIgnoreCase(l.getStatus()) || "Pending Approval".equalsIgnoreCase(l.getStatus()))
                .filter(l -> req.getId() == null || !req.getId().equalsIgnoreCase(l.getId()))
                .collect(Collectors.toList());

        double currentActiveAllocations = existingActiveLinks.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        double projectedTotal = currentActiveAllocations + req.getAllocatedAmount();
        double remainingUnallocated = Math.max(0, nsv - projectedTotal);

        result.setCurrentActiveAllocations(currentActiveAllocations);
        result.setProjectedTotalAllocation(projectedTotal);
        result.setRemainingUnallocatedSecurity(remainingUnallocated);
        result.setCollateralAllocationPct(nsv > 0 ? (req.getAllocatedAmount() / nsv) * 100.0 : 0.0);
        result.setFacilityCoveragePct(loan.getOutstandingBalance() > 0
                ? (req.getAllocatedAmount() / loan.getOutstandingBalance()) * 100.0
                : (loan.getApprovedLimit() > 0 ? (req.getAllocatedAmount() / loan.getApprovedLimit()) * 100.0 : 100.0));

        // Rule 1: Non-negative and strictly positive allocation amount (Section 18)
        if (req.getAllocatedAmount() <= 0) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-AMT-POS", "Allocation Amount Sign", "Financial", false, false,
                    "Allocated amount must be greater than zero.", null, "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
        } else {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-AMT-POS", "Allocation Amount Sign", "Financial", true, false,
                    "Allocation amount is positive: ETB " + String.format(Locale.ROOT, "%,.2f", req.getAllocatedAmount()), null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        }

        // Rule 2: Allocation Ceiling Check (Section 17 & 18) - Total allocations <= Net Collateral Value
        if (projectedTotal > (nsv + 0.01)) {
            double excess = projectedTotal - nsv;
            result.setExcessAllocationAmount(excess);
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-CAPACITY", "Collateral Security Allocation Capacity", "Capacity", false, false,
                    String.format(Locale.ROOT, "Allocation Overflow (Collateral Capacity Exceeded): Proposed allocation of ETB %,.2f results in total allocation of ETB %,.2f, which exceeds net collateral value (Net Security Value of ETB %,.2f) by ETB %,.2f excess.",
                            req.getAllocatedAmount(), projectedTotal, nsv, excess), "Allocation within NSV capacity", "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
        } else {
            result.setExcessAllocationAmount(0.0);
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-CAPACITY", "Collateral Security Allocation Capacity", "Capacity", true, false,
                    String.format(Locale.ROOT, "Capacity Verified: Remaining unallocated security is ETB %,.2f (%.1f%% of NSV).",
                            remainingUnallocated, nsv > 0 ? (remainingUnallocated / nsv) * 100.0 : 0.0), null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        }

        // Rule 2.5: Rank-Aware Second-Degree Allocation Ceiling Check
        String reqRank = req.getCollateralRank() != null ? req.getCollateralRank().trim() : (col.getCollateralRank() != null ? col.getCollateralRank().trim() : "1st");
        boolean isSecondDegreeLink = "2nd".equalsIgnoreCase(reqRank);

        if (isSecondDegreeLink) {
            String basis = configurationService != null ? configurationService.getChargeDeductionBasis() : "CBS_BALANCE";
            double priorExposure = 0.0;
            if ("REGISTERED_MORTGAGE_AMOUNT".equalsIgnoreCase(basis)) {
                priorExposure = req.getRegisteredMortgageAmount() > 0 ? req.getRegisteredMortgageAmount() : col.getRegisteredMortgageAmount();
            } else {
                priorExposure = req.getFirstDegreeOutstandingBalance() > 0 ? req.getFirstDegreeOutstandingBalance() : col.getFirstDegreeOutstandingBalance();
            }

            if (priorExposure <= 0.0 && req.isFirstDegreeInternal()) {
                String firstColId = req.getFirstDegreeCollateralId() != null ? req.getFirstDegreeCollateralId() : col.getFirstDegreeCollateralId();
                if (firstColId != null && !firstColId.isBlank()) {
                    List<LoanCollateralLink> pLinks = loanCollateralLinkRepository.findByCollateralId(firstColId);
                    for (LoanCollateralLink pl : pLinks) {
                        if (pl.isEffectiveActive()) {
                            LoanAccount pFac = resolveFacility(pl.getLoanAccountId() != null ? pl.getLoanAccountId() : pl.getFacilityId());
                            if (pFac != null) {
                                priorExposure += pFac.getOutstandingBalance();
                            }
                        }
                    }
                }
            }

            double secondDegreeAvailableCeiling = Math.max(0, nsv - priorExposure);
            double existingSecondDegreeAllocations = existingActiveLinks.stream()
                    .filter(l -> "2nd".equalsIgnoreCase(l.getCollateralRank()))
                    .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
            double projectedSecondDegreeTotal = existingSecondDegreeAllocations + req.getAllocatedAmount();

            if (projectedSecondDegreeTotal > (secondDegreeAvailableCeiling + 0.01)) {
                double excess = projectedSecondDegreeTotal - secondDegreeAvailableCeiling;
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-2ND-CAPACITY", "Second-Degree Allocation Ceiling Check", "Capacity", false, false,
                        String.format(Locale.ROOT,
                                "Second-Degree Allocation Overflow: Proposed allocation of ETB %,.2f results in total second-degree allocation of ETB %,.2f, which exceeds available second-degree security capacity of ETB %,.2f (Net Security Value ETB %,.2f less prior-degree senior charge exposure of ETB %,.2f) by ETB %,.2f excess.",
                                req.getAllocatedAmount(), projectedSecondDegreeTotal, secondDegreeAvailableCeiling, nsv, priorExposure, excess),
                        "Available 2nd-Degree Capacity Exceeded", "High"
                );
                check.setSeverity("HARD_STOP");
                result.addCheck(check);
            } else {
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-2ND-CAPACITY", "Second-Degree Allocation Ceiling Check", "Capacity", true, false,
                        String.format(Locale.ROOT,
                                "Second-Degree Capacity Verified: Available security for 2nd-degree is ETB %,.2f (NSV ETB %,.2f less prior senior charge ETB %,.2f). Remaining unallocated 2nd-degree capacity: ETB %,.2f.",
                                secondDegreeAvailableCeiling, nsv, priorExposure, Math.max(0, secondDegreeAvailableCeiling - projectedSecondDegreeTotal)),
                        null, "None"
                );
                check.setSeverity("INFO");
                result.addCheck(check);
            }
        }

        // Rule 3: Duplicate Active Relationship Prevention (Section 14 & 15)
        final String reqId = req.getId() != null ? req.getId().trim() : null;
        boolean isDuplicate = existingActiveLinks.stream()
                .filter(l -> reqId == null || !reqId.equalsIgnoreCase(l.getId()))
                .anyMatch(l -> {
                    String lid = l.getLoanAccountId() != null ? l.getLoanAccountId().trim().toLowerCase() : "";
                    String lfid = l.getFacilityId() != null ? l.getFacilityId().trim().toLowerCase() : "";
                    String tid = loan.getId().toLowerCase();
                    String tref = loan.getLoanReference() != null ? loan.getLoanReference().trim().toLowerCase() : "";
                    String tcode = loan.getLineCode() != null ? loan.getLineCode().trim().toLowerCase() : "";
                    String tacc = loan.getAccountNumber() != null ? loan.getAccountNumber().trim().toLowerCase() : "";
                    return lid.equals(tid) || lid.equals(tref) || lid.equals(tcode) || lid.equals(tacc)
                            || lfid.equals(tid) || lfid.equals(tref) || lfid.equals(tcode);
                });
        if (!isDuplicate && reqId == null) {
            isDuplicate = loanCollateralLinkRepository.existsByCollateralIdAndLoanAccountIdAndStatus(col.getId(), loan.getId(), "Active")
                       || loanCollateralLinkRepository.existsByCollateralIdAndLoanAccountIdAndStatus(col.getId(), loan.getId(), "Pending Approval");
        } else if (!isDuplicate && reqId != null) {
            isDuplicate = loanCollateralLinkRepository.findByCollateralIdAndLoanAccountId(col.getId(), loan.getId()).stream()
                    .filter(l -> l.isCapacityConsuming() || "Active".equalsIgnoreCase(l.getStatus()) || "Pending Approval".equalsIgnoreCase(l.getStatus()))
                    .anyMatch(l -> !l.getId().equalsIgnoreCase(reqId));
        }

        if (isDuplicate) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-DUP", "Duplicate Relationship Prevention", "Integrity", false, false,
                    "Duplicate Relationship Block: This facility is already linked to this collateral.", null, "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
        } else {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-DUP", "Duplicate Relationship Prevention", "Integrity", true, false,
                    "No existing active relationship between this collateral asset and loan facility.", null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        }

        // Rule 3.3: Customer Approval Status Check (Finding 96)
        Customer borrowerCust = customerRepository.findById(loan.getCustomerId())
                .or(() -> customerRepository.findFirstByCifIgnoreCase(loan.getCustomerId())).orElse(null);
        if (borrowerCust != null && ("U".equalsIgnoreCase(borrowerCust.getAuthStat()) || "Pending Approval".equalsIgnoreCase(borrowerCust.getStatus()))) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-BORROWER-AUTH", "Borrower Customer Approval Status", "Governance", false, false,
                    "Borrower customer record (" + (borrowerCust.getCif() != null ? borrowerCust.getCif() : borrowerCust.getName()) + ") is unapproved/pending authorization (authStat='U'). Facility-collateral linking requires approved customer profile.", "Customer Authorization", "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
        }

        if (col.getCustomerId() != null) {
            Customer ownerCust = customerRepository.findById(col.getCustomerId())
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(col.getCustomerId())).orElse(null);
            if (ownerCust != null && ("U".equalsIgnoreCase(ownerCust.getAuthStat()) || "Pending Approval".equalsIgnoreCase(ownerCust.getStatus()))) {
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-OWNER-AUTH", "Collateral Owner Customer Approval Status", "Governance", false, false,
                        "Collateral owner customer record (" + (ownerCust.getCif() != null ? ownerCust.getCif() : ownerCust.getName()) + ") is unapproved/pending authorization (authStat='U'). Linking requires approved customer profile.", "Customer Authorization", "High"
                );
                check.setSeverity("HARD_STOP");
                result.addCheck(check);
            }
        }

        // Rule 3.5: Borrower-to-Loan Account Verification (US-04.5)
        if (req.getBorrowerCustomerId() != null && !req.getBorrowerCustomerId().isBlank()) {
            boolean loanBelongsToBorrower = isCustomerMatch(loan.getCustomerId(), req.getBorrowerCustomerId());
            if (!loanBelongsToBorrower) {
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-BORROWER", "Borrower Facility Alignment", "Integrity", false, false,
                        "US-04.5 Validation Failed: Selected loan account does not belong to the associated borrower (" + req.getBorrowerCustomerId() + ").", null, "High"
                );
                check.setSeverity("HARD_STOP");
                result.addCheck(check);
            } else {
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-BORROWER", "Borrower Facility Alignment", "Integrity", true, false,
                        "Selected loan account belongs to the associated borrower.", null, "None"
                );
                check.setSeverity("INFO");
                result.addCheck(check);
            }
        } else {
            req.setBorrowerCustomerId(loan.getCustomerId());
            result.setBorrowerCustomerId(loan.getCustomerId());
        }

        // Rule 4: Customer Alignment & Third-Party Pledge Authorization (Relationship-Specific)
        if (!isThirdParty) {
            result.setValidationState("NORMAL");
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-CUST", "Customer Ownership Alignment", "Ownership", true, false,
                    "Borrower-Owned Collateral: Legal owner (" + (legalOwnerName != null ? legalOwnerName : "Borrower") + ") matches facility borrower.", null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        } else {
            // Third-party collateral / cross-customer pledge scenario
            String rel = req.getRelationshipToBorrower();
            if (rel == null || rel.isBlank()) rel = ownerRel;
            String pledgeRefUsed = (req.getPledgeAgreementRef() != null && !req.getPledgeAgreementRef().isBlank())
                    ? req.getPledgeAgreementRef() : pledgeRef;
            String consentUsed = (req.getConsentInfo() != null && !req.getConsentInfo().isBlank())
                    ? req.getConsentInfo() : consentInfo;

            boolean hasThirdPartyContext = req.isThirdPartyPledge()
                    || (rel != null && !rel.isBlank() && !rel.equalsIgnoreCase("Borrower") && !rel.equalsIgnoreCase("Self"))
                    || (pledgeRefUsed != null && !pledgeRefUsed.isBlank());

            // Check DMS for authentic unexpired pledge agreement / consent document
            List<OwnershipDocument> colDocs = new ArrayList<>();
            if (ownershipDocumentRepository != null && col.getId() != null) {
                colDocs.addAll(ownershipDocumentRepository.findByCollateralId(col.getId()));
                if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
                    colDocs.addAll(ownershipDocumentRepository.findByCollateralId(col.getCode()));
                }
            }

            boolean hasAuthenticDmsDoc = colDocs.stream().anyMatch(d -> {
                if (d == null) return false;
                String st = d.getStatus() != null ? d.getStatus().trim() : "";
                if ("Archived".equalsIgnoreCase(st) || "Rejected".equalsIgnoreCase(st) || "Deleted".equalsIgnoreCase(st)) return false;
                if (d.getExpiryDate() != null && !d.getExpiryDate().isBlank()) {
                    try {
                        LocalDate exp = LocalDate.parse(d.getExpiryDate().substring(0, 10));
                        if (exp.isBefore(LocalDate.now())) return false;
                    } catch (Exception ignored) {}
                }
                String dt = (d.getType() != null ? d.getType().toLowerCase() : "") + " " + (d.getName() != null ? d.getName().toLowerCase() : "");
                boolean isPledgeType = dt.contains("pledge") || dt.contains("consent") || dt.contains("third-party") || dt.contains("third party");
                boolean hasContent = (d.getFileContent() != null && !d.getFileContent().isBlank())
                        || (d.getDmsRef() != null && !d.getDmsRef().isBlank())
                        || (d.getStoragePath() != null && !d.getStoragePath().isBlank());
                return isPledgeType && hasContent;
            });

            if (!hasAuthenticDmsDoc && req.getConsentDocumentRef() != null && !req.getConsentDocumentRef().isBlank()) {
                if (ownershipDocumentRepository != null) {
                    hasAuthenticDmsDoc = ownershipDocumentRepository.findById(req.getConsentDocumentRef())
                            .filter(d -> !"Archived".equalsIgnoreCase(d.getStatus()) && !"Rejected".equalsIgnoreCase(d.getStatus()))
                            .isPresent();
                }
            }

            // Permitted relationship categories:
            boolean recognized = false;
            if (rel != null && !rel.isBlank() && !rel.equalsIgnoreCase("Borrower") && !rel.equalsIgnoreCase("Self")) {
                String relLower = rel.toLowerCase();
                recognized = relLower.contains("shareholder") ||
                        relLower.contains("parent") ||
                        relLower.contains("director") ||
                        relLower.contains("guarantor") ||
                        relLower.contains("spouse") ||
                        relLower.contains("family") ||
                        relLower.contains("partner") ||
                        relLower.contains("pledgor") ||
                        relLower.contains("other");
            }

            if (!hasThirdPartyContext) {
                // Third-party required: maker has selected facility of another customer, but hasn't entered pledge details yet
                result.setValidationState("THIRD_PARTY_REQUIRED");
                result.setHasRequiredPledgeEvidence(false);
                boolean isBlocking = req.isFinalSubmission();
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-CUST", "Customer Isolation Violation / Third-Party Collateral Arrangement Required", "Third-Party", !isBlocking, false,
                        String.format("Customer Isolation Violation: Third-Party Collateral Pledge Required: Collateral is owned by %s. The facility belongs to %s. This linkage will be treated as a third-party collateral pledge. Collateral registered ownership remains unchanged.",
                                legalOwnerName != null ? legalOwnerName : col.getCustomerId(),
                                result.getBorrowerName() != null ? result.getBorrowerName() : loan.getCustomerId()),
                        "Third-Party Authorization Required", isBlocking ? "High" : "Low"
                );
                check.setSeverity(isBlocking ? "HARD_STOP" : "INFO");
                result.addCheck(check);
            } else if (!recognized) {
                result.setValidationState("THIRD_PARTY_INCOMPLETE");
                result.setHasRequiredPledgeEvidence(false);
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-CUST", "Third-Party Relationship Category", "Third-Party", false, false,
                        "Third-party pledge requires specifying a recognized relationship between legal owner and borrower (e.g. Guarantor, Shareholder, Director, Parent Company, Spouse, Family Member, Business Partner, Other).",
                        "Relationship Category Required", "High"
                );
                check.setSeverity("HARD_STOP");
                result.addCheck(check);
            } else if (!hasAuthenticDmsDoc) {
                result.setValidationState("THIRD_PARTY_INCOMPLETE");
                result.setHasRequiredPledgeEvidence(false);
                result.setRelationshipToBorrower(rel);
                result.setPledgeAgreementRef(pledgeRefUsed);
                result.setConsentStatus(consentUsed);
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-CUST", "Third-Party Document Verification (DMS)", "Third-Party", false, false,
                        "Third-party collateral pledge requires mandatory documents: an authentic, unexpired Third-Party Consent and Pledge Agreement / Letter of Consent and owner consent document filed in DMS. Please file or reference the DMS document.",
                        "Missing Filed Evidence in DMS", "High"
                );
                check.setSeverity("HARD_STOP");
                result.addCheck(check);
            } else {
                result.setValidationState("THIRD_PARTY_VALIDATED");
                result.setHasRequiredPledgeEvidence(true);
                result.setRelationshipToBorrower(rel);
                result.setPledgeAgreementRef(pledgeRefUsed != null ? pledgeRefUsed : "DMS-VERIFIED");
                result.setConsentStatus(consentUsed != null ? consentUsed : "VERIFIED_DOC_ON_FILE");

                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-CUST", "Third-Party Ownership & Prerequisites", "Third-Party", true, false,
                        String.format("Third-Party Pledge Authorized: Collateral owned by %s is pledged for borrower %s with relationship '%s' and verified DMS evidence.",
                                legalOwnerName != null ? legalOwnerName : "Owner",
                                result.getBorrowerName() != null ? result.getBorrowerName() : loan.getCustomerId(),
                                rel),
                        null, "None"
                );
                check.setSeverity("INFO");
                result.addCheck(check);
            }
        }

        // Rule 5: Currency Matching (Section 11)
        String colCurr = col.getCurrency() != null ? col.getCurrency() : "ETB";
        String loanCurr = loan.getLineCurrency() != null ? loan.getLineCurrency() : "ETB";
        boolean currMatch = colCurr.equalsIgnoreCase(loanCurr);
        result.setCurrencyMatched(currMatch);
        if (!currMatch) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-CURR", "Applicable Currency Alignment", "Financial", false, false,
                    String.format("Currency Mismatch: Collateral is denominated in %s while Facility is in %s. Valid FX conversion required.",
                            colCurr, loanCurr), null, "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
        } else {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-CURR", "Applicable Currency Alignment", "Financial", true, false,
                    "Currency aligned: " + colCurr, null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        }

        // Rule 6: Facility Operational Status (Section 31 & Finding 52: positive allow-list)
        if (!isEligibleFacilityStatus(loan.getStatus())) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-FAC-STAT", "Facility Operational Status", "Operational", false, false,
                    "Facility status '" + loan.getStatus() + "' is not an approved eligible status. Must be in: " + ELIGIBLE_FACILITY_STATUSES, null, "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
        } else {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-FAC-STAT", "Facility Operational Status", "Operational", true, false,
                    "Facility status '" + loan.getStatus() + "' is Active/Eligible for security linkage.", null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        }

        // Finding 54: Charge-rank combined-exposure assessment & link-level degree validation
        if (col != null && firstDegreeSecondDegreeService != null) {
            try {
                FirstDegreeSecondDegreeService.SecondDegreeValidationResult secResult =
                        firstDegreeSecondDegreeService.validateSecondDegreeLink(req, col, loan);
                if (secResult != null && secResult.getChecks() != null) {
                    for (ValidationCheckItemDto chk : secResult.getChecks()) {
                        result.addCheck(chk);
                    }
                }
            } catch (Exception ex) {
                log.warn("Second degree exposure assessment warning for collateral {}: {}", col.getId(), ex.getMessage());
            }
        }

        result.setDuplicate(isDuplicate);
        result.setThirdPartyRequired(isThirdParty);
        result.setFirstDegreeRequired(!isSecondDegreeLink);
        result.setSecondDegreeRequired(isSecondDegreeLink);

        List<String> reqDocs = new ArrayList<>();
        if (isThirdParty) {
            reqDocs.add("Pledge Agreement / Cross-Pledge Contract");
            reqDocs.add("Owner Written Consent / Board Resolution");
        }
        if (isSecondDegreeLink) {
            reqDocs.add("1st-Degree Charge Confirmation / No-Objection Letter");
            reqDocs.add("Cadastral Extract / Land Registry Title Deed");
        }
        reqDocs.add("Current Valuation Report");
        result.setRequiredDocuments(reqDocs);

        if (result.isValid() || result.isCanProceed()) {
            if ("THIRD_PARTY_REQUIRED".equals(result.getValidationState())) {
                result.setSummaryMessage("Third-party collateral relationship detected. Provide relationship-specific pledge information and DMS agreement reference.");
                result.setOverallDecision("CAN_PROCEED");
            } else if ("THIRD_PARTY_VALIDATED".equals(result.getValidationState())) {
                result.setSummaryMessage("Third-party pledge validated with authentic evidence. All relationship criteria satisfied.");
                result.setOverallDecision("CAN_PROCEED");
            } else {
                result.setSummaryMessage("All relationship criteria and security allocation limits are satisfied.");
                result.setOverallDecision("CAN_PROCEED");
            }
        } else {
            result.setSummaryMessage("Relationship validation failed due to business or compliance rule violations.");
            if (!result.isCanProceed()) {
                result.setOverallDecision("BLOCKED");
            } else {
                result.setOverallDecision("REQUIRES_CORRECTION");
            }
        }

        return result;
    }

    // =========================================================================
    // 4. CREATE RELATIONSHIP (SECTION 4, 5, 20, 39)
    // =========================================================================

    @Transactional
    public CollateralFacilityLinkDto createRelationship(RelationshipRequestDto req, String userId) {
        req.setFinalSubmission(true);
        RelationshipValidationResultDto val = validateRelationship(req);
        if (!val.isCanProceed()) {
            throw new IllegalArgumentException("Cannot create relationship:\n• " +
                    val.getChecks().stream().filter(c -> !c.isPassed()).map(ValidationCheckItemDto::getMessage).collect(Collectors.joining("\n• ")));
        }

        Collateral col = resolveCollateral(req.getCollateralId());
        LoanAccount loan = resolveFacility(req.getLoanAccountId() != null ? req.getLoanAccountId() : req.getFacilityId());

        // Concurrency Protection: Acquire pessimistic write lock on Collateral to protect capacity
        Collateral lockedCol = collateralRepository.findByIdForUpdate(col.getId()).orElse(col);
        double nsv = lockedCol.getValuationAmount() * (1.0 - (lockedCol.getHaircut() / 100.0));

        // Atomically re-verify capacity within write lock to prevent race condition
        List<LoanCollateralLink> currentActiveLinks = new ArrayList<>();
        currentActiveLinks.addAll(loanCollateralLinkRepository.findByCollateralId(lockedCol.getId()));
        if (lockedCol.getCode() != null && !lockedCol.getCode().equalsIgnoreCase(lockedCol.getId())) {
            currentActiveLinks.addAll(loanCollateralLinkRepository.findByCollateralId(lockedCol.getCode()));
        }
        currentActiveLinks = currentActiveLinks.stream()
                .filter(l -> l.isCapacityConsuming())
                .filter(l -> req.getId() == null || !req.getId().equalsIgnoreCase(l.getId()))
                .collect(Collectors.toList());

        double currentActiveAllocations = currentActiveLinks.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        double projected = currentActiveAllocations + req.getAllocatedAmount();
        if (projected > nsv + 0.01) {
            double excess = projected - nsv;
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                    "Allocation Overflow (Collateral Capacity Exceeded): Total allocation of ETB %,.2f exceeds net collateral value (exceeds collateral Net Security Value of ETB %,.2f) by ETB %,.2f excess. Write transaction aborted to prevent concurrent over-allocation.",
                    projected, nsv, excess));
        }

        // Rank-Aware Second-Degree Atomic Capacity Check
        String proposedRank = req.getCollateralRank() != null ? req.getCollateralRank().trim() : (lockedCol.getCollateralRank() != null ? lockedCol.getCollateralRank().trim() : "1st");
        if ("2nd".equalsIgnoreCase(proposedRank)) {
            String basis = configurationService != null ? configurationService.getChargeDeductionBasis() : "CBS_BALANCE";
            double priorExposure = 0.0;
            if ("REGISTERED_MORTGAGE_AMOUNT".equalsIgnoreCase(basis)) {
                priorExposure = req.getRegisteredMortgageAmount() > 0 ? req.getRegisteredMortgageAmount() : lockedCol.getRegisteredMortgageAmount();
            } else {
                priorExposure = req.getFirstDegreeOutstandingBalance() > 0 ? req.getFirstDegreeOutstandingBalance() : lockedCol.getFirstDegreeOutstandingBalance();
            }
            if (priorExposure <= 0.0 && req.isFirstDegreeInternal()) {
                String firstColId = req.getFirstDegreeCollateralId() != null ? req.getFirstDegreeCollateralId() : lockedCol.getFirstDegreeCollateralId();
                if (firstColId != null && !firstColId.isBlank()) {
                    List<LoanCollateralLink> pLinks = loanCollateralLinkRepository.findByCollateralId(firstColId);
                    for (LoanCollateralLink pl : pLinks) {
                        if (pl.isEffectiveActive()) {
                            LoanAccount pFac = resolveFacility(pl.getLoanAccountId() != null ? pl.getLoanAccountId() : pl.getFacilityId());
                            if (pFac != null) {
                                priorExposure += pFac.getOutstandingBalance();
                            }
                        }
                    }
                }
            }
            double secondDegreeAvailableCeiling = Math.max(0, nsv - priorExposure);
            double existingSecondDegreeAllocations = currentActiveLinks.stream()
                    .filter(l -> "2nd".equalsIgnoreCase(l.getCollateralRank()))
                    .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
            double projectedSecondDegree = existingSecondDegreeAllocations + req.getAllocatedAmount();
            if (projectedSecondDegree > secondDegreeAvailableCeiling + 0.01) {
                double excess = projectedSecondDegree - secondDegreeAvailableCeiling;
                throw new IllegalArgumentException(String.format(Locale.ROOT,
                        "Second-Degree Allocation Overflow: Proposed allocation of ETB %,.2f results in total second-degree allocation of ETB %,.2f, which exceeds available second-degree security capacity of ETB %,.2f (NSV ETB %,.2f less prior senior charge of ETB %,.2f) by ETB %,.2f excess. Write transaction aborted.",
                        req.getAllocatedAmount(), projectedSecondDegree, secondDegreeAvailableCeiling, nsv, priorExposure, excess));
            }
        }

        // Check user portfolio authorization scope (Section 7 & 12) - must fail closed
        if (userId != null && !userId.isBlank() && dashboardService != null) {
            try {
                DashboardService.ResolvedScope scope = dashboardService.resolveUserScope(userId, null, null, null);
                if (scope != null && !scope.isBankWide()) {
                    dashboardService.checkLeafEntityAccess(scope, loan.getBranch(), loan.getSegment());
                    if (lockedCol.getBranch() != null || lockedCol.getOwningSegment() != null) {
                        dashboardService.checkLeafEntityAccess(scope, lockedCol.getBranch(), lockedCol.getOwningSegment());
                    }
                }
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Portfolio Scope Violation: " + e.getMessage());
            } catch (Exception ex) {
                throw new IllegalStateException("Portfolio Scope Enforcement Error: Failed to resolve or verify user branch/segment scope. Access denied: " + ex.getMessage());
            }
        }

        String linkId = req.getId() != null && !req.getId().isBlank() ? req.getId() : "LNK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        LoanCollateralLink link = new LoanCollateralLink();
        link.setId(linkId);
        link.setCollateralId(lockedCol.getId());
        link.setLoanAccountId(loan.getId());
        link.setFacilityId(loan.getLineCode() != null && !loan.getLineCode().isBlank() ? loan.getLineCode() : loan.getId());
        link.setCustomerId(loan.getCustomerId());
        link.setAllocatedAmount(req.getAllocatedAmount());
        link.setLinkedAmount(req.getAllocatedAmount());
        link.setLinkageType(req.getLinkageType() != null ? req.getLinkageType() : "Primary");
        link.setUtilOrder(req.getUtilOrder() > 0 ? req.getUtilOrder() : 1);
        link.setReinstateOrder(req.getReinstateOrder() > 0 ? req.getReinstateOrder() : 1);
        link.setEffectiveDate(req.getEffectiveDate() != null ? req.getEffectiveDate() : LocalDate.now().toString());
        link.setEndDate(req.getEndDate());
        link.setChangeReason(req.getChangeReason() != null ? req.getChangeReason() : "Initial relationship registration");

        // Determine relationship-specific ownership context (NEVER mutate collateral master ownership)
        boolean isBorrowerOwner = checkBorrowerIsCollateralOwner(lockedCol, loan);
        boolean isThirdParty = !isBorrowerOwner;
        String relContext = isThirdParty ? "Third-party" : "Borrower-owned";

        link.setRelationshipContext(relContext);
        link.setThirdParty(isThirdParty);
        link.setRelationshipToBorrower(isThirdParty ? req.getRelationshipToBorrower() : "Self");
        link.setPledgeAgreementRef(isThirdParty ? req.getPledgeAgreementRef() : null);
        link.setConsentInfo(isThirdParty ? req.getConsentInfo() : null);
        link.setConsentDocumentRef(isThirdParty ? req.getConsentDocumentRef() : null);

        if (isThirdParty) {
            String desc = "Third-Party Pledge | Borrower: " + loan.getCustomerId();
            if (req.getRelationshipToBorrower() != null && !req.getRelationshipToBorrower().isBlank()) {
                desc += " | Rel: " + req.getRelationshipToBorrower();
            }
            if (req.getPledgeAgreementRef() != null && !req.getPledgeAgreementRef().isBlank()) {
                desc += " | Pledge Ref: " + req.getPledgeAgreementRef();
                link.setLinkedReferenceNo(req.getPledgeAgreementRef());
            }
            link.setDescription(desc);
        } else {
            link.setDescription("Borrower-Owned Security Linkage");
        }

        // CBS snapshot references
        link.setCbsFacilityRef(loan.getLineCode());
        link.setCbsLoanAccount(loan.getAccountNumber() != null ? loan.getAccountNumber() : loan.getLoanReference());
        link.setCbsCollateralRef(lockedCol.getCode());
        link.setSource(req.getSource() != null ? req.getSource() : "CIMS");
        link.setSourceRecordId(req.getSourceRecordId());

        // Percentages
        link.setCollateralAllocationPct(nsv > 0 ? (req.getAllocatedAmount() / nsv) * 100.0 : 0.0);
        link.setLinkedPercentage(link.getCollateralAllocationPct());
        link.setFacilityCoveragePct(loan.getOutstandingBalance() > 0
                ? (req.getAllocatedAmount() / loan.getOutstandingBalance()) * 100.0
                : (loan.getApprovedLimit() > 0 ? (req.getAllocatedAmount() / loan.getApprovedLimit()) * 100.0 : 100.0));

        // Link-Level Charge Rank & Ownership Separation
        link.setCollateralRank(proposedRank);
        link.setFirstDegreeInternal(req.isFirstDegreeInternal());
        link.setFirstDegreeCollateralId(req.getFirstDegreeCollateralId());
        link.setFirstDegreeHolderName(req.getFirstDegreeHolderName());
        link.setFirstDegreeFacilityRef(req.getFirstDegreeFacilityRef());
        link.setFirstDegreeOutstandingBalance(req.getFirstDegreeOutstandingBalance());
        link.setFirstDegreeBalanceAsOfDate(req.getFirstDegreeBalanceAsOfDate());
        link.setRegisteredMortgageAmount(req.getRegisteredMortgageAmount());
        link.setMortgageRegistrationNumber(req.getMortgageRegistrationNumber());
        link.setMortgageRegistrationDate(req.getMortgageRegistrationDate());
        link.setFirstDegreePolicyNumber(req.getFirstDegreePolicyNumber());
        link.setFirstDegreeInsurer(req.getFirstDegreeInsurer());
        link.setFirstDegreePolicyExpiry(req.getFirstDegreePolicyExpiry());
        link.setBankNotedAsSecondMortgagee(req.isBankNotedAsSecondMortgagee());
        link.setFirstDegreeConfirmationDocId(req.getFirstDegreeConfirmationDocId());
        link.setFirstDegreeExtractDocId(req.getFirstDegreeExtractDocId());
        link.setBorrowerCustomerId(loan.getCustomerId());
        link.setLegalOwnerCustomerId(lockedCol.getCustomerId());
        link.setLegalOwnerName(val.getLegalOwnerName());
        link.setOwnerWithoutCif(lockedCol.isOwnerWithoutCif() || req.isOwnerWithoutCif());

        // Governance & Status - Dual Control Maker-Checker (Audit Finding 1)
        com.bank.cims.model.User caller = resolveActor(userId);
        boolean systemContext = authorizationScopeService.currentUser() == null;
        boolean isAutomated = systemContext && ("CBS_SYNC".equalsIgnoreCase(req.getSource())
                || "MIGRATION".equalsIgnoreCase(req.getSource())
                || "SYSTEM".equalsIgnoreCase(req.getSource())
                || "TEST".equalsIgnoreCase(req.getSource())
                || "DIRECT".equalsIgnoreCase(req.getSource())
                || "Active".equalsIgnoreCase(req.getStatus())
                || req.isDirectActive());
        String initialStatus = isAutomated ? "Active" : "Pending Approval";
        String authStat = isAutomated ? "A" : "U";
        String recordStat = isAutomated ? "O" : "U";

        link.setStatus(initialStatus);
        link.setRelationshipStatus(initialStatus);
        link.setReleaseStatus("Eligible");
        link.setMakerId(userId);
        link.setMakerDtStamp(LocalDateTime.now().toString());
        link.setAuthStat(authStat);
        link.setRecordStat(recordStat);
        link.setModNo(1);
        if (isAutomated) {
            link.setCheckerId(userId != null ? userId : "SYSTEM");
            link.setCheckerDtStamp(LocalDateTime.now().toString());
        }

        loanCollateralLinkRepository.save(link);

        // Submit to workflow for checker authorization if created by maker
        if (!isAutomated && workflowExecutionService != null) {
            workflowExecutionService.submitToWorkflow(
                    "LoanCollateralLink",
                    link.getId(),
                    "LINK_CREATION",
                    userId != null ? userId : "MAKER",
                    req.getChangeReason() != null ? req.getChangeReason() : "Collateral-facility link creation pending checker authorization",
                    null
            );
        }

        // Record history snapshot (Section 28)
        recordHistory(link, 0.0, req.getAllocatedAmount(), "None", link.getLinkageType(),
                null, link.getEffectiveDate(), null, link.getEndDate(),
                "None", initialStatus, "CREATED", link.getChangeReason(), userId);

        // Recalculate downstream exposures (Section 14 & 18)
        updateCollateralAndFacilityAggregates(lockedCol, loan);

        // Audit Log (Section 41)
        logAudit(userId, "MAKER", "CREATE_COLLATERAL_FACILITY_LINK", "LoanCollateralLink", link.getId(),
                "Allocation", "0.00", String.valueOf(req.getAllocatedAmount()),
                String.format("Linked Collateral %s to Loan %s with ETB %,.2f allocated.", lockedCol.getCode(), loan.getLoanReference(), req.getAllocatedAmount()));

        return toDto(link, lockedCol, loan);
    }

    // =========================================================================
    // 5. UPDATE RELATIONSHIP (SECTION 22 & 39)
    // =========================================================================

    @Transactional
    public CollateralFacilityLinkDto updateRelationship(String linkId, RelationshipRequestDto req, String userId) {
        LoanCollateralLink link = loanCollateralLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Relationship not found: " + linkId));

        req.setId(linkId);
        if (req.getCollateralId() == null) req.setCollateralId(link.getCollateralId());
        if (req.getLoanAccountId() == null) req.setLoanAccountId(link.getLoanAccountId());

        RelationshipValidationResultDto val = validateRelationship(req);
        if (!val.isCanProceed()) {
            throw new IllegalArgumentException("Cannot update relationship:\n• " +
                    val.getChecks().stream().filter(c -> !c.isPassed()).map(ValidationCheckItemDto::getMessage).collect(Collectors.joining("\n• ")));
        }

        Collateral col = resolveCollateral(link.getCollateralId());
        LoanAccount loan = resolveFacility(link.getLoanAccountId());

        // Concurrency Protection: Acquire pessimistic write lock on Collateral to protect capacity
        Collateral lockedCol = collateralRepository.findByIdForUpdate(col.getId()).orElse(col);
        double nsv = lockedCol.getValuationAmount() * (1.0 - (lockedCol.getHaircut() / 100.0));

        // Atomically re-verify capacity within write lock excluding current link's prior amount
        List<LoanCollateralLink> currentActiveLinks = new ArrayList<>();
        currentActiveLinks.addAll(loanCollateralLinkRepository.findByCollateralId(lockedCol.getId()));
        if (lockedCol.getCode() != null && !lockedCol.getCode().equalsIgnoreCase(lockedCol.getId())) {
            currentActiveLinks.addAll(loanCollateralLinkRepository.findByCollateralId(lockedCol.getCode()));
        }
        currentActiveLinks = currentActiveLinks.stream()
                .filter(l -> l.isCapacityConsuming())
                .filter(l -> !linkId.equalsIgnoreCase(l.getId()))
                .collect(Collectors.toList());

        double currentActiveAllocations = currentActiveLinks.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
        double projected = currentActiveAllocations + req.getAllocatedAmount();
        if (projected > nsv + 0.01) {
            double excess = projected - nsv;
            throw new IllegalArgumentException(String.format(Locale.ROOT,
                    "Allocation Overflow (Collateral Capacity Exceeded): Total allocation of ETB %,.2f exceeds net collateral value (exceeds collateral Net Security Value of ETB %,.2f) by ETB %,.2f excess. Write transaction aborted to prevent concurrent over-allocation.",
                    projected, nsv, excess));
        }

        // Rank-Aware Second-Degree Atomic Capacity Check
        String proposedRank = req.getCollateralRank() != null ? req.getCollateralRank().trim() : (lockedCol.getCollateralRank() != null ? lockedCol.getCollateralRank().trim() : "1st");
        if ("2nd".equalsIgnoreCase(proposedRank)) {
            String basis = configurationService != null ? configurationService.getChargeDeductionBasis() : "CBS_BALANCE";
            double priorExposure = 0.0;
            if ("REGISTERED_MORTGAGE_AMOUNT".equalsIgnoreCase(basis)) {
                priorExposure = req.getRegisteredMortgageAmount() > 0 ? req.getRegisteredMortgageAmount() : lockedCol.getRegisteredMortgageAmount();
            } else {
                priorExposure = req.getFirstDegreeOutstandingBalance() > 0 ? req.getFirstDegreeOutstandingBalance() : lockedCol.getFirstDegreeOutstandingBalance();
            }
            if (priorExposure <= 0.0 && req.isFirstDegreeInternal()) {
                String firstColId = req.getFirstDegreeCollateralId() != null ? req.getFirstDegreeCollateralId() : lockedCol.getFirstDegreeCollateralId();
                if (firstColId != null && !firstColId.isBlank()) {
                    List<LoanCollateralLink> pLinks = loanCollateralLinkRepository.findByCollateralId(firstColId);
                    for (LoanCollateralLink pl : pLinks) {
                        if (pl.isEffectiveActive()) {
                            LoanAccount pFac = resolveFacility(pl.getLoanAccountId() != null ? pl.getLoanAccountId() : pl.getFacilityId());
                            if (pFac != null) {
                                priorExposure += pFac.getOutstandingBalance();
                            }
                        }
                    }
                }
            }
            double secondDegreeAvailableCeiling = Math.max(0, nsv - priorExposure);
            double existingSecondDegreeAllocations = currentActiveLinks.stream()
                    .filter(l -> "2nd".equalsIgnoreCase(l.getCollateralRank()))
                    .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
            double projectedSecondDegree = existingSecondDegreeAllocations + req.getAllocatedAmount();
            if (projectedSecondDegree > secondDegreeAvailableCeiling + 0.01) {
                double excess = projectedSecondDegree - secondDegreeAvailableCeiling;
                throw new IllegalArgumentException(String.format(Locale.ROOT,
                        "Second-Degree Allocation Overflow: Proposed allocation of ETB %,.2f results in total second-degree allocation of ETB %,.2f, which exceeds available second-degree security capacity of ETB %,.2f (NSV ETB %,.2f less prior senior charge of ETB %,.2f) by ETB %,.2f excess. Write transaction aborted.",
                        req.getAllocatedAmount(), projectedSecondDegree, secondDegreeAvailableCeiling, nsv, priorExposure, excess));
            }
        }

        // Snapshot prior values for history
        double priorAlloc = link.getAllocatedAmount();
        String priorLinkType = link.getLinkageType();
        String priorEffDate = link.getEffectiveDate();
        String priorEndDate = link.getEndDate();
        String priorStatus = link.getStatus();

        // Update fields
        link.setAllocatedAmount(req.getAllocatedAmount());
        link.setLinkedAmount(req.getAllocatedAmount());
        if (req.getLinkageType() != null) link.setLinkageType(req.getLinkageType());
        if (req.getUtilOrder() > 0) link.setUtilOrder(req.getUtilOrder());
        if (req.getReinstateOrder() > 0) link.setReinstateOrder(req.getReinstateOrder());
        if (req.getEffectiveDate() != null) link.setEffectiveDate(req.getEffectiveDate());
        if (req.getEndDate() != null) link.setEndDate(req.getEndDate());
        if (req.getChangeReason() != null) link.setChangeReason(req.getChangeReason());

        link.setCollateralAllocationPct(nsv > 0 ? (req.getAllocatedAmount() / nsv) * 100.0 : 0.0);
        link.setLinkedPercentage(link.getCollateralAllocationPct());
        link.setFacilityCoveragePct(loan.getOutstandingBalance() > 0
                ? (req.getAllocatedAmount() / loan.getOutstandingBalance()) * 100.0
                : (loan.getApprovedLimit() > 0 ? (req.getAllocatedAmount() / loan.getApprovedLimit()) * 100.0 : 100.0));

        if (req.getCollateralRank() != null) link.setCollateralRank(req.getCollateralRank());
        link.setFirstDegreeInternal(req.isFirstDegreeInternal());
        if (req.getFirstDegreeCollateralId() != null) link.setFirstDegreeCollateralId(req.getFirstDegreeCollateralId());
        if (req.getFirstDegreeHolderName() != null) link.setFirstDegreeHolderName(req.getFirstDegreeHolderName());
        if (req.getFirstDegreeFacilityRef() != null) link.setFirstDegreeFacilityRef(req.getFirstDegreeFacilityRef());
        if (req.getFirstDegreeOutstandingBalance() > 0) link.setFirstDegreeOutstandingBalance(req.getFirstDegreeOutstandingBalance());
        if (req.getFirstDegreeBalanceAsOfDate() != null) link.setFirstDegreeBalanceAsOfDate(req.getFirstDegreeBalanceAsOfDate());
        if (req.getRegisteredMortgageAmount() > 0) link.setRegisteredMortgageAmount(req.getRegisteredMortgageAmount());
        if (req.getMortgageRegistrationNumber() != null) link.setMortgageRegistrationNumber(req.getMortgageRegistrationNumber());
        if (req.getMortgageRegistrationDate() != null) link.setMortgageRegistrationDate(req.getMortgageRegistrationDate());
        if (req.getFirstDegreePolicyNumber() != null) link.setFirstDegreePolicyNumber(req.getFirstDegreePolicyNumber());
        if (req.getFirstDegreeInsurer() != null) link.setFirstDegreeInsurer(req.getFirstDegreeInsurer());
        if (req.getFirstDegreePolicyExpiry() != null) link.setFirstDegreePolicyExpiry(req.getFirstDegreePolicyExpiry());
        link.setBankNotedAsSecondMortgagee(req.isBankNotedAsSecondMortgagee());
        if (req.getFirstDegreeConfirmationDocId() != null) link.setFirstDegreeConfirmationDocId(req.getFirstDegreeConfirmationDocId());
        if (req.getFirstDegreeExtractDocId() != null) link.setFirstDegreeExtractDocId(req.getFirstDegreeExtractDocId());

        if (req.getRelationshipToBorrower() != null) link.setRelationshipToBorrower(req.getRelationshipToBorrower());
        if (req.getPledgeAgreementRef() != null) link.setPledgeAgreementRef(req.getPledgeAgreementRef());
        if (req.getConsentInfo() != null) link.setConsentInfo(req.getConsentInfo());
        if (req.getConsentDocumentRef() != null) link.setConsentDocumentRef(req.getConsentDocumentRef());
        if (req.getRelationshipContext() != null) link.setRelationshipContext(req.getRelationshipContext());
        if (req.isThirdPartyPledge() || "Third-party".equalsIgnoreCase(link.getRelationshipContext())) link.setThirdParty(true);

        link.setModNo(link.getModNo() + 1);

        // Record actual actor role (Finding 83)
        User caller = resolveActor(userId);
        String actorRole = caller != null && caller.getRole() != null ? caller.getRole() : "MAKER";
        boolean isChecker = isConfiguredLinkApprover(caller, "LINK_UPDATE");

        if (isChecker) {
            link.setCheckerId(userId);
            link.setCheckerDtStamp(LocalDateTime.now().toString());
            link.setAuthStat("A");
            link.setRecordStat("O");
        } else {
            link.setMakerId(userId);
            link.setMakerDtStamp(LocalDateTime.now().toString());
            link.setAuthStat("U");
            link.setRecordStat("U");
            if (workflowExecutionService != null) {
                workflowExecutionService.submitToWorkflow(
                        "LoanCollateralLink",
                        link.getId(),
                        "LINK_UPDATE",
                        userId != null ? userId : "MAKER",
                        req.getChangeReason() != null ? req.getChangeReason() : "Collateral-facility link update pending checker authorization",
                        null
                );
            }
        }

        loanCollateralLinkRepository.save(link);

        // Record history snapshot (Section 28)
        String action = priorAlloc != req.getAllocatedAmount() ? "ALLOCATION_CHANGED" : "UPDATED";
        recordHistory(link, priorAlloc, req.getAllocatedAmount(), priorLinkType, link.getLinkageType(),
                priorEffDate, link.getEffectiveDate(), priorEndDate, link.getEndDate(),
                priorStatus, link.getStatus(), action, link.getChangeReason(), userId);

        // Recalculate downstream exposures
        updateCollateralAndFacilityAggregates(lockedCol, loan);

        // Audit Log (Section 41 & Finding 83)
        logAudit(userId, actorRole, "UPDATE_COLLATERAL_FACILITY_LINK", "LoanCollateralLink", link.getId(),
                "Allocation", String.valueOf(priorAlloc), String.valueOf(req.getAllocatedAmount()),
                String.format("Updated relationship %s: Allocation changed from ETB %,.2f to ETB %,.2f.", linkId, priorAlloc, req.getAllocatedAmount()));

        return toDto(link, lockedCol, loan);
    }

    // =========================================================================
    // 6. END RELATIONSHIP (SECTION 23 & 39 - NO HARD DELETE)
    // =========================================================================

    @Transactional
    public CollateralFacilityLinkDto endRelationship(String linkId, String reason, String userId) {
        LoanCollateralLink link = loanCollateralLinkRepository.findById(linkId)
                .orElseThrow(() -> new IllegalArgumentException("Relationship not found: " + linkId));

        Collateral col = resolveCollateral(link.getCollateralId());
        LoanAccount loan = resolveFacility(link.getLoanAccountId());

        double priorAlloc = link.getAllocatedAmount();
        String priorStatus = link.getStatus();

        User caller = resolveActor(userId);
        String actorRole = caller != null && caller.getRole() != null ? caller.getRole() : ("SYSTEM".equalsIgnoreCase(userId) ? "SYSTEM" : "MAKER");
        boolean isAuthorizedChecker = "SYSTEM".equalsIgnoreCase(userId) || isConfiguredLinkApprover(caller, "LINK_TERMINATION");

        // Finding 84: Ending a relationship requires release impact check if facility has uncleared balance
        if (loan != null && loan.getOutstandingBalance() > 0 && !"Closed".equalsIgnoreCase(loan.getStatus()) && !"Settled".equalsIgnoreCase(loan.getStatus())) {
            if (!isAuthorizedChecker) {
                throw new IllegalArgumentException(String.format(Locale.ROOT,
                        "Cannot end relationship %s: Linked facility %s has uncleared balance of ETB %,.2f. Deallocation affecting secured exposure requires release impact assessment and authorized checker approval.",
                        linkId, loan.getLoanReference(), loan.getOutstandingBalance()));
            }
        }

        if (!isAuthorizedChecker && workflowExecutionService != null) {
            link.setAuthStat("U");
            link.setRecordStat("U");
            loanCollateralLinkRepository.save(link);
            workflowExecutionService.submitToWorkflow(
                    "LoanCollateralLink",
                    link.getId(),
                    "LINK_TERMINATION",
                    userId != null ? userId : "MAKER",
                    reason != null ? reason : "Collateral-facility link termination pending checker authorization",
                    null
            );
            logAudit(userId, actorRole, "SUBMIT_END_COLLATERAL_FACILITY_LINK", "LoanCollateralLink", link.getId(),
                    "Status", priorStatus, "Termination Pending", reason);
            return toDto(link, col, loan);
        }

        link.setStatus("Ended");
        link.setRelationshipStatus("Ended");
        link.setReleaseStatus("Released");
        link.setEndDate(LocalDateTime.now().toString());
        link.setChangeReason(reason != null ? reason : "Relationship terminated / obligation cleared");
        link.setCheckerId(userId);
        link.setCheckerDtStamp(LocalDateTime.now().toString());

        loanCollateralLinkRepository.save(link);

        // Record history snapshot (Section 28)
        recordHistory(link, priorAlloc, 0.0, link.getLinkageType(), link.getLinkageType(),
                link.getEffectiveDate(), link.getEffectiveDate(), link.getEndDate(), link.getEndDate(),
                priorStatus, "Ended", "ENDED", link.getChangeReason(), userId);

        // Recalculate downstream exposures
        updateCollateralAndFacilityAggregates(col, loan);

        // Check if internal first-degree charge was released/closed, flag linked 2nd-degree charges for promotion
        if (firstDegreeSecondDegreeService != null && col != null) {
            firstDegreeSecondDegreeService.checkAndFlagSecondDegreePromotion(col.getId(), reason, userId);
        }

        // Audit Log (Section 41 & Finding 83)
        logAudit(userId, actorRole, "REMOVE_COLLATERAL_FACILITY_LINK", "LoanCollateralLink", link.getId(),
                "Status", priorStatus, "Ended",
                String.format("Ended relationship between Collateral %s and Loan %s: %s", col != null ? col.getCode() : "N/A", loan != null ? loan.getLoanReference() : "N/A", reason));

        return toDto(link, col, loan);
    }

    // =========================================================================
    // 7. COLLATERAL RELEASE VALIDATION (SECTION 24 - RELATIONSHIP AWARE)
    // =========================================================================

    public Map<String, Object> validateCollateralRelease(String collateralId) {
        Collateral col = resolveCollateral(collateralId);
        if (col == null) {
            throw new IllegalArgumentException("Collateral not found: " + collateralId);
        }

        List<LoanCollateralLink> activeLinks = loanCollateralLinkRepository.findByCollateralId(col.getId()).stream()
                .filter(l -> l.isEffectiveActive())
                .collect(Collectors.toList());

        List<Map<String, Object>> blockedObligations = new ArrayList<>();
        double totalUnclearedExposure = 0;

        for (LoanCollateralLink l : activeLinks) {
            LoanAccount fac = resolveFacility(l.getLoanAccountId());
            if (fac != null && fac.getOutstandingBalance() > 0 && !"Closed".equalsIgnoreCase(fac.getStatus()) && !"Settled".equalsIgnoreCase(fac.getStatus())) {
                totalUnclearedExposure += fac.getOutstandingBalance();
                blockedObligations.add(Map.of(
                        "linkId", l.getId(),
                        "loanReference", fac.getLoanReference(),
                        "facilityType", fac.getFacilityType(),
                        "outstandingBalance", fac.getOutstandingBalance(),
                        "allocatedSecurity", l.getAllocatedAmount(),
                        "status", fac.getStatus()
                ));
            }
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("collateralId", col.getId());
        resp.put("collateralCode", col.getCode());
        resp.put("activeLinksCount", activeLinks.size());
        resp.put("totalUnclearedExposure", totalUnclearedExposure);
        resp.put("blockedObligations", blockedObligations);

        if (blockedObligations.isEmpty()) {
            resp.put("eligibleForRelease", true);
            resp.put("message", "Collateral is eligible for release. All linked credit facility obligations are settled or closed.");
        } else {
            resp.put("eligibleForRelease", false);
            resp.put("message", String.format(Locale.ROOT,
                    "Collateral cannot be released because it secures %d active credit obligation(s) with aggregate outstanding exposure of ETB %,.2f. Approved exception or full settlement is required.",
                    blockedObligations.size(), totalUnclearedExposure));
        }

        return resp;
    }

    // =========================================================================
    // 8. DOUBLE-COUNTING CORRECTION: PORTFOLIO EXPOSURE SUMMARY (SECTION 15)
    // =========================================================================

    public Map<String, Object> calculateBankPortfolioExposure() {
        List<LoanAccount> allFacilities = loanAccountRepository.findAll();
        List<Collateral> allCollaterals = collateralRepository.findAll();
        List<LoanCollateralLink> activeLinks = loanCollateralLinkRepository.findByStatus("Active");

        // 1. Collateral-level aggregate secured exposure (sum of linked facilities per collateral)
        double totalCollateralAggregateExposure = 0;
        for (Collateral c : allCollaterals) {
            Set<String> linkedFacIds = activeLinks.stream()
                    .filter(l -> l.getCollateralId().equalsIgnoreCase(c.getId()) || (c.getCode() != null && l.getCollateralId().equalsIgnoreCase(c.getCode())))
                    .map(LoanCollateralLink::getLoanAccountId)
                    .collect(Collectors.toSet());

            double colExp = allFacilities.stream()
                    .filter(f -> linkedFacIds.contains(f.getId()) || linkedFacIds.contains(f.getLoanReference()))
                    .mapToDouble(LoanAccount::getOutstandingBalance)
                    .sum();
            totalCollateralAggregateExposure += colExp;
        }

        // 2. Bank-wide Portfolio Exposure (COUNT EACH FACILITY ONCE - PREVENT DOUBLE COUNTING)
        double trueBankPortfolioExposure = allFacilities.stream()
                .mapToDouble(LoanAccount::getOutstandingBalance)
                .sum();

        // 3. Total Secured Bank Exposure (Facilities that have at least one active collateral link, counted ONCE)
        Set<String> securedFacIds = activeLinks.stream()
                .map(LoanCollateralLink::getLoanAccountId)
                .collect(Collectors.toSet());

        double trueSecuredPortfolioExposure = allFacilities.stream()
                .filter(f -> securedFacIds.contains(f.getId()) || securedFacIds.contains(f.getLoanReference()))
                .mapToDouble(LoanAccount::getOutstandingBalance)
                .sum();

        // 4. Total Collateral Allocated Value
        double totalAllocatedSecurity = activeLinks.stream()
                .mapToDouble(LoanCollateralLink::getAllocatedAmount)
                .sum();

        Map<String, Object> resp = new HashMap<>();
        resp.put("totalFacilitiesCount", allFacilities.size());
        resp.put("securedFacilitiesCount", securedFacIds.size());
        resp.put("totalCollateralsCount", allCollaterals.size());
        resp.put("activeLinksCount", activeLinks.size());
        resp.put("trueBankPortfolioExposure", trueBankPortfolioExposure);
        resp.put("trueSecuredPortfolioExposure", trueSecuredPortfolioExposure);
        resp.put("totalCollateralAggregateExposure", totalCollateralAggregateExposure);
        resp.put("totalAllocatedSecurity", totalAllocatedSecurity);
        resp.put("doubleCountingDifferential", totalCollateralAggregateExposure - trueSecuredPortfolioExposure);
        resp.put("explanation", "Bank portfolio exposure counts each credit facility exactly once. Collateral-level aggregate exposure reflects total risk secured per individual collateral asset under cross-collateralization.");

        return resp;
    }

    // =========================================================================
    // 9. CBS RECONCILIATION (SECTION 29)
    // =========================================================================

    public CbsRelationshipReconciliationDto reconcileCbsRelationships() {
        CbsRelationshipReconciliationDto dto = new CbsRelationshipReconciliationDto();
        dto.setReconciliationTimestamp(LocalDateTime.now().toString());

        if (cbsGateway == null) {
            dto.setTotalCbsRelationships(0);
            dto.setTotalCimsRelationships((int) loanCollateralLinkRepository.count());
            return dto;
        }

        List<CbsAccCollLinkDtls> cbsLinks = cbsGateway.fetchAllAccountCollateralLinks();
        List<LoanCollateralLink> cimsLinks = loanCollateralLinkRepository.findAll();

        dto.setTotalCbsRelationships(cbsLinks.size());
        dto.setTotalCimsRelationships(cimsLinks.size());

        Map<String, CbsAccCollLinkDtls> cbsById = cbsLinks.stream()
                .collect(Collectors.toMap(CbsAccCollLinkDtls::getId, c -> c, (a, b) -> a));
        Map<String, LoanCollateralLink> cimsById = cimsLinks.stream()
                .collect(Collectors.toMap(LoanCollateralLink::getId, c -> c, (a, b) -> a));

        int matchCount = 0;
        int changedCount = 0;
        int cbsOnlyCount = 0;
        int cimsOnlyCount = 0;

        List<CbsRelationshipReconciliationDto.ReconciliationItem> items = new ArrayList<>();

        for (CbsAccCollLinkDtls cbs : cbsLinks) {
            LoanCollateralLink cims = cimsById.get(cbs.getId());
            CbsRelationshipReconciliationDto.ReconciliationItem item = new CbsRelationshipReconciliationDto.ReconciliationItem();
            item.setLinkId(cbs.getId());
            item.setLoanAccountId(cbs.getAccountNumber());
            item.setCollateralId(cbs.getLinkedReferenceNo());
            item.setCbsLinkedAmount(cbs.getLinkedAmount());
            item.setCbsLinkageType(cbs.getLinkageType());
            item.setCbsStatus(cbs.getStatus());

            if (cims != null) {
                item.setCimsAllocatedAmount(cims.getAllocatedAmount());
                item.setCimsLinkageType(cims.getLinkageType());
                item.setCimsStatus(cims.getStatus());

                boolean amountMatches = Math.abs(cbs.getLinkedAmount() - cims.getAllocatedAmount()) < 0.01;
                boolean typeMatches = Objects.equals(cbs.getLinkageType(), cims.getLinkageType());
                boolean statusMatches = Objects.equals(cbs.getStatus(), cims.getStatus());

                if (amountMatches && typeMatches && statusMatches) {
                    item.setStatus("MATCHING");
                    item.setDifferenceSummary("Perfect sync with CBS source record.");
                    matchCount++;
                } else {
                    item.setStatus("CHANGED_IN_CBS");
                    List<String> diffs = new ArrayList<>();
                    if (!amountMatches) diffs.add(String.format(Locale.ROOT, "Amount: CBS ETB %,.2f vs CIMS ETB %,.2f", cbs.getLinkedAmount(), cims.getAllocatedAmount()));
                    if (!typeMatches) diffs.add(String.format("Type: CBS %s vs CIMS %s", cbs.getLinkageType(), cims.getLinkageType()));
                    if (!statusMatches) diffs.add(String.format("Status: CBS %s vs CIMS %s", cbs.getStatus(), cims.getStatus()));
                    item.setDifferenceSummary(String.join("; ", diffs));
                    changedCount++;
                }
            } else {
                item.setStatus("CBS_ONLY");
                item.setDifferenceSummary("Present in CBS but missing in CIMS database.");
                cbsOnlyCount++;
            }
            items.add(item);
        }

        for (LoanCollateralLink cims : cimsLinks) {
            if (!cbsById.containsKey(cims.getId())) {
                CbsRelationshipReconciliationDto.ReconciliationItem item = new CbsRelationshipReconciliationDto.ReconciliationItem();
                item.setLinkId(cims.getId());
                item.setLoanAccountId(cims.getLoanAccountId());
                item.setCollateralId(cims.getCollateralId());
                item.setCimsAllocatedAmount(cims.getAllocatedAmount());
                item.setCimsLinkageType(cims.getLinkageType());
                item.setCimsStatus(cims.getStatus());
                item.setStatus("CIMS_ONLY");
                item.setDifferenceSummary("CIMS-native relationship (Not originated from CBS).");
                cimsOnlyCount++;
                items.add(item);
            }
        }

        dto.setMatchingCount(matchCount);
        dto.setChangedCount(changedCount);
        dto.setCbsOnlyCount(cbsOnlyCount);
        dto.setCimsOnlyCount(cimsOnlyCount);
        dto.setItems(items);

        return dto;
    }

    // =========================================================================
    // 10. HELPER METHODS & ENTITY MAPPINGS
    // =========================================================================

    private CollateralFacilityLinkDto toDto(LoanCollateralLink link, Collateral preCol, LoanAccount preLoan) {
        CollateralFacilityLinkDto dto = new CollateralFacilityLinkDto();
        dto.setId(link.getId());
        dto.setCollateralId(link.getCollateralId());
        dto.setLoanAccountId(link.getLoanAccountId());
        dto.setFacilityId(link.getFacilityId());
        dto.setCustomerId(link.getCustomerId());
        dto.setAllocatedAmount(link.getAllocatedAmount());
        dto.setLinkedAmount(link.getLinkedAmount());
        dto.setLinkageType(link.getLinkageType());
        dto.setUtilOrder(link.getUtilOrder());
        dto.setReinstateOrder(link.getReinstateOrder());
        dto.setEffectiveDate(link.getEffectiveDate());
        dto.setEndDate(link.getEndDate());
        dto.setRelationshipStatus(link.getRelationshipStatus() != null ? link.getRelationshipStatus() : link.getStatus());
        dto.setReleaseStatus(link.getReleaseStatus());
        dto.setSource(link.getSource());
        dto.setSourceRecordId(link.getSourceRecordId());
        dto.setCbsFacilityRef(link.getCbsFacilityRef());
        dto.setCbsLoanAccount(link.getCbsLoanAccount());
        dto.setCbsCollateralRef(link.getCbsCollateralRef());
        dto.setMakerId(link.getMakerId());
        dto.setMakerDtStamp(link.getMakerDtStamp());
        dto.setCheckerId(link.getCheckerId());
        dto.setCheckerDtStamp(link.getCheckerDtStamp());
        dto.setRecordStat(link.getRecordStat());
        dto.setAuthStat(link.getAuthStat());
        dto.setModNo(link.getModNo());
        dto.setChangeReason(link.getChangeReason());

        dto.setCollateralRank(link.getCollateralRank() != null ? link.getCollateralRank() : "1st");
        dto.setFirstDegreeInternal(link.isFirstDegreeInternal());
        dto.setFirstDegreeCollateralId(link.getFirstDegreeCollateralId());
        dto.setFirstDegreeHolderName(link.getFirstDegreeHolderName());
        dto.setFirstDegreeFacilityRef(link.getFirstDegreeFacilityRef());
        dto.setFirstDegreeOutstandingBalance(link.getFirstDegreeOutstandingBalance());
        dto.setFirstDegreeBalanceAsOfDate(link.getFirstDegreeBalanceAsOfDate());
        dto.setRegisteredMortgageAmount(link.getRegisteredMortgageAmount());
        dto.setMortgageRegistrationNumber(link.getMortgageRegistrationNumber());
        dto.setMortgageRegistrationDate(link.getMortgageRegistrationDate());
        dto.setFirstDegreePolicyNumber(link.getFirstDegreePolicyNumber());
        dto.setFirstDegreeInsurer(link.getFirstDegreeInsurer());
        dto.setFirstDegreePolicyExpiry(link.getFirstDegreePolicyExpiry());
        dto.setBankNotedAsSecondMortgagee(link.isBankNotedAsSecondMortgagee());
        dto.setFirstDegreeConfirmationDocId(link.getFirstDegreeConfirmationDocId());
        dto.setFirstDegreeExtractDocId(link.getFirstDegreeExtractDocId());
        dto.setLegalOwnerName(link.getLegalOwnerName());
        dto.setOwnerWithoutCif(link.isOwnerWithoutCif());

        Collateral col = preCol != null ? preCol : resolveCollateral(link.getCollateralId());
        if (col != null) {
            dto.setCollateralCode(col.getCode());
            dto.setCollateralDescription(col.getDescription());
            dto.setCollateralCategory(col.getCategory());
            dto.setCollateralType(col.getType());
            dto.setCollateralOwnerType(col.getOwnerType());
            dto.setCollateralValuation(col.getValuationAmount());
            dto.setCollateralHaircut(col.getHaircut());
            double nsv = col.getValuationAmount() * (1.0 - (col.getHaircut() / 100.0));
            dto.setNetCollateralValue(nsv);
            dto.setCollateralUnallocatedSecurity(Math.max(0, nsv - (col.getCurrentAllocation() > 0 ? col.getCurrentAllocation() : link.getAllocatedAmount())));

            dto.setCollateralAllocationPct(nsv > 0 ? (link.getAllocatedAmount() / nsv) * 100.0 : 0.0);

            // Prior Charge Deduction and Available Security for Rank
            double priorCharge = 0.0;
            if ("2nd".equalsIgnoreCase(dto.getCollateralRank()) || "2nd".equalsIgnoreCase(col.getCollateralRank())) {
                String basis = configurationService != null ? configurationService.getChargeDeductionBasis() : "CBS_BALANCE";
                if ("REGISTERED_MORTGAGE_AMOUNT".equalsIgnoreCase(basis)) {
                    priorCharge = link.getRegisteredMortgageAmount() > 0 ? link.getRegisteredMortgageAmount() : col.getRegisteredMortgageAmount();
                } else {
                    priorCharge = link.getFirstDegreeOutstandingBalance() > 0 ? link.getFirstDegreeOutstandingBalance() : col.getFirstDegreeOutstandingBalance();
                }
                dto.setPriorChargeDeduction(priorCharge);
                dto.setAvailableSecurityForRank(Math.max(0, nsv - priorCharge));
            } else {
                dto.setPriorChargeDeduction(0.0);
                dto.setAvailableSecurityForRank(nsv);
            }

            // Legal Owner Identity & Verification Status
            List<CollateralOwner> owners = col.getOwners();
            if ((owners == null || owners.isEmpty()) && collateralOwnerRepository != null) {
                owners = collateralOwnerRepository.findByCollateralId(col.getId());
                if ((owners == null || owners.isEmpty()) && col.getCode() != null) {
                    owners = collateralOwnerRepository.findByCollateralId(col.getCode());
                }
            }

            String legalOwnerName = null;
            String ownerRel = "Borrower";
            String ownerVerStatus = col.getVerificationStatus() != null ? col.getVerificationStatus() : "Recorded";
            String consentInfo = null;
            String pledgeRef = null;
            double ownershipPct = 100.0;
            String ownerCustId = col.getCustomerId();

            if (owners != null && !owners.isEmpty()) {
                List<String> names = new ArrayList<>();
                for (CollateralOwner o : owners) {
                    if (o.getName() != null && !o.getName().isBlank()) {
                        names.add(o.getName().trim());
                    }
                }
                legalOwnerName = String.join(", ", names);
                CollateralOwner primaryOwner = owners.get(0);
                ownerRel = primaryOwner.getRelationshipToBorrower() != null ? primaryOwner.getRelationshipToBorrower() : primaryOwner.getRelationship();
                if (primaryOwner.getVerificationStatus() != null) ownerVerStatus = primaryOwner.getVerificationStatus();
                consentInfo = primaryOwner.getConsentInfo();
                pledgeRef = primaryOwner.getPledgeAgreementRef();
                ownershipPct = primaryOwner.getPercentage();
            } else if (col.getCustomerId() != null) {
                Customer ownerCust = customerRepository.findById(col.getCustomerId())
                        .or(() -> customerRepository.findFirstByCifIgnoreCase(col.getCustomerId())).orElse(null);
                legalOwnerName = ownerCust != null ? ownerCust.getName() : col.getCustomerId();
            }

            dto.setLegalOwnerNames(legalOwnerName);
            dto.setCollateralOwnerCustomerId(ownerCustId);
            dto.setRelationshipToBorrower(ownerRel);
            dto.setOwnershipPercentage(ownershipPct);
            dto.setOwnershipVerificationStatus(ownerVerStatus);
            dto.setConsentInfo(consentInfo);
            dto.setPledgeAgreementRef(pledgeRef);

            if (ownerCustId != null) {
                customerRepository.findById(ownerCustId)
                        .or(() -> customerRepository.findFirstByCifIgnoreCase(ownerCustId))
                        .ifPresent(oc -> dto.setCollateralOwnerCif(oc.getCif()));
            }

            // Insurance context for collateral
            List<InsurancePolicy> pols = insurancePolicyRepository.findByCollateralId(col.getId());
            if (pols.isEmpty() && col.getCode() != null) {
                pols = insurancePolicyRepository.findByCollateralId(col.getCode());
            }
            double insAmt = pols.stream()
                    .filter(p -> "Active".equalsIgnoreCase(p.getStatus()) || "Approved".equalsIgnoreCase(p.getStatus()))
                    .mapToDouble(InsurancePolicy::getInsuredAmount).sum();
            dto.setActiveInsuranceAmount(insAmt);
            dto.setLinkedPolicyCount(pols.size());
            dto.setInsuranceStatus(col.getInsuranceStatus());
        }

        LoanAccount loan = preLoan != null ? preLoan : resolveFacility(link.getLoanAccountId());
        if (loan != null) {
            dto.setLoanReference(loan.getLoanReference());
            dto.setAccountNumber(loan.getAccountNumber());
            dto.setFacilityType(loan.getFacilityType());
            dto.setFacilityCurrency(loan.getLineCurrency() != null ? loan.getLineCurrency() : "ETB");
            dto.setApprovedLimit(loan.getApprovedLimit());
            dto.setOutstandingBalance(loan.getOutstandingBalance());
            dto.setAvailableAmount(loan.getAvailableAmount() > 0 ? loan.getAvailableAmount() : Math.max(0, loan.getApprovedLimit() - loan.getOutstandingBalance()));
            dto.setBusinessSegment(loan.getSegment());
            dto.setBranch(loan.getBranch());
            dto.setRelationshipManager(loan.getRmUserId());
            dto.setFacilityStatus(loan.getStatus());

            dto.setFacilityCoveragePct(loan.getOutstandingBalance() > 0
                    ? (link.getAllocatedAmount() / loan.getOutstandingBalance()) * 100.0
                    : (loan.getApprovedLimit() > 0 ? (link.getAllocatedAmount() / loan.getApprovedLimit()) * 100.0 : 100.0));

            // Borrower Customer Identity
            dto.setBorrowerCustomerId(loan.getCustomerId());
            customerRepository.findById(loan.getCustomerId())
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(loan.getCustomerId()))
                    .ifPresent(c -> {
                        dto.setCustomerName(c.getName());
                        dto.setCustomerCif(c.getCif());
                        dto.setBorrowerName(c.getName());
                        dto.setBorrowerCif(c.getCif());
                    });
        }

        // Determine Relationship-Specific Context
        String relContext = link.getRelationshipContext();
        if (relContext == null || relContext.isBlank()) {
            boolean borrowerOwns = col != null && loan != null && checkBorrowerIsCollateralOwner(col, loan);
            relContext = borrowerOwns ? "Borrower-owned" : "Third-party";
        }
        boolean isThirdParty = link.isThirdParty() || "Third-party".equalsIgnoreCase(relContext);
        dto.setRelationshipContext(relContext);
        dto.setThirdParty(isThirdParty);

        if (link.getRelationshipToBorrower() != null && !link.getRelationshipToBorrower().isBlank()) {
            dto.setRelationshipToBorrower(link.getRelationshipToBorrower());
        }
        if (link.getPledgeAgreementRef() != null && !link.getPledgeAgreementRef().isBlank()) {
            dto.setPledgeAgreementRef(link.getPledgeAgreementRef());
        }
        if (link.getConsentInfo() != null && !link.getConsentInfo().isBlank()) {
            dto.setConsentInfo(link.getConsentInfo());
        }
        if (link.getConsentDocumentRef() != null && !link.getConsentDocumentRef().isBlank()) {
            dto.setConsentDocumentRef(link.getConsentDocumentRef());
        }

        return dto;
    }

    private Collateral resolveCollateral(String idOrCode) {
        if (idOrCode == null || idOrCode.isBlank()) return null;
        return collateralRepository.findById(idOrCode)
                .or(() -> collateralRepository.findByCode(idOrCode))
                .orElse(null);
    }

    private LoanAccount resolveFacility(String idOrRef) {
        if (idOrRef == null || idOrRef.isBlank()) return null;
        return loanAccountRepository.findById(idOrRef)
                .or(() -> loanAccountRepository.findByLoanReference(idOrRef))
                .or(() -> loanAccountRepository.findFirstByLineCodeIgnoreCase(idOrRef))
                .orElse(null);
    }

    private void updateCollateralAndFacilityAggregates(Collateral col, LoanAccount loan) {
        if (col != null) {
            List<LoanCollateralLink> activeLinks = loanCollateralLinkRepository.findByCollateralId(col.getId()).stream()
                    .filter(l -> l.isEffectiveActive())
                    .collect(Collectors.toList());
            double totalAlloc = activeLinks.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
            double nsv = col.getValuationAmount() * (1.0 - (col.getHaircut() / 100.0));

            col.setCurrentAllocation(totalAlloc);
            col.setUtilizationPercentage(nsv > 0 ? (totalAlloc / nsv) * 100.0 : 0.0);
            collateralRepository.save(col);

            try {
                exposureCalculationService.calculateExposureAndAdequacy(col.getId());
            } catch (Exception ex) {
                log.warn("Downstream exposure recalculation error for collateral {}: {}", col.getId(), ex.getMessage());
            }
        }

        if (loan != null) {
            List<LoanCollateralLink> activeLinks = loanCollateralLinkRepository.findByLoanAccountId(loan.getId()).stream()
                    .filter(l -> l.isEffectiveActive())
                    .collect(Collectors.toList());
            double totalColContribution = activeLinks.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
            loan.setCollateralContribution(totalColContribution);
            double pct = loan.getOutstandingBalance() > 0
                    ? (totalColContribution / loan.getOutstandingBalance()) * 100.0
                    : (loan.getApprovedLimit() > 0 ? (totalColContribution / loan.getApprovedLimit()) * 100.0 : 100.0);
            loan.setCollateralPct(Math.round(pct * 100.0) / 100.0);
            loanAccountRepository.save(loan);
        }
    }

    // =========================================================================
    // 7. ALLOCATE COLLATERAL FACILITIES (CENTRALIZED HISTORICAL MANAGEMENT)
    // =========================================================================
    @Transactional
    public Map<String, Object> allocateCollateralFacilities(String collateralId, List<Map<String, Object>> allocations, String userId) {
        // Finding 82: Explicit default is false for fullReplacement to avoid silently removing unmentioned links
        return allocateCollateralFacilities(collateralId, allocations, false, userId);
    }

    @Transactional
    public Map<String, Object> allocateCollateralFacilities(String collateralId, List<Map<String, Object>> allocations, boolean fullReplacement, String userId) {
        Collateral collateral = resolveCollateral(collateralId);
        if (collateral == null) {
            throw new IllegalArgumentException("Collateral not found: " + collateralId);
        }

        double netValue = collateral.getNsv();
        List<LoanAccount> matchedLoans = new ArrayList<>();
        List<Double> allocAmounts = new ArrayList<>();
        Set<String> targetLoanIds = new HashSet<>();

        if (allocations != null) {
            for (Map<String, Object> a : allocations) {
                String facId = (String) a.get("facilityId");
                if (facId == null) facId = (String) a.get("loanAccountId");
                if (facId == null) continue;
                final String fId = facId;
                LoanAccount loan = resolveFacility(fId);
                if (loan == null) {
                    throw new IllegalArgumentException("Facility not found: " + fId);
                }

                // Finding 81: Full relationship validation per facility link
                RelationshipRequestDto relReq = new RelationshipRequestDto();
                relReq.setCollateralId(collateral.getId());
                relReq.setLoanAccountId(loan.getId());
                relReq.setFacilityId(loan.getLineCode() != null ? loan.getLineCode() : loan.getId());
                double amt = Double.parseDouble(a.get("allocatedAmount") != null ? a.get("allocatedAmount").toString() : "0");
                relReq.setAllocatedAmount(amt);
                relReq.setLinkageType((String) a.getOrDefault("linkageType", "Primary"));
                relReq.setUserId(userId);
                relReq.setThirdPartyPledge(a.get("thirdPartyPledge") != null && Boolean.parseBoolean(a.get("thirdPartyPledge").toString()));
                if (a.get("relationshipToBorrower") != null) relReq.setRelationshipToBorrower(a.get("relationshipToBorrower").toString());
                if (a.get("pledgeAgreementRef") != null) relReq.setPledgeAgreementRef(a.get("pledgeAgreementRef").toString());
                if (a.get("consentInfo") != null) relReq.setConsentInfo(a.get("consentInfo").toString());
                if (a.get("consentDocumentRef") != null) relReq.setConsentDocumentRef(a.get("consentDocumentRef").toString());

                RelationshipValidationResultDto val = validateRelationship(relReq);
                if (!val.isCanProceed()) {
                    throw new IllegalArgumentException("Relationship validation failed for facility " + loan.getLoanReference() + ": " +
                            val.getChecks().stream().filter(c -> !c.isPassed()).map(ValidationCheckItemDto::getMessage).collect(Collectors.joining("; ")));
                }

                // Prevent duplicate targets within the same allocation request
                if (targetLoanIds.contains(loan.getId())) {
                    throw new IllegalArgumentException("Duplicate facility in allocation: " + loan.getLoanReference());
                }
                targetLoanIds.add(loan.getId());
                matchedLoans.add(loan);

                if (amt <= 0) {
                    throw new IllegalArgumentException("Allocated amount must be greater than zero.");
                }
                allocAmounts.add(amt);
            }
        }

        if (!allocAmounts.isEmpty()) {
            validationService.validateAllocationOverflow(netValue, allocAmounts);
        }

        // Maintain historical link records instead of hard-deleting (Section 16)
        List<LoanCollateralLink> existingLinks = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        Map<String, LoanCollateralLink> activeLinksByLoanId = new HashMap<>();
        for (LoanCollateralLink el : existingLinks) {
            if ("Active".equalsIgnoreCase(el.getStatus()) || "Active".equalsIgnoreCase(el.getRelationshipStatus())) {
                activeLinksByLoanId.put(el.getLoanAccountId(), el);
            }
        }

        // Archive links that are not in targetLoanIds ONLY if fullReplacement is explicitly true (Section 8 critical safety rule)
        if (fullReplacement) {
            for (Map.Entry<String, LoanCollateralLink> entry : activeLinksByLoanId.entrySet()) {
                if (!targetLoanIds.contains(entry.getKey())) {
                    LoanCollateralLink linkToArchive = entry.getValue();
                    double priorAlloc = linkToArchive.getAllocatedAmount();
                    linkToArchive.setStatus("Historical");
                    linkToArchive.setRelationshipStatus("Historical");
                    linkToArchive.setEndDate(LocalDateTime.now().toString());
                    loanCollateralLinkRepository.save(linkToArchive);
                    recordHistory(linkToArchive, priorAlloc, 0.0, linkToArchive.getLinkageType(), linkToArchive.getLinkageType(),
                            linkToArchive.getEffectiveDate(), linkToArchive.getEffectiveDate(), null, linkToArchive.getEndDate(),
                            "Active", "Historical", "DEALLOCATED", "Facility removed in multi-allocation update", userId);
                }
            }
        }

        // Upsert links for targets: preserve unchanged links, update modified ones, insert new ones
        double totalAlloc = 0;
        if (allocations != null) {
            for (int i = 0; i < allocations.size(); i++) {
                Map<String, Object> a = allocations.get(i);
                LoanAccount loan = matchedLoans.get(i);
                double amt = allocAmounts.get(i);
                String lType = (String) a.getOrDefault("linkageType", "Primary");

                LoanCollateralLink link = activeLinksByLoanId.get(loan.getId());
                if (link != null) {
                    double priorAlloc = link.getAllocatedAmount();
                    boolean changed = Math.abs(priorAlloc - amt) > 1e-4 || !lType.equalsIgnoreCase(link.getLinkageType());
                    if (changed) {
                        link.setAllocatedAmount(amt);
                        link.setLinkedAmount(amt);
                        link.setLinkedPercent(netValue > 0 ? (amt / netValue) * 100.0 : 0);
                        link.setLinkedPercentage(link.getLinkedPercent());
                        link.setCollateralAllocationPct(link.getLinkedPercent());
                        link.setLinkageType(lType);
                        link.setModNo(link.getModNo() + 1);
                        link.setCheckerId(userId);
                        link.setCheckerDtStamp(LocalDateTime.now().toString());
                        loanCollateralLinkRepository.save(link);
                        recordHistory(link, priorAlloc, amt, link.getLinkageType(), lType,
                                link.getEffectiveDate(), link.getEffectiveDate(), null, null,
                                "Active", "Active", "REALLOCATED", "Allocation amount updated", userId);
                    }
                } else {
                    // Finding 80: Bulk allocation dual-control approval routing
                    User caller = resolveActor(userId);
                    String actorRole = caller != null && caller.getRole() != null ? caller.getRole() : "MAKER";
                    boolean isChecker = isConfiguredLinkApprover(caller, "LINK_CREATION");

                    link = new LoanCollateralLink("LNK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(), loan.getId(), collateral.getId(), amt);
                    link.setFacilityId(loan.getLineCode() != null ? loan.getLineCode() : loan.getId());
                    link.setCustomerId(loan.getCustomerId());
                    link.setLinkageType(lType);
                    link.setLinkedAmount(amt);
                    link.setLinkedPercent(netValue > 0 ? (amt / netValue) * 100.0 : 0);
                    link.setLinkedPercentage(link.getLinkedPercent());
                    link.setCollateralAllocationPct(link.getLinkedPercent());
                    link.setHaircut(collateral.getHaircut());
                    link.setCollateralCategory(collateral.getCategory());
                    boolean isBorrowerOwner = checkBorrowerIsCollateralOwner(collateral, loan);
                    boolean isThirdParty = !isBorrowerOwner;
                    link.setRelationshipContext(isThirdParty ? "Third-party" : "Borrower-owned");
                    link.setThirdParty(isThirdParty);
                    link.setRelationshipToBorrower(isThirdParty ? (String) a.get("relationshipToBorrower") : "Self");
                    if (a.get("pledgeAgreementRef") != null) link.setPledgeAgreementRef(a.get("pledgeAgreementRef").toString());
                    if (a.get("consentInfo") != null) link.setConsentInfo(a.get("consentInfo").toString());
                    if (a.get("consentDocumentRef") != null) link.setConsentDocumentRef(a.get("consentDocumentRef").toString());
                    link.setStatus(isChecker ? "Active" : "Pending Approval");
                    link.setRelationshipStatus(isChecker ? "Active" : "Pending Approval");
                    link.setReleaseStatus("Eligible");
                    link.setEffectiveDate(LocalDateTime.now().toString());
                    link.setMakerId(userId);
                    link.setMakerDtStamp(LocalDateTime.now().toString());
                    link.setRecordStat(isChecker ? "O" : "U");
                    link.setAuthStat(isChecker ? "A" : "U");
                    if (isChecker) {
                        link.setCheckerId(userId != null ? userId : "SYSTEM");
                        link.setCheckerDtStamp(LocalDateTime.now().toString());
                    }
                    loanCollateralLinkRepository.save(link);

                    if (!isChecker && workflowExecutionService != null) {
                        workflowExecutionService.submitToWorkflow(
                                "LoanCollateralLink",
                                link.getId(),
                                "LINK_CREATION",
                                userId != null ? userId : "MAKER",
                                "Bulk allocation link creation pending checker authorization",
                                null
                        );
                    }

                    recordHistory(link, 0.0, amt, "None", lType,
                            null, link.getEffectiveDate(), null, null,
                            "None", link.getStatus(), "ALLOCATED", "Facility allocated in multi-allocation update", userId);
                }
                totalAlloc += amt;
            }
        }

        collateral.setCurrentAllocation(totalAlloc);
        collateral.setUtilizationPercentage(netValue > 0 ? (totalAlloc / netValue) * 100.0 : 0);
        collateralRepository.save(collateral);

        exposureCalculationService.calculateExposureAndAdequacy(collateral.getId());

        logAudit(userId, "CRO", "ALLOCATE_COLLATERAL_FACILITIES", "Collateral", collateral.getId(),
                "CurrentAllocation", String.valueOf(collateral.getCurrentAllocation()), String.valueOf(totalAlloc),
                "Allocated facilities for collateral " + collateral.getCode());

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("collateralId", collateral.getId());
        resp.put("currentAllocation", totalAlloc);
        resp.put("utilizationPercentage", collateral.getUtilizationPercentage());
        return resp;
    }

    // =========================================================================
    // 8. DUPLICATE COLLATERAL SEARCH BEFORE REGISTRATION (SECTION 23 & 24)
    // =========================================================================
    public Map<String, Object> searchExistingCollateral(String code, String titleDeedNumber, String registrationNumber, String excludeId) {
        List<Collateral> allCols = collateralRepository.findAll();
        for (Collateral c : allCols) {
            if (excludeId != null && excludeId.equalsIgnoreCase(c.getId())) continue;

            boolean match = false;
            String matchField = null;

            if (code != null && !code.isBlank() && code.trim().equalsIgnoreCase(c.getCode())) {
                match = true;
                matchField = "Collateral Code (" + code + ")";
            } else if (titleDeedNumber != null && !titleDeedNumber.isBlank() && c.getTitleDeedNumber() != null
                    && titleDeedNumber.trim().equalsIgnoreCase(c.getTitleDeedNumber().trim())) {
                match = true;
                matchField = "Title Deed Number (" + titleDeedNumber + ")";
            } else if (registrationNumber != null && !registrationNumber.isBlank() && c.getRegistrationNumber() != null
                    && registrationNumber.trim().equalsIgnoreCase(c.getRegistrationNumber().trim())) {
                match = true;
                matchField = "Registration Number (" + registrationNumber + ")";
            }

            if (match) {
                List<CollateralFacilityLinkDto> links = getRelationshipsForCollateral(c.getId());
                Customer cust = customerRepository.findById(c.getCustomerId())
                        .or(() -> customerRepository.findFirstByCifIgnoreCase(c.getCustomerId()))
                        .orElse(null);

                Map<String, Object> resp = new HashMap<>();
                resp.put("found", true);
                resp.put("matchReason", matchField);
                resp.put("collateralId", c.getId());
                resp.put("collateralCode", c.getCode());
                resp.put("customerId", c.getCustomerId());
                resp.put("customerName", cust != null ? cust.getName() : c.getCustomerId());
                resp.put("ownerType", c.getOwnerType());
                resp.put("collateralType", c.getType() != null ? c.getType() : c.getCategory());
                resp.put("titleDeedNumber", c.getTitleDeedNumber());
                resp.put("registrationNumber", c.getRegistrationNumber());
                resp.put("status", c.getStatus());
                resp.put("valuationAmount", c.getValuationAmount());
                resp.put("linkedFacilitiesCount", links.size());
                resp.put("linkedFacilities", links);
                return resp;
            }
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("found", false);
        return resp;
    }

    private boolean isCustomerMatch(String cust1, String cust2) {
        if (cust1 == null || cust2 == null) return false;
        if (cust1.trim().equalsIgnoreCase(cust2.trim())) return true;
        Customer c1 = customerRepository.findById(cust1).or(() -> customerRepository.findFirstByCifIgnoreCase(cust1)).orElse(null);
        Customer c2 = customerRepository.findById(cust2).or(() -> customerRepository.findFirstByCifIgnoreCase(cust2)).orElse(null);
        if (c1 != null && c2 != null && c1.getCif() != null && c1.getCif().equalsIgnoreCase(c2.getCif())) return true;
        return false;
    }

    private Set<String> resolveCustomerIds(String custIdOrCif) {
        Set<String> set = new HashSet<>();
        if (custIdOrCif == null || custIdOrCif.isBlank()) return set;
        String raw = custIdOrCif.trim();
        String trimmed = raw.toLowerCase();
        set.add(trimmed);
        Customer c = customerRepository.findById(raw)
                .or(() -> customerRepository.findFirstByCifIgnoreCase(raw))
                .or(() -> customerRepository.findFirstByNameIgnoreCase(raw))
                .orElse(null);
        if (c == null) {
            c = customerRepository.findAll().stream()
                    .filter(cust -> cust.getName() != null && cust.getName().trim().equalsIgnoreCase(raw))
                    .findFirst()
                    .orElse(null);
        }
        if (c != null) {
            if (c.getId() != null) set.add(c.getId().trim().toLowerCase());
            if (c.getCif() != null) set.add(c.getCif().trim().toLowerCase());
            if (c.getName() != null) set.add(c.getName().trim().toLowerCase());
        }
        return set;
    }

    private void recordHistory(LoanCollateralLink link, double prevAmt, double newAmt,
                               String prevType, String newType, String prevEff, String newEff,
                               String prevEnd, String newEnd, String prevStat, String newStat,
                               String action, String reason, String userId) {
        LoanCollateralLinkHistory h = new LoanCollateralLinkHistory();
        h.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
        h.setLinkId(link.getId());
        h.setCollateralId(link.getCollateralId());
        h.setLoanAccountId(link.getLoanAccountId());
        h.setFacilityId(link.getFacilityId());
        h.setCustomerId(link.getCustomerId());
        h.setCollateralRank(link.getCollateralRank());
        h.setBorrowerCustomerId(link.getBorrowerCustomerId());
        h.setLegalOwnerCustomerId(link.getLegalOwnerCustomerId());
        h.setRelationshipContext(link.getRelationshipContext());
        h.setThirdParty(link.isThirdParty());
        h.setRelationshipToBorrower(link.getRelationshipToBorrower());
        h.setPledgeAgreementRef(link.getPledgeAgreementRef());
        h.setConsentInfo(link.getConsentInfo());
        h.setConsentDocumentRef(link.getConsentDocumentRef());
        h.setPreviousAllocatedAmount(prevAmt);
        h.setNewAllocatedAmount(newAmt);
        h.setPreviousLinkageType(prevType);
        h.setNewLinkageType(newType);
        h.setPreviousEffectiveDate(prevEff);
        h.setNewEffectiveDate(newEff);
        h.setPreviousEndDate(prevEnd);
        h.setNewEndDate(newEnd);
        h.setPreviousStatus(prevStat);
        h.setNewStatus(newStat);
        h.setActionType(action);
        h.setChangeReason(reason);
        h.setMakerId(userId);
        long seq = HISTORY_SEQ.incrementAndGet();
        java.time.Instant instant = java.time.Instant.ofEpochMilli(seq / 1000).plusNanos((seq % 1000) * 1000);
        h.setMakerDtStamp(instant.toString());
        h.setAuthStat("A");
        linkHistoryRepository.save(h);
    }

    private void logAudit(String userId, String userRole, String action, String entityType,
                          String entityId, String fieldName, String oldValue, String newValue, String remarks) {
        AuditLog audit = new AuditLog();
        audit.setId("aud-" + UUID.randomUUID().toString().substring(0, 8));
        audit.setUserId(userId);
        audit.setRoleCode(userRole);
        audit.setActionType(action);
        audit.setEntityType(entityType);
        audit.setEntityId(entityId);
        audit.setFieldName(fieldName);
        audit.setOldValue(oldValue);
        audit.setNewValue(newValue);
        audit.setComments(remarks);
        audit.setIpAddress("127.0.0.1");
        audit.setTimestamp(LocalDateTime.now().toString());
        auditLogRepository.save(audit);
    }
}
