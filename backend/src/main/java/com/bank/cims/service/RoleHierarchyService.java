package com.bank.cims.service;

import com.bank.cims.model.ApprovalHierarchyConfig;
import com.bank.cims.repository.ApprovalHierarchyConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Single source of truth for "can role X act as checker for a task routed to role Y".
 *
 * Previously this decision was made twice, in two different places, with two different
 * rules:
 *   - WorkflowAuthorizationService.assertCanApprove() allowed a hand-picked list of
 *     "senior" roles to approve on behalf of a junior candidate role.
 *   - CimsService.approveWorkflowTask()/rejectWorkflowTask()/returnWorkflowTask() then
 *     re-checked with STRICT equality (checkerRole must literally equal candidateRole).
 *
 * Because the second check was stricter than the first, any hierarchical approval (e.g. a
 * District Director approving a task routed to Branch Manager) passed the first gate and
 * was then rejected by the second with a confusing "not authorized" error. That
 * inconsistency is almost certainly what surfaced as "approval doesn't work". This class
 * replaces both call sites so there is exactly one rule, driven by configuration instead
 * of a hardcoded list.
 */
@Service
public class RoleHierarchyService {

    @Autowired
    private ApprovalHierarchyConfigRepository approvalHierarchyConfigRepository;

    /** Roles that can never act as a checker, regardless of seniority. */
    private static final List<String> NEVER_APPROVES = List.of("SYSADMIN", "RDONLY", "AUDITOR");

    /**
     * Fallback organizational seniority, used when no ApprovalHierarchyConfig entry
     * defines a level2Role escalation path for the transaction. Higher number = more
     * senior. Roles absent from this map are treated as non-approving front-line roles
     * (seniority 0) unless they exactly match the candidate role.
     */
    private static final Map<String, Integer> SENIORITY = Map.ofEntries(
            Map.entry("BRO", 1),
            Map.entry("CRO", 1),
            Map.entry("SRM", 1),
            Map.entry("BRM", 1),
            Map.entry("COLLDOCOFF", 1),
            Map.entry("BRMGR", 2),
            Map.entry("MGRCOLLDOC", 2),
            Map.entry("COMPLIANCE", 3),
            Map.entry("RISK", 3),
            Map.entry("DISTDIR", 4),
            Map.entry("HODEPT", 5),
            Map.entry("SRMGMT", 6),
            Map.entry("EXEC", 7)
    );

    /**
     * True if a user holding {@code actingRole} is entitled to approve/reject/return a
     * workflow task whose candidate (routed-to) role is {@code candidateRole}.
     */
    public boolean isAuthorizedToActOn(String actingRole, String candidateRole) {
        if (actingRole == null || candidateRole == null) return false;
        String acting = actingRole.trim().toUpperCase();
        String candidate = candidateRole.trim().toUpperCase();

        if (NEVER_APPROVES.contains(acting)) return false;

        // Exact role match is always allowed.
        if (acting.equals(candidate)) return true;

        // Configured two-level escalation for this specific candidate role: if any active
        // hierarchy config names `acting` as the level-2 escalation role above `candidate`,
        // allow it explicitly - this is what the Admin > Approval Hierarchy screen controls.
        for (ApprovalHierarchyConfig cfg : approvalHierarchyConfigRepository.findAll()) {
            if (!cfg.isActive()) continue;
            String lvl1 = cfg.getLevel1Role();
            String lvl2 = cfg.getLevel2Role();
            if (lvl1 != null && lvl1.equalsIgnoreCase(candidate) && lvl2 != null && lvl2.equalsIgnoreCase(acting)) {
                return true;
            }
        }

        // Otherwise fall back to general organizational seniority: a more senior role may
        // always stand in for a more junior candidate role (e.g. a District Director can
        // clear a task routed to a Branch Manager).
        Integer actingRank = SENIORITY.get(acting);
        Integer candidateRank = SENIORITY.get(candidate);
        if (actingRank == null || candidateRank == null) return false;
        return actingRank > candidateRank;
    }

    /**
     * Resolves the checker role a new transaction of this type should be routed to,
     * looking up the Admin-configured Approval Hierarchy first and only falling back to
     * {@code fallbackRole} when no active configuration matches.
     */
    public String resolveApproverRole(String transactionType, String actionType, String fallbackRole) {
        String tt = normalize(transactionType);
        String act = normalize(actionType);
        for (ApprovalHierarchyConfig cfg : approvalHierarchyConfigRepository.findAll()) {
            if (!cfg.isActive()) continue;
            String cfgKey = normalize(cfg.getTransactionType());
            if (cfgKey.isEmpty()) continue;
            boolean matches = (cfg.getTransactionType() != null &&
                    (cfg.getTransactionType().equalsIgnoreCase(transactionType) || cfg.getTransactionType().equalsIgnoreCase(actionType)))
                    || (!tt.isEmpty() && (cfgKey.contains(tt) || tt.contains(cfgKey)))
                    || (!act.isEmpty() && (cfgKey.contains(act) || act.contains(cfgKey)));
            if (matches && cfg.getLevel1Role() != null && !cfg.getLevel1Role().isBlank()) {
                return cfg.getLevel1Role();
            }
        }
        return (fallbackRole == null || fallbackRole.isBlank()) ? "BRMGR" : fallbackRole;
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase().replace("_", " ").replace("proc ", "").trim();
    }
}
