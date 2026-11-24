package com.bank.cims.controller;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.WorkflowAuthorizationService;
import com.bank.cims.service.RoleHierarchyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/workflow")
@CrossOrigin(origins = "*")
public class WorkflowController {

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    @Autowired
    private ApprovalHistoryRepository approvalHistoryRepository;

    @Autowired
    private DelegationRepository delegationRepository;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private WorkflowAuthorizationService workflowAuthorizationService;

    @Autowired
    private RoleHierarchyService roleHierarchyService;

    @Autowired
    private com.bank.cims.service.AuthorizationScopeService authorizationScopeService;

    /** Resolves the checker from the verified token only - client supplied IDs are ignored. */
    private User currentActor() {
        return authorizationScopeService.currentUser();
    }

    @GetMapping("/tasks")
    public ResponseEntity<List<WorkflowTask>> getTasks(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String makerId) {
        // The inbox is scoped to the authenticated database user. Client supplied
        // role/makerId values are never used to widen visibility.
        User actor = currentActor();
        if (actor == null) return ResponseEntity.ok(List.of());

        String effectiveRole = actor.getRole();
        String effectiveMakerId = actor.getId() != null && !actor.getId().isBlank()
                ? actor.getId() : actor.getUsername();
        LinkedHashMap<String, WorkflowTask> result = new LinkedHashMap<>();
        String effectiveStatus = (status == null || status.isBlank()) ? "Pending" : status;

        if (effectiveRole != null && !effectiveRole.isBlank()) {
            for (WorkflowTask t : workflowTaskRepository.findAll()) {
                if ("ALL".equalsIgnoreCase(effectiveStatus) || effectiveStatus.equalsIgnoreCase(t.getStatus())) {
                    boolean roleMatch = effectiveRole.equalsIgnoreCase(t.getCandidateRole())
                            || roleHierarchyService.isAuthorizedToActOn(effectiveRole, t.getCandidateRole());
                    if (!roleMatch) continue;

                    if ("Pending".equalsIgnoreCase(effectiveStatus)
                            && effectiveMakerId != null && !effectiveMakerId.isBlank()
                            && isSamePerson(t.getMakerId(), effectiveMakerId)) {
                        continue;
                    }
                    if ("Level 2 Review".equalsIgnoreCase(t.getCurrentStep())
                            && effectiveMakerId != null && !effectiveMakerId.isBlank()) {
                        List<ApprovalHistory> histories = approvalHistoryRepository.findByWorkflowTaskIdOrderByDecidedAtDesc(t.getId());
                        boolean alreadyApprovedLevel1 = histories.stream().anyMatch(h ->
                                "Approved".equalsIgnoreCase(h.getDecision()) && isSamePerson(h.getActorId(), effectiveMakerId));
                        if (alreadyApprovedLevel1) continue;
                    }
                    result.put(t.getId(), t);
                }
            }
        }

        if (effectiveMakerId != null && !effectiveMakerId.isBlank()) {
            for (WorkflowTask t : workflowTaskRepository.findByMakerIdIgnoreCase(effectiveMakerId)) {
                if ("ALL".equalsIgnoreCase(effectiveStatus) || effectiveStatus.equalsIgnoreCase(t.getStatus())) {
                    result.put(t.getId(), t);
                }
            }
        }

        return ResponseEntity.ok(new java.util.ArrayList<>(result.values()));
    }

    private boolean isSamePerson(String id1, String id2) {
        if (id1 == null || id2 == null) return false;
        return normalizeIdentity(id1).equals(normalizeIdentity(id2));
    }

    private String normalizeIdentity(String value) {
        if (value == null || value.isBlank()) return "";
        return value.trim().toLowerCase()
                .replace("_user", "")
                .replaceFirst("^usr[-_ ]?", "")
                .replace("-", "");
    }

    @PostMapping("/tasks/{taskId}/approve")
    public ResponseEntity<Map<String, Object>> approveTask(
            @PathVariable String taskId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false, defaultValue = "Approved by checker") String comments) {
        User actor = currentActor();
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "error", "Authentication required."));
        }
        if (comments == null || comments.trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Approval comments cannot be blank."));
        }
        try {
            User authorized = workflowAuthorizationService.assertCanApprove(actor.getUsername(), taskId);
            cimsService.approveWorkflowTask(taskId, authorized.getUsername(), authorized.getRole(), comments.trim());
            return ResponseEntity.ok(Map.of("success", true, "message", "Task " + taskId + " approved."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage() == null ? "Workflow action failed." : e.getMessage()));
        }
    }

    @PostMapping("/tasks/{taskId}/reject")
    public ResponseEntity<Map<String, Object>> rejectTask(
            @PathVariable String taskId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String role,
            @RequestParam String comments) {
        User actor = currentActor();
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "error", "Authentication required."));
        }
        if (comments == null || comments.trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Mandatory rejection reason/comments required."));
        }
        try {
            User authorized = workflowAuthorizationService.assertCanApprove(actor.getUsername(), taskId);
            cimsService.rejectWorkflowTask(taskId, authorized.getUsername(), authorized.getRole(), comments.trim());
            return ResponseEntity.ok(Map.of("success", true, "message", "Task " + taskId + " rejected."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage() == null ? "Workflow action failed." : e.getMessage()));
        }
    }

    @PostMapping("/tasks/{taskId}/return")
    public ResponseEntity<Map<String, Object>> returnTask(
            @PathVariable String taskId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String role,
            @RequestParam String correctionNote) {
        User actor = currentActor();
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "error", "Authentication required."));
        }
        if (correctionNote == null || correctionNote.trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Mandatory return/correction notes required."));
        }
        try {
            User authorized = workflowAuthorizationService.assertCanApprove(actor.getUsername(), taskId);
            cimsService.returnWorkflowTask(taskId, authorized.getUsername(), authorized.getRole(), correctionNote.trim());
            return ResponseEntity.ok(Map.of("success", true, "message", "Task " + taskId + " returned to maker for correction."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage() == null ? "Workflow action failed." : e.getMessage()));
        }
    }

    @PostMapping("/tasks/{taskId}/resubmit")
    public ResponseEntity<Map<String, Object>> resubmitTask(
            @PathVariable String taskId,
            @RequestParam(required = false) String userId) {
        User actor = currentActor();
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "error", "Authentication required."));
        }
        try {
            cimsService.resubmitReturnedWorkflowTask(taskId, actor.getId() != null && !actor.getId().isBlank()
                    ? actor.getId() : actor.getUsername());
            return ResponseEntity.ok(Map.of("success", true, "message", "Task resubmitted to the configured checker."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(400).body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/bulk-approve")
    public ResponseEntity<Map<String, Object>> bulkApprove(
            @RequestBody List<String> taskIds,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false, defaultValue = "Bulk approved by checker") String comments) {
        User actor = currentActor();
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "error", "Authentication required."));
        }
        if (comments == null || comments.trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "A valid approval comment is required for bulk authorization."));
        }
        int approved = 0;
        List<String> failures = new java.util.ArrayList<>();
        for (String id : taskIds) {
            try {
                User authorized = workflowAuthorizationService.assertCanApprove(actor.getUsername(), id);
                cimsService.approveWorkflowTask(id, authorized.getUsername(), authorized.getRole(), comments);
                approved++;
            } catch (RuntimeException e) {
                failures.add(id + ": " + (e.getMessage() == null ? "approval failed" : e.getMessage()));
            }
        }
        boolean success = failures.isEmpty();
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("success", success);
        result.put("approvedCount", approved);
        result.put("failedCount", failures.size());
        result.put("failures", failures);
        return ResponseEntity.status(success ? 200 : 409).body(result);
    }

    @GetMapping("/tasks/{taskId}/history")
    public ResponseEntity<List<ApprovalHistory>> getTaskHistory(@PathVariable String taskId) {
        return ResponseEntity.ok(approvalHistoryRepository.findByWorkflowTaskIdOrderByDecidedAtDesc(taskId));
    }

    // --- Delegations ---
    @GetMapping("/delegations")
    public ResponseEntity<List<Delegation>> getDelegations() {
        return ResponseEntity.ok(delegationRepository.findAll());
    }

    @PostMapping("/delegations")
    public ResponseEntity<Delegation> createDelegation(@RequestBody Delegation delegation) {
        if (delegation.getId() == null || delegation.getId().isBlank()) {
            delegation.setId("del-" + UUID.randomUUID().toString().substring(0, 8));
        }
        delegation.setStatus("Active");
        return ResponseEntity.ok(delegationRepository.save(delegation));
    }

    @PostMapping("/delegations/{id}/revoke")
    public ResponseEntity<Map<String, Object>> revokeDelegation(@PathVariable String id) {
        delegationRepository.findById(id).ifPresent(d -> {
            d.setStatus("Revoked");
            delegationRepository.save(d);
        });
        return ResponseEntity.ok(Map.of("success", true, "message", "Delegation revoked."));
    }
}
