package com.bank.cims.controller;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.*;
import com.bank.cims.service.dms.DmsStorageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminConfigController {

    @Autowired
    private BusinessSegmentRepository businessSegmentRepository;

    @Autowired
    private jakarta.servlet.http.HttpServletRequest httpRequest;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RolePermissionRepository rolePermissionRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private ApprovalHierarchyConfigRepository approvalHierarchyConfigRepository;

    @Autowired
    private ReminderScheduleRepository reminderScheduleRepository;

    @Autowired
    private ReminderConfigurationService reminderConfigurationService;

    @Autowired
    private ScheduledReportRepository scheduledReportRepository;

    @Autowired
    private ApprovedInsurerRepository approvedInsurerRepository;

    @Autowired
    private CollateralTaxonomyRepository collateralTaxonomyRepository;

    @Autowired
    private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;

    @Autowired
    private EscalationRuleRepository escalationRuleRepository;

    @Autowired
    private NotificationTemplateRepository notificationTemplateRepository;

    @Autowired
    private DistrictHierarchyRepository districtHierarchyRepository;

    @Autowired
    private HolidayCalendarRepository holidayCalendarRepository;

    @Autowired
    private SystemParameterRepository systemParameterRepository;

    @Autowired
    private CimsService cimsService;

    @Autowired
    private ConfigurationService configurationService;

    @Autowired
    private BusinessCalendarService businessCalendarService;

    @Autowired
    private com.bank.cims.service.NotificationService notificationService;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Autowired
    private AuthService authService;

    @Autowired
    private NotificationTemplateService notificationTemplateService;

    @Autowired
    private RenewalEscalationService renewalEscalationService;

    @Autowired
    private DmsStorageService dmsStorageService;

    @Autowired
    private OrganizationalUnitRepository organizationalUnitRepository;

    @Autowired
    private CbsBranchMappingRepository cbsBranchMappingRepository;

    @Autowired
    private CbsSegmentMappingRepository cbsSegmentMappingRepository;

    @Autowired
    private BranchSegmentAssignmentRepository branchSegmentAssignmentRepository;

    @Autowired
    private UserOrgAssignmentRepository userOrgAssignmentRepository;

    @Autowired
    private PortfolioAssignmentRepository portfolioAssignmentRepository;

    @Autowired
    private PortfolioAssignmentHistoryRepository portfolioAssignmentHistoryRepository;

    @Autowired
    private UnassignedRecordRepository unassignedRecordRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    /**
     * Resolves the acting administrator from the verified token identity only.
     * Caller-supplied header/parameter values and default personas are never used.
     */
    private String resolveAndVerifyAdminUser(String headerUserId, String paramUserId) {
        if (httpRequest != null) {
            User authUser = (User) httpRequest.getAttribute("authenticatedUser");
            if (authUser != null && authUser.isActive()
                    && authUser.getUsername() != null && !authUser.getUsername().isBlank()) {
                return authUser.getUsername();
            }
        }
        throw new AccessDeniedException("An authenticated system administrator is required for this configuration change.");
    }

    // --- Business Segments ---
    @GetMapping("/segments")
    public List<BusinessSegment> getSegments() {
        return businessSegmentRepository.findAll();
    }

    @PostMapping("/segments/save")
    public ResponseEntity<BusinessSegment> saveSegment(
            @RequestBody BusinessSegment segment,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (segment.getName() == null || segment.getName().trim().isBlank()) {
            throw new IllegalArgumentException("Business segment name is mandatory.");
        }
        if (segment.getId() == null || segment.getId().isBlank()) {
            segment.setId("seg-" + UUID.randomUUID().toString().substring(0, 8));
        }
        BusinessSegment saved = businessSegmentRepository.save(segment);
        cimsService.logAudit(actor, "SYSADMIN", "SAVE_BUSINESS_SEGMENT", "BusinessSegment", saved.getId(), "Segment", "Old", saved.getName(), "Saved segment " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/segments/{id}/toggle-status")
    public ResponseEntity<Map<String, Object>> toggleSegmentStatus(
            @PathVariable String id,
            @RequestParam boolean active,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        businessSegmentRepository.findById(id).ifPresent(s -> {
            s.setActive(active);
            businessSegmentRepository.save(s);
            cimsService.logAudit(actor, "SYSADMIN", "TOGGLE_SEGMENT_STATUS", "BusinessSegment", id, "Active", String.valueOf(!active), String.valueOf(active), "Toggled business segment active status");
        });
        return ResponseEntity.ok(Map.of("success", true));
    }

    // --- Users ---
    @GetMapping("/users")
    public List<Map<String,Object>> getUsers() {
        return userRepository.findAll().stream().map(this::safeUser).toList();
    }

    private Map<String,Object> safeUser(User u) {
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("fullName", u.getFullName());
        m.put("name", u.getFullName());
        m.put("email", u.getEmail());
        m.put("phone", u.getPhone());
        m.put("role", u.getRole());
        m.put("branch", u.getBranch());
        m.put("segment", u.getSegment());
        m.put("active", u.isActive());
        m.put("isAdmin", u.getRole() != null && (u.getRole().toUpperCase(Locale.ROOT).contains("SYSADMIN") || u.getRole().equalsIgnoreCase("ADMIN") || u.getRole().toUpperCase(Locale.ROOT).endsWith("_ADMIN")));
        if (u.getSegmentIds() != null && !u.getSegmentIds().isBlank()) {
            String raw = u.getSegmentIds().trim();
            if (raw.startsWith("[") && raw.endsWith("]")) {
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    List<String> parsed = mapper.readValue(raw, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
                    m.put("segmentIds", parsed);
                } catch (Exception ignored) {
                    m.put("segmentIds", Arrays.stream(raw.replace("[", "").replace("]", "").replace("\"", "").split(","))
                            .map(String::trim).filter(s -> !s.isEmpty()).toList());
                }
            } else {
                m.put("segmentIds", Arrays.stream(raw.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList());
            }
        } else if (u.getSegment() != null && !u.getSegment().isBlank()) {
            m.put("segmentIds", List.of(u.getSegment()));
        } else {
            m.put("segmentIds", List.of());
        }
        return m;
    }

    @PostMapping("/users/save")
    public ResponseEntity<User> saveUser(
            @RequestBody User user,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (user.getUsername() == null || user.getUsername().isBlank()) throw new IllegalArgumentException("Username is mandatory.");
        String cleanUsername = user.getUsername().trim();
        user.setUsername(cleanUsername);

        // Verify username uniqueness across other users
        Optional<User> byUsername = userRepository.findByUsernameIgnoreCase(cleanUsername);
        if (user.getId() == null || user.getId().isBlank()) {
            if (byUsername.isPresent()) {
                user.setId(byUsername.get().getId());
            } else {
                user.setId("usr-" + UUID.randomUUID().toString().substring(0, 8));
            }
        } else if (byUsername.isPresent() && !byUsername.get().getId().equalsIgnoreCase(user.getId())) {
            throw new IllegalArgumentException("Username '" + cleanUsername + "' is already taken by another user.");
        }

        // Handle password hashing & policy validation
        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            String rawPwd = user.getPassword().trim();
            if (!rawPwd.startsWith("$2a$") && !rawPwd.startsWith("$2b$") && !rawPwd.startsWith("$2y$")) {
                authService.validatePasswordPolicy(rawPwd);
                user.setPassword(passwordEncoder.encode(rawPwd));
            }
        } else {
            Optional<User> existing = userRepository.findById(user.getId());
            if (existing.isPresent() && existing.get().getPassword() != null && !existing.get().getPassword().isBlank()) {
                user.setPassword(existing.get().getPassword());
            } else {
                user.setPassword(passwordEncoder.encode("password123"));
            }
        }

        if (user.getFullName() == null || user.getFullName().isBlank()) {
            user.setFullName(user.getUsername());
        }
        if (user.getRole() == null || user.getRole().isBlank()) {
            user.setRole("CRO");
        }
        if (user.getBranch() == null || user.getBranch().isBlank()) {
            user.setBranch("Bole Special Branch");
        }
        if (user.getSegment() == null || user.getSegment().isBlank()) {
            user.setSegment("Corporate Banking");
        }
        if (user.getSegmentIds() == null || user.getSegmentIds().isBlank()) {
            user.setSegmentIds(user.getSegment());
        }
        User saved = userRepository.save(user);
        cimsService.logAudit(actor, "SYSADMIN", "SAVE_USER", "User", saved.getId(), "All", "Old", saved.getUsername(), "Saved user " + saved.getUsername());
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/users/{id}/toggle-status")
    public ResponseEntity<Map<String, Object>> toggleUserStatus(
            @PathVariable String id,
            @RequestParam boolean active,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        Optional<User> userOpt = userRepository.findById(id).or(() -> userRepository.findByUsername(id));
        userOpt.ifPresent(u -> {
            u.setActive(active);
            userRepository.save(u);
            cimsService.logAudit(actor, "SYSADMIN", "TOGGLE_USER_STATUS", "User", u.getId(), "Active", String.valueOf(!active), String.valueOf(active), "Toggled user active status");
        });
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/users/{id}/send-email")
    public ResponseEntity<?> sendUserTestEmail(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> bodyMap,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        String subject = bodyMap != null ? bodyMap.get("subject") : null;
        String body = bodyMap != null ? bodyMap.get("body") : null;
        try {
            Map<String, Object> res = notificationService.sendAdminTestEmail(actor, id, subject, body);
            return ResponseEntity.ok(res);
        } catch (SecurityException se) {
            return ResponseEntity.status(403).body(Map.of("success", false, "error", se.getMessage()));
        } catch (IllegalArgumentException iae) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", iae.getMessage()));
        }
    }

    // --- Role Permissions ---
    @GetMapping("/permissions")
    public List<RolePermission> getPermissions() {
        return rolePermissionRepository.findAll();
    }

    @PostMapping("/permissions/save")
    public ResponseEntity<RolePermission> savePermission(
            @RequestBody RolePermission permission,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (permission.getRoleCode() == null || permission.getRoleCode().isBlank()) throw new IllegalArgumentException("Role code is mandatory.");
        if (permission.getScreenName() == null || permission.getScreenName().isBlank()) throw new IllegalArgumentException("Screen name is mandatory.");

        if (permission.getId() == null || permission.getId().isBlank()) {
            List<RolePermission> existing = rolePermissionRepository.findByRoleCodeAndScreenName(permission.getRoleCode(), permission.getScreenName());
            if (!existing.isEmpty()) {
                permission.setId(existing.get(0).getId());
            } else {
                permission.setId("perm-" + permission.getRoleCode().toLowerCase() + "-" + permission.getScreenName().toLowerCase().replaceAll("\\s+", ""));
            }
        }
        RolePermission saved = rolePermissionRepository.save(permission);
        cimsService.logAudit(actor, "SYSADMIN", "SAVE_ROLE_PERMISSION", "RolePermission", saved.getId(), "Permission", "Old", saved.getRoleCode() + ":" + saved.getScreenName(), "Updated role permission");
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/permissions/save-batch")
    public ResponseEntity<List<RolePermission>> savePermissionsBatch(
            @RequestBody List<RolePermission> permissions,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        for (RolePermission p : permissions) {
            if (p.getId() == null || p.getId().isBlank()) {
                List<RolePermission> existing = rolePermissionRepository.findByRoleCodeAndScreenName(p.getRoleCode(), p.getScreenName());
                if (!existing.isEmpty()) {
                    p.setId(existing.get(0).getId());
                } else {
                    p.setId("perm-" + p.getRoleCode().toLowerCase() + "-" + p.getScreenName().toLowerCase().replaceAll("\\s+", ""));
                }
            }
        }
        List<RolePermission> saved = rolePermissionRepository.saveAll(permissions);
        cimsService.logAudit(actor, "SYSADMIN", "SAVE_ROLE_PERMISSIONS_BATCH", "RolePermission", "BATCH", "Permissions", "Old", "Count: " + saved.size(), "Batch updated " + saved.size() + " role permissions");
        return ResponseEntity.ok(saved);
    }

    // --- Branches Hierarchy ---
    @GetMapping("/branches")
    public List<Branch> getBranches() {
        return branchRepository.findAll();
    }

    @PostMapping("/branches/save")
    public ResponseEntity<Branch> saveBranch(
            @RequestBody Branch branch,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (branch.getCode() == null || branch.getCode().trim().isBlank()) throw new IllegalArgumentException("Branch code is mandatory.");
        if (branch.getName() == null || branch.getName().trim().isBlank()) throw new IllegalArgumentException("Branch name is mandatory.");

        if (branch.getId() == null || branch.getId().isBlank()) {
            branch.setId("brn-" + UUID.randomUUID().toString().substring(0, 8));
        }
        Branch saved = branchRepository.save(branch);
        cimsService.logAudit(actor, "SYSADMIN", "SAVE_BRANCH", "Branch", saved.getId(), "Branch", "Old", saved.getCode(), "Saved branch " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    // --- Approval Hierarchies (Audit Finding 31) ---
    @GetMapping("/approval-configs")
    public List<ApprovalHierarchyConfig> getApprovalConfigs() {
        return approvalHierarchyConfigRepository.findAll();
    }

    @PostMapping("/approval-configs/save")
    public ResponseEntity<ApprovalHierarchyConfig> saveApprovalConfig(
            @RequestBody ApprovalHierarchyConfig config,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (config.getTransactionType() == null || config.getTransactionType().isBlank()) {
            throw new IllegalArgumentException("Transaction type is mandatory.");
        }
        if (config.getLevel1Role() == null || config.getLevel1Role().isBlank()) {
            throw new IllegalArgumentException("Level 1 checker role is mandatory.");
        }
        if ("SYSADMIN".equalsIgnoreCase(config.getLevel1Role()) || "SYSADMIN".equalsIgnoreCase(config.getLevel2Role())) {
            throw new IllegalArgumentException("System Administrator cannot be configured as a transactional checker.");
        }
        if (config.getApprovalLevels() < 1 || config.getApprovalLevels() > 2) {
            throw new IllegalArgumentException("Approval levels must be 1 or 2.");
        }
        if (config.getApprovalLevels() == 2) {
            if (config.getLevel2Role() == null || config.getLevel2Role().trim().isBlank()) {
                throw new IllegalArgumentException("Level 2 checker role is mandatory when 2 approval levels are configured.");
            }
            if (config.getLevel1Role().trim().equalsIgnoreCase(config.getLevel2Role().trim())) {
                throw new IllegalArgumentException("Level 1 and Level 2 checker roles must be distinct for dual-control separation.");
            }
        }

        List<String> knownRoles = rolePermissionRepository.findAll().stream()
                .filter(RolePermission::isActive)
                .map(RolePermission::getRoleCode)
                .distinct()
                .toList();
        if (!knownRoles.isEmpty()) {
            if (knownRoles.stream().noneMatch(r -> r.equalsIgnoreCase(config.getLevel1Role().trim()))) {
                throw new IllegalArgumentException("Level 1 checker role '" + config.getLevel1Role() + "' is not a recognized active system role.");
            }
            if (config.getApprovalLevels() == 2 && config.getLevel2Role() != null) {
                if (knownRoles.stream().noneMatch(r -> r.equalsIgnoreCase(config.getLevel2Role().trim()))) {
                    throw new IllegalArgumentException("Level 2 checker role '" + config.getLevel2Role() + "' is not a recognized active system role.");
                }
            }
        }
        if (config.getSlaHours() <= 0) {
            throw new IllegalArgumentException("Approval SLA hours must be greater than zero.");
        }

        // Overlap / Ambiguity Check
        String targetType = config.getTransactionType().trim();
        List<ApprovalHierarchyConfig> existingConfigs = approvalHierarchyConfigRepository.findAll();
        for (ApprovalHierarchyConfig ex : existingConfigs) {
            if (ex.getTransactionType() != null && ex.getTransactionType().trim().equalsIgnoreCase(targetType)) {
                if (config.getId() == null || config.getId().isBlank() || !ex.getId().equalsIgnoreCase(config.getId())) {
                    throw new IllegalArgumentException("Approval configuration already exists for transaction type '" + targetType + "'. Ambiguous duplicate rules are not permitted.");
                }
            }
        }

        if (config.getId() == null || config.getId().isBlank()) {
            config.setId("ah-" + UUID.randomUUID().toString().substring(0, 8));
        }
        ApprovalHierarchyConfig saved = approvalHierarchyConfigRepository.save(config);
        cimsService.logAudit(actor, "SYSADMIN", "SAVE_APPROVAL_CONFIG", "ApprovalConfig", saved.getId(), "Config", "Old", saved.getTransactionType(), "Saved approval hierarchy config");
        return ResponseEntity.ok(saved);
    }

    // --- Reminder Schedules ---
    @GetMapping("/reminder-schedules")
    public List<ReminderSchedule> getReminderSchedules() {
        return reminderConfigurationService.getAll();
    }

    @PostMapping("/reminder-schedules/save")
    public ResponseEntity<?> saveReminderSchedule(
            @RequestBody ReminderSchedule schedule,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        try {
            return ResponseEntity.ok(reminderConfigurationService.save(schedule, actor));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // --- Scheduled Reports ---
    @GetMapping("/scheduled-reports")
    public List<ScheduledReport> getScheduledReports() {
        return scheduledReportRepository.findAll();
    }

    @PostMapping("/scheduled-reports/save")
    public ResponseEntity<ScheduledReport> saveScheduledReport(
            @RequestBody ScheduledReport report,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (report.getReportType() == null || report.getReportType().isBlank()) throw new IllegalArgumentException("Report type is mandatory.");
        if (report.getId() == null || report.getId().isBlank()) {
            report.setId("rep-sched-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (report.getCreatedAt() == null) {
            report.setCreatedAt(java.time.LocalDateTime.now());
        }
        ScheduledReport saved = scheduledReportRepository.save(report);
        cimsService.logAudit(actor, "SYSADMIN", "SAVE_SCHEDULED_REPORT", "ScheduledReport", saved.getId(), "Report", "Old", saved.getReportType(), "Scheduled report " + saved.getReportType());
        return ResponseEntity.ok(saved);
    }

    // --- Reference Data & Taxonomy (Audit Finding 3) ---
    @GetMapping("/insurers")
    public List<ApprovedInsurer> getInsurers() {
        return approvedInsurerRepository.findAll();
    }

    @PostMapping("/insurers/save")
    public ResponseEntity<ApprovedInsurer> saveInsurer(
            @RequestBody ApprovedInsurer insurer,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (insurer.getName() == null || insurer.getName().trim().isBlank()) {
            throw new IllegalArgumentException("Insurer name is mandatory.");
        }
        // Duplicate check
        approvedInsurerRepository.findAll().stream()
                .filter(i -> i.getName() != null && i.getName().trim().equalsIgnoreCase(insurer.getName().trim()))
                .filter(i -> insurer.getId() != null && !i.getId().equalsIgnoreCase(insurer.getId()))
                .findFirst()
                .ifPresent(dup -> {
                    throw new IllegalArgumentException("An approved insurer with name '" + insurer.getName() + "' already exists.");
                });

        if (insurer.getId() == null || insurer.getId().isBlank()) {
            insurer.setId("ins-" + System.currentTimeMillis());
        }
        ApprovedInsurer saved = approvedInsurerRepository.save(insurer);
        cimsService.logAudit(actor, "SYSADMIN", "ADMIN_SAVE_INSURER", "ApprovedInsurer", saved.getId(), "Name", "Old", saved.getName(), "Saved insurer");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/taxonomy")
    public List<CollateralTaxonomy> getTaxonomies() {
        return collateralTaxonomyRepository.findAll();
    }

    @PostMapping("/taxonomy/save")
    public ResponseEntity<CollateralTaxonomy> saveTaxonomy(
            @RequestBody CollateralTaxonomy taxonomy,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (taxonomy.getCategory() == null || taxonomy.getCategory().trim().isBlank()) {
            throw new IllegalArgumentException("Taxonomy category is mandatory.");
        }
        if (taxonomy.getSubCategory() == null || taxonomy.getSubCategory().trim().isBlank()) {
            throw new IllegalArgumentException("Taxonomy subCategory is mandatory.");
        }
        // Duplicate check
        collateralTaxonomyRepository.findAll().stream()
                .filter(t -> t.getCategory().trim().equalsIgnoreCase(taxonomy.getCategory().trim())
                        && t.getSubCategory() != null && t.getSubCategory().trim().equalsIgnoreCase(taxonomy.getSubCategory().trim()))
                .filter(t -> taxonomy.getId() != null && !t.getId().equalsIgnoreCase(taxonomy.getId()))
                .findFirst()
                .ifPresent(dup -> {
                    throw new IllegalArgumentException("Collateral taxonomy rule for category '" + taxonomy.getCategory() + "' and subCategory '" + taxonomy.getSubCategory() + "' already exists.");
                });

        if (taxonomy.getId() == null || taxonomy.getId().isBlank()) {
            taxonomy.setId("tax-" + System.currentTimeMillis());
        }
        CollateralTaxonomy saved = collateralTaxonomyRepository.save(taxonomy);
        cimsService.logAudit(actor, "SYSADMIN", "ADMIN_SAVE_TAXONOMY", "CollateralTaxonomy", saved.getId(), "Taxonomy", "Old", saved.getCategory(), "Saved taxonomy");
        return ResponseEntity.ok(saved);
    }

    @GetMapping({"/document-rules", "/mandatory-doc-rules"})
    public List<MandatoryDocumentRule> getDocumentRules() {
        return mandatoryDocumentRuleRepository.findAll();
    }

    @PostMapping("/document-rules/save")
    public ResponseEntity<MandatoryDocumentRule> saveDocumentRule(
            @RequestBody MandatoryDocumentRule rule,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (rule.getCollateralCategory() == null || rule.getCollateralCategory().trim().isBlank()) {
            throw new IllegalArgumentException("Collateral category is mandatory for mandatory document rules.");
        }
        if (rule.getDocumentType() == null || rule.getDocumentType().trim().isBlank()) {
            throw new IllegalArgumentException("Document type is mandatory for mandatory document rules.");
        }
        // Blank / null segment means the rule applies to every business segment.
        if (rule.getSegment() == null || rule.getSegment().trim().isBlank()) {
            rule.setSegment("All Segments");
        } else {
            rule.setSegment(rule.getSegment().trim());
            boolean allSegments = rule.getSegment().equalsIgnoreCase("All Segments");
            boolean known = allSegments || businessSegmentRepository.findAll().stream()
                    .anyMatch(s -> s.getName() != null && s.getName().equalsIgnoreCase(rule.getSegment()));
            if (!known) {
                throw new IllegalArgumentException("Unknown business segment '" + rule.getSegment() + "'. Select a configured segment or All Segments.");
            }
        }
        // Duplicate check (same category + document type + sub-type + segment)
        mandatoryDocumentRuleRepository.findAll().stream()
                .filter(r -> r.getCollateralCategory().trim().equalsIgnoreCase(rule.getCollateralCategory().trim())
                        && r.getDocumentType().trim().equalsIgnoreCase(rule.getDocumentType().trim())
                        && java.util.Objects.equals(r.getCollateralType(), rule.getCollateralType())
                        && java.util.Objects.equals(normalizeRuleSegment(r.getSegment()), normalizeRuleSegment(rule.getSegment())))
                .filter(r -> rule.getId() != null && !r.getId().equalsIgnoreCase(rule.getId()))
                .findFirst()
                .ifPresent(dup -> {
                    throw new IllegalArgumentException("Mandatory document rule for segment '" + rule.getSegment() + "', category '" + rule.getCollateralCategory() + "' and document type '" + rule.getDocumentType() + "' already exists.");
                });

        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId("doc-r" + System.currentTimeMillis());
        }
        MandatoryDocumentRule saved = mandatoryDocumentRuleRepository.save(rule);
        cimsService.logAudit(actor, "SYSADMIN", "ADMIN_SAVE_DOCUMENT_RULE", "MandatoryDocumentRule", saved.getId(), "Rule", "Old", saved.getCollateralCategory(), "Saved mandatory doc rule");
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/document-rules/{id}")
    public ResponseEntity<Map<String, Object>> deleteDocumentRule(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        mandatoryDocumentRuleRepository.findById(id).ifPresent(r -> {
            mandatoryDocumentRuleRepository.deleteById(id);
            cimsService.logAudit(actor, "SYSADMIN", "ADMIN_DELETE_DOCUMENT_RULE", "MandatoryDocumentRule", id, "Rule", r.getDocumentType(), null, "Deleted mandatory doc rule: " + r.getDocumentType());
        });
        return ResponseEntity.ok(Map.of("success", true, "message", "Document rule deleted successfully."));
    }

    @PostMapping("/document-rules/{id}/delete")
    public ResponseEntity<Map<String, Object>> deleteDocumentRulePost(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        return deleteDocumentRule(id, headerUserId, adminUserId);
    }

    @PostMapping("/document-rules/delete-all")
    public ResponseEntity<Map<String, Object>> deleteAllDocumentRules(
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        long count = mandatoryDocumentRuleRepository.count();
        mandatoryDocumentRuleRepository.deleteAll();
        cimsService.logAudit(actor, "SYSADMIN", "ADMIN_DELETE_ALL_DOCUMENT_RULES", "MandatoryDocumentRule", "ALL", "Rule", String.valueOf(count), "0", "Deleted all mandatory doc rules (" + count + " rules)");
        return ResponseEntity.ok(Map.of("success", true, "message", "All mandatory document rules removed successfully.", "count", count));
    }

    private String normalizeRuleSegment(String segment) {
        if (segment == null || segment.isBlank()) return "all segments";
        return segment.trim().toLowerCase();
    }

    @GetMapping("/escalation-rules")
    public List<EscalationRule> getEscalationRules() {
        return escalationRuleRepository.findAll();
    }

    @PostMapping("/escalation-rules/save")
    public ResponseEntity<EscalationRule> saveEscalationRule(
            @RequestBody EscalationRule rule,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (rule.getEscalationRole() == null || rule.getEscalationRole().trim().isBlank()) {
            throw new IllegalArgumentException("Escalation role is mandatory.");
        }
        if (rule.getDaysBeforeExpiry() < 0) {
            throw new IllegalArgumentException("Days before expiry cannot be negative.");
        }

        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId("esc-" + System.currentTimeMillis());
        }
        EscalationRule saved = escalationRuleRepository.save(rule);
        cimsService.logAudit(actor, "SYSADMIN", "ADMIN_SAVE_ESCALATION_RULE", "EscalationRule", saved.getId(), "Rule", "Old", saved.getEscalationRole(), "Saved escalation rule");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/templates")
    public List<NotificationTemplate> getTemplates() {
        return notificationTemplateService.getAllTemplates();
    }

    @PostMapping("/templates/save")
    public ResponseEntity<?> saveTemplate(
            @RequestBody NotificationTemplate template,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        try {
            NotificationTemplate saved = notificationTemplateService.saveTemplate(template, actor);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/districts")
    public List<DistrictHierarchy> getDistricts() {
        return districtHierarchyRepository.findAll();
    }

    @PostMapping("/districts/save")
    public ResponseEntity<DistrictHierarchy> saveDistrict(
            @RequestBody DistrictHierarchy district,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        if (district.getDistrictName() == null || district.getDistrictName().trim().isBlank()) {
            throw new IllegalArgumentException("District name is mandatory.");
        }
        if (district.getBranchName() == null || district.getBranchName().trim().isBlank()) {
            throw new IllegalArgumentException("Branch name mapping is mandatory for district hierarchy.");
        }
        if (district.getAreaOffice() == null || district.getAreaOffice().trim().isBlank()) {
            district.setAreaOffice(district.getDistrictName());
        }

        if (district.getId() == null || district.getId().isBlank()) {
            district.setId("dist-" + System.currentTimeMillis());
        }
        DistrictHierarchy saved = districtHierarchyRepository.save(district);
        cimsService.logAudit(actor, "SYSADMIN", "ADMIN_SAVE_DISTRICT", "DistrictHierarchy", saved.getId(), "District", "Old", saved.getDistrictName(), "Saved district");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/holidays")
    public List<HolidayCalendar> getHolidays() {
        return businessCalendarService.getAllHolidays();
    }

    @PostMapping("/holidays/save")
    public ResponseEntity<?> saveHoliday(
            @RequestBody HolidayCalendar holiday,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        try {
            HolidayCalendar saved = businessCalendarService.saveHoliday(holiday, actor);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/holidays/{id}/delete")
    public ResponseEntity<Map<String, Object>> deleteHoliday(
            @PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        businessCalendarService.deleteHoliday(id, actor);
        return ResponseEntity.ok(Map.of("success", true, "message", "Holiday deleted successfully."));
    }

    @GetMapping("/parameters")
    public List<SystemParameter> getParameters() {
        return configurationService.getAllParameters();
    }

    @PostMapping("/parameters/save")
    public ResponseEntity<?> saveParameter(
            @RequestBody SystemParameter param,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestParam(required = false) String adminUserId) {
        String actor = resolveAndVerifyAdminUser(headerUserId, adminUserId);
        try {
            SystemParameter saved = configurationService.saveParameter(param, actor);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getConfigurationHealth() {
        return ResponseEntity.ok(configurationService.checkConfigurationHealth());
    }

    @PostMapping("/reminders/run")
    public ResponseEntity<Map<String, Object>> runReminders() {
        return ResponseEntity.ok(cimsService.runPolicyExpiryReminders());
    }

    @GetMapping("/runtime")
    public ResponseEntity<Map<String, Object>> getRuntimeConfiguration() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("effectiveConfiguration", configurationService.getEffectiveConfiguration());
        result.put("health", configurationService.checkConfigurationHealth());
        result.put("reminderSchedules", reminderConfigurationService.getAll());
        result.put("holidayCount", businessCalendarService.getAllHolidays().size());
        result.put("templateCount", notificationTemplateService.getAllTemplates().size());
        result.put("dmsMode", dmsStorageService.getActiveMode());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/calendar/check")
    public ResponseEntity<Map<String, Object>> checkBusinessDate(@RequestParam String date) {
        try {
            java.time.LocalDate parsed = java.time.LocalDate.parse(date);
            return ResponseEntity.ok(Map.of(
                "date", parsed.toString(),
                "workingDay", businessCalendarService.isWorkingDay(parsed),
                "weekend", businessCalendarService.isWeekend(parsed),
                "holiday", businessCalendarService.isHoliday(parsed),
                "nextWorkingDay", businessCalendarService.nextWorkingDay(parsed).toString(),
                "previousWorkingDay", businessCalendarService.previousWorkingDay(parsed).toString()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Date must use ISO format yyyy-MM-dd."));
        }
    }

    @PostMapping("/templates/preview")
    public ResponseEntity<?> previewTemplate(@RequestBody Map<String, Object> payload) {
        try {
            String template = payload.get("template") == null ? "" : String.valueOf(payload.get("template"));
            notificationTemplateService.validateTemplatePlaceholders(template);
            @SuppressWarnings("unchecked")
            Map<String, Object> context = payload.get("context") instanceof Map
                ? (Map<String, Object>) payload.get("context") : Map.of();
            return ResponseEntity.ok(Map.of("preview", notificationTemplateService.interpolate(template, context)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/configuration-usage")
    public ResponseEntity<Map<String,String>> getConfigurationUsage() {
        return ResponseEntity.ok(configurationService.getConfigurationUsageMap());
    }

    @GetMapping("/calendar/add-working-days")
    public ResponseEntity<?> addWorkingDays(@RequestParam String date, @RequestParam int days) {
        try {
            if (days < 0) return ResponseEntity.badRequest().body(Map.of("error", "days must be zero or greater."));
            java.time.LocalDate d = java.time.LocalDate.parse(date);
            return ResponseEntity.ok(Map.of("startDate", d.toString(), "workingDays", days, "result", businessCalendarService.addWorkingDays(d, days).toString()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Date must use ISO format yyyy-MM-dd."));
        }
    }

    @PostMapping("/escalations/run")
    public ResponseEntity<Map<String,Object>> runEscalations() {
        return ResponseEntity.ok(renewalEscalationService.run());
    }

    @PostMapping("/exceptions/scan")
    public ResponseEntity<Map<String,Object>> scanExceptions() {
        cimsService.scanAndGenerateExceptions();
        return ResponseEntity.ok(Map.of("success", true, "message", "Exception scan completed."));
    }

    @PostMapping("/templates/validate")
    public ResponseEntity<?> validateTemplate(@RequestBody Map<String,Object> payload) {
        try {
            String subject = payload.get("subject") == null ? "" : String.valueOf(payload.get("subject"));
            String body = payload.get("body") == null ? "" : String.valueOf(payload.get("body"));
            notificationTemplateService.validateTemplatePlaceholders(subject);
            notificationTemplateService.validateTemplatePlaceholders(body);
            return ResponseEntity.ok(Map.of("valid", true, "message", "Template variables are valid."));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("valid", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/health/dependencies")
    public ResponseEntity<Map<String,Object>> dependencyHealth() {
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("database", "UP");
        m.put("configuration", "UP");
        m.put("holidayCalendar", businessCalendarService.getAllHolidays().size() > 0 ? "CONFIGURED" : "EMPTY");
        m.put("reminders", reminderConfigurationService.getAll().size() > 0 ? "CONFIGURED" : "EMPTY");
        m.put("notificationTemplates", notificationTemplateService.getAllTemplates().size() > 0 ? "CONFIGURED" : "EMPTY");
        m.put("approvalHierarchy", approvalHierarchyConfigRepository.count() > 0 ? "CONFIGURED" : "EMPTY");
        m.put("dmsStorageMode", dmsStorageService.getActiveMode());
        m.put("dmsStatus", dmsStorageService.isHealthy() ? "UP" : "DOWN");
        return ResponseEntity.ok(m);
    }

    // =========================================================================
    // ORGANIZATION HIERARCHY & CBS INTEGRATION ENDPOINTS
    // =========================================================================

    @GetMapping("/org-units")
    public ResponseEntity<List<OrganizationalUnit>> getAllOrgUnits() {
        return ResponseEntity.ok(organizationalUnitRepository.findAll());
    }

    @PostMapping("/org-units/save")
    public ResponseEntity<?> saveOrgUnit(@RequestBody OrganizationalUnit unit) {
        if (unit.getId() == null || unit.getId().isBlank()) {
            unit.setId("org-" + UUID.randomUUID().toString().substring(0, 8));
        }
        unit.setUpdatedAt(java.time.LocalDateTime.now());
        OrganizationalUnit saved = organizationalUnitRepository.save(unit);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/canonical-districts")
    public ResponseEntity<List<OrganizationalUnit>> getCanonicalDistricts() {
        return ResponseEntity.ok(organizationalUnitRepository.findByUnitTypeAndActiveTrue("DISTRICT"));
    }

    @GetMapping("/branch-segments")
    public ResponseEntity<List<BranchSegmentAssignment>> getAllBranchSegments() {
        return ResponseEntity.ok(branchSegmentAssignmentRepository.findAll());
    }

    @PostMapping("/branch-segments/save")
    public ResponseEntity<?> saveBranchSegment(@RequestBody BranchSegmentAssignment bsa) {
        if (bsa.getId() == null || bsa.getId().isBlank()) {
            bsa.setId("bsa-" + UUID.randomUUID().toString().substring(0, 8));
        }
        BranchSegmentAssignment saved = branchSegmentAssignmentRepository.save(bsa);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/cbs-branch-mappings")
    public ResponseEntity<List<CbsBranchMapping>> getAllCbsBranchMappings() {
        return ResponseEntity.ok(cbsBranchMappingRepository.findAll());
    }

    @PostMapping("/cbs-branch-mappings/save")
    public ResponseEntity<?> saveCbsBranchMapping(@RequestBody CbsBranchMapping mapping) {
        if (mapping.getId() == null || mapping.getId().isBlank()) {
            mapping.setId("cbm-" + UUID.randomUUID().toString().substring(0, 8));
        }
        mapping.setUpdatedAt(java.time.LocalDateTime.now());
        CbsBranchMapping saved = cbsBranchMappingRepository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/cbs-segment-mappings")
    public ResponseEntity<List<CbsSegmentMapping>> getAllCbsSegmentMappings() {
        return ResponseEntity.ok(cbsSegmentMappingRepository.findAll());
    }

    @PostMapping("/cbs-segment-mappings/save")
    public ResponseEntity<?> saveCbsSegmentMapping(@RequestBody CbsSegmentMapping mapping) {
        if (mapping.getId() == null || mapping.getId().isBlank()) {
            mapping.setId("csm-" + UUID.randomUUID().toString().substring(0, 8));
        }
        mapping.setUpdatedAt(java.time.LocalDateTime.now());
        CbsSegmentMapping saved = cbsSegmentMappingRepository.save(mapping);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/user-org-assignments")
    public ResponseEntity<List<UserOrgAssignment>> getAllUserOrgAssignments() {
        return ResponseEntity.ok(userOrgAssignmentRepository.findAll());
    }

    @PostMapping("/user-org-assignments/save")
    public ResponseEntity<?> saveUserOrgAssignment(@RequestBody UserOrgAssignment uoa) {
        if (uoa.getId() == null || uoa.getId().isBlank()) {
            uoa.setId("uoa-" + UUID.randomUUID().toString().substring(0, 8));
        }
        UserOrgAssignment saved = userOrgAssignmentRepository.save(uoa);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/portfolio-assignments")
    public ResponseEntity<List<PortfolioAssignment>> getAllPortfolioAssignments() {
        return ResponseEntity.ok(portfolioAssignmentRepository.findAll());
    }

    @PostMapping("/portfolio-assignments/save")
    public ResponseEntity<?> savePortfolioAssignment(@RequestBody PortfolioAssignment pa) {
        if (pa.getId() == null || pa.getId().isBlank()) {
            pa.setId("pa-" + UUID.randomUUID().toString().substring(0, 8));
        }
        pa.setUpdatedAt(java.time.LocalDateTime.now());
        PortfolioAssignment saved = portfolioAssignmentRepository.save(pa);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/portfolio-assignments/reassign")
    public ResponseEntity<?> reassignPortfolio(@RequestBody Map<String, String> payload) {
        String entityType = payload.get("entityType");
        String entityId = payload.get("entityId");
        String newMakerId = payload.get("newMakerId");
        String newCheckerId = payload.get("newCheckerId");
        String reason = payload.get("reason");
        String changedBy = payload.getOrDefault("changedBy", "ADMIN");

        if (entityType == null || entityId == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "entityType and entityId are required."));
        }

        Optional<PortfolioAssignment> opt = portfolioAssignmentRepository.findByEntityTypeAndEntityId(entityType, entityId);
        PortfolioAssignment pa = opt.orElseGet(() -> {
            PortfolioAssignment p = new PortfolioAssignment();
            p.setId("pa-" + UUID.randomUUID().toString().substring(0, 8));
            p.setEntityType(entityType);
            p.setEntityId(entityId);
            return p;
        });

        String prevMaker = pa.getMakerUserId();
        String prevChecker = pa.getCheckerUserId();

        if (newMakerId != null && !newMakerId.isBlank()) pa.setMakerUserId(newMakerId);
        if (newCheckerId != null && !newCheckerId.isBlank()) pa.setCheckerUserId(newCheckerId);
        pa.setAssignmentSource("REASSIGNED");
        pa.setStatus("ASSIGNED");
        pa.setUpdatedAt(java.time.LocalDateTime.now());

        portfolioAssignmentRepository.save(pa);

        PortfolioAssignmentHistory hist = new PortfolioAssignmentHistory(
                "pah-" + UUID.randomUUID().toString().substring(0, 8),
                pa.getId(),
                entityType,
                entityId,
                prevMaker,
                pa.getMakerUserId(),
                prevChecker,
                pa.getCheckerUserId(),
                "REASSIGNED",
                reason != null ? reason : "Administrative portfolio reassignment",
                changedBy
        );
        portfolioAssignmentHistoryRepository.save(hist);

        return ResponseEntity.ok(Map.of("success", true, "assignment", pa));
    }

    @GetMapping("/unassigned-records")
    public ResponseEntity<List<UnassignedRecord>> getUnassignedRecords() {
        return ResponseEntity.ok(unassignedRecordRepository.findAll());
    }

    @PostMapping("/impact-preview")
    public ResponseEntity<com.bank.cims.dto.ImpactPreviewDto> calculateImpactPreview(@RequestBody Map<String, Object> req) {
        String changeType = String.valueOf(req.getOrDefault("changeType", "BRANCH_CHANGE"));
        String targetId = String.valueOf(req.getOrDefault("targetId", ""));

        com.bank.cims.dto.ImpactPreviewDto dto = new com.bank.cims.dto.ImpactPreviewDto();
        dto.setChangeType(changeType);
        dto.setTargetId(targetId);

        List<String> warnings = new ArrayList<>();
        List<String> officers = new ArrayList<>();

        if ("DEACTIVATE_USER".equalsIgnoreCase(changeType)) {
            dto.setDescription("Deactivating user " + targetId + " will orphan assigned portfolios.");
            long custs = portfolioAssignmentRepository.findByMakerUserId(targetId).size();
            long checkCusts = portfolioAssignmentRepository.findByCheckerUserId(targetId).size();
            dto.setAffectedCustomersCount((int) (custs + checkCusts));
            dto.setAffectedFacilitiesCount((int) loanAccountRepository.findAll().stream()
                    .filter(f -> targetId.equalsIgnoreCase(f.getAssignedCro()) || targetId.equalsIgnoreCase(f.getRmUserId())).count());
            officers.add(targetId);
            warnings.add("User is currently assigned to " + (custs + checkCusts) + " active portfolios. Reassignment required before deactivation.");
            dto.setRequiresDualApproval(true);
        } else if ("REASSIGN_BRANCH".equalsIgnoreCase(changeType)) {
            dto.setDescription("Reassigning branch " + targetId + " affects all assigned loans, facilities, and local collaterals.");
            dto.setAffectedFacilitiesCount((int) loanAccountRepository.findAll().stream()
                    .filter(f -> targetId.equalsIgnoreCase(f.getBranch())).count());
            dto.setAffectedCollateralsCount((int) collateralRepository.findAll().stream()
                    .filter(c -> targetId.equalsIgnoreCase(c.getBranch())).count());
            warnings.add("Branch reassignment alters the geographic reporting boundary for all linked collateral assets.");
            dto.setRequiresDualApproval(true);
        } else if ("CBS_MAPPING_CHANGE".equalsIgnoreCase(changeType)) {
            dto.setDescription("Modifying CBS mapping for code " + targetId + " impacts subsequent CBS synchronization and reconciliation.");
            dto.setAffectedFacilitiesCount((int) loanAccountRepository.findAll().stream()
                    .filter(f -> targetId.equalsIgnoreCase(f.getBranch())).count());
            warnings.add("Changing this mapping affects the auto-routing of newly imported facilities from CBS Oracle views.");
            dto.setRequiresDualApproval(false);
        } else {
            dto.setDescription("Administrative configuration modification for entity " + targetId);
            dto.setRequiresDualApproval(false);
        }

        dto.setRiskWarnings(warnings);
        dto.setAffectedOfficers(officers);
        return ResponseEntity.ok(dto);
    }
}
