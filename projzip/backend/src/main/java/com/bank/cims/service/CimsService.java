package com.bank.cims.service;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.bank.cims.service.cbs.*;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Transactional
public class CimsService {

    @Autowired
    private RoleHierarchyService roleHierarchyService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private LoanAccountRepository loanAccountRepository;

    @Autowired
    private CollateralRepository collateralRepository;

    @Autowired
    private LoanCollateralLinkRepository loanCollateralLinkRepository;

    @Autowired
    private CollateralOwnerRepository collateralOwnerRepository;

    @Autowired
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    private ExceptionRequestRepository exceptionRequestRepository;

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private CimsExceptionInvestigationNoteRepository cimsExceptionInvestigationNoteRepository;

    @Autowired
    private CimsExceptionEscalationHistoryRepository cimsExceptionEscalationHistoryRepository;

    @Autowired
    private CimsExceptionAssignmentHistoryRepository cimsExceptionAssignmentHistoryRepository;

    @Autowired
    private DistrictHierarchyRepository districtHierarchyRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationTemplateRepository notificationTemplateRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RolePermissionRepository rolePermissionRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private BusinessSegmentRepository businessSegmentRepository;

    @Autowired
    private OwnershipTransferRepository ownershipTransferRepository;

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    @Autowired
    private ApprovalHistoryRepository approvalHistoryRepository;

    @Autowired
    private DelegationRepository delegationRepository;

    @Autowired
    private ApprovalHierarchyConfigRepository approvalHierarchyConfigRepository;

    @Autowired
    private ReminderScheduleRepository reminderScheduleRepository;

    @Autowired
    private ReminderConfigurationService reminderConfigurationService;

    @Autowired
    private ScheduledReportRepository scheduledReportRepository;

    @Autowired
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private ApprovedInsurerRepository approvedInsurerRepository;

    @Autowired
    private CollateralTaxonomyRepository collateralTaxonomyRepository;

    @Autowired
    private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;

    @Autowired
    private HolidayCalendarRepository holidayCalendarRepository;

    @Autowired
    private SystemParameterRepository systemParameterRepository;

    @Autowired
    private CbsCustomerRepository cbsCustomerRepository;

    @Autowired
    private CbsFacilityRepository cbsFacilityRepository;

    @Autowired
    private CbsCollateralRepository cbsCollateralRepository;

    @Autowired
    private CbsSyncLogRepository cbsSyncLogRepository;

    @Autowired
    private CbsSyncService cbsSyncService;

    @Autowired(required = false)
    private FlowableWorkflowService flowableWorkflowService;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private ConfigurationService configurationService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private EffectiveInsuranceService effectiveInsuranceService;

    @Autowired
    private BusinessCalendarService businessCalendarService;

    @Autowired
    private PolicyHistoryRepository policyHistoryRepository;

    @Autowired
    private InsuranceRequirementService insuranceRequirementService;

    @Autowired
    private NotificationTemplateService notificationTemplateService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private NotificationService notificationService;

    @Autowired
    private WorkflowExecutionService workflowExecutionService;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    @Autowired
    private CbsGateway cbsGateway;

    @Autowired
    private CollateralFacilityRelationshipService collateralFacilityRelationshipService;

    @Autowired
    private CbsAccCollLinkDtlsRepository cbsAccCollLinkDtlsRepository;

    private String simulatedSystemDate = null;

    public String getSimulatedSystemDate() { 
        return (simulatedSystemDate != null && !simulatedSystemDate.isBlank()) 
            ? simulatedSystemDate 
            : LocalDate.now().toString(); 
    }
    public void setSimulatedSystemDate(String d) { this.simulatedSystemDate = d; }

    private static final String[] ALL_APP_ROLES = {
        "SYSADMIN", "EXEC", "SRMGMT", "HODEPT", "DISTDIR", "BRMGR",
        "SRM", "BRM", "CRO", "BRO", "MGRCOLLDOC", "COLLDOCOFF",
        "COMPLIANCE", "RISK", "AUDITOR", "RDONLY"
    };

    private static final String[] ALL_APP_SCREENS = {
        "Dashboard", "Customers", "Facilities", "Collateral", "Insurance",
        "Approvals", "Exceptions", "Documents", "Reports", "Audit Trail",
        "Notifications", "Administration", "CBS Simulator"
    };

    @PostConstruct
    public void init() {
        initRolePermissions();
    }

    public synchronized void initRolePermissions() {
        for (String role : ALL_APP_ROLES) {
            for (String screen : ALL_APP_SCREENS) {
                List<RolePermission> existingPermissions = rolePermissionRepository.findByRoleCodeAndScreenName(role, screen);
                if (existingPermissions.isEmpty()) {
                    boolean canView = isDefaultViewAllowed(role, screen);
                    boolean canCreate = isDefaultCreateAllowed(role, screen);
                    boolean canEdit = isDefaultEditAllowed(role, screen);
                    boolean canApprove = isDefaultApproveAllowed(role, screen);
                    boolean canDelete = isDefaultDeleteAllowed(role, screen);

                    RolePermission perm = new RolePermission();
                    perm.setId("perm-" + role.toLowerCase() + "-" + screen.toLowerCase().replaceAll("\\s+", ""));
                    perm.setRoleCode(role);
                    perm.setScreenName(screen);
                    perm.setCanView(canView);
                    perm.setCanCreate(canCreate);
                    perm.setCanEdit(canEdit);
                    perm.setCanApprove(canApprove);
                    perm.setCanDelete(canDelete);
                    rolePermissionRepository.save(perm);
                } else if ("SYSADMIN".equals(role) && "Approvals".equals(screen)) {
                    RolePermission perm = existingPermissions.get(0);
                    if (perm.isCanApprove()) { perm.setCanApprove(false); rolePermissionRepository.save(perm); }
                }
            }
        }
    }

    private boolean isDefaultViewAllowed(String role, String screen) {
        if ("SYSADMIN".equals(role)) return true;
        if ("Administration".equals(screen)) return false;
        if ("CBS Simulator".equals(screen)) return "AUDITOR".equals(role);
        if ("Audit Trail".equals(screen)) return Arrays.asList("EXEC", "SRMGMT", "HODEPT", "DISTDIR", "BRMGR", "MGRCOLLDOC", "COMPLIANCE", "RISK", "AUDITOR").contains(role);
        if ("Approvals".equals(screen)) return !Arrays.asList("AUDITOR", "RDONLY").contains(role);
        return true;
    }

    private boolean isDefaultCreateAllowed(String role, String screen) {
        if ("SYSADMIN".equals(role)) return true;
        if (Arrays.asList("CRO", "BRO", "SRM", "BRM").contains(role)) {
            return Arrays.asList("Customers", "Collateral", "Insurance", "Documents").contains(screen);
        }
        if (Arrays.asList("MGRCOLLDOC", "COLLDOCOFF").contains(role)) {
            return Arrays.asList("Collateral", "Insurance", "Documents").contains(screen);
        }
        if ("COMPLIANCE".equals(role)) return "Exceptions".equals(screen);
        if ("BRMGR".equals(role)) return "Documents".equals(screen);
        return false;
    }

    private boolean isDefaultEditAllowed(String role, String screen) {
        if ("SYSADMIN".equals(role)) return true;
        if (Arrays.asList("CRO", "BRO", "SRM", "BRM").contains(role)) {
            return Arrays.asList("Customers", "Collateral", "Insurance", "Exceptions", "Documents").contains(screen);
        }
        if (Arrays.asList("BRMGR", "HODEPT", "DISTDIR").contains(role)) {
            return Arrays.asList("Customers", "Collateral", "Insurance", "Exceptions", "Documents").contains(screen);
        }
        if (Arrays.asList("MGRCOLLDOC", "COLLDOCOFF").contains(role)) {
            return Arrays.asList("Collateral", "Insurance", "Exceptions", "Documents").contains(screen);
        }
        if (Arrays.asList("COMPLIANCE", "RISK").contains(role)) {
            return "Exceptions".equals(screen);
        }
        return false;
    }

    private boolean isDefaultApproveAllowed(String role, String screen) {
        if ("SYSADMIN".equals(role)) return false;
        if (Arrays.asList("BRMGR", "EXEC", "SRMGMT", "HODEPT", "DISTDIR").contains(role)) {
            return Arrays.asList("Approvals", "Exceptions", "Customers", "Collateral", "Insurance").contains(screen);
        }
        if ("MGRCOLLDOC".equals(role)) {
            return Arrays.asList("Approvals", "Collateral", "Insurance", "Documents").contains(screen);
        }
        if (Arrays.asList("COMPLIANCE", "RISK").contains(role)) {
            return Arrays.asList("Approvals", "Exceptions").contains(screen);
        }
        return false;
    }

    private boolean isDefaultDeleteAllowed(String role, String screen) {
        if ("SYSADMIN".equals(role)) return true;
        if (Arrays.asList("BRMGR", "MGRCOLLDOC").contains(role)) {
            return "Documents".equals(screen);
        }
        return false;
    }

    public void assertUserPermission(String userId, String screenName, String action) {
        if (userId == null || userId.isBlank()) return;
        User user = findUser(userId);
        if (user == null || !user.isActive()) return;
        String role = user.getRole();
        if (role == null || "SYSADMIN".equalsIgnoreCase(role)) return;

        List<RolePermission> perms = rolePermissionRepository.findByRoleCodeAndScreenName(role, screenName);
        if (perms.isEmpty()) {
            if ("Collaterals".equalsIgnoreCase(screenName)) perms = rolePermissionRepository.findByRoleCodeAndScreenName(role, "Collateral");
            else if ("Policies".equalsIgnoreCase(screenName) || "Insurance Policies".equalsIgnoreCase(screenName)) perms = rolePermissionRepository.findByRoleCodeAndScreenName(role, "Insurance");
        }
        if (!perms.isEmpty()) {
            RolePermission p = perms.get(0);
            boolean allowed = switch (action.toUpperCase(Locale.ROOT)) {
                case "VIEW" -> p.isCanView();
                case "CREATE" -> p.isCanCreate();
                case "EDIT" -> p.isCanEdit();
                case "APPROVE" -> p.isCanApprove();
                case "DELETE" -> p.isCanDelete();
                default -> true;
            };
            if (!allowed) {
                throw new IllegalStateException("Permission Denied: User role '" + role + "' does not have " + action + " permission for " + screenName + ".");
            }
        }
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
            if (u.getRole() != null && u.getRole().equalsIgnoreCase(v)) return u;
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

    public Map<String, Object> getFullState() {
        Map<String, Object> state = new HashMap<>();
        state.put("customers", customerRepository.findAll());
        state.put("facilities", loanAccountRepository.findAll());
        state.put("loans", state.get("facilities"));
        state.put("collaterals", collateralRepository.findAll());
        state.put("links", loanCollateralLinkRepository.findAll());
        state.put("policies", insurancePolicyRepository.findAll());
        state.put("endorsements", policyEndorsementRepository.findAll());
        state.put("documents", ownershipDocumentRepository.findAll());
        state.put("templates", notificationTemplateRepository.findAll());
        state.put("notifications", notificationRepository.findTop500ByOrderBySentAtDesc());
        state.put("auditLogs", auditLogRepository.findTop500ByOrderByTimestampDesc());
        state.put("exceptions", cimsExceptionRepository.findAll());
        state.put("segments", businessSegmentRepository.findAll());
        state.put("branches", branchRepository.findAll());
        state.put("users", userRepository.findAll().stream().map(this::safeUserView).toList());
        state.put("rolePermissions", rolePermissionRepository.findAll());
        state.put("workflowTasks", workflowTaskRepository.findAll());
        state.put("approvalHistories", approvalHistoryRepository.findAll());
        state.put("delegations", delegationRepository.findAll());
        state.put("approvalConfigs", approvalHierarchyConfigRepository.findAll());
        state.put("reminderSchedules", reminderScheduleRepository.findAll());
        state.put("scheduledReports", scheduledReportRepository.findAll());
        state.put("insurers", approvedInsurerRepository.findAll());
        state.put("taxonomies", collateralTaxonomyRepository.findAll());
        state.put("mandatoryDocRules", mandatoryDocumentRuleRepository.findAll());
        state.put("holidayCalendars", holidayCalendarRepository.findAll());
        state.put("systemParameters", systemParameterRepository.findAll());
        state.put("cbsSyncLogs", cbsSyncLogRepository.findAllByOrderByTimestampDesc());
        state.put("cbsSync", cbsSyncService.getCbsSyncStatus());
        state.put("systemDate", simulatedSystemDate);
        return state;
    }

    private Map<String,Object> safeUserView(User u) {
        Map<String,Object> m=new LinkedHashMap<>();
        m.put("id",u.getId()); m.put("username",u.getUsername()); m.put("fullName",u.getFullName()); m.put("email",u.getEmail()); m.put("phone",u.getPhone());
        m.put("role",u.getRole()); m.put("branch",u.getBranch()); m.put("segment",u.getSegment()); m.put("active",u.isActive());
        return m;
    }

    public void logAudit(String userId, String userRole, String actionType, String entityType, String entityId, String fieldName, String oldVal, String newVal, String comments) {
        AuditLog log = new AuditLog();
        log.setId("log-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
        log.setTimestamp(LocalDateTime.now().toString());
        log.setUserId(userId != null ? userId : "SYSTEM");
        log.setUserName(userId);
        log.setRoleCode(userRole != null ? userRole : "SYSADMIN");
        log.setIpAddress("127.0.0.1");
        log.setActionType(actionType);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setFieldName(fieldName);
        log.setOldValue(oldVal);
        log.setNewValue(newVal);
        log.setOldValueState(oldVal);
        log.setNewValueState(newVal);
        log.setComments(comments);
        auditLogRepository.save(log);
    }

    public Map<String, Object> syncCbsCustomer(String customerId, String userId) {
        String cif = customerId;
        Optional<CbsCustomer> cbsOpt = cbsCustomerRepository.findById(customerId);
        if (cbsOpt.isPresent() && cbsOpt.get().getCif() != null) {
            cif = cbsOpt.get().getCif();
        }
        Map<String, Object> res = cbsSyncService.syncCustomerFromCbs(cif, userId);
        cbsCustomerRepository.findByCif(cif).ifPresent(c -> {
            c.setSyncStatus("Synced");
            c.setSyncedAt(LocalDateTime.now().toString());
            cbsCustomerRepository.save(c);
        });
        logAudit(userId, "SYSADMIN", "CBS_SYNC_CUSTOMER", "Customer", cif, "All", "CBS_SIM", "Synced", "Synchronized customer CIF " + cif);
        return Map.of("success", true, "message", "Customer " + cif + " synced successfully.", "data", res);
    }

    private Customer createShellCustomer(String cif, String segment, String branch, String userId) {
        Customer cust = new Customer();
        cust.setId("cust-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
        cust.setCif(cif != null ? cif : "CIF-" + System.currentTimeMillis());
        cust.setName("Borrower " + cust.getCif());
        cust.setCustomerType("Corporate");
        cust.setSegment(segment != null ? segment : "Corporate Banking");
        cust.setBranch(branch != null ? branch : "Main Branch");
        cust.setStatus("Active");
        cust.setRiskRating("Low");
        cust.setSource("CBS_SIM");
        cust.setCbsSyncStatus("Synced");
        cust.setCbsSyncedAt(LocalDateTime.now().toString());
        cust.setRecordStat("O");
        cust.setAuthStat("A");
        return customerRepository.save(cust);
    }

    public Map<String, Object> syncCbsFacility(String facilityId, String userId) {
        String ref = facilityId;
        Optional<CbsFacility> fOpt = cbsFacilityRepository.findById(facilityId);
        if (fOpt.isPresent() && fOpt.get().getLoanRefNo() != null) {
            ref = fOpt.get().getLoanRefNo();
        }
        Map<String, Object> res = cbsSyncService.syncFacilityFromCbs(ref, userId);
        cbsFacilityRepository.findByLoanRefNo(ref).ifPresent(f -> {
            f.setSyncStatus("Synced");
            f.setSyncedAt(LocalDateTime.now().toString());
            cbsFacilityRepository.save(f);
        });
        logAudit(userId, "SYSADMIN", "CBS_SYNC_FACILITY", "Facility", ref, "All", "CBS_SIM", "Synced", "Synchronized facility " + ref);
        return Map.of("success", true, "message", "Facility " + ref + " synced successfully.", "data", res);
    }

    public Map<String, Object> syncCbsCollateral(String collateralId, String userId) {
        String code = collateralId;
        Optional<CbsCollateral> cOpt = cbsCollateralRepository.findById(collateralId);
        if (cOpt.isPresent() && cOpt.get().getCollateralCode() != null) {
            code = cOpt.get().getCollateralCode();
        }
        Map<String, Object> res = cbsSyncService.syncCollateralFromCbs(code, userId);
        cbsCollateralRepository.findByCollateralCode(code).ifPresent(c -> {
            c.setSyncStatus("Synced");
            c.setSyncedAt(LocalDateTime.now().toString());
            cbsCollateralRepository.save(c);
        });
        logAudit(userId, "SYSADMIN", "CBS_SYNC_COLLATERAL", "Collateral", code, "All", "CBS_SIM", "Synced", "Synchronized collateral " + code);
        return Map.of("success", true, "message", "Collateral " + code + " synced successfully.", "data", res);
    }

    public Map<String, Object> syncAllPendingCbs(String userId) {
        Map<String, Object> batchRes = cbsSyncService.syncAllFromCbs(userId);
        for (CbsCustomer c : cbsCustomerRepository.findAll()) {
            c.setSyncStatus("Synced");
            c.setSyncedAt(LocalDateTime.now().toString());
            cbsCustomerRepository.save(c);
        }
        for (CbsFacility f : cbsFacilityRepository.findAll()) {
            f.setSyncStatus("Synced");
            f.setSyncedAt(LocalDateTime.now().toString());
            cbsFacilityRepository.save(f);
        }
        for (CbsCollateral col : cbsCollateralRepository.findAll()) {
            col.setSyncStatus("Synced");
            col.setSyncedAt(LocalDateTime.now().toString());
            cbsCollateralRepository.save(col);
        }
        for (CbsAccCollLinkDtls l : cbsAccCollLinkDtlsRepository.findAll()) {
            l.setSyncStatus("Synced");
            l.setSyncedAt(LocalDateTime.now().toString());
            cbsAccCollLinkDtlsRepository.save(l);
        }
        logAudit(userId, "SYSADMIN", "CBS_SYNC_ALL", "CBS", "ALL", "All", "CBS_SIM", "Synced", "Batch sync completed via CbsSyncService");
        Map<String, Object> res = new HashMap<>(batchRes);
        res.put("success", true);
        res.put("message", "Batch sync completed successfully.");
        return res;
    }

    // --- Outbound Notifications Engine ---
    public void sendNotification(String channel, String templateCode, String recipient, String recipientName, String defaultSubject, String defaultBody, String entityType, String entityId, Map<String, Object> context) {
        if (notificationService != null) {
            notificationService.sendNotification(channel, templateCode, recipient, recipientName, defaultSubject, defaultBody, entityType, entityId, context);
            return;
        }
        try {
            Map<String, Object> ctx = context != null ? new HashMap<>(context) : new HashMap<>();
            ctx.putIfAbsent("Customer Name", recipientName != null ? recipientName : "Valued Customer");
            ctx.putIfAbsent("Maker ID", recipientName != null ? recipientName : "Maker");
            ctx.putIfAbsent("Entity ID", entityId != null ? entityId : "");

            Map<String, String> rendered = notificationTemplateService != null
                ? notificationTemplateService.render(templateCode, channel, defaultSubject, defaultBody, ctx)
                : Map.of("subject", defaultSubject, "body", defaultBody);

            Notification n = new Notification();
            n.setId("notif-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
            n.setChannel(channel != null ? channel : "Email");
            n.setTemplateCode(templateCode != null ? templateCode : "GENERAL_ALERT");
            n.setRecipient(recipient != null ? recipient : "alerts@cims-bank.et");
            n.setRecipientName(recipientName != null ? recipientName : "CIMS User");
            n.setSubject(rendered.getOrDefault("subject", defaultSubject));
            n.setMessageBody(rendered.getOrDefault("body", defaultBody));
            n.setEntityType(entityType);
            n.setEntityId(entityId);
            n.setStatus("Sent");
            n.setSentAt(LocalDateTime.now().toString());
            n.setRetryCount(0);
            notificationRepository.save(n);
        } catch (Exception e) {
            try {
                Notification failed = new Notification();
                failed.setId("notif-failed-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
                failed.setChannel(channel != null ? channel : "Email");
                failed.setTemplateCode(templateCode != null ? templateCode : "GENERAL_ALERT");
                failed.setRecipient(recipient != null && !recipient.isBlank() ? recipient : "unknown");
                failed.setRecipientName(recipientName);
                failed.setSubject(defaultSubject);
                failed.setMessageBody(defaultBody != null ? defaultBody : "");
                failed.setEntityType(entityType); failed.setEntityId(entityId);
                failed.setStatus("Failed"); failed.setSentAt(LocalDateTime.now().toString()); failed.setErrorMessage(e.getMessage());
                notificationRepository.save(failed);
            } catch (Exception ignored) { }
            logAudit("SYSTEM","SYSADMIN","NOTIFICATION_FAILED",entityType,entityId,"Error","",""+e.getMessage(),"Notification processing failed and was recorded.");
        }
    }

    public void sendNotification(String channel, String templateCode, String recipient, String recipientName, String subject, String messageBody, String entityType, String entityId) {
        sendNotification(channel, templateCode, recipient, recipientName, subject, messageBody, entityType, entityId, Collections.emptyMap());
    }

    // --- Maker-Checker Dual Control & Workflow ---
    public WorkflowTask submitToWorkflow(String processKey, String entityType, String entityId, String actionType, String diffJson, String remarks, String makerId, String candidateRole) {
        WorkflowTask task = new WorkflowTask();
        task.setId("task-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
        task.setEntityType(entityType);
        task.setEntityId(entityId);
        task.setActionType(actionType);
        task.setPayloadDiffJson(diffJson);
        task.setRemarks(remarks);
        task.setMakerId(makerId != null ? makerId : "CRO_USER");

        // Dynamically resolve target role and SLA from SysAdmin Approval Hierarchy Configs
        String resolvedRole = candidateRole;
        int sla = 24;
        List<ApprovalHierarchyConfig> configs = approvalHierarchyConfigRepository.findAll();
        for (ApprovalHierarchyConfig cfg : configs) {
            if (!cfg.isActive()) continue;
            String tt = cfg.getTransactionType() != null ? cfg.getTransactionType().toLowerCase().replace("_", " ").replace("proc ", "").trim() : "";
            String act = actionType != null ? actionType.toLowerCase().replace("_", " ").replace("proc ", "").trim() : "";
            String pk = processKey != null ? processKey.toLowerCase().replace("_", " ").replace("proc ", "").trim() : "";

            if ((!tt.isEmpty() && (act.contains(tt) || tt.contains(act) || pk.contains(tt) || tt.contains(pk))) ||
                (cfg.getTransactionType() != null && (cfg.getTransactionType().equalsIgnoreCase(processKey) || cfg.getTransactionType().equalsIgnoreCase(actionType)))) {
                if (cfg.getLevel1Role() != null && !cfg.getLevel1Role().isBlank()) {
                    resolvedRole = cfg.getLevel1Role();
                    sla = cfg.getSlaHours() > 0 ? cfg.getSlaHours() : 24;
                }
                break;
            }
        }
        if (resolvedRole == null || resolvedRole.isBlank()) {
            resolvedRole = "BRMGR";
        }
        task.setCandidateRole(resolvedRole);
        final String finalResolvedRole = resolvedRole;
        // Store a concrete checker when one exists. The role remains the primary
        // routing key so multiple authorized checkers can see the task.
        userRepository.findAll().stream()
                .filter(u -> u.isActive() && u.getRole() != null && finalResolvedRole.equalsIgnoreCase(u.getRole()))
                .findFirst()
                .ifPresent(u -> task.setCandidateUserId(u.getUsername()));
        task.setCurrentStep("Checker Review");
        task.setPriority("High");
        task.setStatus("Pending");
        task.setSubmittedAt(LocalDateTime.now().toString());

        // The CIMS workflow task is the authoritative business inbox record.
        // Persist it BEFORE attempting optional Flowable integration so a Flowable
        // configuration/runtime problem can never prevent the submission from
        // reaching the Checker inbox.
        workflowTaskRepository.saveAndFlush(task);

        if (flowableWorkflowService != null) {
            try {
                String procId = flowableWorkflowService.startMakerCheckerProcess(processKey, entityType, entityId, makerId, task.getCandidateRole(), diffJson, remarks);
                task.setProcessInstanceId(procId);
                workflowTaskRepository.save(task);
            } catch (Exception e) {
                // Internal CIMS workflow remains valid. Record the integration
                // failure in audit rather than losing the business task.
                logAudit("SYSTEM", "SYSADMIN", "FLOWABLE_START_FAILED", entityType, entityId,
                        "Process", processKey, e.getMessage(), "CIMS internal approval workflow retained task despite Flowable error.");
            }
        }
        logAudit(makerId, "MAKER", "SUBMIT_WORKFLOW_TASK", entityType, entityId, "Status", "Draft", "Pending Approval", "Submitted " + actionType + " to Checker (" + task.getCandidateRole() + ", SLA " + sla + "h)");

        // Outbound Notifications for Checker
        sendNotification(
            "Email",
            "WORKFLOW_CHECKER_ALERT",
            "brmgr@cims-bank.et",
            "Branch Manager Checker",
            "Dual Control Authorization Required: " + actionType,
            "Dear Checker,\n\nA new maker submission requires your dual-control authorization:\n" +
            "• Entity Type: " + entityType + "\n" +
            "• Reference: " + entityId + "\n" +
            "• Action: " + actionType + "\n" +
            "• Submitted By Maker: " + makerId + "\n" +
            "• Remarks: " + (remarks != null ? remarks : "N/A") + "\n\n" +
            "Please log in to CIMS Maker-Checker Inbox or Branch Manager Dashboard to review before authorization.",
            entityType,
            entityId
        );

        sendNotification(
            "SMS",
            "WORKFLOW_CHECKER_SMS",
            "+251911000111",
            "Branch Manager",
            "CIMS Dual-Control Alert",
            "CIMS Alert: Maker " + makerId + " submitted " + actionType + " for " + entityType + " (" + entityId + ") awaiting your authorization.",
            entityType,
            entityId
        );

        return task;
    }

    public void handleWorkflowApproval(String entityType, String entityId, String checkerId, String comments) {
        if ("Insurance Policy".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            InsurancePolicy p = insurancePolicyRepository.findById(entityId)
                    .or(() -> insurancePolicyRepository.findByPolicyNumber(entityId))
                    .orElseThrow(() -> new IllegalStateException("Insurance Policy not found: " + entityId));
            validationService.validatePolicyForActivation(p);
            p.setStatus("Active"); p.setRecordStat("O"); p.setAuthStat("A");
            p.setCheckerId(checkerId); p.setCheckerDtStamp(LocalDateTime.now().toString()); p.setOnceAuth("Y");
            insurancePolicyRepository.save(p);
            if (p.getCollateralId() != null) {
                updateCollateralStatus(p.getCollateralId());
            }
        } else if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral c = collateralRepository.findById(entityId)
                    .or(() -> collateralRepository.findByCode(entityId))
                    .orElseThrow(() -> new IllegalStateException("Collateral not found: " + entityId));
            validationService.validateCollateralForActivation(c);
            c.setRecordStat("O"); c.setAuthStat("A"); c.setStatus("Active");
            c.setCheckerId(checkerId); c.setCheckerDtStamp(LocalDateTime.now().toString()); c.setOnceAuth("Y");
            collateralRepository.save(c);
            updateCollateralStatus(c.getId());
        } else if ("Customer".equalsIgnoreCase(entityType)) {
            Customer c = customerRepository.findById(entityId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(entityId))
                    .orElseThrow(() -> new IllegalStateException("Customer not found: " + entityId));
            c.setRecordStat("O"); c.setAuthStat("A"); c.setCheckerId(checkerId);
            c.setCheckerDtStamp(LocalDateTime.now().toString()); c.setOnceAuth("Y");
            customerRepository.save(c);
        } else if ("Document".equalsIgnoreCase(entityType) || "Ownership Document".equalsIgnoreCase(entityType) || "Collateral Document".equalsIgnoreCase(entityType) || "OwnershipDocument".equalsIgnoreCase(entityType)) {
            OwnershipDocument doc = ownershipDocumentRepository.findById(entityId)
                    .orElseGet(() -> ownershipDocumentRepository.findAll().stream()
                            .filter(d -> entityId.equalsIgnoreCase(d.getId()) || entityId.equalsIgnoreCase(d.getName()))
                            .findFirst()
                            .orElseThrow(() -> new IllegalStateException("Document not found: " + entityId)));
            doc.setVerificationStatus("Verified");
            doc.setStatus("Active");
            ownershipDocumentRepository.save(doc);
            if (doc.getCollateralId() != null) {
                updateCollateralStatus(doc.getCollateralId());
            }
        } else {
            logAudit(checkerId, "CHECKER", "APPROVE_WORKFLOW_GENERIC", entityType, entityId, "Status", "Pending", "Approved", comments);
        }
    }

    public void handleWorkflowRejection(String entityType, String entityId, String checkerId, String comments) {
        if ("Insurance Policy".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            InsurancePolicy p = insurancePolicyRepository.findById(entityId)
                    .or(() -> insurancePolicyRepository.findByPolicyNumber(entityId))
                    .orElseThrow(() -> new IllegalStateException("Insurance Policy not found: " + entityId));
            p.setStatus("Rejected"); p.setRecordStat("R"); p.setAuthStat("R");
            p.setCheckerId(checkerId); p.setCheckerDtStamp(LocalDateTime.now().toString());
            insurancePolicyRepository.save(p);
            if (p.getCollateralId() != null) {
                updateCollateralStatus(p.getCollateralId());
            }
        } else if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral c = collateralRepository.findById(entityId)
                    .or(() -> collateralRepository.findByCode(entityId))
                    .orElseThrow(() -> new IllegalStateException("Collateral not found: " + entityId));
            c.setStatus("Rejected"); c.setRecordStat("R"); c.setAuthStat("R"); c.setVerificationStatus("Rejected");
            c.setCheckerId(checkerId); c.setCheckerDtStamp(LocalDateTime.now().toString());
            collateralRepository.save(c);
            updateCollateralStatus(c.getId());
        } else if ("Customer".equalsIgnoreCase(entityType)) {
            Customer c = customerRepository.findById(entityId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(entityId))
                    .orElseThrow(() -> new IllegalStateException("Customer not found: " + entityId));
            c.setRecordStat("R"); c.setAuthStat("R"); c.setCheckerId(checkerId);
            c.setCheckerDtStamp(LocalDateTime.now().toString()); customerRepository.save(c);
        } else if ("Document".equalsIgnoreCase(entityType) || "Ownership Document".equalsIgnoreCase(entityType) || "Collateral Document".equalsIgnoreCase(entityType) || "OwnershipDocument".equalsIgnoreCase(entityType)) {
            OwnershipDocument doc = ownershipDocumentRepository.findById(entityId)
                    .orElseGet(() -> ownershipDocumentRepository.findAll().stream()
                            .filter(d -> entityId.equalsIgnoreCase(d.getId()) || entityId.equalsIgnoreCase(d.getName()))
                            .findFirst()
                            .orElseThrow(() -> new IllegalStateException("Document not found: " + entityId)));
            doc.setVerificationStatus("Rejected");
            doc.setStatus("Rejected");
            ownershipDocumentRepository.save(doc);
        } else {
            logAudit(checkerId, "CHECKER", "REJECT_WORKFLOW_GENERIC", entityType, entityId, "Status", "Pending", "Rejected", comments);
        }
    }

    private void validateDualControl(WorkflowTask task, String checkerId) {
        if (!configurationService.isDualControlStrictEnabled()) return;
        if (task.getMakerId() != null && checkerId != null) {
            String cleanMaker = task.getMakerId().trim().toLowerCase();
            String cleanChecker = checkerId.trim().toLowerCase();
            if (cleanMaker.equals(cleanChecker) ||
                cleanMaker.replace("_user", "").equals(cleanChecker.replace("_user", "")) ||
                cleanMaker.equals(cleanChecker + "_user") ||
                (cleanMaker + "_user").equals(cleanChecker)) {
                throw new IllegalStateException("Dual-Control Violation: Maker (" + task.getMakerId() + ") cannot authorize their own submission. Segregation of duties (Four-Eyes Principle) strictly requires an independent Checker.");
            }
        }
    }

    public String resolveCustomerApproverRole() {
        return roleHierarchyService.resolveApproverRole("PROC_CUSTOMER_REGISTRATION", "Register Customer Manually", "BRMGR");
    }

    private static final String MAINTAIN_PREFIX = "Maintain ";

    private boolean isMaintenanceAction(String actionType) {
        return actionType != null && actionType.startsWith(MAINTAIN_PREFIX);
    }

    /**
     * Submits a change to an already-authorized Customer record for checker approval.
     * The record itself is left untouched (still visible/usable as-is) until the checker
     * approves; the requested field changes travel with the workflow task as JSON and are
     * applied atomically at approval time by {@link #applyMaintenanceApproval}.
     */
    @Transactional
    public WorkflowTask requestCustomerMaintenance(String customerId, Map<String, Object> changes, String userId) {
        Customer customer = customerRepository.findById(customerId)
                .or(() -> customerRepository.findFirstByCifIgnoreCase(customerId))
                .orElseThrow(() -> new IllegalStateException("Customer not found: " + customerId));
        if (!"A".equalsIgnoreCase(customer.getAuthStat())) {
            throw new IllegalStateException("This customer record already has a pending transaction. Wait for it to clear before submitting another change.");
        }
        if (changes == null || changes.isEmpty()) {
            throw new IllegalStateException("No changes were provided.");
        }
        String diffJson;
        try {
            diffJson = objectMapper.writeValueAsString(changes);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to encode requested changes: " + e.getMessage());
        }
        String approverRole = roleHierarchyService.resolveApproverRole("PROC_CUSTOMER_MAINTENANCE", "Maintain Customer Details", "BRMGR");
        WorkflowTask task = submitToWorkflow("PROC_CUSTOMER_MAINTENANCE", "Customer", customer.getId(),
                MAINTAIN_PREFIX + "Customer Details", diffJson,
                "Maintenance request for " + customer.getName() + " (" + customer.getCif() + ")", userId, approverRole);
        logAudit(userId, "MAKER", "REQUEST_CUSTOMER_MAINTENANCE", "Customer", customer.getId(), "Fields", "-", changes.keySet().toString(), "Submitted customer detail changes for checker approval");
        return task;
    }

    /**
     * Same pattern as {@link #requestCustomerMaintenance} for Collateral records: valuation,
     * haircut, review date and similar fields can be amended post-registration, but only
     * through the maker-checker path, never in place.
     */
    @Transactional
    public WorkflowTask requestCollateralMaintenance(String collateralId, Map<String, Object> changes, String userId) {
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalStateException("Collateral not found: " + collateralId));
        if (!"A".equalsIgnoreCase(collateral.getAuthStat())) {
            throw new IllegalStateException("This collateral record already has a pending transaction. Wait for it to clear before submitting another change.");
        }
        if (changes == null || changes.isEmpty()) {
            throw new IllegalStateException("No changes were provided.");
        }
        String diffJson;
        try {
            diffJson = objectMapper.writeValueAsString(changes);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to encode requested changes: " + e.getMessage());
        }
        String approverRole = roleHierarchyService.resolveApproverRole("PROC_COLLATERAL_MAINTENANCE", "Maintain Collateral Details", "BRMGR");
        WorkflowTask task = submitToWorkflow("PROC_COLLATERAL_MAINTENANCE", "Collateral", collateral.getId(),
                MAINTAIN_PREFIX + "Collateral Details", diffJson,
                "Maintenance request for " + collateral.getCode() + " (" + collateral.getDescription() + ")", userId, approverRole);
        logAudit(userId, "MAKER", "REQUEST_COLLATERAL_MAINTENANCE", "Collateral", collateral.getId(), "Fields", "-", changes.keySet().toString(), "Submitted collateral detail changes for checker approval");
        return task;
    }

    /**
     * Applies the JSON field diff carried by a "Maintain ..." workflow task onto the real
     * entity, then marks it authorized. Unknown/unsettable JSON keys are ignored rather
     * than failing the whole approval, since the diff is intentionally a partial patch.
     */
    private void applyMaintenanceApproval(WorkflowTask task, String checkerId) {
        String diff = task.getPayloadDiffJson();
        if (diff == null || diff.isBlank()) diff = "{}";
        try {
            if ("Customer".equalsIgnoreCase(task.getEntityType())) {
                Customer customer = customerRepository.findById(task.getEntityId())
                        .or(() -> customerRepository.findFirstByCifIgnoreCase(task.getEntityId()))
                        .orElseThrow(() -> new IllegalStateException("Customer not found: " + task.getEntityId()));
                objectMapper.readerForUpdating(customer).readValue(diff);
                customer.setRecordStat("O");
                customer.setAuthStat("A");
                customer.setCheckerId(checkerId);
                customer.setCheckerDtStamp(LocalDateTime.now().toString());
                customerRepository.save(customer);
            } else if ("Collateral".equalsIgnoreCase(task.getEntityType())) {
                Collateral collateral = collateralRepository.findById(task.getEntityId())
                        .or(() -> collateralRepository.findByCode(task.getEntityId()))
                        .orElseThrow(() -> new IllegalStateException("Collateral not found: " + task.getEntityId()));
                objectMapper.readerForUpdating(collateral).readValue(diff);
                collateral.setRecordStat("O");
                collateral.setAuthStat("A");
                collateral.setCheckerId(checkerId);
                collateral.setCheckerDtStamp(LocalDateTime.now().toString());
                collateralRepository.save(collateral);
                updateCollateralStatus(collateral.getId());
            } else {
                throw new IllegalStateException("Unsupported maintenance entity type: " + task.getEntityType());
            }
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Unable to apply requested changes: " + e.getMessage());
        }
    }

    @Transactional
    public Map<String, Object> changeCollateralOwnership(String collateralId, Map<String, Object> payload, String userId) {
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        String currentOwnerId = (String) payload.get("currentOwnerId");
        String newOwnerName = (String) payload.get("newOwnerName");
        if (newOwnerName == null || newOwnerName.isBlank()) {
            throw new IllegalArgumentException("New owner name is mandatory.");
        }
        String newOwnershipType = (String) payload.get("newOwnershipType");
        if (newOwnershipType == null || newOwnershipType.isBlank()) {
            newOwnershipType = collateral.getOwnerType() != null ? collateral.getOwnerType() : "Borrower-owned";
        }
        String newOwnerType = (String) payload.getOrDefault("newOwnerType", "Individual");
        String effectiveDate = (String) payload.getOrDefault("effectiveDate", LocalDateTime.now().toString().substring(0, 10));
        String reason = (String) payload.getOrDefault("reason", "Ownership change requested");
        String remarks = (String) payload.getOrDefault("remarks", "");
        String idNumber = (String) payload.get("idNumber");
        String tin = (String) payload.get("tin");
        String phone = (String) payload.get("phone");
        String address = (String) payload.get("address");
        String relationship = (String) payload.getOrDefault("relationship", "Third-Party");
        String relationshipToBorrower = (String) payload.get("relationshipToBorrower");
        String consentInfo = (String) payload.get("consentInfo");
        String pledgeAgreementRef = (String) payload.get("pledgeAgreementRef");
        
        double ownershipPercentage = 100.0;
        if (payload.get("ownershipPercentage") != null) {
            try {
                ownershipPercentage = Double.parseDouble(payload.get("ownershipPercentage").toString());
            } catch (Exception ignored) {}
        }

        String prevOwnerName = "N/A";
        // Supersede previous owner in history without deleting historical record
        if (collateral.getOwners() != null) {
            for (CollateralOwner owner : collateral.getOwners()) {
                if ((currentOwnerId != null && owner.getId().equals(currentOwnerId)) || (currentOwnerId == null && owner.getSupersededDate() == null)) {
                    owner.setSupersededDate(effectiveDate);
                    owner.setStatus("Historical");
                    owner.setEffectiveTo(effectiveDate);
                    prevOwnerName = owner.getName();
                }
            }
        }

        // Add new active owner
        CollateralOwner newOwner = new CollateralOwner("own-" + System.currentTimeMillis(), newOwnerName, phone, collateral.getId(), relationship, ownershipPercentage);
        newOwner.setOwnershipType(newOwnershipType);
        newOwner.setOwnerType(newOwnerType);
        newOwner.setIdNumber(idNumber);
        newOwner.setBusinessRegNo((String) payload.get("businessRegNo"));
        newOwner.setTin(tin);
        newOwner.setContactInfo(address);
        newOwner.setRelationshipToBorrower(relationshipToBorrower);
        newOwner.setConsentInfo(consentInfo);
        newOwner.setPledgeAgreementRef(pledgeAgreementRef);
        newOwner.setStatus("Active");
        newOwner.setEffectiveFrom(effectiveDate);
        newOwner.setTransferReason(reason);
        newOwner.setSupportingDocRef((String) payload.get("supportingDocRef"));
        newOwner.setRemarks("Reason: " + reason + (remarks != null && !remarks.isBlank() ? " | Remarks: " + remarks : ""));
        newOwner.setVerificationStatus("Recorded");
        newOwner.setVerificationDate(effectiveDate);
        newOwner.setVerifyingOfficer(userId);
        newOwner.setMakerId(userId);
        newOwner.setMakerDtStamp(LocalDateTime.now().toString());
        newOwner.setRecordStat("O");
        newOwner.setAuthStat("U"); // Requires checker authorization

        if (collateral.getOwners() == null) {
            collateral.setOwners(new ArrayList<>());
        }
        collateral.getOwners().add(newOwner);
        collateral.setOwnerType(newOwnershipType);
        collateral.setAuthStat("U");

        // Associate supporting document if provided in payload
        if (payload.containsKey("supportingDocument") && payload.get("supportingDocument") != null) {
            Object supDocObj = payload.get("supportingDocument");
            if (supDocObj instanceof Map) {
                Map<String, Object> docMap = (Map<String, Object>) supDocObj;
                String docName = (String) docMap.getOrDefault("name", "Ownership Change Supporting Document - " + newOwnerName);
                String docType = (String) docMap.getOrDefault("type", "Third-Party Consent and Pledge Agreement");
                String fileName = (String) docMap.getOrDefault("fileName", "ownership_transfer.pdf");
                String fileContent = (String) docMap.get("fileContent");
                uploadDocument("Collateral", collateral.getId(), docName, docType, fileName, 102400L, "application/pdf", fileContent, "Supporting document for ownership transfer from " + prevOwnerName + " to " + newOwnerName, userId, null, null, "Ownership transfer document", false);
            } else if (supDocObj instanceof String && !((String) supDocObj).isBlank()) {
                newOwner.setSupportingDocRef((String) supDocObj);
            }
        }

        // Validate ownership per central banking rules
        validationService.validateOwnership(collateral);

        collateralRepository.save(collateral);
        logAudit(userId, "CRO", "CHANGE_COLLATERAL_OWNERSHIP", "Collateral", collateral.getId(), "Owner", prevOwnerName, newOwnerName, reason);

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("message", "Ownership changed successfully. Historical ownership retained.");
        resp.put("collateral", collateral);
        return resp;
    }

    @Transactional
    public void approveWorkflowTask(String taskId, String checkerId, String checkerRole, String comments) {
        workflowExecutionService.approveWorkflowTask(taskId, checkerId, checkerRole, comments);
    }

    @Transactional
    public void rejectWorkflowTask(String taskId, String checkerId, String checkerRole, String comments) {
        workflowExecutionService.rejectWorkflowTask(taskId, checkerId, checkerRole, comments);
    }

    @Transactional
    public void returnWorkflowTask(String taskId, String checkerId, String checkerRole, String correctionNote) {
        workflowExecutionService.returnWorkflowTask(taskId, checkerId, checkerRole, correctionNote);
    }

    private void handleWorkflowReturn(String entityType, String entityId, String checkerId, String note) {
        if ("Insurance Policy".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            InsurancePolicy p = insurancePolicyRepository.findById(entityId)
                    .or(() -> insurancePolicyRepository.findByPolicyNumber(entityId))
                    .orElseThrow(() -> new IllegalStateException("Insurance Policy not found: " + entityId));
            p.setStatus("Draft"); p.setRecordStat("U"); p.setAuthStat("U");
            p.setCheckerId(checkerId); p.setCheckerDtStamp(LocalDateTime.now().toString());
            insurancePolicyRepository.save(p);
            if (p.getCollateralId() != null) {
                updateCollateralStatus(p.getCollateralId());
            }
        } else if ("Collateral".equalsIgnoreCase(entityType)) {
            Collateral c = collateralRepository.findById(entityId)
                    .or(() -> collateralRepository.findByCode(entityId))
                    .orElseThrow(() -> new IllegalStateException("Collateral not found: " + entityId));
            c.setStatus("Uninsured"); c.setVerificationStatus("Pending"); c.setRecordStat("U"); c.setAuthStat("U");
            c.setCheckerId(checkerId); c.setCheckerDtStamp(LocalDateTime.now().toString());
            collateralRepository.save(c);
            updateCollateralStatus(c.getId());
        } else if ("Customer".equalsIgnoreCase(entityType)) {
            Customer c = customerRepository.findById(entityId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(entityId))
                    .orElseThrow(() -> new IllegalStateException("Customer not found: " + entityId));
            c.setRecordStat("U"); c.setAuthStat("U"); c.setCheckerId(checkerId);
            c.setCheckerDtStamp(LocalDateTime.now().toString()); cimsCustomerSave(c);
        } else if ("Document".equalsIgnoreCase(entityType) || "Ownership Document".equalsIgnoreCase(entityType) || "Collateral Document".equalsIgnoreCase(entityType) || "OwnershipDocument".equalsIgnoreCase(entityType)) {
            OwnershipDocument doc = ownershipDocumentRepository.findById(entityId)
                    .orElseGet(() -> ownershipDocumentRepository.findAll().stream()
                            .filter(d -> entityId.equalsIgnoreCase(d.getId()) || entityId.equalsIgnoreCase(d.getName()))
                            .findFirst()
                            .orElseThrow(() -> new IllegalStateException("Document not found: " + entityId)));
            doc.setVerificationStatus("Pending");
            ownershipDocumentRepository.save(doc);
        } else {
            logAudit(checkerId, "CHECKER", "RETURN_WORKFLOW_GENERIC", entityType, entityId, "Status", "Pending", "Returned", note);
        }
    }

    private void cimsCustomerSave(Customer customer) {
        customerRepository.save(customer);
    }

    @Transactional
    public void resubmitReturnedWorkflowTask(String taskId, String makerId) {
        WorkflowTask task = workflowTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalStateException("Workflow task not found: " + taskId));
        if (!"Returned".equalsIgnoreCase(task.getStatus())) throw new IllegalStateException("Only returned tasks can be resubmitted.");
        if (makerId == null || makerId.isBlank()) throw new IllegalStateException("Maker user is required.");
        String tm = task.getMakerId() == null ? "" : task.getMakerId().replace("_user", "");
        String mm = makerId.replace("_user", "");
        if (!tm.equalsIgnoreCase(mm)) throw new IllegalStateException("Only the original maker can resubmit this returned task.");

        // Restore the underlying business entity state to pending review. A maintenance
        // request's base record is already authorized and stays that way - only the task
        // itself goes back to Pending so the checker can review the (maker-edited) diff.
        String entityType = task.getEntityType();
        String entityId = task.getEntityId();
        if (isMaintenanceAction(task.getActionType())) {
            // no entity-level state change needed
        } else if ("Insurance Policy".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            insurancePolicyRepository.findById(entityId)
                    .or(() -> insurancePolicyRepository.findByPolicyNumber(entityId))
                    .ifPresent(p -> {
                        p.setStatus("Pending Approval");
                        p.setRecordStat("U");
                        p.setAuthStat("U");
                        p.setMakerId(makerId);
                        p.setMakerDtStamp(LocalDateTime.now().toString());
                        insurancePolicyRepository.save(p);
                    });
        } else if ("Collateral".equalsIgnoreCase(entityType)) {
            collateralRepository.findById(entityId)
                    .or(() -> collateralRepository.findByCode(entityId))
                    .ifPresent(c -> {
                        c.setVerificationStatus("Pending");
                        c.setRecordStat("U");
                        c.setAuthStat("U");
                        c.setMakerId(makerId);
                        c.setMakerDtStamp(LocalDateTime.now().toString());
                        collateralRepository.save(c);
                    });
        } else if ("Customer".equalsIgnoreCase(entityType)) {
            customerRepository.findById(entityId)
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(entityId))
                    .ifPresent(cust -> {
                        cust.setRecordStat("U");
                        cust.setAuthStat("U");
                        customerRepository.save(cust);
                    });
        } else if ("Document".equalsIgnoreCase(entityType) || "Ownership Document".equalsIgnoreCase(entityType) || "Collateral Document".equalsIgnoreCase(entityType) || "OwnershipDocument".equalsIgnoreCase(entityType)) {
            ownershipDocumentRepository.findById(entityId).ifPresent(d -> {
                d.setVerificationStatus("Pending");
                ownershipDocumentRepository.save(d);
            });
        }

        task.setStatus("Pending"); task.setCurrentStep("Checker Review"); task.setCompletedAt(null);
        task.setSubmittedAt(LocalDateTime.now().toString());
        workflowTaskRepository.save(task);
        ApprovalHistory hist = new ApprovalHistory();
        hist.setId("hist-" + System.currentTimeMillis()); hist.setWorkflowTaskId(taskId); hist.setActorId(makerId);
        hist.setActorRole("MAKER"); hist.setStepName("Maker Correction"); hist.setDecision("Resubmitted");
        hist.setComments(task.getRemarks()); hist.setDecidedAt(LocalDateTime.now().toString()); approvalHistoryRepository.save(hist);
        logAudit(makerId, "MAKER", "RESUBMIT_WORKFLOW_TASK", task.getEntityType(), task.getEntityId(), "Status", "Returned", "Pending", "Resubmitted after maker correction");
    }

    public void updateCollateralStatus(String collateralId) {
        Optional<Collateral> colOpt = collateralRepository.findById(collateralId);
        if (colOpt.isEmpty()) return;
        Collateral col = colOpt.get();

        double totalInsured = 0;
        List<InsurancePolicy> policies = insurancePolicyRepository.findByCollateralId(collateralId);
        for (InsurancePolicy p : policies) {
            if (isCoverageActiveStatus(p.getStatus())) {
                totalInsured += p.getInsuredAmount();
            }
        }
        col.setInsuredAmount(totalInsured);

        // Compute total outstanding exposure across all linked facilities
        double totalExposure = 0;
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findAll();
        for (LoanCollateralLink l : links) {
            if (collateralId.equals(l.getCollateralId())) {
                Optional<LoanAccount> loan = loanAccountRepository.findById(l.getLoanAccountId());
                if (loan.isPresent()) {
                    totalExposure += loan.get().getOutstandingBalance();
                }
            }
        }

        double coveragePct = 0;
        if (totalExposure > 0) {
            coveragePct = (totalInsured / totalExposure) * 100.0;
        } else if (col.getValuationAmount() > 0) {
            coveragePct = (totalInsured / col.getValuationAmount()) * 100.0;
        } else if (totalInsured >= col.getValuationAmount()) {
            coveragePct = 100.0;
        }

        double minAdequacyThreshold = configurationService != null ? configurationService.getMinimumCoverageAdequacyPct() : 100.0;
        col.setNetInsuranceCoveragePct(coveragePct);
        if (totalInsured <= 0) {
            col.setStatus("Uninsured");
            col.setInsuranceStatus("Uninsured");
        } else if (coveragePct >= minAdequacyThreshold) {
            col.setStatus("Insured");
            col.setInsuranceStatus("Fully Insured");
        } else {
            col.setStatus("Under-Insured");
            col.setInsuranceStatus("Underinsured");
        }
        collateralRepository.save(col);
    }

    // --- BR-01: Business Segments ---
    public void addBusinessSegment(BusinessSegment segment, String userId) {
        if (segment.getId() == null || segment.getId().isBlank()) {
            segment.setId("seg-" + System.currentTimeMillis());
        }
        if (segment.getRiskProfile() == null || segment.getRiskProfile().isBlank()) {
            segment.setRiskProfile("Medium");
        }
        businessSegmentRepository.save(segment);
        logAudit(userId, "SYSADMIN", "SAVE_BUSINESS_SEGMENT", "BusinessSegment", segment.getId(), "Name", "Old", segment.getName(), "Saved segment " + segment.getName());
    }

    public void toggleSegmentActiveStatus(String segmentId, boolean active, String userId) {
        Optional<BusinessSegment> segOpt = businessSegmentRepository.findById(segmentId);
        if (segOpt.isPresent()) {
            BusinessSegment seg = segOpt.get();
            boolean oldStatus = seg.isActive();
            seg.setActive(active);
            businessSegmentRepository.save(seg);
            logAudit(userId, "SYSADMIN", "TOGGLE_SEGMENT_STATUS", "BusinessSegment", segmentId, "Active", String.valueOf(oldStatus), String.valueOf(active), "Toggled segment active status");
        }
    }

    // --- Native Collateral Registration (RO Maker) ---
    public void registerNativeCollateral(Collateral collateral, String userId) {
        assertUserPermission(userId, "Collateral", "CREATE");
        if (collateral.getId() == null || collateral.getId().isBlank()) {
            collateral.setId("col-" + System.currentTimeMillis());
        }
        if (collateral.getCode() == null || collateral.getCode().isBlank()) {
            collateral.setCode("COL-" + (System.currentTimeMillis() % 100000));
        }
        if (collateral.getType() == null || collateral.getType().isBlank()) {
            collateral.setType(collateral.getCategory() != null ? collateral.getCategory() : "Primary Collateral");
        }
        if (collateral.getCategory() == null || collateral.getCategory().isBlank()) {
            collateral.setCategory("Immovable Properties");
        }
        if (collateral.getDescription() == null || collateral.getDescription().isBlank()) {
            collateral.setDescription("Registered Collateral Asset " + collateral.getCode());
        }
        if (collateral.getOwningSegment() == null || collateral.getOwningSegment().isBlank()) {
            collateral.setOwningSegment("Corporate Banking");
        }
        if (collateral.getBranch() == null || collateral.getBranch().isBlank()) {
            collateral.setBranch("Main Branch");
        }
        if (collateral.getOwnerType() == null || collateral.getOwnerType().isBlank()) {
            collateral.setOwnerType("Borrower-owned");
        }
        if (collateral.getCurrency() == null || collateral.getCurrency().isBlank()) {
            collateral.setCurrency(configurationService.getDefaultCurrency());
        }
        if (collateral.getLimitContribution() == 0 && collateral.getValuationAmount() > 0) {
            collateral.setLimitContribution(collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0)));
        }

        collateral.setCreatedBy(userId);
        collateral.setStatus("Pending Approval");
        collateral.setInsuranceStatus("Uninsured");
        collateral.setVerificationStatus("Recorded");
        collateral.setRecordStat("U");
        collateral.setAuthStat("U");
        collateral.setMakerId(userId);
        collateral.setMakerDtStamp(LocalDateTime.now().toString());
        collateralRepository.save(collateral);

        String approverRole = roleHierarchyService.resolveApproverRole("PROC_COLLATERAL_REGISTRATION", "Register Collateral", "BRMGR");
        submitToWorkflow("PROC_COLLATERAL_REGISTRATION", "Collateral", collateral.getId(), "Register Collateral", "{}", "New collateral registration: " + collateral.getCode() + " (" + collateral.getDescription() + ")", userId, approverRole);
        logAudit(userId, "CRO", "REGISTER_NATIVE_COLLATERAL", "Collateral", collateral.getId(), "All", "None", collateral.getCode(), "Registered collateral for checker approval");
    }

    // --- Link Operations (Validated, Non-Destructive, Audited) ---
    @Transactional
    public void addLink(String loanId, String collateralId, double amount, String userId) {
        addLink(loanId, collateralId, amount, userId, "Primary", null, null);
    }

    @Transactional
    public void addLink(String loanId, String collateralId, double amount, String userId, String linkageType, String effectiveDate, String endDate) {
        com.bank.cims.dto.RelationshipRequestDto req = new com.bank.cims.dto.RelationshipRequestDto();
        req.setCollateralId(collateralId);
        req.setLoanAccountId(loanId);
        req.setAllocatedAmount(amount);
        req.setLinkageType(linkageType != null && !linkageType.trim().isEmpty() ? linkageType : "Primary");
        req.setEffectiveDate(effectiveDate != null && !effectiveDate.trim().isEmpty() ? effectiveDate : LocalDate.now().toString());
        req.setEndDate(endDate);
        collateralFacilityRelationshipService.createRelationship(req, userId);
    }

    @Transactional
    public void removeLink(String linkId, String userId) {
        collateralFacilityRelationshipService.endRelationship(linkId, "Relationship released", userId);
    }

    public Map<String, Object> validateCollateralRelease(String collateralId) {
        Map<String, Object> validation = new HashMap<>();
        try {
            validationService.validateCollateralRelease(collateralId);
            validation.put("canRelease", true);
            validation.put("eligible", true);
            validation.put("pendingExposure", 0.0);
            validation.put("activeLoans", List.of());
            validation.put("message", "Collateral is clear for release.");
        } catch (IllegalArgumentException | IllegalStateException ex) {
            validation.put("canRelease", false);
            validation.put("eligible", false);
            validation.put("reasons", List.of(ex.getMessage()));
            validation.put("message", ex.getMessage());
        }
        return validation;
    }

    // --- Policy Operations ---
    // --- Policy Operations ---
    public void addPolicy(InsurancePolicy policy, String userId) {
        assertUserPermission(userId, "Insurance", "CREATE");
        if (policy.getId() == null || policy.getId().isBlank()) {
            policy.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (policy.getPolicyNumber() == null || policy.getPolicyNumber().isBlank()) {
            throw new IllegalArgumentException("Policy number is mandatory. Auto-generated dummy policy numbers are prohibited.");
        }
        if (policy.getInsurerName() == null || policy.getInsurerName().isBlank()) {
            throw new IllegalArgumentException("Approved insurer selection is mandatory. Default insurer assignment is prohibited.");
        }
        if (policy.getCoverageType() == null || policy.getCoverageType().isBlank()) {
            throw new IllegalArgumentException("Coverage type is mandatory.");
        }
        if (policy.getEffectiveDate() == null || policy.getEffectiveDate().isBlank() ||
            policy.getExpiryDate() == null || policy.getExpiryDate().isBlank()) {
            throw new IllegalArgumentException("Effective date and expiry date are mandatory.");
        }
        if (policy.getInsuredAmount() <= 0) {
            throw new IllegalArgumentException("Insured amount must be greater than zero.");
        }
        if (policy.getPremium() <= 0) {
            throw new IllegalArgumentException("Policy premium must be greater than zero.");
        }

        // Strict Collateral Resolution & Customer Isolation (Zero arbitrary fallback)
        if (policy.getCollateralId() == null || policy.getCollateralId().isBlank()) {
            throw new IllegalArgumentException("A valid collateral must be selected. Policy cannot attach without a linked collateral.");
        }
        Optional<Collateral> colOpt = collateralRepository.findById(policy.getCollateralId());
        if (colOpt.isEmpty()) {
            colOpt = collateralRepository.findByCode(policy.getCollateralId());
        }
        if (colOpt.isEmpty()) {
            throw new IllegalArgumentException("Specified collateral not found: " + policy.getCollateralId() + ". Zero fallback permitted.");
        }
        Collateral col = colOpt.get();
        policy.setCollateralId(col.getId());
        if (policy.getCustomerId() == null || policy.getCustomerId().isBlank()) {
            policy.setCustomerId(col.getCustomerId());
        } else if (!policy.getCustomerId().equalsIgnoreCase(col.getCustomerId())) {
            throw new IllegalArgumentException("Customer isolation violation: Policy customer (" + policy.getCustomerId() + ") does not match collateral owner (" + col.getCustomerId() + ").");
        }

        boolean isDraft = "Draft".equalsIgnoreCase(policy.getStatus());
        if (!isDraft) {
            validationService.validatePolicyForActivation(policy);
        }
        if (isDraft) {
            policy.setStatus("Draft");
            policy.setRecordStat("U");
            policy.setAuthStat("U");
        } else {
            policy.setStatus("Pending Approval");
            policy.setRecordStat("U");
            policy.setAuthStat("U");
        }

        policy.setMakerId(userId);
        policy.setMakerDtStamp(LocalDateTime.now().toString());
        policy.setVersion(1);
        policy.setHistoryJson("[{\"version\":1,\"changedAt\":\"" + LocalDateTime.now() + "\",\"changedBy\":\"" + userId + "\",\"description\":\"Policy Created (" + policy.getStatus() + ")\",\"dataSnapshot\":\"{}\"}]");
        insurancePolicyRepository.save(policy);

        if (!isDraft) {
            WorkflowActionResultDto wf = workflowExecutionService.submitToWorkflow(
                    "Insurance Policy", policy.getId(), "POLICY_REGISTRATION", userId,
                    "New policy registration: " + policy.getPolicyNumber() + " (" + policy.getCoverageType() + ")", null);
            logAudit(userId, "CRO", "SUBMIT_POLICY_CHECKER", "Insurance Policy", policy.getId(), "Status", "Draft", "Pending Approval", "Submitted policy " + policy.getPolicyNumber() + " for checker authorization");

            PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), policy.getId(),
                    "REGISTRATION_SUBMITTED", "Draft", "Pending Approval", 1, userId, "MAKER",
                    LocalDateTime.now().toString(), "Submitted for checker authorization", wf.getWorkflowTaskId(), null);
            policyHistoryRepository.save(ph);
        } else {
            logAudit(userId, "CRO", "CREATE_POLICY_DRAFT", "Insurance Policy", policy.getId(), "Status", "None", "Draft", "Created policy draft " + policy.getPolicyNumber());
            PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), policy.getId(),
                    "DRAFT_CREATED", "None", "Draft", 1, userId, "MAKER",
                    LocalDateTime.now().toString(), "Created policy draft", null, null);
            policyHistoryRepository.save(ph);
        }
    }

    @Transactional
    public void submitPolicyForApproval(String policyId, String userId) {
        if (policyId == null || policyId.isBlank()) {
            throw new IllegalArgumentException("Policy ID is required for submission.");
        }
        Optional<InsurancePolicy> policyOpt = insurancePolicyRepository.findById(policyId);
        if (policyOpt.isEmpty()) policyOpt = insurancePolicyRepository.findByPolicyNumber(policyId);
        InsurancePolicy policy = policyOpt.orElseThrow(() -> new IllegalArgumentException("Insurance policy not found: " + policyId));
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("Maker user is required.");
        if ("Active".equalsIgnoreCase(policy.getStatus())) throw new IllegalStateException("Policy is already active and does not require registration approval.");
        if ("Pending Approval".equalsIgnoreCase(policy.getStatus())) throw new IllegalStateException("Policy is already pending checker approval.");
        validationService.validatePolicyForActivation(policy);
        policy.setStatus("Pending Approval");
        policy.setRecordStat("U");
        policy.setAuthStat("U");
        policy.setMakerId(userId);
        policy.setMakerDtStamp(LocalDateTime.now().toString());
        insurancePolicyRepository.saveAndFlush(policy);

        WorkflowActionResultDto wf = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", policy.getId(), "POLICY_REGISTRATION", userId,
                "Submitted policy " + policy.getPolicyNumber() + " for checker authorization", null);
        logAudit(userId, "CRO", "SUBMIT_POLICY_CHECKER", "Insurance Policy", policy.getId(), "Status", "Draft", "Pending Approval", "Submitted policy " + policy.getPolicyNumber());

        PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), policy.getId(),
                "REGISTRATION_SUBMITTED", "Draft", "Pending Approval", policy.getVersion(), userId, "MAKER",
                LocalDateTime.now().toString(), "Submitted policy for checker approval", wf.getWorkflowTaskId(), null);
        policyHistoryRepository.save(ph);
    }

    public void approvePolicy(String policyId, String userId) {
        assertUserPermission(userId, "Approvals", "APPROVE");
        InsurancePolicy policy = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        WorkflowTask task = workflowTaskRepository.findAll().stream()
                .filter(t -> ("Insurance Policy".equalsIgnoreCase(t.getEntityType()) || "Policy".equalsIgnoreCase(t.getEntityType())) &&
                        (policy.getId().equalsIgnoreCase(t.getEntityId()) || (policy.getPolicyNumber() != null && policy.getPolicyNumber().equalsIgnoreCase(t.getEntityId()))) &&
                        "Pending".equalsIgnoreCase(t.getStatus()))
                .findFirst()
                .orElse(null);

        if (task == null) {
            throw new IllegalStateException("Workflow state mismatch: Cannot approve policy " + policy.getPolicyNumber() + " because no matching pending workflow approval task exists for this policy.");
        }
        workflowExecutionService.approveWorkflowTask(task.getId(), userId, "BRMGR", "Approved policy " + policy.getPolicyNumber());
    }

    public void rejectPolicy(String policyId, String comments, String userId) {
        assertUserPermission(userId, "Approvals", "APPROVE");
        InsurancePolicy policy = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        WorkflowTask task = workflowTaskRepository.findAll().stream()
                .filter(t -> ("Insurance Policy".equalsIgnoreCase(t.getEntityType()) || "Policy".equalsIgnoreCase(t.getEntityType())) &&
                        (policy.getId().equalsIgnoreCase(t.getEntityId()) || (policy.getPolicyNumber() != null && policy.getPolicyNumber().equalsIgnoreCase(t.getEntityId()))) &&
                        "Pending".equalsIgnoreCase(t.getStatus()))
                .findFirst()
                .orElse(null);

        if (task == null) {
            throw new IllegalStateException("Workflow state mismatch: Cannot reject policy " + policy.getPolicyNumber() + " because no matching pending workflow approval task exists for this policy.");
        }
        workflowExecutionService.rejectWorkflowTask(task.getId(), userId, "BRMGR", comments);
    }

    public void amendPolicy(String policyId, InsurancePolicy updated, String userId) {
        assertUserPermission(userId, "Insurance", "EDIT");
        amendPolicy(policyId, updated, "Policy terms amended by maker", userId);
    }

    public void renewPolicy(String policyId, double newAmount, double newPremium, String newExpiryDate, String userId) {
        assertUserPermission(userId, "Insurance", "EDIT");
        InsurancePolicy renewed = new InsurancePolicy();
        renewed.setInsuredAmount(newAmount);
        renewed.setPremium(newPremium);
        renewed.setExpiryDate(newExpiryDate);
        renewPolicy(policyId, renewed, userId);
    }

    // --- Document Upload & Management ---
    public OwnershipDocument uploadDocument(String entityType, String entityId, String docName, String docType, String uploadedBy, String expiryDate) {
        return uploadDocument(entityType, entityId, docName, docType, null, 102400L, "application/pdf", null, null, uploadedBy, expiryDate, null, null, false);
    }

    public OwnershipDocument uploadDocument(String entityType, String entityId, String docName, String docType,
                                           String fileName, Long fileSize, String contentType, String fileContent,
                                           String remarks, String uploadedBy, String expiryDate) {
        return uploadDocument(entityType, entityId, docName, docType, fileName, fileSize, contentType, fileContent, remarks, uploadedBy, expiryDate, null, null, false);
    }

    public OwnershipDocument uploadDocument(String entityType, String entityId, String docName, String docType,
                                           String fileName, Long fileSize, String contentType, String fileContent,
                                           String remarks, String uploadedBy, String expiryDate,
                                           String parentDocumentId, String versionNotes, boolean forceNew) {
        assertUserPermission(uploadedBy, "Documents", "CREATE");
        // 1. Explicit version upload if parentDocumentId provided
        if (parentDocumentId != null && !parentDocumentId.isBlank()) {
            return uploadDocumentVersion(parentDocumentId, fileName != null ? fileName : docName, fileSize, contentType, fileContent, versionNotes, uploadedBy, expiryDate);
        }

        // 2. Resolve collateral and entity references
        String resolvedCollateralId = null;
        String resolvedEntityId = entityId;
        if ("Collateral".equalsIgnoreCase(entityType)) {
            Optional<Collateral> colOpt = collateralRepository.findById(entityId);
            if (colOpt.isEmpty()) {
                colOpt = collateralRepository.findByCode(entityId);
            }
            if (colOpt.isPresent()) {
                resolvedCollateralId = colOpt.get().getId();
                resolvedEntityId = colOpt.get().getId();
            } else {
                resolvedCollateralId = entityId;
            }
        } else if ("Insurance Policy".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            Optional<InsurancePolicy> polOpt = insurancePolicyRepository.findById(entityId);
            if (polOpt.isEmpty()) polOpt = insurancePolicyRepository.findByPolicyNumber(entityId);
            if (polOpt.isPresent()) {
                resolvedEntityId = polOpt.get().getId();
                if (polOpt.get().getCollateralId() != null) {
                    resolvedCollateralId = polOpt.get().getCollateralId();
                }
            }
        }

        String targetType = docType != null ? docType : "Title Deed";
        String targetName = docName != null ? docName : (fileName != null ? fileName : "Document");

        final String finalEntityId = resolvedEntityId;
        final String finalCollateralId = resolvedCollateralId;

        // 3. Prevent Accidental Overwrite: Check if an active document of matching type or name already exists
        if (!forceNew) {
            List<OwnershipDocument> existingDocs = ownershipDocumentRepository.findAll().stream()
                    .filter(d -> "Active".equalsIgnoreCase(d.getStatus()) && d.isLatest())
                    .filter(d -> {
                        boolean entityMatches = (finalEntityId != null && (finalEntityId.equalsIgnoreCase(d.getEntityId()) || finalEntityId.equalsIgnoreCase(d.getCollateralId()))) ||
                                                (finalCollateralId != null && (finalCollateralId.equalsIgnoreCase(d.getCollateralId()) || finalCollateralId.equalsIgnoreCase(d.getEntityId())));
                        boolean typeMatches = targetType.equalsIgnoreCase(d.getType()) || targetName.equalsIgnoreCase(d.getName());
                        return entityMatches && typeMatches;
                    })
                    .toList();

            if (!existingDocs.isEmpty()) {
                OwnershipDocument existingLatest = existingDocs.get(0);
                String note = (versionNotes != null && !versionNotes.isBlank())
                        ? versionNotes
                        : "Committed new version v" + (existingLatest.getVersion() + 1) + " to preserve audit history and prevent accidental overwrite of " + existingLatest.getType();
                return uploadDocumentVersion(existingLatest.getId(), fileName != null ? fileName : targetName, fileSize, contentType, fileContent, note, uploadedBy, expiryDate);
            }
        }

        // 4. Create initial root version (v1)
        OwnershipDocument doc = new OwnershipDocument();
        doc.setId("doc-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
        doc.setEntityType(entityType != null ? entityType : "Collateral");
        doc.setEntityId(resolvedEntityId);
        doc.setCollateralId(resolvedCollateralId);

        doc.setName(targetName);
        doc.setType(targetType);
        doc.setFileName(fileName != null ? fileName : doc.getName());
        doc.setFileSize(fileSize != null && fileSize > 0 ? fileSize : 102400L);
        doc.setContentType(contentType != null ? contentType : "application/pdf");
        doc.setFileContent(fileContent);
        doc.setVerificationStatus("Pending Verification");
        doc.setUploadedBy(uploadedBy != null ? uploadedBy : "MGRCOLLDOC");
        doc.setUploadedAt(LocalDateTime.now().toString());
        doc.setUploadDate(LocalDateTime.now().toString());
        doc.setExpiryDate(expiryDate != null ? expiryDate : LocalDate.now().plusYears(5).toString());
        doc.setFileUrl("/api/documents/download/" + doc.getId());
        doc.setStatus("Active");
        doc.setVersion(1);
        doc.setLatest(true);
        doc.setVersionNotes(versionNotes != null ? versionNotes : "Initial document upload (v1)");
        doc.setRemarks(remarks != null ? remarks : "Uploaded via CIMS DMS (Pending Verification)");
        ownershipDocumentRepository.save(doc);

        if (doc.getCollateralId() != null) {
            updateCollateralStatus(doc.getCollateralId());
        }

        logAudit(uploadedBy, "MGRCOLLDOC", "UPLOAD_DOCUMENT", "Document", doc.getId(), "Name", "None", doc.getName(), "Uploaded v1 of " + docType + " for " + entityType + " " + entityId + " (Pending Verification)");
        sendNotification("Email", "DMS_DOCUMENT_UPLOADED", "colldoc@cims-bank.et", "Collateral Documentation Dept", "Document Uploaded: " + doc.getType(), "A new " + doc.getType() + " (" + doc.getName() + ") has been uploaded and is pending verification in the DMS repository for " + entityType + " (" + entityId + ").", "Document", doc.getId());
        
        return doc;
    }

    public OwnershipDocument uploadDocumentVersion(String parentDocId, String fileName, Long fileSize, String contentType,
                                                  String fileContent, String versionNotes, String uploadedBy, String newExpiryDate) {
        assertUserPermission(uploadedBy, "Documents", "CREATE");
        OwnershipDocument oldDoc = ownershipDocumentRepository.findById(parentDocId)
            .orElseThrow(() -> new IllegalArgumentException("Original document not found in DMS: " + parentDocId));

        int maxVersion = oldDoc.getVersion();
        String rootParentId = oldDoc.getParentDocumentId() != null ? oldDoc.getParentDocumentId() : oldDoc.getId();

        // Mark existing versions in chain as not latest, and find absolute max version in lineage
        List<OwnershipDocument> allDocs = ownershipDocumentRepository.findAll();
        for (OwnershipDocument d : allDocs) {
            if (d.getId().equals(rootParentId) || rootParentId.equals(d.getParentDocumentId()) || d.getId().equals(parentDocId)) {
                if (d.getVersion() > maxVersion) {
                    maxVersion = d.getVersion();
                }
                d.setLatest(false);
                ownershipDocumentRepository.save(d);
            }
        }
        int nextVersion = maxVersion + 1;

        OwnershipDocument newDoc = new OwnershipDocument();
        newDoc.setId("doc-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
        newDoc.setEntityType(oldDoc.getEntityType());
        newDoc.setEntityId(oldDoc.getEntityId());
        newDoc.setCollateralId(oldDoc.getCollateralId());
        newDoc.setName(oldDoc.getName());
        newDoc.setType(oldDoc.getType());
        newDoc.setFileName(fileName != null ? fileName : (oldDoc.getFileName() != null ? oldDoc.getFileName() : oldDoc.getName()));
        newDoc.setFileSize(fileSize != null && fileSize > 0 ? fileSize : oldDoc.getFileSize());
        newDoc.setContentType(contentType != null ? contentType : oldDoc.getContentType());
        newDoc.setFileContent(fileContent != null ? fileContent : oldDoc.getFileContent());
        newDoc.setVerificationStatus("Pending Verification");
        newDoc.setUploadedBy(uploadedBy != null ? uploadedBy : "MGRCOLLDOC");
        newDoc.setUploadedAt(LocalDateTime.now().toString());
        newDoc.setUploadDate(LocalDateTime.now().toString());
        newDoc.setExpiryDate(newExpiryDate != null ? newExpiryDate : oldDoc.getExpiryDate());
        newDoc.setFileUrl("/api/documents/download/" + newDoc.getId());
        newDoc.setStatus("Active");
        newDoc.setVersion(nextVersion);
        newDoc.setParentDocumentId(rootParentId);
        newDoc.setVersionNotes(versionNotes != null ? versionNotes : "Updated to version " + nextVersion);
        newDoc.setLatest(true);
        newDoc.setRemarks(oldDoc.getRemarks());
        ownershipDocumentRepository.save(newDoc);

        logAudit(uploadedBy, "MGRCOLLDOC", "NEW_DOCUMENT_VERSION", "Document", newDoc.getId(), "Version", "v" + oldDoc.getVersion(), "v" + nextVersion, "Committed new version v" + nextVersion + " of " + oldDoc.getName() + " (Supersedes v" + oldDoc.getVersion() + "). Notes: " + (versionNotes != null ? versionNotes : "Routine version update"));
        sendNotification("Email", "DMS_DOCUMENT_VERSION_COMMITTED", "colldoc@cims-bank.et", "Collateral Documentation Dept", "New Document Version Committed: " + newDoc.getType() + " v" + nextVersion, "Version v" + nextVersion + " of " + newDoc.getName() + " has been committed by " + uploadedBy + " and is pending verification. Previous version v" + oldDoc.getVersion() + " has been preserved for audit purposes.", "Document", newDoc.getId());
        return newDoc;
    }

    public OwnershipDocument verifyDocument(String docId, String status, String remarks, String verifiedBy) {
        assertUserPermission(verifiedBy, "Documents", "APPROVE");
        OwnershipDocument doc = ownershipDocumentRepository.findById(docId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found in DMS: " + docId));
        String oldStatus = doc.getVerificationStatus();
        doc.setVerificationStatus(status != null ? status : "Verified");
        if (remarks != null && !remarks.isBlank()) {
            doc.setRemarks((doc.getRemarks() != null ? doc.getRemarks() + " | " : "") + remarks);
        }
        ownershipDocumentRepository.save(doc);
        logAudit(verifiedBy, "COLLDOCOFF", "VERIFY_DOCUMENT", "Document", docId, "VerificationStatus", oldStatus, doc.getVerificationStatus(), "Document verification status updated to " + doc.getVerificationStatus() + ": " + remarks);
        return doc;
    }

    // --- Exception Detection Engine (US-12.1 to US-12.4 & BRD Requirements) ---
    public ScanResultDto scanAndGenerateExceptions() {
        ScanResultDto result = new ScanResultDto();
        result.setScanStartedAt(LocalDateTime.now().toString());

        if (!configurationService.isExceptionScanEnabled()) {
            result.setScanCompletedAt(LocalDateTime.now().toString());
            return result;
        }

        LocalDate today = LocalDate.now();
        int gracePeriodDays = configurationService.getPolicyExpiryGracePeriodDays();
        double threshold = configurationService.getMinimumCoverageAdequacyPct();

        List<InsurancePolicy> allPolicies = insurancePolicyRepository.findAll();
        List<Collateral> allCollaterals = collateralRepository.findAll();
        List<OwnershipDocument> allDocs = ownershipDocumentRepository.findAll();
        List<ApprovedInsurer> approvedInsurers = approvedInsurerRepository.findAll();
        List<MandatoryDocumentRule> mandatoryRules = mandatoryDocumentRuleRepository.findAll();
        List<LoanCollateralLink> allLinks = loanCollateralLinkRepository.findAll();
        List<LoanAccount> allFacilities = loanAccountRepository.findAll();
        List<Customer> allCustomers = customerRepository.findAll();

        result.setPoliciesEvaluated(allPolicies.size());
        result.setCollateralsEvaluated(allCollaterals.size());
        result.setDocumentsEvaluated(allDocs.size());

        // Fast lookup maps for scalability and indexed retrieval
        Map<String, Collateral> collateralMap = new HashMap<>();
        for (Collateral c : allCollaterals) {
            if (c.getId() != null) collateralMap.put(c.getId(), c);
            if (c.getCode() != null) collateralMap.put(c.getCode(), c);
        }

        Map<String, LoanAccount> facilityMap = new HashMap<>();
        for (LoanAccount f : allFacilities) {
            if (f.getId() != null) facilityMap.put(f.getId(), f);
            if (f.getLoanReference() != null) facilityMap.put(f.getLoanReference(), f);
        }

        Map<String, Customer> customerMap = new HashMap<>();
        for (Customer cu : allCustomers) {
            if (cu.getId() != null) customerMap.put(cu.getId(), cu);
            if (cu.getCif() != null) customerMap.put(cu.getCif().toLowerCase(), cu);
        }

        Map<String, List<InsurancePolicy>> policiesByCollateralId = new HashMap<>();
        for (InsurancePolicy p : allPolicies) {
            if (p.getCollateralId() != null && !p.getCollateralId().isBlank()) {
                policiesByCollateralId.computeIfAbsent(p.getCollateralId().trim(), k -> new ArrayList<>()).add(p);
            }
        }

        Map<String, List<LoanCollateralLink>> linksByCollateralId = new HashMap<>();
        for (LoanCollateralLink l : allLinks) {
            if (l.getCollateralId() != null && !l.getCollateralId().isBlank() && !"Released".equalsIgnoreCase(l.getStatus())) {
                linksByCollateralId.computeIfAbsent(l.getCollateralId().trim(), k -> new ArrayList<>()).add(l);
            }
        }

        // ==========================================
        // 1. Expired Policy Detection
        // ==========================================
        for (InsurancePolicy p : allPolicies) {
            if (p.getExpiryDate() == null || p.getExpiryDate().isBlank() || "Cancelled".equalsIgnoreCase(p.getStatus()) || "Closed".equalsIgnoreCase(p.getStatus())) {
                continue;
            }
            try {
                LocalDate exp = LocalDate.parse(p.getExpiryDate().substring(0, 10));
                long daysToExpiry = ChronoUnit.DAYS.between(today, exp);
                String excId = "exc-exp-" + p.getId();

                if (daysToExpiry < 0) {
                    if (!"Expired".equalsIgnoreCase(p.getStatus())) {
                        p.setStatus("Expired");
                        insurancePolicyRepository.save(p);
                        updateCollateralStatus(p.getCollateralId());
                    }

                    // Check if superseded by an active replacement or renewal
                    boolean superseded = (p.getReplacesPolicyId() != null && !p.getReplacesPolicyId().isBlank()) ||
                            allPolicies.stream().anyMatch(other ->
                                    p.getId().equalsIgnoreCase(other.getReplacesPolicyId()) ||
                                    (p.getId().equalsIgnoreCase(other.getRenewedFromPolicyId()) && isCoverageActiveStatus(other.getStatus())));

                    if (superseded) {
                        resolveExceptionIfOpen(excId, "Policy has been renewed or superseded by active replacement.", result);
                        continue;
                    }

                    long overdue = Math.abs(daysToExpiry);
                    String severity = overdue <= gracePeriodDays ? "High" : "Critical";
                    String desc = "Policy " + p.getPolicyNumber() + " expired on " + p.getExpiryDate() +
                            " (" + overdue + " days overdue; grace period " + gracePeriodDays + " days).";

                    createOrUpdateException(excId, "Expired Policy", "Insurance Policy", p.getId(), severity, desc,
                            p, collateralMap.get(p.getCollateralId()), facilityMap, customerMap, linksByCollateralId, result);

                } else if (daysToExpiry <= configurationService.getPolicyExpiringStatusDays() && !"Expiring".equalsIgnoreCase(p.getStatus())) {
                    p.setStatus("Expiring");
                    insurancePolicyRepository.save(p);
                } else if (daysToExpiry > 0) {
                    resolveExceptionIfOpen(excId, "Policy expiry date is in the future.", result);
                }
            } catch (Exception e) {
                result.getErrorsEncountered().add("Expired scan error for policy " + p.getId() + ": " + e.getMessage());
            }
        }

        // ==========================================
        // 2. Missing Insurance Detection (BRD US-12.1)
        // ==========================================
        for (Collateral c : allCollaterals) {
            String excId = "exc-missing-ins-" + c.getId();
            boolean isMandatory = effectiveInsuranceService.isInsuranceMandatory(c.getCategory(), c.getType());

            if (isMandatory) {
                List<InsurancePolicy> attachedPolicies = policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                if (attachedPolicies.isEmpty() && c.getCode() != null) {
                    attachedPolicies = policiesByCollateralId.getOrDefault(c.getCode(), Collections.emptyList());
                }

                boolean hasActiveOrExpiring = attachedPolicies.stream().anyMatch(p -> isCoverageActiveStatus(p.getStatus()));
                boolean hasExpired = attachedPolicies.stream().anyMatch(p -> "Expired".equalsIgnoreCase(p.getStatus()));

                // Missing Insurance: NO acceptable insurance on file at all (differentiated from expired policy)
                if (!hasActiveOrExpiring && !hasExpired) {
                    List<LoanCollateralLink> links = linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                    double linkedBalance = 0.0;
                    for (LoanCollateralLink l : links) {
                        String facId = l.getLoanAccountId() != null ? l.getLoanAccountId() : l.getFacilityId();
                        LoanAccount fac = facilityMap.get(facId);
                        if (fac != null && !"Closed".equalsIgnoreCase(fac.getStatus())) {
                            linkedBalance += fac.getOutstandingBalance();
                        }
                    }

                    String severity = linkedBalance > 0 ? "Critical" : "High";
                    String desc = "Collateral " + c.getCode() + " (" + c.getCategory() +
                            (c.getType() != null ? " / " + c.getType() : "") +
                            ") has mandatory insurance requirement but has no insurance policy on file." +
                            (linkedBalance > 0 ? " Linked outstanding exposure: ETB " + String.format(Locale.ROOT, "%,.2f", linkedBalance) : "");

                    createOrUpdateException(excId, "Missing Insurance", "Collateral", c.getId(), severity, desc,
                            null, c, facilityMap, customerMap, linksByCollateralId, result);
                } else {
                    resolveExceptionIfOpen(excId, "Insurance policy is registered on collateral record.", result);
                }
            } else {
                resolveExceptionIfOpen(excId, "Insurance is not mandatory for collateral category/type.", result);
            }
        }

        // ==========================================
        // 3. Underinsured Collateral Detection
        // ==========================================
        for (Collateral c : allCollaterals) {
            String excId = "exc-under-" + c.getId();
            boolean isMandatory = effectiveInsuranceService.isInsuranceMandatory(c.getCategory(), c.getType());

            if (isMandatory) {
                List<InsurancePolicy> attachedPolicies = policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                boolean hasAnyActivePolicy = attachedPolicies.stream().anyMatch(p -> isCoverageActiveStatus(p.getStatus()));

                if (hasAnyActivePolicy && c.getNetInsuranceCoveragePct() < threshold) {
                    double deficit = Math.max(0.0, c.getValuationAmount() - c.getInsuredAmount());
                    String desc = "Collateral " + c.getCode() + " has net insurance coverage of " +
                            String.format(Locale.ROOT, "%.1f", c.getNetInsuranceCoveragePct()) +
                            "%, which is below the mandatory " + String.format(Locale.ROOT, "%.1f", threshold) +
                            "% adequacy threshold (Coverage Deficit: ETB " + String.format(Locale.ROOT, "%,.2f", deficit) + ").";

                    createOrUpdateException(excId, "Underinsured Collateral", "Collateral", c.getId(), "High", desc,
                            null, c, facilityMap, customerMap, linksByCollateralId, result);
                } else {
                    resolveExceptionIfOpen(excId, "Coverage returned to configured adequacy threshold or no active underinsured condition.", result);
                }
            } else {
                resolveExceptionIfOpen(excId, "Insurance is not mandatory for this collateral.", result);
            }
        }

        // ==========================================
        // 4. Missing Mandatory Documents Detection
        // ==========================================
        if (configurationService.areMandatoryDocumentRulesEnabled()) {
            for (Collateral c : allCollaterals) {
                for (MandatoryDocumentRule rule : mandatoryRules) {
                    if (!rule.isMandatory() || !validationService.categoryMatches(rule.getCollateralCategory(), c)) {
                        continue;
                    }
                    boolean found = allDocs.stream().anyMatch(d ->
                            validationService.documentBelongsToCollateral(d, c) &&
                            validationService.docTypeMatches(rule.getDocumentType(), d.getType()) &&
                            !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) &&
                            !"Archived".equalsIgnoreCase(d.getStatus()) &&
                            ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank())));

                    String excId = "exc-doc-" + c.getId() + "-" + rule.getId();
                    if (!found) {
                        String desc = "Collateral " + c.getCode() + " (" + c.getCategory() +
                                ") is missing mandatory verified document: " + rule.getDocumentType();

                        createOrUpdateException(excId, "Missing Mandatory Document", "Collateral", c.getId(), "High", desc,
                                null, c, facilityMap, customerMap, linksByCollateralId, result);
                    } else {
                        resolveExceptionIfOpen(excId, "Mandatory document is now present, valid, and attached.", result);
                    }
                }
            }
        }

        // ==========================================
        // 5. Document Nearing Expiry Detection
        // ==========================================
        LocalDate warningDate = today.plusDays(configurationService.getDocumentExpiryWarningDays());
        for (OwnershipDocument d : allDocs) {
            if (d.getExpiryDate() == null || d.getExpiryDate().isBlank()) continue;
            try {
                LocalDate exp = LocalDate.parse(d.getExpiryDate().substring(0, 10));
                String excId = "exc-doc-exp-" + d.getId();
                if (!exp.isBefore(today) && !exp.isAfter(warningDate)) {
                    Collateral linkedCol = d.getCollateralId() != null ? collateralMap.get(d.getCollateralId()) : null;
                    String desc = "Document '" + d.getName() + "' (" + d.getType() + ") expires on " +
                            d.getExpiryDate() + " within the configured " +
                            configurationService.getDocumentExpiryWarningDays() + "-day warning window.";

                    createOrUpdateException(excId, "Document Nearing Expiry", "Document", d.getId(), "Medium", desc,
                            null, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
                } else {
                    resolveExceptionIfOpen(excId, "Document is outside the warning window.", result);
                }
            } catch (Exception ignored) {}
        }

        // ==========================================
        // 6. Duplicate Insurance Policy Monitoring
        // ==========================================
        Map<String, List<InsurancePolicy>> byNumber = new HashMap<>();
        for (InsurancePolicy p : allPolicies) {
            if (p.getPolicyNumber() != null && !p.getPolicyNumber().isBlank() && isCoverageActiveStatus(p.getStatus())) {
                byNumber.computeIfAbsent(p.getPolicyNumber().trim().toLowerCase(), k -> new ArrayList<>()).add(p);
            }
        }
        for (Map.Entry<String, List<InsurancePolicy>> e : byNumber.entrySet()) {
            String excId = "exc-dup-policy-" + e.getKey().replaceAll("[^a-zA-Z0-9_-]", "-");
            if (e.getValue().size() >= 2) {
                InsurancePolicy sample = e.getValue().get(0);
                Collateral linkedCol = sample.getCollateralId() != null ? collateralMap.get(sample.getCollateralId()) : null;
                String desc = "Duplicate Policy Alert: Policy number '" + sample.getPolicyNumber() +
                        "' is actively registered across " + e.getValue().size() + " separate policy records.";

                createOrUpdateException(excId, "Duplicate Insurance Policy", "Insurance Policy", sample.getId(), "High", desc,
                        sample, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
            } else {
                resolveExceptionIfOpen(excId, "Duplicate policy condition cleared.", result);
            }
        }

        // ==========================================
        // 7. Insurer Concentration Breach
        // ==========================================
        double totalInsuredExposure = allPolicies.stream()
                .filter(p -> isCoverageActiveStatus(p.getStatus()))
                .mapToDouble(InsurancePolicy::getInsuredAmount).sum();

        if (totalInsuredExposure > 0) {
            double concentrationCap = configurationService.getMaxInsurerConcentrationPct();
            Map<String, Double> totalsByInsurer = new HashMap<>();
            for (InsurancePolicy p : allPolicies) {
                if (isCoverageActiveStatus(p.getStatus()) && p.getInsurerName() != null && !p.getInsurerName().isBlank()) {
                    totalsByInsurer.merge(p.getInsurerName().trim(), p.getInsuredAmount(), Double::sum);
                }
            }
            for (Map.Entry<String, Double> e : totalsByInsurer.entrySet()) {
                double share = (e.getValue() / totalInsuredExposure) * 100.0;
                String excId = "exc-ins-cap-" + e.getKey().replaceAll("\\s+", "-").replaceAll("[^a-zA-Z0-9_-]", "");
                if (share > concentrationCap) {
                    String desc = "Insurer Concentration Breach: '" + e.getKey() + "' holds " +
                            String.format(Locale.ROOT, "%.1f", share) + "% of total bank active insured exposure, exceeding the regulatory cap of " +
                            String.format(Locale.ROOT, "%.1f", concentrationCap) + "%. Total Exposure: ETB " +
                            String.format(Locale.ROOT, "%,.2f", e.getValue());

                    createOrUpdateException(excId, "Insurer Concentration Breach", "Insurer", e.getKey(), "Medium", desc,
                            null, null, facilityMap, customerMap, linksByCollateralId, result);
                } else {
                    resolveExceptionIfOpen(excId, "Insurer concentration returned within approved limit.", result);
                }
            }
        }

        // ==========================================
        // 8. Unapproved Insurer Detection
        // ==========================================
        if (configurationService.isApprovedInsurerRequired()) {
            for (InsurancePolicy p : allPolicies) {
                if (!isCoverageActiveStatus(p.getStatus())) continue;
                if (p.getInsurerName() == null || p.getInsurerName().trim().isBlank()) continue;
                String rawIns = p.getInsurerName().trim();
                String pIns = rawIns.toLowerCase();
                boolean approved = approvedInsurers.stream().anyMatch(i ->
                        i.isActive() && i.getName() != null && (
                                i.getName().equalsIgnoreCase(rawIns) ||
                                pIns.contains(i.getName().toLowerCase().replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim()) ||
                                i.getName().toLowerCase().contains(pIns.replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim())
                        )
                );
                String excId = "exc-unapproved-ins-" + p.getId();
                if (!approved && !pIns.isBlank()) {
                    Collateral linkedCol = p.getCollateralId() != null ? collateralMap.get(p.getCollateralId()) : null;
                    String desc = "Policy " + p.getPolicyNumber() + " is underwritten by '" + p.getInsurerName() +
                            "', which is not an active approved insurer in the bank register. Re-placement or waiver required.";

                    createOrUpdateException(excId, "Unapproved Insurer", "Insurance Policy", p.getId(), "High", desc,
                            p, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
                } else {
                    resolveExceptionIfOpen(excId, "Insurer is approved and active.", result);
                }
            }
        }

        // ==========================================
        // 9. Renewal Delay Detection (BRD US-12.1)
        // ==========================================
        for (InsurancePolicy p : allPolicies) {
            if (p.getExpiryDate() == null || p.getExpiryDate().isBlank() || "Cancelled".equalsIgnoreCase(p.getStatus()) || "Closed".equalsIgnoreCase(p.getStatus())) {
                continue;
            }
            try {
                LocalDate exp = LocalDate.parse(p.getExpiryDate().substring(0, 10));
                long daysToExpiry = ChronoUnit.DAYS.between(today, exp);
                String excId = "exc-renew-delay-" + p.getId();

                // Differentiated: Detects a policy that is overdue past expiry and exceeds grace period without renewal
                if (daysToExpiry < 0 && Math.abs(daysToExpiry) > gracePeriodDays) {
                    boolean renewedOrReplaced = allPolicies.stream().anyMatch(other ->
                            p.getId().equalsIgnoreCase(other.getReplacesPolicyId()) ||
                            (p.getId().equalsIgnoreCase(other.getRenewedFromPolicyId()) && isCoverageActiveStatus(other.getStatus())));

                    if (!renewedOrReplaced) {
                        long overdueDays = Math.abs(daysToExpiry);
                        String severity = overdueDays > (gracePeriodDays + 10) ? "Critical" : "High";
                        Collateral linkedCol = p.getCollateralId() != null ? collateralMap.get(p.getCollateralId()) : null;
                        String desc = "Renewal Delay Breach: Policy " + p.getPolicyNumber() +
                                " expired on " + p.getExpiryDate() + " and is now " + overdueDays +
                                " days past expiry, exceeding the bank renewal grace period of " + gracePeriodDays +
                                " days without a completed renewal or replacement.";

                        createOrUpdateException(excId, "Renewal Delay", "Insurance Policy", p.getId(), severity, desc,
                                p, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
                    } else {
                        resolveExceptionIfOpen(excId, "Policy renewal or replacement completed.", result);
                    }
                } else {
                    resolveExceptionIfOpen(excId, "Policy is within renewal grace window.", result);
                }
            } catch (Exception ignored) {}
        }

        // ==========================================
        // 10. Policy Inconsistency Detection (BRD US-12.1)
        // ==========================================
        for (InsurancePolicy p : allPolicies) {
            if (!isCoverageActiveStatus(p.getStatus())) continue;
            Collateral linkedCol = p.getCollateralId() != null ? collateralMap.get(p.getCollateralId()) : null;

            // 10a. Coverage type incompatibility with taxonomy mandatory coverage
            if (linkedCol != null && effectiveInsuranceService != null) {
                String mandatoryCoverage = effectiveInsuranceService.getMandatoryCoverageType(linkedCol.getCategory(), linkedCol.getType());
                if (mandatoryCoverage != null && !mandatoryCoverage.isBlank()) {
                    String excId = "exc-incon-cov-" + p.getId();
                    if (p.getCoverageType() == null || !validationService.isCoverageTypeCompatible(p.getCoverageType(), mandatoryCoverage)) {
                        String desc = "Policy Inconsistency: Policy " + p.getPolicyNumber() + " coverage type '" +
                                (p.getCoverageType() != null ? p.getCoverageType() : "Unspecified") +
                                "' does not satisfy mandatory coverage '" + mandatoryCoverage +
                                "' required for collateral category '" + linkedCol.getCategory() + "'.";

                        createOrUpdateException(excId, "Policy Inconsistency", "Insurance Policy", p.getId(), "High", desc,
                                p, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
                    } else {
                        resolveExceptionIfOpen(excId, "Policy coverage type is compatible with taxonomy requirement.", result);
                    }
                }
            }

            // 10b. Tenor Inconsistency: Expiry date before or equal to effective date
            if (p.getEffectiveDate() != null && !p.getEffectiveDate().isBlank() && p.getExpiryDate() != null && !p.getExpiryDate().isBlank()) {
                String excId = "exc-incon-tenor-" + p.getId();
                try {
                    LocalDate eff = LocalDate.parse(p.getEffectiveDate().substring(0, 10));
                    LocalDate exp = LocalDate.parse(p.getExpiryDate().substring(0, 10));
                    if (!exp.isAfter(eff)) {
                        String desc = "Policy Inconsistency: Policy " + p.getPolicyNumber() + " has invalid tenor: expiry date (" +
                                p.getExpiryDate() + ") is on or before effective date (" + p.getEffectiveDate() + ").";

                        createOrUpdateException(excId, "Policy Inconsistency", "Insurance Policy", p.getId(), "High", desc,
                                p, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
                    } else {
                        resolveExceptionIfOpen(excId, "Policy tenor dates are valid.", result);
                    }
                } catch (Exception ignored) {}
            }

            // 10c. Customer Ownership Mismatch
            if (linkedCol != null && p.getCustomerId() != null && !p.getCustomerId().isBlank() && linkedCol.getCustomerId() != null && !linkedCol.getCustomerId().isBlank()) {
                String excId = "exc-incon-cust-" + p.getId();
                boolean custMatches = validationService.same(p.getCustomerId(), linkedCol.getCustomerId());
                if (!custMatches) {
                    Customer pCust = customerMap.get(p.getCustomerId().toLowerCase());
                    Customer cCust = customerMap.get(linkedCol.getCustomerId().toLowerCase());
                    if (pCust != null && cCust != null && pCust.getCif() != null && pCust.getCif().equalsIgnoreCase(cCust.getCif())) {
                        custMatches = true;
                    }
                }
                if (!custMatches && "Borrower-owned".equalsIgnoreCase(linkedCol.getOwnerType())) {
                    String desc = "Policy Inconsistency: Policy " + p.getPolicyNumber() + " borrower ID (" +
                            p.getCustomerId() + ") does not match registered owner of Collateral " +
                            linkedCol.getCode() + " (" + linkedCol.getCustomerId() + ").";

                    createOrUpdateException(excId, "Policy Inconsistency", "Insurance Policy", p.getId(), "High", desc,
                            p, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
                } else {
                    resolveExceptionIfOpen(excId, "Policy customer matches collateral ownership.", result);
                }
            }

            // 10d. Non-positive insured amount
            if (p.getInsuredAmount() <= 0) {
                String excId = "exc-incon-amt-" + p.getId();
                String desc = "Policy Inconsistency: Policy " + p.getPolicyNumber() +
                        " is in Active status but specifies a zero or negative insured amount (ETB " + p.getInsuredAmount() + ").";

                createOrUpdateException(excId, "Policy Inconsistency", "Insurance Policy", p.getId(), "Medium", desc,
                        p, linkedCol, facilityMap, customerMap, linksByCollateralId, result);
            } else {
                resolveExceptionIfOpen("exc-incon-amt-" + p.getId(), "Policy insured amount is positive.", result);
            }
        }

        // Ensure all active open exceptions have computed SLA and assigned role (US-12.2 & BRD)
        List<CimsException> allActive = cimsExceptionRepository.findByStatusNot("Resolved");
        for (CimsException exc : allActive) {
            boolean needsSave = false;
            if (exc.getSlaDueDate() == null || exc.getSlaDueDate().isBlank()) {
                exc.setSlaDueDate(calculateSlaDueDate(exc.getSeverity()));
                needsSave = true;
            }
            if (exc.getAssignedToRole() == null || exc.getAssignedToRole().isBlank()) {
                exc.setAssignedToRole("RO");
                needsSave = true;
            }
            if (needsSave) {
                cimsExceptionRepository.save(exc);
            }
        }

        result.setScanCompletedAt(LocalDateTime.now().toString());
        return result;
    }

    private double getInsurerAmountOrZero(InsurancePolicy p) {
        return p != null ? p.getInsuredAmount() : 0.0;
    }

    private void createOrUpdateException(
            String excId,
            String exceptionType,
            String entityType,
            String entityId,
            String severity,
            String description,
            InsurancePolicy policy,
            Collateral collateral,
            Map<String, LoanAccount> facilityMap,
            Map<String, Customer> customerMap,
            Map<String, List<LoanCollateralLink>> linksByCollateralId,
            ScanResultDto result
    ) {
        Optional<CimsException> existingOpt = cimsExceptionRepository.findById(excId);

        if (existingOpt.isPresent()) {
            CimsException exc = existingOpt.get();
            if (!"Resolved".equalsIgnoreCase(exc.getStatus())) {
                // Update description / severity if changed, ensure SLA & linkages populated
                exc.setSeverity(severity);
                exc.setDescription(description);
                if (exc.getSlaDueDate() == null || exc.getSlaDueDate().isBlank()) {
                    exc.setSlaDueDate(calculateSlaDueDate(severity));
                }
                if (exc.getAssignedToRole() == null || exc.getAssignedToRole().isBlank()) {
                    exc.setAssignedToRole(resolveResponsibleUserAndRole(exceptionType, exc.getBranch(), exc.getBusinessSegment(), exc.getRelationshipManagerId()).role());
                }
                cimsExceptionRepository.save(exc);
                result.setExceptionsUpdated(result.getExceptionsUpdated() + 1);
            }
            return;
        }

        CimsException exc = new CimsException();
        exc.setId(excId);
        exc.setExceptionType(exceptionType);
        exc.setEntityType(entityType);
        exc.setEntityId(entityId);
        exc.setSeverity(severity);
        exc.setDescription(description);
        exc.setStatus("Open");
        exc.setDetectedAt(LocalDateTime.now().toString());
        exc.setDetectionSource("AUTOMATED_SCAN");
        exc.setSlaDueDate(calculateSlaDueDate(severity));

        // Populate full contextual business linkages
        if (policy != null) {
            exc.setPolicyId(policy.getId());
            if (exc.getCustomerId() == null) exc.setCustomerId(policy.getCustomerId());
            if (exc.getCollateralId() == null) exc.setCollateralId(policy.getCollateralId());
        }

        if (collateral != null) {
            exc.setCollateralId(collateral.getId());
            if (exc.getCustomerId() == null) exc.setCustomerId(collateral.getCustomerId());
            exc.setBranch(collateral.getBranch());
            exc.setBusinessSegment(collateral.getOwningSegment());
            exc.setDistrict(resolveDistrictForBranch(collateral.getBranch()));

            // Find linked facility and relationship manager
            List<LoanCollateralLink> links = linksByCollateralId.getOrDefault(collateral.getId(), Collections.emptyList());
            if (!links.isEmpty()) {
                LoanCollateralLink firstLink = links.get(0);
                String facId = firstLink.getLoanAccountId() != null ? firstLink.getLoanAccountId() : firstLink.getFacilityId();
                if (facId != null) {
                    LoanAccount fac = facilityMap.get(facId);
                    if (fac != null) {
                        exc.setFacilityId(fac.getId());
                        exc.setLoanReference(fac.getLoanReference());
                        exc.setRelationshipManagerId(fac.getRmUserId());
                        if (exc.getBranch() == null) exc.setBranch(fac.getBranch());
                        if (exc.getBusinessSegment() == null) exc.setBusinessSegment(fac.getSegment());
                    }
                }
            }
        }

        if (exc.getCustomerId() != null) {
            Customer cust = customerMap.get(exc.getCustomerId().toLowerCase());
            if (cust != null) {
                exc.setCustomerCif(cust.getCif());
                if (exc.getBranch() == null) exc.setBranch(cust.getBranch());
                if (exc.getBusinessSegment() == null) exc.setBusinessSegment(cust.getSegment());
            }
        }

        // Automatic Assignment Routing (US-12.2)
        AssignedTarget target = resolveResponsibleUserAndRole(
                exceptionType,
                exc.getBranch(),
                exc.getBusinessSegment(),
                exc.getRelationshipManagerId()
        );
        exc.setAssignedToRole(target.role());
        exc.setAssignedToUserId(target.userId());
        exc.setAssignedAt(LocalDateTime.now().toString());
        exc.setAssignedBy("SYSTEM");

        cimsExceptionRepository.save(exc);

        // Record initial assignment history
        CimsExceptionAssignmentHistory history = new CimsExceptionAssignmentHistory(
                "asgn-init-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                excId,
                null,
                null,
                target.role(),
                target.userId(),
                "SYSTEM",
                "Automated assignment upon detection"
        );
        cimsExceptionAssignmentHistoryRepository.save(history);

        // Notify assigned user / role
        notifyExceptionAssigned(exc, target.role(), target.userId(), "Investigate and resolve breach");

        logAudit("SYSTEM", "SYSADMIN", "EXCEPTION_DETECTED", "Exception", excId, "Status", "", "Open", description);
        result.setExceptionsCreated(result.getExceptionsCreated() + 1);
    }

    private void resolveExceptionIfOpen(String id, String reason) {
        resolveExceptionIfOpen(id, reason, null);
    }

    private void resolveExceptionIfOpen(String id, String reason, ScanResultDto result) {
        cimsExceptionRepository.findById(id).ifPresent(exc -> {
            if (!"Resolved".equalsIgnoreCase(exc.getStatus())) {
                String prevStatus = exc.getStatus();
                exc.setStatus("Resolved");
                exc.setResolvedAt(LocalDateTime.now().toString());
                exc.setResolvedBy("SYSTEM");
                exc.setCorrectiveAction("System Auto-Resolution");
                exc.setResolutionNotes(reason);
                cimsExceptionRepository.save(exc);

                CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                        "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                        id,
                        "SYSTEM",
                        "Automated System Monitor",
                        "System Auto-Resolution: " + reason
                );
                cimsExceptionInvestigationNoteRepository.save(note);

                logAudit("SYSTEM", "SYSADMIN", "AUTO_RESOLVE_EXCEPTION", "Exception", id, "Status", prevStatus, "Resolved", reason);
                if (result != null) {
                    result.setExceptionsAutoResolved(result.getExceptionsAutoResolved() + 1);
                }
            }
        });
    }

    private record AssignedTarget(String role, String userId, String userName) {}

    private AssignedTarget resolveResponsibleUserAndRole(String exceptionType, String branch, String segment, String rmUserId) {
        String targetRole;
        switch (exceptionType) {
            case "Missing Mandatory Document", "Document Nearing Expiry" -> targetRole = "COLLDOCOFF";
            case "Unapproved Insurer", "Duplicate Insurance Policy", "Policy Inconsistency" -> targetRole = "COMPLIANCE";
            case "Insurer Concentration Breach" -> targetRole = "RISK";
            case "Renewal Delay" -> targetRole = "SRM";
            case "Expired Policy" -> targetRole = "BRMGR";
            case "Underinsured Collateral", "Missing Insurance" -> {
                if (segment != null && segment.toLowerCase().contains("retail")) targetRole = "BRO";
                else targetRole = "CRO";
            }
            default -> targetRole = "RO";
        }

        // 1. If explicit RM user is linked and matches RM/RO roles
        if (rmUserId != null && !rmUserId.isBlank() && List.of("RO", "CRO", "BRO", "SRM", "BRM").contains(targetRole)) {
            User u = findUser(rmUserId);
            if (u != null && u.isActive()) {
                return new AssignedTarget(u.getRole() != null ? u.getRole() : targetRole, u.getId(), u.getFullName());
            }
        }

        // 2. Search active users matching targetRole and branch
        if (branch != null && !branch.isBlank()) {
            List<User> branchUsers = userRepository.findByRoleIgnoreCaseAndActiveTrue(targetRole).stream()
                    .filter(u -> branch.equalsIgnoreCase(u.getBranch()))
                    .toList();
            if (branchUsers.size() == 1) {
                User u = branchUsers.get(0);
                return new AssignedTarget(targetRole, u.getId(), u.getFullName());
            }
        }

        // 3. Search active users matching targetRole and segment
        if (segment != null && !segment.isBlank()) {
            List<User> segmentUsers = userRepository.findByRoleIgnoreCaseAndActiveTrue(targetRole).stream()
                    .filter(u -> (u.getSegment() != null && u.getSegment().equalsIgnoreCase(segment)) ||
                                 (u.getSegmentIds() != null && u.getSegmentIds().contains(segment)))
                    .toList();
            if (segmentUsers.size() == 1) {
                User u = segmentUsers.get(0);
                return new AssignedTarget(targetRole, u.getId(), u.getFullName());
            }
        }

        // 4. Default to first active user with role if unique, otherwise role-only assignment
        List<User> allRoleUsers = userRepository.findByRoleIgnoreCaseAndActiveTrue(targetRole);
        if (allRoleUsers.size() == 1) {
            User u = allRoleUsers.get(0);
            return new AssignedTarget(targetRole, u.getId(), u.getFullName());
        }

        // Preserves role-level assignment rather than fabricating a user (Requirement §12)
        return new AssignedTarget(targetRole, null, null);
    }

    private String calculateSlaDueDate(String severity) {
        int days = 10;
        if ("Critical".equalsIgnoreCase(severity)) {
            days = configurationService.getInt("exception_sla_days_critical", 2);
        } else if ("High".equalsIgnoreCase(severity)) {
            days = configurationService.getInt("exception_sla_days_high", 5);
        } else if ("Medium".equalsIgnoreCase(severity)) {
            days = configurationService.getInt("exception_sla_days_medium", 10);
        } else if ("Low".equalsIgnoreCase(severity)) {
            days = configurationService.getInt("exception_sla_days_low", 15);
        }
        return LocalDate.now().plusDays(days).toString();
    }

    public String resolveDistrictForBranch(String branchName) {
        if (branchName == null || branchName.isBlank()) return null;
        Optional<DistrictHierarchy> dh = districtHierarchyRepository.findAll().stream()
                .filter(d -> d.getDistrictName() != null && d.getDistrictName().equalsIgnoreCase(branchName))
                .findFirst();
        if (dh.isPresent()) {
            return dh.get().getDistrictName();
        }
        Optional<Branch> brnOpt = branchRepository.findAll().stream()
                .filter(b -> b.getName().equalsIgnoreCase(branchName))
                .findFirst();
        if (brnOpt.isPresent()) {
            Branch b = brnOpt.get();
            if ("DistrictOffice".equalsIgnoreCase(b.getType()) || (b.getCode() != null && b.getCode().startsWith("DIST-"))) {
                return b.getName();
            }
            if (b.getParentDistrictId() != null) {
                return branchRepository.findById(b.getParentDistrictId()).map(Branch::getName).orElse(null);
            }
        }
        Optional<DistrictHierarchy> dhBranch = districtHierarchyRepository.findAll().stream()
                .filter(d -> d.getBranchName() != null && d.getBranchName().equalsIgnoreCase(branchName))
                .findFirst();
        if (dhBranch.isPresent()) {
            return dhBranch.get().getDistrictName();
        }
        return null;
    }

    public void notifyExceptionAssigned(CimsException exc, String role, String userId, String actionRequired) {
        String recipientEmail = "alerts@cims-bank.et";
        String recipientName = role;
        if (userId != null && !userId.isBlank()) {
            User u = findUser(userId);
            if (u != null) {
                recipientEmail = u.getEmail() != null ? u.getEmail() : u.getUsername() + "@cims-bank.et";
                recipientName = u.getFullName();
            }
        }
        String subject = "CIMS Exception Assigned: " + exc.getId() + " [" + exc.getSeverity() + "]";
        String body = String.format(Locale.ROOT,
                "Exception %s (%s) has been assigned to %s. Severity: %s. Details: %s. SLA Due Date: %s. Required Action: %s.",
                exc.getId(), exc.getExceptionType(), (recipientName != null ? recipientName : role),
                exc.getSeverity(), exc.getDescription(), exc.getSlaDueDate(), actionRequired);
        sendNotification("Email", "EXCEPTION_ASSIGNMENT", recipientEmail, recipientName, subject, body, "Exception", exc.getId());
    }

    public void notifyExceptionEscalated(CimsException exc, String newRole, String newUserId, String reason) {
        String recipientEmail = "escalations@cims-bank.et";
        String recipientName = newRole;
        if (newUserId != null && !newUserId.isBlank()) {
            User u = findUser(newUserId);
            if (u != null) {
                recipientEmail = u.getEmail() != null ? u.getEmail() : u.getUsername() + "@cims-bank.et";
                recipientName = u.getFullName();
            }
        }
        String subject = "ESCALATION: CIMS Exception " + exc.getId() + " Overdue SLA [Level " + exc.getEscalationLevel() + "]";
        String body = String.format(Locale.ROOT,
                "Exception %s (%s) has been escalated to %s. Reason: %s. SLA was due on %s. Immediate corrective action required.",
                exc.getId(), exc.getExceptionType(), (recipientName != null ? recipientName : newRole),
                reason, exc.getSlaDueDate());
        sendNotification("Email", "EXCEPTION_ESCALATION", recipientEmail, recipientName, subject, body, "Exception", exc.getId());
    }

    // --- Dynamic Expiry Reminders Engine (SysAdmin schedules + business calendar) ---
    public Map<String,Object> runPolicyExpiryReminders(){
        int evaluated=0, dispatched=0, skippedByThrottle=0;
        LocalDate today=LocalDate.now();
        List<InsurancePolicy> policies=insurancePolicyRepository.findAll().stream().filter(p->isCoverageActiveStatus(p.getStatus())&&p.getExpiryDate()!=null).toList();
        List<ReminderSchedule> configured=reminderConfigurationService.getAll();
        int continuation=configurationService.getReminderContinuationIntervalWorkingDays();
        int maxPerRecipient=configurationService.getMaxReminderNotificationsPerRecipientPerDay();

        Map<String,List<String>> grouped=new LinkedHashMap<>();
        for(InsurancePolicy policy:policies){
            try{
                LocalDate expiry=LocalDate.parse(policy.getExpiryDate().substring(0,10));
                if(expiry.isBefore(today))continue;
                int days=businessCalendarService.workingDaysUntil(today,expiry);
                evaluated++;
                boolean trigger=configured.stream().anyMatch(s->s.isActive()&&s.getDaysBeforeExpiry()==days);
                if(days<=20 && days>0 && days%continuation==0) trigger=true;
                if(!trigger)continue;

                List<String> roles=new ArrayList<>();
                configured.stream().filter(s->s.isActive()&&s.getDaysBeforeExpiry()==days).findFirst().ifPresent(s->roles.addAll(parseJsonStringArray(s.getRecipientRolesJson())));
                if(roles.isEmpty()) roles.addAll(List.of("CRO","BRO","SRM","BRM"));
                List<String> channels=new ArrayList<>();
                configured.stream().filter(s->s.isActive()&&s.getDaysBeforeExpiry()==days).findFirst().ifPresent(s->channels.addAll(parseJsonStringArray(s.getChannelsJson())));
                if(channels.isEmpty())channels.addAll(List.of("Email","SMS"));

                String colCode=collateralRepository.findById(policy.getCollateralId()).map(Collateral::getCode).orElse(policy.getCollateralId());
                String line="• "+policy.getPolicyNumber()+" | Collateral: "+colCode+" | Expiry: "+policy.getExpiryDate()+" | "+days+" working days remaining";
                for(String role:roles){
                    List<User> users=userRepository.findByRoleIgnoreCaseAndActiveTrue(role);
                    if(users.isEmpty()) users=List.of();
                    for(User u:users){
                        for(String channel:channels){
                            String key=(u.getId()==null?u.getUsername():u.getId())+"|"+channel;
                            grouped.computeIfAbsent(key,k->new ArrayList<>()).add(line);
                        }
                    }
                }
            }catch(Exception e){logAudit("SYSTEM","SYSADMIN","REMINDER_EVALUATION_ERROR","InsurancePolicy",policy.getId(),"Error","",e.getMessage(),"Reminder evaluation failed");}
        }

        Map<String,Integer> sentToday=new HashMap<>();
        for(Map.Entry<String,List<String>> entry:grouped.entrySet()){
            String[] key=entry.getKey().split("\\|",2); String recipientId=key[0], channel=key.length>1?key[1]:"Email";
            User user=userRepository.findById(recipientId).orElse(null);
            if(user==null)continue;
            String recipient=channel.equalsIgnoreCase("Email")?user.getEmail():user.getPhone();
            if(recipient==null||recipient.isBlank())continue;
            int already=sentToday.getOrDefault(user.getId(),(int)countTodayAudit("REMINDER_SENT",user.getId()));
            if(already>=maxPerRecipient){skippedByThrottle+=entry.getValue().size();continue;}
            String subject="CIMS Insurance Expiry Reminder ("+entry.getValue().size()+" policy/policies)";
            String body="The following insurance policies require renewal action:\n\n"+String.join("\n",entry.getValue())+"\n\nPlease initiate renewal and ensure uninterrupted coverage.";
            sendNotification(channel,"POLICY_EXPIRY_REMINDER",recipient,user.getFullName(),subject,body,"Insurance Policy","PORTFOLIO",Map.of("Days Remaining","Configured reminder stage"));
            logAudit("SYSTEM","SYSADMIN","REMINDER_SENT","ReminderRecipient",user.getId(),"Channel","",""+channel,"Consolidated expiry reminder sent for "+entry.getValue().size()+" policy/policies.");
            sentToday.put(user.getId(),already+1);
            dispatched++;
        }

        // Customer notifications: every configured frequency days beginning at the configured start window.
        int customerStart=configurationService.getCustomerNotificationStartDays(), customerFreq=configurationService.getCustomerNotificationFrequencyDays();
        for(InsurancePolicy policy:policies){
            try{
                LocalDate expiry=LocalDate.parse(policy.getExpiryDate().substring(0,10));
                int days=(int)ChronoUnit.DAYS.between(today,expiry);
                if(days<0||days>customerStart||days%customerFreq!=0)continue;
                Optional<Customer> cOpt=policy.getCustomerId()==null?Optional.empty():customerRepository.findById(policy.getCustomerId());
                if(cOpt.isEmpty())continue;
                Customer c=cOpt.get();
                String recipient=c.getEmail()!=null&&!c.getEmail().isBlank()?c.getEmail():c.getPhone();
                if(recipient==null||recipient.isBlank())continue;
                if(countTodayAudit("CUSTOMER_REMINDER_SENT",c.getId())>=1)continue;
                String channel=c.getEmail()!=null&&!c.getEmail().isBlank()?"Email":"SMS";
                sendNotification(channel,"CUSTOMER_POLICY_EXPIRY_REMINDER",recipient,c.getName(),"Insurance Policy Renewal Reminder","Dear "+c.getName()+", your insurance policy "+policy.getPolicyNumber()+" expires on "+policy.getExpiryDate()+". Please contact the Bank to arrange renewal.","Insurance Policy",policy.getId(),Map.of("Customer Name",c.getName(),"Policy Number",policy.getPolicyNumber(),"Expiry Date",policy.getExpiryDate(),"Days Remaining",days));
                logAudit("SYSTEM","SYSADMIN","CUSTOMER_REMINDER_SENT","Customer",c.getId(),"Policy",policy.getId(),"Sent","Customer renewal reminder sent.");
                dispatched++;
            }catch(Exception e){logAudit("SYSTEM","SYSADMIN","CUSTOMER_REMINDER_ERROR","InsurancePolicy",policy.getId(),"Error","",e.getMessage(),"Customer reminder failed");}
        }
        return Map.of("success",true,"evaluatedCount",evaluated,"dispatchedCount",dispatched,"skippedByThrottle",skippedByThrottle,"scheduleCount",configured.size(),"message","Evaluated configured working-day expiry reminders, customer notifications and throttling.");
    }

    private long countTodayAudit(String action,String entityId){
        String today=LocalDate.now().toString();
        return auditLogRepository.findByActionTypeAndEntityId(action,entityId).stream().filter(a->a.getTimestamp()!=null&&a.getTimestamp().startsWith(today)).count();
    }

    private List<String> parseJsonStringArray(String json){
        if(json==null||json.isBlank())return new ArrayList<>();
        String n=json.trim(); if(n.startsWith("[")&&n.endsWith("]"))n=n.substring(1,n.length()-1); if(n.isBlank())return new ArrayList<>();
        List<String> r=new ArrayList<>(); for(String item:n.split(",")){String v=item.trim().replaceAll("^\\\"|\\\"$",""); if(!v.isBlank())r.add(v);} return r;
    }

    // =========================================================================
    // EXCEPTION MANAGEMENT MODULE (US-12.1 to US-12.4 & BRD Requirements)
    // =========================================================================

    public void assertCanMutateException(String userId, String exceptionId, String action) {
        if (userId == null || userId.isBlank() || "SYSTEM".equalsIgnoreCase(userId)) {
            return;
        }
        User user = findUser(userId);
        if (user == null || !user.isActive()) {
            throw new IllegalStateException("User " + userId + " is not active or authorized.");
        }
        String role = user.getRole() != null ? user.getRole().toUpperCase(Locale.ROOT) : "";
        if ("AUDITOR".equals(role) || "RDONLY".equals(role)) {
            throw new IllegalStateException("Permission Denied: Read-only role '" + role + "' cannot perform '" + action + "' on exceptions.");
        }
        if ("SYSADMIN".equals(role)) {
            // SysAdmin can reassign/escalate/update notes, but per §11 transactional approvals are checker duties
            return;
        }
        // Verify role has EDIT permission on Exceptions
        assertUserPermission(userId, "Exceptions", "EDIT");
    }

    public void assignException(String exceptionId, ExceptionAssignmentRequest request, String actingUserId) {
        assertCanMutateException(actingUserId, exceptionId, "ASSIGN");
        CimsException exc = cimsExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Exception not found: " + exceptionId));

        if ("Resolved".equalsIgnoreCase(exc.getStatus())) {
            throw new IllegalStateException("Cannot reassign a resolved exception.");
        }

        String prevRole = exc.getAssignedToRole();
        String prevUserId = exc.getAssignedToUserId();
        String targetRole = request.getAssignedRole() != null && !request.getAssignedRole().isBlank()
                ? request.getAssignedRole() : prevRole;
        String targetUserId = request.getAssignedUserId();

        exc.setAssignedToRole(targetRole);
        exc.setAssignedToUserId(targetUserId);
        exc.setAssignedAt(LocalDateTime.now().toString());
        exc.setAssignedBy(actingUserId != null ? actingUserId : "SYSTEM");
        if ("Open".equalsIgnoreCase(exc.getStatus())) {
            exc.setStatus("In Progress");
        }
        cimsExceptionRepository.save(exc);

        // Record persistent assignment history (US-12.2 & Requirement §8)
        CimsExceptionAssignmentHistory history = new CimsExceptionAssignmentHistory(
                "asgn-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                prevRole,
                prevUserId,
                targetRole,
                targetUserId,
                actingUserId,
                request.getReason() != null ? request.getReason() : "Reassignment"
        );
        cimsExceptionAssignmentHistoryRepository.save(history);

        // Multi-record Investigation History note (Requirement §7)
        User actingUser = findUser(actingUserId);
        String authorName = actingUser != null ? actingUser.getFullName() : (actingUserId != null ? actingUserId : "System");
        CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                actingUserId != null ? actingUserId : "SYSTEM",
                authorName,
                "Reassigned from [" + (prevRole != null ? prevRole : "None") + "/" + (prevUserId != null ? prevUserId : "None") +
                "] to [" + targetRole + "/" + (targetUserId != null ? targetUserId : "Unassigned") + "]. Reason: " +
                (request.getReason() != null ? request.getReason() : "Operational Reassignment")
        );
        cimsExceptionInvestigationNoteRepository.save(note);

        // Audit Log
        logAudit(actingUserId, actingUser != null ? actingUser.getRole() : "COMPLIANCE", "ASSIGN_EXCEPTION",
                "Exception", exceptionId, "AssignedTo",
                (prevUserId != null ? prevUserId : prevRole),
                (targetUserId != null ? targetUserId : targetRole),
                "Exception reassigned: " + request.getReason());

        // Notify newly assigned user / role (US-12.2 & Requirement §14)
        notifyExceptionAssigned(exc, targetRole, targetUserId, "Investigate and resolve reassigned exception");
    }

    public void validateExceptionUnderlyingConditionCleared(CimsException exc) {
        String type = exc.getExceptionType() != null ? exc.getExceptionType().trim() : "";
        LocalDate today = LocalDate.now();

        switch (type) {
            case "Underinsured Collateral" -> {
                final String colId = (exc.getCollateralId() != null && !exc.getCollateralId().isBlank())
                        ? exc.getCollateralId() : exc.getEntityId();
                if (colId == null || colId.isBlank()) {
                    throw new IllegalArgumentException("Cannot resolve Underinsured Collateral because no collateral record is linked.");
                }
                updateCollateralStatus(colId);
                Optional<Collateral> colOpt = collateralRepository.findById(colId);
                if (colOpt.isEmpty()) {
                    colOpt = collateralRepository.findAll().stream()
                            .filter(c -> colId.equalsIgnoreCase(c.getCode()) || colId.equalsIgnoreCase(c.getId()))
                            .findFirst();
                }
                if (colOpt.isEmpty()) {
                    throw new IllegalArgumentException("Cannot resolve Underinsured Collateral because collateral record '" + colId + "' was not found.");
                }
                Collateral col = colOpt.get();
                boolean isMandatory = effectiveInsuranceService.isInsuranceMandatory(col.getCategory(), col.getType());
                if (isMandatory) {
                    double threshold = configurationService.getMinimumCoverageAdequacyPct();
                    if (col.getNetInsuranceCoveragePct() < threshold) {
                        double deficit = Math.max(0.0, col.getValuationAmount() - col.getInsuredAmount());
                        throw new IllegalArgumentException("Cannot resolve Underinsured Collateral because coverage (" +
                                String.format(Locale.ROOT, "%.1f", col.getNetInsuranceCoveragePct()) +
                                "%) is still below the required adequacy threshold of " +
                                String.format(Locale.ROOT, "%.1f", threshold) +
                                "%. Net deficit remaining: ETB " + String.format(Locale.ROOT, "%,.2f", deficit) +
                                ". Increase coverage, amend policy, or record an Authorized Override if sanctioned.");
                    }
                }
            }
            case "Expired Policy" -> {
                final String polId = (exc.getPolicyId() != null && !exc.getPolicyId().isBlank())
                        ? exc.getPolicyId() : exc.getEntityId();
                if (polId != null && !polId.isBlank()) {
                    Optional<InsurancePolicy> polOpt = insurancePolicyRepository.findById(polId);
                    if (polOpt.isPresent()) {
                        InsurancePolicy p = polOpt.get();
                        boolean renewedOrReplaced = (p.getReplacesPolicyId() != null && !p.getReplacesPolicyId().isBlank()) ||
                                insurancePolicyRepository.findAll().stream().anyMatch(other ->
                                        p.getId().equalsIgnoreCase(other.getReplacesPolicyId()) ||
                                        (p.getId().equalsIgnoreCase(other.getRenewedFromPolicyId()) && isCoverageActiveStatus(other.getStatus())));

                        boolean futureExpiry = false;
                        if (p.getExpiryDate() != null && !p.getExpiryDate().isBlank()) {
                            try {
                                LocalDate exp = LocalDate.parse(p.getExpiryDate().substring(0, 10));
                                futureExpiry = !exp.isBefore(today);
                            } catch (Exception ignored) {}
                        }

                        boolean otherActiveOnCollateral = false;
                        if (p.getCollateralId() != null && !p.getCollateralId().isBlank()) {
                            List<InsurancePolicy> siblings = insurancePolicyRepository.findByCollateralId(p.getCollateralId());
                            otherActiveOnCollateral = siblings.stream().anyMatch(other ->
                                    !other.getId().equalsIgnoreCase(p.getId()) && isCoverageActiveStatus(other.getStatus()));
                        }

                        if (!renewedOrReplaced && !futureExpiry && !otherActiveOnCollateral) {
                            throw new IllegalArgumentException("Cannot resolve Expired Policy because policy " + p.getPolicyNumber() +
                                    " remains expired (expiry: " + p.getExpiryDate() +
                                    ") and no valid active renewal or replacement policy has been registered. Record an Authorized Override if sanctioned.");
                        }
                    }
                }
            }
            case "Missing Insurance" -> {
                final String colId = (exc.getCollateralId() != null && !exc.getCollateralId().isBlank())
                        ? exc.getCollateralId() : exc.getEntityId();
                if (colId != null && !colId.isBlank()) {
                    Optional<Collateral> colOpt = collateralRepository.findById(colId);
                    if (colOpt.isEmpty()) {
                        colOpt = collateralRepository.findAll().stream()
                                .filter(c -> colId.equalsIgnoreCase(c.getCode()) || colId.equalsIgnoreCase(c.getId()))
                                .findFirst();
                    }
                    if (colOpt.isPresent()) {
                        Collateral col = colOpt.get();
                        boolean isMandatory = effectiveInsuranceService.isInsuranceMandatory(col.getCategory(), col.getType());
                        if (isMandatory) {
                            List<InsurancePolicy> attached = insurancePolicyRepository.findByCollateralId(col.getId());
                            if (attached.isEmpty() && col.getCode() != null) {
                                attached = insurancePolicyRepository.findByCollateralId(col.getCode());
                            }
                            boolean hasActive = attached.stream().anyMatch(p -> isCoverageActiveStatus(p.getStatus()));
                            if (!hasActive) {
                                throw new IllegalArgumentException("Cannot resolve Missing Insurance because collateral " +
                                        col.getCode() + " has mandatory insurance requirement but has no valid active insurance policy registered. Register policy or record an Authorized Override.");
                            }
                        }
                    }
                }
            }
            case "Missing Mandatory Document", "Missing Document" -> {
                String colId = exc.getCollateralId();
                if (colId == null || colId.isBlank()) {
                    colId = exc.getEntityId();
                }
                if (colId != null && !colId.isBlank()) {
                    Optional<Collateral> colOpt = collateralRepository.findById(colId);
                    if (colOpt.isPresent()) {
                        Collateral col = colOpt.get();
                        List<MandatoryDocumentRule> mandatoryRules = mandatoryDocumentRuleRepository.findAll();
                        List<OwnershipDocument> allDocs = ownershipDocumentRepository.findAll();

                        for (MandatoryDocumentRule rule : mandatoryRules) {
                            if (!rule.isMandatory() || !validationService.categoryMatches(rule.getCollateralCategory(), col)) {
                                continue;
                            }
                            if (exc.getId() != null && exc.getId().contains(rule.getId())) {
                                boolean found = allDocs.stream().anyMatch(d ->
                                        validationService.documentBelongsToCollateral(d, col) &&
                                        validationService.docTypeMatches(rule.getDocumentType(), d.getType()) &&
                                        !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) &&
                                        !"Archived".equalsIgnoreCase(d.getStatus()) &&
                                        ((d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank())));

                                if (!found) {
                                    throw new IllegalArgumentException("Cannot resolve Missing Mandatory Document because required document '" +
                                            rule.getDocumentType() + "' for collateral " + col.getCode() +
                                            " is still missing or not verified in the document repository. Upload/associate document or record an Authorized Override.");
                                }
                            }
                        }
                    }
                }
            }
            case "Unapproved Insurer" -> {
                String polId = exc.getPolicyId();
                if (polId == null || polId.isBlank()) {
                    polId = exc.getEntityId();
                }
                if (polId != null && !polId.isBlank()) {
                    Optional<InsurancePolicy> polOpt = insurancePolicyRepository.findById(polId);
                    if (polOpt.isPresent()) {
                        InsurancePolicy p = polOpt.get();
                        String rawIns = p.getInsurerName() != null ? p.getInsurerName().trim() : "";
                        String pIns = rawIns.toLowerCase();
                        List<ApprovedInsurer> approvedInsurers = approvedInsurerRepository.findAll();
                        boolean approved = !rawIns.isBlank() && approvedInsurers.stream().anyMatch(i ->
                                i.isActive() && i.getName() != null && (
                                        i.getName().equalsIgnoreCase(rawIns) ||
                                        pIns.contains(i.getName().toLowerCase().replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim()) ||
                                        i.getName().toLowerCase().contains(pIns.replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim())
                                )
                        );
                        if (!approved) {
                            throw new IllegalArgumentException("Cannot resolve Unapproved Insurer because insurer '" +
                                    p.getInsurerName() + "' on policy " + p.getPolicyNumber() +
                                    " is not an active approved insurer in the bank master list. Replace insurer or record an Authorized Override.");
                        }
                    }
                }
            }
            case "Renewal Delay" -> {
                String polId = exc.getPolicyId();
                if (polId == null || polId.isBlank()) {
                    polId = exc.getEntityId();
                }
                if (polId != null && !polId.isBlank()) {
                    Optional<InsurancePolicy> polOpt = insurancePolicyRepository.findById(polId);
                    if (polOpt.isPresent()) {
                        InsurancePolicy p = polOpt.get();
                        boolean renewedOrReplaced = (p.getReplacesPolicyId() != null && !p.getReplacesPolicyId().isBlank()) ||
                                insurancePolicyRepository.findAll().stream().anyMatch(other ->
                                        p.getId().equalsIgnoreCase(other.getReplacesPolicyId()) ||
                                        (p.getId().equalsIgnoreCase(other.getRenewedFromPolicyId()) && isCoverageActiveStatus(other.getStatus())));

                        boolean futureExpiry = false;
                        if (p.getExpiryDate() != null && !p.getExpiryDate().isBlank()) {
                            try {
                                LocalDate exp = LocalDate.parse(p.getExpiryDate().substring(0, 10));
                                futureExpiry = !exp.isBefore(today);
                            } catch (Exception ignored) {}
                        }

                        if (!renewedOrReplaced && !futureExpiry) {
                            throw new IllegalArgumentException("Cannot resolve Renewal Delay because policy " + p.getPolicyNumber() +
                                    " has not completed renewal or replacement. Complete renewal or record an Authorized Override.");
                        }
                    }
                }
            }
            case "Policy Inconsistency" -> {
                String polId = exc.getPolicyId();
                if (polId == null || polId.isBlank()) polId = exc.getEntityId();
                if (polId != null && !polId.isBlank()) {
                    Optional<InsurancePolicy> polOpt = insurancePolicyRepository.findById(polId);
                    if (polOpt.isPresent()) {
                        InsurancePolicy p = polOpt.get();
                        if (exc.getId() != null && exc.getId().contains("amt") && p.getInsuredAmount() <= 0) {
                            throw new IllegalArgumentException("Cannot resolve Policy Inconsistency because policy " +
                                    p.getPolicyNumber() + " still has a non-positive insured amount (ETB " + p.getInsuredAmount() + ").");
                        }
                        if (exc.getId() != null && exc.getId().contains("tenor")) {
                            try {
                                LocalDate eff = LocalDate.parse(p.getEffectiveDate().substring(0, 10));
                                LocalDate exp = LocalDate.parse(p.getExpiryDate().substring(0, 10));
                                if (!exp.isAfter(eff)) {
                                    throw new IllegalArgumentException("Cannot resolve Policy Inconsistency because expiry date (" +
                                            p.getExpiryDate() + ") is on or before effective date (" + p.getEffectiveDate() + ").");
                                }
                            } catch (IllegalArgumentException iae) { throw iae; } catch (Exception ignored) {}
                        }
                    }
                }
            }
            case "Duplicate Insurance Policy" -> {
                if (exc.getEntityId() != null && !exc.getEntityId().isBlank()) {
                    long activeCount = insurancePolicyRepository.findAll().stream()
                            .filter(p -> p.getPolicyNumber() != null &&
                                    p.getPolicyNumber().trim().equalsIgnoreCase(exc.getEntityId().trim()) &&
                                    isCoverageActiveStatus(p.getStatus()))
                            .count();
                    if (activeCount >= 2) {
                        throw new IllegalArgumentException("Cannot resolve Duplicate Insurance Policy because " +
                                activeCount + " active policies with policy number '" + exc.getEntityId() +
                                "' still exist in the register. Deactivate duplicate record or record an Authorized Override.");
                    }
                }
            }
            case "Insurer Concentration Breach" -> {
                double totalInsuredExposure = insurancePolicyRepository.findAll().stream()
                        .filter(p -> isCoverageActiveStatus(p.getStatus()))
                        .mapToDouble(InsurancePolicy::getInsuredAmount).sum();
                if (totalInsuredExposure > 0 && exc.getEntityId() != null && !exc.getEntityId().isBlank()) {
                    String insurerName = exc.getEntityId().trim();
                    double insExposure = insurancePolicyRepository.findAll().stream()
                            .filter(p -> isCoverageActiveStatus(p.getStatus()) && insurerName.equalsIgnoreCase(p.getInsurerName()))
                            .mapToDouble(InsurancePolicy::getInsuredAmount).sum();
                    double share = (insExposure / totalInsuredExposure) * 100.0;
                    double cap = configurationService.getMaxInsurerConcentrationPct();
                    if (share > cap) {
                        throw new IllegalArgumentException("Cannot resolve Insurer Concentration Breach because insurer '" +
                                insurerName + "' concentration (" + String.format(Locale.ROOT, "%.1f", share) +
                                "%) still exceeds regulatory cap of " + String.format(Locale.ROOT, "%.1f", cap) + "%.");
                    }
                }
            }
            case "Document Nearing Expiry" -> {
                if (exc.getEntityId() != null && !exc.getEntityId().isBlank()) {
                    Optional<OwnershipDocument> docOpt = ownershipDocumentRepository.findById(exc.getEntityId());
                    if (docOpt.isPresent()) {
                        try {
                            LocalDate exp = LocalDate.parse(docOpt.get().getExpiryDate().substring(0, 10));
                            LocalDate warningDate = today.plusDays(configurationService.getDocumentExpiryWarningDays());
                            if (!exp.isAfter(warningDate)) {
                                throw new IllegalArgumentException("Cannot resolve Document Nearing Expiry because document '" +
                                        docOpt.get().getName() + "' expiry (" + docOpt.get().getExpiryDate() +
                                        ") is still within the warning window. Extend expiry or record an Authorized Override.");
                            }
                        } catch (IllegalArgumentException iae) { throw iae; } catch (Exception ignored) {}
                    }
                }
            }
            default -> {}
        }
    }

    public void resolveException(String exceptionId, ExceptionResolutionRequest request, String actingUserId) {
        if (request.getResolutionNotes() == null || request.getResolutionNotes().trim().isBlank()) {
            throw new IllegalArgumentException("Investigation and resolution notes are mandatory when resolving an exception.");
        }
        if (request.getCorrectiveAction() == null || request.getCorrectiveAction().trim().isBlank()) {
            throw new IllegalArgumentException("Corrective action is mandatory when resolving an exception.");
        }
        assertCanMutateException(actingUserId, exceptionId, "RESOLVE");

        CimsException exc = cimsExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Exception not found: " + exceptionId));

        if ("Resolved".equalsIgnoreCase(exc.getStatus())) {
            throw new IllegalStateException("Exception " + exceptionId + " is already resolved.");
        }

        User actingUser = findUser(actingUserId);
        String role = actingUser != null && actingUser.getRole() != null ? actingUser.getRole().toUpperCase(Locale.ROOT) : "";

        boolean isOverride = request.isOverride();
        if (isOverride) {
            // Authorized Override Path (Prompt §32 & §37)
            boolean isApprover = Arrays.asList("BRMGR", "MGRCOLLDOC", "DISTDIR", "HODEPT", "SRMGMT", "EXEC", "COMPLIANCE", "RISK").contains(role);
            if (!isApprover) {
                throw new IllegalStateException("Permission Denied: User role '" + (role.isEmpty() ? "Unknown" : role) +
                        "' is not authorized to grant an Authorized Exception/Override. Requires Branch Manager, District Director, or HO Dept approval.");
            }
            if (request.getOverrideReason() == null || request.getOverrideReason().trim().isBlank()) {
                throw new IllegalArgumentException("Override reason / sanction memo reference is mandatory when recording an Authorized Exception/Override.");
            }
        } else {
            // Business Condition Verification Path (Prompt §31, §47)
            validateExceptionUnderlyingConditionCleared(exc);
        }

        String prevStatus = exc.getStatus();
        exc.setStatus("Resolved");
        exc.setCorrectiveAction(request.getCorrectiveAction().trim());
        String effectiveNotes = isOverride
                ? "[AUTHORIZED OVERRIDE - Approved by " + (actingUser != null ? actingUser.getFullName() : actingUserId) +
                  " (" + (role.isEmpty() ? "Checker" : role) + ")]: " + request.getOverrideReason().trim() +
                  " | Resolution Notes: " + request.getResolutionNotes().trim()
                : request.getResolutionNotes().trim();
        exc.setResolutionNotes(effectiveNotes);
        if (request.getEvidenceDocument() != null && !request.getEvidenceDocument().isBlank()) {
            exc.setEvidenceDocument(request.getEvidenceDocument().trim());
        }
        exc.setResolvedAt(LocalDateTime.now().toString());
        exc.setResolvedBy(actingUserId != null ? actingUserId : "SYSTEM");
        cimsExceptionRepository.save(exc);

        // Synchronize collateral status if collateral was linked
        if (exc.getCollateralId() != null && !exc.getCollateralId().isBlank()) {
            try {
                updateCollateralStatus(exc.getCollateralId());
            } catch (Exception ignored) {}
        }

        // Multi-record Investigation History (US-12.3 & Requirement §7)
        String authorName = actingUser != null ? actingUser.getFullName() : (actingUserId != null ? actingUserId : "Resolver");
        String noteContent = (isOverride ? "RESOLVED VIA AUTHORIZED OVERRIDE. Sanction Memo: " + request.getOverrideReason().trim() + ". " : "RESOLVED. ") +
                "Corrective Action: " + request.getCorrectiveAction().trim() +
                ". Resolution Notes: " + request.getResolutionNotes().trim() +
                (request.getEvidenceDocument() != null && !request.getEvidenceDocument().isBlank()
                        ? " [Evidence Reference: " + request.getEvidenceDocument().trim() + "]" : "");

        CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                actingUserId,
                authorName,
                noteContent
        );
        cimsExceptionInvestigationNoteRepository.save(note);

        logAudit(actingUserId, role.isEmpty() ? "COMPLIANCE" : role,
                isOverride ? "RESOLVE_EXCEPTION_OVERRIDE" : "RESOLVE_EXCEPTION",
                "Exception", exceptionId, "Status", prevStatus, "Resolved", effectiveNotes);
    }

    public void addExceptionEvidence(String exceptionId, ExceptionEvidenceRequest request, String actingUserId) {
        assertCanMutateException(actingUserId, exceptionId, "EVIDENCE");
        CimsException exc = cimsExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Exception not found: " + exceptionId));

        String ref = request.getDmsRef() != null && !request.getDmsRef().isBlank() ? request.getDmsRef().trim() : request.getDocumentId();
        if (ref != null && !ref.isBlank()) {
            String existing = exc.getEvidenceDocument();
            exc.setEvidenceDocument(existing != null && !existing.isBlank() ? existing + ", " + ref : ref);
            cimsExceptionRepository.save(exc);
        }

        User actingUser = findUser(actingUserId);
        String authorName = actingUser != null ? actingUser.getFullName() : (actingUserId != null ? actingUserId : "Investigator");
        String docDesc = (request.getDocumentName() != null ? request.getDocumentName() : "Document") +
                (ref != null ? " [Ref: " + ref + "]" : "");
        String noteText = "Evidence Document Associated: " + docDesc +
                (request.getNotes() != null && !request.getNotes().isBlank() ? ". Notes: " + request.getNotes() : "");

        CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                actingUserId,
                authorName,
                noteText
        );
        cimsExceptionInvestigationNoteRepository.save(note);

        logAudit(actingUserId, actingUser != null ? actingUser.getRole() : "COMPLIANCE", "ADD_EXCEPTION_EVIDENCE",
                "Exception", exceptionId, "Evidence", "", ref != null ? ref : "Doc", noteText);
    }

    public void recordExceptionCorrectiveAction(String exceptionId, ExceptionCorrectiveActionRequest request, String actingUserId) {
        assertCanMutateException(actingUserId, exceptionId, "CORRECTIVE_ACTION");
        if (request.getCorrectiveAction() == null || request.getCorrectiveAction().trim().isBlank()) {
            throw new IllegalArgumentException("Corrective action description is required.");
        }
        CimsException exc = cimsExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Exception not found: " + exceptionId));

        exc.setCorrectiveAction(request.getCorrectiveAction().trim());
        cimsExceptionRepository.save(exc);

        User actingUser = findUser(actingUserId);
        String authorName = actingUser != null ? actingUser.getFullName() : (actingUserId != null ? actingUserId : "Investigator");
        String noteText = "Corrective Action Logged: " + request.getCorrectiveAction().trim() +
                (request.getTargetCompletionDate() != null && !request.getTargetCompletionDate().isBlank() ? " [Target: " + request.getTargetCompletionDate() + "]" : "") +
                (request.getActionNotes() != null && !request.getActionNotes().isBlank() ? ". Notes: " + request.getActionNotes().trim() : "");

        CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                actingUserId,
                authorName,
                noteText
        );
        cimsExceptionInvestigationNoteRepository.save(note);

        logAudit(actingUserId, actingUser != null ? actingUser.getRole() : "COMPLIANCE", "RECORD_CORRECTIVE_ACTION",
                "Exception", exceptionId, "CorrectiveAction", "", request.getCorrectiveAction().trim(), noteText);
    }

    public void resolveException(String exceptionId, String correctiveAction, String resolutionNotes, String evidenceDocument, String userId) {
        ExceptionResolutionRequest req = new ExceptionResolutionRequest();
        req.setCorrectiveAction(correctiveAction);
        req.setResolutionNotes(resolutionNotes);
        req.setEvidenceDocument(evidenceDocument);
        resolveException(exceptionId, req, userId);
    }

    public void resolveException(String exceptionId, String correctiveAction, String resolutionNotes, String userId) {
        resolveException(exceptionId, correctiveAction, resolutionNotes, null, userId);
    }

    public void escalateException(String exceptionId, ExceptionEscalationRequest request, String actingUserId) {
        assertCanMutateException(actingUserId, exceptionId, "ESCALATE");
        CimsException exc = cimsExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Exception not found: " + exceptionId));

        if ("Resolved".equalsIgnoreCase(exc.getStatus())) {
            throw new IllegalStateException("Cannot escalate a resolved exception.");
        }

        String prevStatus = exc.getStatus();
        String prevRole = exc.getAssignedToRole();
        String prevUserId = exc.getAssignedToUserId();

        int nextLevel = exc.getEscalationLevel() + 1;
        String targetRole = request.getEscalationRole();
        if (targetRole == null || targetRole.isBlank()) {
            targetRole = determineNextEscalationRole(prevRole, nextLevel);
        }

        String targetUserId = null;
        if (request.getTargetUserId() != null && !request.getTargetUserId().isBlank()) {
            targetUserId = request.getTargetUserId();
        } else {
            // Route up hierarchy to branch manager or district director
            if ("BRMGR".equalsIgnoreCase(targetRole) && exc.getBranch() != null) {
                targetUserId = userRepository.findByRoleIgnoreCaseAndActiveTrue("BRMGR").stream()
                        .filter(u -> exc.getBranch().equalsIgnoreCase(u.getBranch()))
                        .map(User::getId).findFirst().orElse(null);
            } else if ("DISTDIR".equalsIgnoreCase(targetRole) && exc.getDistrict() != null) {
                targetUserId = userRepository.findByRoleIgnoreCaseAndActiveTrue("DISTDIR").stream()
                        .filter(u -> exc.getDistrict().equalsIgnoreCase(resolveDistrictForBranch(u.getBranch())))
                        .map(User::getId).findFirst().orElse(null);
            }
        }

        exc.setStatus("Escalated");
        exc.setAssignedToRole(targetRole);
        exc.setAssignedToUserId(targetUserId);
        exc.setEscalationLevel(nextLevel);
        exc.setLastEscalationDate(LocalDate.now().toString());
        exc.setNextEscalationDue(LocalDate.now().plusDays(15).toString());
        cimsExceptionRepository.save(exc);

        // Record persistent escalation history (US-12.4 & Requirement §18)
        CimsExceptionEscalationHistory history = new CimsExceptionEscalationHistory(
                "esc-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                prevStatus,
                prevRole,
                prevUserId,
                targetRole,
                targetUserId,
                nextLevel,
                actingUserId,
                request.getReason() != null ? request.getReason() : "Manual Escalation to Hierarchy"
        );
        cimsExceptionEscalationHistoryRepository.save(history);

        // Add investigation note
        User actingUser = findUser(actingUserId);
        String authorName = actingUser != null ? actingUser.getFullName() : (actingUserId != null ? actingUserId : "User");
        CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                actingUserId != null ? actingUserId : "SYSTEM",
                authorName,
                "ESCALATED to level " + nextLevel + " [" + targetRole + "]. Reason: " +
                (request.getReason() != null ? request.getReason() : "Escalation requested")
        );
        cimsExceptionInvestigationNoteRepository.save(note);

        logAudit(actingUserId, actingUser != null ? actingUser.getRole() : "COMPLIANCE", "ESCALATE_EXCEPTION",
                "Exception", exceptionId, "Status", prevStatus, "Escalated",
                "Escalated to " + targetRole + ". Reason: " + request.getReason());

        notifyExceptionEscalated(exc, targetRole, targetUserId, request.getReason() != null ? request.getReason() : "Escalated for immediate review");
    }

    public void escalateException(String exceptionId, String escalationRole, String userId) {
        ExceptionEscalationRequest req = new ExceptionEscalationRequest();
        req.setEscalationRole(escalationRole);
        req.setReason("Operational Escalation to " + escalationRole);
        escalateException(exceptionId, req, userId);
    }

    private String determineNextEscalationRole(String currentRole, int level) {
        if (currentRole == null) return "BRMGR";
        return switch (currentRole.toUpperCase(Locale.ROOT)) {
            case "RO", "CRO", "BRO", "COLLDOCOFF" -> "BRMGR";
            case "BRMGR", "SRM", "BRM" -> "DISTDIR";
            case "DISTDIR" -> "HODEPT";
            case "HODEPT", "RISK" -> "COMPLIANCE";
            default -> "DISTDIR";
        };
    }

    public void addInvestigationNote(String exceptionId, ExceptionInvestigationNoteRequest request, String actingUserId) {
        if (request.getNoteText() == null || request.getNoteText().trim().isBlank()) {
            throw new IllegalArgumentException("Investigation note text cannot be blank.");
        }
        assertCanMutateException(actingUserId, exceptionId, "ADD_NOTE");

        CimsException exc = cimsExceptionRepository.findById(exceptionId)
                .orElseThrow(() -> new IllegalArgumentException("Exception not found: " + exceptionId));

        if ("Resolved".equalsIgnoreCase(exc.getStatus())) {
            throw new IllegalStateException("Cannot add investigation notes to a resolved exception.");
        }

        User actingUser = findUser(actingUserId);
        String authorName = actingUser != null ? actingUser.getFullName() : (actingUserId != null ? actingUserId : "Investigator");

        CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                exceptionId,
                actingUserId,
                authorName,
                request.getNoteText().trim()
        );
        cimsExceptionInvestigationNoteRepository.save(note);

        if ("Open".equalsIgnoreCase(exc.getStatus())) {
            exc.setStatus("In Progress");
            cimsExceptionRepository.save(exc);
        }

        logAudit(actingUserId, actingUser != null ? actingUser.getRole() : "COMPLIANCE", "ADD_EXCEPTION_NOTE",
                "Exception", exceptionId, "Note", "-", "-", "Added investigation note: " + request.getNoteText().trim());
    }

    @Transactional(readOnly = true)
    public List<CimsExceptionInvestigationNote> getInvestigationNotes(String exceptionId) {
        return cimsExceptionInvestigationNoteRepository.findByExceptionIdOrderByCreatedAtAsc(exceptionId);
    }

    @Transactional(readOnly = true)
    public List<CimsExceptionEscalationHistory> getEscalationHistory(String exceptionId) {
        return cimsExceptionEscalationHistoryRepository.findByExceptionIdOrderByEscalatedAtAsc(exceptionId);
    }

    @Transactional(readOnly = true)
    public List<CimsExceptionAssignmentHistory> getAssignmentHistory(String exceptionId) {
        return cimsExceptionAssignmentHistoryRepository.findByExceptionIdOrderByAssignedAtAsc(exceptionId);
    }

    // --- Automatic Escalation Scheduler (Requirements §16 & §17) ---
    public Map<String, Object> runAutomaticExceptionEscalation() {
        LocalDate today = LocalDate.now();
        List<CimsException> openExceptions = cimsExceptionRepository.findByStatusNot("Resolved");
        int evaluated = 0;
        int escalatedCount = 0;

        for (CimsException exc : openExceptions) {
            exc.computeSlaAndOperationalMetrics(today);
            evaluated++;

            // Only overdue exceptions escalate automatically
            if (!exc.isOverdue() || exc.getDaysOverdue() == null || exc.getDaysOverdue() <= 0) {
                continue;
            }

            // Daily throttle: consolidated escalation notifications, no more than once per day (§16)
            if (exc.getLastEscalationDate() != null && exc.getLastEscalationDate().startsWith(today.toString())) {
                continue;
            }

            int currentLevel = exc.getEscalationLevel() != null ? exc.getEscalationLevel() : 0;
            long daysOverdue = exc.getDaysOverdue() != null ? exc.getDaysOverdue() : 0L;
            boolean shouldEscalate = false;
            String nextRole = exc.getAssignedToRole();

            // Escalation sequence from BRD / Clarification (§16):
            // Level 0 -> Level 1 (overdue 1-5 days) -> Branch Manager
            // Level 1 -> Level 2 (>10 days overdue) -> District Business Manager / Area Manager
            // Level 2 -> Level 3 (every 15 days thereafter) -> Head Office / Compliance
            if (currentLevel == 0 && daysOverdue >= 1) {
                shouldEscalate = true;
                nextRole = "BRMGR";
            } else if (currentLevel == 1 && daysOverdue >= 10) {
                shouldEscalate = true;
                nextRole = "DISTDIR";
            } else if (currentLevel >= 2) {
                if (exc.getLastEscalationDate() != null) {
                    try {
                        LocalDate lastEsc = LocalDate.parse(exc.getLastEscalationDate().substring(0, 10));
                        if (ChronoUnit.DAYS.between(lastEsc, today) >= 15) {
                            shouldEscalate = true;
                            nextRole = "HODEPT";
                        }
                    } catch (Exception ignored) {
                        shouldEscalate = true;
                    }
                }
            }

            if (shouldEscalate) {
                int newLevel = currentLevel + 1;
                String prevRole = exc.getAssignedToRole();
                String prevUserId = exc.getAssignedToUserId();

                String newUserId = null;
                if ("BRMGR".equalsIgnoreCase(nextRole) && exc.getBranch() != null) {
                    newUserId = userRepository.findByRoleIgnoreCaseAndActiveTrue("BRMGR").stream()
                            .filter(u -> exc.getBranch().equalsIgnoreCase(u.getBranch()))
                            .map(User::getId).findFirst().orElse(null);
                } else if ("DISTDIR".equalsIgnoreCase(nextRole) && exc.getDistrict() != null) {
                    newUserId = userRepository.findByRoleIgnoreCaseAndActiveTrue("DISTDIR").stream()
                            .filter(u -> exc.getDistrict().equalsIgnoreCase(resolveDistrictForBranch(u.getBranch())))
                            .map(User::getId).findFirst().orElse(null);
                }

                exc.setStatus("Escalated");
                exc.setAssignedToRole(nextRole);
                exc.setAssignedToUserId(newUserId);
                exc.setEscalationLevel(newLevel);
                exc.setLastEscalationDate(today.toString());
                exc.setNextEscalationDue(today.plusDays(15).toString());
                cimsExceptionRepository.save(exc);

                // History entry
                CimsExceptionEscalationHistory hist = new CimsExceptionEscalationHistory(
                        "esc-auto-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                        exc.getId(),
                        "Open",
                        prevRole,
                        prevUserId,
                        nextRole,
                        newUserId,
                        newLevel,
                        "SYSTEM",
                        "Automatic SLA breach escalation (" + daysOverdue + " days overdue)"
                );
                cimsExceptionEscalationHistoryRepository.save(hist);

                // Add investigation note
                CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                        "note-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000),
                        exc.getId(),
                        "SYSTEM",
                        "Automated Escalation Monitor",
                        "Auto-escalated to Level " + newLevel + " [" + nextRole + "] due to SLA overdue by " + daysOverdue + " days."
                );
                cimsExceptionInvestigationNoteRepository.save(note);

                notifyExceptionEscalated(exc, nextRole, newUserId, "Automatic escalation: SLA breached by " + daysOverdue + " days.");
                logAudit("SYSTEM", "SYSADMIN", "AUTO_ESCALATE_EXCEPTION", "Exception", exc.getId(), "Status", "Open", "Escalated", "Escalated to " + nextRole);
                escalatedCount++;
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("evaluated", evaluated);
        res.put("escalated", escalatedCount);
        res.put("timestamp", LocalDateTime.now().toString());
        return res;
    }

    // --- Scoped Exceptions and Management Summary (Requirements §26, §28, §29) ---
    @Transactional(readOnly = true)
    public List<CimsException> getScopedExceptions(String status, String role, String severity, String type, String slaStatus, String search, String userId, String userRole) {
        LocalDate today = LocalDate.now();
        List<CimsException> all = cimsExceptionRepository.findAll();

        // 1. Authorize Portfolio Scope Server-Side (§29, §30)
        User currentUser = findUser(userId);
        String effRole = currentUser != null && currentUser.getRole() != null ? currentUser.getRole() : userRole;
        if (effRole == null) effRole = "SYSADMIN";

        final String userBranch = currentUser != null ? currentUser.getBranch() : null;
        final String userDistrict = userBranch != null ? resolveDistrictForBranch(userBranch) : null;
        final String effRoleUpper = effRole.toUpperCase(Locale.ROOT);
        final String currentUid = currentUser != null ? currentUser.getId() : userId;

        List<CimsException> scoped = all.stream().filter(exc -> {
            // Bank-wide roles
            if (List.of("SYSADMIN", "EXEC", "SRMGMT", "HODEPT", "COMPLIANCE", "RISK", "AUDITOR", "RDONLY").contains(effRoleUpper)) {
                return true;
            }
            // District Director: district portfolio
            if ("DISTDIR".equals(effRoleUpper)) {
                if (userDistrict == null) return true;
                return userDistrict.equalsIgnoreCase(exc.getDistrict());
            }
            // Branch Manager / Document Manager: branch portfolio
            if (List.of("BRMGR", "MGRCOLLDOC").contains(effRoleUpper)) {
                if (userBranch == null) return true;
                return userBranch.equalsIgnoreCase(exc.getBranch());
            }
            // RO / Maker: assigned exceptions, or facility/collateral branch
            if (currentUid != null && (currentUid.equalsIgnoreCase(exc.getAssignedToUserId()) || currentUid.equalsIgnoreCase(exc.getRelationshipManagerId()))) {
                return true;
            }
            if (userBranch != null && userBranch.equalsIgnoreCase(exc.getBranch())) {
                return true;
            }
            return false;
        }).toList();

        // 2. Compute dynamic operational metrics
        scoped.forEach(exc -> exc.computeSlaAndOperationalMetrics(today));

        // 3. Filter criteria
        return scoped.stream().filter(exc -> {
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status) && !status.equalsIgnoreCase(exc.getStatus())) {
                return false;
            }
            if (role != null && !role.isBlank() && !"ALL".equalsIgnoreCase(role) && !role.equalsIgnoreCase(exc.getAssignedToRole())) {
                return false;
            }
            if (severity != null && !severity.isBlank() && !"ALL".equalsIgnoreCase(severity) && !severity.equalsIgnoreCase(exc.getSeverity())) {
                return false;
            }
            if (type != null && !type.isBlank() && !"ALL".equalsIgnoreCase(type) && !type.equalsIgnoreCase(exc.getExceptionType())) {
                return false;
            }
            if (slaStatus != null && !slaStatus.isBlank() && !"ALL".equalsIgnoreCase(slaStatus) && !slaStatus.equalsIgnoreCase(exc.getSlaStatus())) {
                return false;
            }
            if (search != null && !search.isBlank()) {
                String q = search.toLowerCase();
                boolean matches = (exc.getId() != null && exc.getId().toLowerCase().contains(q))
                        || (exc.getDescription() != null && exc.getDescription().toLowerCase().contains(q))
                        || (exc.getExceptionType() != null && exc.getExceptionType().toLowerCase().contains(q))
                        || (exc.getCustomerCif() != null && exc.getCustomerCif().toLowerCase().contains(q))
                        || (exc.getLoanReference() != null && exc.getLoanReference().toLowerCase().contains(q))
                        || (exc.getCollateralId() != null && exc.getCollateralId().toLowerCase().contains(q))
                        || (exc.getPolicyId() != null && exc.getPolicyId().toLowerCase().contains(q))
                        || (exc.getBranch() != null && exc.getBranch().toLowerCase().contains(q))
                        || (exc.getAssignedToRole() != null && exc.getAssignedToRole().toLowerCase().contains(q));
                if (!matches) return false;
            }
            return true;
        }).toList();
    }

    @Transactional(readOnly = true)
    public ExceptionSummaryDto getExceptionSummary(String userId, String userRole) {
        List<CimsException> scoped = getScopedExceptions(null, null, null, null, null, null, userId, userRole);
        LocalDate today = LocalDate.now();

        ExceptionSummaryDto summary = new ExceptionSummaryDto();
        long open = 0, critical = 0, high = 0, dueSoon = 0, overdue = 0, escalated = 0, resolvedToday = 0, unassigned = 0;

        for (CimsException exc : scoped) {
            boolean isResolved = "Resolved".equalsIgnoreCase(exc.getStatus());
            if (isResolved) {
                if (exc.getResolvedAt() != null && exc.getResolvedAt().startsWith(today.toString())) {
                    resolvedToday++;
                }
            } else {
                open++;
                if ("Critical".equalsIgnoreCase(exc.getSeverity())) critical++;
                if ("High".equalsIgnoreCase(exc.getSeverity())) high++;
                if ("Escalated".equalsIgnoreCase(exc.getStatus())) escalated++;
                if ("Overdue".equalsIgnoreCase(exc.getSlaStatus())) overdue++;
                else if ("Due Soon".equalsIgnoreCase(exc.getSlaStatus())) dueSoon++;
                if (exc.getAssignedToUserId() == null || exc.getAssignedToUserId().isBlank()) unassigned++;
            }
        }

        summary.setTotalOpen(open);
        summary.setCritical(critical);
        summary.setHigh(high);
        summary.setDueSoon(dueSoon);
        summary.setOverdue(overdue);
        summary.setEscalated(escalated);
        summary.setResolvedToday(resolvedToday);
        summary.setUnassigned(unassigned);
        return summary;
    }
    /**
     * Returns whether a policy status represents coverage that is still active
     * for monitoring and exposure calculations. Expiring policies remain active
     * until their expiry date; only terminal/non-coverage states are excluded.
     */
    private boolean isCoverageActiveStatus(String status) {
        if (status == null || status.isBlank()) {
            return false;
        }
        String normalized = status.trim();
        return "Active".equalsIgnoreCase(normalized)
                || "Expiring".equalsIgnoreCase(normalized);
    }

    // --- Customer 360 Aggregation ---
    public Customer360Dto getCustomer360(String customerId) {
        Customer customer = customerRepository.findById(customerId)
                .or(() -> customerRepository.findFirstByCifIgnoreCase(customerId))
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + customerId));

        Customer360Dto dto = new Customer360Dto();
        dto.setCustomer(customer);

        List<LoanAccount> facilities = loanAccountRepository.findByCustomerId(customer.getId());
        if (facilities.isEmpty() && customer.getCif() != null) {
            facilities = loanAccountRepository.findByCustomerId(customer.getCif());
        }
        dto.setFacilities(facilities);

        List<Collateral> collateralsList = collateralRepository.findByCustomerId(customer.getId());
        if (collateralsList.isEmpty() && customer.getCif() != null) {
            collateralsList = collateralRepository.findByCustomerId(customer.getCif());
        }
        final List<Collateral> collaterals = collateralsList;
        dto.setCollaterals(collaterals);

        List<LoanCollateralLink> allLinks = new ArrayList<>();
        for (Collateral c : collaterals) {
            allLinks.addAll(loanCollateralLinkRepository.findByCollateralId(c.getId()));
        }
        dto.setCollateralFacilityLinks(allLinks);

        List<InsurancePolicy> policiesList = insurancePolicyRepository.findByCustomerId(customer.getId());
        if (policiesList.isEmpty() && customer.getCif() != null) {
            policiesList = insurancePolicyRepository.findByCustomerId(customer.getCif());
        }
        final List<InsurancePolicy> policies = policiesList;
        dto.setInsurancePolicies(policies);

        List<OwnershipDocument> docs = new ArrayList<>();
        for (Collateral c : collaterals) {
            docs.addAll(ownershipDocumentRepository.findByCollateralId(c.getId()));
        }
        dto.setDocuments(docs);

        List<WorkflowTask> pending = workflowTaskRepository.findAll().stream()
                .filter(t -> "Pending".equalsIgnoreCase(t.getStatus()))
                .filter(t -> collaterals.stream().anyMatch(c -> c.getId().equalsIgnoreCase(t.getEntityId()) || (c.getCode() != null && c.getCode().equalsIgnoreCase(t.getEntityId())))
                        || policies.stream().anyMatch(p -> p.getId().equalsIgnoreCase(t.getEntityId()) || (p.getPolicyNumber() != null && p.getPolicyNumber().equalsIgnoreCase(t.getEntityId()))))
                .toList();
        dto.setPendingApprovals(pending);

        List<CimsException> exceptions = cimsExceptionRepository.findAll().stream()
                .filter(e -> collaterals.stream().anyMatch(c -> c.getId().equalsIgnoreCase(e.getEntityId()) || (c.getCode() != null && c.getCode().equalsIgnoreCase(e.getEntityId()))))
                .toList();
        dto.setExceptions(exceptions);

        List<AuditLog> audits = auditLogRepository.findTop500ByOrderByTimestampDesc().stream()
                .filter(a -> customer.getId().equalsIgnoreCase(a.getEntityId())
                        || (customer.getCif() != null && customer.getCif().equalsIgnoreCase(a.getEntityId()))
                        || collaterals.stream().anyMatch(c -> c.getId().equalsIgnoreCase(a.getEntityId()))
                        || policies.stream().anyMatch(p -> p.getId().equalsIgnoreCase(a.getEntityId())))
                .toList();
        dto.setAuditHistory(audits);

        if (!collaterals.isEmpty()) {
            dto.setExposureSummary(exposureCalculationService.calculateExposureAndAdequacy(collaterals.get(0).getId()));
        }

        return dto;
    }

    public static Long parseFileSize(Object rawFileSize) {
        if (rawFileSize == null) return 102400L;
        if (rawFileSize instanceof Number) return ((Number) rawFileSize).longValue();
        String str = rawFileSize.toString().trim();
        if (str.isBlank()) return 102400L;
        try {
            return Long.parseLong(str);
        } catch (NumberFormatException e) {
            try {
                String lower = str.toLowerCase();
                if (lower.endsWith("mb")) {
                    double mb = Double.parseDouble(lower.replace("mb", "").trim());
                    return (long) (mb * 1024 * 1024);
                } else if (lower.endsWith("kb")) {
                    double kb = Double.parseDouble(lower.replace("kb", "").trim());
                    return (long) (kb * 1024);
                } else if (lower.endsWith("gb")) {
                    double gb = Double.parseDouble(lower.replace("gb", "").trim());
                    return (long) (gb * 1024 * 1024 * 1024);
                } else if (lower.endsWith("b") || lower.endsWith("bytes")) {
                    double b = Double.parseDouble(lower.replaceAll("[a-z]", "").trim());
                    return (long) b;
                } else {
                    double val = Double.parseDouble(str);
                    return (long) val;
                }
            } catch (Exception ex) {
                return 102400L;
            }
        }
    }

    // --- Collateral Registration with Multi-Facility Allocations ---
    @Transactional
    public Map<String, Object> registerCollateralWithAllocations(Collateral collateral, List<Map<String, Object>> allocations, String userId) {
        return registerCollateralWithAllocations(collateral, allocations, null, userId);
    }

    @Transactional
    public Map<String, Object> registerCollateralWithAllocations(Collateral collateral, List<Map<String, Object>> allocations, List<Map<String, Object>> documents, String userId) {
        assertUserPermission(userId, "Collateral", "CREATE");
        if (collateral.getCustomerId() == null || collateral.getCustomerId().isBlank()) {
            throw new IllegalArgumentException("Customer identification is required.");
        }
        Customer customer = customerRepository.findById(collateral.getCustomerId())
                .or(() -> customerRepository.findFirstByCifIgnoreCase(collateral.getCustomerId()))
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + collateral.getCustomerId()));
        collateral.setCustomerId(customer.getId());

        if (collateral.getId() == null || collateral.getId().isBlank()) {
            collateral.setId("col-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (collateral.getCode() == null || collateral.getCode().isBlank()) {
            collateral.setCode("COL-" + (System.currentTimeMillis() % 1000000));
        }
        if (collateral.getType() == null || collateral.getType().isBlank()) {
            collateral.setType(collateral.getCategory() != null ? collateral.getCategory() : "Immovable Properties");
        }
        if (collateral.getCurrency() == null || collateral.getCurrency().isBlank()) {
            collateral.setCurrency("ETB");
        }
        if (collateral.getBranch() == null || collateral.getBranch().isBlank()) {
            collateral.setBranch(customer.getBranch() != null ? customer.getBranch() : "Bole Special Branch");
        }

        // Initialize or preserve owners
        if (collateral.getOwners() == null || collateral.getOwners().isEmpty()) {
            String oType = collateral.getOwnerType() != null ? collateral.getOwnerType().trim() : "Borrower-owned";
            if ("Third-party-owned".equalsIgnoreCase(oType)) {
                throw new IllegalArgumentException("Third-party collateral registration failed: At least one third-party legal owner is required.");
            } else if ("Jointly-owned".equalsIgnoreCase(oType) || "Joint".equalsIgnoreCase(oType)) {
                throw new IllegalArgumentException("Jointly-owned collateral registration failed: At least two legal owners are required.");
            }
            CollateralOwner owner = new CollateralOwner("own-" + UUID.randomUUID().toString().substring(0, 8),
                    customer.getName(), customer.getPhone() != null ? customer.getPhone() : "+251911000000",
                    collateral.getId(), "Borrower", 100.0);
            owner.setOwnershipType("Borrower-owned");
            owner.setOwnerType(customer.getCustomerType() != null ? customer.getCustomerType() : "Corporate");
            owner.setVerificationStatus("Recorded");
            owner.setMakerId(userId);
            collateral.setOwners(new ArrayList<>(List.of(owner)));
        } else {
            for (CollateralOwner owner : collateral.getOwners()) {
                if (owner.getId() == null || owner.getId().isBlank()) {
                    owner.setId("own-" + UUID.randomUUID().toString().substring(0, 8));
                }
                owner.setCollateralId(collateral.getId());
                owner.setVerificationStatus("Recorded");
                owner.setMakerId(userId);
            }
        }

        // Save attached documents in DMS before mandatory document validation
        if (documents != null && !documents.isEmpty()) {
            for (Map<String, Object> docMap : documents) {
                String docName = (String) docMap.getOrDefault("name", docMap.getOrDefault("docName", "Ownership Document"));
                String docType = (String) docMap.getOrDefault("type", docMap.getOrDefault("docType", "Title Deed / Property Ownership Certificate"));
                String fileName = (String) docMap.get("fileName");
                String contentType = (String) docMap.getOrDefault("contentType", docMap.getOrDefault("mimeType", "application/pdf"));
                String fileContent = (String) docMap.getOrDefault("fileContent", docMap.get("fileData"));
                Long fileSize = parseFileSize(docMap.get("fileSize"));
                String expiryDate = (String) docMap.get("expiryDate");
                String remarks = (String) docMap.get("remarks");

                OwnershipDocument doc = new OwnershipDocument();
                doc.setId("doc-" + UUID.randomUUID().toString().substring(0, 8));
                doc.setName(docName != null ? docName : (fileName != null ? fileName : "Document - " + docType));
                doc.setType(docType != null ? docType : "Title Deed / Property Ownership Certificate");
                doc.setFileName(fileName != null ? fileName : doc.getName());
                doc.setFileSize(fileSize != null && fileSize > 0 ? fileSize : 102400L);
                doc.setContentType(contentType != null ? contentType : "application/pdf");
                doc.setFileContent(fileContent);
                doc.setEntityType("Collateral");
                doc.setEntityId(collateral.getId());
                doc.setCollateralId(collateral.getId());
                doc.setVerificationStatus("Pending Verification");
                doc.setStatus("Active");
                doc.setVersion(1);
                doc.setLatest(true);
                doc.setUploadedBy(userId != null ? userId : "CRO_USER");
                doc.setUploadDate(LocalDate.now().toString());
                doc.setUploadedAt(LocalDateTime.now().toString());
                doc.setExpiryDate(expiryDate != null && !expiryDate.isBlank() ? expiryDate : LocalDate.now().plusYears(5).toString());
                doc.setRemarks(remarks != null ? remarks : "Attached during collateral registration");
                doc.setFileUrl("/api/documents/download/" + doc.getId());
                ownershipDocumentRepository.save(doc);
            }
        }

        // Validate basic collateral data & mandatory documents
        validationService.validateCollateralForActivation(collateral);

        double netValue = Math.round(collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0)) * 100.0) / 100.0;
        collateral.setNsv(netValue);
        collateral.setLimitContribution(netValue);

        // Validate joint ownership percentages if multiple owners
        if (collateral.getOwners() != null && !collateral.getOwners().isEmpty()) {
            if ("Jointly-owned".equalsIgnoreCase(collateral.getOwnerType()) || "Joint".equalsIgnoreCase(collateral.getOwnerType())) {
                validationService.validateJointOwnership(collateral.getOwners());
            } else if ("Third-party-owned".equalsIgnoreCase(collateral.getOwnerType())) {
                validationService.validateThirdPartyOwnership(collateral);
            }
            for (CollateralOwner o : collateral.getOwners()) {
                if (o.getId() == null || o.getId().isBlank()) {
                    o.setId("own-" + UUID.randomUUID().toString().substring(0, 8));
                }
                o.setCollateralId(collateral.getId());
                if (o.getStatus() == null) o.setStatus("Active");
                if (o.getEffectiveFrom() == null) o.setEffectiveFrom(LocalDate.now().toString());
            }
        }

        // Process Allocations
        List<LoanAccount> matchedLoans = new ArrayList<>();
        List<Double> allocAmounts = new ArrayList<>();
        Set<String> seenLoanIds = new HashSet<>();

        if (allocations != null) {
            for (Map<String, Object> a : allocations) {
                String facId = (String) a.get("facilityId");
                if (facId == null) facId = (String) a.get("loanAccountId");
                if (facId == null) continue;
                final String fId = facId;
                LoanAccount loan = loanAccountRepository.findById(fId)
                        .or(() -> loanAccountRepository.findByLoanReference(fId))
                        .orElseThrow(() -> new IllegalArgumentException("Facility not found: " + fId));

                // Validate borrower relationship
                validationService.validateBorrowerLoanRelationship(collateral, loan);

                // Prevent duplicate targets within submission
                if (seenLoanIds.contains(loan.getId())) {
                    throw new IllegalArgumentException("Duplicate facility in allocation: " + loan.getLoanReference());
                }
                seenLoanIds.add(loan.getId());
                matchedLoans.add(loan);

                double amt = Double.parseDouble(a.get("allocatedAmount") != null ? a.get("allocatedAmount").toString() : "0");
                allocAmounts.add(amt);
            }
        }

        if (!allocAmounts.isEmpty()) {
            validationService.validateAllocationOverflow(netValue, allocAmounts);
        }

        collateral.setStatus("Pending Approval");
        collateral.setVerificationStatus("Recorded");
        collateral.setRecordStat("U");
        collateral.setAuthStat("U");
        collateral.setMakerId(userId);
        collateral.setMakerDtStamp(LocalDateTime.now().toString());
        collateralRepository.save(collateral);

        // Save links with customerId and relationship status (without deleting history)
        double totalAlloc = 0;
        if (allocations != null) {
            for (int i = 0; i < allocations.size(); i++) {
                Map<String, Object> a = allocations.get(i);
                LoanAccount loan = matchedLoans.get(i);
                double amt = allocAmounts.get(i);
                String lType = (String) a.getOrDefault("linkageType", "Primary");

                LoanCollateralLink link = new LoanCollateralLink("lnk-" + UUID.randomUUID().toString().substring(0, 8), loan.getId(), collateral.getId(), amt);
                link.setFacilityId(loan.getLineCode() != null ? loan.getLineCode() : loan.getId());
                link.setCustomerId(loan.getCustomerId());
                link.setLinkageType(lType);
                link.setLinkedAmount(amt);
                link.setLinkedPercent(netValue > 0 ? (amt / netValue) * 100.0 : 0);
                link.setHaircut(collateral.getHaircut());
                link.setCollateralCategory(collateral.getCategory());
                link.setStatus("Pending Approval");
                link.setRelationshipStatus("Active");
                link.setReleaseStatus("Eligible");
                link.setEffectiveDate(LocalDateTime.now().toString());
                link.setMakerId(userId);
                link.setAuthStat("U");
                link.setRecordStat("U");
                loanCollateralLinkRepository.save(link);
                totalAlloc += amt;
            }
        }
        collateral.setCurrentAllocation(totalAlloc);
        collateral.setUtilizationPercentage(netValue > 0 ? (totalAlloc / netValue) * 100.0 : 0);
        collateralRepository.save(collateral);

        // Submit to Generic Workflow
        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Collateral", collateral.getId(), "COLLATERAL_REGISTRATION", userId,
                "Collateral registration submitted for approval.", null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("collateral", collateral);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Collateral " + collateral.getCode() + " registered and submitted for Maker-Checker approval.");
        return result;
    }

    // --- Allocate Collateral Facilities (Delegated to Authoritative CollateralFacilityRelationshipService) ---
    @Transactional
    public Map<String, Object> allocateCollateralFacilities(String collateralId, List<Map<String, Object>> allocations, String userId) {
        return collateralFacilityRelationshipService.allocateCollateralFacilities(collateralId, allocations, userId);
    }

    // --- Request Collateral Release ---
    @Transactional
    public Map<String, Object> requestCollateralRelease(String collateralId, String reason, String userId) {
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        validationService.validateCollateralRelease(collateral.getId());

        collateral.setStatus("Release Pending");
        collateralRepository.save(collateral);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Collateral", collateral.getId(), "COLLATERAL_RELEASE", userId,
                "Collateral release requested: " + reason, null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Collateral release request submitted for Checker approval.");
        return result;
    }

    // --- Collateral 360 & Relationship Inspection ---
    public Collateral360Dto getCollateral360(String collateralId) {
        Collateral col = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        Collateral360Dto dto = new Collateral360Dto();
        dto.setCollateral(col);

        // Customer
        if (col.getCustomerId() != null) {
            customerRepository.findById(col.getCustomerId())
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(col.getCustomerId()))
                    .ifPresent(dto::setCustomer);
        }

        // Owners (Active vs Historical)
        List<CollateralOwner> active = new ArrayList<>();
        List<CollateralOwner> hist = new ArrayList<>();
        if (col.getOwners() != null) {
            for (CollateralOwner o : col.getOwners()) {
                if ("Historical".equalsIgnoreCase(o.getStatus()) || "Transferred".equalsIgnoreCase(o.getStatus()) || o.getSupersededDate() != null) {
                    hist.add(o);
                } else {
                    active.add(o);
                }
            }
        }
        dto.setActiveOwners(active);
        dto.setHistoricalOwners(hist);

        // Linked Facilities with live CBS details
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(col.getId());
        List<Collateral360Dto.LinkedFacilityDetailDto> facDtos = new ArrayList<>();
        double totalAlloc = 0;
        double securedExp = 0;
        Set<String> distinctCustomers = new HashSet<>();
        if (dto.getCustomer() != null && dto.getCustomer().getCif() != null) {
            distinctCustomers.add(dto.getCustomer().getCif().trim().toUpperCase());
        }

        for (LoanCollateralLink link : links) {
            Collateral360Dto.LinkedFacilityDetailDto fDto = new Collateral360Dto.LinkedFacilityDetailDto();
            fDto.setLinkId(link.getId());
            fDto.setLoanAccountId(link.getLoanAccountId());
            fDto.setLineCode(link.getFacilityId());
            fDto.setAllocatedAmount(link.getAllocatedAmount());
            fDto.setLinkedPercentage(link.getLinkedPercentage());
            fDto.setLinkageType(link.getLinkageType());
            fDto.setRelationshipStatus(link.getRelationshipStatus() != null ? link.getRelationshipStatus() : link.getStatus());
            fDto.setReleaseStatus(link.getReleaseStatus() != null ? link.getReleaseStatus() : "Eligible");
            fDto.setEffectiveDate(link.getEffectiveDate());
            fDto.setEndDate(link.getEndDate());

            Optional<LoanAccount> loanOpt = loanAccountRepository.findById(link.getLoanAccountId())
                    .or(() -> loanAccountRepository.findByLoanReference(link.getLoanAccountId()));
            if (loanOpt.isPresent()) {
                LoanAccount la = loanOpt.get();
                fDto.setLoanReference(la.getLoanReference());
                fDto.setFacilityType(la.getFacilityType());
                fDto.setApprovedLimit(la.getApprovedLimit());
                fDto.setOutstandingBalance(la.getOutstandingBalance());
                fDto.setAvailableAmount(la.getAvailableAmount());
                fDto.setLineCurrency(la.getLineCurrency() != null ? la.getLineCurrency() : "ETB");
                fDto.setLoanStatus(la.getStatus());
                fDto.setBranch(la.getBranch());
                fDto.setBusinessSegment(la.getSegment());
                fDto.setRelationshipManager(la.getRmUserId());

                if (la.getCustomerId() != null) {
                    customerRepository.findById(la.getCustomerId())
                            .or(() -> customerRepository.findFirstByCifIgnoreCase(la.getCustomerId()))
                            .ifPresent(c -> {
                                fDto.setCustomerCif(c.getCif());
                                fDto.setCustomerName(c.getName());
                                if (c.getCif() != null) {
                                    distinctCustomers.add(c.getCif().trim().toUpperCase());
                                }
                            });
                }

                if ("Active".equalsIgnoreCase(link.getStatus())) {
                    totalAlloc += link.getAllocatedAmount();
                    securedExp += Math.min(la.getOutstandingBalance(), link.getAllocatedAmount());
                }
            } else {
                fDto.setLoanReference(link.getLoanAccountId());
                fDto.setLoanStatus("Active");
                if ("Active".equalsIgnoreCase(link.getStatus())) {
                    totalAlloc += link.getAllocatedAmount();
                }
            }
            facDtos.add(fDto);
        }
        dto.setLinkedFacilities(facDtos);

        double netVal = col.getNsv();
        dto.setNetCollateralValue(netVal);
        dto.setTotalAllocatedAmount(totalAlloc);
        dto.setUnallocatedAmount(Math.max(0, netVal - totalAlloc));
        dto.setTotalSecuredExposure(securedExp);
        dto.setUtilizationPercentage(netVal > 0 ? (totalAlloc / netVal) * 100.0 : 0);
        dto.setCrossCollateralized(facDtos.size() > 1 || distinctCustomers.size() > 1);

        // Document checklist
        dto.setDocumentChecklist(getMandatoryDocumentChecklist(col.getId()));

        // Audit History
        List<AuditLog> audits = new ArrayList<>(auditLogRepository.findByEntityIdOrderByTimestampDesc(col.getId()));
        if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
            audits.addAll(auditLogRepository.findByEntityIdOrderByTimestampDesc(col.getCode()));
        }
        dto.setAuditHistory(audits);

        // Policies
        dto.setInsurancePolicies(insurancePolicyRepository.findByCollateralId(col.getId()));

        // Workflow tasks
        dto.setWorkflowTasks(workflowTaskRepository.findByEntityId(col.getId()));

        return dto;
    }

    public List<Collateral360Dto.DocumentChecklistItemDto> getMandatoryDocumentChecklist(String collateralId) {
        Collateral col = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElse(null);
        if (col == null) return List.of();

        List<MandatoryDocumentRule> rules = mandatoryDocumentRuleRepository.findAll();
        List<OwnershipDocument> docs = ownershipDocumentRepository.findByCollateralId(col.getId());
        List<Collateral360Dto.DocumentChecklistItemDto> checklist = new ArrayList<>();

        for (MandatoryDocumentRule rule : rules) {
            if (!validationService.categoryMatches(rule.getCollateralCategory(), col)) continue;
            
            OwnershipDocument matchedDoc = docs.stream().filter(d ->
                validationService.docTypeMatches(rule.getDocumentType(), d.getType()) ||
                validationService.docTypeMatches(rule.getDocumentType(), d.getName())
            ).findFirst().orElse(null);

            boolean attached = matchedDoc != null && (
                (matchedDoc.getFileContent() != null && !matchedDoc.getFileContent().isBlank()) ||
                (matchedDoc.getDmsRef() != null && !matchedDoc.getDmsRef().isBlank())
            );

            String status = attached ? "SATISFIED" : (rule.isMandatory() ? "MISSING" : "OPTIONAL");

            checklist.add(new Collateral360Dto.DocumentChecklistItemDto(
                    rule.getDocumentType(),
                    rule.isMandatory(),
                    attached,
                    matchedDoc != null ? matchedDoc.getId() : null,
                    matchedDoc != null ? matchedDoc.getName() : null,
                    matchedDoc != null ? matchedDoc.getVerificationStatus() : "Not Attached",
                    status
            ));
        }
        return checklist;
    }

    @Transactional
    public Map<String, Object> verifyCollateralOwner(String collateralId, String ownerId, String status, String comments, String officerId) {
        Collateral col = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        CollateralOwner matched = null;
        if (col.getOwners() != null) {
            for (CollateralOwner o : col.getOwners()) {
                if (ownerId.equalsIgnoreCase(o.getId())) {
                    matched = o;
                    break;
                }
            }
        }
        if (matched == null) {
            throw new IllegalArgumentException("Owner with ID " + ownerId + " not found on collateral " + collateralId);
        }

        matched.setVerificationStatus(status != null ? status : "Verified");
        matched.setVerificationDate(LocalDate.now().toString());
        matched.setVerifyingOfficer(officerId);
        if (comments != null && !comments.isBlank()) {
            matched.setRemarks((matched.getRemarks() != null ? matched.getRemarks() + " | " : "") + comments);
        }
        collateralRepository.save(col);

        logAudit(officerId, "CRO", "VERIFY_COLLATERAL_OWNER", "CollateralOwner", ownerId, "VerificationStatus", "Unverified", status, comments);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("ownerId", ownerId);
        res.put("verificationStatus", matched.getVerificationStatus());
        res.put("message", "Owner " + matched.getName() + " verification status updated to " + matched.getVerificationStatus());
        return res;
    }

    public List<CollateralTaxonomy> getCollateralTaxonomy() {
        return collateralTaxonomyRepository.findAll();
    }

    @Transactional
    public Map<String, Object> addCollateralOwner(String collateralId, CollateralOwner newOwner, String userId) {
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        if (newOwner.getId() == null || newOwner.getId().isBlank()) {
            newOwner.setId("own-" + System.currentTimeMillis());
        }
        newOwner.setCollateralId(collateral.getId());
        if (newOwner.getStatus() == null || newOwner.getStatus().isBlank()) {
            newOwner.setStatus("Active");
        }
        if (newOwner.getEffectiveFrom() == null || newOwner.getEffectiveFrom().isBlank()) {
            newOwner.setEffectiveFrom(LocalDate.now().toString());
        }
        newOwner.setMakerId(userId);
        newOwner.setMakerDtStamp(LocalDateTime.now().toString());

        if (collateral.getOwners() == null) {
            collateral.setOwners(new ArrayList<>());
        }
        collateral.getOwners().add(newOwner);

        if ("Jointly-owned".equalsIgnoreCase(collateral.getOwnerType()) || "Joint".equalsIgnoreCase(collateral.getOwnerType())) {
            validationService.validateJointOwnership(collateral.getOwners());
        } else if ("Third-party-owned".equalsIgnoreCase(collateral.getOwnerType())) {
            validationService.validateThirdPartyOwnership(collateral);
        }
        collateralRepository.save(collateral);

        logAudit(userId, "CRO", "ADD_COLLATERAL_OWNER", "CollateralOwner", newOwner.getId(), "Owner", "", newOwner.getName(), "Added new owner to collateral " + collateral.getCode());

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Owner added successfully.");
        res.put("owner", newOwner);
        return res;
    }

    @Transactional
    public Map<String, Object> updateCollateralOwner(String collateralId, String ownerId, CollateralOwner updated, String userId) {
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        CollateralOwner target = null;
        if (collateral.getOwners() != null) {
            for (CollateralOwner o : collateral.getOwners()) {
                if (ownerId.equalsIgnoreCase(o.getId())) {
                    target = o;
                    break;
                }
            }
        }
        if (target == null) {
            throw new IllegalArgumentException("Owner with ID " + ownerId + " not found on collateral " + collateralId);
        }

        if (updated.getName() != null) target.setName(updated.getName());
        if (updated.getOwnershipType() != null) target.setOwnershipType(updated.getOwnershipType());
        if (updated.getOwnerType() != null) target.setOwnerType(updated.getOwnerType());
        if (updated.getIdNumber() != null) target.setIdNumber(updated.getIdNumber());
        if (updated.getBusinessRegNo() != null) target.setBusinessRegNo(updated.getBusinessRegNo());
        if (updated.getTin() != null) target.setTin(updated.getTin());
        if (updated.getContactInfo() != null) target.setContactInfo(updated.getContactInfo());
        if (updated.getPhone() != null) target.setPhone(updated.getPhone());
        if (updated.getRelationship() != null) target.setRelationship(updated.getRelationship());
        if (updated.getRelationshipToBorrower() != null) target.setRelationshipToBorrower(updated.getRelationshipToBorrower());
        if (updated.getOwnershipPercentage() > 0) target.setOwnershipPercentage(updated.getOwnershipPercentage());
        if (updated.getRemarks() != null) target.setRemarks(updated.getRemarks());

        if ("Jointly-owned".equalsIgnoreCase(collateral.getOwnerType()) || "Joint".equalsIgnoreCase(collateral.getOwnerType())) {
            validationService.validateJointOwnership(collateral.getOwners());
        } else if ("Third-party-owned".equalsIgnoreCase(collateral.getOwnerType())) {
            validationService.validateThirdPartyOwnership(collateral);
        }
        collateralRepository.save(collateral);

        logAudit(userId, "CRO", "UPDATE_COLLATERAL_OWNER", "CollateralOwner", ownerId, "OwnerDetails", "", updated.getName(), "Updated owner details on collateral " + collateral.getCode());

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Owner updated successfully.");
        res.put("owner", target);
        return res;
    }

    // --- Insurance Policy Registration & Full Lifecycle ---
    @Transactional
    public Map<String, Object> registerInsurancePolicy(InsurancePolicy policy, String userId) {
        return registerInsurancePolicy(policy, null, userId);
    }

    @Transactional
    public Map<String, Object> registerInsurancePolicy(InsurancePolicy policy, List<Map<String, Object>> documents, String userId) {
        if (policy.getCollateralId() == null || policy.getCollateralId().isBlank()) {
            throw new IllegalArgumentException("A collateral must be linked to register an insurance policy.");
        }
        Collateral collateral = collateralRepository.findById(policy.getCollateralId())
                .or(() -> collateralRepository.findByCode(policy.getCollateralId()))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + policy.getCollateralId()));

        policy.setCollateralId(collateral.getId());
        if (policy.getCustomerId() == null || policy.getCustomerId().isBlank()) {
            policy.setCustomerId(collateral.getCustomerId());
        }

        if (policy.getId() == null || policy.getId().isBlank()) {
            policy.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (policy.getPolicyNumber() == null || policy.getPolicyNumber().isBlank()) {
            throw new IllegalArgumentException("Policy number is mandatory. Auto-generated dummy policy numbers are prohibited.");
        }
        if (policy.getInsurerName() == null || policy.getInsurerName().isBlank()) {
            throw new IllegalArgumentException("Approved insurer selection is mandatory. Default insurer assignment is prohibited.");
        }
        if (policy.getCoverageType() == null || policy.getCoverageType().isBlank()) {
            throw new IllegalArgumentException("Coverage type is mandatory.");
        }
        if (policy.getEffectiveDate() == null || policy.getEffectiveDate().isBlank() ||
            policy.getExpiryDate() == null || policy.getExpiryDate().isBlank()) {
            throw new IllegalArgumentException("Effective date and expiry date are mandatory.");
        }
        if (policy.getInsuredAmount() <= 0) {
            throw new IllegalArgumentException("Insured amount must be greater than zero.");
        }
        if (policy.getPremium() <= 0) {
            throw new IllegalArgumentException("Policy premium must be greater than zero.");
        }

        System.out.println(">>> CimsService.registerInsurancePolicy: policyId=" + policy.getId() + " documents=" + (documents != null ? documents.size() : "null"));
        // Save attached documents in DMS before policy validation
        List<OwnershipDocument> savedDocs = saveAttachedDocuments(documents, "Insurance Policy", policy.getId(), collateral.getId(),
                "Insurance Policy Schedule", userId, policy.getExpiryDate(), "Attached during policy registration");
        System.out.println(">>> CimsService.registerInsurancePolicy: savedDocs count=" + savedDocs.size());

        validationService.validatePolicyForActivation(policy);

        policy.setStatus("Pending Approval");
        policy.setRecordStat("U");
        policy.setAuthStat("U");
        policy.setVersion(1);
        policy.setMakerId(userId);
        policy.setMakerDtStamp(LocalDateTime.now().toString());

        String initialHistory = String.format(Locale.ROOT,
                "[{\"event\":\"REGISTRATION\",\"version\":1,\"status\":\"Pending Approval\",\"insuredAmount\":%.2f,\"premium\":%.2f,\"insurerName\":\"%s\",\"coverageType\":\"%s\",\"effectiveDate\":\"%s\",\"expiryDate\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}]",
                policy.getInsuredAmount(),
                policy.getPremium(),
                safe(policy.getInsurerName()),
                safe(policy.getCoverageType()),
                safe(policy.getEffectiveDate()),
                safe(policy.getExpiryDate()),
                safe(userId),
                LocalDateTime.now().toString()
        );
        policy.setHistoryJson(initialHistory);
        insurancePolicyRepository.save(policy);

        logAudit(userId, "CRO", "POLICY_REGISTRATION", "Insurance Policy", policy.getId(), "Status", "None", "Pending Approval",
                "Policy registration submitted for checker approval: " + policy.getPolicyNumber());

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", policy.getId(), "POLICY_REGISTRATION", userId,
                "Policy registration submitted for approval.", null);

        PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), policy.getId(),
                "REGISTRATION_SUBMITTED", "Draft", "Pending Approval", 1, userId, "MAKER",
                LocalDateTime.now().toString(), "Policy registered and submitted for approval", wfResult.getWorkflowTaskId(), initialHistory);
        policyHistoryRepository.save(ph);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", policy);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Insurance policy " + policy.getPolicyNumber() + " registered and submitted for approval.");
        return result;
    }

    public PolicyPreValidationResultDto preValidatePolicyRegistration(InsurancePolicy policy, List<Map<String, Object>> documents) {
        return validationService.evaluatePolicyPreValidation(policy, documents);
    }

    public PolicyPreValidationResultDto preValidateCollateralRegistration(
            Collateral collateral,
            List<Map<String, Object>> documents,
            List<Map<String, Object>> allocations,
            List<Map<String, Object>> owners) {
        return validationService.evaluateCollateralPreValidation(collateral, documents, allocations, owners);
    }

    @Transactional
    public Map<String, Object> submitEntryTimeException(EntryTimeExceptionRequest request, String userId) {
        if (request == null) throw new IllegalArgumentException("Exception request payload is mandatory.");
        if (request.getReason() == null || request.getReason().trim().isBlank()) {
            throw new IllegalArgumentException("Reason / justification is mandatory when submitting an exception.");
        }
        if (request.getComments() == null || request.getComments().trim().isBlank()) {
            throw new IllegalArgumentException("Exception comments / remarks are mandatory.");
        }
        if (request.getExceptionType() == null || request.getExceptionType().trim().isBlank()) {
            throw new IllegalArgumentException("Exception type is mandatory.");
        }

        InsurancePolicy policy = request.getPolicy();
        Collateral col = null;
        String resolvedEntityType = request.getEntityType() != null && !request.getEntityType().isBlank() ? request.getEntityType() : "Insurance Policy";
        String resolvedEntityId = request.getEntityId();
        String resolvedCustomerId = request.getCustomerId();

        if (policy != null) {
            if (policy.getCollateralId() == null || policy.getCollateralId().isBlank()) {
                throw new IllegalArgumentException("A valid collateral must be linked.");
            }
            col = collateralRepository.findById(policy.getCollateralId())
                    .or(() -> collateralRepository.findByCode(policy.getCollateralId()))
                    .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + policy.getCollateralId()));

            policy.setCollateralId(col.getId());
            if (policy.getCustomerId() == null || policy.getCustomerId().isBlank()) {
                policy.setCustomerId(col.getCustomerId());
            }
            if (policy.getId() == null || policy.getId().isBlank()) {
                policy.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
            }

            // Save attached documents in DMS
            List<OwnershipDocument> savedDocs = saveAttachedDocuments(request.getDocuments(), "Insurance Policy", policy.getId(), col.getId(),
                    "Insurance Policy Schedule", userId, policy.getExpiryDate(), "Attached during exception registration");

            // Save policy in "Pending Exception Approval" state
            policy.setStatus("Pending Exception Approval");
            policy.setRecordStat("U");
            policy.setAuthStat("U");
            policy.setVersion(1);
            policy.setMakerId(userId);
            policy.setMakerDtStamp(LocalDateTime.now().toString());

            String initialHistory = String.format(Locale.ROOT,
                    "[{\"event\":\"EXCEPTION_SUBMITTED\",\"version\":1,\"status\":\"Pending Exception Approval\",\"exceptionType\":\"%s\",\"failedRequirement\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}]",
                    safe(request.getExceptionType()),
                    safe(request.getFailedRequirement()),
                    safe(userId),
                    LocalDateTime.now().toString()
            );
            policy.setHistoryJson(initialHistory);
            insurancePolicyRepository.save(policy);

            resolvedEntityType = "Insurance Policy";
            resolvedEntityId = policy.getId();
            resolvedCustomerId = policy.getCustomerId();
        } else if (request.getCollateral() != null) {
            Collateral colReq = request.getCollateral();
            if (colReq.getCustomerId() == null || colReq.getCustomerId().isBlank()) {
                throw new IllegalArgumentException("Customer identification is required.");
            }
            Customer customer = customerRepository.findById(colReq.getCustomerId())
                    .or(() -> customerRepository.findFirstByCifIgnoreCase(colReq.getCustomerId()))
                    .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + colReq.getCustomerId()));
            colReq.setCustomerId(customer.getId());

            if (colReq.getId() == null || colReq.getId().isBlank()) {
                colReq.setId("col-" + UUID.randomUUID().toString().substring(0, 8));
            }
            if (colReq.getCode() == null || colReq.getCode().isBlank()) {
                colReq.setCode("COL-" + (System.currentTimeMillis() % 1000000));
            }
            if (colReq.getType() == null || colReq.getType().isBlank()) {
                colReq.setType(colReq.getCategory() != null ? colReq.getCategory() : "Immovable Properties");
            }
            if (colReq.getCurrency() == null || colReq.getCurrency().isBlank()) {
                colReq.setCurrency("ETB");
            }
            if (colReq.getBranch() == null || colReq.getBranch().isBlank()) {
                colReq.setBranch(customer.getBranch() != null ? customer.getBranch() : "Bole Special Branch");
            }

            double netValue = Math.round(colReq.getValuationAmount() * (1.0 - (colReq.getHaircut() / 100.0)) * 100.0) / 100.0;
            colReq.setNsv(netValue);
            colReq.setLimitContribution(netValue);

            // Set state to Pending Exception Approval
            colReq.setStatus("Pending Exception Approval");
            colReq.setRecordStat("U");
            colReq.setAuthStat("U");
            colReq.setMakerId(userId);
            colReq.setMakerDtStamp(LocalDateTime.now().toString());

            // Initialize or preserve owners
            if (colReq.getOwners() == null || colReq.getOwners().isEmpty()) {
                String oType = colReq.getOwnerType() != null ? colReq.getOwnerType().trim() : "Borrower-owned";
                if ("Third-party-owned".equalsIgnoreCase(oType)) {
                    throw new IllegalArgumentException("Third-party collateral exception failed: At least one third-party legal owner is required.");
                } else if ("Jointly-owned".equalsIgnoreCase(oType) || "Joint".equalsIgnoreCase(oType)) {
                    throw new IllegalArgumentException("Jointly-owned collateral exception failed: At least two legal owners are required.");
                }
                CollateralOwner owner = new CollateralOwner("own-" + UUID.randomUUID().toString().substring(0, 8),
                        customer.getName(), customer.getPhone() != null ? customer.getPhone() : "+251911000000",
                        colReq.getId(), "Borrower", 100.0);
                owner.setOwnershipType("Borrower-owned");
                owner.setOwnerType(customer.getCustomerType() != null ? customer.getCustomerType() : "Corporate");
                owner.setVerificationStatus("Recorded");
                owner.setMakerId(userId);
                colReq.setOwners(new ArrayList<>(List.of(owner)));
            } else {
                for (CollateralOwner owner : colReq.getOwners()) {
                    if (owner.getId() == null || owner.getId().isBlank()) {
                        owner.setId("own-" + UUID.randomUUID().toString().substring(0, 8));
                    }
                    owner.setCollateralId(colReq.getId());
                    owner.setVerificationStatus("Recorded");
                    owner.setMakerId(userId);
                }
            }

            // Save attached documents in DMS
            if (request.getDocuments() != null && !request.getDocuments().isEmpty()) {
                saveAttachedDocuments(request.getDocuments(), "Collateral", colReq.getId(), colReq.getId(),
                        "Ownership Document", userId, LocalDate.now().plusYears(5).toString(), "Attached during collateral exception registration");
            }

            // Save allocations
            if (request.getAllocations() != null && !request.getAllocations().isEmpty()) {
                for (Map<String, Object> a : request.getAllocations()) {
                    String facId = (String) a.get("facilityId");
                    if (facId == null) facId = (String) a.get("loanAccountId");
                    if (facId == null) continue;
                    final String fId = facId;
                    LoanAccount loan = loanAccountRepository.findById(fId)
                            .or(() -> loanAccountRepository.findByLoanReference(fId)).orElse(null);
                    if (loan != null) {
                        double amt = a.get("allocatedAmount") instanceof Number ? ((Number) a.get("allocatedAmount")).doubleValue() : 0.0;
                        LoanCollateralLink link = new LoanCollateralLink(
                                "link-" + UUID.randomUUID().toString().substring(0, 8),
                                loan.getId(), colReq.getId(), amt);
                        link.setStatus("Pending Approval");
                        link.setLinkageType((String) a.getOrDefault("linkageType", "Direct"));
                        link.setEffectiveDate(LocalDate.now().toString());
                        link.setMakerId(userId);
                        loanCollateralLinkRepository.save(link);
                    }
                }
            }

            collateralRepository.save(colReq);
            col = colReq;
            resolvedEntityType = "Collateral";
            resolvedEntityId = col.getId();
            resolvedCustomerId = col.getCustomerId();
        } else {
            String targetColId = request.getCollateralId();
            if (targetColId != null && !targetColId.isBlank()) {
                col = collateralRepository.findById(targetColId)
                        .or(() -> collateralRepository.findByCode(targetColId))
                        .orElse(null);
            }
            if (col != null) {
                if (resolvedCustomerId == null || resolvedCustomerId.isBlank()) {
                    resolvedCustomerId = col.getCustomerId();
                }
                if (resolvedEntityId == null || resolvedEntityId.isBlank()) {
                    resolvedEntityId = col.getId();
                    resolvedEntityType = "Collateral";
                }
            } else if (resolvedEntityId == null || resolvedEntityId.isBlank()) {
                throw new IllegalArgumentException("Either an underlying policy payload, collateral payload, or a valid entity ID is required to create an exception.");
            }
        }

        // Resolve configured approver role
        String colSegment = col != null ? col.getOwningSegment() : "Corporate Banking";
        String colBranch = col != null ? col.getBranch() : "Addis Ababa Main Branch";
        String approverRole = roleHierarchyService.resolveExceptionApproverRole(
                request.getExceptionType(),
                colSegment,
                colBranch,
                colBranch
        );

        // Create official CimsException record
        String excId = "exc-req-" + UUID.randomUUID().toString().substring(0, 8);
        CimsException exc = new CimsException();
        exc.setId(excId);
        exc.setExceptionType(request.getExceptionType().trim());
        exc.setEntityType(resolvedEntityType);
        exc.setEntityId(resolvedEntityId);
        if (col != null) {
            exc.setCollateralId(col.getId());
        } else if (request.getCollateralId() != null) {
            exc.setCollateralId(request.getCollateralId());
        }
        exc.setCustomerId(resolvedCustomerId);
        exc.setSeverity(request.getSeverity() != null && !request.getSeverity().isBlank() ? request.getSeverity() : "High");
        exc.setDescription("User-initiated exception: " + request.getFailedRequirement() + ". Justification: " + request.getReason().trim());
        exc.setStatus("Pending Exception Approval");
        exc.setAssignedToRole(approverRole);
        exc.setCorrectiveAction("Authorized Exception / Management Override");
        exc.setResolutionNotes(request.getComments().trim());
        if (request.getEvidenceDocument() != null && !request.getEvidenceDocument().isBlank()) {
            exc.setEvidenceDocument(request.getEvidenceDocument().trim());
        }
        exc.setDetectedAt(LocalDateTime.now().toString());
        exc.computeSlaAndOperationalMetrics(LocalDate.now());
        cimsExceptionRepository.save(exc);

        // Record initial investigation note
        CimsExceptionInvestigationNote note = new CimsExceptionInvestigationNote(
                "note-" + UUID.randomUUID().toString().substring(0, 8),
                exc.getId(),
                userId,
                "Maker (" + userId + ")",
                "Exception Request: " + request.getFailedRequirement() + " - " + request.getReason().trim() + " | Remarks: " + request.getComments().trim()
        );
        cimsExceptionInvestigationNoteRepository.save(note);

        // Submit workflow task for Exception Approver
        String payloadJson = null;
        try {
            Map<String, Object> diffMap = new LinkedHashMap<>();
            diffMap.put("exceptionId", exc.getId());
            diffMap.put("exceptionType", exc.getExceptionType());
            diffMap.put("failedRequirement", request.getFailedRequirement());
            diffMap.put("reason", request.getReason());
            diffMap.put("comments", request.getComments());
            diffMap.put("evidenceDocument", request.getEvidenceDocument());
            if (policy != null) {
                diffMap.put("policyId", policy.getId());
                diffMap.put("policyNumber", policy.getPolicyNumber());
                diffMap.put("collateralId", policy.getCollateralId());
                diffMap.put("customerId", policy.getCustomerId());
                diffMap.put("insuredAmount", policy.getInsuredAmount());
                diffMap.put("coverageType", policy.getCoverageType());
                diffMap.put("insurerName", policy.getInsurerName());
            } else {
                diffMap.put("entityType", resolvedEntityType);
                diffMap.put("entityId", resolvedEntityId);
                if (col != null) {
                    diffMap.put("collateralId", col.getId());
                    diffMap.put("customerId", col.getCustomerId());
                }
            }
            diffMap.put("approverRole", approverRole);
            payloadJson = objectMapper.writeValueAsString(diffMap);
        } catch (Exception ignored) {}

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "CimsException", exc.getId(), "APPROVE_EXCEPTION", userId,
                "Exception approval requested for " + request.getFailedRequirement() + " by Maker " + userId, payloadJson);

        // Audit Log
        logAudit(userId, "MAKER", "USER_EXCEPTION_REQUEST_SUBMITTED", "CimsException", exc.getId(),
                "Status", "None", "Pending Exception Approval",
                "User-created exception submitted for " + request.getFailedRequirement() + ": " + request.getReason().trim());

        // Notify Approver
        notifyExceptionAssigned(exc, approverRole, null, "User-initiated exception awaiting management approval");

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("exceptionId", exc.getId());
        if (policy != null) {
            resp.put("policyId", policy.getId());
        }
        resp.put("entityId", resolvedEntityId);
        resp.put("workflowTaskId", wfResult.getWorkflowTaskId());
        resp.put("approverRole", approverRole);
        resp.put("message", "Exception request for '" + request.getFailedRequirement() + "' submitted to " + approverRole + " for approval.");
        return resp;
    }

    public List<OwnershipDocument> saveAttachedDocuments(
            List<Map<String, Object>> documents,
            String entityType,
            String entityId,
            String collateralId,
            String defaultDocType,
            String userId,
            String defaultExpiryDate,
            String defaultRemarks) {
        System.out.println(">>> saveAttachedDocuments CALLED: docs=" + (documents != null ? documents.size() : "null") + " entityType=" + entityType + " entityId=" + entityId);
        if (documents == null || documents.isEmpty()) return Collections.emptyList();
        List<OwnershipDocument> savedList = new ArrayList<>();
        for (Map<String, Object> docMap : documents) {
            String docName = (String) docMap.getOrDefault("name", docMap.getOrDefault("docName", defaultDocType));
            String docType = (String) docMap.getOrDefault("type", docMap.getOrDefault("docType", defaultDocType));
            String fileName = (String) docMap.get("fileName");
            String contentType = (String) docMap.getOrDefault("contentType", docMap.getOrDefault("mimeType", "application/pdf"));
            String fileContent = (String) docMap.getOrDefault("fileContent", docMap.get("fileData"));
            Long fileSize = parseFileSize(docMap.get("fileSize"));
            String expiryDate = (String) docMap.get("expiryDate");
            String remarks = (String) docMap.get("remarks");

            OwnershipDocument doc = new OwnershipDocument();
            doc.setId("doc-" + UUID.randomUUID().toString().substring(0, 8));
            doc.setName(docName != null && !docName.isBlank() ? docName : (fileName != null ? fileName : defaultDocType));
            doc.setType(docType != null && !docType.isBlank() ? docType : defaultDocType);
            doc.setFileName(fileName != null && !fileName.isBlank() ? fileName : doc.getName());
            doc.setFileSize(fileSize != null && fileSize > 0 ? fileSize : 102400L);
            doc.setContentType(contentType != null && !contentType.isBlank() ? contentType : "application/pdf");
            doc.setFileContent(fileContent);
            doc.setEntityType(entityType);
            doc.setCollateralId(collateralId);
            doc.setEntityId(entityId);
            doc.setVerificationStatus("Pending Verification");
            doc.setStatus("Active");
            doc.setVersion(1);
            doc.setLatest(true);
            doc.setUploadedBy(userId != null ? userId : "CRO_USER");
            doc.setUploadDate(LocalDate.now().toString());
            doc.setUploadedAt(LocalDateTime.now().toString());
            doc.setExpiryDate(expiryDate != null && !expiryDate.isBlank() ? expiryDate : defaultExpiryDate);
            doc.setRemarks(remarks != null && !remarks.isBlank() ? remarks : defaultRemarks);
            doc.setFileUrl("/api/documents/download/" + doc.getId());
            OwnershipDocument saved = ownershipDocumentRepository.save(doc);
            System.out.println(">>> saveAttachedDocuments SAVED doc id=" + saved.getId() + " entityId=" + saved.getEntityId() + " type=" + saved.getType());
            savedList.add(saved);
        }
        return savedList;
    }

    private String safe(String s) {
        return s == null ? "" : s.replace("\"", "\\\"");
    }

    public void appendHistory(InsurancePolicy policy, String jsonEntry) {
        String current = policy.getHistoryJson() != null && !policy.getHistoryJson().isBlank()
                ? policy.getHistoryJson().trim()
                : "[]";
        if (current.endsWith("]")) {
            if (current.length() > 2) {
                policy.setHistoryJson(current.substring(0, current.length() - 1) + "," + jsonEntry + "]");
            } else {
                policy.setHistoryJson("[" + jsonEntry + "]");
            }
        } else {
            policy.setHistoryJson("[" + jsonEntry + "]");
        }
    }

    @Transactional
    public Map<String, Object> amendPolicy(String policyId, InsurancePolicy updated, String reason, String userId) {
        return amendPolicy(policyId, updated, null, reason, userId);
    }

    @Transactional
    public Map<String, Object> amendPolicy(String policyId, InsurancePolicy updated, List<Map<String, Object>> documents, String reason, String userId) {
        assertUserPermission(userId, "Insurance", "EDIT");
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Amendment reason is mandatory.");
        }
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        int prevVersion = existing.getVersion();
        int newVersion = prevVersion + 1;

        // Save attached amendment documents in DMS
        saveAttachedDocuments(documents, "Insurance Policy", existing.getId(), existing.getCollateralId(),
                "Policy Amendment Document", userId, updated.getExpiryDate() != null ? updated.getExpiryDate() : existing.getExpiryDate(),
                "Attached during policy amendment: " + reason);

        // Structured snapshot of previous version before applying amendments
        String snapshot = String.format(Locale.ROOT,
                "{\"event\":\"AMENDMENT_PROPOSED\",\"version\":%d,\"insurerName\":\"%s\",\"coverageType\":\"%s\",\"insuredAmount\":%.2f,\"premium\":%.2f,\"effectiveDate\":\"%s\",\"expiryDate\":\"%s\",\"reason\":\"%s\",\"makerId\":\"%s\",\"amendedAt\":\"%s\"}",
                prevVersion,
                safe(existing.getInsurerName()),
                safe(existing.getCoverageType()),
                existing.getInsuredAmount(),
                existing.getPremium(),
                safe(existing.getEffectiveDate()),
                safe(existing.getExpiryDate()),
                safe(reason),
                safe(userId),
                LocalDateTime.now().toString()
        );

        appendHistory(existing, snapshot);

        String oldValState = String.format(Locale.ROOT, "v%d: Insurer=%s, Cover=%s, Insured=%.2f, Premium=%.2f, Exp=%s",
                prevVersion, existing.getInsurerName(), existing.getCoverageType(), existing.getInsuredAmount(), existing.getPremium(), existing.getExpiryDate());

        existing.setInsurerName(updated.getInsurerName() != null ? updated.getInsurerName() : existing.getInsurerName());
        existing.setCoverageType(updated.getCoverageType() != null ? updated.getCoverageType() : existing.getCoverageType());
        existing.setInsuredAmount(updated.getInsuredAmount() > 0 ? updated.getInsuredAmount() : existing.getInsuredAmount());
        existing.setPremium(updated.getPremium() > 0 ? updated.getPremium() : existing.getPremium());
        existing.setEffectiveDate(updated.getEffectiveDate() != null ? updated.getEffectiveDate() : existing.getEffectiveDate());
        existing.setExpiryDate(updated.getExpiryDate() != null ? updated.getExpiryDate() : existing.getExpiryDate());
        existing.setAmendmentReason(reason);
        existing.setVersion(newVersion);
        existing.setStatus("Pending Approval");
        existing.setAuthStat("U");
        existing.setRecordStat("U");
        existing.setMakerId(userId);
        existing.setMakerDtStamp(LocalDateTime.now().toString());

        // Validate updated policy terms
        validationService.validatePolicy(existing);

        insurancePolicyRepository.save(existing);

        String newValState = String.format(Locale.ROOT, "v%d: Insurer=%s, Cover=%s, Insured=%.2f, Premium=%.2f, Exp=%s",
                newVersion, existing.getInsurerName(), existing.getCoverageType(), existing.getInsuredAmount(), existing.getPremium(), existing.getExpiryDate());

        logAudit(userId, "CRO", "POLICY_AMENDMENT", "Insurance Policy", existing.getId(), "PolicyVersion", "v" + prevVersion, "v" + newVersion,
                "Policy amendment requested: " + reason + " | " + oldValState + " -> " + newValState);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_AMENDMENT", userId,
                "Policy amendment requested: " + reason, null);

        PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), existing.getId(),
                "AMENDMENT_PROPOSED", "Active", "Pending Approval", newVersion, userId, "MAKER",
                LocalDateTime.now().toString(), reason, wfResult.getWorkflowTaskId(), snapshot);
        policyHistoryRepository.save(ph);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", existing);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy amendment submitted for approval (Version " + existing.getVersion() + ").");
        return result;
    }

    @Transactional
    public Map<String, Object> endorsePolicy(String policyId, String endorsementNo, String description, String effectiveDate, String documentId, String userId) {
        return endorsePolicy(policyId, endorsementNo, description, effectiveDate, documentId, null, userId);
    }

    @Transactional
    public Map<String, Object> endorsePolicy(String policyId, String endorsementNo, String description, String effectiveDate, String documentId, List<Map<String, Object>> documents, String userId) {
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        if (!"Active".equalsIgnoreCase(existing.getStatus()) && !"Pending Renewal".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Endorsements can only be added to active policies. Current status: " + existing.getStatus());
        }

        // Save attached endorsement documents in DMS if provided
        List<OwnershipDocument> savedDocs = saveAttachedDocuments(documents, "Insurance Policy", existing.getId(),
                existing.getCollateralId(), "Policy Endorsement Certificate", userId, existing.getExpiryDate(),
                "Attached during policy endorsement: " + description);
        String finalDocId = documentId;
        if ((finalDocId == null || finalDocId.isBlank()) && !savedDocs.isEmpty()) {
            finalDocId = savedDocs.get(0).getId();
        }

        PolicyEndorsement endorsement = new PolicyEndorsement();
        endorsement.setId("end-" + UUID.randomUUID().toString().substring(0, 8));
        endorsement.setPolicyId(existing.getId());
        endorsement.setEndorsementNo(endorsementNo != null && !endorsementNo.isBlank() ? endorsementNo : "END-" + System.currentTimeMillis());
        endorsement.setDescription(description != null ? description : "Bank loss payee endorsement");
        endorsement.setEffectiveDate(effectiveDate != null ? effectiveDate : LocalDate.now().toString());
        endorsement.setDocumentId(finalDocId);
        endorsement.setMakerId(userId);
        endorsement.setMakerDtStamp(LocalDateTime.now().toString());
        endorsement.setRecordStat("U");
        policyEndorsementRepository.save(endorsement);

        int prevEndorsementCount = existing.getEndorsementCount();
        existing.setEndorsementCount(prevEndorsementCount + 1);

        String endSnapshot = String.format(Locale.ROOT,
                "{\"event\":\"ENDORSEMENT_PROPOSED\",\"endorsementNo\":\"%s\",\"description\":\"%s\",\"effectiveDate\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}",
                safe(endorsement.getEndorsementNo()),
                safe(endorsement.getDescription()),
                safe(endorsement.getEffectiveDate()),
                safe(userId),
                LocalDateTime.now().toString()
        );
        appendHistory(existing, endSnapshot);
        insurancePolicyRepository.save(existing);

        logAudit(userId, "CRO", "POLICY_ENDORSEMENT", "Insurance Policy", existing.getId(), "EndorsementCount",
                String.valueOf(prevEndorsementCount), String.valueOf(existing.getEndorsementCount()),
                "Policy endorsement created: " + endorsement.getEndorsementNo() + " - " + description);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_ENDORSEMENT", userId,
                "Endorsement proposed: " + endorsement.getEndorsementNo() + " - " + description, null);

        PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), existing.getId(),
                "ENDORSEMENT_PROPOSED", existing.getStatus(), existing.getStatus(), existing.getVersion(), userId, "MAKER",
                LocalDateTime.now().toString(), description, wfResult.getWorkflowTaskId(), endSnapshot);
        policyHistoryRepository.save(ph);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("endorsement", endorsement);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Endorsement " + endorsement.getEndorsementNo() + " submitted for checker authorization.");
        return result;
    }

    @Transactional
    public Map<String, Object> renewPolicy(String policyId, InsurancePolicy renewed, String userId) {
        return renewPolicy(policyId, renewed, null, userId);
    }

    @Transactional
    public Map<String, Object> renewPolicy(String policyId, InsurancePolicy renewed, List<Map<String, Object>> documents, String userId) {
        assertUserPermission(userId, "Insurance", "EDIT");
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        String renewalPolicyNumber = (renewed.getPolicyNumber() != null && !renewed.getPolicyNumber().isBlank())
                ? renewed.getPolicyNumber().trim()
                : (existing.getPolicyNumber() != null ? existing.getPolicyNumber() + "-REN" : "POL-REN-" + UUID.randomUUID().toString().substring(0, 8));

        String renewalExpiryDate = (renewed.getExpiryDate() != null && !renewed.getExpiryDate().isBlank())
                ? renewed.getExpiryDate().trim()
                : (existing.getExpiryDate() != null && !existing.getExpiryDate().isBlank())
                ? LocalDate.parse(existing.getExpiryDate().substring(0, 10)).plusYears(1).toString()
                : LocalDate.now().plusYears(1).toString();

        if (renewed.getInsuredAmount() <= 0) {
            throw new IllegalArgumentException("Renewal insured amount must be greater than zero.");
        }
        double renewalPremium = renewed.getPremium() > 0 ? renewed.getPremium() : (existing.getPremium() > 0 ? existing.getPremium() : 1000.0);

        InsurancePolicy newPolicy = new InsurancePolicy();
        newPolicy.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        newPolicy.setPolicyNumber(renewalPolicyNumber);
        newPolicy.setCollateralId(existing.getCollateralId());
        newPolicy.setCustomerId(existing.getCustomerId());
        newPolicy.setInsurerName(renewed.getInsurerName() != null && !renewed.getInsurerName().isBlank() ? renewed.getInsurerName() : existing.getInsurerName());
        newPolicy.setCoverageType(renewed.getCoverageType() != null && !renewed.getCoverageType().isBlank() ? renewed.getCoverageType() : existing.getCoverageType());
        newPolicy.setInsuredAmount(renewed.getInsuredAmount());
        newPolicy.setPremium(renewalPremium);
        newPolicy.setEffectiveDate(renewed.getEffectiveDate() != null && !renewed.getEffectiveDate().isBlank() ? renewed.getEffectiveDate() : existing.getExpiryDate());
        newPolicy.setExpiryDate(renewalExpiryDate);
        newPolicy.setRenewedFromPolicyId(existing.getId());
        newPolicy.setVersion(1);
        newPolicy.setStatus("Pending Approval");
        newPolicy.setAuthStat("U");
        newPolicy.setRecordStat("U");
        newPolicy.setMakerId(userId);
        newPolicy.setMakerDtStamp(LocalDateTime.now().toString());

        // Save attached renewal schedule documents in DMS before policy validation
        saveAttachedDocuments(documents, "Insurance Policy", newPolicy.getId(), newPolicy.getCollateralId(),
                "Policy Renewal Schedule", userId, newPolicy.getExpiryDate(), "Attached during policy renewal: " + newPolicy.getPolicyNumber());
        saveAttachedDocuments(documents, "Insurance Policy", existing.getId(), existing.getCollateralId(),
                "Policy Renewal Schedule", userId, newPolicy.getExpiryDate(), "Renewal schedule for " + newPolicy.getPolicyNumber());

        // Validate policy terms before renewal submission
        validationService.validatePolicy(newPolicy);

        String renewalHistory = String.format(Locale.ROOT,
                "[{\"event\":\"RENEWAL_SUBMITTED\",\"renewedFromPolicyId\":\"%s\",\"previousPolicyNumber\":\"%s\",\"version\":1,\"insuredAmount\":%.2f,\"premium\":%.2f,\"expiryDate\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}]",
                safe(existing.getId()),
                safe(existing.getPolicyNumber()),
                newPolicy.getInsuredAmount(),
                newPolicy.getPremium(),
                safe(newPolicy.getExpiryDate()),
                safe(userId),
                LocalDateTime.now().toString()
        );
        newPolicy.setHistoryJson(renewalHistory);
        insurancePolicyRepository.save(newPolicy);

        // Record renewal initiation in existing policy history
        String existingNote = String.format(Locale.ROOT,
                "{\"event\":\"RENEWAL_INITIATED\",\"renewalPolicyId\":\"%s\",\"renewalPolicyNumber\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}",
                safe(newPolicy.getId()),
                safe(newPolicy.getPolicyNumber()),
                safe(userId),
                LocalDateTime.now().toString()
        );
        appendHistory(existing, existingNote);
        insurancePolicyRepository.save(existing);

        logAudit(userId, "CRO", "POLICY_RENEWAL", "Insurance Policy", newPolicy.getId(), "Status", "None", "Pending Approval",
                "Renewal policy submitted for approval. Renewed from: " + existing.getPolicyNumber());

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", newPolicy.getId(), "POLICY_RENEWAL", userId,
                "Renewal policy submitted for approval (renewed from " + existing.getPolicyNumber() + ").", null);

        PolicyHistory phNew = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), newPolicy.getId(),
                "RENEWAL_SUBMITTED", "Draft", "Pending Approval", 1, userId, "MAKER",
                LocalDateTime.now().toString(), "Renewed from " + existing.getPolicyNumber(), wfResult.getWorkflowTaskId(), renewalHistory);
        policyHistoryRepository.save(phNew);

        PolicyHistory phOld = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), existing.getId(),
                "RENEWAL_INITIATED", existing.getStatus(), "Pending Renewal", existing.getVersion(), userId, "MAKER",
                LocalDateTime.now().toString(), "Renewal initiated into " + newPolicy.getPolicyNumber(), wfResult.getWorkflowTaskId(), existingNote);
        policyHistoryRepository.save(phOld);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", newPolicy);
        result.put("newPolicyId", newPolicy.getId());
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Renewal policy " + newPolicy.getPolicyNumber() + " submitted for approval.");
        return result;
    }

    @Transactional
    public Map<String, Object> replacePolicy(String policyId, InsurancePolicy replacement, String reason, String userId) {
        return replacePolicy(policyId, replacement, null, reason, userId);
    }

    @Transactional
    public Map<String, Object> replacePolicy(String policyId, InsurancePolicy replacement, List<Map<String, Object>> documents, String reason, String userId) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Replacement reason is mandatory.");
        }
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        if (replacement.getPolicyNumber() == null || replacement.getPolicyNumber().isBlank()) {
            throw new IllegalArgumentException("Replacement policy number is mandatory.");
        }
        if (replacement.getInsurerName() == null || replacement.getInsurerName().isBlank()) {
            throw new IllegalArgumentException("Replacement insurer name is mandatory.");
        }
        if (replacement.getCoverageType() == null || replacement.getCoverageType().isBlank()) {
            throw new IllegalArgumentException("Replacement coverage type is mandatory.");
        }
        if (replacement.getInsuredAmount() <= 0) {
            throw new IllegalArgumentException("Replacement insured amount must be greater than zero.");
        }
        if (replacement.getPremium() <= 0) {
            throw new IllegalArgumentException("Replacement premium must be greater than zero.");
        }
        if (replacement.getEffectiveDate() == null || replacement.getEffectiveDate().isBlank() ||
            replacement.getExpiryDate() == null || replacement.getExpiryDate().isBlank()) {
            throw new IllegalArgumentException("Replacement effective date and expiry date are mandatory.");
        }

        replacement.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        replacement.setCollateralId(existing.getCollateralId());
        replacement.setCustomerId(existing.getCustomerId());
        replacement.setReplacesPolicyId(existing.getId());
        replacement.setVersion(1);
        replacement.setStatus("Pending Approval");
        replacement.setAuthStat("U");
        replacement.setRecordStat("U");
        replacement.setMakerId(userId);
        replacement.setMakerDtStamp(LocalDateTime.now().toString());

        // Save attached replacement schedule documents in DMS before policy validation
        saveAttachedDocuments(documents, "Insurance Policy", replacement.getId(), replacement.getCollateralId(),
                "Policy Replacement Schedule", userId, replacement.getExpiryDate(), "Attached during policy replacement: " + reason);
        saveAttachedDocuments(documents, "Insurance Policy", existing.getId(), existing.getCollateralId(),
                "Policy Replacement Schedule", userId, replacement.getExpiryDate(), "Replacement schedule for " + replacement.getPolicyNumber());

        // Validate using complete business rule validation before replacement submission
        validationService.validatePolicy(replacement);

        String repHistory = String.format(Locale.ROOT,
                "[{\"event\":\"REPLACEMENT_SUBMITTED\",\"replacesPolicyId\":\"%s\",\"previousPolicyNumber\":\"%s\",\"reason\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}]",
                safe(existing.getId()),
                safe(existing.getPolicyNumber()),
                safe(reason),
                safe(userId),
                LocalDateTime.now().toString()
        );
        replacement.setHistoryJson(repHistory);
        insurancePolicyRepository.save(replacement);

        // Record replacement initiation in existing policy history
        String existingNote = String.format(Locale.ROOT,
                "{\"event\":\"REPLACEMENT_INITIATED\",\"replacementPolicyId\":\"%s\",\"replacementPolicyNumber\":\"%s\",\"reason\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}",
                safe(replacement.getId()),
                safe(replacement.getPolicyNumber()),
                safe(reason),
                safe(userId),
                LocalDateTime.now().toString()
        );
        appendHistory(existing, existingNote);
        insurancePolicyRepository.save(existing);

        logAudit(userId, "CRO", "POLICY_REPLACEMENT", "Insurance Policy", replacement.getId(), "Status", "None", "Pending Approval",
                "Replacement policy submitted: " + reason + " | Replaces: " + existing.getPolicyNumber());

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", replacement.getId(), "POLICY_REPLACEMENT", userId,
                "Replacement policy submitted: " + reason, null);

        PolicyHistory phNew = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), replacement.getId(),
                "REPLACEMENT_SUBMITTED", "Draft", "Pending Approval", 1, userId, "MAKER",
                LocalDateTime.now().toString(), reason, wfResult.getWorkflowTaskId(), repHistory);
        policyHistoryRepository.save(phNew);

        PolicyHistory phOld = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), existing.getId(),
                "REPLACEMENT_INITIATED", existing.getStatus(), existing.getStatus(), existing.getVersion(), userId, "MAKER",
                LocalDateTime.now().toString(), reason, wfResult.getWorkflowTaskId(), existingNote);
        policyHistoryRepository.save(phOld);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", replacement);
        result.put("replacementPolicyId", replacement.getId());
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Replacement policy " + replacement.getPolicyNumber() + " submitted for approval.");
        return result;
    }

    @Transactional
    public Map<String, Object> cancelPolicy(String policyId, String reason, String userId) {
        return cancelPolicy(policyId, null, reason, userId);
    }

    @Transactional
    public Map<String, Object> cancelPolicy(String policyId, List<Map<String, Object>> documents, String reason, String userId) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Cancellation reason is mandatory.");
        }
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        if ("Cancelled".equalsIgnoreCase(existing.getStatus()) || "Cancellation Pending".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Policy is already cancelled or pending cancellation.");
        }

        // Save attached cancellation proof documents in DMS if provided
        saveAttachedDocuments(documents, "Insurance Policy", existing.getId(), existing.getCollateralId(),
                "Policy Cancellation Notice", userId, existing.getExpiryDate(), "Attached during policy cancellation: " + reason);

        existing.setCancellationReason(reason);
        existing.setStatus("Cancellation Pending");

        String cancelNote = String.format(Locale.ROOT,
                "{\"event\":\"CANCELLATION_REQUESTED\",\"reason\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}",
                safe(reason),
                safe(userId),
                LocalDateTime.now().toString()
        );
        appendHistory(existing, cancelNote);
        insurancePolicyRepository.save(existing);

        logAudit(userId, "CRO", "POLICY_CANCELLATION", "Insurance Policy", existing.getId(), "Status", "Active", "Cancellation Pending",
                "Policy cancellation requested: " + reason);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_CANCELLATION", userId,
                "Policy cancellation requested: " + reason, null);

        PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), existing.getId(),
                "CANCELLATION_REQUESTED", "Active", "Cancellation Pending", existing.getVersion(), userId, "MAKER",
                LocalDateTime.now().toString(), reason, wfResult.getWorkflowTaskId(), cancelNote);
        policyHistoryRepository.save(ph);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy cancellation request submitted for approval.");
        return result;
    }

    @Transactional
    public Map<String, Object> closePolicy(String policyId, String reason, String userId) {
        return closePolicy(policyId, null, reason, userId);
    }

    @Transactional
    public Map<String, Object> closePolicy(String policyId, List<Map<String, Object>> documents, String reason, String userId) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Closure reason is mandatory.");
        }
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        if ("Closed".equalsIgnoreCase(existing.getStatus()) || "Closure Pending".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Policy is already closed or pending closure.");
        }

        // Save attached closure proof documents in DMS if provided
        saveAttachedDocuments(documents, "Insurance Policy", existing.getId(), existing.getCollateralId(),
                "Policy Closure Proof", userId, existing.getExpiryDate(), "Attached during policy closure: " + reason);

        existing.setClosureReason(reason);
        existing.setStatus("Closure Pending");

        String closeNote = String.format(Locale.ROOT,
                "{\"event\":\"CLOSURE_REQUESTED\",\"reason\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}",
                safe(reason),
                safe(userId),
                LocalDateTime.now().toString()
        );
        appendHistory(existing, closeNote);
        insurancePolicyRepository.save(existing);

        logAudit(userId, "CRO", "POLICY_CLOSURE", "Insurance Policy", existing.getId(), "Status", "Active", "Closure Pending",
                "Policy closure requested: " + reason);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_CLOSURE", userId,
                "Policy closure requested: " + reason, null);

        PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), existing.getId(),
                "CLOSURE_REQUESTED", existing.getStatus(), "Closure Pending", existing.getVersion(), userId, "MAKER",
                LocalDateTime.now().toString(), reason, wfResult.getWorkflowTaskId(), closeNote);
        policyHistoryRepository.save(ph);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy closure request submitted for checker authorization.");
        return result;
    }

    @Transactional
    public Map<String, Object> reopenPolicy(String policyId, String reason, String userId) {
        return reopenPolicy(policyId, null, reason, userId);
    }

    @Transactional
    public Map<String, Object> reopenPolicy(String policyId, List<Map<String, Object>> documents, String reason, String userId) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new IllegalArgumentException("Reopening reason is mandatory.");
        }
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        if (!"Closed".equalsIgnoreCase(existing.getStatus()) && !"Reopen Pending".equalsIgnoreCase(existing.getStatus())) {
            throw new IllegalStateException("Only closed policies can be reopened. Current status: " + existing.getStatus());
        }

        // Revalidate conditions for reopening
        validationService.validatePolicy(existing);

        // Save attached reopening authorization documents in DMS if provided
        saveAttachedDocuments(documents, "Insurance Policy", existing.getId(), existing.getCollateralId(),
                "Policy Reopening Authorization", userId, existing.getExpiryDate(), "Attached during policy reopening: " + reason);

        existing.setReopeningReason(reason);
        existing.setStatus("Reopen Pending");

        String reopenNote = String.format(Locale.ROOT,
                "{\"event\":\"REOPEN_REQUESTED\",\"reason\":\"%s\",\"makerId\":\"%s\",\"timestamp\":\"%s\"}",
                safe(reason),
                safe(userId),
                LocalDateTime.now().toString()
        );
        appendHistory(existing, reopenNote);
        insurancePolicyRepository.save(existing);

        logAudit(userId, "CRO", "POLICY_REOPEN", "Insurance Policy", existing.getId(), "Status", "Closed", "Reopen Pending",
                "Policy reopening requested: " + reason);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_REOPEN", userId,
                "Policy reopening requested: " + reason, null);

        PolicyHistory ph = new PolicyHistory("ph-" + UUID.randomUUID().toString().substring(0, 8), existing.getId(),
                "REOPEN_REQUESTED", "Closed", "Reopen Pending", existing.getVersion(), userId, "MAKER",
                LocalDateTime.now().toString(), reason, wfResult.getWorkflowTaskId(), reopenNote);
        policyHistoryRepository.save(ph);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy reopening request submitted for checker authorization.");
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPolicyHistory(String policyId) {
        InsurancePolicy policy = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        List<Map<String, Object>> timeline = new ArrayList<>();
        if (policy.getHistoryJson() != null && !policy.getHistoryJson().isBlank()) {
            try {
                List<Map<String, Object>> parsed = objectMapper.readValue(
                        policy.getHistoryJson(),
                        new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}
                );
                timeline.addAll(parsed);
            } catch (Exception e) {
                timeline.add(Map.of("event", "RAW_HISTORY", "raw", policy.getHistoryJson()));
            }
        }

        List<PolicyHistory> structuredHistory = policyHistoryRepository.findByPolicyIdOrderByTimestampAsc(policy.getId());
        List<PolicyEndorsement> endorsements = policyEndorsementRepository.findByPolicyId(policy.getId());

        Optional<InsurancePolicy> renewedFrom = policy.getRenewedFromPolicyId() != null
                ? insurancePolicyRepository.findById(policy.getRenewedFromPolicyId()) : Optional.empty();
        Optional<InsurancePolicy> replaces = policy.getReplacesPolicyId() != null
                ? insurancePolicyRepository.findById(policy.getReplacesPolicyId()) : Optional.empty();
        List<InsurancePolicy> renewedInto = insurancePolicyRepository.findAll().stream()
                .filter(p -> policy.getId().equals(p.getRenewedFromPolicyId()))
                .toList();
        List<InsurancePolicy> replacedBy = insurancePolicyRepository.findAll().stream()
                .filter(p -> policy.getId().equals(p.getReplacesPolicyId()))
                .toList();

        List<WorkflowTask> workflowTasks = workflowTaskRepository.findAll().stream()
                .filter(t -> ("Insurance Policy".equalsIgnoreCase(t.getEntityType()) || "Policy".equalsIgnoreCase(t.getEntityType())) &&
                        (policy.getId().equalsIgnoreCase(t.getEntityId()) || (policy.getPolicyNumber() != null && policy.getPolicyNumber().equalsIgnoreCase(t.getEntityId()))))
                .toList();

        List<String> taskIds = workflowTasks.stream().map(WorkflowTask::getId).toList();
        List<ApprovalHistory> approvalHistory = approvalHistoryRepository.findAll().stream()
                .filter(h -> taskIds.contains(h.getWorkflowTaskId()))
                .toList();

        List<AuditLog> auditLogs = auditLogRepository.findAll().stream()
                .filter(a -> "Insurance Policy".equalsIgnoreCase(a.getEntityType()) &&
                        (policy.getId().equalsIgnoreCase(a.getEntityId()) || (policy.getPolicyNumber() != null && policy.getPolicyNumber().equalsIgnoreCase(a.getEntityId()))))
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("policy", policy);
        result.put("historyTimeline", timeline);
        result.put("structuredHistory", structuredHistory);
        result.put("endorsements", endorsements);
        result.put("renewedFrom", renewedFrom.orElse(null));
        result.put("replaces", replaces.orElse(null));
        result.put("renewedInto", renewedInto);
        result.put("replacedBy", replacedBy);
        result.put("workflowTasks", workflowTasks);
        result.put("approvalHistory", approvalHistory);
        result.put("auditLogs", auditLogs);
        return result;
    }
}

