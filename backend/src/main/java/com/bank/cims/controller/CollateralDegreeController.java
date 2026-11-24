package com.bank.cims.controller;

import com.bank.cims.model.Collateral;
import com.bank.cims.model.User;
import com.bank.cims.service.AuthorizationScopeService;
import com.bank.cims.service.FirstDegreeSecondDegreeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class CollateralDegreeController {

    @Autowired
    private FirstDegreeSecondDegreeService degreeService;

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

    // --- Validate Second-Degree Collateral (Pre-Validation / Submission) ---
    @PostMapping({"/collaterals/second-degree/validate", "/collateral/second-degree/validate"})
    public ResponseEntity<FirstDegreeSecondDegreeService.SecondDegreeValidationResult> validateSecondDegree(
            @RequestBody Collateral collateral) {
        return ResponseEntity.ok(degreeService.validateSecondDegreeCollateral(collateral, collateral.getDocuments()));
    }

    private static final java.util.Set<String> PROMOTION_ROLES = java.util.Set.of(
            "MGRCOLLDOC", "BRMGR", "DISTDIR", "HODEPT", "SRMGMT", "EXEC"
    );

    private static final java.util.Set<String> BALANCE_REFRESH_ROLES = java.util.Set.of(
            "CRO", "MGRCOLLDOC", "COLLDOCOFF", "BRMGR", "DISTDIR", "SYSADMIN", "ADMIN"
    );

    // --- Promote Second-Degree Collateral to First-Degree Priority ---
    @PostMapping({"/collaterals/{id}/promote", "/collateral/{id}/promote"})
    public ResponseEntity<?> promoteCollateral(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> payload,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader) {
        try {
            User actor = currentActor();
            userId = actor.getUsername();
            String effRole = actor.getRole().trim().toUpperCase(Locale.ROOT);
            if (!PROMOTION_ROLES.contains(effRole.trim().toUpperCase())) {
                return ResponseEntity.status(403).body(Map.of(
                        "success", false,
                        "message", "Access Denied: Promoting a collateral rank requires Manager role authorization (MGRCOLLDOC / BRMGR)."
                ));
            }

            String notes = payload != null && payload.containsKey("reviewNotes")
                    ? payload.get("reviewNotes")
                    : (payload != null && payload.containsKey("notes") ? payload.get("notes") : "Promoted to first-degree priority upon discharge/release of prior charge.");
            Collateral promoted = degreeService.promoteToFirstDegree(id, notes, userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Collateral " + promoted.getCode() + " successfully promoted to First-Degree Priority.",
                    "collateral", promoted
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- Refresh First-Degree Balance (Periodic for External, CBS Sync for Internal) ---
    @PostMapping({"/collaterals/{id}/refresh-first-degree-balance", "/collateral/{id}/refresh-first-degree-balance"})
    public ResponseEntity<?> refreshFirstDegreeBalance(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> payload,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader) {
        try {
            User actor = currentActor();
            userId = actor.getUsername();
            String effRole = actor.getRole().trim().toUpperCase(Locale.ROOT);
            if (!BALANCE_REFRESH_ROLES.contains(effRole.trim().toUpperCase())) {
                return ResponseEntity.status(403).body(Map.of(
                        "success", false,
                        "message", "Access Denied: Updating first-degree balance requires authorized role (CRO / MGRCOLLDOC / COLLDOCOFF)."
                ));
            }

            Double newBalance = null;
            String asOfDate = null;
            if (payload != null) {
                if (payload.containsKey("outstandingBalance")) {
                    newBalance = Double.valueOf(payload.get("outstandingBalance").toString());
                } else if (payload.containsKey("balance")) {
                    newBalance = Double.valueOf(payload.get("balance").toString());
                }
                if (payload.containsKey("asOfDate")) {
                    asOfDate = (String) payload.get("asOfDate");
                }
            }
            Collateral updated = degreeService.refreshFirstDegreeBalance(id, newBalance, asOfDate, userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "First-degree debt balance refreshed successfully for collateral " + updated.getCode() + ".",
                    "collateral", updated
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- Degree Relationship & Exposure Details ---
    @GetMapping({"/collaterals/{id}/degree-details", "/collateral/{id}/degree-details"})
    public ResponseEntity<?> getDegreeDetails(@PathVariable String id) {
        try {
            return ResponseEntity.ok(degreeService.getDegreeDetails(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // --- Promote Second-Degree Link to First-Degree Priority ---
    @PostMapping({"/relationships/{linkId}/promote", "/collateral-facility-links/{linkId}/promote"})
    public ResponseEntity<?> promoteLink(
            @PathVariable String linkId,
            @RequestBody(required = false) Map<String, String> payload,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String userId,
            @RequestHeader(value = "X-User-Role", required = false) String roleHeader) {
        try {
            User actor = currentActor();
            userId = actor.getUsername();
            String effRole = actor.getRole().trim().toUpperCase(Locale.ROOT);
            if (!PROMOTION_ROLES.contains(effRole.trim().toUpperCase())) {
                return ResponseEntity.status(403).body(Map.of(
                        "success", false,
                        "message", "Access Denied: Promoting a relationship link rank requires Manager role authorization (MGRCOLLDOC / BRMGR)."
                ));
            }

            String notes = payload != null && payload.containsKey("reviewNotes")
                    ? payload.get("reviewNotes")
                    : (payload != null && payload.containsKey("notes") ? payload.get("notes") : "Promoted to first-degree priority upon discharge/release of prior charge.");
            com.bank.cims.model.LoanCollateralLink promoted = degreeService.promoteLinkToFirstDegree(linkId, notes, userId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Relationship link " + promoted.getId() + " successfully promoted to First-Degree Priority.",
                    "link", promoted
            ));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    // --- List Collaterals Eligible for Promotion ---
    @GetMapping({"/collaterals/promotion-eligible", "/collateral/promotion-eligible"})
    public ResponseEntity<List<Collateral>> getPromotionEligibleCollaterals() {
        return ResponseEntity.ok(degreeService.getPromotionEligibleCollaterals());
    }
}
