package com.bank.cims.controller;

import com.bank.cims.dto.EarlyReleaseSubmissionDto;
import com.bank.cims.dto.ManualCbsUpdateDto;
import com.bank.cims.dto.PreReleaseImpactAssessmentDto;
import com.bank.cims.model.CollateralReleaseRequest;
import com.bank.cims.model.User;
import com.bank.cims.service.AuthorizationScopeService;
import com.bank.cims.service.CimsService;
import com.bank.cims.service.EarlyCollateralReleaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/collateral-release")
@CrossOrigin(origins = "*")
public class EarlyReleaseController {

    @Autowired
    private EarlyCollateralReleaseService earlyCollateralReleaseService;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private AuthorizationScopeService authorizationScopeService;

    private User requireActor() {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()) {
            throw new IllegalArgumentException("Authentication required: the signed-in user could not be identified.");
        }
        return actor;
    }

    @GetMapping(value = {"/pre-release-check", "/assessment"})
    public ResponseEntity<PreReleaseImpactAssessmentDto> getPreReleaseCheck(
            @RequestParam String collateralId,
            @RequestParam(required = false) String facilityIds) {
        cimsService.assertCollateralAccess(collateralId);
        List<String> facIds = (facilityIds != null && !facilityIds.isBlank())
                ? Arrays.asList(facilityIds.split(","))
                : null;
        return ResponseEntity.ok(earlyCollateralReleaseService.performPreReleaseImpactAssessment(collateralId, facIds));
    }

    @PostMapping("/requests")
    public ResponseEntity<CollateralReleaseRequest> submitReleaseRequest(
            @RequestBody EarlyReleaseSubmissionDto dto,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(value = "userId", required = false) String paramUserId) {
        // Legacy header/parameter/body identity fields are ignored. The verified token
        // user is the requester for permission checks, makerId and audit records.
        User actor = requireActor();
        cimsService.assertUserPermission(actor.getUsername(), "Collateral Release", "EDIT");
        cimsService.assertCollateralAccess(dto.getCollateralId());
        dto.setRequesterId(actor.getUsername());
        return ResponseEntity.ok(earlyCollateralReleaseService.submitReleaseRequest(dto, actor.getUsername()));
    }

    @GetMapping("/requests")
    public ResponseEntity<List<CollateralReleaseRequest>> getAllReleaseRequests() {
        return ResponseEntity.ok(earlyCollateralReleaseService.getAllReleaseRequests());
    }

    @GetMapping("/requests/{id}")
    public ResponseEntity<CollateralReleaseRequest> getReleaseRequestById(@PathVariable String id) {
        return earlyCollateralReleaseService.getReleaseRequestById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/requests/{id}/approve")
    public ResponseEntity<CollateralReleaseRequest> approveReleaseRequest(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "Approved release under Credit Committee delegated authority") String comments,
            @RequestHeader(value = "X-User-Id", required = false) String approverHeaderId,
            @RequestParam(value = "userId", required = false) String approverParamId) {
        User actor = requireActor();
        cimsService.assertUserPermission(actor.getUsername(), "Collateral Release", "APPROVE");
        return ResponseEntity.ok(earlyCollateralReleaseService.approveReleaseRequest(id, actor.getUsername(), actor.getRole(), comments));
    }

    @PostMapping("/requests/{id}/reject")
    public ResponseEntity<CollateralReleaseRequest> rejectReleaseRequest(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "Rejected by Credit Approver") String comments,
            @RequestHeader(value = "X-User-Id", required = false) String approverHeaderId,
            @RequestParam(value = "userId", required = false) String approverParamId) {
        User actor = requireActor();
        cimsService.assertUserPermission(actor.getUsername(), "Collateral Release", "APPROVE");
        return ResponseEntity.ok(earlyCollateralReleaseService.rejectReleaseRequest(id, actor.getUsername(), actor.getRole(), comments));
    }

    @PostMapping("/requests/{id}/manual-cbs-update")
    public ResponseEntity<CollateralReleaseRequest> recordManualCbsUpdate(
            @PathVariable String id,
            @RequestBody ManualCbsUpdateDto dto,
            @RequestHeader(value = "X-User-Id", required = false) String execHeaderId,
            @RequestParam(value = "userId", required = false) String execParamId) {
        User actor = requireActor();
        dto.setReleaseRequestId(id);
        dto.setExecutedBy(actor.getUsername());
        cimsService.assertUserPermission(actor.getUsername(), "Collateral Release", "EDIT");
        return ResponseEntity.ok(earlyCollateralReleaseService.recordManualCbsUpdate(dto, actor.getUsername()));
    }
}
