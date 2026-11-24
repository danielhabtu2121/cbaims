package com.bank.cims.controller;

import com.bank.cims.dto.*;
import com.bank.cims.model.LoanAccount;
import com.bank.cims.model.LoanCollateralLinkHistory;
import com.bank.cims.model.User;
import com.bank.cims.service.AuthorizationScopeService;
import com.bank.cims.service.CollateralFacilityRelationshipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class CollateralFacilityRelationshipController {

    @Autowired
    private CollateralFacilityRelationshipService relationshipService;

    @Autowired
    private AuthorizationScopeService authorizationScopeService;

    private String resolveEffectiveUserId(String headerUserId, String paramUserId) {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()
                || actor.getUsername() == null || actor.getUsername().isBlank()) {
            throw new IllegalArgumentException("Authentication required: a valid signed-in user could not be identified.");
        }
        return actor.getUsername();
    }

    // --- Query Relationships ---
    @GetMapping("/collateral-facility-links")
    public ResponseEntity<List<CollateralFacilityLinkDto>> getAllRelationships(
            @RequestParam(required = false) String collateralId,
            @RequestParam(required = false) String facilityId,
            @RequestParam(required = false) String customerId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(relationshipService.getAllRelationships(collateralId, facilityId, customerId, status));
    }

    @GetMapping("/collateral-facility-links/{id}")
    public ResponseEntity<CollateralFacilityLinkDto> getRelationshipById(@PathVariable String id) {
        return ResponseEntity.ok(relationshipService.getRelationshipById(id));
    }

    // --- Direction 1: Collateral -> Secured Facilities (Section 18 & 32) ---
    @GetMapping({"/collaterals/{id}/facilities", "/collateral/{id}/facilities-detailed"})
    public ResponseEntity<CollateralSecuredFacilitiesSummaryDto> getSecuredFacilitiesForCollateral(@PathVariable String id) {
        return ResponseEntity.ok(relationshipService.getCollateralSecuredFacilitiesSummary(id));
    }

    // --- Eligible Facilities for Collateral (Strict Customer Isolation & Portfolio Scope - Section 6, 7, 8, 9, 11) ---
    @GetMapping({"/collaterals/{id}/eligible-facilities", "/collateral/{id}/eligible-facilities", "/cims/collaterals/{id}/eligible-facilities"})
    public ResponseEntity<List<LoanAccount>> getEligibleFacilitiesForCollateral(
            @PathVariable String id,
            @RequestParam(required = false) String targetCustomerId,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String userId) {
        String effectiveUser = resolveEffectiveUserId(headerUserId, userId);
        return ResponseEntity.ok(relationshipService.getEligibleFacilitiesForCollateral(id, targetCustomerId, effectiveUser));
    }

    // --- Candidate Facilities for Collateral (Direction 1 Linking Entry Point - Section 35) ---
    @GetMapping({"/collaterals/{id}/candidate-facilities", "/collateral/{id}/candidate-facilities", "/cims/collaterals/{id}/candidate-facilities"})
    public ResponseEntity<List<FacilityCandidateDto>> getCandidateFacilitiesForCollateral(
            @PathVariable String id,
            @RequestParam(required = false) String targetCustomerId,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String userId) {
        String effectiveUser = resolveEffectiveUserId(headerUserId, userId);
        return ResponseEntity.ok(relationshipService.getCandidateFacilitiesForCollateral(id, targetCustomerId, effectiveUser));
    }

    // --- Duplicate Collateral Search Before Registration (Section 23 & 24) ---
    @GetMapping({"/collaterals/search-existing", "/collateral/search-existing"})
    public ResponseEntity<Map<String, Object>> searchExistingCollateral(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String titleDeedNumber,
            @RequestParam(required = false) String registrationNumber,
            @RequestParam(required = false) String excludeId) {
        return ResponseEntity.ok(relationshipService.searchExistingCollateral(code, titleDeedNumber, registrationNumber, excludeId));
    }

    // --- Direction 2: Facility -> Securing Collaterals (Section 19 & 32) ---
    @GetMapping({"/facilities/{id}/collaterals", "/facilities/{id}/collateral-detailed"})
    public ResponseEntity<FacilityCollateralSummaryDto> getSecuringCollateralsForFacility(@PathVariable String id) {
        return ResponseEntity.ok(relationshipService.getFacilityCollateralSummary(id));
    }

    // --- Eligible Collaterals for Facility (Direction 2 Linking Entry Point - Section 7.2) ---
    @GetMapping({"/facilities/{id}/eligible-collaterals", "/facility/{id}/eligible-collaterals", "/cims/facilities/{id}/eligible-collaterals"})
    public ResponseEntity<List<CollateralCandidateDto>> getEligibleCollateralsForFacility(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String userId) {
        String effectiveUser = resolveEffectiveUserId(headerUserId, userId);
        return ResponseEntity.ok(relationshipService.getEligibleCollateralsForFacility(id, effectiveUser));
    }

    // --- Create Relationship (Section 20 & 32) ---
    @PostMapping("/collateral-facility-links")
    public ResponseEntity<?> createRelationship(
            @RequestBody RelationshipRequestDto request,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String userId) {
        try {
            String effectiveUser = resolveEffectiveUserId(headerUserId, userId);
            CollateralFacilityLinkDto created = relationshipService.createRelationship(request, effectiveUser);
            return ResponseEntity.ok(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- Update Relationship (Section 22 & 32) ---
    @PutMapping("/collateral-facility-links/{id}")
    public ResponseEntity<?> updateRelationship(
            @PathVariable String id,
            @RequestBody RelationshipRequestDto request,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String userId) {
        try {
            String effectiveUser = resolveEffectiveUserId(headerUserId, userId);
            CollateralFacilityLinkDto updated = relationshipService.updateRelationship(id, request, effectiveUser);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- End Relationship (Section 23 & 32) ---
    @PostMapping("/collateral-facility-links/{id}/end")
    public ResponseEntity<?> endRelationship(
            @PathVariable String id,
            @RequestParam(defaultValue = "Obligation settled or facility closed") String reason,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String userId) {
        try {
            String effectiveUser = resolveEffectiveUserId(headerUserId, userId);
            CollateralFacilityLinkDto ended = relationshipService.endRelationship(id, reason, effectiveUser);
            return ResponseEntity.ok(ended);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- Relationship History (Section 22 & 32) ---
    @GetMapping("/collateral-facility-links/{id}/history")
    public ResponseEntity<List<LoanCollateralLinkHistory>> getRelationshipHistory(@PathVariable String id) {
        return ResponseEntity.ok(relationshipService.getRelationshipHistory(id));
    }

    // --- Pre-validation (Section 11, 20, 32) ---
    @PostMapping("/collateral-facility-links/validate")
    public ResponseEntity<RelationshipValidationResultDto> validateRelationship(@RequestBody RelationshipRequestDto request) {
        return ResponseEntity.ok(relationshipService.validateRelationship(request));
    }

    // --- Relationship-Aware Release Check (Section 24) ---
    @GetMapping("/collateral-facility-links/validate-release")
    public ResponseEntity<Map<String, Object>> validateCollateralRelease(@RequestParam String collateralId) {
        return ResponseEntity.ok(relationshipService.validateCollateralRelease(collateralId));
    }

    // --- Double-Counting Correction: Portfolio Exposure Summary (Section 15) ---
    @GetMapping("/portfolio/exposure-summary")
    public ResponseEntity<Map<String, Object>> getPortfolioExposureSummary() {
        return ResponseEntity.ok(relationshipService.calculateBankPortfolioExposure());
    }

    // --- CBS Relationship Reconciliation (Section 29) ---
    @GetMapping("/collateral-facility-links/reconcile-cbs")
    public ResponseEntity<CbsRelationshipReconciliationDto> reconcileCbsRelationships() {
        return ResponseEntity.ok(relationshipService.reconcileCbsRelationships());
    }
}
