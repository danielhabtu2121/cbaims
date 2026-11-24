package com.bank.cims.service;

import com.bank.cims.dto.EarlyReleaseSubmissionDto;
import com.bank.cims.dto.ManualCbsUpdateDto;
import com.bank.cims.dto.PreReleaseImpactAssessmentDto;
import com.bank.cims.dto.PreReleaseImpactAssessmentDto.AffectedFacilityImpactDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EarlyCollateralReleaseService {

    private static final Logger log = LoggerFactory.getLogger(EarlyCollateralReleaseService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private InsuranceExceptionRepository insuranceExceptionRepository;

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private CollateralReleaseRequestRepository collateralReleaseRequestRepository;

    @Autowired
    private com.bank.cims.repository.InsuranceClaimRepository insuranceClaimRepository;

    @Autowired
    private InsuranceAdequacyService insuranceAdequacyService;

    @Autowired
    private ConfigurationService configurationService;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private AuthorizationScopeService authorizationScopeService;

    @Autowired
    private RoleHierarchyService roleHierarchyService;

    @Autowired
    private WorkflowAuthorizationService workflowAuthorizationService;

    private User requireApprovalActor() {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()
                || (actor.getId() == null || actor.getId().isBlank())
                || (actor.getRole() == null || actor.getRole().isBlank())) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "An authenticated user with an assigned role is required to decide a collateral release request.");
        }
        return actor;
    }

    private String actorReference(User actor) {
        return actor.getId() != null && !actor.getId().isBlank() ? actor.getId() : actor.getUsername();
    }

    /**
     * Pre-Release Impact Assessment (BR-03, Section 5.3, 5.4)
     * Calculates position of all affected cross-collateralized facilities before and after proposed release.
     */
    public PreReleaseImpactAssessmentDto performPreReleaseImpactAssessment(String collateralId, List<String> targetedFacilityIds) {
        PreReleaseImpactAssessmentDto assessment = new PreReleaseImpactAssessmentDto();
        assessment.setCollateralId(collateralId);

        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        assessment.setCollateralCode(collateral.getCode());
        assessment.setCollateralType(collateral.getType());
        assessment.setCurrentCollateralValuation(collateral.getValuationAmount());
        assessment.setCurrentInsurableValue(collateral.getInsurableValue());
        double nsv = collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0));
        assessment.setCurrentNetSecurityValue(nsv);
        assessment.setCurrentInsuredAmount(collateral.getInsuredAmount());
        assessment.setCurrentAdequacyStatus(collateral.getInsuranceStatus());

        boolean isFullRelease = targetedFacilityIds == null || targetedFacilityIds.isEmpty();
        assessment.setReleaseType(isFullRelease ? "FULL_COLLATERAL" : "PARTIAL_FACILITY_LINK");
        if (targetedFacilityIds != null) assessment.setTargetedFacilityIds(targetedFacilityIds);

        // Fetch all active links for this collateral using unified lookup (Audit Finding 12)
        List<LoanCollateralLink> currentColLinks = findLinksForCollateral(collateral);

        double currentTotalAllocated = 0.0;
        double currentAggExposure = 0.0;
        Set<String> distinctFacilityIds = new HashSet<>();
        List<LoanAccount> allAffectedFacilities = new ArrayList<>();

        for (LoanCollateralLink link : currentColLinks) {
            String stat = link.getStatus() != null ? link.getStatus() : link.getRelationshipStatus();
            if ("Historical".equalsIgnoreCase(stat) || "Released".equalsIgnoreCase(stat) || "Ended".equalsIgnoreCase(stat)) {
                continue;
            }
            currentTotalAllocated += link.getAllocatedAmount();

            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (facId == null || facId.isBlank()) continue;

            LoanAccount fac = loanAccountRepository.findById(facId)
                    .or(() -> loanAccountRepository.findByLoanReference(facId))
                    .orElse(null);

            if (fac != null && distinctFacilityIds.add(fac.getId())) {
                currentAggExposure += fac.getOutstandingBalance();
                allAffectedFacilities.add(fac);
            }
        }

        assessment.setCurrentAggregateExposure(currentAggExposure);
        assessment.setCurrentTotalAllocatedSecurity(currentTotalAllocated);

        // Cross-Collateral Post-Release Evaluation across ALL affected facilities (BR-03)
        boolean allFacilitiesPassed = true;
        double projectedPostAllocated = 0.0;
        double projectedPostExposure = 0.0;

        for (LoanAccount fac : allAffectedFacilities) {
            AffectedFacilityImpactDto facDto = new AffectedFacilityImpactDto();
            facDto.setFacilityId(fac.getId());
            facDto.setLoanReference(fac.getLoanReference());
            facDto.setFacilityType(fac.getFacilityType());
            facDto.setApprovedLimit(fac.getApprovedLimit());
            facDto.setOutstandingBalance(fac.getOutstandingBalance());
            facDto.setBalanceAsOfDate(fac.getLineStartDate() != null ? fac.getLineStartDate() : LocalDate.now().toString());

            // All collaterals currently securing this facility
            List<LoanCollateralLink> facLinks = loanCollateralLinkRepository.findByLoanAccountId(fac.getId());
            if (facLinks.isEmpty() && fac.getLineCode() != null) {
                facLinks = loanCollateralLinkRepository.findByFacilityId(fac.getLineCode());
            }

            double preAlloc = 0.0;
            double postAlloc = 0.0;
            List<String> remainingCols = new ArrayList<>();

            for (LoanCollateralLink fl : facLinks) {
                String lStat = fl.getStatus() != null ? fl.getStatus() : fl.getRelationshipStatus();
                if ("Historical".equalsIgnoreCase(lStat) || "Released".equalsIgnoreCase(lStat) || "Ended".equalsIgnoreCase(lStat)) {
                    continue;
                }
                preAlloc += fl.getAllocatedAmount();

                boolean isBeingReleased = fl.getCollateralId().equalsIgnoreCase(collateral.getId()) ||
                        (collateral.getCode() != null && fl.getCollateralId().equalsIgnoreCase(collateral.getCode()));

                if (isFullRelease && isBeingReleased) {
                    // Released!
                } else if (!isFullRelease && isBeingReleased && targetedFacilityIds.contains(fac.getId())) {
                    // Targeted for release!
                } else {
                    postAlloc += fl.getAllocatedAmount();
                    remainingCols.add(fl.getCollateralId());
                }
            }

            facDto.setPreReleaseAllocatedSecurity(preAlloc);
            facDto.setPostReleaseAllocatedSecurity(postAlloc);
            facDto.setRemainingCollateralCodes(remainingCols);

            double outBal = fac.getOutstandingBalance();
            double preRatio = outBal > 0 ? (preAlloc / outBal) * 100.0 : 100.0;
            double postRatio = outBal > 0 ? (postAlloc / outBal) * 100.0 : 100.0;
            facDto.setPreReleaseCoverageRatio(Math.round(preRatio * 10.0) / 10.0);
            facDto.setPostReleaseCoverageRatio(Math.round(postRatio * 10.0) / 10.0);
            double requiredMargin = configurationService != null ? configurationService.getCollateralReleaseMarginPct() : 100.0;
            facDto.setRequiredMarginPct(requiredMargin); // Configurable margin requirement (REL-03)

            boolean prePass = preRatio >= requiredMargin || outBal <= 0;
            boolean postPass = postRatio >= requiredMargin || outBal <= 0;
            facDto.setPreReleasePassed(prePass);
            facDto.setPostReleasePassed(postPass);

            if (!postPass) {
                allFacilitiesPassed = false;
                facDto.setStatusMessage(String.format(Locale.ROOT,
                        "CRITICAL: Post-release coverage deficit! Remaining security (ETB %,.2f) covers only %.1f%% of outstanding balance (ETB %,.2f).",
                        postAlloc, postRatio, outBal));
            } else {
                facDto.setStatusMessage(String.format(Locale.ROOT,
                        "Compliant: Remaining security (ETB %,.2f) provides %.1f%% coverage.", postAlloc, postRatio));
            }

            assessment.getAffectedFacilities().add(facDto);
            projectedPostAllocated += postAlloc;
            if (postAlloc > 0 || outBal <= 0) {
                projectedPostExposure += outBal;
            }
        }

        assessment.setProjectedPostReleaseAllocatedSecurity(projectedPostAllocated);
        assessment.setProjectedPostReleaseAggregateExposure(projectedPostExposure);

        // Condition A — Authorized Credit Approval
        assessment.setConditionAAuthorizedCreditApproval(true);
        assessment.setConditionADetails("Routed to Credit Committee / Branch Manager checker dual control.");

        // Condition B — Remaining Collateral Adequacy
        assessment.setConditionBRemainingCollateralAdequacy(allFacilitiesPassed);
        double configuredMargin = configurationService != null ? configurationService.getCollateralReleaseMarginPct() : 100.0;
        assessment.setConditionBDetails(allFacilitiesPassed
                ? "Remaining collateral meets required " + (int)configuredMargin + "% coverage and margin for all affected facilities."
                : "FAILED: Remaining collateral is inadequate for one or more facilities after proposed release.");

        // Condition C — Cross-Collateral Validation (BR-03)
        assessment.setConditionCCrossCollateralValidation(allFacilitiesPassed);
        assessment.setConditionCDetails(allFacilitiesPassed
                ? "All distinct cross-collateralized facilities satisfy post-release security requirements."
                : "FAILED: Cross-collateral validation failed. Release is strictly blocked to prevent under-securing linked facilities.");

        // Condition D — Insurance Exceptions and Claims
        List<InsuranceException> pendingExceptions = insuranceExceptionRepository.findByCollateralIdAndApprovalStatus(collateral.getId(), "Pending");
        boolean hasUnresolvedExc = !pendingExceptions.isEmpty();
        if (hasUnresolvedExc) {
            for (InsuranceException e : pendingExceptions) assessment.getUnresolvedExceptionIds().add(e.getId());
        }
        if (cimsExceptionRepository != null) {
            Set<String> linkedPolicyIds = insurancePolicyRepository.findByCollateralId(collateral.getId()).stream()
                    .map(InsurancePolicy::getId)
                    .collect(Collectors.toSet());
            List<CimsException> openCimsExceptions = cimsExceptionRepository.findAll().stream()
                    .filter(e -> {
                        boolean matchesCollateral = collateral.getId().equalsIgnoreCase(e.getEntityId())
                                || (collateral.getCode() != null && collateral.getCode().equalsIgnoreCase(e.getEntityId()))
                                || collateral.getId().equalsIgnoreCase(e.getCollateralId())
                                || (collateral.getCode() != null && collateral.getCode().equalsIgnoreCase(e.getCollateralId()));
                        boolean matchesPolicy = (e.getPolicyId() != null && linkedPolicyIds.contains(e.getPolicyId()))
                                || (e.getEntityId() != null && linkedPolicyIds.contains(e.getEntityId()));
                        boolean isUnresolvedStatus = "Pending".equalsIgnoreCase(e.getStatus())
                                || "Open".equalsIgnoreCase(e.getStatus())
                                || "In Investigation".equalsIgnoreCase(e.getStatus())
                                || "Escalated".equalsIgnoreCase(e.getStatus());
                        return (matchesCollateral || matchesPolicy) && isUnresolvedStatus;
                    })
                    .toList();
            if (!openCimsExceptions.isEmpty()) {
                hasUnresolvedExc = true;
                for (CimsException e : openCimsExceptions) assessment.getUnresolvedExceptionIds().add(e.getId());
            }
        }
        assessment.setHasUnresolvedInsuranceExceptions(hasUnresolvedExc);

        List<com.bank.cims.model.InsuranceClaim> activeClaims = insuranceClaimRepository != null
                ? insuranceClaimRepository.findByCollateralId(collateral.getId()).stream()
                    .filter(com.bank.cims.model.InsuranceClaim::isPendingBlocking)
                    .toList()
                : Collections.emptyList();

        boolean hasPendingClaim = collateral.isPendingInsuranceClaim() || !activeClaims.isEmpty();
        String claimRef = collateral.getPendingInsuranceClaimRef();
        double claimAmt = collateral.getPendingInsuranceClaimAmount();
        if (!activeClaims.isEmpty()) {
            claimRef = activeClaims.get(0).getClaimNumber();
            claimAmt = activeClaims.stream().mapToDouble(com.bank.cims.model.InsuranceClaim::getClaimAmount).sum();
        }

        assessment.setHasPendingInsuranceClaims(hasPendingClaim);
        assessment.setPendingInsuranceClaimRef(claimRef);
        assessment.setPendingInsuranceClaimAmount(claimAmt);

        boolean condDPassed = !hasUnresolvedExc && !hasPendingClaim;
        assessment.setConditionDExceptionsAndClaimsPassed(condDPassed);
        if (!condDPassed) {
            List<String> dIssues = new ArrayList<>();
            if (hasUnresolvedExc) dIssues.add("Unresolved insurance exception pending supervisor approval (" + assessment.getUnresolvedExceptionIds().size() + " active)");
            if (hasPendingClaim) dIssues.add("Pending insurance claim exists (Ref: " + collateral.getPendingInsuranceClaimRef() + ", ETB " + collateral.getPendingInsuranceClaimAmount() + ")");
            assessment.setConditionDDetails("FAILED: " + String.join("; ", dIssues));
        } else {
            assessment.setConditionDDetails("Passed: No unresolved insurance exceptions and no pending insurance claims.");
        }

        // Condition E — Release Documents Filed in DMS
        List<OwnershipDocument> docs = ownershipDocumentRepository.findAll();
        List<String> filedDocIds = new ArrayList<>();
        boolean hasReleaseDoc = false;
        assessment.getRequiredDocumentTypes().add("Collateral Release Authorization / Credit Approval");

        for (OwnershipDocument d : docs) {
            boolean belongs = (d.getCollateralId() != null && (d.getCollateralId().equalsIgnoreCase(collateral.getId()) || d.getCollateralId().equalsIgnoreCase(collateral.getCode())));
            if (belongs && !"Archived".equalsIgnoreCase(d.getStatus()) && "Verified".equalsIgnoreCase(d.getVerificationStatus())) {
                boolean hasContent = (d.getFileContent() != null && !d.getFileContent().isBlank())
                        || (d.getDmsRef() != null && !d.getDmsRef().isBlank())
                        || (d.getStoragePath() != null && !d.getStoragePath().isBlank())
                        || (d.getId() != null && !d.getId().isBlank());
                if (!hasContent) continue;
                String dType = d.getType() != null ? d.getType().toLowerCase() : "";
                String dName = d.getName() != null ? d.getName().toLowerCase() : "";
                if (dType.contains("release") || dName.contains("release") || dType.contains("discharge") || dName.contains("discharge")) {
                    hasReleaseDoc = true;
                    filedDocIds.add(d.getId());
                }
            }
        }

        assessment.setFiledDmsDocIds(filedDocIds);
        assessment.setConditionEReleaseDocumentsFiled(hasReleaseDoc);
        if (!hasReleaseDoc) {
            assessment.getMissingDocumentTypes().add("Collateral Release Authorization Form / DMS Discharge Document");
            assessment.setConditionEDetails("FAILED: Mandatory collateral release authorization document is not filed or verified in DMS.");
        } else {
            assessment.setConditionEDetails("Passed: Verified release document present in DMS (Ref: " + String.join(", ", filedDocIds) + ").");
        }

        // Overall Block Evaluation
        boolean isHardBlocked = false;
        if (!assessment.isConditionBRemainingCollateralAdequacy()) {
            isHardBlocked = true;
            assessment.getBlockingReasons().add("Condition B: Remaining collateral does not meet required coverage for all linked facilities.");
        }
        if (!assessment.isConditionCCrossCollateralValidation()) {
            isHardBlocked = true;
            assessment.getBlockingReasons().add("Condition C: Cross-collateral validation failed (BR-03). At least one facility has a coverage deficit.");
        }
        if (!assessment.isConditionDExceptionsAndClaimsPassed()) {
            isHardBlocked = true;
            assessment.getBlockingReasons().add("Condition D: Unresolved insurance exceptions or pending insurance claims exist on this collateral.");
        }
        if (!assessment.isConditionEReleaseDocumentsFiled()) {
            isHardBlocked = true;
            assessment.getBlockingReasons().add("Condition E: Required collateral release authorization document is not filed in DMS.");
        }

        assessment.setHardBlocked(isHardBlocked);
        assessment.setCanProceedWithRelease(!isHardBlocked);

        if (allAffectedFacilities.size() > 1) {
            assessment.getInformationalWarnings().add("Cross-collateralized asset: This collateral secures " + allAffectedFacilities.size() + " distinct facilities. All have been evaluated.");
        }

        return assessment;
    }

    /**
     * Submits an early collateral release request into maker-checker workflow.
     */
    @Transactional
    public CollateralReleaseRequest submitReleaseRequest(EarlyReleaseSubmissionDto dto, String requesterId) {
        if (dto.getCollateralId() == null || dto.getCollateralId().isBlank()) {
            throw new IllegalArgumentException("Collateral ID is mandatory for release request.");
        }
        if (dto.getReason() == null || dto.getReason().trim().isBlank()) {
            throw new IllegalArgumentException("Reason for collateral release is mandatory.");
        }

        Collateral collateral = collateralRepository.findById(dto.getCollateralId())
                .or(() -> collateralRepository.findByCode(dto.getCollateralId()))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + dto.getCollateralId()));

        if (collateral.getActiveReleaseRequestId() != null) {
            Optional<CollateralReleaseRequest> existingOpt = collateralReleaseRequestRepository.findById(collateral.getActiveReleaseRequestId());
            if (existingOpt.isPresent() && ("PENDING_APPROVAL".equalsIgnoreCase(existingOpt.get().getStatus()) || "PENDING".equalsIgnoreCase(existingOpt.get().getStatus()))) {
                throw new IllegalStateException("Collateral already has an active release request pending approval: " + collateral.getActiveReleaseRequestId());
            }
        }

        if (dto.getFacilityIds() != null && !dto.getFacilityIds().isEmpty()) {
            List<LoanCollateralLink> currentLinks = findLinksForCollateral(collateral);
            Set<String> activeLinkedFacilityIds = currentLinks.stream()
                    .filter(l -> !"Historical".equalsIgnoreCase(l.getStatus()) && !"Released".equalsIgnoreCase(l.getStatus()) && !"Ended".equalsIgnoreCase(l.getStatus()))
                    .map(l -> l.getLoanAccountId() != null ? l.getLoanAccountId() : l.getFacilityId())
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            for (String facId : dto.getFacilityIds()) {
                if (facId != null && !facId.isBlank() && !activeLinkedFacilityIds.contains(facId)) {
                    boolean matched = false;
                    for (String alf : activeLinkedFacilityIds) {
                        LoanAccount la = loanAccountRepository.findById(alf).orElse(null);
                        if (la != null && facId.equalsIgnoreCase(la.getLoanReference())) {
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        throw new IllegalArgumentException("Targeted facility '" + facId + "' is not actively linked to collateral " + collateral.getCode());
                    }
                }
            }
        }

        // Perform authoritative pre-release impact check
        PreReleaseImpactAssessmentDto assessment = performPreReleaseImpactAssessment(collateral.getId(), dto.getFacilityIds());

        if (assessment.isHardBlocked()) {
            throw new IllegalStateException("Release request cannot be submitted because hard blocking conditions failed:\n• "
                    + String.join("\n• ", assessment.getBlockingReasons()));
        }

        CollateralReleaseRequest request = new CollateralReleaseRequest();
        request.setId("rel-req-" + UUID.randomUUID().toString().substring(0, 8));
        request.setCollateralId(collateral.getId());
        request.setFacilityIds(dto.getFacilityIds() != null && !dto.getFacilityIds().isEmpty() ? String.join(",", dto.getFacilityIds()) : "ALL");
        request.setReleaseType(dto.getReleaseType() != null ? dto.getReleaseType() : "FULL_COLLATERAL");
        request.setRequesterId(requesterId);
        request.setReason(dto.getReason());
        request.setSupportingDocumentIds(dto.getSupportingDocumentIds() != null ? String.join(",", dto.getSupportingDocumentIds()) : "");
        request.setStatus("PENDING_APPROVAL");
        request.setBlocked(false);
        request.setCbsUpdateStatus("PENDING");

        try {
            request.setImpactAssessmentJson(MAPPER.writeValueAsString(assessment));
        } catch (Exception e) {
            request.setImpactAssessmentJson("{}");
        }

        CollateralReleaseRequest saved = collateralReleaseRequestRepository.save(request);

        // Update collateral
        collateral.setActiveReleaseRequestId(saved.getId());
        collateralRepository.save(collateral);

        // Submit to the checker role configured on the Administration > Workflow Approval Hierarchy screen.
        String approverRole = roleHierarchyService.resolveApproverRole("PROC_COLLATERAL_RELEASE", "APPROVE_COLLATERAL_RELEASE");
        WorkflowTask task = cimsService.submitToWorkflow("COLLATERAL_RELEASE", "Collateral Release", saved.getId(),
                "APPROVE_COLLATERAL_RELEASE", "{\"releaseRequestId\":\"" + saved.getId() + "\",\"collateralCode\":\"" + collateral.getCode() + "\"}",
                "Early Release Request: " + saved.getReason(), requesterId, approverRole);

        saved.setWorkflowTaskId(task.getId());
        collateralReleaseRequestRepository.save(saved);

        cimsService.logAudit(requesterId, "MAKER", "SUBMIT_COLLATERAL_RELEASE", "CollateralReleaseRequest",
                saved.getId(), "Status", "Draft", "Pending Approval",
                "Submitted early collateral release request for " + collateral.getCode());

        return saved;
    }

    /**
     * Approves collateral release request.
     * Enforces maker-checker dual control, re-validates conditions, and marks CBS update as pending manual execution.
     */
    @Transactional
    public CollateralReleaseRequest approveReleaseRequest(String requestId, String approverId, String approverRole, String comments) {
        User actor = requireApprovalActor();
        final String effectiveApprover = actorReference(actor);
        final String effectiveRole = actor.getRole();
        CollateralReleaseRequest request = collateralReleaseRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Release request not found: " + requestId));
        assertReleaseAccess(request);
        assertReleaseApprovalAuthority(request, effectiveApprover);

        if (!"PENDING_APPROVAL".equalsIgnoreCase(request.getStatus()) && !"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Invalid state transition: Release request " + requestId + " is in '" + request.getStatus() + "' status and cannot be approved. Only PENDING_APPROVAL requests can be approved.");
        }

        if (effectiveApprover.equalsIgnoreCase(request.getRequesterId())) {
            throw new IllegalArgumentException("Maker-checker violation: Requester cannot approve their own release request.");
        }

        // Re-run impact assessment at time of approval
        PreReleaseImpactAssessmentDto assessment = performPreReleaseImpactAssessment(request.getCollateralId(),
                "ALL".equalsIgnoreCase(request.getFacilityIds()) ? null : Arrays.asList(request.getFacilityIds().split(",")));

        if (assessment.isHardBlocked()) {
            request.setBlocked(true);
            request.setBlockReasons(String.join("; ", assessment.getBlockingReasons()));
            collateralReleaseRequestRepository.save(request);
            throw new IllegalStateException("Approval prevented: Release conditions have deteriorated since submission:\n• "
                    + String.join("\n• ", assessment.getBlockingReasons()));
        }

        request.setStatus("APPROVED");
        request.setCbsUpdateStatus("PENDING"); // CBS update remains a MANUAL action!
        request.setApproverId(effectiveApprover);
        request.setDecisionDate(LocalDateTime.now().toString());
        request.setDecisionComments(comments);
        CollateralReleaseRequest saved = collateralReleaseRequestRepository.save(request);

        cimsService.logAudit(effectiveApprover, effectiveRole, "APPROVE_COLLATERAL_RELEASE",
                "CollateralReleaseRequest", saved.getId(), "Status", "Pending Approval", "Approved",
                "Approved collateral release. CBS linkage removal must now be executed manually.");

        return saved;
    }

    /**
     * Rejects collateral release request.
     */
    @Transactional
    public CollateralReleaseRequest rejectReleaseRequest(String requestId, String approverId, String approverRole, String comments) {
        User actor = requireApprovalActor();
        final String effectiveApprover = actorReference(actor);
        final String effectiveRole = actor.getRole();
        CollateralReleaseRequest request = collateralReleaseRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Release request not found: " + requestId));
        assertReleaseAccess(request);
        assertReleaseApprovalAuthority(request, effectiveApprover);

        if (!"PENDING_APPROVAL".equalsIgnoreCase(request.getStatus()) && !"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Invalid state transition: Release request " + requestId + " is in '" + request.getStatus() + "' status and cannot be rejected. Only PENDING_APPROVAL requests can be rejected.");
        }

        if (effectiveApprover.equalsIgnoreCase(request.getRequesterId())) {
            throw new IllegalArgumentException("Maker-checker violation: Requester cannot reject their own release request.");
        }

        request.setStatus("REJECTED");
        request.setApproverId(effectiveApprover);
        request.setDecisionDate(LocalDateTime.now().toString());
        request.setDecisionComments(comments);
        CollateralReleaseRequest saved = collateralReleaseRequestRepository.save(request);

        // Clear active release request on collateral
        collateralRepository.findById(request.getCollateralId()).ifPresent(c -> {
            c.setActiveReleaseRequestId(null);
            collateralRepository.save(c);
        });

        cimsService.logAudit(effectiveApprover, effectiveRole, "REJECT_COLLATERAL_RELEASE",
                "CollateralReleaseRequest", saved.getId(), "Status", "Pending Approval", "Rejected",
                "Rejected collateral release request: " + comments);

        return saved;
    }

    /**
     * Returns collateral release request to maker for correction.
     */
    @Transactional
    public CollateralReleaseRequest returnReleaseRequest(String requestId, String approverId, String approverRole, String comments) {
        User actor = requireApprovalActor();
        final String effectiveApprover = actorReference(actor);
        final String effectiveRole = actor.getRole();
        CollateralReleaseRequest request = collateralReleaseRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Release request not found: " + requestId));
        assertReleaseAccess(request);
        assertReleaseApprovalAuthority(request, effectiveApprover);

        if (!"PENDING_APPROVAL".equalsIgnoreCase(request.getStatus()) && !"PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Invalid state transition: Release request " + requestId + " is in '" + request.getStatus() + "' status and cannot be returned. Only PENDING_APPROVAL requests can be returned.");
        }

        if (effectiveApprover.equalsIgnoreCase(request.getRequesterId())) {
            throw new IllegalArgumentException("Maker-checker violation: Requester cannot return their own release request.");
        }

        request.setStatus("RETURNED");
        request.setApproverId(effectiveApprover);
        request.setDecisionDate(LocalDateTime.now().toString());
        request.setDecisionComments(comments);
        CollateralReleaseRequest saved = collateralReleaseRequestRepository.save(request);

        // Clear active release request on collateral so maker can edit or resubmit
        collateralRepository.findById(request.getCollateralId()).ifPresent(c -> {
            c.setActiveReleaseRequestId(null);
            collateralRepository.save(c);
        });

        cimsService.logAudit(effectiveApprover, effectiveRole, "RETURN_COLLATERAL_RELEASE",
                "CollateralReleaseRequest", saved.getId(), "Status", "Pending Approval", "Returned",
                "Returned collateral release request for correction: " + comments);

        return saved;
    }

    /**
     * Records the outcome of manual CBS loan-collateral linkage removal.
     */
    @Transactional
    public CollateralReleaseRequest recordManualCbsUpdate(ManualCbsUpdateDto dto, String executedBy) {
        CollateralReleaseRequest request = collateralReleaseRequestRepository.findById(dto.getReleaseRequestId())
                .orElseThrow(() -> new IllegalArgumentException("Release request not found: " + dto.getReleaseRequestId()));

        if (!"APPROVED".equalsIgnoreCase(request.getStatus()) && !"CBS_UPDATE_PENDING".equalsIgnoreCase(request.getStatus())) {
            throw new IllegalStateException("Cannot record CBS update for release request in status: " + request.getStatus());
        }

        boolean isCompleted = "COMPLETED".equalsIgnoreCase(dto.getCbsStatus());
        if (isCompleted) {
            if (dto.getCbsReferenceNo() == null || dto.getCbsReferenceNo().trim().isBlank()) {
                throw new IllegalArgumentException("CBS transaction reference number is mandatory to confirm CBS linkage removal.");
            }
            if (dto.getUpdateNotes() == null || dto.getUpdateNotes().trim().isBlank()) {
                throw new IllegalArgumentException("CBS update notes are mandatory to confirm CBS linkage removal.");
            }
            if (executedBy == null || executedBy.trim().isBlank()) {
                throw new IllegalArgumentException("Confirming officer identity is mandatory to complete CBS release update.");
            }
        }
        request.setCbsUpdateStatus(isCompleted ? "COMPLETED" : "FAILED");
        request.setCbsUpdatedBy(executedBy);
        request.setCbsUpdatedAt(LocalDateTime.now().toString());
        request.setCbsReferenceNo(dto.getCbsReferenceNo());
        request.setCbsUpdateNotes(dto.getUpdateNotes());

        if (isCompleted) {
            request.setStatus("RELEASE_COMPLETED");

            // Deactivate or release the collateral linkage in CIMS using unified lookup (Audit Finding 12)
            Collateral col = collateralRepository.findById(request.getCollateralId()).orElse(null);
            if (col != null) {
                List<LoanCollateralLink> links = findLinksForCollateral(col);
                boolean partial = !"ALL".equalsIgnoreCase(request.getFacilityIds()) && "PARTIAL_FACILITY_LINK".equalsIgnoreCase(request.getReleaseType());
                Set<String> targetFacs = partial ? new HashSet<>(Arrays.asList(request.getFacilityIds().split(","))) : Collections.emptySet();

                boolean allLinksReleased = true;
                for (LoanCollateralLink link : links) {
                    boolean shouldRelease = !partial || targetFacs.contains(link.getLoanAccountId()) || targetFacs.contains(link.getFacilityId());
                    if (shouldRelease) {
                        link.setRelationshipStatus("Released");
                        link.setStatus("Released");
                        link.setReleaseStatus("Released");
                        link.setAuthStat("A");
                        loanCollateralLinkRepository.save(link);
                    } else if (!"Released".equalsIgnoreCase(link.getStatus())) {
                        allLinksReleased = false;
                    }
                }

                if (allLinksReleased || !partial) {
                    col.setStatus("Released");
                }
                col.setActiveReleaseRequestId(null);
                collateralRepository.save(col);

                // Re-evaluate adequacy post-release
                insuranceAdequacyService.evaluateAdequacy(col.getId());
            }

            cimsService.logAudit(executedBy, "OPERATIONS", "CBS_LINKAGE_REMOVAL_COMPLETED",
                    "CollateralReleaseRequest", request.getId(), "CbsUpdateStatus", "Pending", "Completed",
                    "Manual CBS linkage removal verified and completed. Ref: " + dto.getCbsReferenceNo());
        } else {
            cimsService.logAudit(executedBy, "OPERATIONS", "CBS_LINKAGE_REMOVAL_FAILED",
                    "CollateralReleaseRequest", request.getId(), "CbsUpdateStatus", "Pending", "Failed",
                    "Manual CBS linkage removal failed: " + dto.getUpdateNotes());
        }

        return collateralReleaseRequestRepository.save(request);
    }

    public List<CollateralReleaseRequest> getAllReleaseRequests() {
        AuthorizationScopeService.Scope scope = authorizationScopeService.currentScope();
        if (scope.isBankWide()) return collateralReleaseRequestRepository.findAll();
        return collateralReleaseRequestRepository.findAll().stream()
                .filter(r -> isReleaseVisible(r, scope))
                .toList();
    }

    public Optional<CollateralReleaseRequest> getReleaseRequestById(String id) {
        Optional<CollateralReleaseRequest> result = collateralReleaseRequestRepository.findById(id);
        if (result.isEmpty()) return result;
        AuthorizationScopeService.Scope scope = authorizationScopeService.currentScope();
        if (scope.isBankWide() || isReleaseVisible(result.get(), scope)) return result;
        return Optional.empty();
    }

    private boolean isReleaseVisible(CollateralReleaseRequest request, AuthorizationScopeService.Scope scope) {
        if (request == null || request.getCollateralId() == null) return false;
        Collateral collateral = collateralRepository.findById(request.getCollateralId())
                .or(() -> collateralRepository.findByCode(request.getCollateralId()))
                .orElse(null);
        if (collateral == null) return false;
        Set<String> customerIds = collateral.getCustomerId() == null
                ? Set.of() : Set.of(collateral.getCustomerId());
        return scope.allowsCollateral(collateral, customerIds);
    }

    private void assertReleaseAccess(CollateralReleaseRequest request) {
        if (request == null) return;
        AuthorizationScopeService.Scope scope = authorizationScopeService.currentScope();
        if (!scope.isBankWide() && !isReleaseVisible(request, scope)) {
            throw new IllegalStateException("Access denied: collateral release request "
                    + request.getId() + " is outside your assigned branch/segment scope.");
        }
    }

    private void assertReleaseApprovalAuthority(CollateralReleaseRequest request, String approverId) {
        String taskId = request == null ? null : request.getWorkflowTaskId();
        if (taskId == null || taskId.isBlank()) {
            throw new IllegalStateException("Release request has no workflow task; approval authority cannot be verified.");
        }
        workflowAuthorizationService.assertCanApprove(approverId, taskId);
    }
    private List<LoanCollateralLink> findLinksForCollateral(Collateral col) {
        if (col == null) return Collections.emptyList();
        List<LoanCollateralLink> links = new ArrayList<>(loanCollateralLinkRepository.findByCollateralId(col.getId()));
        if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
            List<LoanCollateralLink> byCode = loanCollateralLinkRepository.findByCollateralId(col.getCode());
            for (LoanCollateralLink l : byCode) {
                if (links.stream().noneMatch(existing -> existing.getId().equalsIgnoreCase(l.getId()))) {
                    links.add(l);
                }
            }
        }
        return links;
    }
}
