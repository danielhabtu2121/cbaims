package com.bank.cims.service;

import com.bank.cims.model.RolePermission;
import com.bank.cims.model.User;
import com.bank.cims.model.WorkflowTask;
import com.bank.cims.repository.RolePermissionRepository;
import com.bank.cims.repository.UserRepository;
import com.bank.cims.repository.WorkflowTaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class WorkflowAuthorizationService {
    @Autowired private UserRepository userRepository;
    @Autowired private RolePermissionRepository rolePermissionRepository;
    @Autowired private WorkflowTaskRepository workflowTaskRepository;
    @Autowired private RoleHierarchyService roleHierarchyService;
    @Autowired private com.bank.cims.repository.ApprovalHistoryRepository approvalHistoryRepository;

    /**
     * Verifies that {@code userId} is entitled to approve, reject, or return the given
     * workflow task and returns the resolved User record. Every rule here is enforced
     * exactly once - see RoleHierarchyService for why that matters.
     */
    public User assertCanApprove(String userId, String taskId) {
        User user = findUser(userId);
        if (user == null || !user.isActive()) {
            throw new IllegalStateException("Checker account is not active or could not be identified.");
        }
        WorkflowTask task = workflowTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalStateException("Workflow task not found: " + taskId));
        if (!"Pending".equalsIgnoreCase(task.getStatus())) {
            throw new IllegalStateException("Workflow task is no longer pending.");
        }

        // Four-Eyes Principle: a user can never authorize their own submission, no matter
        // their seniority. Checked here (in addition to CimsService) so every workflow
        // action - including any future direct callers - is protected consistently.
        if (isSamePerson(task.getMakerId(), user)) {
            throw new IllegalStateException("Dual-Control Violation: Maker (" + task.getMakerId() + ") cannot authorize their own submission. Segregation of duties (Four-Eyes Principle) strictly requires an independent Checker.");
        }

        // Multi-Level Four-Eyes Principle: Level 1 approver cannot also approve Level 2
        if ("Level 2 Review".equalsIgnoreCase(task.getCurrentStep()) && approvalHistoryRepository != null) {
            boolean alreadyApprovedLevel1 = approvalHistoryRepository.findByWorkflowTaskIdOrderByDecidedAtDesc(taskId).stream()
                    .anyMatch(h -> "Approved".equalsIgnoreCase(h.getDecision()) && isSamePerson(h.getActorId(), user));
            if (alreadyApprovedLevel1) {
                throw new IllegalStateException("Dual-Control Violation: You have already authorized Level 1 for this transaction. Secondary Level 2 authorization must be completed by an independent " + task.getCandidateRole() + " reviewer.");
            }
        }

        // Check NEVER_APPROVES restriction first
        if (roleHierarchyService.isNeverApprovesRole(user.getRole())) {
            throw new IllegalStateException("Role " + user.getRole() + " is a non-approving governance/read-only role and is strictly prohibited from approving transactions.");
        }

        if (task.getCandidateRole() != null && !roleHierarchyService.isAuthorizedToActOn(user.getRole(), task.getCandidateRole())) {
            throw new IllegalStateException("User role " + user.getRole() + " is not authorized for candidate role " + task.getCandidateRole() + ".");
        }

        List<RolePermission> permissions = rolePermissionRepository.findByRoleCodeIgnoreCaseAndScreenNameIgnoreCase(user.getRole(), "Approvals");
        if (!permissions.isEmpty()) {
            List<RolePermission> activePerms = permissions.stream().filter(RolePermission::isActive).toList();
            if (activePerms.isEmpty() || !activePerms.get(0).isCanApprove()) {
                throw new IllegalStateException("User does not have approval permission for the Approvals module (permission inactive or approval not granted).");
            }
        }
        // No hardcoded approver allow-list: when no explicit module permission row exists,
        // authority is decided solely by the configured workflow hierarchy check above.
        return user;
    }

    private boolean isSamePerson(String makerId, User checker) {
        if (makerId == null || checker == null) return false;
        String maker = normalizeIdentity(makerId);
        String checkerUsername = normalizeIdentity(checker.getUsername());
        String checkerId = normalizeIdentity(checker.getId());
        return !maker.isEmpty() && (maker.equals(checkerUsername) || maker.equals(checkerId));
    }

    /** Normalizes ids such as usr-cro and usernames such as cro_user to the same person key. */
    private String normalizeIdentity(String value) {
        if (value == null || value.isBlank()) return "";
        return value.trim().toLowerCase()
                .replace("_user", "")
                .replaceFirst("^usr[-_ ]?", "")
                .replace("-", "");
    }

    public User findUser(String value) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        Optional<User> id = userRepository.findById(v);
        if (id.isPresent()) return id.get();
        Optional<User> username = userRepository.findByUsername(v);
        if (username.isPresent()) return username.get();

        for (User u : userRepository.findAll()) {
            if (u.getUsername() != null && u.getUsername().equalsIgnoreCase(v)) return u;
            if (u.getId() != null && u.getId().equalsIgnoreCase(v)) return u;
        }

        if (v.toLowerCase().endsWith("_user")) {
            String base = v.substring(0, v.length() - 5);
            for (User u : userRepository.findAll()) {
                if (u.getUsername() != null && (u.getUsername().equalsIgnoreCase(base) || u.getUsername().equalsIgnoreCase(base + "_user"))) return u;
                if (u.getRole() != null && u.getRole().equalsIgnoreCase(base)) return u;
            }
        }

        return null;
    }
}
