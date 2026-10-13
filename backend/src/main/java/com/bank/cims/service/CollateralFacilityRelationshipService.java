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

    private static final java.util.concurrent.atomic.AtomicLong HISTORY_SEQ = new java.util.concurrent.atomic.AtomicLong(System.currentTimeMillis() * 1000);

    @Autowired(required = false)
    private CbsGateway cbsGateway;

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
        Collateral col = resolveCollateral(collateralId);
        if (col == null) {
            return Collections.emptyList();
        }

        boolean isThirdParty = "Third-party-owned".equalsIgnoreCase(col.getOwnerType());
        Set<String> validCustIds = null;

        if (targetCustomerId != null && !targetCustomerId.isBlank()) {
            if ("ALL".equalsIgnoreCase(targetCustomerId.trim()) || 
                "ANY".equalsIgnoreCase(targetCustomerId.trim()) || 
                "PORTFOLIO".equalsIgnoreCase(targetCustomerId.trim())) {
                // US-04.5: Return all active facilities in authorized portfolio for cross-borrower / third-party pledge selection
                validCustIds = null;
            } else {
                // US-04.5: User selects an existing borrower to link the collateral (as owner or third-party pledge)
                validCustIds = resolveCustomerIds(targetCustomerId);
            }
        } else {
            if (!isThirdParty) {
                // Borrower-owned: defaults strictly to the owner's facilities
                if (col.getCustomerId() == null || col.getCustomerId().isBlank()) {
                    return Collections.emptyList();
                }
                validCustIds = resolveCustomerIds(col.getCustomerId());
            } else {
                // Third-party-owned with no target customer: all active facilities across authorized portfolio
                validCustIds = null;
            }
        }

        // Fetch already linked active facilities for this collateral to exclude them (Section 14)
        List<LoanCollateralLink> activeLinks = new ArrayList<>();
        activeLinks.addAll(loanCollateralLinkRepository.findByCollateralId(col.getId()));
        if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
            activeLinks.addAll(loanCollateralLinkRepository.findByCollateralId(col.getCode()));
        }
        Set<String> linkedFacilityIds = activeLinks.stream()
                .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
                .flatMap(l -> Stream.of(l.getLoanAccountId(), l.getFacilityId(), l.getCbsFacilityRef(), l.getCbsLoanAccount()))
                .filter(Objects::nonNull)
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        // Resolve user scope if userId provided (Section 7)
        DashboardService.ResolvedScope userScope = null;
        if (userId != null && !userId.isBlank() && dashboardService != null) {
            try {
                userScope = dashboardService.resolveUserScope(userId, null, null, null);
            } catch (Exception ex) {
                log.debug("Scope resolution skipped for {}: {}", userId, ex.getMessage());
            }
        }

        final DashboardService.ResolvedScope effScope = userScope;
        final Set<String> effCustIds = validCustIds;
        List<LoanAccount> allFacilities = loanAccountRepository.findAll();

        return allFacilities.stream()
                // 1. Customer matching (strictly isolated for borrower-owned; open to portfolio for third-party if no target customer)
                .filter(f -> effCustIds == null || (f.getCustomerId() != null && effCustIds.contains(f.getCustomerId().trim().toLowerCase())))
                // 2. Exclude inactive / settled / closed / written-off facilities (Section 31)
                .filter(f -> !"Closed".equalsIgnoreCase(f.getStatus()) &&
                             !"Settled".equalsIgnoreCase(f.getStatus()) &&
                             !"Cancelled".equalsIgnoreCase(f.getStatus()) &&
                             !"Matured".equalsIgnoreCase(f.getStatus()) &&
                             !"Written-Off".equalsIgnoreCase(f.getStatus()))
                // 3. Exclude facilities already actively linked to this collateral (Section 14)
                .filter(f -> {
                    String fid = f.getId() != null ? f.getId().toLowerCase() : "";
                    String fref = f.getLoanReference() != null ? f.getLoanReference().trim().toLowerCase() : "";
                    String fcode = f.getLineCode() != null ? f.getLineCode().trim().toLowerCase() : "";
                    String facc = f.getAccountNumber() != null ? f.getAccountNumber().trim().toLowerCase() : "";
                    return !linkedFacilityIds.contains(fid) && !linkedFacilityIds.contains(fref) && !linkedFacilityIds.contains(fcode) && !linkedFacilityIds.contains(facc);
                })
                // 4. User portfolio authorization (Section 7)
                .filter(f -> {
                    if (effScope == null) return true;
                    if ("ALL".equalsIgnoreCase(targetCustomerId) || "ANY".equalsIgnoreCase(targetCustomerId) || "PORTFOLIO".equalsIgnoreCase(targetCustomerId)) {
                        return true;
                    }
                    try {
                        dashboardService.checkLeafEntityAccess(effScope, f.getBranch(), f.getSegment());
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                })
                .collect(Collectors.toList());
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

        List<Collateral> allCollaterals = collateralRepository.findAll();
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

            // Customer Name
            if (c.getCustomerId() != null) {
                customerRepository.findById(c.getCustomerId())
                        .or(() -> customerRepository.findFirstByCifIgnoreCase(c.getCustomerId()))
                        .ifPresent(cust -> {
                            dto.setCustomerName(cust.getName());
                            dto.setCustomerCif(cust.getCif());
                        });
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

            if (existingLink != null) {
                dto.setAlreadyLinked(true);
                dto.setExistingAllocationToThisFacility(existingLink.getAllocatedAmount());
                dto.setEligible(false);
                dto.setIneligibilityReason("This collateral is already actively linked to this credit facility.");
                candidates.add(dto);
                continue;
            }

            // 2. Check Status
            if (!"Active".equalsIgnoreCase(c.getStatus()) && !"Approved".equalsIgnoreCase(c.getStatus())) {
                dto.setEligible(false);
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
                    dto.setIneligibilityReason("Collateral asset is outside your authorized portfolio scope.");
                    candidates.add(dto);
                    continue;
                }
            }

            // 4. Ownership & Third-Party Rules
            boolean isThirdParty = "Third-party-owned".equalsIgnoreCase(c.getOwnerType());
            dto.setThirdParty(isThirdParty);

            if (!isThirdParty) {
                // Borrower-owned: must belong to the facility's customer
                boolean custMatches = c.getCustomerId() != null && validBorrowerCustIds.contains(c.getCustomerId().trim().toLowerCase());
                dto.setSatisfiesNormalOwnership(custMatches);
                if (!custMatches) {
                    dto.setEligible(false);
                    dto.setIneligibilityReason("Borrower-owned collateral belongs to customer " + (dto.getCustomerName() != null ? dto.getCustomerName() : c.getCustomerId()) + " and cannot secure another borrower's facility.");
                    candidates.add(dto);
                    continue;
                }
            } else {
                // Third-party collateral: check third-party prerequisites
                dto.setSatisfiesNormalOwnership(false);
                try {
                    validationService.validateThirdPartyOwnership(c);
                    dto.setThirdPartyValid(true);
                } catch (Exception ex) {
                    dto.setThirdPartyValid(false);
                    dto.setEligible(false);
                    dto.setIneligibilityReason("Third-party collateral prerequisites not satisfied: " + ex.getMessage());
                    candidates.add(dto);
                    continue;
                }
            }

            // 5. Remaining capacity check
            if (remainingCap <= 0.01) {
                dto.setEligible(false);
                dto.setIneligibilityReason("Collateral net security value is fully allocated (ETB 0.00 available capacity).");
                candidates.add(dto);
                continue;
            }

            // Passed all checks!
            dto.setEligible(true);
            dto.setIneligibilityReason(null);
            candidates.add(dto);
        }

        // Sort candidates: eligible first, then by code
        candidates.sort((a, b) -> {
            if (a.isEligible() != b.isEligible()) {
                return a.isEligible() ? -1 : 1;
            }
            return (a.getCode() != null ? a.getCode() : "").compareToIgnoreCase(b.getCode() != null ? b.getCode() : "");
        });

        return candidates;
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

        result.setLegalOwnerName(legalOwnerName);
        result.setLegalOwnerCustomerId(ownerCustId);
        result.setOwnerType(col.getOwnerType());
        result.setOwnershipPercentage(ownershipPct);
        result.setOwnerVerificationStatus(ownerVerStatus);
        result.setRelationshipToBorrower(ownerRel);
        result.setConsentStatus(consentInfo);
        result.setPledgeAgreementRef(pledgeRef);

        if (ownerCustId != null) {
            customerRepository.findById(ownerCustId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(ownerCustId))
                    .ifPresent(oc -> result.setLegalOwnerCif(oc.getCif()));
        }

        boolean custMatches = isCustomerMatch(col.getCustomerId(), loan.getCustomerId());
        boolean isThirdParty = "Third-party-owned".equalsIgnoreCase(col.getOwnerType()) || !custMatches;
        result.setOwnerBorrowerMatch(!isThirdParty);
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
                .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
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
            isDuplicate = loanCollateralLinkRepository.existsByCollateralIdAndLoanAccountIdAndStatus(col.getId(), loan.getId(), "Active");
        } else if (!isDuplicate && reqId != null) {
            isDuplicate = loanCollateralLinkRepository.findByCollateralIdAndLoanAccountIdAndStatus(col.getId(), loan.getId(), "Active").stream()
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
        }

        // Rule 4: Customer Alignment & Third-Party Pledge Authorization (US-04.3, US-04.4, US-04.5)
        if (!isThirdParty && !req.isThirdPartyPledge()) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-CUST", "Customer Ownership Alignment", "Ownership", true, false,
                    "Borrower-Owned Collateral: Legal owner (" + (legalOwnerName != null ? legalOwnerName : "Borrower") + ") matches facility borrower.", null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        } else {
            // Third-party collateral / cross-customer pledge scenario
            boolean isDesignatedTp = "Third-party-owned".equalsIgnoreCase(col.getOwnerType());
            boolean hasThirdPartyPledgeContext = req.isThirdPartyPledge()
                    || (req.getPledgeAgreementRef() != null && !req.getPledgeAgreementRef().isBlank())
                    || (req.getRelationshipToBorrower() != null && !req.getRelationshipToBorrower().isBlank())
                    || (req.getConsentInfo() != null && !req.getConsentInfo().isBlank());

            if (!isDesignatedTp && !hasThirdPartyPledgeContext) {
                ValidationCheckItemDto check = new ValidationCheckItemDto(
                        "VAL-REL-CUST", "Third-Party Ownership Status", "Customer Isolation", false, false,
                        "Customer Isolation Violation: Collateral is registered as Borrower-owned by customer " +
                                (result.getLegalOwnerName() != null ? result.getLegalOwnerName() : col.getCustomerId()) +
                                ", but facility belongs to another borrower (" + (result.getBorrowerName() != null ? result.getBorrowerName() : loan.getCustomerId()) +
                                "). Third-party collateral registration is required.", "Third-Party Classification", "High"
                );
                check.setSeverity("HARD_STOP");
                result.addCheck(check);
            } else if (isDesignatedTp) {
                try {
                    validationService.validateThirdPartyOwnership(col);
                    result.setHasRequiredPledgeEvidence(true);
                    ValidationCheckItemDto check = new ValidationCheckItemDto(
                            "VAL-REL-CUST", "Third-Party Ownership & Prerequisites", "Third-Party", true, false,
                            String.format("Third-Party Collateral Arrangement Verified: Asset owned by %s (%s) is legally pledged for borrower %s with consent and pledge agreement documented.",
                                    legalOwnerName != null ? legalOwnerName : "Third Party", ownerRel, result.getBorrowerName() != null ? result.getBorrowerName() : loan.getCustomerId()), null, "None"
                    );
                    check.setSeverity("INFO");
                    result.addCheck(check);
                } catch (Exception e) {
                    result.setHasRequiredPledgeEvidence(false);
                    ValidationCheckItemDto check = new ValidationCheckItemDto(
                            "VAL-REL-CUST", "Third-Party Ownership & Prerequisites", "Third-Party", false, false,
                            e.getMessage(), "Third-Party Documentation", "High"
                    );
                    check.setSeverity("HARD_STOP");
                    result.addCheck(check);
                }
            } else {
                // Borrower-owned asset pledged for another borrower (US-04.5)
                String rel = req.getRelationshipToBorrower();
                if (rel == null || rel.isBlank()) rel = ownerRel;
                if (rel == null || rel.isBlank() || "Borrower".equalsIgnoreCase(rel) || "Self".equalsIgnoreCase(rel)) {
                    ValidationCheckItemDto check = new ValidationCheckItemDto(
                            "VAL-REL-CUST", "Third-Party Relationship Category", "Third-Party", false, false,
                            "Third-party pledge requires specifying the relationship between legal owner and borrower (e.g. Guarantor, Shareholder, Director, Parent Company, Spouse, Family Member, Business Partner, Other).", "Relationship Required", "High"
                    );
                    check.setSeverity("HARD_STOP");
                    result.addCheck(check);
                } else {
                    String relLower = rel.toLowerCase();
                    boolean recognized = relLower.contains("shareholder") ||
                            relLower.contains("parent") ||
                            relLower.contains("director") ||
                            relLower.contains("guarantor") ||
                            relLower.contains("spouse") ||
                            relLower.contains("family") ||
                            relLower.contains("partner") ||
                            relLower.contains("pledgor") ||
                            relLower.contains("other");
                    if (!recognized) {
                        ValidationCheckItemDto check = new ValidationCheckItemDto(
                                "VAL-REL-CUST", "Third-Party Relationship Category", "Third-Party", false, false,
                                "Relationship '" + rel + "' is not a permitted relationship category per US-04.4. Documented categories: Shareholder, Parent Company, Director, Guarantor, Spouse, Family Member, Business Partner, Other.", "Relationship Category", "High"
                        );
                        check.setSeverity("HARD_STOP");
                        result.addCheck(check);
                    } else {
                        String pledgeRefUsed = (req.getPledgeAgreementRef() != null && !req.getPledgeAgreementRef().isBlank())
                                ? req.getPledgeAgreementRef() : pledgeRef;
                        String consentUsed = (req.getConsentInfo() != null && !req.getConsentInfo().isBlank())
                                ? req.getConsentInfo() : consentInfo;

                        result.setHasRequiredPledgeEvidence(true);
                        result.setThirdParty(true);
                        result.setRelationshipToBorrower(rel);
                        result.setPledgeAgreementRef(pledgeRefUsed);
                        result.setConsentStatus(consentUsed);

                        ValidationCheckItemDto check = new ValidationCheckItemDto(
                                "VAL-REL-CUST", "Third-Party Ownership & Prerequisites", "Third-Party", true, false,
                                String.format("Third-Party Pledge Authorized (US-04.5): Collateral owned by %s is pledged for borrower %s with relationship '%s'%s.",
                                        legalOwnerName != null ? legalOwnerName : "Owner",
                                        result.getBorrowerName() != null ? result.getBorrowerName() : loan.getCustomerId(),
                                        rel,
                                        pledgeRefUsed != null ? " and pledge agreement ref: " + pledgeRefUsed : ""), null, "None"
                        );
                        check.setSeverity("INFO");
                        result.addCheck(check);
                    }
                }
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

        // Rule 6: Facility Operational Status (Section 31)
        if ("Closed".equalsIgnoreCase(loan.getStatus()) || "Settled".equalsIgnoreCase(loan.getStatus())
                || "Cancelled".equalsIgnoreCase(loan.getStatus()) || "Matured".equalsIgnoreCase(loan.getStatus())
                || "Written-Off".equalsIgnoreCase(loan.getStatus())) {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-FAC-STAT", "Facility Operational Status", "Operational", false, false,
                    "Cannot link collateral to an inactive loan facility (" + loan.getStatus() + ").", null, "High"
            );
            check.setSeverity("HARD_STOP");
            result.addCheck(check);
        } else {
            ValidationCheckItemDto check = new ValidationCheckItemDto(
                    "VAL-REL-FAC-STAT", "Facility Operational Status", "Operational", true, false,
                    "Facility is Active and eligible for security linkage.", null, "None"
            );
            check.setSeverity("INFO");
            result.addCheck(check);
        }

        if (result.isValid()) {
            result.setSummaryMessage("All relationship criteria and security allocation limits are satisfied.");
            result.setOverallDecision("CAN_PROCEED");
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
                .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
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

        // Check user portfolio authorization scope (Section 7 & 12)
        if (userId != null && !userId.isBlank() && dashboardService != null) {
            try {
                DashboardService.ResolvedScope scope = dashboardService.resolveUserScope(userId, null, null, null);
                if (scope != null && !scope.isBankWide()) {
                    dashboardService.checkLeafEntityAccess(scope, loan.getBranch(), loan.getSegment());
                }
            } catch (IllegalArgumentException e) {
                if (e.getMessage() != null && e.getMessage().contains("Access Denied: Record belongs to")) {
                    throw new IllegalArgumentException("This facility is not within your authorized portfolio.");
                }
                log.debug("Scope check bypassed for {}: {}", userId, e.getMessage());
            } catch (Exception ex) {
                log.debug("Scope check bypassed for {}: {}", userId, ex.getMessage());
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

        // Third-party pledge metadata (US-04.3, US-04.5)
        if (req.isThirdPartyPledge() || !isCustomerMatch(lockedCol.getCustomerId(), loan.getCustomerId())) {
            String desc = "Third-Party Pledge | Borrower: " + loan.getCustomerId();
            if (req.getRelationshipToBorrower() != null && !req.getRelationshipToBorrower().isBlank()) {
                desc += " | Rel: " + req.getRelationshipToBorrower();
            }
            if (req.getPledgeAgreementRef() != null && !req.getPledgeAgreementRef().isBlank()) {
                desc += " | Pledge Ref: " + req.getPledgeAgreementRef();
                link.setLinkedReferenceNo(req.getPledgeAgreementRef());
            }
            link.setDescription(desc);

            if (req.getRelationshipToBorrower() != null && !req.getRelationshipToBorrower().isBlank() && collateralOwnerRepository != null) {
                List<CollateralOwner> owners = collateralOwnerRepository.findByCollateralId(lockedCol.getId());
                boolean hasOwnerRecord = owners != null && owners.stream().anyMatch(o ->
                        req.getRelationshipToBorrower().equalsIgnoreCase(o.getRelationshipToBorrower()) ||
                        req.getRelationshipToBorrower().equalsIgnoreCase(o.getRelationship()));
                if (!hasOwnerRecord) {
                    CollateralOwner newOwner = new CollateralOwner();
                    newOwner.setId("OWN-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
                    newOwner.setCollateralId(lockedCol.getId());
                    Customer ownerCust = customerRepository.findById(lockedCol.getCustomerId())
                            .or(() -> customerRepository.findFirstByCifIgnoreCase(lockedCol.getCustomerId())).orElse(null);
                    newOwner.setName(ownerCust != null ? ownerCust.getName() : lockedCol.getCustomerId());
                    newOwner.setOwnershipType("Third-party-owned");
                    newOwner.setRelationshipToBorrower(req.getRelationshipToBorrower());
                    newOwner.setRelationship(req.getRelationshipToBorrower());
                    newOwner.setPledgeAgreementRef(req.getPledgeAgreementRef());
                    newOwner.setConsentInfo(req.getConsentInfo() != null ? req.getConsentInfo() : "Documented Pledge Consent");
                    newOwner.setVerificationStatus("Verified");
                    newOwner.setStatus("Active");
                    newOwner.setPercentage(100.0);
                    collateralOwnerRepository.save(newOwner);
                }
            }
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

        // Governance & Status
        link.setStatus("Active");
        link.setRelationshipStatus("Active");
        link.setReleaseStatus("Eligible");
        link.setMakerId(userId);
        link.setMakerDtStamp(LocalDateTime.now().toString());
        link.setAuthStat("A");
        link.setRecordStat("O");
        link.setModNo(1);

        loanCollateralLinkRepository.save(link);

        // Record history snapshot (Section 28)
        recordHistory(link, 0.0, req.getAllocatedAmount(), "None", link.getLinkageType(),
                null, link.getEffectiveDate(), null, link.getEndDate(),
                "None", "Active", "CREATED", link.getChangeReason(), userId);

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
                .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
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

        link.setModNo(link.getModNo() + 1);
        link.setCheckerId(userId);
        link.setCheckerDtStamp(LocalDateTime.now().toString());

        loanCollateralLinkRepository.save(link);

        // Record history snapshot (Section 28)
        String action = priorAlloc != req.getAllocatedAmount() ? "ALLOCATION_CHANGED" : "UPDATED";
        recordHistory(link, priorAlloc, req.getAllocatedAmount(), priorLinkType, link.getLinkageType(),
                priorEffDate, link.getEffectiveDate(), priorEndDate, link.getEndDate(),
                priorStatus, link.getStatus(), action, link.getChangeReason(), userId);

        // Recalculate downstream exposures
        updateCollateralAndFacilityAggregates(lockedCol, loan);

        // Audit Log (Section 41)
        logAudit(userId, "CHECKER", "UPDATE_COLLATERAL_FACILITY_LINK", "LoanCollateralLink", link.getId(),
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

        // Audit Log (Section 41)
        logAudit(userId, "CHECKER", "REMOVE_COLLATERAL_FACILITY_LINK", "LoanCollateralLink", link.getId(),
                "Status", priorStatus, "Ended",
                String.format("Ended relationship between Collateral %s and Loan %s: %s", col.getCode(), loan.getLoanReference(), reason));

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
                .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
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

        // Determine Third-Party Relationship Flag
        boolean isThirdParty = false;
        if (col != null && loan != null) {
            boolean custMatch = isCustomerMatch(col.getCustomerId(), loan.getCustomerId());
            boolean ownerTypeIsTp = "Third-party-owned".equalsIgnoreCase(col.getOwnerType());
            String rel = dto.getRelationshipToBorrower();
            boolean relIsThirdParty = rel != null && !rel.equalsIgnoreCase("Self") && !rel.equalsIgnoreCase("Borrower");
            isThirdParty = ownerTypeIsTp || relIsThirdParty || !custMatch;
        }
        dto.setThirdParty(isThirdParty);

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
                    .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
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
                    .filter(l -> "Active".equalsIgnoreCase(l.getStatus()) || "Active".equalsIgnoreCase(l.getRelationshipStatus()))
                    .collect(Collectors.toList());
            double totalColContribution = activeLinks.stream().mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
            loan.setCollateralContribution(totalColContribution);
            loan.setCollateralPct(loan.getOutstandingBalance() > 0
                    ? (totalColContribution / loan.getOutstandingBalance()) * 100.0
                    : (loan.getApprovedLimit() > 0 ? (totalColContribution / loan.getApprovedLimit()) * 100.0 : 100.0));
            loanAccountRepository.save(loan);
        }
    }

    // =========================================================================
    // 7. ALLOCATE COLLATERAL FACILITIES (CENTRALIZED HISTORICAL MANAGEMENT)
    // =========================================================================
    @Transactional
    public Map<String, Object> allocateCollateralFacilities(String collateralId, List<Map<String, Object>> allocations, String userId) {
        return allocateCollateralFacilities(collateralId, allocations, true, userId);
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

                // Validate borrower relationship
                validationService.validateBorrowerLoanRelationship(collateral, loan);

                // Prevent duplicate targets within the same allocation request
                if (targetLoanIds.contains(loan.getId())) {
                    throw new IllegalArgumentException("Duplicate facility in allocation: " + loan.getLoanReference());
                }
                targetLoanIds.add(loan.getId());
                matchedLoans.add(loan);

                double amt = Double.parseDouble(a.get("allocatedAmount") != null ? a.get("allocatedAmount").toString() : "0");
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
                    link.setStatus("Active");
                    link.setRelationshipStatus("Active");
                    link.setReleaseStatus("Eligible");
                    link.setEffectiveDate(LocalDateTime.now().toString());
                    link.setMakerId(userId);
                    link.setRecordStat("O");
                    link.setAuthStat("A");
                    loanCollateralLinkRepository.save(link);
                    recordHistory(link, 0.0, amt, "None", lType,
                            null, link.getEffectiveDate(), null, null,
                            "None", "Active", "ALLOCATED", "Facility allocated in multi-allocation update", userId);
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
