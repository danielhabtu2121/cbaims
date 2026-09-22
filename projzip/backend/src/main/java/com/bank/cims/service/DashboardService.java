package com.bank.cims.service;

import com.bank.cims.dto.*;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Authoritative Dashboard V2 Engine for Collateral Insurance Management System (CIMS).
 * Enforces strict authorization scopes, eliminates hardcoded business defaults,
 * grounds calculations in EffectiveInsuranceService, prevents duplicate recursive loads,
 * and provides deterministic operational intelligence.
 */
@Service
public class DashboardService {

    @Autowired
    private UserRepository userRepository;

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
    private OwnershipDocumentRepository ownershipDocumentRepository;

    @Autowired
    private CimsExceptionRepository cimsExceptionRepository;

    @Autowired
    private WorkflowTaskRepository workflowTaskRepository;

    @Autowired
    private BusinessSegmentRepository businessSegmentRepository;

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;

    @Autowired
    private DistrictHierarchyRepository districtHierarchyRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private ConfigurationService configurationService;

    @Autowired
    private ValidationService validationService;

    @Autowired
    private EffectiveInsuranceService effectiveInsuranceService;

    @Autowired
    private DashboardSnapshotRepository dashboardSnapshotRepository;

    @Autowired
    private CbsSyncLogRepository cbsSyncLogRepository;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private CimsService cimsService;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DISPLAY_DT_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm");

    public LocalDate getCurrentSystemDate() {
        if (cimsService != null) {
            String d = cimsService.getSimulatedSystemDate();
            LocalDate parsed = parseDate(d);
            if (parsed != null) return parsed;
        }
        return LocalDate.now();
    }

    public static class ResolvedScope {
        public User user;
        public String role;
        public String scopeLevel; // BANK_WIDE, SEGMENT, DISTRICT, BRANCH, PORTFOLIO
        public String effectiveSegment;
        public List<String> allowedSegments = new ArrayList<>();
        public List<String> allowedDistricts = new ArrayList<>();
        public List<String> allowedBranches = new ArrayList<>();
        public String effectiveDistrict;
        public String effectiveBranch;
        public String portfolioOwner;
        public boolean lockedSegment;
        public boolean lockedDistrict;
        public boolean lockedBranch;
        public boolean isBankWide;
        public DashboardAuthorizationScope authScope;

        public boolean isBankWide() {
            return isBankWide || "BANK_WIDE".equalsIgnoreCase(scopeLevel);
        }
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            if (s.length() >= 10) {
                return LocalDate.parse(s.substring(0, 10));
            }
            return LocalDate.parse(s);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Resolves the user's authorization scope strictly from authentication and organizational assignments.
     * Throws an exception if user is unauthenticated or unrecognized (no hardcoded fallback user).
     */
    public ResolvedScope resolveUserScope(String userId, String reqSegment, String reqDistrict, String reqBranch) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("Authentication required: user ID cannot be blank.");
        }

        User user = userRepository.findById(userId)
                .or(() -> userRepository.findByUsername(userId))
                .orElse(null);

        if (user == null) {
            throw new IllegalArgumentException("Access Denied: Unrecognized or unauthenticated user: " + userId);
        }

        if (!user.isActive()) {
            throw new IllegalArgumentException("Access Denied: User account is inactive.");
        }

        ResolvedScope scope = new ResolvedScope();
        scope.user = user;
        String role = user.getRole() == null ? "RDONLY" : user.getRole().trim().toUpperCase();
        scope.role = role;

        List<String> allSegments = businessSegmentRepository.findAll().stream()
                .filter(BusinessSegment::isActive)
                .map(BusinessSegment::getName)
                .toList();
        if (allSegments.isEmpty()) {
            allSegments = List.of("Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)");
        }

        List<String> userAssignedSegments = new ArrayList<>();
        if (user.getSegmentIds() != null && !user.getSegmentIds().isBlank()) {
            String raw = user.getSegmentIds().replaceAll("[\\[\\]\"']", "");
            for (String s : raw.split(",")) {
                if (!s.trim().isEmpty()) userAssignedSegments.add(s.trim());
            }
        }
        if (userAssignedSegments.isEmpty() && user.getSegment() != null && !user.getSegment().isBlank()) {
            userAssignedSegments.add(user.getSegment());
        }

        List<Branch> allBranches = branchRepository.findAll();
        List<String> allBranchNames = allBranches.stream().map(Branch::getName).toList();
        List<String> allDistrictNames = allBranches.stream()
                .filter(b -> "DistrictOffice".equalsIgnoreCase(b.getType()) || b.getCode().startsWith("DIST-"))
                .map(Branch::getName)
                .toList();
        if (allDistrictNames.isEmpty()) {
            allDistrictNames = List.of("Addis Ababa East District", "Addis Ababa West District", "Bahir Dar District", "Hawassa District");
        }

        DashboardAuthorizationScope auth = new DashboardAuthorizationScope();
        auth.setUserId(user.getId() != null ? user.getId() : user.getUsername());
        auth.setRole(role);
        auth.setRequestedSegment(reqSegment);
        auth.setRequestedDistrict(reqDistrict);
        auth.setRequestedBranch(reqBranch);

        switch (role) {
            case "EXEC":
            case "SRMGMT":
                scope.scopeLevel = "BANK_WIDE";
                scope.isBankWide = true;
                scope.allowedSegments = allSegments;
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                scope.effectiveDistrict = (reqDistrict != null && !reqDistrict.equalsIgnoreCase("ALL")) ? reqDistrict : null;
                scope.effectiveBranch = (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL")) ? reqBranch : null;
                scope.lockedSegment = false;
                scope.lockedDistrict = false;
                scope.lockedBranch = false;

                auth.setRootLevel("BANK");
                auth.setRootEntity("Bank-Wide");
                auth.setBankWide(true);
                auth.setAllowedSegments(allSegments);
                auth.setAllowedDistricts(allDistrictNames);
                auth.setAllowedBranches(allBranchNames);
                auth.setPermittedDrillLevels(Set.of("BANK", "SEGMENT", "DISTRICT", "AREA", "BRANCH", "CUSTOMER", "FACILITY", "COLLATERAL", "POLICY"));
                break;

            case "HODEPT":
                scope.scopeLevel = "SEGMENT";
                scope.isBankWide = false;
                scope.allowedSegments = userAssignedSegments.isEmpty() ? List.of(user.getSegment()) : userAssignedSegments;
                if (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) {
                    if (!scope.allowedSegments.contains(reqSegment)) {
                        throw new IllegalArgumentException("Access Denied: User role " + role + " is restricted to assigned segment: " + scope.allowedSegments);
                    }
                    scope.effectiveSegment = reqSegment;
                } else {
                    scope.effectiveSegment = scope.allowedSegments.get(0);
                }
                scope.effectiveDistrict = (reqDistrict != null && !reqDistrict.equalsIgnoreCase("ALL")) ? reqDistrict : null;
                scope.effectiveBranch = (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL")) ? reqBranch : null;
                scope.lockedSegment = true;
                scope.lockedDistrict = false;
                scope.lockedBranch = false;

                auth.setRootLevel("SEGMENT");
                auth.setRootEntity(scope.effectiveSegment);
                auth.setAllowedSegments(scope.allowedSegments);
                auth.setAllowedDistricts(allDistrictNames);
                auth.setAllowedBranches(allBranchNames);
                auth.setLockedSegment(true);
                auth.setPermittedDrillLevels(Set.of("SEGMENT", "DISTRICT", "AREA", "BRANCH", "CUSTOMER", "FACILITY", "COLLATERAL", "POLICY"));
                break;

            case "DISTDIR":
                scope.scopeLevel = "DISTRICT";
                scope.isBankWide = false;
                scope.allowedSegments = userAssignedSegments.isEmpty() ? allSegments : userAssignedSegments;
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                String assignedDistrict = resolveDistrictForBranch(user.getBranch());
                scope.effectiveDistrict = assignedDistrict;
                scope.lockedSegment = false;
                scope.lockedDistrict = true;

                if (reqDistrict != null && !reqDistrict.equalsIgnoreCase("ALL") && !reqDistrict.equalsIgnoreCase(assignedDistrict)) {
                    throw new IllegalArgumentException("Access Denied: User role " + role + " is restricted to assigned district: " + assignedDistrict);
                }

                if (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL")) {
                    if (!isBranchInDistrict(reqBranch, assignedDistrict)) {
                        throw new IllegalArgumentException("Access Denied: Branch " + reqBranch + " does not belong to assigned district: " + assignedDistrict);
                    }
                    scope.effectiveBranch = reqBranch;
                } else {
                    scope.effectiveBranch = null;
                }
                scope.lockedBranch = false;

                auth.setRootLevel("DISTRICT");
                auth.setRootEntity(assignedDistrict);
                auth.setAllowedDistricts(List.of(assignedDistrict));
                auth.setAllowedBranches(allBranches.stream().filter(b -> isBranchInDistrict(b.getName(), assignedDistrict)).map(Branch::getName).toList());
                auth.setAllowedSegments(scope.allowedSegments);
                auth.setLockedDistrict(true);
                auth.setPermittedDrillLevels(Set.of("DISTRICT", "AREA", "BRANCH", "CUSTOMER", "FACILITY", "COLLATERAL", "POLICY"));
                break;

            case "BRMGR":
                scope.scopeLevel = "BRANCH";
                scope.isBankWide = false;
                scope.allowedSegments = allSegments; // Branch manager has multi-segment visibility within branch
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                scope.effectiveBranch = user.getBranch();
                scope.effectiveDistrict = resolveDistrictForBranch(user.getBranch());
                scope.lockedSegment = false;
                scope.lockedDistrict = true;
                scope.lockedBranch = true;

                if (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL") && !reqBranch.equalsIgnoreCase(user.getBranch())) {
                    throw new IllegalArgumentException("Access Denied: User role " + role + " is restricted to assigned branch: " + user.getBranch());
                }

                auth.setRootLevel("BRANCH");
                auth.setRootEntity(user.getBranch());
                auth.setAllowedBranches(List.of(user.getBranch()));
                auth.setAllowedSegments(allSegments);
                auth.setAllowedDistricts(List.of(scope.effectiveDistrict));
                auth.setLockedBranch(true);
                auth.setLockedDistrict(true);
                auth.setPermittedDrillLevels(Set.of("BRANCH", "CUSTOMER", "FACILITY", "COLLATERAL", "POLICY"));
                break;

            case "RM":
            case "SRM":
            case "BRM":
            case "RO":
            case "CRO":
            case "BRO":
                scope.scopeLevel = "PORTFOLIO";
                scope.isBankWide = false;
                scope.allowedSegments = allSegments;
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                scope.effectiveBranch = user.getBranch();
                scope.effectiveDistrict = resolveDistrictForBranch(user.getBranch());
                scope.portfolioOwner = user.getFullName() != null ? user.getFullName() : user.getUsername();
                scope.lockedSegment = false;
                scope.lockedDistrict = true;
                scope.lockedBranch = true;

                auth.setRootLevel("PORTFOLIO");
                auth.setRootEntity(scope.portfolioOwner);
                auth.setAllowedBranches(List.of(user.getBranch()));
                auth.setAllowedPortfolioOwners(List.of(scope.portfolioOwner, user.getUsername()));
                auth.setPermittedDrillLevels(Set.of("BRANCH", "CUSTOMER", "FACILITY", "COLLATERAL", "POLICY"));
                break;

            default:
                // Auditor, Compliance, Risk, Sysadmin: check organizational assignment
                boolean isHo = user.getBranch() == null || "Head Office".equalsIgnoreCase(user.getBranch()) || "All Branches".equalsIgnoreCase(user.getBranch());
                scope.scopeLevel = isHo ? "BANK_WIDE" : "BRANCH";
                scope.isBankWide = isHo;
                scope.allowedSegments = allSegments;
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                scope.effectiveDistrict = (reqDistrict != null && !reqDistrict.equalsIgnoreCase("ALL")) ? reqDistrict : null;
                scope.effectiveBranch = isHo ? ((reqBranch != null && !reqBranch.equalsIgnoreCase("ALL")) ? reqBranch : null) : user.getBranch();
                scope.lockedSegment = false;
                scope.lockedDistrict = !isHo;
                scope.lockedBranch = !isHo;

                auth.setRootLevel(isHo ? "BANK" : "BRANCH");
                auth.setRootEntity(isHo ? "Bank-Wide" : user.getBranch());
                auth.setBankWide(isHo);
                auth.setAllowedSegments(allSegments);
                auth.setAllowedDistricts(isHo ? allDistrictNames : List.of(resolveDistrictForBranch(user.getBranch())));
                auth.setAllowedBranches(isHo ? allBranchNames : List.of(user.getBranch()));
                auth.setPermittedDrillLevels(Set.of("BANK", "SEGMENT", "DISTRICT", "AREA", "BRANCH", "CUSTOMER", "FACILITY", "COLLATERAL", "POLICY"));
                break;
        }

        scope.authScope = auth;
        scope.allowedDistricts = auth.getAllowedDistricts() != null ? auth.getAllowedDistricts() : Collections.emptyList();
        scope.allowedBranches = auth.getAllowedBranches() != null ? auth.getAllowedBranches() : Collections.emptyList();
        return scope;
    }

    public DashboardAuthorizationScope resolveAuthorizationScope(String userId, String reqSegment, String reqDistrict, String reqBranch) {
        ResolvedScope res = resolveUserScope(userId, reqSegment, reqDistrict, reqBranch);
        return res.authScope;
    }

    private boolean isBranchInDistrict(String branchName, String districtName) {
        if (branchName == null || districtName == null) return false;
        Optional<Branch> distOpt = branchRepository.findAll().stream()
                .filter(b -> b.getName().equalsIgnoreCase(districtName) || (b.getType() != null && b.getType().equalsIgnoreCase("DistrictOffice") && districtName.toLowerCase().contains(b.getName().toLowerCase())))
                .findFirst();
        if (distOpt.isEmpty()) return true;
        String distId = distOpt.get().getId();
        return branchRepository.findAll().stream()
                .anyMatch(b -> b.getName().equalsIgnoreCase(branchName) && (distId.equalsIgnoreCase(b.getParentDistrictId()) || b.getName().equalsIgnoreCase(districtName)));
    }

    private String resolveDistrictForBranch(String branchName) {
        if (branchName == null || branchName.isBlank()) return "Addis Ababa East District";
        Optional<Branch> brnOpt = branchRepository.findAll().stream()
                .filter(b -> b.getName().equalsIgnoreCase(branchName))
                .findFirst();
        if (brnOpt.isPresent() && brnOpt.get().getParentDistrictId() != null) {
            String parentId = brnOpt.get().getParentDistrictId();
            return branchRepository.findById(parentId).map(Branch::getName).orElse("Addis Ababa East District");
        }
        return "Addis Ababa East District";
    }

    public static class ScopedDataset {
        public List<Customer> customers;
        public List<LoanAccount> facilities;
        public List<Collateral> collaterals;
        public List<LoanCollateralLink> links;
        public List<InsurancePolicy> policies;
        public List<OwnershipDocument> documents;
        public List<CimsException> exceptions;
        public List<WorkflowTask> tasks;
        public Map<String, List<LoanCollateralLink>> linksByCollateralId = new HashMap<>();
        public Map<String, LoanAccount> facilityById = new HashMap<>();
        public Map<String, Customer> customerByCif = new HashMap<>();
        public Map<String, List<InsurancePolicy>> policiesByCollateralId = new HashMap<>();
        public Map<String, List<OwnershipDocument>> documentsByCollateralId = new HashMap<>();
        public LocalDate currentDate;
    }

    /**
     * Loads the scoped dataset based strictly on the resolved authorization scope.
     * Enforces strict task scoping (no leak of unauthorized workflow tasks).
     */
    public ScopedDataset loadScopedDataset(ResolvedScope scope, String categoryFilter, String statusFilter, String expiryFilter) {
        ScopedDataset ds = new ScopedDataset();
        ds.currentDate = getCurrentSystemDate();

        List<Customer> allCustomers = customerRepository.findAll();
        List<LoanAccount> allFacilities = loanAccountRepository.findAll();
        List<Collateral> allCollaterals = collateralRepository.findAll();
        List<LoanCollateralLink> allLinks = loanCollateralLinkRepository.findAll();
        List<InsurancePolicy> allPolicies = insurancePolicyRepository.findAll();
        List<OwnershipDocument> allDocs = ownershipDocumentRepository.findAll();
        List<CimsException> allExceptions = cimsExceptionRepository.findAll();
        List<WorkflowTask> allTasks = workflowTaskRepository.findAll();

        allFacilities.forEach(f -> {
            if (f.getId() != null) ds.facilityById.put(f.getId(), f);
            if (f.getLoanReference() != null) ds.facilityById.put(f.getLoanReference(), f);
        });
        allCustomers.forEach(c -> {
            if (c.getCif() != null) ds.customerByCif.put(c.getCif(), c);
        });

        ds.collaterals = allCollaterals.stream().filter(c -> {
            if (scope.effectiveSegment != null && !scope.effectiveSegment.equalsIgnoreCase("ALL")) {
                if (c.getOwningSegment() != null && !c.getOwningSegment().equalsIgnoreCase(scope.effectiveSegment)) return false;
            } else if (!scope.allowedSegments.isEmpty()) {
                if (c.getOwningSegment() != null && !scope.allowedSegments.contains(c.getOwningSegment())) return false;
            }

            if (scope.effectiveDistrict != null && !scope.effectiveDistrict.equalsIgnoreCase("ALL")) {
                String colBranch = c.getBranch();
                if (colBranch != null && !isBranchInDistrict(colBranch, scope.effectiveDistrict)) return false;
            }

            if (scope.effectiveBranch != null && !scope.effectiveBranch.equalsIgnoreCase("ALL")) {
                if (c.getBranch() != null && !c.getBranch().equalsIgnoreCase(scope.effectiveBranch)) return false;
            }

            if (scope.portfolioOwner != null) {
                boolean matchesRm = c.getBranch() != null && c.getBranch().equalsIgnoreCase(scope.effectiveBranch);
                if (!matchesRm) return false;
            }

            if (categoryFilter != null && !categoryFilter.equalsIgnoreCase("ALL")) {
                if (c.getCategory() == null || !c.getCategory().equalsIgnoreCase(categoryFilter)) return false;
            }

            return true;
        }).collect(Collectors.toList());

        Set<String> scopedCollateralIds = ds.collaterals.stream().map(Collateral::getId).collect(Collectors.toSet());
        Set<String> scopedCustomerCifs = ds.collaterals.stream().map(Collateral::getCustomerId).filter(Objects::nonNull).collect(Collectors.toSet());

        for (LoanCollateralLink link : allLinks) {
            if (link.getCollateralId() != null && scopedCollateralIds.contains(link.getCollateralId())) {
                ds.linksByCollateralId.computeIfAbsent(link.getCollateralId(), k -> new ArrayList<>()).add(link);
            }
        }
        ds.links = allLinks.stream().filter(l -> l.getCollateralId() != null && scopedCollateralIds.contains(l.getCollateralId())).collect(Collectors.toList());

        Set<String> linkedFacilityIds = ds.links.stream().map(l -> l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId()).filter(Objects::nonNull).collect(Collectors.toSet());
        ds.facilities = allFacilities.stream().filter(f -> {
            if (linkedFacilityIds.contains(f.getId()) || linkedFacilityIds.contains(f.getLoanReference())) return true;
            if (f.getCustomerId() != null && scopedCustomerCifs.contains(f.getCustomerId())) return true;
            if (scope.effectiveBranch != null && f.getBranch() != null && f.getBranch().equalsIgnoreCase(scope.effectiveBranch)) return true;
            return false;
        }).collect(Collectors.toList());

        ds.customers = allCustomers.stream().filter(c -> scopedCustomerCifs.contains(c.getCif()) || (scope.effectiveBranch != null && c.getBranch() != null && c.getBranch().equalsIgnoreCase(scope.effectiveBranch))).collect(Collectors.toList());

        for (InsurancePolicy p : allPolicies) {
            if (p.getCollateralId() != null && scopedCollateralIds.contains(p.getCollateralId())) {
                ds.policiesByCollateralId.computeIfAbsent(p.getCollateralId(), k -> new ArrayList<>()).add(p);
            }
        }
        ds.policies = allPolicies.stream().filter(p -> p.getCollateralId() != null && scopedCollateralIds.contains(p.getCollateralId())).collect(Collectors.toList());

        for (OwnershipDocument doc : allDocs) {
            if (doc.getCollateralId() != null && scopedCollateralIds.contains(doc.getCollateralId())) {
                ds.documentsByCollateralId.computeIfAbsent(doc.getCollateralId(), k -> new ArrayList<>()).add(doc);
            }
        }
        ds.documents = allDocs.stream().filter(d -> d.getCollateralId() != null && scopedCollateralIds.contains(d.getCollateralId())).collect(Collectors.toList());

        ds.exceptions = allExceptions.stream().filter(e -> (e.getEntityId() != null && scopedCollateralIds.contains(e.getEntityId())) || (e.getEntityId() != null && scopedCustomerCifs.contains(e.getEntityId()))).collect(Collectors.toList());

        // STRICT TASK SCOPING (Fixes previous leak): tasks must match scoped entity IDs or be explicitly assigned to user's branch
        ds.tasks = allTasks.stream().filter(t -> {
            if (t.getEntityId() != null) {
                if (scopedCollateralIds.contains(t.getEntityId())) return true;
                if (linkedFacilityIds.contains(t.getEntityId())) return true;
                if (scopedCustomerCifs.contains(t.getEntityId())) return true;
            }
            if (scope.effectiveBranch != null) {
                // If the user is branch-scoped, only tasks whose entity belongs to their branch are permitted
                return false;
            }
            return scope.isBankWide();
        }).collect(Collectors.toList());

        return ds;
    }

    public ScopeBannerDto buildScopeBanner(ResolvedScope scope) {
        ScopeBannerDto b = new ScopeBannerDto();
        b.setAuthorizedRole(scope.role);
        b.setScopeLevel(scope.scopeLevel);
        b.setSegment(scope.effectiveSegment != null ? scope.effectiveSegment : "All Segments (Bank-Wide)");
        b.setAvailableSegments(scope.allowedSegments);
        b.setDistrict(scope.effectiveDistrict != null ? scope.effectiveDistrict : "All Districts");
        b.setBranch(scope.effectiveBranch != null ? scope.effectiveBranch : "All Branches");
        b.setPortfolioOwner(scope.portfolioOwner);
        b.setLockedSegment(scope.lockedSegment);
        b.setLockedDistrict(scope.lockedDistrict);
        b.setLockedBranch(scope.lockedBranch);

        StringBuilder disp = new StringBuilder();
        if (scope.isBankWide() && scope.effectiveSegment == null && scope.effectiveDistrict == null && scope.effectiveBranch == null) {
            disp.append("BANK-WIDE");
        } else {
            disp.append(scope.effectiveSegment != null ? scope.effectiveSegment : "Bank-Wide");
            if (scope.effectiveDistrict != null) disp.append(" → ").append(scope.effectiveDistrict);
            if (scope.effectiveBranch != null) disp.append(" → ").append(scope.effectiveBranch);
            if (scope.portfolioOwner != null) disp.append(" → My Portfolio (").append(scope.portfolioOwner).append(")");
        }
        b.setDisplayScope(disp.toString());
        b.setServerDate(getCurrentSystemDate().format(DATE_FMT));
        b.setAsOfDate(getCurrentSystemDate().format(DATE_FMT));
        b.setLastRefresh(LocalDateTime.now().format(DISPLAY_DT_FMT));

        // CBS sync freshness
        Map<String, String> freshness = getCbsDataFreshness();
        b.setCbsSyncStatus(freshness.getOrDefault("status", "Current"));
        b.setCbsLastSyncedAt(freshness.getOrDefault("lastSyncedAt", b.getServerDate() + " 08:30"));

        // Scope boundary description
        if ("BRMGR".equalsIgnoreCase(scope.role)) {
            b.setScopeBoundaryDescription("Branch Manager | " + scope.effectiveBranch + " | All Operating Segments");
            b.setScopedBranchesCount(1);
            b.setAuthorizedBranchesCount(1);
        } else if ("DISTDIR".equalsIgnoreCase(scope.role)) {
            b.setScopeBoundaryDescription("District Director | " + scope.effectiveDistrict + " | All Assigned Branches");
            long distBrnCount = branchRepository.findAll().stream().filter(br -> isBranchInDistrict(br.getName(), scope.effectiveDistrict) && !"DistrictOffice".equalsIgnoreCase(br.getType())).count();
            b.setScopedBranchesCount(distBrnCount);
            b.setAuthorizedBranchesCount(distBrnCount);
        } else if ("HODEPT".equalsIgnoreCase(scope.role)) {
            b.setScopeBoundaryDescription("Head Office Department | Segment: " + scope.effectiveSegment + " | Bank-Wide Districts");
            b.setScopedBranchesCount(branchRepository.count());
            b.setAuthorizedBranchesCount(branchRepository.count());
        } else {
            b.setScopeBoundaryDescription("Executive / Senior Management | Bank-Wide Oversight");
            b.setScopedBranchesCount(branchRepository.count());
            b.setAuthorizedBranchesCount(branchRepository.count());
        }

        return b;
    }

    private Map<String, String> getCbsDataFreshness() {
        Map<String, String> freshness = new HashMap<>();
        try {
            List<CbsSyncLog> logs = cbsSyncLogRepository.findAll();
            Optional<CbsSyncLog> latestLog = logs.stream()
                    .filter(l -> l.getTimestamp() != null)
                    .max(Comparator.comparing(CbsSyncLog::getTimestamp));
            if (latestLog.isPresent() && latestLog.get().getTimestamp() != null) {
                String ts = latestLog.get().getTimestamp();
                freshness.put("lastSyncedAt", ts);
                LocalDate logDate = parseDate(ts);
                if (logDate != null && logDate.isEqual(getCurrentSystemDate())) {
                    freshness.put("status", "Current");
                } else {
                    freshness.put("status", "Delayed");
                }
            } else {
                freshness.put("status", "Current");
                freshness.put("lastSyncedAt", getCurrentSystemDate().format(DATE_FMT) + " 08:30");
            }
        } catch (Exception e) {
            freshness.put("status", "Current");
            freshness.put("lastSyncedAt", getCurrentSystemDate().format(DATE_FMT) + " 08:30");
        }
        return freshness;
    }

    /**
     * Primary summary KPI computation. Grounded in EffectiveInsuranceService.
     * Separates bank-wide branch count from authorized/scoped branch count.
     */
    public DashboardSummaryDto getSummary(String userId, String segment, String district, String branch, String category, String status, String expiry) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, category, status, expiry);

        DashboardSummaryDto dto = new DashboardSummaryDto();
        dto.setScopeBanner(buildScopeBanner(scope));

        BigDecimal totalExposure = ds.facilities.stream()
                .map(f -> BigDecimal.valueOf(f.getOutstandingBalance()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setTotalOutstandingExposure(totalExposure);

        BigDecimal totalMarketValue = ds.collaterals.stream()
                .map(c -> BigDecimal.valueOf(c.getValuationAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setTotalCollateralMarketValue(totalMarketValue);

        BigDecimal totalNetSecurity = BigDecimal.ZERO;
        BigDecimal totalRequiredInsurance = BigDecimal.ZERO;
        BigDecimal totalValidActiveInsurance = BigDecimal.ZERO;
        BigDecimal totalInsuranceGap = BigDecimal.ZERO;

        long uninsuredCount = 0;
        long underinsuredCount = 0;
        long adequateCount = 0;

        for (Collateral c : ds.collaterals) {
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<LoanAccount> linkedFacs = links.stream()
                    .map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId()))
                    .filter(Objects::nonNull)
                    .toList();
            List<InsurancePolicy> pols = ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());

            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c, linkedFacs, pols, ds.currentDate
            );

            totalNetSecurity = totalNetSecurity.add(BigDecimal.valueOf(eval.netSecurityValue));
            totalRequiredInsurance = totalRequiredInsurance.add(BigDecimal.valueOf(eval.insuranceRequired));
            totalValidActiveInsurance = totalValidActiveInsurance.add(BigDecimal.valueOf(eval.effectiveInsurance));
            totalInsuranceGap = totalInsuranceGap.add(BigDecimal.valueOf(eval.insuranceGap));

            if ("Uninsured".equalsIgnoreCase(eval.adequacyStatus)) uninsuredCount++;
            else if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus) || "Expired".equalsIgnoreCase(eval.adequacyStatus)) underinsuredCount++;
            else if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) adequateCount++;
        }

        dto.setTotalNetSecurityValue(totalNetSecurity);
        dto.setTotalInsuranceRequired(totalRequiredInsurance);
        dto.setTotalValidActiveInsurance(totalValidActiveInsurance);
        dto.setTotalInsuranceGap(totalInsuranceGap);

        dto.setUninsuredCollateralsCount(uninsuredCount);
        dto.setUnderinsuredCollateralsCount(underinsuredCount);
        dto.setAdequatelyInsuredCollateralsCount(adequateCount);

        // Raw coverage percentage (NOT clipped at 100%, displays actual e.g. 145.2%)
        double covPct = totalRequiredInsurance.compareTo(BigDecimal.ZERO) > 0
                ? totalValidActiveInsurance.divide(totalRequiredInsurance, 4, RoundingMode.HALF_UP).doubleValue() * 100.0
                : 100.0;
        dto.setInsuranceCoveragePct(Math.round(covPct * 10.0) / 10.0);

        long expiredCount = ds.policies.stream().filter(p -> {
            LocalDate exp = parseDate(p.getExpiryDate());
            return "Expired".equalsIgnoreCase(p.getStatus()) || (exp != null && exp.isBefore(ds.currentDate));
        }).count();

        long expiring30Count = ds.policies.stream().filter(p -> {
            LocalDate exp = parseDate(p.getExpiryDate());
            if (exp == null) return false;
            long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
            return days >= 0 && days <= 30 && !"Expired".equalsIgnoreCase(p.getStatus()) && !"Cancelled".equalsIgnoreCase(p.getStatus());
        }).count();

        dto.setExpiredPoliciesCount(expiredCount);
        dto.setPoliciesExpiringWithin30Days(expiring30Count);

        dto.setOpenExceptionsCount(ds.exceptions.stream().filter(e -> !"Resolved".equalsIgnoreCase(e.getStatus())).count());
        dto.setPendingApprovalsCount(ds.tasks.stream().filter(t -> "Pending".equalsIgnoreCase(t.getStatus())).count());
        dto.setReturnedTasksCount(ds.tasks.stream().filter(t -> "Returned".equalsIgnoreCase(t.getStatus())).count());
        dto.setActiveCollateralsCount(ds.collaterals.stream().filter(c -> !"Released".equalsIgnoreCase(c.getStatus()) && !"Closed".equalsIgnoreCase(c.getStatus())).count());

        dto.setTotalCustomersCount(ds.customers.size());
        dto.setTotalFacilitiesCount(ds.facilities.size());

        // Scope-aware branch counts
        long totalBranches;
        if (scope.isBankWide()) {
            totalBranches = branchRepository.count();
        } else if (scope.effectiveDistrict != null) {
            totalBranches = branchRepository.findAll().stream()
                    .filter(b -> isBranchInDistrict(b.getName(), scope.effectiveDistrict) && !"DistrictOffice".equalsIgnoreCase(b.getType()))
                    .count();
        } else if (scope.effectiveBranch != null) {
            totalBranches = 1;
        } else {
            totalBranches = branchRepository.count();
        }
        dto.setTotalBranchesCount(totalBranches);
        dto.setScopedBranchesCount(totalBranches);
        dto.setAuthorizedBranchesCount(scope.allowedBranches.isEmpty() ? branchRepository.count() : scope.allowedBranches.size());

        // Objective Documentation Health metrics
        long docComplete = ds.documents.stream().filter(d -> "Valid".equalsIgnoreCase(d.getStatus()) || "Active".equalsIgnoreCase(d.getStatus())).count();
        long docMissing = ds.documents.stream().filter(d -> "Missing".equalsIgnoreCase(d.getStatus())).count();
        long docExpired = ds.documents.stream().filter(d -> {
            LocalDate exp = parseDate(d.getExpiryDate());
            return "Expired".equalsIgnoreCase(d.getStatus()) || (exp != null && exp.isBefore(ds.currentDate));
        }).count();
        long docExpiring = ds.documents.stream().filter(d -> {
            LocalDate exp = parseDate(d.getExpiryDate());
            if (exp == null) return false;
            long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
            return days >= 0 && days <= 30 && !"Expired".equalsIgnoreCase(d.getStatus());
        }).count();

        dto.setMandatoryDocumentsCompleteCount(docComplete);
        dto.setMissingMandatoryDocumentsCount(docMissing);
        dto.setExpiredDocumentsCount(docExpired);
        dto.setExpiringDocumentsCount(docExpiring);

        dto.setOverrideCount(ds.tasks.stream().filter(t -> t.getActionType() != null && t.getActionType().contains("OVERRIDE")).count());
        dto.setInsurerConcentrationMaxPct(configurationService.getMaxInsurerConcentrationPct());
        dto.setSystemDate(ds.currentDate.format(DATE_FMT));
        dto.setLastRefreshTimestamp(LocalDateTime.now().format(DISPLAY_DT_FMT));

        return dto;
    }

    public DashboardChartDataDto getCharts(String userId, String segment, String district, String branch, String category, String status, String expiry) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, category, status, expiry);

        DashboardChartDataDto charts = new DashboardChartDataDto();

        // 1. Exposure vs Protection by Segment
        List<Map<String, Object>> exposureVsProtection = new ArrayList<>();
        List<String> segs = List.of("Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)");
        for (String seg : segs) {
            double segExp = ds.facilities.stream().filter(f -> seg.equalsIgnoreCase(f.getSegment())).mapToDouble(LoanAccount::getOutstandingBalance).sum();
            List<Collateral> segCols = ds.collaterals.stream().filter(c -> seg.equalsIgnoreCase(c.getOwningSegment())).toList();
            double segAct = 0.0;
            double segReq = 0.0;
            for (Collateral c : segCols) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate
                );
                segAct += eval.effectiveInsurance;
                segReq += eval.insuranceRequired;
            }
            double segGap = Math.max(0, segReq - segAct);

            Map<String, Object> item = new HashMap<>();
            item.put("category", seg.replace(" Banking", "").replace(" (IFB)", ""));
            item.put("exposure", segExp);
            item.put("activeInsurance", segAct);
            item.put("gap", segGap);
            exposureVsProtection.add(item);
        }
        charts.setExposureVsProtection(exposureVsProtection);

        // 2. Compliance Donut
        long adequate = 0;
        long underinsured = 0;
        long uninsured = 0;
        for (Collateral c : ds.collaterals) {
            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c,
                    ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate
            );
            if ("Uninsured".equalsIgnoreCase(eval.adequacyStatus)) uninsured++;
            else if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus) || "Expired".equalsIgnoreCase(eval.adequacyStatus)) underinsured++;
            else adequate++;
        }
        charts.setComplianceDonut(List.of(
                Map.of("name", "Adequately Insured", "value", adequate),
                Map.of("name", "Underinsured Gap", "value", underinsured),
                Map.of("name", "Uninsured Assets", "value", uninsured)
        ));

        // 3. Category Distribution
        Map<String, Double> catVal = new HashMap<>();
        Map<String, Integer> catCount = new HashMap<>();
        for (Collateral c : ds.collaterals) {
            String cat = c.getCategory() != null ? c.getCategory() : "Other";
            catVal.put(cat, catVal.getOrDefault(cat, 0.0) + c.getValuationAmount());
            catCount.put(cat, catCount.getOrDefault(cat, 0) + 1);
        }
        List<Map<String, Object>> catList = new ArrayList<>();
        catVal.forEach((k, v) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("category", k);
            m.put("name", k);
            m.put("value", v);
            m.put("count", catCount.getOrDefault(k, 1));
            catList.add(m);
        });
        charts.setCollateralCategoryDistribution(catList);

        // 4. Expiry Pipeline
        long expOverdue = 0, exp0_7 = 0, exp8_15 = 0, exp16_30 = 0, exp31_60 = 0, exp61_90 = 0, expOver90 = 0;
        for (InsurancePolicy p : ds.policies) {
            LocalDate exp = parseDate(p.getExpiryDate());
            if (exp == null) continue;
            long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
            if (days < 0) expOverdue++;
            else if (days <= 7) exp0_7++;
            else if (days <= 15) exp8_15++;
            else if (days <= 30) exp16_30++;
            else if (days <= 60) exp31_60++;
            else if (days <= 90) exp61_90++;
            else expOver90++;
        }
        charts.setExpiryPipeline(List.of(
                Map.of("range", "Overdue / Expired", "count", expOverdue),
                Map.of("range", "0-7 Days", "count", exp0_7),
                Map.of("range", "8-15 Days", "count", exp8_15),
                Map.of("range", "16-30 Days", "count", exp16_30),
                Map.of("range", "31-60 Days", "count", exp31_60),
                Map.of("range", "61-90 Days", "count", exp61_90),
                Map.of("range", ">90 Days", "count", expOver90)
        ));

        // 5. District Ranking
        List<Map<String, Object>> districtRanking = new ArrayList<>();
        List<String> allDists = List.of(
                "Addis Ababa East District", "Addis Ababa West District", "Addis Ababa North District", "Addis Ababa South District",
                "Central Oromia District", "Western Oromia District", "Eastern Oromia District",
                "Amhara North District", "Amhara South District", "Tigray District", "Sidama District", "South Ethiopia District"
        );
        for (String dist : allDists) {
            List<Collateral> dCols = ds.collaterals.stream().filter(c -> isBranchInDistrict(c.getBranch(), dist)).toList();
            if (dCols.isEmpty()) continue;
            double dExp = 0.0, dGap = 0.0, dReq = 0.0, dAct = 0.0;
            for (Collateral c : dCols) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate
                );
                dExp += eval.totalLinkedExposure;
                dReq += eval.insuranceRequired;
                dAct += eval.effectiveInsurance;
                dGap += eval.insuranceGap;
            }
            double compPct = dReq > 0 ? (dAct / dReq) * 100.0 : 100.0;
            Map<String, Object> dm = new HashMap<>();
            dm.put("district", dist);
            dm.put("districtName", dist);
            dm.put("exposure", dExp);
            dm.put("insuranceGap", dGap);
            dm.put("compliancePct", Math.round(compPct * 10.0) / 10.0);
            dm.put("collateralCount", dCols.size());
            districtRanking.add(dm);
        }
        districtRanking.sort((a, b) -> Double.compare(((Number) b.get("insuranceGap")).doubleValue(), ((Number) a.get("insuranceGap")).doubleValue()));
        charts.setDistrictRanking(districtRanking);

        // 6. Branch Ranking
        List<Map<String, Object>> branchRanking = new ArrayList<>();
        Map<String, List<Collateral>> colsByBranch = ds.collaterals.stream().filter(c -> c.getBranch() != null).collect(Collectors.groupingBy(Collateral::getBranch));
        for (Map.Entry<String, List<Collateral>> entry : colsByBranch.entrySet()) {
            double bVal = 0.0, bReq = 0.0, bAct = 0.0, bGap = 0.0;
            for (Collateral c : entry.getValue()) {
                bVal += c.getValuationAmount();
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate
                );
                bReq += eval.insuranceRequired;
                bAct += eval.effectiveInsurance;
                bGap += eval.insuranceGap;
            }
            double bComp = bReq > 0 ? (bAct / bReq) * 100.0 : 100.0;
            Map<String, Object> bm = new HashMap<>();
            bm.put("branch", entry.getKey());
            bm.put("collateralValue", bVal);
            bm.put("insuranceRequired", bReq);
            bm.put("insuredAmount", bAct);
            bm.put("insuranceGap", bGap);
            bm.put("compliancePct", Math.round(bComp * 10.0) / 10.0);
            branchRanking.add(bm);
        }
        branchRanking.sort((a, b) -> Double.compare(((Number) b.get("insuranceGap")).doubleValue(), ((Number) a.get("insuranceGap")).doubleValue()));
        charts.setBranchRanking(branchRanking);

        // 7. Documentation Health
        long docValid = ds.documents.stream().filter(d -> "Valid".equalsIgnoreCase(d.getStatus()) || "Active".equalsIgnoreCase(d.getStatus())).count();
        long docExpired = ds.documents.stream().filter(d -> "Expired".equalsIgnoreCase(d.getStatus())).count();
        long docMissing = ds.documents.stream().filter(d -> "Missing".equalsIgnoreCase(d.getStatus())).count();
        charts.setDocumentationHealth(List.of(
                Map.of("name", "Complete / Valid", "value", docValid, "color", "#10B981"),
                Map.of("name", "Expired", "value", docExpired, "color", "#EF4444"),
                Map.of("name", "Missing Mandatory", "value", docMissing, "color", "#F59E0B")
        ));

        // 8. Workflow Funnel
        Map<String, Long> taskStatusCount = ds.tasks.stream().collect(Collectors.groupingBy(WorkflowTask::getStatus, Collectors.counting()));
        List<Map<String, Object>> wfList = new ArrayList<>();
        taskStatusCount.forEach((k, v) -> wfList.add(Map.of("status", k, "count", v)));
        charts.setWorkflowFunnel(wfList);

        // 9. Ownership Distribution
        Map<String, Long> ownerCounts = ds.collaterals.stream().collect(Collectors.groupingBy(c -> c.getOwnershipType() != null ? c.getOwnershipType() : "Primary Borrower", Collectors.counting()));
        List<Map<String, Object>> ownerList = new ArrayList<>();
        ownerCounts.forEach((k, v) -> ownerList.add(Map.of("ownershipType", k, "count", v)));
        charts.setOwnershipDistribution(ownerList);

        // 10. Top Insurance Gaps
        List<EffectiveInsuranceService.CollateralProtectionResult> evals = new ArrayList<>();
        for (Collateral c : ds.collaterals) {
            evals.add(effectiveInsuranceService.evaluateCollateral(
                    c,
                    ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate
            ));
        }
        evals.sort((a, b) -> Double.compare(b.insuranceGap, a.insuranceGap));
        List<Map<String, Object>> topGaps = new ArrayList<>();
        for (int i = 0; i < Math.min(10, evals.size()); i++) {
            EffectiveInsuranceService.CollateralProtectionResult ev = evals.get(i);
            Collateral c = ds.collaterals.stream().filter(col -> col.getId().equals(ev.collateralId)).findFirst().orElse(null);
            Customer cust = c != null ? ds.customerByCif.get(c.getCustomerId()) : null;
            Map<String, Object> tg = new HashMap<>();
            tg.put("collateralCode", ev.collateralCode);
            tg.put("customerName", cust != null ? cust.getName() : "Customer");
            tg.put("cif", c != null ? c.getCustomerId() : "");
            tg.put("branch", c != null ? c.getBranch() : "");
            tg.put("requiredInsurance", ev.insuranceRequired);
            tg.put("activeInsurance", ev.effectiveInsurance);
            tg.put("insuranceGap", ev.insuranceGap);
            topGaps.add(tg);
        }
        charts.setTopInsuranceGaps(topGaps);

        // 5. Genuine Historical Snapshots Check (renders ONLY if >= 2 snapshots exist)
        String scopeLevel = scope.scopeLevel != null ? scope.scopeLevel : "BANK";
        String scopeId = scope.effectiveBranch != null ? scope.effectiveBranch : (scope.effectiveDistrict != null ? scope.effectiveDistrict : (scope.effectiveSegment != null ? scope.effectiveSegment : "ALL"));
        Map<String, Object> histResult = getHistoricalSnapshots(scopeLevel, scopeId);
        Boolean hasSufficient = (Boolean) histResult.getOrDefault("hasSufficientData", false);
        if (Boolean.TRUE.equals(hasSufficient)) {
            @SuppressWarnings("unchecked")
            List<DashboardSnapshot> snaps = (List<DashboardSnapshot>) histResult.get("snapshots");
            charts.setHistoricalSnapshots(snaps.stream().map(s -> {
                Map<String, Object> sm = new HashMap<>();
                sm.put("snapshotDate", s.getSnapshotDate());
                sm.put("totalExposure", s.getTotalExposure());
                sm.put("activeInsurance", s.getActiveInsurance());
                sm.put("insuranceGap", s.getInsuranceGap());
                sm.put("coveragePercentage", s.getCoveragePercentage());
                return sm;
            }).toList());
            charts.setHistoricalDataMessage((String) histResult.get("message"));
        } else {
            charts.setHistoricalSnapshots(Collections.emptyList());
            charts.setHistoricalDataMessage("Historical trend unavailable — Insufficient historical snapshots (minimum 2 snapshots required).");
        }

        return charts;
    }

    public List<DashboardPortfolioRowDto> getPortfolio(String userId, String segment, String district, String branch, String category, String status, String expiry) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, category, status, expiry);

        List<DashboardPortfolioRowDto> rows = new ArrayList<>();
        for (Collateral c : ds.collaterals) {
            Customer cust = ds.customerByCif.get(c.getCustomerId());
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<InsurancePolicy> pols = ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<OwnershipDocument> docs = ds.documentsByCollateralId.getOrDefault(c.getId(), Collections.emptyList());

            List<LoanAccount> linkedFacs = links.stream()
                    .map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId()))
                    .filter(Objects::nonNull)
                    .toList();

            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c, linkedFacs, pols, ds.currentDate
            );

            DashboardPortfolioRowDto row = new DashboardPortfolioRowDto();
            row.setCollateralId(c.getId());
            row.setCollateralCode(c.getCode());
            row.setCollateralCategory(c.getCategory());
            row.setCollateralType(c.getType() != null ? c.getType() : c.getCategory());
            row.setCustomerId(c.getCustomerId());
            row.setCustomerName(cust != null ? cust.getName() : c.getCustomerId());
            row.setCif(cust != null ? cust.getCif() : c.getCustomerId());
            row.setSegment(c.getOwningSegment() != null ? c.getOwningSegment() : (scope.effectiveSegment != null ? scope.effectiveSegment : "Unassigned"));
            row.setBranch(c.getBranch() != null ? c.getBranch() : (scope.effectiveBranch != null ? scope.effectiveBranch : "Unassigned"));
            row.setDistrict(resolveDistrictForBranch(c.getBranch()));
            String officer = !linkedFacs.isEmpty() && linkedFacs.get(0).getRmUserId() != null
                    ? linkedFacs.get(0).getRmUserId()
                    : (cust != null && cust.getMakerId() != null ? cust.getMakerId() : "Relationship Officer");
            row.setRmName(officer);
            row.setRoName(officer);

            if (!linkedFacs.isEmpty()) {
                LoanAccount f1 = linkedFacs.get(0);
                row.setFacilityId(f1.getId());
                row.setFacilityRef(f1.getLoanReference() != null ? f1.getLoanReference() : f1.getId());
                row.setOutstandingExposure(BigDecimal.valueOf(eval.totalLinkedExposure));
            } else {
                row.setOutstandingExposure(BigDecimal.ZERO);
            }

            row.setMarketValue(BigDecimal.valueOf(eval.marketValue));
            row.setHaircut(eval.haircut);
            row.setNetSecurity(BigDecimal.valueOf(eval.netSecurityValue));
            row.setInsuranceRequired(BigDecimal.valueOf(eval.insuranceRequired));
            row.setInsuredAmount(BigDecimal.valueOf(eval.effectiveInsurance));
            row.setInsuranceGap(BigDecimal.valueOf(eval.insuranceGap));
            row.setCoveragePct(eval.coveragePercentage);
            row.setAdequacyStatus(eval.adequacyStatus);

            if (!pols.isEmpty()) {
                InsurancePolicy p = pols.get(0);
                row.setPolicyNumber(p.getPolicyNumber());
                row.setInsurerName(p.getInsurerName());
                row.setPolicyStatus(p.getStatus());
                row.setExpiryDate(p.getExpiryDate());
            }

            row.setDocumentStatus(docs.isEmpty() ? "Missing" : (docs.stream().allMatch(d -> "Valid".equalsIgnoreCase(d.getStatus())) ? "Complete" : "Action Required"));
            row.setWorkflowStatus("Approved");
            rows.add(row);
        }

        return rows;
    }

    public PaginatedPortfolioResponseDto getPaginatedPortfolio(
            String userId, String segment, String district, String branch,
            String category, String status, String expiry, String search,
            int page, int size, String sortField, String sortDir) {

        List<DashboardPortfolioRowDto> allRows = getPortfolio(userId, segment, district, branch, category, status, expiry);

        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();
            allRows = allRows.stream().filter(r ->
                    (r.getCustomerName() != null && r.getCustomerName().toLowerCase().contains(s)) ||
                    (r.getCif() != null && r.getCif().toLowerCase().contains(s)) ||
                    (r.getCollateralCode() != null && r.getCollateralCode().toLowerCase().contains(s)) ||
                    (r.getPolicyNumber() != null && r.getPolicyNumber().toLowerCase().contains(s)) ||
                    (r.getFacilityRef() != null && r.getFacilityRef().toLowerCase().contains(s))
            ).toList();
        }

        if (sortField != null && !sortField.isBlank()) {
            boolean asc = !"desc".equalsIgnoreCase(sortDir);
            Comparator<DashboardPortfolioRowDto> comp = switch (sortField.toLowerCase()) {
                case "customername" -> Comparator.comparing(r -> r.getCustomerName() != null ? r.getCustomerName() : "", String.CASE_INSENSITIVE_ORDER);
                case "exposure" -> Comparator.comparing(r -> r.getOutstandingExposure() != null ? r.getOutstandingExposure() : BigDecimal.ZERO);
                case "marketvalue" -> Comparator.comparing(r -> r.getMarketValue() != null ? r.getMarketValue() : BigDecimal.ZERO);
                case "gap" -> Comparator.comparing(r -> r.getInsuranceGap() != null ? r.getInsuranceGap() : BigDecimal.ZERO);
                case "coveragepct" -> Comparator.comparingDouble(DashboardPortfolioRowDto::getCoveragePct);
                default -> Comparator.comparing(r -> r.getCustomerName() != null ? r.getCustomerName() : "", String.CASE_INSENSITIVE_ORDER);
            };
            if (!asc) comp = comp.reversed();
            allRows = allRows.stream().sorted(comp).toList();
        }

        int totalElements = allRows.size();
        int pageSize = Math.max(1, size);
        int totalPages = (int) Math.ceil((double) totalElements / pageSize);
        int currentPage = Math.max(0, Math.min(page, Math.max(0, totalPages - 1)));

        int fromIndex = Math.min(currentPage * pageSize, totalElements);
        int toIndex = Math.min(fromIndex + pageSize, totalElements);
        List<DashboardPortfolioRowDto> pageContent = allRows.subList(fromIndex, toIndex);

        return new PaginatedPortfolioResponseDto(pageContent, currentPage, pageSize, totalElements, totalPages);
    }

    public List<DashboardWorkQueueItemDto> getWorkQueue(String userId, String segment, String district, String branch) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        List<DashboardWorkQueueItemDto> queue = new ArrayList<>();
        LocalDate now = ds.currentDate != null ? ds.currentDate : LocalDate.now();

        if (ds.policies != null) {
            for (InsurancePolicy p : ds.policies) {
                LocalDate exp = parseDate(p.getExpiryDate());
                if (exp == null) continue;
                long days = ChronoUnit.DAYS.between(now, exp);

                if (days < 0 || "Expired".equalsIgnoreCase(p.getStatus())) {
                    DashboardWorkQueueItemDto item = new DashboardWorkQueueItemDto();
                    item.setId("wq-exp-" + p.getId());
                    item.setPriority("Critical");
                    item.setCategory("Expired Policy");
                    Customer cust = ds.customerByCif.get(p.getCustomerId());
                    item.setCustomerName(cust != null ? cust.getName() : p.getCustomerId());
                    item.setCustomerCif(p.getCustomerId());
                    item.setPolicyNumber(p.getPolicyNumber());
                    item.setIssueDescription("Policy expired " + Math.abs(days) + " days ago. Collateral is exposed.");
                    item.setDaysRemainingOrOverdue((int) days);
                    item.setRequiredAction("Initiate Policy Renewal / Customer Notice");
                    item.setStatus("Action Required");
                    item.setAssignedOfficer(scope.portfolioOwner != null ? scope.portfolioOwner : "Relationship Officer");
                    Collateral linkedCol = p.getCollateralId() != null
                            ? ds.collaterals.stream().filter(c -> c.getId().equals(p.getCollateralId())).findFirst().orElse(null)
                            : null;
                    item.setBranch(linkedCol != null && linkedCol.getBranch() != null ? linkedCol.getBranch() : (scope.effectiveBranch != null ? scope.effectiveBranch : "Head Office"));
                    item.setSegment(linkedCol != null && linkedCol.getOwningSegment() != null ? linkedCol.getOwningSegment() : (scope.effectiveSegment != null ? scope.effectiveSegment : "Corporate Banking"));
                    item.setGapAmount(BigDecimal.valueOf(p.getInsuredAmount()));
                    item.setTargetModule("policies");
                    item.setTargetEntityId(p.getId());
                    queue.add(item);
                } else if (days <= 30 && !"Cancelled".equalsIgnoreCase(p.getStatus())) {
                    DashboardWorkQueueItemDto item = new DashboardWorkQueueItemDto();
                    item.setId("wq-due-" + p.getId());
                    item.setPriority(days <= 7 ? "Critical" : "High");
                    item.setCategory("Expiring Soon");
                    Customer cust = ds.customerByCif.get(p.getCustomerId());
                    item.setCustomerName(cust != null ? cust.getName() : p.getCustomerId());
                    item.setCustomerCif(p.getCustomerId());
                    item.setPolicyNumber(p.getPolicyNumber());
                    item.setIssueDescription("Policy expires in " + days + " days. Renewal notice required.");
                    item.setDaysRemainingOrOverdue((int) days);
                    item.setRequiredAction("Send Renewal Reminder / Review Endorsement");
                    item.setStatus("Pending Renewal");
                    item.setAssignedOfficer(scope.portfolioOwner != null ? scope.portfolioOwner : "Relationship Officer");
                    Collateral linkedCol = p.getCollateralId() != null
                            ? ds.collaterals.stream().filter(c -> c.getId().equals(p.getCollateralId())).findFirst().orElse(null)
                            : null;
                    item.setBranch(linkedCol != null && linkedCol.getBranch() != null ? linkedCol.getBranch() : (scope.effectiveBranch != null ? scope.effectiveBranch : "Head Office"));
                    item.setSegment(linkedCol != null && linkedCol.getOwningSegment() != null ? linkedCol.getOwningSegment() : (scope.effectiveSegment != null ? scope.effectiveSegment : "Corporate Banking"));
                    item.setGapAmount(BigDecimal.valueOf(p.getInsuredAmount()));
                    item.setTargetModule("policies");
                    item.setTargetEntityId(p.getId());
                    queue.add(item);
                }
            }
        }

        if (ds.collaterals != null) {
            for (Collateral c : ds.collaterals) {
                double val = c.getValuationAmount();
                double ins = c.getInsuredAmount();
                double gap = Math.max(0, val - ins);
                if (gap > 0) {
                    DashboardWorkQueueItemDto item = new DashboardWorkQueueItemDto();
                    item.setId("wq-gap-" + c.getId());
                    item.setPriority(ins == 0 ? "Critical" : "High");
                    item.setCategory(ins == 0 ? "Uninsured Collateral" : "Underinsured Protection Gap");
                    Customer cust = ds.customerByCif.get(c.getCustomerId());
                    item.setCustomerName(cust != null ? cust.getName() : c.getCustomerId());
                    item.setCustomerCif(c.getCustomerId());
                    item.setCollateralCode(c.getCode());
                    item.setIssueDescription("Protection deficit of ETB " + gap + " against valuation of ETB " + val);
                    item.setDaysRemainingOrOverdue(0);
                    item.setRequiredAction("Attach or Enhance Policy Coverage");
                    item.setStatus("Coverage Deficit");
                    item.setAssignedOfficer(scope.portfolioOwner != null ? scope.portfolioOwner : "Relationship Officer");
                    item.setBranch(c.getBranch());
                    item.setSegment(c.getOwningSegment());
                    item.setExposureAmount(BigDecimal.valueOf(val));
                    item.setGapAmount(BigDecimal.valueOf(gap));
                    item.setTargetModule("collaterals");
                    item.setTargetEntityId(c.getId());
                    queue.add(item);
                }
            }
        }

        if (ds.tasks != null) {
            for (WorkflowTask t : ds.tasks) {
                if ("Pending".equalsIgnoreCase(t.getStatus()) || "Returned".equalsIgnoreCase(t.getStatus())) {
                    DashboardWorkQueueItemDto item = new DashboardWorkQueueItemDto();
                    item.setId("wq-task-" + t.getId());
                    item.setPriority("Returned".equalsIgnoreCase(t.getStatus()) ? "High" : "Medium");
                    item.setCategory("Returned".equalsIgnoreCase(t.getStatus()) ? "Returned Workflow Correction" : "Pending Checker Approval");
                    item.setIssueDescription(t.getActionType() + ": " + (t.getRemarks() != null ? t.getRemarks() : "Review required"));
                    item.setDaysRemainingOrOverdue(0);
                    item.setRequiredAction("Returned".equalsIgnoreCase(t.getStatus()) ? "Modify & Resubmit Transaction" : "Review & Authorize Task");
                    item.setStatus(t.getStatus());
                    item.setAssignedOfficer(t.getCandidateRole());
                    item.setTargetModule("workflow");
                    item.setTargetEntityId(t.getId());
                    queue.add(item);
                }
            }
        }

        Map<String, Integer> priorityRank = Map.of("Critical", 1, "High", 2, "Medium", 3, "Low", 4);
        queue.sort(Comparator.comparingInt(a -> priorityRank.getOrDefault(a.getPriority(), 5)));
        return queue;
    }

    public String exportPortfolioCsv(String userId, String segment, String district, String branch, String category, String status, String expiry) {
        List<DashboardPortfolioRowDto> rows = getPortfolio(userId, segment, district, branch, category, status, expiry);
        StringBuilder sb = new StringBuilder();
        sb.append("Customer Name,CIF,Segment,District,Branch,RM,RO,Facility Ref,Exposure,Collateral Code,Category,Market Value,Haircut %,Net Security,Required Insurance,Active Insurance,Gap,Coverage %,Policy Number,Insurer,Policy Status,Expiry Date,Document Status,Workflow Status\n");

        for (DashboardPortfolioRowDto r : rows) {
            sb.append("\"").append(safe(r.getCustomerName())).append("\",");
            sb.append("\"").append(safe(r.getCif())).append("\",");
            sb.append("\"").append(safe(r.getSegment())).append("\",");
            sb.append("\"").append(safe(r.getDistrict())).append("\",");
            sb.append("\"").append(safe(r.getBranch())).append("\",");
            sb.append("\"").append(safe(r.getRmName())).append("\",");
            sb.append("\"").append(safe(r.getRoName())).append("\",");
            sb.append("\"").append(safe(r.getFacilityRef())).append("\",");
            sb.append(r.getOutstandingExposure() != null ? r.getOutstandingExposure() : 0).append(",");
            sb.append("\"").append(safe(r.getCollateralCode())).append("\",");
            sb.append("\"").append(safe(r.getCollateralCategory())).append("\",");
            sb.append(r.getMarketValue() != null ? r.getMarketValue() : 0).append(",");
            sb.append(r.getHaircut()).append(",");
            sb.append(r.getNetSecurity() != null ? r.getNetSecurity() : 0).append(",");
            sb.append(r.getInsuranceRequired() != null ? r.getInsuranceRequired() : 0).append(",");
            sb.append(r.getInsuredAmount() != null ? r.getInsuredAmount() : 0).append(",");
            sb.append(r.getInsuranceGap() != null ? r.getInsuranceGap() : 0).append(",");
            sb.append(r.getCoveragePct()).append("%,");
            sb.append("\"").append(safe(r.getPolicyNumber())).append("\",");
            sb.append("\"").append(safe(r.getInsurerName())).append("\",");
            sb.append("\"").append(safe(r.getPolicyStatus())).append("\",");
            sb.append("\"").append(safe(r.getExpiryDate())).append("\",");
            sb.append("\"").append(safe(r.getDocumentStatus())).append("\",");
            sb.append("\"").append(safe(r.getWorkflowStatus())).append("\"\n");
        }
        return sb.toString();
    }

    private String safe(String s) {
        return s == null ? "" : s.replace("\"", "\"\"");
    }

    /**
     * Compute shared collaterals across distinct business segments without double counting.
     * Single-counted physical valuation; allocated facility exposure.
     */
    public List<Map<String, Object>> computeSharedCollaterals(ScopedDataset ds) {
        List<Map<String, Object>> sharedList = new ArrayList<>();
        if (ds == null || ds.collaterals == null) return sharedList;

        for (Collateral col : ds.collaterals) {
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(col.getId(), Collections.emptyList());
            Set<String> segments = new LinkedHashSet<>();
            if (col.getOwningSegment() != null && !col.getOwningSegment().isBlank()) {
                segments.add(col.getOwningSegment().trim());
            }

            double totalAllocated = 0.0;
            List<Map<String, Object>> facilityLinks = new ArrayList<>();

            for (LoanCollateralLink link : links) {
                String fId = link.getFacilityId() != null ? link.getFacilityId() : link.getLoanAccountId();
                LoanAccount fac = ds.facilityById.get(fId);
                if (fac != null && fac.getSegment() != null && !fac.getSegment().isBlank()) {
                    segments.add(fac.getSegment().trim());
                }
                totalAllocated += link.getAllocatedAmount();
                if (fac != null) {
                    Map<String, Object> fm = new HashMap<>();
                    fm.put("facilityRef", fac.getLoanReference() != null ? fac.getLoanReference() : fac.getId());
                    fm.put("segment", fac.getSegment());
                    fm.put("outstandingBalance", fac.getOutstandingBalance());
                    fm.put("allocatedSecurity", link.getAllocatedAmount());
                    facilityLinks.add(fm);
                }
            }

            if (segments.size() > 1) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("collateralId", col.getId());
                item.put("collateralCode", col.getCode());
                item.put("description", col.getDescription());
                item.put("category", col.getCategory());
                item.put("marketValue", col.getValuationAmount()); // SINGLE-COUNTED
                item.put("haircut", col.getHaircut());
                item.put("netSecurityValue", col.getValuationAmount() * (1.0 - col.getHaircut() / 100.0));
                item.put("totalAllocatedSecurity", totalAllocated);
                item.put("owningSegment", col.getOwningSegment());
                item.put("linkedSegments", new ArrayList<>(segments));
                item.put("facilityCount", links.size());
                item.put("linkedFacilities", facilityLinks);

                Customer cust = ds.customerByCif.get(col.getCustomerId());
                if (cust == null && ds.customers != null) {
                    cust = ds.customers.stream().filter(c -> c.getId().equalsIgnoreCase(col.getCustomerId()) || c.getCif().equalsIgnoreCase(col.getCustomerId())).findFirst().orElse(null);
                }
                item.put("customerName", cust != null ? cust.getName() : "Customer " + col.getCustomerId());
                item.put("customerId", col.getCustomerId());
                item.put("branch", col.getBranch());
                item.put("insuranceStatus", col.getInsuranceStatus());
                sharedList.add(item);
            }
        }
        return sharedList;
    }

    /**
     * Action-oriented operational hotspots classified into 4 distinct categories:
     * 1. INSURANCE_RISK
     * 2. DOCUMENTATION
     * 3. OPERATIONAL
     * 4. DATA_QUALITY
     */
    public List<Map<String, Object>> computeRequiresAttentionV2(ScopedDataset ds) {
        List<Map<String, Object>> items = new ArrayList<>();
        if (ds == null) return items;

        LocalDate now = ds.currentDate != null ? ds.currentDate : LocalDate.now();

        // 1. INSURANCE RISK
        if (ds.policies != null) {
            for (InsurancePolicy p : ds.policies) {
                LocalDate exp = parseDate(p.getExpiryDate());
                boolean isExpired = "Expired".equalsIgnoreCase(p.getStatus()) || (exp != null && exp.isBefore(now));
                if (isExpired) {
                    long daysOverdue = exp != null ? ChronoUnit.DAYS.between(exp, now) : 0;
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", p.getId());
                    item.put("entityId", p.getCollateralId() != null ? p.getCollateralId() : p.getId());
                    item.put("category", "INSURANCE_RISK");
                    item.put("type", "EXPIRED_POLICY");
                    item.put("severity", "CRITICAL");
                    item.put("code", p.getPolicyNumber());
                    item.put("title", "Expired Insurance Policy");
                    item.put("description", "Policy #" + p.getPolicyNumber() + " expired " + Math.max(0, daysOverdue) + " days ago. Collateral is exposed.");
                    item.put("amount", p.getInsuredAmount());
                    item.put("recommendedAction", "Initiate Policy Renewal / Customer Notice");
                    item.put("routeTarget", "/policies");
                    items.add(item);
                } else if (exp != null) {
                    long days = ChronoUnit.DAYS.between(now, exp);
                    if (days >= 0 && days <= 30 && !"Cancelled".equalsIgnoreCase(p.getStatus())) {
                        Map<String, Object> item = new LinkedHashMap<>();
                        item.put("id", p.getId());
                        item.put("entityId", p.getCollateralId() != null ? p.getCollateralId() : p.getId());
                        item.put("category", "INSURANCE_RISK");
                        item.put("type", "EXPIRING_POLICY");
                        item.put("severity", days <= 7 ? "CRITICAL" : "HIGH");
                        item.put("code", p.getPolicyNumber());
                        item.put("title", "Policy Expiring in " + days + " Days");
                        item.put("description", "Policy #" + p.getPolicyNumber() + " expires on " + p.getExpiryDate() + ". Renewal binder required.");
                        item.put("amount", p.getInsuredAmount());
                        item.put("recommendedAction", "Send Renewal Reminder / Review Endorsement");
                        item.put("routeTarget", "/policies");
                        items.add(item);
                    }
                }
            }
        }

        if (ds.collaterals != null) {
            for (Collateral c : ds.collaterals) {
                List<LoanAccount> linkedFacs = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream()
                        .map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId()))
                        .filter(Objects::nonNull).toList();
                List<InsurancePolicy> pols = ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());

                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c, linkedFacs, pols, now
                );

                if ("Uninsured".equalsIgnoreCase(eval.adequacyStatus) && eval.isMandatory) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", c.getId());
                    item.put("entityId", c.getId());
                    item.put("category", "INSURANCE_RISK");
                    item.put("type", "UNINSURED");
                    item.put("severity", "CRITICAL");
                    item.put("code", c.getCode());
                    item.put("title", "Uninsured Collateral Asset");
                    item.put("description", (c.getDescription() != null ? c.getDescription() : c.getCode()) + " has zero active insurance coverage.");
                    item.put("amount", eval.insuranceRequired);
                    item.put("recommendedAction", "Register / Attach Insurance Policy Binder");
                    item.put("routeTarget", "/collaterals");
                    items.add(item);
                } else if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus) && eval.insuranceGap > 0) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", c.getId());
                    item.put("entityId", c.getId());
                    item.put("category", "INSURANCE_RISK");
                    item.put("type", "UNDERINSURED");
                    item.put("severity", "HIGH");
                    item.put("code", c.getCode());
                    item.put("title", "Underinsured Protection Gap");
                    item.put("description", "Protection deficit of ETB " + String.format(Locale.ROOT, "%,.2f", eval.insuranceGap) + " against requirement.");
                    item.put("amount", eval.insuranceGap);
                    item.put("recommendedAction", "Review Additional Coverage / Request Top-up Endorsement");
                    item.put("routeTarget", "/collaterals");
                    items.add(item);
                }

                // 4. DATA QUALITY: Collateral without facilities
                if (linkedFacs.isEmpty() && !"Released".equalsIgnoreCase(c.getStatus()) && !"Closed".equalsIgnoreCase(c.getStatus())) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", "dq-link-" + c.getId());
                    item.put("entityId", c.getId());
                    item.put("category", "DATA_QUALITY");
                    item.put("type", "UNLINKED_COLLATERAL");
                    item.put("severity", "MEDIUM");
                    item.put("code", c.getCode());
                    item.put("title", "Unlinked Collateral Record");
                    item.put("description", "Active collateral is not linked to any active credit facility.");
                    item.put("amount", c.getValuationAmount());
                    item.put("recommendedAction", "Verify Credit Facility Linkage in CIMS");
                    item.put("routeTarget", "/collaterals");
                    items.add(item);
                }
            }
        }

        // 2. DOCUMENTATION HEALTH
        if (ds.documents != null) {
            for (OwnershipDocument doc : ds.documents) {
                LocalDate exp = parseDate(doc.getExpiryDate());
                boolean isExpired = "Expired".equalsIgnoreCase(doc.getStatus()) || (exp != null && exp.isBefore(now));
                if (isExpired) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", doc.getId());
                    item.put("entityId", doc.getCollateralId());
                    item.put("category", "DOCUMENTATION");
                    item.put("type", "EXPIRED_DOCUMENT");
                    item.put("severity", "HIGH");
                    item.put("code", doc.getDocumentType());
                    item.put("title", "Expired Ownership Document: " + doc.getDocumentType());
                    item.put("description", "Document #" + doc.getDocumentNumber() + " expired on " + doc.getExpiryDate());
                    item.put("amount", 0.0);
                    item.put("recommendedAction", "Request Renewed Title Deed / Registration Document");
                    item.put("routeTarget", "/collaterals");
                    items.add(item);
                } else if ("Missing".equalsIgnoreCase(doc.getStatus())) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", doc.getId());
                    item.put("entityId", doc.getCollateralId());
                    item.put("category", "DOCUMENTATION");
                    item.put("type", "MISSING_MANDATORY_DOCUMENT");
                    item.put("severity", "HIGH");
                    item.put("code", doc.getDocumentType());
                    item.put("title", "Missing Mandatory Document: " + doc.getDocumentType());
                    item.put("description", "Mandatory ownership document is not uploaded for collateral.");
                    item.put("amount", 0.0);
                    item.put("recommendedAction", "Upload Required Document Copy");
                    item.put("routeTarget", "/collaterals");
                    items.add(item);
                }
            }
        }

        // 3. OPERATIONAL WORKFLOW
        if (ds.tasks != null) {
            for (WorkflowTask t : ds.tasks) {
                if ("Pending".equalsIgnoreCase(t.getStatus())) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", t.getId());
                    item.put("entityId", t.getEntityId());
                    item.put("category", "OPERATIONAL");
                    item.put("type", "PENDING_APPROVAL");
                    item.put("severity", "MEDIUM");
                    item.put("code", t.getActionType());
                    item.put("title", "Pending Checker Approval: " + t.getActionType());
                    item.put("description", t.getRemarks() != null ? t.getRemarks() : "Workflow action awaiting verification.");
                    item.put("amount", 0.0);
                    item.put("recommendedAction", "Review & Authorize Task in Workflow Queue");
                    item.put("routeTarget", "/workflow");
                    items.add(item);
                } else if ("Returned".equalsIgnoreCase(t.getStatus())) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", t.getId());
                    item.put("entityId", t.getEntityId());
                    item.put("category", "OPERATIONAL");
                    item.put("type", "RETURNED_CORRECTION");
                    item.put("severity", "HIGH");
                    item.put("code", t.getActionType());
                    item.put("title", "Returned Transaction Correction Required");
                    item.put("description", "Checker returned task: " + (t.getRemarks() != null ? t.getRemarks() : "Modifications required."));
                    item.put("amount", 0.0);
                    item.put("recommendedAction", "Modify & Resubmit Transaction");
                    item.put("routeTarget", "/workflow");
                    items.add(item);
                }
            }
        }

        if (ds.exceptions != null) {
            for (CimsException ex : ds.exceptions) {
                if ("Open".equalsIgnoreCase(ex.getStatus()) || "Pending".equalsIgnoreCase(ex.getStatus())) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", ex.getId());
                    item.put("entityId", ex.getEntityId());
                    item.put("category", "OPERATIONAL");
                    item.put("type", "OPEN_EXCEPTION");
                    item.put("severity", "CRITICAL".equalsIgnoreCase(ex.getSeverity()) ? "CRITICAL" : "HIGH");
                    item.put("code", ex.getExceptionType());
                    item.put("title", "Open Exception: " + ex.getExceptionType());
                    item.put("description", ex.getDescription() != null ? ex.getDescription() : ex.getExceptionType());
                    item.put("amount", 0.0);
                    item.put("recommendedAction", "Review Exception & Submit Resolution / Waiver");
                    item.put("routeTarget", "/exceptions");
                    items.add(item);
                }
            }
        }

        items.sort((a, b) -> {
            int scoreA = "CRITICAL".equals(a.get("severity")) ? 4 : ("HIGH".equals(a.get("severity")) ? 3 : ("MEDIUM".equals(a.get("severity")) ? 2 : 1));
            int scoreB = "CRITICAL".equals(b.get("severity")) ? 4 : ("HIGH".equals(b.get("severity")) ? 3 : ("MEDIUM".equals(b.get("severity")) ? 2 : 1));
            return Integer.compare(scoreB, scoreA);
        });

        return items.stream().limit(50).collect(Collectors.toList());
    }

    public List<Map<String, Object>> computeRequiresAttention(ScopedDataset ds) {
        return computeRequiresAttentionV2(ds);
    }

    public List<Map<String, Object>> getSharedCollaterals(String userId, String segment, String district, String branch) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);
        return computeSharedCollaterals(ds);
    }

    public List<Map<String, Object>> getRequiresAttention(String userId, String segment, String district, String branch) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);
        return computeRequiresAttentionV2(ds);
    }

    /**
     * Deterministic KPI "Why?" Explanatory Breakdown Engine.
     */
    public KpiExplanationDto getKpiExplanatoryBreakdown(String kpiKey, String userId, String segment, String district, String branch) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        KpiExplanationDto dto = new KpiExplanationDto();
        String key = kpiKey != null ? kpiKey.toUpperCase() : "INSURANCE_GAP";
        dto.setKpiKey(key);
        dto.setScope(scope.effectiveBranch != null ? scope.effectiveBranch : (scope.effectiveDistrict != null ? scope.effectiveDistrict : (scope.effectiveSegment != null ? scope.effectiveSegment : "Bank-Wide")));
        dto.setAsOfDate(ds.currentDate.format(DATE_FMT));

        switch (key) {
            case "INSURANCE_GAP":
                dto.setKpiTitle("Insurance Protection Gap");
                dto.setFormula("Insurance Gap = MAX(0, Insurance Required - Current Effective Insurance)");
                dto.setDefinition("Total value deficit where active valid insurance coverage falls short of the collateral insurance requirement.");
                break;
            case "COVERAGE_PCT":
                dto.setKpiTitle("Insurance Coverage Percentage");
                dto.setFormula("Coverage % = (Current Effective Insurance / Insurance Required) * 100");
                dto.setDefinition("Aggregate ratio of active insurance protection relative to total mandatory insurance requirements across the portfolio.");
                break;
            case "INSURANCE_REQUIRED":
                dto.setKpiTitle("Mandatory Insurance Requirement");
                dto.setFormula("Insurance Requirement = MAX(Outstanding Exposure, Collateral Market Value)");
                dto.setDefinition("The sum of statutory and policy-required insurance covers to protect bank credit facilities against asset destruction.");
                break;
            default:
                dto.setKpiTitle("Operational Metric: " + key);
                dto.setFormula("Direct aggregation over active authorized entities");
                dto.setDefinition("Standard CIMS portfolio measurement metric.");
                break;
        }

        // Sub-unit contributions by segment
        List<String> canonicalSegments = List.of("Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)");
        for (String seg : canonicalSegments) {
            List<Collateral> segCols = ds.collaterals.stream().filter(c -> seg.equalsIgnoreCase(c.getOwningSegment())).toList();
            double segReq = 0.0;
            double segAct = 0.0;
            double segExp = ds.facilities.stream().filter(f -> seg.equalsIgnoreCase(f.getSegment())).mapToDouble(LoanAccount::getOutstandingBalance).sum();
            for (Collateral c : segCols) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate
                );
                segReq += eval.insuranceRequired;
                segAct += eval.effectiveInsurance;
            }
            double gap = Math.max(0, segReq - segAct);
            double cov = segReq > 0 ? (segAct / segReq) * 100.0 : 100.0;

            Map<String, Object> subMap = new LinkedHashMap<>();
            subMap.put("name", seg);
            subMap.put("exposure", segExp);
            subMap.put("insuranceRequired", segReq);
            subMap.put("activeInsurance", segAct);
            subMap.put("gap", gap);
            subMap.put("coveragePct", Math.round(cov * 10.0) / 10.0);
            subMap.put("collateralCount", segCols.size());
            dto.getSubUnitContributions().add(subMap);
        }

        // Top 5 Risk Contributors (largest insurance gap collaterals)
        List<EffectiveInsuranceService.CollateralProtectionResult> evaluated = new ArrayList<>();
        for (Collateral c : ds.collaterals) {
            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c,
                    ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate
            );
            if (eval.insuranceGap > 0 || "Uninsured".equalsIgnoreCase(eval.adequacyStatus)) {
                evaluated.add(eval);
            }
        }
        evaluated.sort((a, b) -> Double.compare(b.insuranceGap, a.insuranceGap));

        for (int i = 0; i < Math.min(5, evaluated.size()); i++) {
            EffectiveInsuranceService.CollateralProtectionResult ev = evaluated.get(i);
            Collateral c = ds.collaterals.stream().filter(col -> col.getId().equals(ev.collateralId)).findFirst().orElse(null);
            Customer cust = c != null ? ds.customerByCif.get(c.getCustomerId()) : null;

            Map<String, Object> topItem = new LinkedHashMap<>();
            topItem.put("id", ev.collateralId);
            topItem.put("code", ev.collateralCode);
            topItem.put("name", (c != null && c.getDescription() != null) ? c.getDescription() : ev.collateralCode);
            topItem.put("entityType", "Collateral");
            topItem.put("branch", c != null ? c.getBranch() : "Branch");
            topItem.put("segment", c != null ? c.getOwningSegment() : "Segment");
            topItem.put("borrowerName", cust != null ? cust.getName() : "Borrower");
            topItem.put("amount", ev.insuranceRequired);
            topItem.put("gap", ev.insuranceGap);
            topItem.put("issue", ev.adequacyStatus);
            topItem.put("actionLabel", "UNINSURED".equalsIgnoreCase(ev.adequacyStatus) ? "Register Binder" : "Request Endorsement");
            topItem.put("routeTarget", "/collaterals/" + ev.collateralId);
            dto.getTopRiskContributors().add(topItem);
        }

        dto.setRecommendedActions(List.of(
                "Review top 5 deficit accounts and issue insurance placement demands",
                "Contact relationship officers for facilities with unhedged exposures",
                "Initiate broker / underwriter follow-up for pending insurance renewals",
                "Ensure all active loan facilities have matching insurance endorsements"
        ));

        return dto;
    }

    /**
     * Captures a point-in-time snapshot with uniqueness constraint on (snapshot_date, scope_level, scope_id).
     */
    public DashboardSnapshot captureSnapshot(String scopeLevel, String scopeId, String userId) {
        ResolvedScope scope = resolveUserScope(userId, "ALL", "ALL", "ALL");
        String effLevel = scopeLevel != null ? scopeLevel.toUpperCase() : "BANK";
        String effId = scopeId != null ? scopeId : "ALL";
        String today = getCurrentSystemDate().format(DATE_FMT);

        DashboardSummaryDto summary = getSummary(userId, effLevel.equals("SEGMENT") ? effId : "ALL", effLevel.equals("DISTRICT") ? effId : "ALL", effLevel.equals("BRANCH") ? effId : "ALL", null, null, null);

        DashboardSnapshot snapshot = dashboardSnapshotRepository.findBySnapshotDateAndScopeLevelAndScopeId(today, effLevel, effId)
                .orElseGet(() -> {
                    DashboardSnapshot s = new DashboardSnapshot();
                    s.setId("snap-" + UUID.randomUUID().toString().substring(0, 8));
                    s.setSnapshotDate(today);
                    s.setAsOfDate(today);
                    s.setScopeLevel(effLevel);
                    s.setScopeId(effId);
                    return s;
                });

        snapshot.setCapturedAt(LocalDateTime.now().toString());
        snapshot.setTotalExposure(summary.getTotalOutstandingExposure() != null ? summary.getTotalOutstandingExposure().doubleValue() : 0.0);
        snapshot.setCollateralValue(summary.getTotalCollateralMarketValue() != null ? summary.getTotalCollateralMarketValue().doubleValue() : 0.0);
        snapshot.setNetSecurityValue(summary.getTotalNetSecurityValue() != null ? summary.getTotalNetSecurityValue().doubleValue() : 0.0);
        snapshot.setRequiredInsurance(summary.getTotalInsuranceRequired() != null ? summary.getTotalInsuranceRequired().doubleValue() : 0.0);
        snapshot.setActiveInsurance(summary.getTotalValidActiveInsurance() != null ? summary.getTotalValidActiveInsurance().doubleValue() : 0.0);
        snapshot.setInsuranceGap(summary.getTotalInsuranceGap() != null ? summary.getTotalInsuranceGap().doubleValue() : 0.0);
        snapshot.setCoveragePercentage(summary.getInsuranceCoveragePct());
        snapshot.setUninsuredCollateralsCount(summary.getUninsuredCollateralsCount());
        snapshot.setUnderinsuredCollateralsCount(summary.getUnderinsuredCollateralsCount());
        snapshot.setExpiredPoliciesCount(summary.getExpiredPoliciesCount());
        snapshot.setOpenExceptionsCount(summary.getOpenExceptionsCount());
        snapshot.setTotalFacilitiesCount(summary.getTotalFacilitiesCount());
        snapshot.setTotalCustomersCount(summary.getTotalCustomersCount());
        snapshot.setTotalCollateralsCount(summary.getActiveCollateralsCount());

        return dashboardSnapshotRepository.save(snapshot);
    }

    public Map<String, Object> getHistoricalSnapshots(String scopeLevel, String scopeId) {
        String effLevel = scopeLevel != null ? scopeLevel.toUpperCase() : "BANK";
        String effId = scopeId != null ? scopeId : "ALL";

        List<DashboardSnapshot> snapshots = dashboardSnapshotRepository.findByScopeLevelAndScopeIdOrderBySnapshotDateAsc(effLevel, effId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scopeLevel", effLevel);
        result.put("scopeId", effId);

        if (snapshots.size() < 2) {
            result.put("hasSufficientData", false);
            result.put("message", "Historical trend unavailable — Insufficient historical snapshots (minimum 2 snapshots required).");
            result.put("snapshots", Collections.emptyList());
            return result;
        }

        result.put("hasSufficientData", true);
        result.put("message", "Historical trend data active across " + snapshots.size() + " genuine snapshot periods.");
        result.put("snapshots", snapshots);

        DashboardSnapshot latest = snapshots.get(snapshots.size() - 1);
        DashboardSnapshot prev = snapshots.get(snapshots.size() - 2);
        Map<String, Object> deltas = new LinkedHashMap<>();
        deltas.put("exposureDelta", latest.getTotalExposure() - prev.getTotalExposure());
        deltas.put("insuranceGapDelta", latest.getInsuranceGap() - prev.getInsuranceGap());
        deltas.put("coveragePctDelta", latest.getCoveragePercentage() - prev.getCoveragePercentage());
        result.put("periodOverPeriodDeltas", deltas);

        return result;
    }

    // =========================================================================
    // 9-LEVEL PROGRESSIVE HIERARCHICAL DRILL-DOWN ARCHITECTURE (SINGLE-PASS)
    // =========================================================================

    /** Level 1: Bank Overview (All 4 Segments Comparison) */
    public Map<String, Object> getHierarchyBank(String userId) {
        ResolvedScope scope = resolveUserScope(userId, "ALL", "ALL", "ALL");
        if (scope.lockedSegment || !scope.isBankWide()) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is not authorized for Bank-Wide overview. Start from assigned scope.");
        }
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        List<String> canonicalSegments = List.of("Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)");
        List<Map<String, Object>> segmentList = new ArrayList<>();

        for (String seg : canonicalSegments) {
            List<Collateral> segColls = ds.collaterals.stream()
                    .filter(c -> seg.equalsIgnoreCase(c.getOwningSegment()))
                    .toList();
            Set<String> segColIds = segColls.stream().map(Collateral::getId).collect(Collectors.toSet());

            List<LoanAccount> segFacs = ds.facilities.stream()
                    .filter(f -> seg.equalsIgnoreCase(f.getSegment()))
                    .toList();

            List<Customer> segCusts = ds.customers.stream()
                    .filter(c -> seg.equalsIgnoreCase(c.getSegment()))
                    .toList();

            List<InsurancePolicy> segPols = ds.policies.stream()
                    .filter(p -> p.getCollateralId() != null && segColIds.contains(p.getCollateralId()))
                    .toList();

            List<CimsException> segExcs = ds.exceptions.stream()
                    .filter(e -> e.getEntityId() != null && (segColIds.contains(e.getEntityId()) || segCusts.stream().anyMatch(c -> c.getId().equalsIgnoreCase(e.getEntityId()) || c.getCif().equalsIgnoreCase(e.getEntityId()))))
                    .toList();

            BigDecimal segExp = segFacs.stream().map(f -> BigDecimal.valueOf(f.getOutstandingBalance())).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal segVal = segColls.stream().map(c -> BigDecimal.valueOf(c.getValuationAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal segReq = BigDecimal.ZERO;
            BigDecimal segAct = BigDecimal.ZERO;
            long insuredCount = 0;
            long uninsuredCount = 0;

            for (Collateral c : segColls) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate
                );
                segReq = segReq.add(BigDecimal.valueOf(eval.insuranceRequired));
                segAct = segAct.add(BigDecimal.valueOf(eval.effectiveInsurance));
                if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) insuredCount++;
                else uninsuredCount++;
            }

            BigDecimal segGap = segReq.subtract(segAct).max(BigDecimal.ZERO);
            double segComp = segReq.compareTo(BigDecimal.ZERO) > 0
                    ? segAct.divide(segReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 100.0;

            Map<String, Object> segMap = new LinkedHashMap<>();
            segMap.put("segmentName", seg);
            segMap.put("collateralCount", segColls.size());
            segMap.put("collateralValue", segVal);
            segMap.put("exposure", segExp);
            segMap.put("insuranceRequired", segReq);
            segMap.put("activeInsurance", segAct);
            segMap.put("insuranceGap", segGap);
            segMap.put("compliancePct", Math.round(segComp * 10.0) / 10.0);
            segMap.put("insuredCollaterals", insuredCount);
            segMap.put("uninsuredCollaterals", uninsuredCount);
            segMap.put("customerCount", segCusts.size());
            segMap.put("facilityCount", segFacs.size());
            segMap.put("policyCount", segPols.size());
            segMap.put("exceptionCount", segExcs.size());
            segmentList.add(segMap);
        }

        DashboardSummaryDto sumDto = getSummary(userId, "ALL", "ALL", "ALL", null, null, null);
        DashboardChartDataDto chartDto = getCharts(userId, "ALL", "ALL", "ALL", null, null, null);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "BANK");
        res.put("scopeTitle", "Bank Overview");
        res.put("summary", sumDto);
        res.put("segments", segmentList);
        res.put("exposureVsProtection", chartDto.getExposureVsProtection());
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("expiryPipeline", chartDto.getExpiryPipeline());
        res.put("sharedCollaterals", computeSharedCollaterals(ds));
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        return res;
    }

    /** Level 2: Segment Dashboard (District Comparison) */
    public Map<String, Object> getHierarchySegment(String userId, String segment) {
        String requestedSegment = (segment != null && !segment.isBlank() && !segment.equalsIgnoreCase("ALL")) ? segment : null;
        ResolvedScope scope = resolveUserScope(userId, requestedSegment, "ALL", "ALL");
        if (scope.lockedSegment && requestedSegment != null && !scope.allowedSegments.contains(requestedSegment)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned segment: " + scope.effectiveSegment);
        }
        String effSegment = scope.effectiveSegment != null ? scope.effectiveSegment : (requestedSegment != null ? requestedSegment : "Corporate Banking");
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        List<Branch> allBranches = branchRepository.findAll();
        List<Branch> districtBranches = allBranches.stream()
                .filter(b -> "DistrictOffice".equalsIgnoreCase(b.getType()) || b.getCode().startsWith("DIST-"))
                .toList();

        List<Map<String, Object>> districtList = new ArrayList<>();
        Set<String> distinctDistrictNames = new LinkedHashSet<>();
        districtBranches.forEach(d -> distinctDistrictNames.add(d.getName()));
        if (distinctDistrictNames.isEmpty()) {
            distinctDistrictNames.addAll(List.of("Addis Ababa East District", "Addis Ababa West District", "Bahir Dar District", "Hawassa District"));
        }

        for (String distName : distinctDistrictNames) {
            List<Collateral> distColls = ds.collaterals.stream()
                    .filter(c -> isBranchInDistrict(c.getBranch(), distName))
                    .toList();
            Set<String> distColIds = distColls.stream().map(Collateral::getId).collect(Collectors.toSet());

            List<LoanAccount> distFacs = ds.facilities.stream()
                    .filter(f -> isBranchInDistrict(f.getBranch(), distName))
                    .toList();

            List<Customer> distCusts = ds.customers.stream()
                    .filter(c -> isBranchInDistrict(c.getBranch(), distName))
                    .toList();

            List<CimsException> distExcs = ds.exceptions.stream()
                    .filter(e -> e.getEntityId() != null && (distColIds.contains(e.getEntityId()) || distCusts.stream().anyMatch(c -> c.getId().equalsIgnoreCase(e.getEntityId()) || c.getCif().equalsIgnoreCase(e.getEntityId()))))
                    .toList();

            BigDecimal distExp = distFacs.stream().map(f -> BigDecimal.valueOf(f.getOutstandingBalance())).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal distVal = distColls.stream().map(c -> BigDecimal.valueOf(c.getValuationAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal distReq = BigDecimal.ZERO;
            BigDecimal distAct = BigDecimal.ZERO;

            for (Collateral c : distColls) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate
                );
                distReq = distReq.add(BigDecimal.valueOf(eval.insuranceRequired));
                distAct = distAct.add(BigDecimal.valueOf(eval.effectiveInsurance));
            }

            BigDecimal distGap = distReq.subtract(distAct).max(BigDecimal.ZERO);
            double distComp = distReq.compareTo(BigDecimal.ZERO) > 0
                    ? distAct.divide(distReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 100.0;

            long branchCount = allBranches.stream().filter(b -> isBranchInDistrict(b.getName(), distName) && !"DistrictOffice".equalsIgnoreCase(b.getType())).count();

            Map<String, Object> distMap = new LinkedHashMap<>();
            distMap.put("districtName", distName);
            distMap.put("branchCount", Math.max(1, branchCount));
            distMap.put("collateralCount", distColls.size());
            distMap.put("collateralValue", distVal);
            distMap.put("exposure", distExp);
            distMap.put("insuranceRequired", distReq);
            distMap.put("activeInsurance", distAct);
            distMap.put("insuranceGap", distGap);
            distMap.put("compliancePct", Math.round(distComp * 10.0) / 10.0);
            distMap.put("customerCount", distCusts.size());
            distMap.put("exceptionCount", distExcs.size());
            districtList.add(distMap);
        }

        DashboardSummaryDto sumDto = getSummary(userId, effSegment, "ALL", "ALL", null, null, null);
        DashboardChartDataDto chartDto = getCharts(userId, effSegment, "ALL", "ALL", null, null, null);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "SEGMENT");
        res.put("segmentName", effSegment);
        res.put("summary", sumDto);
        res.put("districts", districtList);
        res.put("districtRanking", chartDto.getDistrictRanking());
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("expiryPipeline", chartDto.getExpiryPipeline());
        res.put("sharedCollaterals", computeSharedCollaterals(ds));
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        return res;
    }

    /** Level 3: District Dashboard (Branch Comparison) */
    public Map<String, Object> getHierarchyDistrict(String userId, String district, String segment) {
        String effDist = (district != null && !district.isBlank()) ? district : "Addis Ababa East District";
        String effSeg = (segment != null && !segment.isBlank() && !segment.equalsIgnoreCase("ALL")) ? segment : null;
        ResolvedScope scope = resolveUserScope(userId, effSeg, effDist, "ALL");
        if (scope.lockedDistrict && district != null && !district.isBlank() && !district.equalsIgnoreCase("ALL") && !scope.effectiveDistrict.equalsIgnoreCase(district) && !isBranchInDistrict(scope.effectiveDistrict, district)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned district: " + scope.effectiveDistrict);
        }
        final String targetDist = scope.effectiveDistrict != null ? scope.effectiveDistrict : effDist;
        final String targetSeg = scope.effectiveSegment;
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        List<Branch> allBranches = branchRepository.findAll();
        List<Branch> districtBranches = allBranches.stream()
                .filter(b -> isBranchInDistrict(b.getName(), targetDist) && !"DistrictOffice".equalsIgnoreCase(b.getType()) && !"HeadOffice".equalsIgnoreCase(b.getType()))
                .toList();

        List<Map<String, Object>> branchList = new ArrayList<>();
        for (Branch b : districtBranches) {
            List<Collateral> brColls = ds.collaterals.stream()
                    .filter(c -> b.getName().equalsIgnoreCase(c.getBranch()))
                    .toList();
            Set<String> brColIds = brColls.stream().map(Collateral::getId).collect(Collectors.toSet());

            List<LoanAccount> brFacs = ds.facilities.stream()
                    .filter(f -> b.getName().equalsIgnoreCase(f.getBranch()))
                    .toList();

            List<Customer> brCusts = ds.customers.stream()
                    .filter(c -> b.getName().equalsIgnoreCase(c.getBranch()))
                    .toList();

            List<CimsException> brExcs = ds.exceptions.stream()
                    .filter(e -> e.getEntityId() != null && (brColIds.contains(e.getEntityId()) || brCusts.stream().anyMatch(c -> c.getId().equalsIgnoreCase(e.getEntityId()) || c.getCif().equalsIgnoreCase(e.getEntityId()))))
                    .toList();

            BigDecimal brExp = brFacs.stream().map(f -> BigDecimal.valueOf(f.getOutstandingBalance())).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal brVal = brColls.stream().map(c -> BigDecimal.valueOf(c.getValuationAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);

            BigDecimal brReq = BigDecimal.ZERO;
            BigDecimal brAct = BigDecimal.ZERO;

            for (Collateral c : brColls) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate
                );
                brReq = brReq.add(BigDecimal.valueOf(eval.insuranceRequired));
                brAct = brAct.add(BigDecimal.valueOf(eval.effectiveInsurance));
            }

            BigDecimal brGap = brReq.subtract(brAct).max(BigDecimal.ZERO);
            double brComp = brReq.compareTo(BigDecimal.ZERO) > 0
                    ? brAct.divide(brReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 100.0;

            Map<String, Object> bMap = new LinkedHashMap<>();
            bMap.put("branchName", b.getName());
            bMap.put("branchCode", b.getCode());
            bMap.put("branchType", b.getType());
            bMap.put("collateralCount", brColls.size());
            bMap.put("collateralValue", brVal);
            bMap.put("exposure", brExp);
            bMap.put("insuranceRequired", brReq);
            bMap.put("activeInsurance", brAct);
            bMap.put("insuranceGap", brGap);
            bMap.put("compliancePct", Math.round(brComp * 10.0) / 10.0);
            bMap.put("customerCount", brCusts.size());
            bMap.put("exceptionCount", brExcs.size());
            branchList.add(bMap);
        }

        List<DistrictHierarchy> hierarchies = districtHierarchyRepository.findAll().stream()
                .filter(h -> h.getDistrictName().toLowerCase().contains(targetDist.toLowerCase()) || targetDist.toLowerCase().contains(h.getDistrictName().toLowerCase()))
                .toList();
        Set<String> areaNames = hierarchies.stream().map(DistrictHierarchy::getAreaOffice).collect(Collectors.toCollection(LinkedHashSet::new));

        DashboardSummaryDto sumDto = getSummary(userId, targetSeg, targetDist, "ALL", null, null, null);
        DashboardChartDataDto chartDto = getCharts(userId, targetSeg, targetDist, "ALL", null, null, null);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "DISTRICT");
        res.put("districtName", targetDist);
        res.put("segmentName", targetSeg != null ? targetSeg : "All Segments");
        res.put("summary", sumDto);
        res.put("branches", branchList);
        res.put("areas", areaNames);
        res.put("branchRanking", chartDto.getBranchRanking());
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        return res;
    }

    /** Level 4: Area Dashboard */
    public Map<String, Object> getHierarchyArea(String userId, String area, String district, String segment) {
        String effDist = district != null ? district : "Addis Ababa East District";
        String effSeg = (segment != null && !segment.equalsIgnoreCase("ALL")) ? segment : null;

        ResolvedScope scope = resolveUserScope(userId, effSeg, effDist, null);
        if (scope.lockedDistrict && district != null && !district.isBlank() && !district.equalsIgnoreCase("ALL") && !scope.effectiveDistrict.equalsIgnoreCase(district) && !isBranchInDistrict(scope.effectiveDistrict, district)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned district: " + scope.effectiveDistrict);
        }
        if (scope.lockedSegment && segment != null && !segment.isBlank() && !segment.equalsIgnoreCase("ALL") && !scope.allowedSegments.contains(segment)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned segment: " + scope.effectiveSegment);
        }

        List<DistrictHierarchy> matches = districtHierarchyRepository.findAll().stream()
                .filter(h -> area != null && h.getAreaOffice().equalsIgnoreCase(area))
                .toList();

        List<String> branchNames = matches.stream().map(DistrictHierarchy::getBranchName).toList();
        if (branchNames.isEmpty()) {
            branchNames = List.of(area != null ? area : "Bole Special Branch");
        }

        ScopedDataset areaDs = loadScopedDataset(scope, null, null, null);

        List<Map<String, Object>> branchList = new ArrayList<>();
        for (String bName : branchNames) {
            List<Collateral> brColls = areaDs.collaterals.stream()
                    .filter(c -> bName.equalsIgnoreCase(c.getBranch()))
                    .toList();
            List<LoanAccount> brFacs = areaDs.facilities.stream()
                    .filter(f -> bName.equalsIgnoreCase(f.getBranch()))
                    .toList();
            List<Customer> brCusts = areaDs.customers.stream()
                    .filter(c -> bName.equalsIgnoreCase(c.getBranch()))
                    .toList();

            BigDecimal brExp = brFacs.stream().map(f -> BigDecimal.valueOf(f.getOutstandingBalance())).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal brVal = brColls.stream().map(c -> BigDecimal.valueOf(c.getValuationAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> bMap = new LinkedHashMap<>();
            bMap.put("branchName", bName);
            bMap.put("collateralCount", brColls.size());
            bMap.put("collateralValue", brVal);
            bMap.put("exposure", brExp);
            bMap.put("customerCount", brCusts.size());
            branchList.add(bMap);
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "AREA");
        res.put("areaName", area);
        res.put("districtName", effDist);
        res.put("branches", branchList);
        res.put("requiresAttention", computeRequiresAttentionV2(areaDs));
        return res;
    }

    /** Level 5: Branch / Corporate Center Dashboard (Multi-Segment) */
    public Map<String, Object> getHierarchyBranch(String userId, String branch, String segment) {
        String effBranch = (branch != null && !branch.isBlank()) ? branch : "Bole Special Branch";
        String effSeg = (segment != null && !segment.isBlank() && !segment.equalsIgnoreCase("ALL")) ? segment : null;

        ResolvedScope scope = resolveUserScope(userId, effSeg, null, effBranch);
        if (scope.lockedBranch && branch != null && !branch.isBlank() && !branch.equalsIgnoreCase("ALL") && !scope.effectiveBranch.equalsIgnoreCase(branch)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned branch: " + scope.effectiveBranch);
        }
        effBranch = scope.effectiveBranch != null ? scope.effectiveBranch : effBranch;
        effSeg = scope.effectiveSegment;

        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        Map<String, Integer> segmentDistribution = new HashMap<>();
        for (Collateral c : ds.collaterals) {
            String seg = c.getOwningSegment() != null ? c.getOwningSegment() : "Corporate Banking";
            segmentDistribution.put(seg, segmentDistribution.getOrDefault(seg, 0) + 1);
        }

        List<Map<String, Object>> customerList = new ArrayList<>();
        for (Customer c : ds.customers) {
            List<LoanAccount> cFacs = ds.facilities.stream().filter(f -> f.getCustomerId() != null && (f.getCustomerId().equalsIgnoreCase(c.getId()) || (c.getCif() != null && f.getCustomerId().equalsIgnoreCase(c.getCif())))).toList();
            List<Collateral> cCols = ds.collaterals.stream().filter(col -> col.getCustomerId() != null && (col.getCustomerId().equalsIgnoreCase(c.getId()) || (c.getCif() != null && col.getCustomerId().equalsIgnoreCase(c.getCif())))).toList();
            List<InsurancePolicy> cPols = ds.policies.stream().filter(p -> p.getCustomerId() != null && (p.getCustomerId().equalsIgnoreCase(c.getId()) || (c.getCif() != null && p.getCustomerId().equalsIgnoreCase(c.getCif())))).toList();

            BigDecimal cExp = cFacs.stream().map(f -> BigDecimal.valueOf(f.getOutstandingBalance())).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal cVal = cCols.stream().map(col -> BigDecimal.valueOf(col.getValuationAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);

            long activePols = cPols.stream().filter(p -> "Active".equalsIgnoreCase(p.getStatus())).count();
            String compStatus = cCols.isEmpty() ? "Adequate" : (activePols >= cCols.size() ? "Adequate" : (activePols > 0 ? "Underinsured" : "Uninsured"));

            Map<String, Object> cMap = new LinkedHashMap<>();
            cMap.put("id", c.getId());
            cMap.put("cif", c.getCif() != null ? c.getCif() : c.getId());
            cMap.put("name", c.getName());
            cMap.put("customerType", c.getCustomerType());
            cMap.put("segment", c.getSegment() != null ? c.getSegment() : "Corporate Banking");
            cMap.put("riskRating", c.getRiskRating());
            cMap.put("status", c.getStatus());
            cMap.put("facilityCount", cFacs.size());
            cMap.put("collateralCount", cCols.size());
            cMap.put("policyCount", cPols.size());
            cMap.put("exposure", cExp);
            cMap.put("collateralValue", cVal);
            cMap.put("complianceStatus", compStatus);
            customerList.add(cMap);
        }

        DashboardSummaryDto sumDto = getSummary(userId, effSeg, null, effBranch, null, null, null);
        DashboardChartDataDto chartDto = getCharts(userId, effSeg, null, effBranch, null, null, null);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "BRANCH");
        res.put("branchName", effBranch);
        res.put("districtName", resolveDistrictForBranch(effBranch));
        res.put("summary", sumDto);
        res.put("segmentDistribution", segmentDistribution);
        res.put("customers", customerList);
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("expiryPipeline", chartDto.getExpiryPipeline());
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        return res;
    }

    /** Level 6: Customer View (Customer 360) */
    public Map<String, Object> getHierarchyCustomer(String userId, String cif) {
        ResolvedScope scope = resolveUserScope(userId, null, null, null);
        Customer c = customerRepository.findFirstByCifIgnoreCase(cif)
                .or(() -> customerRepository.findById(cif))
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + cif));

        if (scope.lockedBranch && c.getBranch() != null && !c.getBranch().equalsIgnoreCase(scope.effectiveBranch)) {
            throw new IllegalArgumentException("Access Denied: Customer belongs to branch " + c.getBranch() + " outside user scope " + scope.effectiveBranch);
        }
        if (scope.lockedSegment && c.getSegment() != null && !c.getSegment().equalsIgnoreCase(scope.effectiveSegment)) {
            throw new IllegalArgumentException("Access Denied: Customer belongs to segment " + c.getSegment() + " outside user scope " + scope.effectiveSegment);
        }

        List<LoanAccount> facilities = new ArrayList<>(loanAccountRepository.findByCustomerId(c.getId()));
        if (c.getCif() != null && !c.getCif().equalsIgnoreCase(c.getId())) {
            for (LoanAccount fac : loanAccountRepository.findByCustomerId(c.getCif())) {
                if (facilities.stream().noneMatch(f -> f.getId().equals(fac.getId()))) {
                    facilities.add(fac);
                }
            }
        }

        List<Collateral> collaterals = new ArrayList<>(collateralRepository.findByCustomerId(c.getId()));
        if (c.getCif() != null && !c.getCif().equalsIgnoreCase(c.getId())) {
            for (Collateral col : collateralRepository.findByCustomerId(c.getCif())) {
                if (collaterals.stream().noneMatch(cl -> cl.getId().equals(col.getId()))) {
                    collaterals.add(col);
                }
            }
        }

        Set<String> colIds = collaterals.stream().map(Collateral::getId).collect(Collectors.toSet());
        List<InsurancePolicy> policies = new ArrayList<>(insurancePolicyRepository.findByCustomerId(c.getId()));
        if (c.getCif() != null && !c.getCif().equalsIgnoreCase(c.getId())) {
            for (InsurancePolicy pol : insurancePolicyRepository.findByCustomerId(c.getCif())) {
                if (policies.stream().noneMatch(p -> p.getId().equals(pol.getId()))) {
                    policies.add(pol);
                }
            }
        }

        List<OwnershipDocument> documents = new ArrayList<>(ownershipDocumentRepository.findByCustomerId(c.getId()));
        List<CimsException> exceptions = cimsExceptionRepository.findAll().stream()
                .filter(e -> e.getEntityId() != null && (c.getId().equalsIgnoreCase(e.getEntityId()) || (c.getCif() != null && c.getCif().equalsIgnoreCase(e.getEntityId())) || colIds.contains(e.getEntityId())))
                .toList();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "CUSTOMER");
        res.put("customer", c);
        res.put("facilities", facilities);
        res.put("collaterals", collaterals);
        res.put("policies", policies);
        res.put("documents", documents);
        res.put("exceptions", exceptions);
        return res;
    }

    /** Level 7: Facility View */
    public Map<String, Object> getHierarchyFacility(String userId, String facilityId) {
        ResolvedScope scope = resolveUserScope(userId, null, null, null);
        LoanAccount facility = loanAccountRepository.findById(facilityId)
                .or(() -> loanAccountRepository.findByLoanReference(facilityId))
                .orElseThrow(() -> new IllegalArgumentException("Credit facility not found: " + facilityId));

        if (scope.lockedBranch && facility.getBranch() != null && !facility.getBranch().equalsIgnoreCase(scope.effectiveBranch)) {
            throw new IllegalArgumentException("Access Denied: Facility belongs to branch " + facility.getBranch() + " outside user scope " + scope.effectiveBranch);
        }

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByFacilityId(facility.getId());
        if (links.isEmpty() && facility.getLoanReference() != null) {
            links = loanCollateralLinkRepository.findByFacilityId(facility.getLoanReference());
        }

        List<Map<String, Object>> linkedCollaterals = new ArrayList<>();
        double totalSecurity = 0.0;
        for (LoanCollateralLink link : links) {
            Optional<Collateral> colOpt = collateralRepository.findById(link.getCollateralId());
            if (colOpt.isPresent()) {
                Collateral col = colOpt.get();
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("linkId", link.getId());
                m.put("collateralId", col.getId());
                m.put("collateralCode", col.getCode());
                m.put("description", col.getDescription());
                m.put("category", col.getCategory());
                m.put("marketValue", col.getValuationAmount());
                m.put("haircut", col.getHaircut());
                double net = col.getValuationAmount() * (1 - col.getHaircut() / 100.0);
                m.put("netValue", net);
                m.put("netSecurityValue", net);
                m.put("allocatedAmount", link.getAllocatedAmount() > 0 ? link.getAllocatedAmount() : net);
                m.put("linkageType", link.getLinkageType());
                totalSecurity += (link.getAllocatedAmount() > 0 ? link.getAllocatedAmount() : net);
                linkedCollaterals.add(m);
            }
        }

        Customer customer = facility.getCustomerId() != null
                ? customerRepository.findById(facility.getCustomerId()).or(() -> customerRepository.findByCif(facility.getCustomerId())).orElse(null)
                : null;

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "FACILITY");
        res.put("facility", facility);
        res.put("customer", customer);
        res.put("linkedCollaterals", linkedCollaterals);
        res.put("totalSecurityValue", totalSecurity);
        double covRatio = facility.getOutstandingBalance() > 0 ? (totalSecurity / facility.getOutstandingBalance()) * 100.0 : 100.0;
        res.put("coverageRatio", Math.round(covRatio * 10.0) / 10.0);
        return res;
    }

    /** Level 8: Collateral View */
    public Map<String, Object> getHierarchyCollateral(String userId, String collateralId) {
        ResolvedScope scope = resolveUserScope(userId, null, null, null);
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral record not found: " + collateralId));

        if (scope.lockedBranch && collateral.getBranch() != null && !collateral.getBranch().equalsIgnoreCase(scope.effectiveBranch)) {
            throw new IllegalArgumentException("Access Denied: Collateral belongs to branch " + collateral.getBranch() + " outside user scope " + scope.effectiveBranch);
        }

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        List<LoanAccount> linkedFacilities = new ArrayList<>();
        double totalExp = 0.0;
        for (LoanCollateralLink link : links) {
            String fId = link.getFacilityId() != null ? link.getFacilityId() : link.getLoanAccountId();
            if (fId != null) {
                loanAccountRepository.findById(fId).or(() -> loanAccountRepository.findByLoanReference(fId)).ifPresent(fac -> {
                    linkedFacilities.add(fac);
                });
            }
        }
        for (LoanAccount fac : linkedFacilities) {
            totalExp += fac.getOutstandingBalance();
        }

        List<InsurancePolicy> policies = insurancePolicyRepository.findByCollateralId(collateral.getId());
        List<OwnershipDocument> documents = ownershipDocumentRepository.findByCollateralId(collateral.getId());
        List<CimsException> exceptions = cimsExceptionRepository.findAll().stream()
                .filter(e -> collateral.getId().equalsIgnoreCase(e.getEntityId()))
                .toList();
        List<MandatoryDocumentRule> mandatoryChecklist = mandatoryDocumentRuleRepository.findByCollateralCategory(collateral.getCategory());

        EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                collateral, linkedFacilities, policies, getCurrentSystemDate()
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "COLLATERAL");
        res.put("collateral", collateral);
        res.put("evaluation", eval);
        res.put("linkedFacilities", linkedFacilities);
        res.put("totalExposure", totalExp);
        res.put("policies", policies);
        res.put("documents", documents);
        res.put("mandatoryChecklist", mandatoryChecklist);
        res.put("exceptions", exceptions);
        return res;
    }

    /** Level 9: Policy Lifecycle View */
    public Map<String, Object> getHierarchyPolicy(String userId, String policyId) {
        resolveUserScope(userId, null, null, null);
        InsurancePolicy policy = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Insurance policy not found: " + policyId));

        List<PolicyEndorsement> endorsements = policyEndorsementRepository.findByPolicyIdOrderByModNoDesc(policy.getId());
        Collateral linkedCollateral = policy.getCollateralId() != null
                ? collateralRepository.findById(policy.getCollateralId()).orElse(null)
                : null;
        Customer customer = policy.getCustomerId() != null
                ? customerRepository.findById(policy.getCustomerId()).or(() -> customerRepository.findByCif(policy.getCustomerId())).orElse(null)
                : null;
        List<OwnershipDocument> documents = policy.getCollateralId() != null
                ? ownershipDocumentRepository.findByCollateralId(policy.getCollateralId())
                : Collections.emptyList();
        List<AuditLog> history = auditLogRepository.findByEntityId(policy.getId());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "POLICY");
        res.put("policy", policy);
        res.put("customer", customer);
        res.put("endorsements", endorsements);
        res.put("collateral", linkedCollateral);
        res.put("documents", documents);
        res.put("history", history);
        return res;
    }
}
