package com.bank.cims.controller;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminConfigController {

    @Autowired
    private BusinessSegmentRepository businessSegmentRepository;

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
    private NotificationTemplateService notificationTemplateService;

    @Autowired
    private RenewalEscalationService renewalEscalationService;

    // --- Business Segments ---
    @GetMapping("/segments")
    public List<BusinessSegment> getSegments() {
        return businessSegmentRepository.findAll();
    }

    @PostMapping("/segments/save")
    public ResponseEntity<BusinessSegment> saveSegment(@RequestBody BusinessSegment segment, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        if (segment.getId() == null || segment.getId().isBlank()) {
            segment.setId("seg-" + UUID.randomUUID().toString().substring(0, 8));
        }
        BusinessSegment saved = businessSegmentRepository.save(segment);
        cimsService.logAudit(adminUserId, "SYSADMIN", "SAVE_BUSINESS_SEGMENT", "BusinessSegment", saved.getId(), "Segment", "Old", saved.getName(), "Saved segment " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/segments/{id}/toggle-status")
    public ResponseEntity<Map<String, Object>> toggleSegmentStatus(@PathVariable String id, @RequestParam boolean active, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        businessSegmentRepository.findById(id).ifPresent(s -> {
            s.setActive(active);
            businessSegmentRepository.save(s);
            cimsService.logAudit(adminUserId, "SYSADMIN", "TOGGLE_SEGMENT_STATUS", "BusinessSegment", id, "Active", String.valueOf(!active), String.valueOf(active), "Toggled business segment active status");
        });
        return ResponseEntity.ok(Map.of("success", true));
    }

    // --- Users ---
    @GetMapping("/users")
    public List<Map<String,Object>> getUsers() {
        return userRepository.findAll().stream().map(this::safeUser).toList();
    }

    private Map<String,Object> safeUser(User u) {
        Map<String,Object> m=new java.util.LinkedHashMap<>();
        m.put("id",u.getId()); m.put("username",u.getUsername()); m.put("fullName",u.getFullName()); m.put("email",u.getEmail()); m.put("phone",u.getPhone());
        m.put("role",u.getRole()); m.put("branch",u.getBranch()); m.put("segment",u.getSegment()); m.put("active",u.isActive());
        return m;
    }

    @PostMapping("/users/save")
    public ResponseEntity<User> saveUser(@RequestBody User user, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        if (user.getUsername() == null || user.getUsername().isBlank()) throw new IllegalArgumentException("Username is mandatory.");
        if (user.getId() == null || user.getId().isBlank()) {
            user.setId("usr-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (user.getPassword() == null || user.getPassword().isBlank()) {
            Optional<User> existing = userRepository.findById(user.getId());
            if (existing.isPresent() && existing.get().getPassword() != null && !existing.get().getPassword().isBlank()) {
                user.setPassword(existing.get().getPassword());
            } else {
                user.setPassword("password123");
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
        User saved = userRepository.save(user);
        cimsService.logAudit(adminUserId, "SYSADMIN", "SAVE_USER", "User", saved.getId(), "All", "Old", saved.getUsername(), "Saved user " + saved.getUsername());
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/users/{id}/toggle-status")
    public ResponseEntity<Map<String, Object>> toggleUserStatus(@PathVariable String id, @RequestParam boolean active, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        userRepository.findById(id).ifPresent(u -> {
            u.setActive(active);
            userRepository.save(u);
            cimsService.logAudit(adminUserId, "SYSADMIN", "TOGGLE_USER_STATUS", "User", id, "Active", String.valueOf(!active), String.valueOf(active), "Toggled user active status");
        });
        return ResponseEntity.ok(Map.of("success", true));
    }

    // --- Role Permissions ---
    @GetMapping("/permissions")
    public List<RolePermission> getPermissions() {
        return rolePermissionRepository.findAll();
    }

    @PostMapping("/permissions/save")
    public ResponseEntity<RolePermission> savePermission(@RequestBody RolePermission permission, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        if (permission.getId() == null || permission.getId().isBlank()) {
            List<RolePermission> existing = rolePermissionRepository.findByRoleCodeAndScreenName(permission.getRoleCode(), permission.getScreenName());
            if (!existing.isEmpty()) {
                permission.setId(existing.get(0).getId());
            } else {
                permission.setId("perm-" + permission.getRoleCode().toLowerCase() + "-" + permission.getScreenName().toLowerCase().replaceAll("\\s+", ""));
            }
        }
        RolePermission saved = rolePermissionRepository.save(permission);
        cimsService.logAudit(adminUserId, "SYSADMIN", "SAVE_ROLE_PERMISSION", "RolePermission", saved.getId(), "Permission", "Old", saved.getRoleCode() + ":" + saved.getScreenName(), "Updated role permission");
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/permissions/save-batch")
    public ResponseEntity<List<RolePermission>> savePermissionsBatch(@RequestBody List<RolePermission> permissions, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
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
        cimsService.logAudit(adminUserId, "SYSADMIN", "SAVE_ROLE_PERMISSIONS_BATCH", "RolePermission", "BATCH", "Permissions", "Old", "Count: " + saved.size(), "Batch updated " + saved.size() + " role permissions");
        return ResponseEntity.ok(saved);
    }

    // --- Branches Hierarchy ---
    @GetMapping("/branches")
    public List<Branch> getBranches() {
        return branchRepository.findAll();
    }

    @PostMapping("/branches/save")
    public ResponseEntity<Branch> saveBranch(@RequestBody Branch branch, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        if (branch.getId() == null || branch.getId().isBlank()) {
            branch.setId("brn-" + UUID.randomUUID().toString().substring(0, 8));
        }
        Branch saved = branchRepository.save(branch);
        cimsService.logAudit(adminUserId, "SYSADMIN", "SAVE_BRANCH", "Branch", saved.getId(), "Branch", "Old", saved.getCode(), "Saved branch " + saved.getName());
        return ResponseEntity.ok(saved);
    }

    // --- Approval Hierarchies ---
    @GetMapping("/approval-configs")
    public List<ApprovalHierarchyConfig> getApprovalConfigs() {
        return approvalHierarchyConfigRepository.findAll();
    }

    @PostMapping("/approval-configs/save")
    public ResponseEntity<ApprovalHierarchyConfig> saveApprovalConfig(@RequestBody ApprovalHierarchyConfig config, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        if (config.getTransactionType() == null || config.getTransactionType().isBlank()) throw new IllegalArgumentException("Transaction type is mandatory.");
        if (config.getLevel1Role() == null || config.getLevel1Role().isBlank()) throw new IllegalArgumentException("Level 1 checker role is mandatory.");
        if ("SYSADMIN".equalsIgnoreCase(config.getLevel1Role()) || "SYSADMIN".equalsIgnoreCase(config.getLevel2Role())) throw new IllegalArgumentException("System Administrator cannot be configured as a transactional checker.");
        if (config.getApprovalLevels() < 1 || config.getApprovalLevels() > 2) throw new IllegalArgumentException("Approval levels must be 1 or 2.");
        if (config.getSlaHours() <= 0) throw new IllegalArgumentException("Approval SLA hours must be greater than zero.");
        if (config.getId() == null || config.getId().isBlank()) {
            config.setId("ah-" + UUID.randomUUID().toString().substring(0, 8));
        }
        ApprovalHierarchyConfig saved = approvalHierarchyConfigRepository.save(config);
        cimsService.logAudit(adminUserId, "SYSADMIN", "SAVE_APPROVAL_CONFIG", "ApprovalConfig", saved.getId(), "Config", "Old", saved.getTransactionType(), "Saved approval hierarchy config");
        return ResponseEntity.ok(saved);
    }

    // --- Reminder Schedules ---
    @GetMapping("/reminder-schedules")
    public List<ReminderSchedule> getReminderSchedules() {
        return reminderConfigurationService.getAll();
    }

    @PostMapping("/reminder-schedules/save")
    public ResponseEntity<?> saveReminderSchedule(@RequestBody ReminderSchedule schedule, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        try {
            return ResponseEntity.ok(reminderConfigurationService.save(schedule, adminUserId));
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
    public ResponseEntity<ScheduledReport> saveScheduledReport(@RequestBody ScheduledReport report, @RequestParam(defaultValue = "SYSADMIN") String adminUserId) {
        if (report.getId() == null || report.getId().isBlank()) {
            report.setId("rep-sched-" + UUID.randomUUID().toString().substring(0, 8));
        }
        ScheduledReport saved = scheduledReportRepository.save(report);
        cimsService.logAudit(adminUserId, "SYSADMIN", "SAVE_SCHEDULED_REPORT", "ScheduledReport", saved.getId(), "Report", "Old", saved.getReportType(), "Scheduled report " + saved.getReportType());
        return ResponseEntity.ok(saved);
    }

    // --- Reference Data ---
    @GetMapping("/insurers")
    public List<ApprovedInsurer> getInsurers() {
        return approvedInsurerRepository.findAll();
    }

    @PostMapping("/insurers/save")
    public ResponseEntity<ApprovedInsurer> saveInsurer(@RequestBody ApprovedInsurer insurer, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        if (insurer.getId() == null || insurer.getId().isBlank()) {
            insurer.setId("ins-" + System.currentTimeMillis());
        }
        ApprovedInsurer saved = approvedInsurerRepository.save(insurer);
        cimsService.logAudit(userId, "SYSADMIN", "ADMIN_SAVE_INSURER", "ApprovedInsurer", saved.getId(), "Name", "Old", saved.getName(), "Saved insurer");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/taxonomy")
    public List<CollateralTaxonomy> getTaxonomies() {
        return collateralTaxonomyRepository.findAll();
    }

    @PostMapping("/taxonomy/save")
    public ResponseEntity<CollateralTaxonomy> saveTaxonomy(@RequestBody CollateralTaxonomy taxonomy, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        if (taxonomy.getId() == null || taxonomy.getId().isBlank()) {
            taxonomy.setId("tax-" + System.currentTimeMillis());
        }
        CollateralTaxonomy saved = collateralTaxonomyRepository.save(taxonomy);
        cimsService.logAudit(userId, "SYSADMIN", "ADMIN_SAVE_TAXONOMY", "CollateralTaxonomy", saved.getId(), "Taxonomy", "Old", saved.getCategory(), "Saved taxonomy");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/document-rules")
    public List<MandatoryDocumentRule> getDocumentRules() {
        return mandatoryDocumentRuleRepository.findAll();
    }

    @PostMapping("/document-rules/save")
    public ResponseEntity<MandatoryDocumentRule> saveDocumentRule(@RequestBody MandatoryDocumentRule rule, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId("doc-r" + System.currentTimeMillis());
        }
        MandatoryDocumentRule saved = mandatoryDocumentRuleRepository.save(rule);
        cimsService.logAudit(userId, "SYSADMIN", "ADMIN_SAVE_DOCUMENT_RULE", "MandatoryDocumentRule", saved.getId(), "Rule", "Old", saved.getCollateralCategory(), "Saved mandatory doc rule");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/escalation-rules")
    public List<EscalationRule> getEscalationRules() {
        return escalationRuleRepository.findAll();
    }

    @PostMapping("/escalation-rules/save")
    public ResponseEntity<EscalationRule> saveEscalationRule(@RequestBody EscalationRule rule, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        if (rule.getId() == null || rule.getId().isBlank()) {
            rule.setId("esc-" + System.currentTimeMillis());
        }
        EscalationRule saved = escalationRuleRepository.save(rule);
        cimsService.logAudit(userId, "SYSADMIN", "ADMIN_SAVE_ESCALATION_RULE", "EscalationRule", saved.getId(), "Rule", "Old", saved.getEscalationRole(), "Saved escalation rule");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/templates")
    public List<NotificationTemplate> getTemplates() {
        return notificationTemplateService.getAllTemplates();
    }

    @PostMapping("/templates/save")
    public ResponseEntity<?> saveTemplate(@RequestBody NotificationTemplate template, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        try {
            NotificationTemplate saved = notificationTemplateService.saveTemplate(template, userId);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/districts")
    public List<DistrictHierarchy> getDistricts() {
        return districtHierarchyRepository.findAll();
    }

    @PostMapping("/districts/save")
    public ResponseEntity<DistrictHierarchy> saveDistrict(@RequestBody DistrictHierarchy district, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        if (district.getId() == null || district.getId().isBlank()) {
            district.setId("dist-" + System.currentTimeMillis());
        }
        DistrictHierarchy saved = districtHierarchyRepository.save(district);
        cimsService.logAudit(userId, "SYSADMIN", "ADMIN_SAVE_DISTRICT", "DistrictHierarchy", saved.getId(), "District", "Old", saved.getDistrictName(), "Saved district");
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/holidays")
    public List<HolidayCalendar> getHolidays() {
        return businessCalendarService.getAllHolidays();
    }

    @PostMapping("/holidays/save")
    public ResponseEntity<?> saveHoliday(@RequestBody HolidayCalendar holiday, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        try {
            HolidayCalendar saved = businessCalendarService.saveHoliday(holiday, userId);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/holidays/{id}/delete")
    public ResponseEntity<Map<String, Object>> deleteHoliday(@PathVariable String id, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        businessCalendarService.deleteHoliday(id, userId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Holiday deleted successfully."));
    }

    @GetMapping("/parameters")
    public List<SystemParameter> getParameters() {
        return configurationService.getAllParameters();
    }

    @PostMapping("/parameters/save")
    public ResponseEntity<?> saveParameter(@RequestBody SystemParameter param, @RequestParam(defaultValue = "SYSADMIN") String userId) {
        try {
            SystemParameter saved = configurationService.saveParameter(param, userId);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException e) {
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
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("effectiveConfiguration", configurationService.getEffectiveConfiguration());
        result.put("health", configurationService.checkConfigurationHealth());
        result.put("reminderSchedules", reminderConfigurationService.getAll());
        result.put("holidayCount", businessCalendarService.getAllHolidays().size());
        result.put("templateCount", notificationTemplateService.getAllTemplates().size());
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
            if(days<0) return ResponseEntity.badRequest().body(Map.of("error","days must be zero or greater."));
            java.time.LocalDate d=java.time.LocalDate.parse(date);
            return ResponseEntity.ok(Map.of("startDate",d.toString(),"workingDays",days,"result",businessCalendarService.addWorkingDays(d,days).toString()));
        } catch(Exception e) { return ResponseEntity.badRequest().body(Map.of("error","Date must use ISO format yyyy-MM-dd.")); }
    }

    @PostMapping("/escalations/run")
    public ResponseEntity<Map<String,Object>> runEscalations() { return ResponseEntity.ok(renewalEscalationService.run()); }

    @PostMapping("/exceptions/scan")
    public ResponseEntity<Map<String,Object>> scanExceptions() {
        cimsService.scanAndGenerateExceptions();
        return ResponseEntity.ok(Map.of("success",true,"message","Exception scan completed."));
    }

    @PostMapping("/templates/validate")
    public ResponseEntity<?> validateTemplate(@RequestBody Map<String,Object> payload) {
        try {
            String subject=payload.get("subject")==null?"":String.valueOf(payload.get("subject"));
            String body=payload.get("body")==null?"":String.valueOf(payload.get("body"));
            notificationTemplateService.validateTemplatePlaceholders(subject);
            notificationTemplateService.validateTemplatePlaceholders(body);
            return ResponseEntity.ok(Map.of("valid",true,"message","Template variables are valid."));
        } catch(IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("valid",false,"error",e.getMessage())); }
    }

    @GetMapping("/health/dependencies")
    public ResponseEntity<Map<String,Object>> dependencyHealth() {
        Map<String,Object> m=new LinkedHashMap<>();
        m.put("database","UP");
        m.put("configuration","UP");
        m.put("holidayCalendar",businessCalendarService.getAllHolidays().size()>0?"CONFIGURED":"EMPTY");
        m.put("reminders",reminderConfigurationService.getAll().size()>0?"CONFIGURED":"EMPTY");
        m.put("notificationTemplates",notificationTemplateService.getAllTemplates().size()>0?"CONFIGURED":"EMPTY");
        m.put("approvalHierarchy",approvalHierarchyConfigRepository.count()>0?"CONFIGURED":"EMPTY");
        return ResponseEntity.ok(m);
    }

}
