package com.bank.cims.service;

import com.bank.cims.dto.WorkflowActionResultDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.cbs.CbsGateway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class WorkflowExecutionService {

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    @Autowired
    private ApprovalHistoryRepository approvalHistoryRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private WorkflowAuthorizationService workflowAuthService;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private CollateralReleaseRequestRepository collateralReleaseRequestRepository;

    @Autowired
    private InsuranceExceptionRepository insuranceExceptionRepository;

    @Autowired
    private CbsGateway cbsGateway;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private RoleHierarchyService roleHierarchyService;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    private ApprovalHierarchyConfigRepository approvalHierarchyConfigRepository;

    @Autowired
    private BusinessCalendarService businessCalendarService;

    @Autowired
    private PolicyHistoryRepository policyHistoryRepository;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private FirstDegreeSecondDegreeService firstDegreeSecondDegreeService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private NotificationService notificationService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private EarlyCollateralReleaseService earlyCollateralReleaseService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private InsuranceAdequacyService insuranceAdequacyService;

    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private ConfigurationService configurationService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private CimsService cimsService;

    @Autowired(required = false)
    private AuthorizationScopeService authorizationScopeService;

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    @Transactional
    public WorkflowActionResultDto submitToWorkflow(String entityType, String entityId, String actionType, String makerId, String remarks, String payloadJson) {
        return submitToWorkflow(entityType, entityId, actionType, makerId, remarks, payloadJson, null);
    }

    /**
     * Explicit candidate role overload. Used by exception workflows whose approver is
     * resolved from the Admin-configured exception hierarchy (e.g. the configured Risk
     * Approver) so that generic transaction matching cannot override it.
     */
    @Transactional
    public WorkflowActionResultDto submitToWorkflow(String entityType, String entityId, String actionType, String makerId,
                                                    String remarks, String payloadJson, String explicitCandidateRole) {
        String now = LocalDateTime.now().toString();
        // Authenticated identity always wins. Caller-supplied maker IDs are used when
        // running inside direct service calls/tests or trusted internal continuations.
        com.bank.cims.model.User currentActor = authorizationScopeService != null ? authorizationScopeService.currentUser() : null;
        final String effectiveMakerId = (currentActor != null && currentActor.getUsername() != null && !currentActor.getUsername().isBlank())
                ? currentActor.getUsername()
                : (currentActor != null && currentActor.getId() != null && !currentActor.getId().isBlank()
                    ? currentActor.getId()
                    : (makerId != null && !makerId.isBlank() ? makerId : null));
        if (effectiveMakerId == null || effectiveMakerId.isBlank()) {
            throw new org.springframework.security.access.AccessDeniedException("An authenticated maker is required to submit a workflow task.");
        }
        // Route through the Admin-configured Approval Hierarchy. Explicit roles are used
        // only when already resolved from that configuration (for example exception routing).
        String candidateRole = (explicitCandidateRole != null && !explicitCandidateRole.isBlank())
                ? explicitCandidateRole.trim()
                : roleHierarchyService.resolveApproverRole(entityType, actionType);

        // Check if existing pending task exists for exact transaction (entityType, entityId, actionType)
        WorkflowTask task = null;
        List<WorkflowTask> existing = workflowTaskRepository.findAll();
        for (WorkflowTask t : existing) {
            if (entityId.equalsIgnoreCase(t.getEntityId()) && "Pending".equalsIgnoreCase(t.getStatus())) {
                if (entityType.equalsIgnoreCase(t.getEntityType()) && actionType.equalsIgnoreCase(t.getActionType())) {
                    task = t;
                    break;
                } else {
                    throw new IllegalStateException("An active workflow task (" + t.getActionType() + " - " + t.getId() +
                            ") is already pending for " + entityType + " " + entityId + ". Cannot submit concurrent action " + actionType + ".");
                }
            }
        }

        if (task == null) {
            task = new WorkflowTask();
            task.setId("task-" + UUID.randomUUID().toString().substring(0, 8));
            task.setEntityType(entityType);
            task.setEntityId(entityId);
            task.setSubmittedAt(now);
        }

        task.setActionType(actionType != null ? actionType : "REGISTRATION");
        task.setMakerId(effectiveMakerId);
        task.setCandidateRole(candidateRole);
        task.setStatus("Pending");
        task.setCurrentStep("Checker Review");
        task.setRemarks(remarks != null ? remarks : "Submitted for approval");
        task.setPayloadDiffJson(payloadJson);

        ApprovalHierarchyConfig cfg = findHierarchyConfig(actionType, entityType);
        if (cfg != null && cfg.getSlaHours() > 0) {
            int workingDays = Math.max(1, (int) Math.ceil(cfg.getSlaHours() / 8.0));
            LocalDate dueDay = businessCalendarService.addWorkingDays(LocalDate.now(), workingDays);
            task.setSlaDueAt(dueDay.atTime(17, 0).toString());
        } else {
            task.setSlaDueAt(LocalDateTime.now().plusHours(24).toString());
        }

        task = workflowTaskRepository.save(task);

        // Update entity maker fields
        updateEntityToPendingState(entityType, entityId, actionType, effectiveMakerId, now);

        // Audit
        createAuditLog(effectiveMakerId, "MAKER", "WORKFLOW_SUBMIT", entityType, entityId, "status", "Draft", "Pending", 
                "Transaction submitted to workflow: " + actionType);

        WorkflowActionResultDto res = new WorkflowActionResultDto(true, "Submitted to workflow successfully");
        res.setWorkflowTaskId(task.getId());
        res.setEntityType(entityType);
        res.setEntityId(entityId);
        res.setAction(actionType);
        res.setEntityStatus("Pending Approval");
        res.setWorkflowStatus("Pending");
        return res;
    }

    @Transactional
    public WorkflowActionResultDto approveWorkflowTask(String taskId, String checkerId, String checkerRole, String comments) {
        WorkflowTask task = workflowTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow task not found: " + taskId));

        if (!"Pending".equalsIgnoreCase(task.getStatus()) && !"Returned".equalsIgnoreCase(task.getStatus())) {
            throw new IllegalStateException("Task is already in " + task.getStatus() + " status.");
        }

        // Strict Four-Eyes Check
        boolean dualControlStrict = configurationService == null || configurationService.isDualControlStrictEnabled();
        if (dualControlStrict && task.getMakerId() != null && task.getMakerId().trim().equalsIgnoreCase(checkerId.trim())) {
            throw new IllegalStateException("Dual Control Violation: Maker (" + task.getMakerId() + ") cannot approve their own submission.");
        }

        // Authorize Checker. Identity and role are always taken from the persisted user,
        // never from caller-supplied request parameters.
        User checker = workflowAuthService.assertCanApprove(checkerId, taskId);
        checkerId = checker.getUsername() != null && !checker.getUsername().isBlank() ? checker.getUsername() : (checker.getId() != null ? checker.getId() : checkerId);
        checkerRole = checker.getRole();

        String now = LocalDateTime.now().toString();
        String entityType = task.getEntityType();
        String entityId = task.getEntityId();
        String finalEntityStatus = "Active";

        // Multi-level approval hierarchy check (§ SysAdmin Approval Workflows)
        ApprovalHierarchyConfig cfg = findHierarchyConfig(task.getActionType(), entityType);
        boolean requiresLevel2 = cfg != null && cfg.getApprovalLevels() == 2 && !"Level 2 Review".equalsIgnoreCase(task.getCurrentStep());

        if (requiresLevel2) {
            String nextRole = cfg.getLevel2Role();
            if (nextRole == null || nextRole.isBlank()) {
                throw new IllegalStateException("Approval hierarchy for '" + task.getActionType()
                        + "' declares two levels but no level 2 approver is configured.");
            }
            task.setCurrentStep("Level 2 Review");
            task.setCandidateRole(nextRole);
            task.setStatus("Pending");
            task.setRemarks(comments != null ? comments : "Level 1 Approved by " + checkerId + "; forwarded to " + nextRole);
            workflowTaskRepository.save(task);

            ApprovalHistory history = new ApprovalHistory();
            history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
            history.setWorkflowTaskId(task.getId());
            history.setActorId(checkerId);
            history.setActorRole(checkerRole != null && !checkerRole.isBlank() ? checkerRole : task.getCandidateRole());
            history.setStepName("Level 1 Review");
            history.setDecision("Approved");
            history.setComments(comments != null ? comments : "Level 1 Approved; forwarded to Level 2 (" + nextRole + ")");
            history.setDecidedAt(now);
            approvalHistoryRepository.save(history);

            createAuditLog(checkerId, checkerRole, "WORKFLOW_APPROVE_LEVEL1", entityType, entityId, "currentStep", "Checker Review", "Level 2 Review",
                    "Level 1 approval by " + checkerId + "; forwarded to " + nextRole + ". Comments: " + comments);

            WorkflowActionResultDto res = new WorkflowActionResultDto(true, "Level 1 approval granted. Escalated to " + nextRole + " for secondary authorization.");
            res.setWorkflowTaskId(taskId);
            res.setEntityType(entityType);
            res.setEntityId(entityId);
            res.setAction("APPROVE_LEVEL1");
            res.setEntityStatus("Pending Level 2");
            res.setWorkflowStatus("Pending");
            return res;
        }

        // Perform entity mutation (Level 1 for single-level, or Level 2 final sign-off)
        if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral col = findCollateral(entityId);
            if (col != null) {
                if (task.getActionType() != null && task.getActionType().startsWith("Maintain ")) {
                    if (cimsService != null) {
                        cimsService.applyMaintenanceApproval(task, checkerId);
                    }
                    finalEntityStatus = col.getStatus();
                } else if ("Change Collateral Ownership".equalsIgnoreCase(task.getActionType())) {
                    if (cimsService != null) {
                        cimsService.applyCollateralOwnershipApproval(task, checkerId);
                    }
                    finalEntityStatus = col.getStatus();
                } else if ("COLLATERAL_RELEASE".equalsIgnoreCase(task.getActionType())) {
                    if (earlyCollateralReleaseService != null) {
                        String relId = col.getActiveReleaseRequestId();
                        if (relId != null) {
                            earlyCollateralReleaseService.approveReleaseRequest(relId, checkerId, checkerRole, comments);
                        } else {
                            var assessment = earlyCollateralReleaseService.performPreReleaseImpactAssessment(col.getId(), null);
                            if (assessment.isHardBlocked()) {
                                throw new IllegalStateException("Collateral release blocked: " + String.join("; ", assessment.getBlockingReasons()));
                            }
                            CollateralReleaseRequest req = new CollateralReleaseRequest();
                            req.setId("rel-req-" + UUID.randomUUID().toString().substring(0, 8));
                            req.setCollateralId(col.getId());
                            req.setFacilityIds("ALL");
                            req.setReleaseType("FULL_COLLATERAL");
                            req.setRequesterId(task.getMakerId());
                            req.setApproverId(checkerId);
                            req.setReason(comments != null ? comments : "Collateral release approved by checker");
                            req.setStatus("APPROVED");
                            req.setCbsUpdateStatus("PENDING");
                            req.setDecisionDate(now);
                            req.setDecisionComments(comments);
                            collateralReleaseRequestRepository.save(req);
                            col.setActiveReleaseRequestId(req.getId());
                            collateralRepository.save(col);
                        }
                    }
                    finalEntityStatus = "Approved (Pending CBS Manual Update)";
                } else {
                    col.setAuthStat("A");
                    col.setRecordStat("O");
                    col.setCheckerId(checkerId);
                    col.setCheckerDtStamp(now);
                    col.setStatus("Active");
                    collateralRepository.save(col);
                    finalEntityStatus = "Active";

                    // Activate linked facilities
                    List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
                    for (LoanCollateralLink link : links) {
                        link.setStatus("Active");
                        link.setAuthStat("A");
                        link.setRecordStat("O");
                        link.setCheckerId(checkerId);
                        link.setCheckerDtStamp(now);
                        loanCollateralLinkRepository.save(link);
                    }
                }
                exposureCalculationService.calculateExposureAndAdequacy(col.getId());
            }
        } else if ("Insurance Policy".equalsIgnoreCase(entityType) || "Insurance".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            InsurancePolicy pol = findInsurancePolicy(entityId);
            if (pol != null) {
                if ("POLICY_RENEWAL".equalsIgnoreCase(task.getActionType())) {
                    validationService.validatePolicyForActivation(pol);
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Active");
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"RENEWAL_APPROVED\",\"status\":\"Active\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "RENEWAL_APPROVED", "Pending Approval", "Active", pol.getVersion(), checkerId, comments, task.getId(), null);

                    if (pol.getRenewedFromPolicyId() != null) {
                        InsurancePolicy old = findInsurancePolicy(pol.getRenewedFromPolicyId());
                        if (old != null) {
                            old.setStatus("Renewed");
                            String oldNote = String.format(Locale.ROOT,
                                    "{\"event\":\"RENEWED\",\"renewedIntoPolicyId\":\"%s\",\"renewedIntoPolicyNumber\":\"%s\",\"checkerId\":\"%s\",\"timestamp\":\"%s\"}",
                                    safe(pol.getId()), safe(pol.getPolicyNumber()), safe(checkerId), now);
                            appendPolicyHistory(old, oldNote);
                            insurancePolicyRepository.save(old);
                            recordStructuredPolicyHistory(old.getId(), "RENEWED", "Active", "Renewed", old.getVersion(), checkerId, "Renewed into " + pol.getPolicyNumber(), task.getId(), null);
                        }
                    }
                    finalEntityStatus = "Active";
                } else if ("POLICY_REPLACEMENT".equalsIgnoreCase(task.getActionType())) {
                    validationService.validatePolicyForActivation(pol);
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Active");
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"REPLACEMENT_APPROVED\",\"status\":\"Active\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "REPLACEMENT_APPROVED", "Pending Approval", "Active", pol.getVersion(), checkerId, comments, task.getId(), null);

                    if (pol.getReplacesPolicyId() != null) {
                        InsurancePolicy old = findInsurancePolicy(pol.getReplacesPolicyId());
                        if (old != null) {
                            old.setStatus("Replaced");
                            String oldNote = String.format(Locale.ROOT,
                                    "{\"event\":\"REPLACED\",\"replacedByPolicyId\":\"%s\",\"replacedByPolicyNumber\":\"%s\",\"checkerId\":\"%s\",\"timestamp\":\"%s\"}",
                                    safe(pol.getId()), safe(pol.getPolicyNumber()), safe(checkerId), now);
                            appendPolicyHistory(old, oldNote);
                            insurancePolicyRepository.save(old);
                            recordStructuredPolicyHistory(old.getId(), "REPLACED", "Active", "Replaced", old.getVersion(), checkerId, "Replaced by " + pol.getPolicyNumber(), task.getId(), null);
                        }
                    }
                    finalEntityStatus = "Active";
                } else if ("POLICY_CANCELLATION".equalsIgnoreCase(task.getActionType())) {
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Cancelled");
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"CANCELLATION_APPROVED\",\"reason\":\"%s\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            safe(pol.getCancellationReason()), safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "CANCELLATION_APPROVED", "Cancellation Pending", "Cancelled", pol.getVersion(), checkerId, pol.getCancellationReason(), task.getId(), null);
                    finalEntityStatus = "Cancelled";
                } else if ("POLICY_CLOSURE".equalsIgnoreCase(task.getActionType())) {
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Closed");
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"CLOSURE_APPROVED\",\"reason\":\"%s\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            safe(pol.getClosureReason()), safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "CLOSURE_APPROVED", "Closure Pending", "Closed", pol.getVersion(), checkerId, pol.getClosureReason(), task.getId(), null);
                    finalEntityStatus = "Closed";
                } else if ("POLICY_REOPEN".equalsIgnoreCase(task.getActionType())) {
                    validationService.validatePolicyForActivation(pol);
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Active");
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"REOPEN_APPROVED\",\"reason\":\"%s\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            safe(pol.getReopeningReason()), safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "REOPEN_APPROVED", "Reopen Pending", "Active", pol.getVersion(), checkerId, pol.getReopeningReason(), task.getId(), null);
                    finalEntityStatus = "Active";
                } else if ("POLICY_ENDORSEMENT".equalsIgnoreCase(task.getActionType())) {
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Active");
                    List<PolicyEndorsement> endorsements = policyEndorsementRepository.findByPolicyId(pol.getId());
                    for (PolicyEndorsement end : endorsements) {
                        if ("Pending".equalsIgnoreCase(end.getRecordStat()) || "U".equalsIgnoreCase(end.getRecordStat())) {
                            end.setRecordStat("O");
                            end.setAuthStat("A");
                            end.setCheckerId(checkerId);
                            end.setCheckerDtStamp(now);
                            policyEndorsementRepository.save(end);
                        }
                    }
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"ENDORSEMENT_APPROVED\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "ENDORSEMENT_APPROVED", pol.getStatus(), "Active", pol.getVersion(), checkerId, comments, task.getId(), null);
                    finalEntityStatus = "Active";
                } else if ("POLICY_AMENDMENT".equalsIgnoreCase(task.getActionType())) {
                    validationService.validatePolicyForActivation(pol);
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Active");
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"AMENDMENT_APPROVED\",\"version\":%d,\"status\":\"Active\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            pol.getVersion(), safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "AMENDMENT_APPROVED", "Amendment Pending", "Active", pol.getVersion(), checkerId, pol.getAmendmentReason() != null ? pol.getAmendmentReason() : comments, task.getId(), null);
                    finalEntityStatus = "Active";
                } else {
                    validationService.validatePolicyForActivation(pol);
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCheckerId(checkerId);
                    pol.setCheckerDtStamp(now);
                    pol.setStatus("Active");
                    String appNote = String.format(Locale.ROOT,
                            "{\"event\":\"REGISTRATION_APPROVED\",\"status\":\"Active\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                            safe(checkerId), safe(comments), now);
                    appendPolicyHistory(pol, appNote);
                    insurancePolicyRepository.save(pol);
                    recordStructuredPolicyHistory(pol.getId(), "REGISTRATION_APPROVED", "Pending Approval", "Active", pol.getVersion(), checkerId, comments, task.getId(), null);
                    finalEntityStatus = "Active";
                }

                // Update Collateral exposure and status
                if (pol.getCollateralId() != null) {
                    exposureCalculationService.calculateExposureAndAdequacy(pol.getCollateralId());
                }
            }
        } else if ("Customer".equalsIgnoreCase(entityType)) {
            Customer cust = customerRepository.findById(entityId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(entityId))
                    .orElse(null);
            if (cust != null) {
                if (task.getActionType() != null && task.getActionType().startsWith("Maintain ")) {
                    if (cimsService != null) {
                        cimsService.applyMaintenanceApproval(task, checkerId);
                    }
                    finalEntityStatus = cust.getStatus();
                } else {
                    cust.setRecordStat("O");
                    cust.setAuthStat("A");
                    cust.setStatus("Active");
                    cust.setCheckerId(checkerId);
                    cust.setCheckerDtStamp(now);
                    cust.setOnceAuth("Y");
                    customerRepository.save(cust);
                    finalEntityStatus = "Active";
                }
            }
        } else if ("LoanCollateralLink".equalsIgnoreCase(entityType) || "CollateralFacilityLink".equalsIgnoreCase(entityType) || "Relationship".equalsIgnoreCase(entityType)) {
            LoanCollateralLink link = loanCollateralLinkRepository.findById(entityId).orElse(null);
            if (link != null) {
                link.setStatus("Active");
                link.setRelationshipStatus("Active");
                link.setAuthStat("A");
                link.setRecordStat("O");
                link.setCheckerId(checkerId);
                link.setCheckerDtStamp(now);
                loanCollateralLinkRepository.save(link);
                finalEntityStatus = "Active";

                Collateral col = collateralRepository.findById(link.getCollateralId()).orElse(null);
                if (col != null) {
                    List<LoanCollateralLink> colLinks = loanCollateralLinkRepository.findByCollateralId(col.getId());
                    double totalAllocated = colLinks.stream()
                            .filter(LoanCollateralLink::isCapacityConsuming)
                            .mapToDouble(LoanCollateralLink::getAllocatedAmount).sum();
                    col.setCurrentAllocation(totalAllocated);
                    double nsv = col.getValuationAmount() * (1.0 - (col.getHaircut() / 100.0));
                    col.setUtilizationPercentage(nsv > 0 ? (totalAllocated / nsv) * 100.0 : 0.0);
                    collateralRepository.save(col);
                    exposureCalculationService.calculateExposureAndAdequacy(col.getId());
                }
            }
        } else if ("Document".equalsIgnoreCase(entityType) || "Ownership Document".equalsIgnoreCase(entityType) || "Collateral Document".equalsIgnoreCase(entityType)) {
            OwnershipDocument doc = ownershipDocumentRepository.findById(entityId).orElse(null);
            if (doc != null) {
                doc.setVerificationStatus("Verified");
                doc.setStatus("Active");
                ownershipDocumentRepository.save(doc);
                finalEntityStatus = "Verified";
            }
        } else if ("Exception".equalsIgnoreCase(entityType) || "Exception Request".equalsIgnoreCase(entityType) || "CimsException".equalsIgnoreCase(entityType)) {
            CimsException exc = cimsExceptionRepository.findById(entityId).orElse(null);
            if (exc != null) {
                exc.setStatus("Resolved");
                exc.setResolvedBy(checkerId);
                exc.setResolvedAt(now);
                exc.setResolutionNotes("[AUTHORIZED OVERRIDE - Approved by " + checkerId + " (" + (checkerRole != null ? checkerRole : "Approver") + ")]: " +
                        (comments != null && !comments.isBlank() ? comments : "Exception request approved by management"));
                cimsExceptionRepository.save(exc);
                finalEntityStatus = "Resolved";

                // Step 8: Exception Approved -> Validation failure overridden -> Transaction
                // resumes only after every exception raised for the same entity is cleared.
                // Otherwise approving one of several missing-document exceptions would
                // resume the collateral while the remaining exceptions are still pending.
                boolean otherExceptionsPending = cimsExceptionRepository
                        .findByEntityTypeAndEntityId(exc.getEntityType(), exc.getEntityId()).stream()
                        .filter(other -> !other.getId().equals(exc.getId()))
                        .anyMatch(other -> !isTerminalExceptionStatus(other.getStatus()));

                if (!otherExceptionsPending) {
                    if ("Insurance Policy".equalsIgnoreCase(exc.getEntityType()) || "Policy".equalsIgnoreCase(exc.getEntityType())) {
                        InsurancePolicy pol = findInsurancePolicy(exc.getEntityId());
                        if (pol != null) {
                            pol.setStatus("Pending Approval");
                            pol.setAuthStat("U");
                            pol.setRecordStat("U");
                            String appNote = String.format(Locale.ROOT,
                                    "{\"event\":\"EXCEPTION_APPROVED_TRANSACTION_RESUMED\",\"exceptionId\":\"%s\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                                    safe(exc.getId()), safe(checkerId), safe(comments), now);
                            appendPolicyHistory(pol, appNote);
                            insurancePolicyRepository.save(pol);

                            // Submit to normal workflow for standard checker approval
                            submitToWorkflow("Insurance Policy", pol.getId(), "POLICY_REGISTRATION",
                                    task.getMakerId(), "Policy registration resumed following exception approval: " + comments, null);
                        }
                    } else if ("Collateral".equalsIgnoreCase(exc.getEntityType()) || "Collateral Asset".equalsIgnoreCase(exc.getEntityType())) {
                        Collateral col = collateralRepository.findById(exc.getEntityId())
                                .or(() -> collateralRepository.findByCode(exc.getEntityId()))
                                .orElse(null);
                        if (col != null) {
                            col.setStatus("Pending Approval");
                            col.setAuthStat("U");
                            col.setRecordStat("U");
                            collateralRepository.save(col);

                            // Submit to normal workflow for standard checker authorization
                            submitToWorkflow("Collateral", col.getId(), "COLLATERAL_REGISTRATION",
                                    task.getMakerId(), "Collateral registration resumed following exception approval: " + comments, null);
                        }
                    }
                }
            }
        } else if ("LoanCollateralLink".equalsIgnoreCase(entityType) || "Collateral Link".equalsIgnoreCase(entityType)
                || "Collateral-to-Loan Link".equalsIgnoreCase(entityType) || "COLLATERAL_LINK".equalsIgnoreCase(entityType)
                || "Link".equalsIgnoreCase(entityType) || "Relationship".equalsIgnoreCase(entityType)) {
            LoanCollateralLink link = loanCollateralLinkRepository.findById(entityId).orElse(null);
            if (link != null) {
                link.setStatus("Active");
                link.setRelationshipStatus("Active");
                link.setAuthStat("A");
                link.setRecordStat("O");
                link.setCheckerId(checkerId);
                link.setCheckerDtStamp(now);
                loanCollateralLinkRepository.save(link);
                finalEntityStatus = "Active";
                exposureCalculationService.calculateExposureAndAdequacy(link.getCollateralId());
            }
        } else if ("Collateral Release".equalsIgnoreCase(entityType) || "CollateralReleaseRequest".equalsIgnoreCase(entityType) || "COLLATERAL_RELEASE".equalsIgnoreCase(entityType)) {
            if (earlyCollateralReleaseService != null) {
                earlyCollateralReleaseService.approveReleaseRequest(entityId, checkerId, checkerRole, comments);
            }
            finalEntityStatus = "Approved (Pending CBS Manual Update)";
        } else if ("Insurance Exception".equalsIgnoreCase(entityType) || "InsuranceException".equalsIgnoreCase(entityType) || "INSURANCE_EXCEPTION".equalsIgnoreCase(entityType)) {
            if (insuranceAdequacyService != null) {
                insuranceAdequacyService.approveException(entityId, checkerId, checkerRole, comments);
            }
            finalEntityStatus = "Approved";
        }

        // Update Task
        task.setStatus("Approved");
        task.setCompletedAt(now);
        task.setCurrentStep("Completed");
        task.setRemarks(comments != null ? comments : "Approved by " + checkerId);
        workflowTaskRepository.save(task);

        // Approval History
        ApprovalHistory history = new ApprovalHistory();
        history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
        history.setWorkflowTaskId(task.getId());
        history.setActorId(checkerId);
        history.setActorRole(checkerRole);
        history.setStepName("Checker Review");
        history.setDecision("Approved");
        history.setComments(comments != null ? comments : "Approved");
        history.setDecidedAt(now);
        approvalHistoryRepository.save(history);

        // Audit Log
        createAuditLog(checkerId, checkerRole, "WORKFLOW_APPROVE", entityType, entityId, "status", "Pending", finalEntityStatus,
                "Approved task " + taskId + " with comments: " + comments);

        // Outbound Notification to Maker
        if (notificationService != null && task.getMakerId() != null) {
            try {
                notificationService.sendNotification(
                        "Email",
                        "WORKFLOW_DECISION_APPROVED",
                        task.getMakerId() + "@cims-bank.et",
                        task.getMakerId(),
                        "Dual-Control Authorized: " + task.getActionType() + " (" + entityId + ")",
                        "Dear " + task.getMakerId() + ",\n\nYour transaction has been APPROVED by Checker " + checkerId + " (" + checkerRole + ").\n" +
                        "• Entity: " + entityType + " (" + entityId + ")\n" +
                        "• Decision: Approved\n" +
                        "• Remarks: " + (comments != null ? comments : "Approved"),
                        entityType,
                        entityId,
                        Map.of("recipientUserId", task.getMakerId())
                );
            } catch (Exception ignored) {}
        }

        WorkflowActionResultDto res = new WorkflowActionResultDto(true, "Transaction approved successfully.");
        res.setWorkflowTaskId(taskId);
        res.setEntityType(entityType);
        res.setEntityId(entityId);
        res.setAction("APPROVE");
        res.setEntityStatus(finalEntityStatus);
        res.setWorkflowStatus("Approved");
        return res;
    }

    @Transactional
    public WorkflowActionResultDto returnWorkflowTask(String taskId, String checkerId, String checkerRole, String comments) {
        if (comments == null || comments.trim().isEmpty()) {
            throw new IllegalArgumentException("Correction comments are mandatory when returning a transaction.");
        }

        WorkflowTask task = workflowTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow task not found: " + taskId));

        User checker = workflowAuthService.assertCanApprove(checkerId, taskId);
        checkerId = checker.getUsername() != null && !checker.getUsername().isBlank() ? checker.getUsername() : (checker.getId() != null ? checker.getId() : checkerId);
        checkerRole = checker.getRole();

        String now = LocalDateTime.now().toString();
        String entityType = task.getEntityType();
        String entityId = task.getEntityId();

        if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral col = findCollateral(entityId);
            if (col != null) {
                if ((task.getActionType() != null && task.getActionType().startsWith("Maintain "))
                        || "Change Collateral Ownership".equalsIgnoreCase(task.getActionType())) {
                    col.setAuthStat("A");
                    col.setRecordStat("O");
                    collateralRepository.save(col);
                } else {
                    col.setAuthStat("U");
                    col.setRecordStat("U");
                    col.setStatus("Draft");
                    collateralRepository.save(col);

                    List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
                    for (LoanCollateralLink link : links) {
                        if ("Pending Approval".equalsIgnoreCase(link.getStatus())) {
                            link.setStatus("Draft");
                            link.setAuthStat("U");
                            link.setRecordStat("U");
                            loanCollateralLinkRepository.save(link);
                        }
                    }
                }
            }
        } else if ("Customer".equalsIgnoreCase(entityType)) {
            Customer cust = customerRepository.findById(entityId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(entityId))
                    .orElse(null);
            if (cust != null) {
                if (task.getActionType() != null && task.getActionType().startsWith("Maintain ")) {
                    cust.setAuthStat("A");
                    cust.setRecordStat("O");
                    customerRepository.save(cust);
                } else {
                    cust.setAuthStat("R");
                    cust.setRecordStat("R");
                    cust.setStatus("Rejected");
                    customerRepository.save(cust);
                }
            }
        } else if ("Insurance Policy".equalsIgnoreCase(entityType) || "Insurance".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            InsurancePolicy pol = findInsurancePolicy(entityId);
            if (pol != null) {
                String prevStatus = pol.getStatus();
                pol.setAuthStat("U");
                pol.setRecordStat("U");
                pol.setStatus("Draft");
                insurancePolicyRepository.save(pol);
                recordStructuredPolicyHistory(pol.getId(), "POLICY_RETURNED", prevStatus, "Draft", pol.getVersion(), checkerId, comments, task.getId(), null);
            }
        } else if ("Exception".equalsIgnoreCase(entityType) || "Exception Request".equalsIgnoreCase(entityType) || "CimsException".equalsIgnoreCase(entityType)) {
            CimsException exc = cimsExceptionRepository.findById(entityId).orElse(null);
            if (exc != null) {
                exc.setStatus("Returned");
                exc.setResolutionNotes("Returned for correction by " + checkerId + ": " + comments);
                cimsExceptionRepository.save(exc);
                if ("Insurance Policy".equalsIgnoreCase(exc.getEntityType()) || "Policy".equalsIgnoreCase(exc.getEntityType())) {
                    InsurancePolicy pol = findInsurancePolicy(exc.getEntityId());
                    if (pol != null) {
                        pol.setStatus("Draft");
                        pol.setAuthStat("U");
                        pol.setRecordStat("U");
                        appendPolicyHistory(pol, String.format(Locale.ROOT,
                                "{\"event\":\"EXCEPTION_RETURNED_FOR_CORRECTION\",\"exceptionId\":\"%s\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                                safe(exc.getId()), safe(checkerId), safe(comments), now));
                        insurancePolicyRepository.save(pol);
                    }
                } else if ("Collateral".equalsIgnoreCase(exc.getEntityType()) || "Collateral Asset".equalsIgnoreCase(exc.getEntityType())) {
                    Collateral col = collateralRepository.findById(exc.getEntityId())
                            .or(() -> collateralRepository.findByCode(exc.getEntityId()))
                            .orElse(null);
                    if (col != null) {
                        col.setStatus("Draft");
                        col.setAuthStat("U");
                        col.setRecordStat("U");
                        collateralRepository.save(col);
                    }
                }
            }
        } else if ("LoanCollateralLink".equalsIgnoreCase(entityType) || "Collateral Link".equalsIgnoreCase(entityType)
                || "Collateral-to-Loan Link".equalsIgnoreCase(entityType) || "COLLATERAL_LINK".equalsIgnoreCase(entityType)
                || "Link".equalsIgnoreCase(entityType) || "Relationship".equalsIgnoreCase(entityType)) {
            LoanCollateralLink link = loanCollateralLinkRepository.findById(entityId).orElse(null);
            if (link != null) {
                link.setStatus("Draft");
                link.setRelationshipStatus("Draft");
                link.setAuthStat("U");
                link.setRecordStat("U");
                loanCollateralLinkRepository.save(link);
            }
        } else if ("Collateral Release".equalsIgnoreCase(entityType) || "CollateralReleaseRequest".equalsIgnoreCase(entityType) || "COLLATERAL_RELEASE".equalsIgnoreCase(entityType)) {
            if (earlyCollateralReleaseService != null) {
                earlyCollateralReleaseService.returnReleaseRequest(entityId, checkerId, checkerRole, comments);
            }
        } else if ("Insurance Exception".equalsIgnoreCase(entityType) || "InsuranceException".equalsIgnoreCase(entityType) || "INSURANCE_EXCEPTION".equalsIgnoreCase(entityType)) {
            if (insuranceAdequacyService != null) {
                insuranceAdequacyService.returnException(entityId, checkerId, checkerRole, comments);
            }
        }

        task.setStatus("Returned");
        task.setCurrentStep("Returned to Maker");
        task.setRemarks(comments);
        workflowTaskRepository.save(task);

        ApprovalHistory history = new ApprovalHistory();
        history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
        history.setWorkflowTaskId(task.getId());
        history.setActorId(checkerId);
        history.setActorRole(checkerRole);
        history.setStepName("Checker Review");
        history.setDecision("Returned");
        history.setComments(comments);
        history.setDecidedAt(now);
        approvalHistoryRepository.save(history);

        createAuditLog(checkerId, checkerRole, "WORKFLOW_RETURN", entityType, entityId, "status", "Pending", "Draft",
                "Returned to maker for corrections: " + comments);

        // Outbound Notification to Maker
        if (notificationService != null && task.getMakerId() != null) {
            try {
                notificationService.sendNotification(
                        "Email",
                        "WORKFLOW_DECISION_RETURNED",
                        task.getMakerId() + "@cims-bank.et",
                        task.getMakerId(),
                        "Action Required: " + task.getActionType() + " (" + entityId + ") Returned for Correction",
                        "Dear " + task.getMakerId() + ",\n\nYour transaction was RETURNED for correction by Checker " + checkerId + " (" + checkerRole + ").\n" +
                        "• Entity: " + entityType + " (" + entityId + ")\n" +
                        "• Return Reason: " + comments + "\n\n" +
                        "Please update the record and resubmit for authorization.",
                        entityType,
                        entityId,
                        Map.of("recipientUserId", task.getMakerId())
                );
            } catch (Exception ignored) {}
        }

        WorkflowActionResultDto res = new WorkflowActionResultDto(true, "Transaction returned to maker for correction.");
        res.setWorkflowTaskId(taskId);
        res.setEntityType(entityType);
        res.setEntityId(entityId);
        res.setAction("RETURN");
        res.setEntityStatus("Draft");
        res.setWorkflowStatus("Returned");
        return res;
    }

    @Transactional
    public WorkflowActionResultDto rejectWorkflowTask(String taskId, String checkerId, String checkerRole, String comments) {
        if (comments == null || comments.trim().isEmpty()) {
            throw new IllegalArgumentException("Rejection comments are mandatory when rejecting a transaction.");
        }

        WorkflowTask task = workflowTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow task not found: " + taskId));

        User checker = workflowAuthService.assertCanApprove(checkerId, taskId);
        checkerId = checker.getUsername() != null && !checker.getUsername().isBlank() ? checker.getUsername() : (checker.getId() != null ? checker.getId() : checkerId);
        checkerRole = checker.getRole();

        String now = LocalDateTime.now().toString();
        String entityType = task.getEntityType();
        String entityId = task.getEntityId();

        if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral col = findCollateral(entityId);
            if (col != null) {
                col.setAuthStat("R");
                col.setRecordStat("R");
                col.setStatus("Rejected");
                collateralRepository.save(col);

                List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
                for (LoanCollateralLink link : links) {
                    if ("Pending Approval".equalsIgnoreCase(link.getStatus())) {
                        link.setStatus("Rejected");
                        link.setAuthStat("R");
                        link.setRecordStat("R");
                        link.setCheckerId(checkerId);
                        link.setCheckerDtStamp(now);
                        loanCollateralLinkRepository.save(link);
                    }
                }
            }
        } else if ("Insurance Policy".equalsIgnoreCase(entityType) || "Insurance".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            InsurancePolicy pol = findInsurancePolicy(entityId);
            if (pol != null) {
                String prevStatus = pol.getStatus();
                if ("POLICY_CANCELLATION".equalsIgnoreCase(task.getActionType()) || "Cancellation Pending".equalsIgnoreCase(pol.getStatus())) {
                    pol.setStatus("Active");
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setCancellationReason(null);
                } else if ("POLICY_CLOSURE".equalsIgnoreCase(task.getActionType()) || "Closure Pending".equalsIgnoreCase(pol.getStatus())) {
                    pol.setStatus("Active");
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setClosureReason(null);
                } else if ("POLICY_REOPEN".equalsIgnoreCase(task.getActionType()) || "Reopen Pending".equalsIgnoreCase(pol.getStatus())) {
                    pol.setStatus("Closed");
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                } else if ("POLICY_AMENDMENT".equalsIgnoreCase(task.getActionType())) {
                    pol.setStatus("Active");
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    pol.setAmendmentReason(null);
                    // Rollback proposed policy values from prior approved snapshot (Audit Finding 61)
                    List<PolicyHistory> historyList = policyHistoryRepository.findByPolicyIdOrderByTimestampDesc(pol.getId());
                    PolicyHistory priorSnapshot = historyList.stream()
                            .filter(h -> "AMENDMENT_PROPOSED".equalsIgnoreCase(h.getEventType()) && h.getSnapshotJson() != null && !h.getSnapshotJson().isBlank())
                            .findFirst()
                            .orElse(null);
                    if (priorSnapshot != null) {
                        try {
                            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(priorSnapshot.getSnapshotJson());
                            if (node.has("version")) pol.setVersion(node.get("version").asInt());
                            if (node.has("insurerName")) pol.setInsurerName(node.get("insurerName").asText());
                            if (node.has("coverageType")) pol.setCoverageType(node.get("coverageType").asText());
                            if (node.has("insuredAmount")) pol.setInsuredAmount(node.get("insuredAmount").asDouble());
                            if (node.has("premium")) pol.setPremium(node.get("premium").asDouble());
                            if (node.has("effectiveDate")) pol.setEffectiveDate(node.get("effectiveDate").asText());
                            if (node.has("expiryDate")) pol.setExpiryDate(node.get("expiryDate").asText());
                        } catch (Exception ignored) {
                            if (pol.getVersion() > 1) pol.setVersion(pol.getVersion() - 1);
                        }
                    } else if (pol.getVersion() > 1) {
                        pol.setVersion(pol.getVersion() - 1);
                    }
                } else if ("POLICY_ENDORSEMENT".equalsIgnoreCase(task.getActionType())) {
                    // Isolate rejection to the pending endorsement record; keep underlying policy Active (Audit Finding 62)
                    pol.setStatus("Active");
                    pol.setAuthStat("A");
                    pol.setRecordStat("O");
                    List<PolicyEndorsement> endorsements = policyEndorsementRepository.findByPolicyId(pol.getId());
                    for (PolicyEndorsement end : endorsements) {
                        if ("Pending".equalsIgnoreCase(end.getRecordStat()) || "U".equalsIgnoreCase(end.getRecordStat())) {
                            end.setRecordStat("R");
                            end.setAuthStat("R");
                            end.setCheckerId(checkerId);
                            end.setCheckerDtStamp(now);
                            policyEndorsementRepository.save(end);
                        }
                    }
                } else {
                    pol.setStatus("Rejected");
                    pol.setAuthStat("R");
                    pol.setRecordStat("R");
                }
                pol.setCheckerId(checkerId);
                pol.setCheckerDtStamp(now);
                String rejNote = String.format(Locale.ROOT,
                        "{\"event\":\"WORKFLOW_REJECTED\",\"action\":\"%s\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                        safe(task.getActionType()), safe(checkerId), safe(comments), now);
                appendPolicyHistory(pol, rejNote);
                insurancePolicyRepository.save(pol);
                recordStructuredPolicyHistory(pol.getId(), "POLICY_REJECTED", prevStatus, pol.getStatus(), pol.getVersion(), checkerId, comments, task.getId(), null);
            }
        } else if ("Exception".equalsIgnoreCase(entityType) || "Exception Request".equalsIgnoreCase(entityType) || "CimsException".equalsIgnoreCase(entityType)) {
            CimsException exc = cimsExceptionRepository.findById(entityId).orElse(null);
            if (exc != null) {
                exc.setStatus("Rejected");
                exc.setResolvedBy(checkerId);
                exc.setResolvedAt(now);
                exc.setResolutionNotes("Exception rejected by management: " + comments);
                cimsExceptionRepository.save(exc);

                // A rejection returns the whole submission to the maker. Sibling
                // exception tasks raised by the same submission must not remain
                // actionable, otherwise another approver could later resume a
                // record that was already rejected.
                cancelSiblingExceptionTasks(exc, checkerId, now);

                if ("Insurance Policy".equalsIgnoreCase(exc.getEntityType()) || "Policy".equalsIgnoreCase(exc.getEntityType())) {
                    InsurancePolicy pol = findInsurancePolicy(exc.getEntityId());
                    if (pol != null) {
                        pol.setStatus("Draft");
                        pol.setAuthStat("U");
                        pol.setRecordStat("U");
                        appendPolicyHistory(pol, String.format(Locale.ROOT,
                                "{\"event\":\"EXCEPTION_REJECTED_RETURNED_TO_MAKER\",\"exceptionId\":\"%s\",\"checkerId\":\"%s\",\"comments\":\"%s\",\"timestamp\":\"%s\"}",
                                safe(exc.getId()), safe(checkerId), safe(comments), now));
                        insurancePolicyRepository.save(pol);
                    }
                } else if ("Collateral".equalsIgnoreCase(exc.getEntityType()) || "Collateral Asset".equalsIgnoreCase(exc.getEntityType())) {
                    Collateral col = collateralRepository.findById(exc.getEntityId())
                            .or(() -> collateralRepository.findByCode(exc.getEntityId()))
                            .orElse(null);
                    if (col != null) {
                        col.setStatus("Draft");
                        col.setAuthStat("U");
                        col.setRecordStat("U");
                        collateralRepository.save(col);
                    }
                }
            }
        } else if ("LoanCollateralLink".equalsIgnoreCase(entityType) || "Collateral Link".equalsIgnoreCase(entityType)
                || "Collateral-to-Loan Link".equalsIgnoreCase(entityType) || "COLLATERAL_LINK".equalsIgnoreCase(entityType)
                || "Link".equalsIgnoreCase(entityType) || "Relationship".equalsIgnoreCase(entityType)) {
            LoanCollateralLink link = loanCollateralLinkRepository.findById(entityId).orElse(null);
            if (link != null) {
                link.setStatus("Rejected");
                link.setRelationshipStatus("Rejected");
                link.setAuthStat("R");
                link.setRecordStat("R");
                link.setCheckerId(checkerId);
                link.setCheckerDtStamp(now);
                loanCollateralLinkRepository.save(link);
            }
        } else if ("Collateral Release".equalsIgnoreCase(entityType) || "CollateralReleaseRequest".equalsIgnoreCase(entityType) || "COLLATERAL_RELEASE".equalsIgnoreCase(entityType)) {
            if (earlyCollateralReleaseService != null) {
                earlyCollateralReleaseService.rejectReleaseRequest(entityId, checkerId, checkerRole, comments);
            }
        } else if ("Insurance Exception".equalsIgnoreCase(entityType) || "InsuranceException".equalsIgnoreCase(entityType) || "INSURANCE_EXCEPTION".equalsIgnoreCase(entityType)) {
            if (insuranceAdequacyService != null) {
                insuranceAdequacyService.rejectException(entityId, checkerId, checkerRole, comments);
            }
        }

        task.setStatus("Rejected");
        task.setCompletedAt(now);
        task.setCurrentStep("Rejected");
        task.setRemarks(comments);
        workflowTaskRepository.save(task);

        ApprovalHistory history = new ApprovalHistory();
        history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
        history.setWorkflowTaskId(task.getId());
        history.setActorId(checkerId);
        history.setActorRole(checkerRole);
        history.setStepName("Checker Review");
        history.setDecision("Rejected");
        history.setComments(comments);
        history.setDecidedAt(now);
        approvalHistoryRepository.save(history);

        createAuditLog(checkerId, checkerRole, "WORKFLOW_REJECT", entityType, entityId, "status", "Pending", "Rejected",
                "Permanently rejected transaction: " + comments);

        // Outbound Notification to Maker
        if (notificationService != null && task.getMakerId() != null) {
            try {
                notificationService.sendNotification(
                        "Email",
                        "WORKFLOW_DECISION_REJECTED",
                        task.getMakerId() + "@cims-bank.et",
                        task.getMakerId(),
                        "Dual-Control Rejection Notice: " + task.getActionType() + " (" + entityId + ")",
                        "Dear " + task.getMakerId() + ",\n\nYour transaction was REJECTED by Checker " + checkerId + " (" + checkerRole + ").\n" +
                        "• Entity: " + entityType + " (" + entityId + ")\n" +
                        "• Action: " + task.getActionType() + "\n" +
                        "• Rejection Reason: " + comments,
                        entityType,
                        entityId,
                        Map.of("recipientUserId", task.getMakerId())
                );
            } catch (Exception ignored) {}
        }

        WorkflowActionResultDto res = new WorkflowActionResultDto(true, "Transaction rejected permanently.");
        res.setWorkflowTaskId(taskId);
        res.setEntityType(entityType);
        res.setEntityId(entityId);
        res.setAction("REJECT");
        res.setEntityStatus("Rejected");
        res.setWorkflowStatus("Rejected");
        return res;
    }

    private void updateEntityToPendingState(String entityType, String entityId, String actionType, String makerId, String now) {
        if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral col = findCollateral(entityId);
            if (col != null) {
                col.setMakerId(makerId);
                col.setMakerDtStamp(now);
                col.setAuthStat("U");
                col.setRecordStat("U");
                col.setStatus("Pending Approval");
                collateralRepository.save(col);
            }
        } else if ("Insurance Policy".equalsIgnoreCase(entityType) || "Insurance".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            InsurancePolicy pol = findInsurancePolicy(entityId);
            if (pol != null) {
                pol.setMakerId(makerId);
                pol.setMakerDtStamp(now);
                pol.setAuthStat("U");
                pol.setRecordStat("U");
                if ("POLICY_CANCELLATION".equalsIgnoreCase(actionType)) {
                    pol.setStatus("Cancellation Pending");
                } else if ("POLICY_CLOSURE".equalsIgnoreCase(actionType)) {
                    pol.setStatus("Closure Pending");
                } else if ("POLICY_REOPEN".equalsIgnoreCase(actionType)) {
                    pol.setStatus("Reopen Pending");
                } else {
                    pol.setStatus("Pending Approval");
                }
                insurancePolicyRepository.save(pol);
            }
        }
    }

    private void createAuditLog(String userId, String roleCode, String actionType, String entityType, String entityId, String fieldName, String oldVal, String newVal, String comments) {
        if (userId == null || userId.isBlank() || roleCode == null || roleCode.isBlank()) {
            throw new IllegalStateException("An authenticated actor and role are required to record workflow audit history.");
        }
        AuditLog audit = new AuditLog();
        audit.setId("audit-" + UUID.randomUUID().toString().substring(0, 8));
        audit.setUserId(userId);
        audit.setRoleCode(roleCode);
        audit.setActionType(actionType);
        audit.setEntityType(entityType);
        audit.setEntityId(entityId);
        audit.setFieldName(fieldName);
        audit.setOldValue(oldVal);
        audit.setNewValue(newVal);
        audit.setComments(comments);
        audit.setIpAddress("127.0.0.1");
        auditLogRepository.save(audit);
    }

    private Collateral findCollateral(String idOrCode) {
        return collateralRepository.findById(idOrCode)
                .orElseGet(() -> collateralRepository.findByCode(idOrCode).orElse(null));
    }

    private InsurancePolicy findInsurancePolicy(String idOrNumber) {
        return insurancePolicyRepository.findById(idOrNumber)
                .orElseGet(() -> insurancePolicyRepository.findByPolicyNumber(idOrNumber).orElse(null));
    }

    private boolean isTerminalExceptionStatus(String status) {
        if (status == null || status.isBlank()) return false;
        String s = status.trim();
        return "Resolved".equalsIgnoreCase(s) || "Rejected".equalsIgnoreCase(s)
                || "Closed".equalsIgnoreCase(s) || "Cancelled".equalsIgnoreCase(s)
                || "Canceled".equalsIgnoreCase(s);
    }

    /**
     * Cancels the remaining pending exceptions (and their tasks) that belong to
     * the same submission when one of them is rejected. The rejection already
     * returned the underlying record to the maker, so the other exception tasks
     * are no longer valid decisions. History is preserved by keeping the rows
     * with a Cancelled status and an explanatory resolution note.
     */
    private void cancelSiblingExceptionTasks(CimsException rejected, String checkerId, String now) {
        if (rejected == null || rejected.getEntityType() == null || rejected.getEntityId() == null) return;
        List<CimsException> siblings = cimsExceptionRepository
                .findByEntityTypeAndEntityId(rejected.getEntityType(), rejected.getEntityId());
        for (CimsException sibling : siblings) {
            if (sibling.getId() == null || sibling.getId().equals(rejected.getId())) continue;
            if (isTerminalExceptionStatus(sibling.getStatus())) continue;
            sibling.setStatus("Cancelled");
            sibling.setResolvedBy(checkerId);
            sibling.setResolvedAt(now);
            sibling.setResolutionNotes("Cancelled because a related exception for the same submission was rejected by " + checkerId + ".");
            cimsExceptionRepository.save(sibling);
            for (WorkflowTask siblingTask : workflowTaskRepository.findByEntityId(sibling.getId())) {
                if ("Pending".equalsIgnoreCase(siblingTask.getStatus())) {
                    siblingTask.setStatus("Cancelled");
                    siblingTask.setCompletedAt(now);
                    siblingTask.setCurrentStep("Cancelled");
                    siblingTask.setRemarks("Cancelled due to rejection of a related exception.");
                    workflowTaskRepository.save(siblingTask);
                }
            }
        }
    }

    private String safe(String s) {
        return s == null ? "" : s.replace("\"", "\\\"");
    }

    private void appendPolicyHistory(InsurancePolicy policy, String jsonEntry) {
        String current = policy.getHistoryJson() != null && !policy.getHistoryJson().isBlank()
                ? policy.getHistoryJson().trim()
                : "[]";
        if (current.endsWith("]")) {
            if (current.length() > 2) {
                policy.setHistoryJson(current.substring(0, current.length() - 1) + "," + jsonEntry + "]");
            } else {
                policy.setHistoryJson("[" + jsonEntry + "]");
            }
        } else {
            policy.setHistoryJson("[" + jsonEntry + "]");
        }
    }

    private ApprovalHierarchyConfig findHierarchyConfig(String actionType, String entityType) {
        if (approvalHierarchyConfigRepository == null) return null;
        String act = actionType != null ? actionType.toLowerCase(Locale.ROOT).replace("_", " ").replace("proc ", "").trim() : "";
        for (ApprovalHierarchyConfig cfg : approvalHierarchyConfigRepository.findAll()) {
            if (!cfg.isActive()) continue;
            String tt = cfg.getTransactionType() != null ? cfg.getTransactionType().toLowerCase(Locale.ROOT).replace("_", " ").replace("proc ", "").trim() : "";
            if (!tt.isEmpty() && (act.contains(tt) || tt.contains(act) || (entityType != null && entityType.toLowerCase(Locale.ROOT).contains(tt)))) {
                return cfg;
            }
        }
        return null;
    }

    private void recordStructuredPolicyHistory(String policyId, String eventType, String prevStatus, String newStatus,
                                               Integer version, String actorId, String reason, String workflowTaskId, String snapshotJson) {
        if (policyHistoryRepository == null || policyId == null) return;
        PolicyHistory hist = new PolicyHistory();
        hist.setId("polhist-" + UUID.randomUUID().toString().substring(0, 8));
        hist.setPolicyId(policyId);
        hist.setEventType(eventType);
        hist.setPreviousStatus(prevStatus);
        hist.setNewStatus(newStatus);
        hist.setVersion(version != null ? version : 1);
        hist.setUserId(actorId != null ? actorId : "SYSTEM");
        hist.setTimestamp(LocalDateTime.now().toString());
        hist.setReason(reason);
        hist.setWorkflowTaskId(workflowTaskId);
        hist.setSnapshotJson(snapshotJson);
        policyHistoryRepository.save(hist);
    }
}
