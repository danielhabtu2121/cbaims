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
    private InsurancePolicyRepository insurancePolicyRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    private ExceptionRequestRepository exceptionRequestRepository;

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

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
    private BusinessCalendarService businessCalendarService;

    @Autowired
    private NotificationTemplateService notificationTemplateService;

    @Autowired
    private WorkflowExecutionService workflowExecutionService;

    @Autowired
    private ExposureCalculationService exposureCalculationService;

    @Autowired
    private CbsGateway cbsGateway;

    @Autowired
    private CbsAccCollLinkDtlsRepository cbsAccCollLinkDtlsRepository;

    private String simulatedSystemDate = "2026-08-18";

    public String getSimulatedSystemDate() { return simulatedSystemDate != null ? simulatedSystemDate : "2026-08-18"; }
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

    // --- CBS Simulator & Sync Engine ---
    public Map<String, Object> syncCbsCustomer(String customerId, String userId) {
        Map<String, Object> result = new HashMap<>();
        Optional<CbsCustomer> cbsOpt = cbsCustomerRepository.findById(customerId);
        if (cbsOpt.isEmpty()) {
            Optional<CbsCustomer> cbsCifOpt = cbsCustomerRepository.findByCif(customerId);
            if (cbsCifOpt.isPresent()) cbsOpt = cbsCifOpt;
        }

        if (cbsOpt.isPresent()) {
            CbsCustomer cbs = cbsOpt.get();
            Optional<Customer> existing = customerRepository.findFirstByCifIgnoreCase(cbs.getCif());
            Customer c = existing.orElse(new Customer());
            if (c.getId() == null) c.setId("cust-" + System.currentTimeMillis());
            c.setCif(cbs.getCif());
            c.setCustomerType(cbs.getCustomerType());
            c.setName(cbs.getFullName());
            c.setNationalId(cbs.getNationalId());
            c.setBusinessRegNo(cbs.getBusinessRegNo());
            c.setTaxIdNo(cbs.getTaxIdNo());
            c.setDobOrIncorp(cbs.getDobOrIncorp());
            c.setGender(cbs.getGender());
            c.setPhone(cbs.getPhone());
            c.setEmail(cbs.getEmail());
            c.setAddress(cbs.getAddress());
            c.setSegment(cbs.getBusinessSegment());
            c.setBranch(cbs.getBranch());
            c.setStatus(cbs.getCustomerStatus());
            c.setRiskRating(cbs.getRiskRating());
            c.setSource("CBS_SIM");
            c.setCbsSyncStatus("Synced");
            c.setCbsSyncedAt(LocalDateTime.now().toString());
            c.setRecordStat("O");
            c.setAuthStat("A");
            customerRepository.save(c);

            cbs.setSyncStatus("Synced");
            cbs.setSyncedAt(LocalDateTime.now().toString());
            cbsCustomerRepository.save(cbs);

            CbsSyncLog log = new CbsSyncLog("synclog-" + System.currentTimeMillis(), "Customer", cbs.getCif(), "CBS->CIMS", "Success", null);
            cbsSyncLogRepository.save(log);

            logAudit(userId, "SYSADMIN", "CBS_SYNC_CUSTOMER", "Customer", c.getId(), "All", "CBS_SIM", "Synced", "Synchronized customer CIF " + cbs.getCif());
            result.put("success", true);
            result.put("message", "Customer " + cbs.getCif() + " synced successfully.");
        } else {
            result.put("success", false);
            result.put("message", "CBS Customer not found.");
        }
        return result;
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
        Map<String, Object> result = new HashMap<>();
        Optional<CbsFacility> cbsOpt = cbsFacilityRepository.findById(facilityId);
        if (cbsOpt.isEmpty()) {
            Optional<CbsFacility> lineOpt = cbsFacilityRepository.findByLineCode(facilityId);
            if (lineOpt.isPresent()) cbsOpt = lineOpt;
        }

        if (cbsOpt.isPresent()) {
            CbsFacility cbs = cbsOpt.get();
            Optional<LoanAccount> existing = cbs.getLoanRefNo() != null ? loanAccountRepository.findFirstByLoanReferenceIgnoreCase(cbs.getLoanRefNo()) : Optional.empty();
            if (existing.isEmpty() && cbs.getLineCode() != null) existing = loanAccountRepository.findFirstByLineCodeIgnoreCase(cbs.getLineCode());
            LoanAccount f = existing.orElse(new LoanAccount());
            if (f.getId() == null) f.setId("loan-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
            f.setLineCode(cbs.getLineCode() != null ? cbs.getLineCode() : "FAC-" + System.currentTimeMillis());
            f.setLoanReference(cbs.getLoanRefNo() != null ? cbs.getLoanRefNo() : f.getLineCode());

            // Link customer - auto sync from CBS or create shell to guarantee FK constraint
            String customerCif = cbs.getCustomerCif() != null ? cbs.getCustomerCif().trim() : "CIF-DEFAULT";
            Optional<Customer> custOpt = customerRepository.findFirstByCifIgnoreCase(customerCif);
            
            Customer customer;
            if (custOpt.isPresent()) {
                customer = custOpt.get();
            } else {
                Optional<CbsCustomer> cbsCustOpt = cbsCustomerRepository.findByCif(customerCif);
                if (cbsCustOpt.isPresent()) {
                    syncCbsCustomer(cbsCustOpt.get().getId(), userId);
                    customer = customerRepository.findFirstByCifIgnoreCase(customerCif)
                        .orElseGet(() -> createShellCustomer(customerCif, cbs.getBusinessSegment(), cbs.getBranch(), userId));
                } else {
                    customer = createShellCustomer(customerCif, cbs.getBusinessSegment(), cbs.getBranch(), userId);
                }
            }
            f.setCustomerId(customer.getId());
            f.setFacilityType(cbs.getFacilityType() != null ? cbs.getFacilityType() : "Term Loan");
            f.setLineCurrency(cbs.getLineCurrency() != null ? cbs.getLineCurrency() : configurationService.getDefaultCurrency());
            f.setRevolvingLine(cbs.isRevolvingLine());
            f.setLineStartDate(cbs.getLineStartDate() != null ? cbs.getLineStartDate() : "2026-01-01");
            f.setLineExpiryDate(cbs.getLineExpiryDate() != null ? cbs.getLineExpiryDate() : "2029-01-01");
            f.setApprovedLimit(cbs.getApprovedLimit() > 0 ? cbs.getApprovedLimit() : 10000000.0);
            f.setOutstandingBalance(cbs.getOutstandingAmount() >= 0 ? cbs.getOutstandingAmount() : 5000000.0);
            f.setAvailableAmount(Math.max(0, f.getApprovedLimit() - f.getOutstandingBalance()));
            f.setCollateralContribution(cbs.getCollateralContribution());
            f.setCollateralPct(cbs.getCollateralPct());
            f.setSegment(cbs.getBusinessSegment() != null ? cbs.getBusinessSegment() : "Corporate Banking");
            f.setBranch(cbs.getBranch() != null ? cbs.getBranch() : "Main Branch");
            f.setRmUserId(cbs.getRelationshipManager() != null ? cbs.getRelationshipManager() : "CRO_USER");
            f.setStatus(cbs.getLimitStatus() != null ? cbs.getLimitStatus() : "Active");
            f.setNextReviewDueDate(cbs.getNextReviewDate() != null ? cbs.getNextReviewDate() : "2027-01-01");
            f.setSource("CBS_SIM");
            f.setRecordStat("O");
            f.setAuthStat("A");
            loanAccountRepository.save(f);

            cbs.setSyncStatus("Synced");
            cbs.setSyncedAt(LocalDateTime.now().toString());
            cbsFacilityRepository.save(cbs);

            CbsSyncLog log = new CbsSyncLog("synclog-" + System.currentTimeMillis(), "Facility", f.getLineCode(), "CBS->CIMS", "Success", null);
            cbsSyncLogRepository.save(log);

            logAudit(userId, "SYSADMIN", "CBS_SYNC_FACILITY", "Facility", f.getId(), "All", "CBS_SIM", "Synced", "Synchronized facility Line " + f.getLineCode());
            result.put("success", true);
            result.put("message", "Facility " + f.getLineCode() + " synced successfully.");
        } else {
            result.put("success", false);
            result.put("message", "CBS Facility not found: " + facilityId);
        }
        return result;
    }

    public Map<String, Object> syncCbsCollateral(String collateralId, String userId) {
        Map<String, Object> result = new HashMap<>();
        Optional<CbsCollateral> cbsOpt = cbsCollateralRepository.findById(collateralId);
        if (cbsOpt.isEmpty()) {
            Optional<CbsCollateral> codeOpt = cbsCollateralRepository.findByCollateralCode(collateralId);
            if (codeOpt.isPresent()) cbsOpt = codeOpt;
        }

        if (cbsOpt.isPresent()) {
            CbsCollateral cbs = cbsOpt.get();
            Optional<Collateral> existing = collateralRepository.findFirstByCodeIgnoreCase(cbs.getCollateralCode());
            Collateral col = existing.orElse(new Collateral());
            if (col.getId() == null) col.setId("col-" + System.currentTimeMillis() + "-" + new Random().nextInt(1000));
            col.setCode(cbs.getCollateralCode() != null ? cbs.getCollateralCode() : "COL-" + System.currentTimeMillis());
            col.setDescription(cbs.getDescription() != null ? cbs.getDescription() : "Collateral Asset " + col.getCode());
            col.setCategory(cbs.getCategory() != null ? cbs.getCategory() : "Immovable Properties");
            col.setType(col.getCategory());
            col.setCurrency(cbs.getCurrency() != null ? cbs.getCurrency() : configurationService.getDefaultCurrency());
            col.setValuationAmount(cbs.getCollateralValue() > 0 ? cbs.getCollateralValue() : 10000000.0);
            col.setHaircut(cbs.getHaircut() >= 0 ? cbs.getHaircut() : 20.0);
            col.setLimitContribution(col.getValuationAmount() * (1.0 - (col.getHaircut() / 100.0)));
            col.setStartDate(cbs.getStartDate() != null ? cbs.getStartDate() : "2026-01-01");
            col.setReviewDate(cbs.getReviewDate() != null ? cbs.getReviewDate() : "2027-01-01");
            col.setOwnerType(cbs.getCollateralType() != null ? cbs.getCollateralType() : "Borrower-owned");
            col.setTangible(cbs.isTangible());
            col.setOwningSegment(cbs.getBusinessSegment() != null ? cbs.getBusinessSegment() : "Corporate Banking");
            col.setBranch(cbs.getBranch() != null ? cbs.getBranch() : "Main Branch");
            col.setZipCode(cbs.getZipCode());
            col.setStatus("Active");
            col.setSource("CBS_SIM");
            col.setRecordStat("O");
            col.setAuthStat("A");

            // Customer Link
            String customerCif = cbs.getCustomerCif() != null ? cbs.getCustomerCif().trim() : "CIF-DEFAULT";
            Optional<Customer> custOpt = customerRepository.findFirstByCifIgnoreCase(customerCif);
            Customer customer;
            if (custOpt.isPresent()) {
                customer = custOpt.get();
            } else {
                Optional<CbsCustomer> cbsCustOpt = cbsCustomerRepository.findByCif(customerCif);
                if (cbsCustOpt.isPresent()) {
                    syncCbsCustomer(cbsCustOpt.get().getId(), userId);
                    customer = customerRepository.findFirstByCifIgnoreCase(customerCif)
                        .orElseGet(() -> createShellCustomer(customerCif, col.getOwningSegment(), col.getBranch(), userId));
                } else {
                    customer = createShellCustomer(customerCif, col.getOwningSegment(), col.getBranch(), userId);
                }
            }
            col.setCustomerId(customer.getId());

            // Auto owner from customer if no owners
            if (col.getOwners().isEmpty()) {
                CollateralOwner owner = new CollateralOwner("own-" + System.currentTimeMillis(), customer.getName(), customer.getPhone() != null ? customer.getPhone() : "+251911000000", col.getId(), "Borrower", 100.0);
                owner.setOwnershipType("Borrower-owned");
                owner.setOwnerType(customer.getCustomerType() != null ? customer.getCustomerType() : "Corporate");
                owner.setVerificationStatus("Pending Verification");
                col.getOwners().add(owner);
            }

            collateralRepository.save(col);

            // Synchronize real CBS relationships from CLTB_ACC_COLL_LINK_DTLS
            List<CbsAccCollLinkDtls> linkDtls = cbsAccCollLinkDtlsRepository.findByLinkedReferenceNo(col.getCode());
            if (linkDtls.isEmpty() && col.getId() != null) {
                linkDtls = cbsAccCollLinkDtlsRepository.findByLinkedReferenceNo(col.getId());
            }
            for (CbsAccCollLinkDtls dtls : linkDtls) {
                String accNo = dtls.getAccountNumber();
                Optional<LoanAccount> loanOpt = loanAccountRepository.findFirstByLoanReferenceIgnoreCase(accNo);
                if (loanOpt.isEmpty()) loanOpt = loanAccountRepository.findFirstByLineCodeIgnoreCase(accNo);
                if (loanOpt.isPresent()) {
                    String loanId = loanOpt.get().getId();
                    boolean linkExists = loanCollateralLinkRepository.existsByLoanAccountIdAndCollateralId(loanId, col.getId());
                    if (!linkExists) {
                        double coverAmt = dtls.getLinkedAmount() > 0 ? dtls.getLinkedAmount() : (dtls.getOverallAmount() > 0 ? dtls.getOverallAmount() : col.getValuationAmount());
                        LoanCollateralLink lnk = new LoanCollateralLink("lnk-" + System.currentTimeMillis(), loanId, col.getId(), coverAmt);
                        lnk.setMakerId(userId);
                        lnk.setRecordStat("O");
                        lnk.setAuthStat("A");
                        lnk.setStatus("Active");
                        loanCollateralLinkRepository.save(lnk);
                    }
                }
            }

            cbs.setSyncStatus("Synced");
            cbs.setSyncedAt(LocalDateTime.now().toString());
            cbsCollateralRepository.save(cbs);

            CbsSyncLog log = new CbsSyncLog("synclog-" + System.currentTimeMillis(), "Collateral", col.getCode(), "CBS->CIMS", "Success", null);
            cbsSyncLogRepository.save(log);

            updateCollateralStatus(col.getId());
            logAudit(userId, "SYSADMIN", "CBS_SYNC_COLLATERAL", "Collateral", col.getId(), "All", "CBS_SIM", "Synced", "Synchronized collateral " + col.getCode());
            result.put("success", true);
            result.put("message", "Collateral " + col.getCode() + " synced successfully.");
        } else {
            result.put("success", false);
            result.put("message", "CBS Collateral not found: " + collateralId);
        }
        return result;
    }

    public Map<String, Object> syncAllPendingCbs(String userId) {
        int custCount = 0;
        int facCount = 0;
        int colCount = 0;

        for (CbsCustomer c : cbsCustomerRepository.findAll()) {
            if (!"Synced".equalsIgnoreCase(c.getSyncStatus())) {
                syncCbsCustomer(c.getId(), userId);
                custCount++;
            }
        }
        for (CbsFacility f : cbsFacilityRepository.findAll()) {
            if (!"Synced".equalsIgnoreCase(f.getSyncStatus())) {
                syncCbsFacility(f.getId(), userId);
                facCount++;
            }
        }
        for (CbsCollateral col : cbsCollateralRepository.findAll()) {
            if (!"Synced".equalsIgnoreCase(col.getSyncStatus())) {
                syncCbsCollateral(col.getId(), userId);
                colCount++;
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("syncedCustomers", custCount);
        res.put("syncedFacilities", facCount);
        res.put("syncedCollaterals", colCount);
        res.put("message", "Batch sync completed: " + custCount + " Customers, " + facCount + " Facilities, " + colCount + " Collaterals.");
        return res;
    }

    // --- Outbound Notifications Engine ---
    public void sendNotification(String channel, String templateCode, String recipient, String recipientName, String defaultSubject, String defaultBody, String entityType, String entityId, Map<String, Object> context) {
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

    // --- Link Operations ---
    public void addLink(String loanId, String collateralId, double amount, String userId) {
        LoanCollateralLink link = new LoanCollateralLink("lnk-" + System.currentTimeMillis(), loanId, collateralId, amount);
        link.setFacilityId(loanId);
        link.setAllocatedAmount(amount);
        link.setLinkedAmount(amount);
        link.setMakerId(userId);
        link.setRecordStat("O");
        link.setAuthStat("A");
        loanCollateralLinkRepository.save(link);
        updateCollateralStatus(collateralId);
        exposureCalculationService.calculateExposureAndAdequacy(collateralId);
        logAudit(userId, "CRO", "CREATE_JUNCTION_LINK", "LoanCollateralLink", link.getId(), "Amount", "0", String.valueOf(amount), "Linked loan " + loanId + " to collateral " + collateralId);
    }

    public void removeLink(String linkId, String userId) {
        Optional<LoanCollateralLink> linkOpt = loanCollateralLinkRepository.findById(linkId);
        if (linkOpt.isPresent()) {
            LoanCollateralLink link = linkOpt.get();
            String collateralId = link.getCollateralId();
            loanCollateralLinkRepository.deleteById(linkId);
            updateCollateralStatus(collateralId);
            if (collateralId != null) {
                exposureCalculationService.calculateExposureAndAdequacy(collateralId);
            }
            logAudit(userId, "CRO", "DELETE_JUNCTION_LINK", "LoanCollateralLink", linkId, "Link", linkId, "Deleted", "Removed facility linkage");
        }
    }

    public Map<String, Object> validateCollateralRelease(String collateralId) {
        Map<String, Object> validation = new HashMap<>();
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findAll();
        double pendingExposure = 0;
        List<String> activeLoanNumbers = new ArrayList<>();

        for (LoanCollateralLink link : links) {
            if (link.getCollateralId().equals(collateralId)) {
                Optional<LoanAccount> loanOpt = loanAccountRepository.findById(link.getLoanAccountId());
                if (loanOpt.isPresent() && loanOpt.get().getOutstandingBalance() > 0) {
                    pendingExposure += loanOpt.get().getOutstandingBalance();
                    activeLoanNumbers.add(loanOpt.get().getLoanReference());
                }
            }
        }

        boolean canRelease = (pendingExposure == 0);
        validation.put("canRelease", canRelease);
        validation.put("pendingExposure", pendingExposure);
        validation.put("activeLoans", activeLoanNumbers);
        validation.put("message", canRelease ? "Collateral is clear for release." : "Release blocked: Active outstanding loan obligations remain (" + pendingExposure + " " + configurationService.getDefaultCurrency() + ").");
        return validation;
    }

    // --- Policy Operations ---
    public void addPolicy(InsurancePolicy policy, String userId) {
        if (policy.getId() == null || policy.getId().isBlank()) {
            policy.setId("pol-" + System.currentTimeMillis());
        }
        if (policy.getPolicyNumber() == null || policy.getPolicyNumber().isBlank()) {
            policy.setPolicyNumber("POL-" + (System.currentTimeMillis() % 1000000));
        }
        if (policy.getCoverageType() == null || policy.getCoverageType().isBlank()) {
            policy.setCoverageType("Fire & Allied Perils");
        }
        if (policy.getInsurerName() == null || policy.getInsurerName().isBlank()) {
            policy.setInsurerName("Nyala Insurance S.C.");
        }
        if (policy.getEffectiveDate() == null || policy.getEffectiveDate().isBlank()) {
            policy.setEffectiveDate(LocalDate.now().toString());
        }
        if (policy.getExpiryDate() == null || policy.getExpiryDate().isBlank()) {
            policy.setExpiryDate(LocalDate.now().plusYears(1).toString());
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
            submitToWorkflow("PROC_POLICY_REGISTRATION", "Insurance Policy", policy.getId(), "Register Insurance Policy", "{}", "New policy registration: " + policy.getPolicyNumber() + " (" + policy.getCoverageType() + ")", userId, "BRMGR");
            logAudit(userId, "CRO", "SUBMIT_POLICY_CHECKER", "Insurance Policy", policy.getId(), "Status", "Draft", "Pending Approval", "Submitted policy " + policy.getPolicyNumber() + " for checker authorization");
        } else {
            logAudit(userId, "CRO", "CREATE_POLICY_DRAFT", "Insurance Policy", policy.getId(), "Status", "None", "Draft", "Created policy draft " + policy.getPolicyNumber());
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

        submitToWorkflow("PROC_POLICY_REGISTRATION", "Insurance Policy", policy.getId(), "Register Insurance Policy", "{}", "Submitted policy " + policy.getPolicyNumber() + " for checker authorization", userId, "BRMGR");
        logAudit(userId, "CRO", "SUBMIT_POLICY_CHECKER", "Insurance Policy", policy.getId(), "Status", "Draft", "Pending Approval", "Submitted policy " + policy.getPolicyNumber());
    }

    public void approvePolicy(String policyId, String userId) {
        InsurancePolicy policy = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        WorkflowTask task = workflowTaskRepository.findAll().stream()
                .filter(t -> ("Insurance Policy".equalsIgnoreCase(t.getEntityType()) || "Policy".equalsIgnoreCase(t.getEntityType())) &&
                        (policy.getId().equalsIgnoreCase(t.getEntityId()) || (policy.getPolicyNumber() != null && policy.getPolicyNumber().equalsIgnoreCase(t.getEntityId()))) &&
                        "Pending".equalsIgnoreCase(t.getStatus()))
                .findFirst()
                .orElse(null);

        if (task != null) {
            workflowExecutionService.approveWorkflowTask(task.getId(), userId, "BRMGR", "Approved policy " + policy.getPolicyNumber());
        } else {
            // If no workflow task exists, create task and process approval atomically
            WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                    "Insurance Policy", policy.getId(), "POLICY_REGISTRATION", policy.getMakerId() != null ? policy.getMakerId() : "SYSTEM",
                    "Direct policy approval workflow bridge", null);
            workflowExecutionService.approveWorkflowTask(wfResult.getWorkflowTaskId(), userId, "BRMGR", "Approved policy " + policy.getPolicyNumber());
        }
    }

    public void rejectPolicy(String policyId, String comments, String userId) {
        InsurancePolicy policy = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        WorkflowTask task = workflowTaskRepository.findAll().stream()
                .filter(t -> ("Insurance Policy".equalsIgnoreCase(t.getEntityType()) || "Policy".equalsIgnoreCase(t.getEntityType())) &&
                        (policy.getId().equalsIgnoreCase(t.getEntityId()) || (policy.getPolicyNumber() != null && policy.getPolicyNumber().equalsIgnoreCase(t.getEntityId()))) &&
                        "Pending".equalsIgnoreCase(t.getStatus()))
                .findFirst()
                .orElse(null);

        if (task != null) {
            workflowExecutionService.rejectWorkflowTask(task.getId(), userId, "BRMGR", comments);
        } else {
            WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                    "Insurance Policy", policy.getId(), "POLICY_REGISTRATION", policy.getMakerId() != null ? policy.getMakerId() : "SYSTEM",
                    "Direct policy rejection workflow bridge", null);
            workflowExecutionService.rejectWorkflowTask(wfResult.getWorkflowTaskId(), userId, "BRMGR", comments);
        }
    }

    public void amendPolicy(String policyId, InsurancePolicy updated, String userId) {
        amendPolicy(policyId, updated, "Policy terms amended by maker", userId);
    }

    public void renewPolicy(String policyId, double newAmount, double newPremium, String newExpiryDate, String userId) {
        InsurancePolicy renewed = new InsurancePolicy();
        renewed.setInsuredAmount(newAmount);
        renewed.setPremium(newPremium);
        renewed.setExpiryDate(newExpiryDate);
        renewPolicy(policyId, renewed, userId);
    }

    // --- Document Upload & Management ---
    public OwnershipDocument uploadDocument(String entityType, String entityId, String docName, String docType, String uploadedBy, String expiryDate) {
        return uploadDocument(entityType, entityId, docName, docType, null, 102400L, "application/pdf", null, null, uploadedBy, expiryDate);
    }

    public OwnershipDocument uploadDocument(String entityType, String entityId, String docName, String docType,
                                           String fileName, Long fileSize, String contentType, String fileContent,
                                           String remarks, String uploadedBy, String expiryDate) {
        OwnershipDocument doc = new OwnershipDocument();
        doc.setId("doc-" + System.currentTimeMillis());
        doc.setEntityType(entityType != null ? entityType : "Collateral");
        doc.setEntityId(entityId);
        
        // If entityType is Collateral, try to find by ID or Code
        if ("Collateral".equalsIgnoreCase(entityType)) {
            Optional<Collateral> colOpt = collateralRepository.findById(entityId);
            if (colOpt.isEmpty()) {
                colOpt = collateralRepository.findByCode(entityId);
            }
            if (colOpt.isPresent()) {
                doc.setCollateralId(colOpt.get().getId());
                doc.setEntityId(colOpt.get().getId());
            } else {
                doc.setCollateralId(entityId);
            }
        } else if ("Insurance Policy".equalsIgnoreCase(entityType) || "Policy".equalsIgnoreCase(entityType)) {
            Optional<InsurancePolicy> polOpt = insurancePolicyRepository.findById(entityId);
            if (polOpt.isEmpty()) polOpt = insurancePolicyRepository.findByPolicyNumber(entityId);
            if (polOpt.isPresent()) {
                doc.setEntityId(polOpt.get().getId());
                if (polOpt.get().getCollateralId() != null) {
                    doc.setCollateralId(polOpt.get().getCollateralId());
                }
            } else {
                doc.setCollateralId(null);
            }
        } else {
            doc.setCollateralId(null);
        }

        doc.setName(docName != null ? docName : (fileName != null ? fileName : "Document_" + doc.getId()));
        doc.setType(docType != null ? docType : "Title Deed");
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
        doc.setRemarks(remarks != null ? remarks : "Uploaded via CIMS DMS (Pending Verification)");
        ownershipDocumentRepository.save(doc);

        if (doc.getCollateralId() != null) {
            updateCollateralStatus(doc.getCollateralId());
        }

        logAudit(uploadedBy, "MGRCOLLDOC", "UPLOAD_DOCUMENT", "Document", doc.getId(), "Name", "None", doc.getName(), "Uploaded " + docType + " for " + entityType + " " + entityId + " (Pending Verification)");
        sendNotification("Email", "DMS_DOCUMENT_UPLOADED", "colldoc@cims-bank.et", "Collateral Documentation Dept", "Document Uploaded: " + doc.getType(), "A new " + doc.getType() + " (" + doc.getName() + ") has been uploaded and is pending verification in the DMS repository for " + entityType + " (" + entityId + ").", "Document", doc.getId());
        
        return doc;
    }

    public OwnershipDocument uploadDocumentVersion(String parentDocId, String fileName, Long fileSize, String contentType,
                                                  String fileContent, String versionNotes, String uploadedBy, String newExpiryDate) {
        OwnershipDocument oldDoc = ownershipDocumentRepository.findById(parentDocId)
            .orElseThrow(() -> new IllegalArgumentException("Original document not found in DMS: " + parentDocId));

        int nextVersion = oldDoc.getVersion() + 1;
        String rootParentId = oldDoc.getParentDocumentId() != null ? oldDoc.getParentDocumentId() : oldDoc.getId();

        // Mark existing versions in chain as not latest
        List<OwnershipDocument> allDocs = ownershipDocumentRepository.findAll();
        for (OwnershipDocument d : allDocs) {
            if (d.getId().equals(rootParentId) || rootParentId.equals(d.getParentDocumentId()) || d.getId().equals(parentDocId)) {
                if (d.getVersion() >= nextVersion) {
                    nextVersion = d.getVersion() + 1;
                }
                d.setLatest(false);
                ownershipDocumentRepository.save(d);
            }
        }

        OwnershipDocument newDoc = new OwnershipDocument();
        newDoc.setId("doc-" + System.currentTimeMillis());
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

        logAudit(uploadedBy, "MGRCOLLDOC", "NEW_DOCUMENT_VERSION", "Document", newDoc.getId(), "Version", "v" + oldDoc.getVersion(), "v" + nextVersion, "Uploaded new version v" + nextVersion + " of " + oldDoc.getName());
        return newDoc;
    }

    public OwnershipDocument verifyDocument(String docId, String status, String remarks, String verifiedBy) {
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

    // --- Exception Detection Engine ---
    public void scanAndGenerateExceptions() {
        if (!configurationService.isExceptionScanEnabled()) return;
        LocalDate today = LocalDate.now();
        int gracePeriodDays = configurationService.getPolicyExpiryGracePeriodDays();
        List<InsurancePolicy> policies = insurancePolicyRepository.findAll();

        // Policy expiry state and expired-policy exceptions.
        for (InsurancePolicy p : policies) {
            if (!isCoverageActiveStatus(p.getStatus()) || p.getExpiryDate() == null) {
                resolveExceptionIfOpen("exc-exp-"+p.getId(), "Policy is no longer active/expiring.");
                continue;
            }
            try {
                LocalDate exp = LocalDate.parse(p.getExpiryDate().substring(0,10));
                long daysToExpiry = ChronoUnit.DAYS.between(today, exp);
                if (daysToExpiry < 0) {
                    p.setStatus("Expired");
                    insurancePolicyRepository.save(p);
                    updateCollateralStatus(p.getCollateralId());
                    String excId="exc-exp-"+p.getId();
                    if(cimsExceptionRepository.findById(excId).isEmpty()){
                        long overdue=Math.abs(daysToExpiry);
                        CimsException exc=new CimsException();
                        exc.setId(excId); exc.setExceptionType("Expired Policy"); exc.setEntityType("Insurance Policy"); exc.setEntityId(p.getId());
                        exc.setSeverity(overdue<=gracePeriodDays?"High":"Critical"); exc.setDescription("Policy "+p.getPolicyNumber()+" expired on "+p.getExpiryDate()+" ("+overdue+" days overdue; grace period "+gracePeriodDays+" days).");
                        exc.setStatus("Open"); exc.setAssignedToRole("BRMGR"); cimsExceptionRepository.save(exc);
                    }
                } else if (daysToExpiry <= configurationService.getPolicyExpiringStatusDays() && !"Expiring".equalsIgnoreCase(p.getStatus())) {
                    p.setStatus("Expiring");
                    insurancePolicyRepository.save(p);
                }
            } catch (Exception e) {
                logAudit("SYSTEM","SYSADMIN","POLICY_EXPIRY_SCAN_ERROR","InsurancePolicy",p.getId(),"Error","",e.getMessage(),"Unable to evaluate policy expiry date");
            }
        }

        // Underinsurance is calculated from the same centralized coverage rule used by the UI/business services.
        double threshold=configurationService.getMinimumCoverageAdequacyPct();
        List<Collateral> collaterals=collateralRepository.findAll();
        for(Collateral c:collaterals){
            String excId="exc-under-"+c.getId();
            if(c.getNetInsuranceCoveragePct()<threshold){
                if(cimsExceptionRepository.findById(excId).isEmpty()){
                    CimsException exc=new CimsException(); exc.setId(excId); exc.setExceptionType("Underinsured Collateral"); exc.setEntityType("Collateral"); exc.setEntityId(c.getId()); exc.setSeverity("High");
                    exc.setDescription("Collateral "+c.getCode()+" has net insurance coverage of "+String.format(Locale.ROOT,"%.1f",c.getNetInsuranceCoveragePct())+"%, below configured "+String.format(Locale.ROOT,"%.1f",threshold)+"%.");
                    exc.setStatus("Open"); exc.setAssignedToRole("CRO"); cimsExceptionRepository.save(exc);
                }
            } else { resolveExceptionIfOpen(excId,"Coverage returned to configured adequacy threshold."); }
        }

        // Mandatory ownership documents.
        if(configurationService.areMandatoryDocumentRulesEnabled()){
            List<MandatoryDocumentRule> rules=mandatoryDocumentRuleRepository.findAll();
            List<OwnershipDocument> docs=ownershipDocumentRepository.findAll();
            for(Collateral c:collaterals){
                for(MandatoryDocumentRule rule:rules){
                    if(!rule.isMandatory() || !validationService.categoryMatches(rule.getCollateralCategory(),c)) continue;
                    boolean found=docs.stream().anyMatch(d -> validationService.documentBelongsToCollateral(d, c) && validationService.docTypeMatches(rule.getDocumentType(), d.getType()) && !"Rejected".equalsIgnoreCase(d.getVerificationStatus()) && !"Archived".equalsIgnoreCase(d.getStatus()));
                    String excId="exc-doc-"+c.getId()+"-"+rule.getId();
                    if(!found){
                        if(cimsExceptionRepository.findById(excId).isEmpty()){
                            CimsException exc=new CimsException(); exc.setId(excId); exc.setExceptionType("Missing Mandatory Document"); exc.setEntityType("Collateral"); exc.setEntityId(c.getId()); exc.setSeverity("High");
                            exc.setDescription("Collateral "+c.getCode()+" ("+c.getCategory()+") is missing mandatory document: "+rule.getDocumentType()); exc.setStatus("Open"); exc.setAssignedToRole("MGRCOLLDOC"); cimsExceptionRepository.save(exc);
                        }
                    } else { resolveExceptionIfOpen(excId,"Mandatory document is now present and valid."); }
                }
            }
        }

        // Ownership documents nearing expiry.
        LocalDate warningDate=today.plusDays(configurationService.getDocumentExpiryWarningDays());
        for(OwnershipDocument d:ownershipDocumentRepository.findAll()){
            if(d.getExpiryDate()==null||d.getExpiryDate().isBlank())continue;
            try{
                LocalDate exp=LocalDate.parse(d.getExpiryDate().substring(0,10));
                String excId="exc-doc-exp-"+d.getId();
                if(!exp.isBefore(today)&&!exp.isAfter(warningDate)){
                    if(cimsExceptionRepository.findById(excId).isEmpty()){
                        CimsException exc=new CimsException(); exc.setId(excId); exc.setExceptionType("Document Nearing Expiry"); exc.setEntityType("Document"); exc.setEntityId(d.getId()); exc.setSeverity("Medium");
                        exc.setDescription("Document "+d.getName()+" expires on "+d.getExpiryDate()+" within configured "+configurationService.getDocumentExpiryWarningDays()+" day warning window."); exc.setStatus("Open"); exc.setAssignedToRole("MGRCOLLDOC"); cimsExceptionRepository.save(exc);
                    }
                } else { resolveExceptionIfOpen(excId,"Document is outside the configured warning window."); }
            }catch(Exception ignored){}
        }

        // Duplicate policy monitoring.
        Map<String,List<InsurancePolicy>> byNumber=new HashMap<>();
        for(InsurancePolicy p:policies){ if(p.getPolicyNumber()!=null&&!p.getPolicyNumber().isBlank()) byNumber.computeIfAbsent(p.getPolicyNumber().toLowerCase(),k->new ArrayList<>()).add(p); }
        for(Map.Entry<String,List<InsurancePolicy>> e:byNumber.entrySet()){
            if(e.getValue().size()<2)continue;
            String excId="exc-dup-policy-"+e.getKey().replaceAll("[^a-zA-Z0-9_-]","-");
            if(cimsExceptionRepository.findById(excId).isEmpty()){
                CimsException exc=new CimsException(); exc.setId(excId); exc.setExceptionType("Duplicate Insurance Policy"); exc.setEntityType("Insurance Policy"); exc.setEntityId(e.getValue().get(0).getId()); exc.setSeverity("High");
                exc.setDescription("Policy number "+e.getKey()+" is registered on "+e.getValue().size()+" policy records."); exc.setStatus("Open"); exc.setAssignedToRole("COMPLIANCE"); cimsExceptionRepository.save(exc);
            }
        }

        // Insurer concentration.
        double total=policies.stream().filter(p -> isCoverageActiveStatus(p.getStatus())).mapToDouble(InsurancePolicy::getInsuredAmount).sum();
        if(total>0){
            double cap=configurationService.getMaxInsurerConcentrationPct();
            Map<String,Double> totals=new HashMap<>();
            for(InsurancePolicy p:policies) if(isCoverageActiveStatus(p.getStatus())&&p.getInsurerName()!=null) totals.merge(p.getInsurerName(),p.getInsuredAmount(),Double::sum);
            for(Map.Entry<String,Double> e:totals.entrySet()){
                double share=e.getValue()/total*100.0;
                String excId="exc-ins-cap-"+e.getKey().replaceAll("\\s+","-");
                if(share>cap){
                    if(cimsExceptionRepository.findById(excId).isEmpty()){
                        CimsException exc=new CimsException(); exc.setId(excId); exc.setExceptionType("Insurer Concentration Breach"); exc.setEntityType("Insurer"); exc.setEntityId(e.getKey()); exc.setSeverity("Medium");
                        exc.setDescription("Insurer "+e.getKey()+" holds "+String.format(Locale.ROOT,"%.1f",share)+"% of active insured exposure, exceeding configured "+String.format(Locale.ROOT,"%.1f",cap)+"%."); exc.setStatus("Open"); exc.setAssignedToRole("RISK"); cimsExceptionRepository.save(exc);
                    }
                } else { resolveExceptionIfOpen(excId,"Insurer concentration returned within configured limit."); }
            }
        }
    }

    private void resolveExceptionIfOpen(String id,String reason){
        cimsExceptionRepository.findById(id).ifPresent(exc -> {
            if(!"Resolved".equalsIgnoreCase(exc.getStatus())){
                exc.setStatus("Resolved"); exc.setResolvedAt(LocalDateTime.now().toString()); exc.setResolvedBy("SYSTEM"); exc.setResolutionNotes(reason); cimsExceptionRepository.save(exc);
            }
        });
    }

    private boolean categoryMatchesRule(String ruleCategory, Collateral collateral){
        if(ruleCategory==null||ruleCategory.isBlank()||"All".equalsIgnoreCase(ruleCategory)) return true;
        return validationService.categoryMatches(ruleCategory, collateral);
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

    public void resolveException(String exceptionId, String correctiveAction, String resolutionNotes, String userId) {
        Optional<CimsException> excOpt = cimsExceptionRepository.findById(exceptionId);
        if (excOpt.isPresent()) {
            CimsException exc = excOpt.get();
            exc.setStatus("Resolved");
            exc.setCorrectiveAction(correctiveAction);
            exc.setResolutionNotes(resolutionNotes);
            exc.setResolvedAt(LocalDateTime.now().toString());
            exc.setResolvedBy(userId);
            cimsExceptionRepository.save(exc);
            logAudit(userId, "COMPLIANCE", "RESOLVE_EXCEPTION", "Exception", exceptionId, "Status", "Open", "Resolved", resolutionNotes);
        }
    }

    public void escalateException(String exceptionId, String escalationRole, String userId) {
        Optional<CimsException> excOpt = cimsExceptionRepository.findById(exceptionId);
        if (excOpt.isPresent()) {
            CimsException exc = excOpt.get();
            exc.setStatus("Escalated");
            exc.setAssignedToRole(escalationRole != null ? escalationRole : "DISTDIR");
            cimsExceptionRepository.save(exc);
            logAudit(userId, "COMPLIANCE", "ESCALATE_EXCEPTION", "Exception", exceptionId, "Status", "Open", "Escalated", "Escalated to " + exc.getAssignedToRole());
        }
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
            CollateralOwner owner = new CollateralOwner("own-" + UUID.randomUUID().toString().substring(0, 8),
                    customer.getName(), customer.getPhone() != null ? customer.getPhone() : "+251911000000",
                    collateral.getId(), "Borrower", 100.0);
            owner.setOwnershipType(collateral.getOwnerType() != null ? collateral.getOwnerType() : "Borrower-owned");
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

        double netValue = collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0));
        collateral.setLimitContribution(netValue);

        // Process Allocations
        List<String> facilityIds = new ArrayList<>();
        List<Double> allocAmounts = new ArrayList<>();
        if (allocations != null) {
            for (Map<String, Object> a : allocations) {
                String facId = (String) a.get("facilityId");
                if (facId == null) facId = (String) a.get("loanAccountId");
                double amt = Double.parseDouble(a.get("allocatedAmount") != null ? a.get("allocatedAmount").toString() : "0");
                facilityIds.add(facId);
                allocAmounts.add(amt);
            }
        }

        // Backend Validations: Customer Isolation & Allocation Overflow
        validationService.validateCustomerIsolation(customer.getId(), facilityIds, collateral.getId());
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

        // Delete existing links if any and insert new
        loanCollateralLinkRepository.deleteByCollateralId(collateral.getId());
        double totalAlloc = 0;
        if (allocations != null) {
            for (Map<String, Object> a : allocations) {
                String facId = (String) a.get("facilityId");
                if (facId == null) facId = (String) a.get("loanAccountId");
                double amt = Double.parseDouble(a.get("allocatedAmount") != null ? a.get("allocatedAmount").toString() : "0");
                String lType = (String) a.getOrDefault("linkageType", "Primary");

                LoanCollateralLink link = new LoanCollateralLink("lnk-" + UUID.randomUUID().toString().substring(0, 8), facId, collateral.getId(), amt);
                link.setFacilityId(facId);
                link.setLinkageType(lType);
                link.setLinkedAmount(amt);
                link.setHaircut(collateral.getHaircut());
                link.setCollateralCategory(collateral.getCategory());
                link.setStatus("Pending Approval");
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

    // --- Allocate Collateral Facilities ---
    @Transactional
    public Map<String, Object> allocateCollateralFacilities(String collateralId, List<Map<String, Object>> allocations, String userId) {
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral not found: " + collateralId));

        double netValue = collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0));
        List<String> facilityIds = new ArrayList<>();
        List<Double> allocAmounts = new ArrayList<>();
        if (allocations != null) {
            for (Map<String, Object> a : allocations) {
                String facId = (String) a.get("facilityId");
                if (facId == null) facId = (String) a.get("loanAccountId");
                double amt = Double.parseDouble(a.get("allocatedAmount") != null ? a.get("allocatedAmount").toString() : "0");
                facilityIds.add(facId);
                allocAmounts.add(amt);
            }
        }

        validationService.validateCustomerIsolation(collateral.getCustomerId(), facilityIds, collateral.getId());
        if (!allocAmounts.isEmpty()) {
            validationService.validateAllocationOverflow(netValue, allocAmounts);
        }

        loanCollateralLinkRepository.deleteByCollateralId(collateral.getId());
        double totalAlloc = 0;
        if (allocations != null) {
            for (Map<String, Object> a : allocations) {
                String facId = (String) a.get("facilityId");
                if (facId == null) facId = (String) a.get("loanAccountId");
                double amt = Double.parseDouble(a.get("allocatedAmount") != null ? a.get("allocatedAmount").toString() : "0");
                String lType = (String) a.getOrDefault("linkageType", "Primary");

                LoanCollateralLink link = new LoanCollateralLink("lnk-" + UUID.randomUUID().toString().substring(0, 8), facId, collateral.getId(), amt);
                link.setFacilityId(facId);
                link.setLinkageType(lType);
                link.setLinkedAmount(amt);
                link.setHaircut(collateral.getHaircut());
                link.setStatus("Active");
                link.setMakerId(userId);
                loanCollateralLinkRepository.save(link);
                totalAlloc += amt;
            }
        }
        collateral.setCurrentAllocation(totalAlloc);
        collateral.setUtilizationPercentage(netValue > 0 ? (totalAlloc / netValue) * 100.0 : 0);
        collateralRepository.save(collateral);

        logAudit(userId, "MAKER", "ALLOCATE_FACILITIES", "Collateral", collateral.getId(), "Allocations", "", "Allocated", "Updated facility allocations.");

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("collateral", collateral);
        result.put("message", "Allocations updated successfully.");
        return result;
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
            policy.setPolicyNumber("POL-" + (System.currentTimeMillis() % 1000000));
        }

        // Save attached documents in DMS before policy validation
        if (documents != null && !documents.isEmpty()) {
            for (Map<String, Object> docMap : documents) {
                String docName = (String) docMap.getOrDefault("name", docMap.getOrDefault("docName", "Policy Schedule"));
                String docType = (String) docMap.getOrDefault("type", docMap.getOrDefault("docType", "Insurance Policy Schedule"));
                String fileName = (String) docMap.get("fileName");
                String contentType = (String) docMap.getOrDefault("contentType", docMap.getOrDefault("mimeType", "application/pdf"));
                String fileContent = (String) docMap.getOrDefault("fileContent", docMap.get("fileData"));
                Long fileSize = parseFileSize(docMap.get("fileSize"));
                String expiryDate = (String) docMap.get("expiryDate");
                String remarks = (String) docMap.get("remarks");

                OwnershipDocument doc = new OwnershipDocument();
                doc.setId("doc-" + UUID.randomUUID().toString().substring(0, 8));
                doc.setName(docName != null ? docName : (fileName != null ? fileName : "Policy Schedule - " + policy.getPolicyNumber()));
                doc.setType(docType != null ? docType : "Insurance Policy Schedule");
                doc.setFileName(fileName != null ? fileName : doc.getName());
                doc.setFileSize(fileSize != null && fileSize > 0 ? fileSize : 102400L);
                doc.setContentType(contentType != null ? contentType : "application/pdf");
                doc.setFileContent(fileContent);
                doc.setEntityType("Insurance Policy");
                doc.setEntityId(policy.getId());
                doc.setCollateralId(collateral.getId());
                doc.setVerificationStatus("Pending Verification");
                doc.setStatus("Active");
                doc.setVersion(1);
                doc.setLatest(true);
                doc.setUploadedBy(userId != null ? userId : "CRO_USER");
                doc.setUploadDate(LocalDate.now().toString());
                doc.setUploadedAt(LocalDateTime.now().toString());
                doc.setExpiryDate(expiryDate != null && !expiryDate.isBlank() ? expiryDate : policy.getExpiryDate());
                doc.setRemarks(remarks != null ? remarks : "Attached during policy registration");
                doc.setFileUrl("/api/documents/download/" + doc.getId());
                ownershipDocumentRepository.save(doc);
            }
        }

        validationService.validatePolicyForActivation(policy);

        policy.setStatus("Pending Approval");
        policy.setRecordStat("U");
        policy.setAuthStat("U");
        policy.setVersion(1);
        policy.setMakerId(userId);
        policy.setMakerDtStamp(LocalDateTime.now().toString());
        insurancePolicyRepository.save(policy);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", policy.getId(), "POLICY_REGISTRATION", userId,
                "Policy registration submitted for approval.", null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", policy);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Insurance policy " + policy.getPolicyNumber() + " registered and submitted for approval.");
        return result;
    }

    @Transactional
    public Map<String, Object> amendPolicy(String policyId, InsurancePolicy updated, String reason, String userId) {
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        existing.setInsurerName(updated.getInsurerName() != null ? updated.getInsurerName() : existing.getInsurerName());
        existing.setCoverageType(updated.getCoverageType() != null ? updated.getCoverageType() : existing.getCoverageType());
        existing.setInsuredAmount(updated.getInsuredAmount() > 0 ? updated.getInsuredAmount() : existing.getInsuredAmount());
        existing.setPremium(updated.getPremium() > 0 ? updated.getPremium() : existing.getPremium());
        existing.setEffectiveDate(updated.getEffectiveDate() != null ? updated.getEffectiveDate() : existing.getEffectiveDate());
        existing.setExpiryDate(updated.getExpiryDate() != null ? updated.getExpiryDate() : existing.getExpiryDate());
        existing.setVersion(existing.getVersion() + 1);
        existing.setStatus("Pending Approval");
        existing.setAuthStat("U");
        existing.setRecordStat("U");
        existing.setMakerId(userId);
        existing.setMakerDtStamp(LocalDateTime.now().toString());
        insurancePolicyRepository.save(existing);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_AMENDMENT", userId,
                "Policy amendment requested: " + reason, null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", existing);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy amendment submitted for approval (Version " + existing.getVersion() + ").");
        return result;
    }

    @Transactional
    public Map<String, Object> endorsePolicy(String policyId, String endorsementNo, String description, String effectiveDate, String documentId, String userId) {
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        PolicyEndorsement endorsement = new PolicyEndorsement();
        endorsement.setId("end-" + UUID.randomUUID().toString().substring(0, 8));
        endorsement.setPolicyId(existing.getId());
        endorsement.setEndorsementNo(endorsementNo != null && !endorsementNo.isBlank() ? endorsementNo : "END-" + System.currentTimeMillis());
        endorsement.setDescription(description != null ? description : "Bank loss payee endorsement");
        endorsement.setEffectiveDate(effectiveDate != null ? effectiveDate : LocalDate.now().toString());
        endorsement.setDocumentId(documentId);
        endorsement.setMakerId(userId);
        endorsement.setMakerDtStamp(LocalDateTime.now().toString());
        endorsement.setRecordStat("U");
        policyEndorsementRepository.save(endorsement);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_ENDORSEMENT", userId,
                "Endorsement proposed: " + endorsement.getEndorsementNo() + " - " + description, null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("endorsement", endorsement);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Endorsement " + endorsement.getEndorsementNo() + " submitted for checker authorization.");
        return result;
    }

    @Transactional
    public Map<String, Object> renewPolicy(String policyId, InsurancePolicy renewed, String userId) {
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        InsurancePolicy newPolicy = new InsurancePolicy();
        newPolicy.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        newPolicy.setPolicyNumber(renewed.getPolicyNumber() != null ? renewed.getPolicyNumber() : existing.getPolicyNumber() + "-RNW");
        newPolicy.setCollateralId(existing.getCollateralId());
        newPolicy.setCustomerId(existing.getCustomerId());
        newPolicy.setInsurerName(renewed.getInsurerName() != null ? renewed.getInsurerName() : existing.getInsurerName());
        newPolicy.setCoverageType(renewed.getCoverageType() != null ? renewed.getCoverageType() : existing.getCoverageType());
        newPolicy.setInsuredAmount(renewed.getInsuredAmount() > 0 ? renewed.getInsuredAmount() : existing.getInsuredAmount());
        newPolicy.setPremium(renewed.getPremium() > 0 ? renewed.getPremium() : existing.getPremium());
        newPolicy.setEffectiveDate(renewed.getEffectiveDate() != null ? renewed.getEffectiveDate() : existing.getExpiryDate());
        newPolicy.setExpiryDate(renewed.getExpiryDate() != null ? renewed.getExpiryDate() : LocalDate.parse(existing.getExpiryDate()).plusYears(1).toString());
        newPolicy.setRenewedFromPolicyId(existing.getId());
        newPolicy.setVersion(1);
        newPolicy.setStatus("Pending Approval");
        newPolicy.setAuthStat("U");
        newPolicy.setRecordStat("U");
        newPolicy.setMakerId(userId);
        newPolicy.setMakerDtStamp(LocalDateTime.now().toString());
        insurancePolicyRepository.save(newPolicy);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", newPolicy.getId(), "POLICY_RENEWAL", userId,
                "Renewal policy submitted for approval.", null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", newPolicy);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Renewal policy " + newPolicy.getPolicyNumber() + " submitted for approval.");
        return result;
    }

    @Transactional
    public Map<String, Object> replacePolicy(String policyId, InsurancePolicy replacement, String reason, String userId) {
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        replacement.setId("pol-" + UUID.randomUUID().toString().substring(0, 8));
        if (replacement.getPolicyNumber() == null || replacement.getPolicyNumber().isBlank()) {
            replacement.setPolicyNumber("POL-REP-" + System.currentTimeMillis());
        }
        replacement.setCollateralId(existing.getCollateralId());
        replacement.setCustomerId(existing.getCustomerId());
        replacement.setReplacesPolicyId(existing.getId());
        replacement.setVersion(1);
        replacement.setStatus("Pending Approval");
        replacement.setAuthStat("U");
        replacement.setRecordStat("U");
        replacement.setMakerId(userId);
        replacement.setMakerDtStamp(LocalDateTime.now().toString());
        insurancePolicyRepository.save(replacement);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", replacement.getId(), "POLICY_REPLACEMENT", userId,
                "Replacement policy submitted: " + reason, null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("policy", replacement);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Replacement policy " + replacement.getPolicyNumber() + " submitted for approval.");
        return result;
    }

    @Transactional
    public Map<String, Object> cancelPolicy(String policyId, String reason, String userId) {
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        existing.setCancellationReason(reason);
        existing.setStatus("Cancellation Pending");
        insurancePolicyRepository.save(existing);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_CANCELLATION", userId,
                "Policy cancellation requested: " + reason, null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy cancellation request submitted for approval.");
        return result;
    }

    @Transactional
    public Map<String, Object> closePolicy(String policyId, String reason, String userId) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Closure reason is mandatory.");
        }
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        existing.setClosureReason(reason);
        existing.setStatus("Closure Pending");
        insurancePolicyRepository.save(existing);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_CLOSURE", userId,
                "Policy closure requested: " + reason, null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy closure request submitted for checker authorization.");
        return result;
    }

    @Transactional
    public Map<String, Object> reopenPolicy(String policyId, String reason, String userId) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Reopening reason is mandatory.");
        }
        InsurancePolicy existing = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Policy not found: " + policyId));

        existing.setStatus("Reopen Pending");
        insurancePolicyRepository.save(existing);

        WorkflowActionResultDto wfResult = workflowExecutionService.submitToWorkflow(
                "Insurance Policy", existing.getId(), "POLICY_REOPEN", userId,
                "Policy reopening requested: " + reason, null);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("workflowTaskId", wfResult.getWorkflowTaskId());
        result.put("message", "Policy reopening request submitted for checker authorization.");
        return result;
    }
}

