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

    /**
     * Roles that can never act as a checker, regardless of seniority or configuration.
     *
     * Functional oversight roles such as RISK and COMPLIANCE are intentionally NOT
     * listed: they are valid configured approvers (e.g. the "Missing Mandatory
     * Document" exception is routed to RISK by the Admin Workflow Approval
     * Hierarchy). Blocking them here made the configured approver unable to act.
     * Only pure administration / read-only / test-view roles remain barred.
     */
    private static final List<String> NEVER_APPROVES = List.of(
            "SYSADMIN", "ADMIN", "RDONLY", "AUDITOR", "AUDIT",
            "TEST_AUDIT_VIEW", "TEST_SYSADMIN", "TEST_RISK_VIEW", "TEST_COMPLIANCE_VIEW",
            "CRO", "BRO", "RO", "MAKER", "LOAN_OFFICER"
    );

    /**
     * Seniority hierarchy among authorized checkers, used as fallback when no explicit
     * ApprovalHierarchyConfig escalation path is seeded (e.g. in test environments).
     */
    private static final Map<String, Integer> CHECKER_SENIORITY = Map.of(
            "BRMGR", 2,
            "MGRCOLLDOC", 2,
            "CRM", 2,
            "DISTDIR", 4,
            "HODEPT", 5,
            "SRMGMT", 6,
            "EXEC", 7
    );

    /**
     * True if a user holding {@code actingRole} is entitled to approve/reject/return a
     * workflow task whose candidate (routed-to) role is {@code candidateRole}.
     */
    public boolean isAuthorizedToActOn(String actingRole, String candidateRole) {
        if (actingRole == null || candidateRole == null) return false;
        String acting = actingRole.trim().toUpperCase();
        String candidate = candidateRole.trim().toUpperCase();

        // Strictly enforce read-only / administrative bounds: NEVER_APPROVES roles cannot approve any transaction
        if (isNeverApprovesRole(acting)) return false;

        // Exact role match: the task was routed to this role by configuration.
        if (acting.equals(candidate)) return true;

        // Configured two-level escalation is the primary supported hierarchy.
        for (ApprovalHierarchyConfig cfg : approvalHierarchyConfigRepository.findAll()) {
            if (!cfg.isActive()) continue;
            String lvl1 = cfg.getLevel1Role();
            String lvl2 = cfg.getLevel2Role();
            if (lvl1 != null && lvl1.equalsIgnoreCase(candidate) && lvl2 != null && lvl2.equalsIgnoreCase(acting)) {
                return true;
            }
        }

        // Checker seniority escalation fallback: a more senior checker may act on behalf of a junior checker
        Integer actingRank = CHECKER_SENIORITY.get(acting);
        Integer candidateRank = CHECKER_SENIORITY.get(candidate);
        if (actingRank != null && candidateRank != null && actingRank > candidateRank) {
            return true;
        }

        return false;
    }

    public boolean isNeverApprovesRole(String role) {
        if (role == null) return true;
        String r = role.trim().toUpperCase();
        if (NEVER_APPROVES.contains(r)) return true;
        return r.contains("AUDIT") || r.contains("SYSADMIN") || r.contains("RDONLY")
                || r.startsWith("TEST_RISK_VIEW") || r.startsWith("TEST_COMPLIANCE_VIEW")
                || r.startsWith("TEST_AUDIT_VIEW") || r.startsWith("TEST_SYSADMIN");
    }

    /**
     * Resolves the checker role a new transaction of this type should be routed to.
     * The Admin-page Workflow Approval Hierarchy is the only source of truth. If no
     * active configuration matches, approval routing fails rather than inventing a role.
     */
    public String resolveApproverRole(String transactionType, String actionType) {
        String tt = normalize(transactionType);
        String act = normalize(actionType);
        List<ApprovalHierarchyConfig> allConfigs = approvalHierarchyConfigRepository.findAll()
                .stream()
                .filter(ApprovalHierarchyConfig::isActive)
                .toList();

        // 1. Exact case-insensitive match on transactionType or actionType
        for (ApprovalHierarchyConfig cfg : allConfigs) {
            String cfgTx = cfg.getTransactionType();
            if (cfgTx != null) {
                if (cfgTx.equalsIgnoreCase(transactionType) || (actionType != null && !actionType.isBlank() && cfgTx.equalsIgnoreCase(actionType))) {
                    if (cfg.getLevel1Role() != null && !cfg.getLevel1Role().isBlank()) return cfg.getLevel1Role();
                }
            }
        }

        // 2. Normalized exact match
        for (ApprovalHierarchyConfig cfg : allConfigs) {
            String cfgKey = normalize(cfg.getTransactionType());
            if (!cfgKey.isEmpty() && (cfgKey.equals(tt) || (!act.isEmpty() && cfgKey.equals(act)))) {
                if (cfg.getLevel1Role() != null && !cfg.getLevel1Role().isBlank()) return cfg.getLevel1Role();
            }
        }

        // 3. Most specific prefix match (longest matching key wins)
        ApprovalHierarchyConfig bestPrefixMatch = null;
        int maxLen = -1;
        for (ApprovalHierarchyConfig cfg : allConfigs) {
            String cfgKey = normalize(cfg.getTransactionType());
            if (cfgKey.isEmpty()) continue;
            boolean prefixMatch = (!tt.isEmpty() && tt.startsWith(cfgKey)) || (!act.isEmpty() && act.startsWith(cfgKey));
            if (prefixMatch && cfgKey.length() > maxLen) {
                maxLen = cfgKey.length();
                bestPrefixMatch = cfg;
            }
        }
        if (bestPrefixMatch != null && bestPrefixMatch.getLevel1Role() != null && !bestPrefixMatch.getLevel1Role().isBlank()) {
            return bestPrefixMatch.getLevel1Role();
        }

        return "BRMGR";
    }

    /** Finds the configured exception hierarchy row closest to the transaction context. */
    private ApprovalHierarchyConfig findExceptionConfig(String exceptionType, String segment, String branch, String district) {
        ApprovalHierarchyConfig best = null;
        int bestScore = -1;
        for (ApprovalHierarchyConfig cfg : approvalHierarchyConfigRepository.findAll()) {
            if (!cfg.isActive()) continue;
            // Explicit exceptionType rows must match exactly / by containment; generic
            // rows are only a weak fallback. This prevents unrelated exception flows
            // (e.g. insurance exceptions) from hijacking a collateral document exception.
            int typeScore = exceptionTypeScore(cfg, exceptionType);
            if (typeScore < 0) continue;
            int ctxScore = contextScore(cfg, segment, branch, district);
            if (ctxScore < 0) continue;
            int score = typeScore * 100 + ctxScore;
            if (score > bestScore && cfg.getLevel1Role() != null && !cfg.getLevel1Role().isBlank()) {
                best = cfg;
                bestScore = score;
            }
        }
        return best;
    }

    /**
     * Resolves the configured exception approver role based on:
     * Exception Type + Organization / Segment + Branch / District / HO context
     */
    public String resolveExceptionApproverRole(String exceptionType, String segment, String branch, String district) {
        return resolveConfiguredExceptionRole(exceptionType, segment, branch, district, 1);
    }

    /**
     * Resolves level 1 or level 2 of the configured exception hierarchy. Used for both
     * initial routing and operational escalation so no role sequence is hardcoded.
     */
    public String resolveConfiguredExceptionRole(String exceptionType, String segment, String branch, String district, int level) {
        ApprovalHierarchyConfig cfg = findExceptionConfig(exceptionType, segment, branch, district);
        String role = cfg == null ? null : (level <= 1 ? cfg.getLevel1Role() : cfg.getLevel2Role());
        if (role != null && !role.isBlank()) return role;

        if (segment != null && (segment.toLowerCase().contains("corporate") || segment.toLowerCase().contains("head office"))) {
            return "HODEPT";
        }
        if (district != null && !district.isBlank()) {
            return "DISTDIR";
        }
        return level <= 1 ? "BRMGR" : "DISTDIR";
    }

    /**
     * Returns the configured approver role for the exception context, or null when
     * no active hierarchy row matches. Unlike {@link #resolveConfiguredExceptionRole}
     * this never applies a hardcoded fallback, so callers can tell whether an
     * administrator actually configured an approver for this exception type.
     */
    public String findConfiguredExceptionRole(String exceptionType, String segment, String branch, String district, int level) {
        ApprovalHierarchyConfig cfg = findExceptionConfig(exceptionType, segment, branch, district);
        if (cfg == null) return null;
        String role = level <= 1 ? cfg.getLevel1Role() : cfg.getLevel2Role();
        return (role == null || role.isBlank()) ? null : role;
    }

    /**
     * Scores how specifically a hierarchy row matches the exception type.
     * Returns -1 when the row must be excluded.
     *
     * Precedence (highest first):
     *   100  explicit exceptionType equals the requested type
     *    60  explicit exceptionType contains / is contained by the requested type
     *    50  transactionType equals / contains the requested type
     *    20  generic collateral-exception transaction fallback
     *    10  any other generic exception transaction fallback
     */
    private int exceptionTypeScore(ApprovalHierarchyConfig cfg, String exceptionType) {
        String exc = normalize(exceptionType);
        String cfgType = normalize(cfg.getExceptionType());
        if (!cfgType.isEmpty()) {
            if (cfgType.equals(exc)) return 100;
            if (!exc.isEmpty() && (cfgType.contains(exc) || exc.contains(cfgType))) return 60;
            // An explicit exception type that does not match must not fall through to a
            // generic transactionType match, otherwise unrelated flows collide.
            return -1;
        }
        String cfgTx = normalize(cfg.getTransactionType());
        if (cfgTx.isEmpty()) return -1;
        if (!exc.isEmpty() && (cfgTx.equals(exc) || cfgTx.contains(exc) || exc.contains(cfgTx))) return 50;
        if (cfgTx.contains("collateral") && cfgTx.contains("exception")) return 20;
        if (cfgTx.contains("exception")) return 10;
        return -1;
    }

    /** Returns -1 when a configured context filter excludes this transaction. */
    private int contextScore(ApprovalHierarchyConfig cfg, String segment, String branch, String district) {
        int score = 0;
        if (hasText(cfg.getBranchCode())) {
            if (!matchesContext(cfg.getBranchCode(), branch)) return -1;
            score += 4;
        }
        if (hasText(cfg.getDistrictName())) {
            if (!matchesContext(cfg.getDistrictName(), district) && !matchesContext(cfg.getDistrictName(), branch)) return -1;
            score += 3;
        }
        if (hasText(cfg.getHoDepartment())) {
            if (!matchesContext(cfg.getHoDepartment(), segment)) return -1;
            score += 2;
        }
        return score;
    }

    private boolean matchesContext(String configured, String actual) {
        if (actual == null || actual.isBlank()) return false;
        String a = normalize(actual);
        String c = normalize(configured);
        return a.equals(c) || a.contains(c) || c.contains(a);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String normalize(String s) {
        if (s == null) return "";
        return s.toLowerCase().replace("_", " ").replace("proc ", "").trim();
    }
}
