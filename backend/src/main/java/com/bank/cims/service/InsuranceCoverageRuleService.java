package com.bank.cims.service;

import com.bank.cims.model.InsuranceCoverageRule;
import com.bank.cims.model.User;
import com.bank.cims.repository.InsuranceCoverageRuleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InsuranceCoverageRuleService {

    private static final Logger log = LoggerFactory.getLogger(InsuranceCoverageRuleService.class);

    @Autowired
    private InsuranceCoverageRuleRepository insuranceCoverageRuleRepository;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private AuthorizationScopeService authorizationScopeService;

    @Autowired
    private RoleHierarchyService roleHierarchyService;

    private User requireActor() {
        User actor = authorizationScopeService.currentUser();
        if (actor == null || !actor.isActive()
                || actor.getUsername() == null || actor.getUsername().isBlank()
                || actor.getRole() == null || actor.getRole().isBlank()) {
            throw new IllegalStateException("A signed-in user with an assigned role is required for this action.");
        }
        return actor;
    }

    private void assertConfiguredApprover(User actor) {
        String configuredRole = roleHierarchyService.resolveApproverRole(
                "INSURANCE_COVERAGE_RULE", "APPROVE_COVERAGE_RULE");
        if (!roleHierarchyService.isAuthorizedToActOn(actor.getRole(), configuredRole)) {
            throw new IllegalStateException("Your role " + actor.getRole()
                    + " is not authorized to approve coverage rules routed to " + configuredRole + ".");
        }
    }

    public List<InsuranceCoverageRule> getAllRules() {
        return insuranceCoverageRuleRepository.findAll();
    }

    public List<InsuranceCoverageRule> getActiveRules() {
        return insuranceCoverageRuleRepository.findByStatus("Active");
    }

    public Optional<InsuranceCoverageRule> getRuleById(String id) {
        return insuranceCoverageRuleRepository.findById(id);
    }

    /**
     * Resolves the authoritative Credit Policy coverage rule for a given collateral type and business segment.
     * Enforces:
     * 1. Status == 'Active' and Credit Policy Approved
     * 2. Effective date boundaries: effectiveFrom <= today <= effectiveTo (Audit Finding 7)
     * 3. Canonical taxonomy alias resolution for types (Audit Finding 8)
     * 4. Strict deterministic precedence:
     *    a. Exact type + exact segment
     *    b. Canonical type + exact segment
     *    c. Exact/canonical type + 'All' segment
     *    d. 'All' type + exact segment
     *    e. Global fallback: ('All', 'All')
     */
    public Optional<InsuranceCoverageRule> resolveApplicableRule(String collateralType, String businessSegment) {
        if (collateralType == null) collateralType = "All";
        if (businessSegment == null) businessSegment = "All";

        final String type = collateralType.trim();
        final String canonicalType = canonicalCollateralType(type);
        final String segment = businessSegment.trim();
        final String canonicalSeg = canonicalBusinessSegment(segment);
        final LocalDate today = LocalDate.now();

        List<InsuranceCoverageRule> rules = insuranceCoverageRuleRepository.findAll().stream()
                .filter(r -> "Active".equalsIgnoreCase(r.getStatus()))
                .filter(InsuranceCoverageRule::isCreditPolicyApproved)
                .filter(r -> isWithinEffectiveDates(r, today))
                .collect(Collectors.toList());

        // 1. Exact match on both type and segment
        Optional<InsuranceCoverageRule> exact = rules.stream()
                .filter(r -> r.getCollateralType().equalsIgnoreCase(type) && isSegmentMatch(r.getBusinessSegment(), canonicalSeg, segment))
                .findFirst();
        if (exact.isPresent()) return exact;

        // 2. Canonical type match on exact/canonical segment
        Optional<InsuranceCoverageRule> canonicalMatch = rules.stream()
                .filter(r -> isTypeMatch(r.getCollateralType(), canonicalType, type) && isSegmentMatch(r.getBusinessSegment(), canonicalSeg, segment))
                .findFirst();
        if (canonicalMatch.isPresent()) return canonicalMatch;

        // 3. Collateral type match with 'All' segment (exact then canonical)
        Optional<InsuranceCoverageRule> typeAllSeg = rules.stream()
                .filter(r -> r.getCollateralType().equalsIgnoreCase(type) && "All".equalsIgnoreCase(r.getBusinessSegment()))
                .findFirst();
        if (typeAllSeg.isPresent()) return typeAllSeg;

        Optional<InsuranceCoverageRule> canonicalTypeAllSeg = rules.stream()
                .filter(r -> isTypeMatch(r.getCollateralType(), canonicalType, type) && "All".equalsIgnoreCase(r.getBusinessSegment()))
                .findFirst();
        if (canonicalTypeAllSeg.isPresent()) return canonicalTypeAllSeg;

        // 4. 'All' type with specific segment match
        Optional<InsuranceCoverageRule> allTypeSeg = rules.stream()
                .filter(r -> "All".equalsIgnoreCase(r.getCollateralType()) && isSegmentMatch(r.getBusinessSegment(), canonicalSeg, segment))
                .findFirst();
        if (allTypeSeg.isPresent()) return allTypeSeg;

        // 5. Global fallback ('All', 'All')
        return rules.stream()
                .filter(r -> "All".equalsIgnoreCase(r.getCollateralType()) && "All".equalsIgnoreCase(r.getBusinessSegment()))
                .findFirst();
    }

    public static String canonicalBusinessSegment(String segment) {
        if (segment == null || segment.isBlank() || segment.equalsIgnoreCase("All")) return "All";
        String s = segment.trim();
        if (s.equalsIgnoreCase("Corporate") || s.equalsIgnoreCase("Corporate Banking")) {
            return "Corporate Banking";
        }
        if (s.equalsIgnoreCase("Retail") || s.equalsIgnoreCase("Retail Banking")) {
            return "Retail Banking";
        }
        if (s.equalsIgnoreCase("SME") || s.equalsIgnoreCase("SME Banking")) {
            return "SME Banking";
        }
        return s;
    }

    private boolean isSegmentMatch(String ruleSegment, String canonicalTargetSeg, String rawTargetSeg) {
        if (ruleSegment == null) return false;
        if ("All".equalsIgnoreCase(ruleSegment) && "All".equalsIgnoreCase(canonicalTargetSeg)) return true;
        if (ruleSegment.equalsIgnoreCase(rawTargetSeg)) return true;
        String rCanonical = canonicalBusinessSegment(ruleSegment);
        return rCanonical.equalsIgnoreCase(canonicalTargetSeg);
    }

    private boolean isWithinEffectiveDates(InsuranceCoverageRule r, LocalDate today) {
        if (r.getEffectiveFrom() != null && !r.getEffectiveFrom().isBlank()) {
            try {
                LocalDate start = LocalDate.parse(r.getEffectiveFrom().substring(0, 10));
                if (start.isAfter(today)) return false; // Future-dated rule
            } catch (Exception ignored) {}
        }
        if (r.getEffectiveTo() != null && !r.getEffectiveTo().isBlank()) {
            try {
                LocalDate end = LocalDate.parse(r.getEffectiveTo().substring(0, 10));
                if (end.isBefore(today)) return false; // Expired rule
            } catch (Exception ignored) {}
        }
        return true;
    }

    public static String canonicalCollateralType(String type) {
        if (type == null) return "All";
        String t = type.trim().toLowerCase(Locale.ROOT);
        if (t.contains("vehicle") || t.contains("motor") || t.contains("automobile") || t.contains("car") || t.contains("truck")) {
            return "Vehicles";
        }
        if (t.contains("machin") || t.contains("equipment") || t.contains("plant")) {
            return "Construction Machineries";
        }
        if (t.contains("building") || t.contains("property") || t.contains("real estate") || t.contains("immovable")) {
            return "Buildings";
        }
        if (t.contains("merchandise") || t.contains("inventory") || t.contains("stock") || t.contains("goods")) {
            return "Merchandise";
        }
        return type.trim();
    }

    private boolean isTypeMatch(String ruleType, String canonicalTarget, String rawTarget) {
        if (ruleType == null) return false;
        if (ruleType.equalsIgnoreCase(rawTarget)) return true;
        String rCanonical = canonicalCollateralType(ruleType);
        return rCanonical.equalsIgnoreCase(canonicalTarget);
    }

    /**
     * Saves coverage rule under maker-checker dual control (Audit Finding 9).
     * New or modified rules enter 'Pending Approval' unless approved by a distinct checker.
     */
    @Transactional
    public InsuranceCoverageRule saveRule(InsuranceCoverageRule rule, String userId, String userRole) {
        User actor = requireActor();
        final String effectiveUser = actor.getUsername();
        final String effectiveRole = actor.getRole();
        if (rule.getRequiredCoveragePercentage() <= 0) {
            throw new IllegalArgumentException("Required coverage percentage must be greater than 0%.");
        }

        String now = LocalDateTime.now().toString();
        boolean isNew = rule.getId() == null || rule.getId().isBlank();

        if (isNew) {
            rule.setId("cov-rule-" + UUID.randomUUID().toString().substring(0, 8));
            rule.setCreatedAt(now);
            rule.setMakerId(effectiveUser);
            rule.setStatus("Pending Approval");
            rule.setCreditPolicyApproved(false);
            if (rule.getEffectiveFrom() == null || rule.getEffectiveFrom().isBlank()) {
                rule.setEffectiveFrom(LocalDate.now().toString());
            }
        } else {
            InsuranceCoverageRule existing = insuranceCoverageRuleRepository.findById(rule.getId())
                    .orElseThrow(() -> new IllegalArgumentException("Coverage rule not found: " + rule.getId()));
            rule.setCreatedAt(existing.getCreatedAt());
            rule.setMakerId(existing.getMakerId());
            // An edit by maker resets status to Pending Approval
            rule.setStatus("Pending Approval");
            rule.setCreditPolicyApproved(false);
            rule.setCheckerId(null);
            rule.setApprovedBy(null);
            rule.setApprovedAt(null);
        }
        rule.setUpdatedAt(now);

        InsuranceCoverageRule saved = insuranceCoverageRuleRepository.save(rule);
        cimsService.logAudit(effectiveUser, effectiveRole, "SUBMIT_COVERAGE_RULE",
                "InsuranceCoverageRule", saved.getId(), "Status", isNew ? "None" : "Active", "Pending Approval",
                String.format("Submitted Credit Policy coverage rule: %s / %s (%.1f%%) for checker authorization.",
                        saved.getCollateralType(), saved.getBusinessSegment(), saved.getRequiredCoveragePercentage()));
        return saved;
    }

    @Transactional
    public InsuranceCoverageRule approveCoverageRule(String ruleId, String checkerId, String checkerRole) {
        User actor = requireActor();
        assertConfiguredApprover(actor);
        final String effectiveChecker = actor.getUsername();
        InsuranceCoverageRule rule = insuranceCoverageRuleRepository.findById(ruleId)
                .orElseThrow(() -> new IllegalArgumentException("Coverage rule not found: " + ruleId));

        if (effectiveChecker.equalsIgnoreCase(rule.getMakerId())) {
            throw new IllegalStateException("Dual Control Violation: Maker (" + rule.getMakerId() + ") cannot approve their own Credit Policy coverage rule.");
        }

        String now = LocalDateTime.now().toString();
        rule.setStatus("Active");
        rule.setCreditPolicyApproved(true);
        rule.setCheckerId(effectiveChecker);
        rule.setApprovedBy(effectiveChecker);
        rule.setApprovedAt(now);
        rule.setUpdatedAt(now);

        InsuranceCoverageRule saved = insuranceCoverageRuleRepository.save(rule);
        cimsService.logAudit(effectiveChecker, actor.getRole(), "APPROVE_COVERAGE_RULE",
                "InsuranceCoverageRule", saved.getId(), "Status", "Pending Approval", "Active",
                "Approved Credit Policy coverage rule: " + saved.getCollateralType() + " / " + saved.getBusinessSegment());
        return saved;
    }

    @Transactional
    public InsuranceCoverageRule rejectCoverageRule(String ruleId, String checkerId, String checkerRole, String reason) {
        User actor = requireActor();
        assertConfiguredApprover(actor);
        final String effectiveChecker = actor.getUsername();
        InsuranceCoverageRule rule = insuranceCoverageRuleRepository.findById(ruleId)
                .orElseThrow(() -> new IllegalArgumentException("Coverage rule not found: " + ruleId));

        if (effectiveChecker.equalsIgnoreCase(rule.getMakerId())) {
            throw new IllegalStateException("Dual Control Violation: Maker (" + rule.getMakerId() + ") cannot reject their own Credit Policy coverage rule.");
        }

        String now = LocalDateTime.now().toString();
        rule.setStatus("Rejected");
        rule.setCreditPolicyApproved(false);
        rule.setCheckerId(effectiveChecker);
        rule.setUpdatedAt(now);

        InsuranceCoverageRule saved = insuranceCoverageRuleRepository.save(rule);
        cimsService.logAudit(effectiveChecker, actor.getRole(), "REJECT_COVERAGE_RULE",
                "InsuranceCoverageRule", saved.getId(), "Status", "Pending Approval", "Rejected",
                "Rejected Credit Policy coverage rule: " + (reason != null ? reason : "Rejected by checker"));
        return saved;
    }

    @Transactional
    public InsuranceCoverageRule toggleRuleStatus(String id, String userId, String userRole) {
        User actor = requireActor();
        final String effectiveUser = actor.getUsername();
        InsuranceCoverageRule rule = insuranceCoverageRuleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Coverage rule not found: " + id));

        String oldStatus = rule.getStatus();
        String newStatus = "Active".equalsIgnoreCase(oldStatus) ? "Inactive" : "Active";
        if ("Active".equalsIgnoreCase(newStatus)) {
            assertConfiguredApprover(actor);
            if (effectiveUser.equalsIgnoreCase(rule.getMakerId())) {
                throw new IllegalStateException("Dual Control Violation: Maker cannot activate their own Credit Policy coverage rule.");
            }
            rule.setCreditPolicyApproved(true);
            rule.setCheckerId(effectiveUser);
            rule.setApprovedBy(effectiveUser);
            rule.setApprovedAt(LocalDateTime.now().toString());
        } else {
            rule.setCreditPolicyApproved(false);
        }
        rule.setStatus(newStatus);
        rule.setUpdatedAt(LocalDateTime.now().toString());
        InsuranceCoverageRule saved = insuranceCoverageRuleRepository.save(rule);

        cimsService.logAudit(effectiveUser, actor.getRole(), "TOGGLE_RULE_STATUS",
                "InsuranceCoverageRule", saved.getId(), "Status", oldStatus, newStatus,
                "Toggled coverage rule status to " + newStatus);
        return saved;
    }
}
