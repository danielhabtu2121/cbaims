package com.bank.cims.controller;

import com.bank.cims.dto.InsuranceAdequacyAssessmentDto;
import com.bank.cims.model.InsuranceCoverageRule;
import com.bank.cims.model.InsuranceException;
import com.bank.cims.model.User;
import com.bank.cims.service.AuthorizationScopeService;
import com.bank.cims.service.InsuranceAdequacyService;
import com.bank.cims.service.InsuranceCoverageRuleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/insurance-adequacy")
@CrossOrigin(origins = "*")
public class InsuranceAdequacyController {

    @Autowired
    private InsuranceAdequacyService insuranceAdequacyService;

    @Autowired
    private InsuranceCoverageRuleService insuranceCoverageRuleService;

    @Autowired
    private AuthorizationScopeService authorizationScopeService;

    private User currentActor() {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()
                || actor.getUsername() == null || actor.getUsername().isBlank()
                || actor.getRole() == null || actor.getRole().isBlank()) {
            throw new IllegalArgumentException("Authentication required: a valid signed-in user with an assigned role could not be identified.");
        }
        return actor;
    }

    @GetMapping("/{collateralId}")
    public ResponseEntity<InsuranceAdequacyAssessmentDto> getAdequacyAssessment(@PathVariable String collateralId) {
        return ResponseEntity.ok(insuranceAdequacyService.evaluateAdequacy(collateralId));
    }

    // --- Configurable Coverage Rules (BR-18) ---

    @GetMapping("/rules")
    public ResponseEntity<List<InsuranceCoverageRule>> getCoverageRules() {
        return ResponseEntity.ok(insuranceCoverageRuleService.getAllRules());
    }

    @PostMapping("/rules")
    public ResponseEntity<InsuranceCoverageRule> saveCoverageRule(
            @RequestBody InsuranceCoverageRule rule,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceCoverageRuleService.saveRule(rule, actor.getUsername(), actor.getRole()));
    }

    @PostMapping("/rules/{id}/approve")
    public ResponseEntity<InsuranceCoverageRule> approveCoverageRule(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String checkerId,
            @RequestHeader(value = "X-User-Role", required = false) String checkerRole) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceCoverageRuleService.approveCoverageRule(id, actor.getUsername(), actor.getRole()));
    }

    @PostMapping("/rules/{id}/reject")
    public ResponseEntity<InsuranceCoverageRule> rejectCoverageRule(
            @PathVariable String id,
            @RequestParam(required = false) String reason,
            @RequestHeader(value = "X-User-Id", required = false) String checkerId,
            @RequestHeader(value = "X-User-Role", required = false) String checkerRole) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceCoverageRuleService.rejectCoverageRule(id, actor.getUsername(), actor.getRole(), reason));
    }

    @PostMapping("/rules/{id}/toggle")
    public ResponseEntity<InsuranceCoverageRule> toggleRuleStatus(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String userRole) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceCoverageRuleService.toggleRuleStatus(id, actor.getUsername(), actor.getRole()));
    }

    // --- Insurance Exceptions Workflow (BR-07, BR-12) ---

    @PostMapping("/exceptions")
    public ResponseEntity<InsuranceException> submitException(
            @RequestBody InsuranceException exception,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceAdequacyService.submitException(exception, actor.getUsername()));
    }

    @PostMapping("/exceptions/{id}/approve")
    public ResponseEntity<InsuranceException> approveException(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "Approved under supervisor discretion") String comments,
            @RequestHeader(value = "X-User-Id", required = false) String supervisorId,
            @RequestHeader(value = "X-User-Role", required = false) String supervisorRole) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceAdequacyService.approveException(id, actor.getUsername(), actor.getRole(), comments));
    }

    @PostMapping("/exceptions/{id}/reject")
    public ResponseEntity<InsuranceException> rejectException(
            @PathVariable String id,
            @RequestParam String comments,
            @RequestHeader(value = "X-User-Id", required = false) String supervisorId,
            @RequestHeader(value = "X-User-Role", required = false) String supervisorRole) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceAdequacyService.rejectException(id, actor.getUsername(), actor.getRole(), comments));
    }

    @PostMapping("/exceptions/{id}/resolve")
    public ResponseEntity<InsuranceException> resolveException(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "Exception condition resolved.") String notes,
            @RequestHeader(value = "X-User-Id", required = false) String resolvedBy) {
        User actor = currentActor();
        return ResponseEntity.ok(insuranceAdequacyService.resolveException(id, actor.getUsername(), notes));
    }
}
