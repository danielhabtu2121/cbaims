package com.bank.cims.controller;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.WorkflowAuthorizationService;
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

    @GetMapping("/tasks")
    public ResponseEntity<List<WorkflowTask>> getTasks(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String makerId) {
        // Return only tasks relevant to the current workflow inbox. A checker gets
        // pending tasks assigned to their role; a maker also gets their own submissions.
        LinkedHashMap<String, WorkflowTask> result = new LinkedHashMap<>();
        if (role != null && !role.isBlank()) {
            String effectiveStatus = (status == null || status.isBlank()) ? "Pending" : status;
            for (WorkflowTask t : workflowTaskRepository.findByCandidateRoleIgnoreCaseAndStatus(role, effectiveStatus)) {
                result.put(t.getId(), t);
            }
        } else if (status != null && !status.isBlank()) {
            for (WorkflowTask t : workflowTaskRepository.findByStatus(status)) result.put(t.getId(), t);
        }
        if (makerId != null && !makerId.isBlank()) {
            for (WorkflowTask t : workflowTaskRepository.findByMakerIdIgnoreCase(makerId)) result.put(t.getId(), t);
        }
        if (role == null && (status == null || status.isBlank()) && (makerId == null || makerId.isBlank())) {
            return ResponseEntity.ok(workflowTaskRepository.findAll());
        }
        return ResponseEntity.ok(new java.util.ArrayList<>(result.values()));
    }

    @PostMapping("/tasks/{taskId}/approve")
    public ResponseEntity<Map<String, Object>> approveTask(
            @PathVariable String taskId,
            @RequestParam String userId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false, defaultValue = "Approved by checker") String comments) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required to approve a task."));
        }
        try {
            User authorized = workflowAuthorizationService.assertCanApprove(userId, taskId);
            cimsService.approveWorkflowTask(taskId, authorized.getUsername(), authorized.getRole(), comments);
            return ResponseEntity.ok(Map.of("success", true, "message", "Task " + taskId + " approved."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage() == null ? "Workflow action failed." : e.getMessage()));
        }
    }

    @PostMapping("/tasks/{taskId}/reject")
    public ResponseEntity<Map<String, Object>> rejectTask(
            @PathVariable String taskId,
            @RequestParam String userId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false, defaultValue = "Rejected by checker") String comments) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required to reject a task."));
        }
        try {
            User authorized = workflowAuthorizationService.assertCanApprove(userId, taskId);
            cimsService.rejectWorkflowTask(taskId, authorized.getUsername(), authorized.getRole(), comments);
            return ResponseEntity.ok(Map.of("success", true, "message", "Task " + taskId + " rejected."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage() == null ? "Workflow action failed." : e.getMessage()));
        }
    }

    @PostMapping("/tasks/{taskId}/return")
    public ResponseEntity<Map<String, Object>> returnTask(
            @PathVariable String taskId,
            @RequestParam String userId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false, defaultValue = "Please review and correct submitted data.") String correctionNote) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required to return a task."));
        }
        try {
            User authorized = workflowAuthorizationService.assertCanApprove(userId, taskId);
            cimsService.returnWorkflowTask(taskId, authorized.getUsername(), authorized.getRole(), correctionNote);
            return ResponseEntity.ok(Map.of("success", true, "message", "Task " + taskId + " returned to maker for correction."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(409).body(Map.of("success", false, "error", e.getMessage() == null ? "Workflow action failed." : e.getMessage()));
        }
    }

    @PostMapping("/tasks/{taskId}/resubmit")
    public ResponseEntity<Map<String, Object>> resubmitTask(
            @PathVariable String taskId,
            @RequestParam String userId) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required to resubmit a task."));
        }
        try {
            cimsService.resubmitReturnedWorkflowTask(taskId, userId);
            return ResponseEntity.ok(Map.of("success", true, "message", "Task resubmitted to the configured checker."));
        } catch (RuntimeException e) {
            return ResponseEntity.status(400).body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/bulk-approve")
    public ResponseEntity<Map<String, Object>> bulkApprove(
            @RequestBody List<String> taskIds,
            @RequestParam String userId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false, defaultValue = "Bulk approved by checker") String comments) {
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "userId is required to bulk approve."));
        }
        int approved = 0;
        List<String> failures = new java.util.ArrayList<>();
        for (String id : taskIds) {
            try {
                User authorized = workflowAuthorizationService.assertCanApprove(userId, id);
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
