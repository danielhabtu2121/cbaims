package com.bank.cims.controller;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.CimsExceptionRepository;
import com.bank.cims.service.CimsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exceptions")
@CrossOrigin(origins = "*")
public class ExceptionController {

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private CimsService cimsService;

    @GetMapping
    public ResponseEntity<List<CimsException>> getExceptions(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String slaStatus,
            @RequestParam(required = false) String search,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestHeader(value = "X-User-Role", required = false) String headerUserRole,
            @RequestParam(required = false) String userId) {

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId : userId;
        return ResponseEntity.ok(cimsService.getScopedExceptions(status, role, severity, type, slaStatus, search, effUserId, headerUserRole));
    }

    @GetMapping("/summary")
    public ResponseEntity<ExceptionSummaryDto> getSummary(
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestHeader(value = "X-User-Role", required = false) String headerUserRole,
            @RequestParam(required = false) String userId) {

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId : userId;
        return ResponseEntity.ok(cimsService.getExceptionSummary(effUserId, headerUserRole));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CimsException> getExceptionById(@PathVariable String id) {
        return cimsExceptionRepository.findById(id)
                .map(exc -> {
                    exc.computeSlaAndOperationalMetrics(LocalDate.now());
                    return ResponseEntity.ok(exc);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<Map<String, Object>> resolveException(
            @PathVariable String id,
            @RequestBody(required = false) ExceptionResolutionRequest body,
            @RequestParam(required = false) String correctiveAction,
            @RequestParam(required = false) String resolutionNotes,
            @RequestParam(required = false) String evidenceDocument,
            @RequestParam(required = false) Boolean isOverride,
            @RequestParam(required = false) String overrideReason,
            @RequestParam(required = false) String userId,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        ExceptionResolutionRequest req = body != null ? body : new ExceptionResolutionRequest();
        if (req.getCorrectiveAction() == null && correctiveAction != null) {
            req.setCorrectiveAction(correctiveAction);
        }
        if (req.getResolutionNotes() == null && resolutionNotes != null) {
            req.setResolutionNotes(resolutionNotes);
        }
        if (req.getEvidenceDocument() == null && evidenceDocument != null) {
            req.setEvidenceDocument(evidenceDocument);
        }
        if (isOverride != null) {
            req.setOverride(isOverride);
        }
        if (req.getOverrideReason() == null && overrideReason != null) {
            req.setOverrideReason(overrideReason);
        }

        if (req.getResolutionNotes() == null || req.getResolutionNotes().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Investigation and resolution notes are mandatory."));
        }
        if (req.getCorrectiveAction() == null || req.getCorrectiveAction().trim().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Corrective action selection is mandatory."));
        }

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId :
                (req.getUserId() != null ? req.getUserId() : userId);
        if (effUserId == null || effUserId.isBlank()) effUserId = "SYSTEM";

        try {
            cimsService.resolveException(id, req, effUserId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Exception " + id + " has been successfully resolved.",
                    "exceptionId", id
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage(),
                    "exceptionId", id
            ));
        }
    }

    @PostMapping("/{id}/assign")
    public ResponseEntity<Map<String, Object>> assignException(
            @PathVariable String id,
            @RequestBody(required = false) ExceptionAssignmentRequest body,
            @RequestParam(required = false) String assignedRole,
            @RequestParam(required = false) String assignedUserId,
            @RequestParam(required = false) String userId,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        ExceptionAssignmentRequest req = body != null ? body : new ExceptionAssignmentRequest();
        if (req.getAssignedRole() == null && assignedRole != null) {
            req.setAssignedRole(assignedRole);
        }
        if (req.getAssignedUserId() == null && assignedUserId != null) {
            req.setAssignedUserId(assignedUserId);
        }

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId :
                (req.getUserId() != null ? req.getUserId() : userId);
        if (effUserId == null || effUserId.isBlank()) effUserId = "SYSTEM";

        cimsService.assignException(id, req, effUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Exception " + id + " has been assigned successfully.",
                "exceptionId", id
        ));
    }

    @PostMapping("/{id}/escalate")
    public ResponseEntity<Map<String, Object>> escalateException(
            @PathVariable String id,
            @RequestBody(required = false) ExceptionEscalationRequest body,
            @RequestParam(required = false) String escalationRole,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false) String userId,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        ExceptionEscalationRequest req = body != null ? body : new ExceptionEscalationRequest();
        if (req.getEscalationRole() == null && escalationRole != null) {
            req.setEscalationRole(escalationRole);
        }
        if (req.getReason() == null && reason != null) {
            req.setReason(reason);
        }

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId :
                (req.getUserId() != null ? req.getUserId() : userId);
        if (effUserId == null || effUserId.isBlank()) effUserId = "SYSTEM";

        cimsService.escalateException(id, req, effUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Exception " + id + " has been escalated successfully.",
                "exceptionId", id
        ));
    }

    @PostMapping("/{id}/investigation")
    public ResponseEntity<Map<String, Object>> updateInvestigation(
            @PathVariable String id,
            @RequestBody ExceptionInvestigationNoteRequest body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {
        return addInvestigationNote(id, body, headerUserId);
    }

    @PostMapping("/{id}/investigation-notes")
    public ResponseEntity<Map<String, Object>> addInvestigationNote(
            @PathVariable String id,
            @RequestBody ExceptionInvestigationNoteRequest body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId : body.getUserId();
        if (effUserId == null || effUserId.isBlank()) effUserId = "SYSTEM";

        cimsService.addInvestigationNote(id, body, effUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Investigation note added successfully.",
                "exceptionId", id
        ));
    }

    @PostMapping("/{id}/evidence")
    public ResponseEntity<Map<String, Object>> addEvidence(
            @PathVariable String id,
            @RequestBody ExceptionEvidenceRequest body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId : body.getUserId();
        if (effUserId == null || effUserId.isBlank()) effUserId = "SYSTEM";

        cimsService.addExceptionEvidence(id, body, effUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Supporting evidence associated successfully.",
                "exceptionId", id
        ));
    }

    @PostMapping("/{id}/corrective-action")
    public ResponseEntity<Map<String, Object>> recordCorrectiveAction(
            @PathVariable String id,
            @RequestBody ExceptionCorrectiveActionRequest body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId) {

        String effUserId = (headerUserId != null && !headerUserId.isBlank()) ? headerUserId : body.getUserId();
        if (effUserId == null || effUserId.isBlank()) effUserId = "SYSTEM";

        cimsService.recordExceptionCorrectiveAction(id, body, effUserId);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Corrective action recorded successfully.",
                "exceptionId", id
        ));
    }

    @GetMapping("/{id}/investigation-notes")
    public ResponseEntity<List<CimsExceptionInvestigationNote>> getInvestigationNotes(@PathVariable String id) {
        return ResponseEntity.ok(cimsService.getInvestigationNotes(id));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<Map<String, Object>> getExceptionHistory(@PathVariable String id) {
        Map<String, Object> history = new HashMap<>();
        history.put("investigationNotes", cimsService.getInvestigationNotes(id));
        history.put("escalationHistory", cimsService.getEscalationHistory(id));
        history.put("assignmentHistory", cimsService.getAssignmentHistory(id));
        return ResponseEntity.ok(history);
    }

    @PostMapping("/scan-now")
    public ResponseEntity<ScanResultDto> triggerScan() {
        ScanResultDto result = cimsService.scanAndGenerateExceptions();
        // Also trigger auto escalation check for overdue exceptions
        cimsService.runAutomaticExceptionEscalation();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/submit-request")
    public ResponseEntity<?> submitExceptionRequest(
            @RequestBody EntryTimeExceptionRequest request,
            @RequestParam(defaultValue = "CRO_USER") String userId) {
        try {
            return ResponseEntity.ok(cimsService.submitEntryTimeException(request, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "Exception request submission failed"));
        }
    }
}
