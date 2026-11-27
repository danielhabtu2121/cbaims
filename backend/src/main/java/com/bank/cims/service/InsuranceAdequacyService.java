package com.bank.cims.service;

import com.bank.cims.dto.InsuranceAdequacyAssessmentDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class InsuranceAdequacyService {

    private static final Logger log = LoggerFactory.getLogger(InsuranceAdequacyService.class);

    private User requireActor() {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()
                || actor.getUsername() == null || actor.getUsername().isBlank()
                || actor.getRole() == null || actor.getRole().isBlank()) {
            throw new IllegalStateException("A signed-in user with an assigned role is required for this action.");
        }
        return actor;
    }

    private void assertCurrentUserCanApprove(String exceptionId) {
        WorkflowTask task = workflowTaskRepository.findByEntityTypeAndEntityId("Insurance Exception", exceptionId)
                .stream()
                .filter(t -> "Pending".equalsIgnoreCase(t.getStatus()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No pending workflow task found for insurance exception " + exceptionId + "."));
        workflowAuthorizationService.assertCanApprove(requireActor().getUsername(), task.getId());
    }

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private InsuranceCoverageRuleService insuranceCoverageRuleService;

    @Autowired
    private InsuranceExceptionRepository insuranceExceptionRepository;

    @Autowired
    private EffectiveInsuranceService effectiveInsuranceService;

    @Autowired(required = false)
    private PolicyCollateralAllocationService policyCollateralAllocationService;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private AuthorizationScopeService authorizationScopeService;

    @Autowired
    private WorkflowAuthorizationService workflowAuthorizationService;

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private ConfigurationService configurationService;

    public InsuranceAdequacyAssessmentDto evaluateAdequacy(String collateralId) {
        InsuranceAdequacyAssessmentDto dto = new InsuranceAdequacyAssessmentDto();
        dto.setCollateralId(collateralId);

        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElse(null);

        if (collateral == null) {
            dto.setOverallAdequacyStatus("NOT_FOUND");
            dto.setCalculationExplanation("Collateral record not found for reference: " + collateralId);
            return dto;
        }

        dto.setCollateralCode(collateral.getCode());
        dto.setCollateralType(collateral.getType());
        dto.setBusinessSegment(collateral.getOwningSegment());

        // 1. Bank-Assessed Valuation and Insurable Portion
        double assessedVal = collateral.getValuationAmount();
        dto.setBankAssessedValue(assessedVal);
        dto.setBankAssessedValueSource(collateral.getBankAssessedValueSource());
        dto.setEstimatedValue(collateral.getEstimatedValue());
        dto.setEstimatedValueSource(collateral.getEstimatedValueSource());
        dto.setEstimatedValuationDate(collateral.getEstimatedValuationDate());
        dto.setLandValue(collateral.getLandValue());

        boolean isBuilding = isBuildingCollateral(collateral.getCategory(), collateral.getType());
        Double insurableVal = collateral.getInsurableValue();

        if (isBuilding && (insurableVal == null || insurableVal <= 0)) {
            dto.getMissingDataWarnings().add("MISSING_INSURABLE_VALUE: Bank-assessed insurable structure value is not recorded. For buildings, Credit Policy mandates evaluating structure excluding land. Total valuation cannot be silently used as insurable value.");
        } else if (insurableVal == null || insurableVal <= 0) {
            insurableVal = assessedVal; // For non-building collateral, insurable value equals total assessed value
        }
        dto.setBankAssessedInsurableValue(insurableVal);

        // 2. Applicable Configurable Credit Policy Rule (BR-18)
        Optional<InsuranceCoverageRule> ruleOpt = insuranceCoverageRuleService.resolveApplicableRule(collateral.getType(), collateral.getOwningSegment());
        double reqPct = 100.0;
        double tolerancePct = 10.0;
        boolean creditPolicyApproved = false;

        if (ruleOpt.isPresent()) {
            InsuranceCoverageRule rule = ruleOpt.get();
            dto.setApplicableRuleId(rule.getId());
            dto.setApplicableRuleDescription(String.format("Rule [%s]: %s / %s (Required: %.1f%%, Tolerance: %.1f%%)",
                    rule.getId(), rule.getCollateralType(), rule.getBusinessSegment(),
                    rule.getRequiredCoveragePercentage(), rule.getOverInsuranceTolerancePct()));
            reqPct = rule.getRequiredCoveragePercentage();
            tolerancePct = rule.getOverInsuranceTolerancePct();
            creditPolicyApproved = rule.isCreditPolicyApproved();
        } else {
            dto.setMissingRuleWarning(true);
            dto.getMissingDataWarnings().add("UNCONFIGURED_CREDIT_POLICY_RULE: No active Credit Policy rule configured for " 
                    + collateral.getType() + " in " + collateral.getOwningSegment() + ". Default 100% threshold is tentative and subject to confirmation.");
            dto.setApplicableRuleDescription("TENTATIVE DEFAULT (Pending Credit Policy Configuration): 100% required coverage");
        }

        dto.setRequiredCoveragePercentage(reqPct);
        dto.setOverInsuranceTolerancePct(tolerancePct);
        dto.setRuleCreditPolicyApproved(creditPolicyApproved);

        // 3. Primary Adequacy Test: Bank-assessed insurable value × required coverage %
        double baseInsurable = (insurableVal != null && insurableVal > 0) ? insurableVal : 0.0;
        double requiredCoverageAmt = baseInsurable * (reqPct / 100.0);
        dto.setRequiredCoverageAmount(requiredCoverageAmt);

        // 4. Aggregated Active Insured Amount from CIMS Policies (explicit per-collateral allocation)
        List<InsurancePolicy> policies;
        Map<String, Double> allocatedByPolicyId = null;
        if (policyCollateralAllocationService != null) {
            PolicyCollateralAllocationService.ResolvedCollateralPolicies resolved =
                    policyCollateralAllocationService.getPoliciesForCollateral(collateral.getId(), collateral.getCode());
            policies = resolved.policies;
            allocatedByPolicyId = resolved.allocatedAmountByPolicyId;
        } else {
            policies = insurancePolicyRepository.findByCollateralId(collateral.getId());
            if (policies.isEmpty() && collateral.getCode() != null) {
                policies = insurancePolicyRepository.findByCollateralId(collateral.getCode());
            }
        }

        EffectiveInsuranceService.PolicyCategorizationResult polCat =
                effectiveInsuranceService.categorizePoliciesWithAllocations(policies, allocatedByPolicyId, LocalDate.now(), 30);
        double totalInsured = polCat.totalActiveSumInsured;
        dto.setTotalInsuredAmount(totalInsured);

        for (InsurancePolicy p : polCat.activeValidPolicies) {
            double allocAmt = (allocatedByPolicyId != null && allocatedByPolicyId.containsKey(p.getId()))
                    ? allocatedByPolicyId.get(p.getId())
                    : p.getInsuredAmount();
            Map<String, Object> pMap = new HashMap<>();
            pMap.put("id", p.getId());
            pMap.put("policyNumber", p.getPolicyNumber());
            pMap.put("insurer", p.getInsurerName());
            pMap.put("insuredAmount", allocAmt);
            pMap.put("totalPolicySumInsured", p.getInsuredAmount());
            pMap.put("allocatedInsuredAmount", allocAmt);
            pMap.put("effectiveDate", p.getEffectiveDate());
            pMap.put("expiryDate", p.getExpiryDate());
            pMap.put("status", p.getStatus());
            dto.getContributingPolicies().add(pMap);
        }

        // Primary Test Evaluation
        if (requiredCoverageAmt > 0) {
            double pRatio = Math.round((totalInsured / requiredCoverageAmt) * 1000.0) / 10.0;
            dto.setPrimaryCoverageRatio(pRatio);
            if (totalInsured <= 0) {
                dto.setPrimaryTestStatus("Uninsured");
                dto.setPrimaryTestPassed(false);
            } else if (totalInsured + 1e-6 < requiredCoverageAmt) {
                dto.setPrimaryTestStatus("Underinsured");
                dto.setPrimaryTestPassed(false);
            } else if (totalInsured > requiredCoverageAmt * (1.0 + tolerancePct / 100.0)) {
                dto.setPrimaryTestStatus("Over insured");
                dto.setPrimaryTestPassed(true);
            } else {
                dto.setPrimaryTestStatus("Adequate");
                dto.setPrimaryTestPassed(true);
            }
        } else if (isBuilding && (insurableVal == null || insurableVal <= 0)) {
            dto.setPrimaryTestStatus("Underinsured");
            dto.setPrimaryTestPassed(false);
            dto.setPrimaryCoverageRatio(0.0);
        } else {
            dto.setPrimaryTestStatus(totalInsured > 0 ? "Adequate" : "Uninsured");
            dto.setPrimaryTestPassed(totalInsured > 0);
            dto.setPrimaryCoverageRatio(100.0);
        }

        // 5. Secondary Adequacy Test: Aggregate Outstanding Exposure across all secured facilities (BR-03, BR-11)
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        if (links.isEmpty() && collateral.getCode() != null) {
            links = loanCollateralLinkRepository.findByCollateralId(collateral.getCode());
        }

        double aggregateExposure = 0.0;
        Set<String> distinctFacilityIds = new HashSet<>();
        boolean missingBalances = false;

        for (LoanCollateralLink link : links) {
            if (!link.isEffectiveActive()) {
                continue;
            }

            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (facId == null || facId.isBlank()) continue;

            LoanAccount facility = loanAccountRepository.findById(facId)
                    .or(() -> loanAccountRepository.findByLoanReference(facId))
                    .or(() -> loanAccountRepository.findFirstByLineCodeIgnoreCase(facId))
                    .or(() -> link.getFacilityId() != null ? loanAccountRepository.findFirstByLineCodeIgnoreCase(link.getFacilityId()) : Optional.empty())
                    .orElse(null);

            if (facility != null) {
                if (distinctFacilityIds.add(facility.getId())) {
                    aggregateExposure += facility.getOutstandingBalance();
                    if (facility.getOutstandingBalance() < 0) {
                        missingBalances = true;
                        dto.getStaleOrMissingFacilities().add(facility.getLoanReference() + " (Invalid balance)");
                    }
                    String balanceAsOf = facility.getCbsSyncedAt();
                    if (balanceAsOf == null || balanceAsOf.isBlank()) {
                        balanceAsOf = facility.getMakerDtStamp();
                    }
                    boolean isStaleOrUnsynced = "Stale".equalsIgnoreCase(facility.getCbsSyncStatus())
                            || "Failed".equalsIgnoreCase(facility.getCbsSyncStatus())
                            || balanceAsOf == null || balanceAsOf.isBlank();
                    if (isStaleOrUnsynced) {
                        missingBalances = true;
                        dto.getStaleOrMissingFacilities().add(facility.getLoanReference() + " (Stale or unsynchronized CBS balance)");
                    }
                }
                Map<String, Object> fMap = new HashMap<>();
                fMap.put("facilityId", facility.getId());
                fMap.put("loanReference", facility.getLoanReference());
                fMap.put("facilityType", facility.getFacilityType());
                fMap.put("approvedLimit", facility.getApprovedLimit());
                fMap.put("outstandingBalance", facility.getOutstandingBalance());
                String balanceAsOf = facility.getCbsSyncedAt() != null ? facility.getCbsSyncedAt() : facility.getMakerDtStamp();
                fMap.put("asOfDate", balanceAsOf != null ? balanceAsOf : LocalDate.now().toString());
                dto.getContributingFacilities().add(fMap);
            } else {
                missingBalances = true;
                dto.getStaleOrMissingFacilities().add("Facility ID: " + facId + " (Not found in CBS feed)");
            }
        }

        dto.setAggregateSecuredExposure(aggregateExposure);
        dto.setHasMissingOrStaleBalances(missingBalances);

        // Secondary Test Evaluation
        if (aggregateExposure > 0) {
            double sRatio = Math.round((totalInsured / aggregateExposure) * 1000.0) / 10.0;
            dto.setSecondaryCoverageRatio(sRatio);
            if (totalInsured + 1e-6 < aggregateExposure) {
                dto.setSecondaryTestStatus("Underinsured");
                dto.setSecondaryTestPassed(false);
            } else if (totalInsured > aggregateExposure * (1.0 + tolerancePct / 100.0)) {
                dto.setSecondaryTestStatus("Over insured");
                dto.setSecondaryTestPassed(true);
            } else {
                dto.setSecondaryTestStatus("Adequate");
                dto.setSecondaryTestPassed(true);
            }
        } else {
            dto.setSecondaryCoverageRatio(null);
            dto.setSecondaryTestStatus("Not Applicable (No Outstanding Exposure)");
            dto.setSecondaryTestPassed(true);
        }

        // 6. Check for Active Approved Insurance Exception (BR-07, BR-12)
        String todayStr = LocalDate.now().toString();
        List<InsuranceException> exceptions = insuranceExceptionRepository.findByCollateralIdAndApprovalStatus(collateral.getId(), "Approved");
        InsuranceException activeException = null;
        for (InsuranceException exc : exceptions) {
            boolean isEffective = exc.getValidityStartDate() == null || exc.getValidityStartDate().compareTo(todayStr) <= 0;
            boolean notExpired = exc.getValidityEndDate() != null && exc.getValidityEndDate().compareTo(todayStr) >= 0;
            if (exc.getValidityEndDate() != null && exc.getValidityEndDate().compareTo(todayStr) < 0) {
                // Expired exception!
                exc.setApprovalStatus("Expired");
                insuranceExceptionRepository.save(exc);
            } else if (isEffective && notExpired) {
                activeException = exc;
                break;
            }
        }

        if (activeException != null) {
            double deficit = Math.max(0, requiredCoverageAmt - totalInsured);
            boolean amountSufficient = activeException.getApprovedExceptionAmount() >= deficit || activeException.getApprovedExceptionAmount() >= requiredCoverageAmt;
            if (amountSufficient) {
                dto.setHasActiveException(true);
                Map<String, Object> excMap = new HashMap<>();
                excMap.put("id", activeException.getId());
                excMap.put("type", activeException.getExceptionType());
                excMap.put("approvedAmount", activeException.getApprovedExceptionAmount());
                excMap.put("validityStartDate", activeException.getValidityStartDate());
                excMap.put("validityEndDate", activeException.getValidityEndDate());
                excMap.put("reviewDate", activeException.getReviewDate());
                excMap.put("reason", activeException.getReason());
                excMap.put("approverId", activeException.getSupervisorApproverId());
                dto.setActiveExceptionDetails(excMap);
            } else {
                dto.setHasActiveException(false);
                dto.getMissingDataWarnings().add(String.format(Locale.ROOT,
                    "Active exception %s approved amount (ETB %,.2f) is insufficient to cover total insurance deficit (ETB %,.2f).",
                    activeException.getId(), activeException.getApprovedExceptionAmount(), deficit));
            }
        }

        // 7. Overall Adequacy Status Reconciled
        boolean overInsured = "Over insured".equalsIgnoreCase(dto.getPrimaryTestStatus())
                || "Over insured".equalsIgnoreCase(dto.getSecondaryTestStatus());
        dto.setOverInsured(overInsured);
        if (overInsured) {
            dto.setOverInsuranceMessage(String.format(Locale.ROOT,
                    "INFORMATIONAL: Insured amount (ETB %,.2f) exceeds coverage tolerance (%.1f%%). This warning is informational and does not block processing.",
                    totalInsured, tolerancePct));
        }

        String mode = configurationService != null ? configurationService.getInsuranceAdequacyFormulaMode() : "TWO_TIER";
        boolean primaryFailed = !dto.isPrimaryTestPassed();
        boolean secondaryFailed = !dto.isSecondaryTestPassed();
        boolean failed;
        if ("SINGLE_TIER_ASSET".equalsIgnoreCase(mode)) {
            failed = primaryFailed;
        } else if ("SINGLE_TIER_EXPOSURE".equalsIgnoreCase(mode)) {
            failed = secondaryFailed;
        } else {
            failed = primaryFailed || secondaryFailed;
        }

        String overallStatus;
        if (!dto.getMissingDataWarnings().isEmpty() && (insurableVal == null || insurableVal <= 0) && isBuilding) {
            overallStatus = "Underinsured"; // Missing insurable structure value cannot pass
        } else if (dto.isHasActiveException()) {
            overallStatus = "Adequate"; // Protected by approved supervisor exception
        } else if (totalInsured <= 0) {
            overallStatus = "Uninsured";
        } else if (failed) {
            overallStatus = "Underinsured";
        } else if (overInsured) {
            overallStatus = "Over insured";
        } else {
            overallStatus = "Adequate";
        }

        dto.setOverallAdequacyStatus(overallStatus);

        // Explanation formulation
        StringBuilder exp = new StringBuilder();
        exp.append(String.format(Locale.ROOT, "Primary Test: Bank-assessed insurable value ETB %,.2f × %.1f%% required coverage = ETB %,.2f. Total active insured amount: ETB %,.2f -> %s. ",
                baseInsurable, reqPct, requiredCoverageAmt, totalInsured, dto.getPrimaryTestStatus()));
        exp.append(String.format(Locale.ROOT, "Secondary Test: Aggregate secured exposure across %d distinct facilities = ETB %,.2f -> %s. ",
                distinctFacilityIds.size(), aggregateExposure, dto.getSecondaryTestStatus()));
        if (dto.isHasActiveException()) {
            exp.append(String.format(Locale.ROOT, "Covered under Approved Exception %s (Amount: ETB %,.2f until %s). ",
                    activeException.getId(), activeException.getApprovedExceptionAmount(), activeException.getValidityEndDate()));
        }
        if (overInsured) {
            exp.append("⚠️ Over-insurance tolerance exceeded (informational only). ");
        }
        if (!dto.getMissingDataWarnings().isEmpty()) {
            exp.append("⚠️ Warnings: ").append(String.join("; ", dto.getMissingDataWarnings()));
        }
        dto.setCalculationExplanation(exp.toString());

        // Update collateral status in DB if active
        if ("Active".equalsIgnoreCase(collateral.getStatus()) || "Approved".equalsIgnoreCase(collateral.getStatus())) {
            collateral.setInsuredAmount(totalInsured);
            collateral.setInsuranceStatus(overallStatus);
            collateral.setNetInsuranceCoveragePct(dto.getPrimaryCoverageRatio() != null ? dto.getPrimaryCoverageRatio() : 0.0);
            collateralRepository.save(collateral);
        }

        return dto;
    }

    private boolean isBuildingCollateral(String category, String type) {
        String cat = category != null ? category.toLowerCase() : "";
        String t = type != null ? type.toLowerCase() : "";
        return cat.contains("immovable") || cat.contains("building") || cat.contains("property")
                || t.contains("building") || t.contains("property") || t.contains("warehouse") || t.contains("factory");
    }

    // --- Insurance Exception Workflow (BR-07, BR-12) ---

    @Transactional
    public InsuranceException submitException(InsuranceException exception, String requestingUserId) {
        final String effectiveRequester = requireActor().getUsername();
        if (exception.getCollateralId() == null || exception.getCollateralId().isBlank()) {
            throw new IllegalArgumentException("Collateral ID is mandatory for insurance exception.");
        }
        if (exception.getReason() == null || exception.getReason().trim().isBlank()) {
            throw new IllegalArgumentException("Reason is mandatory for insurance exception.");
        }
        if (exception.getValidityStartDate() == null || exception.getValidityEndDate() == null) {
            throw new IllegalArgumentException("Validity start and end dates are mandatory.");
        }
        if (exception.getReviewDate() == null || exception.getReviewDate().isBlank()) {
            throw new IllegalArgumentException("Review date is mandatory.");
        }
        if (exception.getApprovedExceptionAmount() <= 0) {
            throw new IllegalArgumentException("Exception amount must be greater than zero.");
        }

        exception.setId("ins-exc-" + UUID.randomUUID().toString().substring(0, 8));
        exception.setRequestingUserId(effectiveRequester);
        exception.setApprovalStatus("Pending");
        exception.setCreatedAt(LocalDateTime.now().toString());

        InsuranceException saved = insuranceExceptionRepository.save(exception);

        // Submit to workflow inbox for supervisor dual-control authorization
        cimsService.submitToWorkflow("INSURANCE_EXCEPTION", "Insurance Exception", saved.getId(),
                "APPROVE_INSURANCE_EXCEPTION", "{\"exceptionId\":\"" + saved.getId() + "\",\"amount\":" + saved.getApprovedExceptionAmount() + "}",
                "Exception Request: " + saved.getReason(), effectiveRequester, null);

        cimsService.logAudit(effectiveRequester, "MAKER", "SUBMIT_INSURANCE_EXCEPTION", "InsuranceException",
                saved.getId(), "Status", "Draft", "Pending Approval", "Submitted insurance exception for collateral " + saved.getCollateralId());

        return saved;
    }

    @Transactional
    public InsuranceException approveException(String exceptionId, String supervisorId, String supervisorRole, String comments) {
        User actor = requireActor();
        final String effectiveApprover = actor.getUsername();
        final String effectiveRole = actor.getRole();
        assertCurrentUserCanApprove(exceptionId);

        InsuranceException exc = insuranceExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Insurance exception not found: " + exceptionId));

        if (!"Pending".equalsIgnoreCase(exc.getApprovalStatus()) && !"Pending Approval".equalsIgnoreCase(exc.getApprovalStatus())) {
            throw new IllegalStateException("Invalid state transition: Exception " + exceptionId + " is in '" + exc.getApprovalStatus() + "' status and cannot be approved. Only Pending exceptions can be approved.");
        }
        if (effectiveApprover.equalsIgnoreCase(exc.getRequestingUserId())) {
            throw new IllegalArgumentException("Maker-checker violation: Requester cannot approve their own exception request.");
        }

        exc.setSupervisorApproverId(effectiveApprover);
        exc.setApprovalStatus("Approved");
        exc.setDecisionDate(LocalDateTime.now().toString());
        exc.setDecisionComments(comments);
        InsuranceException saved = insuranceExceptionRepository.save(exc);

        cimsService.logAudit(effectiveApprover, effectiveRole, "APPROVE_INSURANCE_EXCEPTION",
                "InsuranceException", saved.getId(), "ApprovalStatus", "Pending", "Approved",
                "Approved insurance exception until " + saved.getValidityEndDate());

        // Re-evaluate collateral adequacy
        evaluateAdequacy(saved.getCollateralId());

        return saved;
    }

    @Transactional
    public InsuranceException rejectException(String exceptionId, String supervisorId, String supervisorRole, String comments) {
        User actor = requireActor();
        final String effectiveApprover = actor.getUsername();
        final String effectiveRole = actor.getRole();
        assertCurrentUserCanApprove(exceptionId);

        InsuranceException exc = insuranceExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Insurance exception not found: " + exceptionId));

        if (!"Pending".equalsIgnoreCase(exc.getApprovalStatus()) && !"Pending Approval".equalsIgnoreCase(exc.getApprovalStatus())) {
            throw new IllegalStateException("Invalid state transition: Exception " + exceptionId + " is in '" + exc.getApprovalStatus() + "' status and cannot be rejected. Only Pending exceptions can be rejected.");
        }
        if (effectiveApprover.equalsIgnoreCase(exc.getRequestingUserId())) {
            throw new IllegalArgumentException("Maker-checker violation: Requester cannot reject their own exception request.");
        }

        exc.setSupervisorApproverId(effectiveApprover);
        exc.setApprovalStatus("Rejected");
        exc.setDecisionDate(LocalDateTime.now().toString());
        exc.setDecisionComments(comments);
        InsuranceException saved = insuranceExceptionRepository.save(exc);

        cimsService.logAudit(effectiveApprover, effectiveRole, "REJECT_INSURANCE_EXCEPTION",
                "InsuranceException", saved.getId(), "ApprovalStatus", "Pending", "Rejected",
                "Rejected insurance exception: " + comments);

        return saved;
    }

    @Transactional
    public InsuranceException returnException(String exceptionId, String supervisorId, String supervisorRole, String comments) {
        User actor = requireActor();
        final String effectiveApprover = actor.getUsername();
        final String effectiveRole = actor.getRole();
        assertCurrentUserCanApprove(exceptionId);

        InsuranceException exc = insuranceExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Insurance exception not found: " + exceptionId));

        if (!"Pending".equalsIgnoreCase(exc.getApprovalStatus()) && !"Pending Approval".equalsIgnoreCase(exc.getApprovalStatus())) {
            throw new IllegalStateException("Invalid state transition: Exception " + exceptionId + " is in '" + exc.getApprovalStatus() + "' status and cannot be returned. Only Pending exceptions can be returned.");
        }
        if (effectiveApprover.equalsIgnoreCase(exc.getRequestingUserId())) {
            throw new IllegalArgumentException("Maker-checker violation: Requester cannot return their own exception request.");
        }

        exc.setSupervisorApproverId(effectiveApprover);
        exc.setApprovalStatus("Returned");
        exc.setDecisionDate(LocalDateTime.now().toString());
        exc.setDecisionComments(comments);
        InsuranceException saved = insuranceExceptionRepository.save(exc);

        cimsService.logAudit(effectiveApprover, effectiveRole, "RETURN_INSURANCE_EXCEPTION",
                "InsuranceException", saved.getId(), "ApprovalStatus", "Pending", "Returned",
                "Returned insurance exception for correction: " + comments);

        return saved;
    }

    @Transactional
    public InsuranceException resolveException(String exceptionId, String resolvedBy, String notes) {
        final String effectiveResolver = requireActor().getUsername();
        InsuranceException exc = insuranceExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Insurance exception not found: " + exceptionId));

        if (!"Approved".equalsIgnoreCase(exc.getApprovalStatus())) {
            throw new IllegalStateException("Invalid state transition: Exception " + exceptionId + " is in '" + exc.getApprovalStatus() + "' status and cannot be resolved. Only Approved exceptions can be marked as Resolved.");
        }

        exc.setApprovalStatus("Resolved");
        exc.setResolvedAt(LocalDateTime.now().toString());
        exc.setResolutionNotes(notes);
        InsuranceException saved = insuranceExceptionRepository.save(exc);

        cimsService.logAudit(effectiveResolver, "OFFICER", "RESOLVE_INSURANCE_EXCEPTION",
                "InsuranceException", saved.getId(), "ApprovalStatus", "Approved", "Resolved",
                "Resolved insurance exception: " + notes);

        // Re-evaluate collateral adequacy
        evaluateAdequacy(saved.getCollateralId());

        return saved;
    }
}
