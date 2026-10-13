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

    @Autowired
    @org.springframework.context.annotation.Lazy
    private NotificationService notificationService;

    @Transactional
    public WorkflowActionResultDto submitToWorkflow(String entityType, String entityId, String actionType, String makerId, String remarks, String payloadJson) {
        String now = LocalDateTime.now().toString();
        String fallbackRole = ("Document".equalsIgnoreCase(entityType) || "Ownership Document".equalsIgnoreCase(entityType) || "Collateral Document".equalsIgnoreCase(entityType))
                ? "MGRCOLLDOC" : "BRMGR";
        // Route through the same Admin-configured Approval Hierarchy used everywhere else,
        // rather than a hardcoded role, so this path stays consistent with the rest of the
        // system and with whatever the Approval Hierarchy admin screen actually says.
        String candidateRole = roleHierarchyService.resolveApproverRole(entityType, actionType, fallbackRole);

        // Check if existing pending task exists
        WorkflowTask task = null;
        List<WorkflowTask> existing = workflowTaskRepository.findAll();
        for (WorkflowTask t : existing) {
            if (entityId.equalsIgnoreCase(t.getEntityId()) && "Pending".equalsIgnoreCase(t.getStatus())) {
                task = t;
                break;
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
        task.setMakerId(makerId != null ? makerId : "SYSTEM");
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
        updateEntityToPendingState(entityType, entityId, actionType, makerId, now);

        // Audit
        createAuditLog(makerId, "MAKER", "WORKFLOW_SUBMIT", entityType, entityId, "status", "Draft", "Pending", 
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
        if (task.getMakerId() != null && task.getMakerId().trim().equalsIgnoreCase(checkerId.trim())) {
            throw new IllegalStateException("Dual Control Violation: Maker (" + task.getMakerId() + ") cannot approve their own submission.");
        }

        // Authorize Checker
        workflowAuthService.assertCanApprove(checkerId, taskId);

        String now = LocalDateTime.now().toString();
        String entityType = task.getEntityType();
        String entityId = task.getEntityId();
        String finalEntityStatus = "Active";

        // Multi-level approval hierarchy check (§ SysAdmin Approval Workflows)
        ApprovalHierarchyConfig cfg = findHierarchyConfig(task.getActionType(), entityType);
        boolean requiresLevel2 = cfg != null && cfg.getApprovalLevels() == 2 && !"Level 2 Review".equalsIgnoreCase(task.getCurrentStep())
                && !"POLICY_CANCELLATION".equalsIgnoreCase(task.getActionType());

        if (requiresLevel2) {
            String nextRole = cfg.getLevel2Role() != null && !cfg.getLevel2Role().isBlank() ? cfg.getLevel2Role() : "HODEPT";
            task.setCurrentStep("Level 2 Review");
            task.setCandidateRole(nextRole);
            task.setStatus("Pending");
            task.setRemarks(comments != null ? comments : "Level 1 Approved by " + checkerId + "; forwarded to " + nextRole);
            workflowTaskRepository.save(task);

            ApprovalHistory history = new ApprovalHistory();
            history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
            history.setWorkflowTaskId(task.getId());
            history.setActorId(checkerId);
            history.setActorRole(checkerRole != null ? checkerRole : "BRMGR");
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
                if ("COLLATERAL_RELEASE".equalsIgnoreCase(task.getActionType())) {
                    List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
                    double pendingExposure = 0;
                    List<String> activeLoanRefs = new java.util.ArrayList<>();
                    for (LoanCollateralLink link : links) {
                        Optional<LoanAccount> loanOpt = loanAccountRepository.findById(link.getLoanAccountId());
                        if (loanOpt.isPresent() && loanOpt.get().getOutstandingBalance() > 0) {
                            pendingExposure += loanOpt.get().getOutstandingBalance();
                            activeLoanRefs.add(loanOpt.get().getLoanReference());
                        }
                    }
                    if (pendingExposure > 0) {
                        throw new IllegalStateException("Collateral release blocked: Active outstanding loan obligations remain on linked facilities (" + String.join(", ", activeLoanRefs) + ") totaling ETB " + String.format(java.util.Locale.ROOT, "%.2f", pendingExposure) + ".");
                    }
                    col.setStatus("Released");
                    col.setAuthStat("A");
                    col.setRecordStat("O");
                    col.setCheckerId(checkerId);
                    col.setCheckerDtStamp(now);
                    collateralRepository.save(col);
                    for (LoanCollateralLink link : links) {
                        link.setStatus("Released");
                        loanCollateralLinkRepository.save(link);
                    }
                    finalEntityStatus = "Released";
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
                cust.setRecordStat("O");
                cust.setAuthStat("A");
                cust.setStatus("Active");
                cust.setCheckerId(checkerId);
                cust.setCheckerDtStamp(now);
                cust.setOnceAuth("Y");
                customerRepository.save(cust);
                finalEntityStatus = "Active";
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

                // Step 8: Exception Approved -> Validation failure overridden -> Transaction resumes -> Normal workflow continues!
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
        }

        // Update Task
        task.setStatus("Approved");
        task.setCompletedAt(now);
        task.setRemarks(comments != null ? comments : "Approved by " + checkerId);
        workflowTaskRepository.save(task);

        // Approval History
        ApprovalHistory history = new ApprovalHistory();
        history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
        history.setWorkflowTaskId(task.getId());
        history.setActorId(checkerId);
        history.setActorRole(checkerRole != null ? checkerRole : "BRMGR");
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
                        entityId
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

        workflowAuthService.assertCanApprove(checkerId, taskId);

        String now = LocalDateTime.now().toString();
        String entityType = task.getEntityType();
        String entityId = task.getEntityId();

        if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral col = findCollateral(entityId);
            if (col != null) {
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
        }

        task.setStatus("Returned");
        task.setRemarks(comments);
        workflowTaskRepository.save(task);

        ApprovalHistory history = new ApprovalHistory();
        history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
        history.setWorkflowTaskId(task.getId());
        history.setActorId(checkerId);
        history.setActorRole(checkerRole != null ? checkerRole : "BRMGR");
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
                        entityId
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

        workflowAuthService.assertCanApprove(checkerId, taskId);

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
                    pol.setCancellationReason(null);
                } else if ("POLICY_CLOSURE".equalsIgnoreCase(task.getActionType()) || "Closure Pending".equalsIgnoreCase(pol.getStatus())) {
                    pol.setStatus("Active");
                    pol.setClosureReason(null);
                } else if ("POLICY_REOPEN".equalsIgnoreCase(task.getActionType()) || "Reopen Pending".equalsIgnoreCase(pol.getStatus())) {
                    pol.setStatus("Closed");
                } else if ("POLICY_AMENDMENT".equalsIgnoreCase(task.getActionType())) {
                    pol.setStatus("Active");
                } else {
                    pol.setStatus("Rejected");
                }
                pol.setAuthStat("R");
                pol.setRecordStat("R");
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
        }

        task.setStatus("Rejected");
        task.setCompletedAt(now);
        task.setRemarks(comments);
        workflowTaskRepository.save(task);

        ApprovalHistory history = new ApprovalHistory();
        history.setId("hist-" + UUID.randomUUID().toString().substring(0, 8));
        history.setWorkflowTaskId(task.getId());
        history.setActorId(checkerId);
        history.setActorRole(checkerRole != null ? checkerRole : "BRMGR");
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
                        entityId
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
        AuditLog audit = new AuditLog();
        audit.setId("audit-" + UUID.randomUUID().toString().substring(0, 8));
        audit.setUserId(userId != null ? userId : "SYSTEM");
        audit.setRoleCode(roleCode != null ? roleCode : "SYSADMIN");
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
