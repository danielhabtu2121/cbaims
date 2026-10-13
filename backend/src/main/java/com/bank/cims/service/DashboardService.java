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
            allSegments = customerRepository.findAll().stream()
                    .map(Customer::getSegment)
                    .filter(s -> s != null && !s.isBlank())
                    .distinct()
                    .toList();
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
                .filter(b -> "DistrictOffice".equalsIgnoreCase(b.getType()) || (b.getCode() != null && b.getCode().startsWith("DIST-")))
                .map(Branch::getName)
                .distinct()
                .toList();
        if (allDistrictNames.isEmpty()) {
            allDistrictNames = allBranches.stream()
                    .map(Branch::getParentDistrictId)
                    .filter(Objects::nonNull)
                    .map(id -> branchRepository.findById(id).map(Branch::getName).orElse(null))
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
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
                if (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL") && scope.allowedSegments.contains(reqSegment)) {
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
                String resolvedDist = resolveDistrictForBranch(user.getBranch());
                final String assignedDistrict = (resolvedDist != null) ? resolvedDist : user.getBranch();
                scope.effectiveDistrict = assignedDistrict;
                scope.lockedSegment = false;
                scope.lockedDistrict = true;

                if (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL") && isBranchInDistrict(reqBranch, assignedDistrict)) {
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

    public static String normalizeSegmentName(String segment) {
        if (segment == null || segment.isBlank()) return "";
        String s = segment.trim();
        if (s.equalsIgnoreCase("IFB") || s.equalsIgnoreCase("Interest-Free") || s.equalsIgnoreCase("Interest-Free Banking") || s.equalsIgnoreCase("Interest Free Banking") || s.equalsIgnoreCase("Interest-Free Banking (IFB)")) {
            return "Interest-Free Banking (IFB)";
        }
        if (s.equalsIgnoreCase("MSME") || s.equalsIgnoreCase("SME") || s.equalsIgnoreCase("MSME Banking")) {
            return "MSME Banking";
        }
        if (s.equalsIgnoreCase("Retail") || s.equalsIgnoreCase("Retail Banking")) {
            return "Retail Banking";
        }
        if (s.equalsIgnoreCase("Corporate") || s.equalsIgnoreCase("Corporate Banking")) {
            return "Corporate Banking";
        }
        return s;
    }

    public static boolean isSegmentMatch(String seg1, String seg2) {
        if (seg1 == null || seg2 == null) return false;
        if (seg1.equalsIgnoreCase(seg2)) return true;
        String n1 = normalizeSegmentName(seg1);
        String n2 = normalizeSegmentName(seg2);
        return !n1.isEmpty() && n1.equalsIgnoreCase(n2);
    }

    public void checkLeafEntityAccess(ResolvedScope scope, String branch, String segment) {
        if (scope.lockedBranch) {
            if (branch != null && !branch.equalsIgnoreCase(scope.effectiveBranch)) {
                throw new IllegalArgumentException("Access Denied: Record belongs to branch '" + branch + "' outside user authorized branch: " + scope.effectiveBranch);
            }
        }
        if (scope.lockedDistrict) {
            if (branch != null && !isBranchInDistrict(branch, scope.effectiveDistrict)) {
                throw new IllegalArgumentException("Access Denied: Record belongs to branch '" + branch + "' outside user authorized district: " + scope.effectiveDistrict);
            }
        }
        if (scope.lockedSegment) {
            if (segment != null && scope.allowedSegments.stream().noneMatch(s -> isSegmentMatch(s, segment)) && !isSegmentMatch(segment, scope.effectiveSegment)) {
                throw new IllegalArgumentException("Access Denied: Record belongs to segment '" + segment + "' outside user authorized segment: " + scope.effectiveSegment);
            }
        }
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
        public Map<String, List<LoanCollateralLink>> linksByFacilityId = new HashMap<>();
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

        // 1. Scoped entity retrieval
        List<Collateral> allCollaterals;
        List<Customer> allCustomers;
        List<LoanAccount> allFacilities;

        if (scope.effectiveBranch != null && !scope.effectiveBranch.equalsIgnoreCase("ALL")) {
            allCollaterals = collateralRepository.findByBranch(scope.effectiveBranch);
            allCustomers = customerRepository.findByBranch(scope.effectiveBranch);
            allFacilities = loanAccountRepository.findByBranch(scope.effectiveBranch);
        } else if (scope.effectiveDistrict != null && !scope.effectiveDistrict.equalsIgnoreCase("ALL")) {
            List<String> brs = branchRepository.findAll().stream()
                    .filter(b -> isBranchInDistrict(b.getName(), scope.effectiveDistrict))
                    .map(Branch::getName)
                    .toList();
            allCollaterals = brs.isEmpty() ? collateralRepository.findAll() : collateralRepository.findByBranchIn(brs);
            allCustomers = brs.isEmpty() ? customerRepository.findAll() : customerRepository.findByBranchIn(brs);
            allFacilities = brs.isEmpty() ? loanAccountRepository.findAll() : loanAccountRepository.findByBranchIn(brs);
        } else if (scope.effectiveSegment != null && !scope.effectiveSegment.equalsIgnoreCase("ALL")) {
            allCollaterals = collateralRepository.findByOwningSegment(scope.effectiveSegment);
            allCustomers = customerRepository.findBySegment(scope.effectiveSegment);
            allFacilities = loanAccountRepository.findBySegment(scope.effectiveSegment);
        } else {
            allCollaterals = collateralRepository.findAll();
            allCustomers = customerRepository.findAll();
            allFacilities = loanAccountRepository.findAll();
        }

        List<LoanCollateralLink> allLinks = loanCollateralLinkRepository.findAll();
        List<InsurancePolicy> allPolicies = insurancePolicyRepository.findAll();

        // High-scale optimization: load lightweight document summaries without base64 binary fileContent
        List<OwnershipDocument> allDocs = ownershipDocumentRepository.findAllSummaries().stream().map(s -> {
            OwnershipDocument d = new OwnershipDocument();
            d.setId(s.getId());
            d.setEntityType(s.getEntityType());
            d.setEntityId(s.getEntityId());
            d.setCollateralId(s.getCollateralId());
            d.setName(s.getName());
            d.setType(s.getType());
            d.setVerificationStatus(s.getVerificationStatus());
            d.setStatus(s.getStatus());
            d.setExpiryDate(s.getExpiryDate());
            d.setVersion(s.getVersion());
            d.setLatest(s.isLatest());
            return d;
        }).toList();

        List<CimsException> allExceptions = cimsExceptionRepository.findAll();
        List<WorkflowTask> allTasks = workflowTaskRepository.findAll();

        allFacilities.forEach(f -> {
            if (f.getId() != null) ds.facilityById.put(f.getId(), f);
            if (f.getLoanReference() != null) ds.facilityById.put(f.getLoanReference(), f);
        });
        allCustomers.forEach(c -> {
            if (c.getCif() != null) ds.customerByCif.put(c.getCif(), c);
            if (c.getId() != null) ds.customerByCif.put(c.getId(), c);
        });

        ds.collaterals = allCollaterals.stream().filter(c -> {
            if (scope.effectiveSegment != null && !scope.effectiveSegment.equalsIgnoreCase("ALL")) {
                if (c.getOwningSegment() != null && !isSegmentMatch(c.getOwningSegment(), scope.effectiveSegment)) return false;
            } else if (!scope.allowedSegments.isEmpty()) {
                if (c.getOwningSegment() != null && scope.allowedSegments.stream().noneMatch(s -> isSegmentMatch(s, c.getOwningSegment()))) return false;
            }

            if (scope.effectiveDistrict != null && !scope.effectiveDistrict.equalsIgnoreCase("ALL")) {
                String colBranch = c.getBranch();
                if (colBranch != null && !isBranchInDistrict(colBranch, scope.effectiveDistrict)) return false;
            }

            if (scope.effectiveBranch != null && !scope.effectiveBranch.equalsIgnoreCase("ALL")) {
                if (c.getBranch() != null && !c.getBranch().equalsIgnoreCase(scope.effectiveBranch)) return false;
            }

            // RM/RO/SRM/BRM portfolio scope: check actual portfolio assignment data, DO NOT equate to entire branch (§6)
            if (scope.portfolioOwner != null) {
                String uId = scope.user != null && scope.user.getId() != null ? scope.user.getId().toLowerCase() : "";
                String uName = scope.user != null && scope.user.getUsername() != null ? scope.user.getUsername().toLowerCase() : "";
                String uFull = scope.user != null && scope.user.getFullName() != null ? scope.user.getFullName().toLowerCase() : "";

                boolean matches = false;
                if (c.getMakerId() != null) {
                    String m = c.getMakerId().toLowerCase();
                    if (m.equals(uId) || m.equals(uName) || m.equals(uFull)) matches = true;
                }
                if (!matches && c.getCustomerId() != null) {
                    Customer cust = ds.customerByCif.get(c.getCustomerId());
                    if (cust != null && cust.getMakerId() != null) {
                        String cm = cust.getMakerId().toLowerCase();
                        if (cm.equals(uId) || cm.equals(uName) || cm.equals(uFull)) matches = true;
                    }
                }
                if (!matches) {
                    List<LoanCollateralLink> cLinks = allLinks.stream()
                            .filter(l -> l.getCollateralId() != null && (l.getCollateralId().equalsIgnoreCase(c.getId()) || (c.getCode() != null && l.getCollateralId().equalsIgnoreCase(c.getCode()))))
                            .toList();
                    for (LoanCollateralLink cl : cLinks) {
                        String fid = cl.getFacilityId() != null ? cl.getFacilityId() : cl.getLoanAccountId();
                        LoanAccount fac = ds.facilityById.get(fid);
                        if (fac != null && fac.getRmUserId() != null) {
                            String rm = fac.getRmUserId().toLowerCase();
                            if (rm.equals(uId) || rm.equals(uName) || rm.equals(uFull)) {
                                matches = true;
                                break;
                            }
                        }
                    }
                }
                if (!matches) return false;
            }

            if (categoryFilter != null && !categoryFilter.equalsIgnoreCase("ALL")) {
                if (c.getCategory() == null || !c.getCategory().equalsIgnoreCase(categoryFilter)) return false;
            }

            return true;
        }).collect(Collectors.toList());

        Map<String, String> colIdentifierToId = new HashMap<>();
        Set<String> scopedCollateralIdentifiers = new HashSet<>();
        for (Collateral c : ds.collaterals) {
            if (c.getId() != null) {
                colIdentifierToId.put(c.getId(), c.getId());
                scopedCollateralIdentifiers.add(c.getId());
            }
            if (c.getCode() != null) {
                colIdentifierToId.put(c.getCode(), c.getId());
                scopedCollateralIdentifiers.add(c.getCode());
            }
        }

        Set<String> scopedCustomerIdentifiers = new HashSet<>();
        for (Collateral c : ds.collaterals) {
            if (c.getCustomerId() != null) {
                scopedCustomerIdentifiers.add(c.getCustomerId());
                Customer cust = ds.customerByCif.get(c.getCustomerId());
                if (cust != null) {
                    if (cust.getId() != null) scopedCustomerIdentifiers.add(cust.getId());
                    if (cust.getCif() != null) scopedCustomerIdentifiers.add(cust.getCif());
                }
            }
        }

        for (LoanCollateralLink link : allLinks) {
            String canonColId = colIdentifierToId.get(link.getCollateralId());
            if (canonColId != null) {
                ds.linksByCollateralId.computeIfAbsent(canonColId, k -> new ArrayList<>()).add(link);
            }
            if (link.getFacilityId() != null) {
                ds.linksByFacilityId.computeIfAbsent(link.getFacilityId(), k -> new ArrayList<>()).add(link);
            }
            if (link.getLoanAccountId() != null) {
                ds.linksByFacilityId.computeIfAbsent(link.getLoanAccountId(), k -> new ArrayList<>()).add(link);
            }
        }
        ds.links = allLinks.stream().filter(l -> l.getCollateralId() != null && colIdentifierToId.containsKey(l.getCollateralId())).collect(Collectors.toList());

        Set<String> linkedFacilityIds = ds.links.stream().map(l -> l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId()).filter(Objects::nonNull).collect(Collectors.toSet());
        ds.facilities = allFacilities.stream().filter(f -> {
            if (scope.effectiveSegment != null && !scope.effectiveSegment.equalsIgnoreCase("ALL")) {
                if (f.getSegment() != null && !isSegmentMatch(f.getSegment(), scope.effectiveSegment)) return false;
            } else if (!scope.allowedSegments.isEmpty()) {
                if (f.getSegment() != null && scope.allowedSegments.stream().noneMatch(s -> isSegmentMatch(s, f.getSegment()))) return false;
            }

            if (scope.effectiveDistrict != null && !scope.effectiveDistrict.equalsIgnoreCase("ALL")) {
                String fBranch = f.getBranch();
                if (fBranch != null && !isBranchInDistrict(fBranch, scope.effectiveDistrict)) return false;
            }

            if (scope.effectiveBranch != null && !scope.effectiveBranch.equalsIgnoreCase("ALL")) {
                if (f.getBranch() != null && !f.getBranch().equalsIgnoreCase(scope.effectiveBranch)) return false;
            }

            if (scope.portfolioOwner != null) {
                String uId = scope.user != null && scope.user.getId() != null ? scope.user.getId().toLowerCase() : "";
                String uName = scope.user != null && scope.user.getUsername() != null ? scope.user.getUsername().toLowerCase() : "";
                String uFull = scope.user != null && scope.user.getFullName() != null ? scope.user.getFullName().toLowerCase() : "";

                boolean matches = false;
                if (f.getRmUserId() != null) {
                    String rm = f.getRmUserId().toLowerCase();
                    if (rm.equals(uId) || rm.equals(uName) || rm.equals(uFull)) matches = true;
                }
                if (!matches && f.getCustomerId() != null) {
                    Customer cust = ds.customerByCif.get(f.getCustomerId());
                    if (cust != null && cust.getMakerId() != null) {
                        String cm = cust.getMakerId().toLowerCase();
                        if (cm.equals(uId) || cm.equals(uName) || cm.equals(uFull)) matches = true;
                    }
                }
                if (!matches) {
                    if (linkedFacilityIds.contains(f.getId()) || (f.getLoanReference() != null && linkedFacilityIds.contains(f.getLoanReference()))) {
                        matches = true;
                    }
                }
                if (!matches) return false;
            }

            return true;
        }).collect(Collectors.toList());

        ds.customers = allCustomers.stream().filter(c -> {
            if (scope.effectiveSegment != null && !scope.effectiveSegment.equalsIgnoreCase("ALL")) {
                if (c.getSegment() != null && !isSegmentMatch(c.getSegment(), scope.effectiveSegment)) return false;
            } else if (!scope.allowedSegments.isEmpty()) {
                if (c.getSegment() != null && scope.allowedSegments.stream().noneMatch(s -> isSegmentMatch(s, c.getSegment()))) return false;
            }

            if (scope.effectiveDistrict != null && !scope.effectiveDistrict.equalsIgnoreCase("ALL")) {
                String cBranch = c.getBranch();
                if (cBranch != null && !isBranchInDistrict(cBranch, scope.effectiveDistrict)) return false;
            }

            if (scope.effectiveBranch != null && !scope.effectiveBranch.equalsIgnoreCase("ALL")) {
                if (c.getBranch() != null && !c.getBranch().equalsIgnoreCase(scope.effectiveBranch)) return false;
            }

            if (scope.portfolioOwner != null) {
                String uId = scope.user != null && scope.user.getId() != null ? scope.user.getId().toLowerCase() : "";
                String uName = scope.user != null && scope.user.getUsername() != null ? scope.user.getUsername().toLowerCase() : "";
                String uFull = scope.user != null && scope.user.getFullName() != null ? scope.user.getFullName().toLowerCase() : "";

                boolean matches = false;
                if (c.getMakerId() != null) {
                    String cm = c.getMakerId().toLowerCase();
                    if (cm.equals(uId) || cm.equals(uName) || cm.equals(uFull)) matches = true;
                }
                if (!matches) {
                    if (c.getId() != null && scopedCustomerIdentifiers.contains(c.getId())) matches = true;
                    if (c.getCif() != null && scopedCustomerIdentifiers.contains(c.getCif())) matches = true;
                }
                if (!matches) return false;
            }

            return true;
        }).collect(Collectors.toList());

        Set<String> scopedFacilityIds = ds.facilities.stream().map(LoanAccount::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        ds.facilities.stream().map(LoanAccount::getLoanReference).filter(Objects::nonNull).forEach(scopedFacilityIds::add);

        Set<String> allScopedCustomerIds = ds.customers.stream().map(Customer::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        ds.customers.stream().map(Customer::getCif).filter(Objects::nonNull).forEach(allScopedCustomerIds::add);

        for (InsurancePolicy p : allPolicies) {
            String canonColId = colIdentifierToId.get(p.getCollateralId());
            if (canonColId != null) {
                ds.policiesByCollateralId.computeIfAbsent(canonColId, k -> new ArrayList<>()).add(p);
            }
        }
        ds.policies = allPolicies.stream().filter(p -> p.getCollateralId() != null && colIdentifierToId.containsKey(p.getCollateralId())).collect(Collectors.toList());

        for (OwnershipDocument doc : allDocs) {
            String canonColId = colIdentifierToId.get(doc.getCollateralId());
            if (canonColId != null) {
                ds.documentsByCollateralId.computeIfAbsent(canonColId, k -> new ArrayList<>()).add(doc);
            }
        }
        ds.documents = allDocs.stream().filter(d -> d.getCollateralId() != null && colIdentifierToId.containsKey(d.getCollateralId())).collect(Collectors.toList());

        ds.exceptions = allExceptions.stream().filter(e -> 
            (e.getEntityId() != null && (scopedCollateralIdentifiers.contains(e.getEntityId()) || allScopedCustomerIds.contains(e.getEntityId()) || scopedFacilityIds.contains(e.getEntityId())))
        ).collect(Collectors.toList());

        // STRICT TASK SCOPING (Fixes previous leak): tasks must match scoped entity IDs or be explicitly assigned to user's branch
        ds.tasks = allTasks.stream().filter(t -> {
            if (t.getEntityId() != null) {
                if (scopedCollateralIdentifiers.contains(t.getEntityId())) return true;
                if (scopedFacilityIds.contains(t.getEntityId())) return true;
                if (allScopedCustomerIds.contains(t.getEntityId())) return true;
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

        // CBS sync freshness (§6: Never fabricate CBS freshness)
        Map<String, String> freshness = getCbsDataFreshness();
        b.setCbsSyncStatus(freshness.getOrDefault("status", "Not Available"));
        b.setCbsLastSyncedAt(freshness.get("lastSyncedAt"));
        b.setCbsFreshnessMessage(freshness.getOrDefault("message", "No successful CBS synchronization recorded"));

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
            Optional<CbsSyncLog> latestSuccess = logs.stream()
                    .filter(l -> l.getTimestamp() != null && l.getResult() != null && (l.getResult().equalsIgnoreCase("SUCCESS") || l.getResult().equalsIgnoreCase("SYNCED") || l.getResult().equalsIgnoreCase("COMPLETED")))
                    .max(Comparator.comparing(CbsSyncLog::getTimestamp));
            if (latestSuccess.isPresent() && latestSuccess.get().getTimestamp() != null) {
                String ts = latestSuccess.get().getTimestamp();
                freshness.put("lastSyncedAt", ts);
                freshness.put("status", "Synced");
                freshness.put("message", "Last successful CBS sync: " + ts);
            } else {
                freshness.put("status", "Not synchronized");
                freshness.put("lastSyncedAt", null);
                freshness.put("message", "Not synchronized — CBS data unavailable");
            }
        } catch (Exception e) {
            freshness.put("status", "Not synchronized");
            freshness.put("lastSyncedAt", null);
            freshness.put("message", "Not synchronized — CBS data unavailable");
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
        BigDecimal totalAllocatedSecured = BigDecimal.ZERO;
        BigDecimal totalRequiredInsurance = BigDecimal.ZERO;
        BigDecimal totalValidActiveInsurance = BigDecimal.ZERO;
        BigDecimal totalInsuranceGap = BigDecimal.ZERO;

        long uninsuredCount = 0;
        BigDecimal uninsuredMarketValue = BigDecimal.ZERO;
        long underinsuredCount = 0;
        BigDecimal underinsuredGap = BigDecimal.ZERO;
        long adequateCount = 0;

        long insuranceRequiredCollateralsCount = 0;
        long adequatelyInsuredCollateralsCount = 0;

        for (Collateral c : ds.collaterals) {
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<LoanAccount> linkedFacs = links.stream()
                    .map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId()))
                    .filter(Objects::nonNull)
                    .toList();
            List<InsurancePolicy> pols = ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());

            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c, links, linkedFacs, pols, ds.currentDate, ds.linksByFacilityId
            );

            totalNetSecurity = totalNetSecurity.add(BigDecimal.valueOf(eval.netSecurityValue));
            totalAllocatedSecured = totalAllocatedSecured.add(BigDecimal.valueOf(eval.totalAllocatedSecuredExposure));
            totalRequiredInsurance = totalRequiredInsurance.add(BigDecimal.valueOf(eval.insuranceRequired));
            totalValidActiveInsurance = totalValidActiveInsurance.add(BigDecimal.valueOf(eval.effectiveInsurance));
            totalInsuranceGap = totalInsuranceGap.add(BigDecimal.valueOf(eval.insuranceGap));

            boolean requiresInsurance = eval.isMandatory || eval.insuranceRequired > 0;
            if (requiresInsurance) {
                insuranceRequiredCollateralsCount++;
            }

            if ("Uninsured".equalsIgnoreCase(eval.adequacyStatus)) {
                uninsuredCount++;
                uninsuredMarketValue = uninsuredMarketValue.add(BigDecimal.valueOf(eval.marketValue));
            } else if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus)) {
                underinsuredCount++;
                underinsuredGap = underinsuredGap.add(BigDecimal.valueOf(eval.insuranceGap));
            } else if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) {
                adequateCount++;
                if (requiresInsurance) {
                    adequatelyInsuredCollateralsCount++;
                }
            }
        }

        dto.setTotalNetSecurityValue(totalNetSecurity);
        dto.setTotalAllocatedSecuredExposure(totalAllocatedSecured);
        dto.setTotalInsuranceRequired(totalRequiredInsurance);
        dto.setTotalValidActiveInsurance(totalValidActiveInsurance);
        dto.setTotalInsuranceGap(totalInsuranceGap);
        dto.setMinimumCoverageAdequacyPct(configurationService.getMinimumCoverageAdequacyPct());

        dto.setUninsuredCollateralsCount(uninsuredCount);
        dto.setUninsuredCollateralsMarketValue(uninsuredMarketValue);
        dto.setUnderinsuredCollateralsCount(underinsuredCount);
        dto.setUnderinsuredCollateralsGap(underinsuredGap);
        dto.setAdequatelyInsuredCollateralsCount(adequateCount);
        dto.setInsuranceRequiredCollateralsCount(insuranceRequiredCollateralsCount);

        // Insurance Compliance Rate:
        // (Number of insurance-required collateral records that are adequately insured ÷ Total number of insurance-required collateral records) × 100
        double complianceRate = insuranceRequiredCollateralsCount > 0
                ? ((double) adequatelyInsuredCollateralsCount / insuranceRequiredCollateralsCount) * 100.0
                : 100.0;
        double roundedCompliance = Math.round(complianceRate * 10.0) / 10.0;
        dto.setInsuranceCoveragePct(roundedCompliance);
        dto.setInsuranceComplianceRate(roundedCompliance);

        // Authoritative policy categorization (§3: Replaced policies excluded from expired risks)
        EffectiveInsuranceService.PolicyCategorizationResult polCat = effectiveInsuranceService.categorizePolicies(
                ds.policies, ds.currentDate, configurationService.getPolicyExpiringStatusDays()
        );

        dto.setExpiredPoliciesCount(polCat.expiredPolicies.size());
        dto.setPoliciesDueWithin7DaysCount(polCat.dueWithin7DaysPolicies.size());
        dto.setPoliciesExpiringWithin30Days(polCat.expiring30DaysPolicies.size());

        // Operational & Governance KPIs (§10 Tier 4)
        long renewalsInProgress = ds.tasks.stream().filter(t -> t.getActionType() != null && t.getActionType().toUpperCase().contains("RENEWAL") && !"Completed".equalsIgnoreCase(t.getStatus()) && !"Approved".equalsIgnoreCase(t.getStatus())).count();
        if (renewalsInProgress == 0) {
            renewalsInProgress = ds.policies.stream().filter(p -> "Renewal In Progress".equalsIgnoreCase(p.getStatus()) || "Pending Renewal".equalsIgnoreCase(p.getStatus())).count();
        }
        dto.setRenewalsInProgressCount(renewalsInProgress);

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

        // Objective Documentation Health metrics via MandatoryDocumentRule evaluation (§33)
        long docCompleteCollaterals = 0;
        long docMissingCollaterals = 0;
        long docExpiredCount = 0;
        long docExpiringCount = 0;
        long warningDays = configurationService.getDocumentExpiryWarningDays();
        if (warningDays <= 0) warningDays = 30;

        List<MandatoryDocumentRule> allRules = mandatoryDocumentRuleRepository.findAll();
        for (Collateral c : ds.collaterals) {
            List<MandatoryDocumentRule> rules = allRules.stream()
                    .filter(r -> r.isMandatory() && validationService.categoryMatches(r.getCollateralCategory(), c))
                    .toList();
            List<OwnershipDocument> colDocs = ds.documentsByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            if (rules.isEmpty()) {
                docCompleteCollaterals++;
                continue;
            }
            boolean allRulesSatisfied = true;
            for (MandatoryDocumentRule r : rules) {
                Optional<OwnershipDocument> docOpt = colDocs.stream()
                        .filter(d -> validationService.docTypeMatches(r.getDocumentType(), d.getType()) ||
                                     validationService.docTypeMatches(r.getDocumentType(), d.getName()))
                        .findFirst();
                if (docOpt.isPresent()) {
                    OwnershipDocument d = docOpt.get();
                    LocalDate exp = parseDate(d.getExpiryDate());
                    if (exp != null && exp.isBefore(ds.currentDate)) {
                        docExpiredCount++;
                    } else if (exp != null && ChronoUnit.DAYS.between(ds.currentDate, exp) <= warningDays) {
                        docExpiringCount++;
                    }
                } else {
                    allRulesSatisfied = false;
                }
            }
            if (allRulesSatisfied) {
                docCompleteCollaterals++;
            } else {
                docMissingCollaterals++;
            }
        }

        dto.setMandatoryDocumentsCompleteCount(docCompleteCollaterals);
        dto.setMissingMandatoryDocumentsCount(docMissingCollaterals);
        dto.setExpiredDocumentsCount(docExpiredCount);
        dto.setExpiringDocumentsCount(docExpiringCount);

        dto.setOverrideCount(ds.tasks.stream().filter(t -> t.getActionType() != null && t.getActionType().contains("OVERRIDE")).count());

        // Actual Insurer Exposure from active valid policies (§14: Separate actual exposure from configured limit)
        Map<String, Double> insurerShares = new HashMap<>();
        for (InsurancePolicy p : polCat.activeValidPolicies) {
            String ins = p.getInsurerName() != null && !p.getInsurerName().isBlank() ? p.getInsurerName().trim() : "Other Insurer";
            insurerShares.put(ins, insurerShares.getOrDefault(ins, 0.0) + p.getInsuredAmount());
        }
        double maxInsurerAmount = 0.0;
        String topInsurerName = "";
        for (Map.Entry<String, Double> entry : insurerShares.entrySet()) {
            if (entry.getValue() > maxInsurerAmount) {
                maxInsurerAmount = entry.getValue();
                topInsurerName = entry.getKey();
            }
        }
        double topInsurerSharePct = totalValidActiveInsurance.compareTo(BigDecimal.ZERO) > 0
                ? (maxInsurerAmount / totalValidActiveInsurance.doubleValue()) * 100.0
                : 0.0;
        dto.setActualTopInsurerExposurePct(Math.round(topInsurerSharePct * 10.0) / 10.0);
        dto.setActualTopInsurerName(topInsurerName);
        dto.setConfiguredInsurerConcentrationLimitPct(configurationService.getMaxInsurerConcentrationPct());
        dto.setInsurerConcentrationMaxPct(configurationService.getMaxInsurerConcentrationPct());

        dto.setSystemDate(ds.currentDate.format(DATE_FMT));
        dto.setLastRefreshTimestamp(LocalDateTime.now().format(DISPLAY_DT_FMT));

        return dto;
    }

    public List<String> getCanonicalSegments() {
        List<String> segs = businessSegmentRepository.findAll().stream()
                .filter(BusinessSegment::isActive)
                .map(BusinessSegment::getName)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (segs.isEmpty()) {
            return List.of("Corporate Banking", "Retail Banking", "MSME Banking", "Interest-Free Banking (IFB)");
        }
        return segs;
    }

    /**
     * Computes a dynamic 12-month longitudinal portfolio and protection timeline.
     * Evaluates actual loan booking/maturity dates, policy effective/expiry dates,
     * and monthly protection inflows vs runoff outflows without requiring manual snapshots.
     */
    public List<Map<String, Object>> computePortfolioTimeline(ScopedDataset ds) {
        List<Map<String, Object>> timeline = new ArrayList<>();
        LocalDate baseDate = ds.currentDate != null ? ds.currentDate : getCurrentSystemDate();
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("MMM yyyy");
        DateTimeFormatter keyFmt = DateTimeFormatter.ofPattern("yyyy-MM");

        for (int i = -6; i <= 5; i++) {
            LocalDate monthRef = baseDate.plusMonths(i);
            LocalDate startOfMonth = monthRef.withDayOfMonth(1);
            LocalDate endOfMonth = monthRef.withDayOfMonth(monthRef.lengthOfMonth());
            String monthKey = monthRef.format(keyFmt);
            String monthLabel = monthRef.format(monthFmt);

            boolean isHistorical = monthRef.isBefore(baseDate.withDayOfMonth(1));
            boolean isCurrent = monthRef.getYear() == baseDate.getYear() && monthRef.getMonth() == baseDate.getMonth();
            boolean isProjected = monthRef.isAfter(baseDate.withDayOfMonth(1));

            // Loans active in this month
            double activeExp = 0.0;
            for (LoanAccount f : ds.facilities) {
                LocalDate disb = parseDate(f.getLineStartDate());
                if (disb == null) disb = parseDate(f.getMakerDtStamp());
                if (disb == null || !disb.isAfter(endOfMonth)) {
                    LocalDate mat = parseDate(f.getLineExpiryDate());
                    if (mat == null || !mat.isBefore(startOfMonth)) {
                        activeExp += f.getOutstandingBalance();
                    }
                }
            }

            // Policies incepted and expiring in this month
            long inceptedCount = 0;
            double inceptedAmt = 0.0;
            long expiringCount = 0;
            double expiringAmt = 0.0;
            double activeProt = 0.0;

            for (InsurancePolicy p : ds.policies) {
                LocalDate eff = parseDate(p.getEffectiveDate());
                LocalDate exp = parseDate(p.getExpiryDate());
                double amt = p.getInsuredAmount();

                if (eff != null && eff.getYear() == monthRef.getYear() && eff.getMonth() == monthRef.getMonth()) {
                    inceptedCount++;
                    inceptedAmt += amt;
                }
                if (exp != null && exp.getYear() == monthRef.getYear() && exp.getMonth() == monthRef.getMonth()) {
                    expiringCount++;
                    expiringAmt += amt;
                }

                // Active in this month
                if (eff != null && !eff.isAfter(endOfMonth)) {
                    if (exp != null && !exp.isBefore(startOfMonth)) {
                        activeProt += amt;
                    }
                }
            }

            // Required insurance for collaterals active in this month
            double reqIns = 0.0;
            for (Collateral c : ds.collaterals) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        endOfMonth
                );
                reqIns += eval.insuranceRequired;
            }

            double gap = Math.max(0, reqIns - activeProt);
            double covPct = reqIns > 0 ? (activeProt / reqIns) * 100.0 : 100.0;

            Map<String, Object> point = new LinkedHashMap<>();
            point.put("monthKey", monthKey);
            point.put("month", monthLabel);
            point.put("monthLabel", monthLabel);
            point.put("isHistorical", isHistorical);
            point.put("isCurrent", isCurrent);
            point.put("isProjected", isProjected);
            point.put("activeExposure", Math.round(activeExp * 100.0) / 100.0);
            point.put("activeProtection", Math.round(activeProt * 100.0) / 100.0);
            point.put("insuranceRequired", Math.round(reqIns * 100.0) / 100.0);
            point.put("protectionGap", Math.round(gap * 100.0) / 100.0);
            point.put("coveragePct", Math.round(covPct * 10.0) / 10.0);
            point.put("policiesIncepted", inceptedCount);
            point.put("inceptedAmount", Math.round(inceptedAmt * 100.0) / 100.0);
            point.put("policiesExpiring", expiringCount);
            point.put("expiringAmount", Math.round(expiringAmt * 100.0) / 100.0);
            point.put("netProtectionFlow", Math.round((inceptedAmt - expiringAmt) * 100.0) / 100.0);
            timeline.add(point);
        }
        return timeline;
    }

    public DashboardChartDataDto getCharts(String userId, String segment, String district, String branch, String category, String status, String expiry) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, category, status, expiry);

        DashboardChartDataDto charts = new DashboardChartDataDto();

        // 1. Exposure vs Protection by Segment (§15 Chart 2: Outstanding Exposure, Insurance Requirement, Active Valid Insurance)
        List<Map<String, Object>> exposureVsProtection = new ArrayList<>();
        List<String> segs = getCanonicalSegments();

        for (String seg : segs) {
            double segExp = ds.facilities.stream().filter(f -> isSegmentMatch(seg, f.getSegment())).mapToDouble(LoanAccount::getOutstandingBalance).sum();
            List<Collateral> segCols = ds.collaterals.stream().filter(c -> isSegmentMatch(seg, c.getOwningSegment())).toList();
            double segVal = segCols.stream().mapToDouble(Collateral::getValuationAmount).sum();
            double segAct = 0.0;
            double segReq = 0.0;
            double segAllocExp = 0.0;
            long segReqCount = 0;
            long segAdequateCount = 0;
            for (Collateral c : segCols) {
                List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        links,
                        linkedFacs,
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );
                segAct += eval.effectiveInsurance;
                segReq += eval.insuranceRequired;
                segAllocExp += eval.totalAllocatedSecuredExposure;

                boolean requiresInsurance = eval.isMandatory || eval.insuranceRequired > 0;
                if (requiresInsurance) {
                    segReqCount++;
                    if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) {
                        segAdequateCount++;
                    }
                }
            }
            double segGap = Math.max(0, segReq - segAct);
            double segComp = segReqCount > 0 ? ((double) segAdequateCount / segReqCount) * 100.0 : 100.0;

            Map<String, Object> item = new HashMap<>();
            item.put("category", seg.replace(" Banking", "").replace(" (IFB)", ""));
            item.put("segment", seg);
            item.put("collateralValue", segVal);
            item.put("exposure", segExp);
            item.put("allocatedSecuredExposure", segAllocExp);
            item.put("insuranceRequired", segReq);
            item.put("activeInsurance", segAct);
            item.put("insuredCoverage", segAct);
            item.put("gap", segGap);
            item.put("coveragePct", Math.round(segComp * 10.0) / 10.0);
            exposureVsProtection.add(item);
        }
        charts.setExposureVsProtection(exposureVsProtection);

        // 2. Compliance Donut (§14 Chart 1: Donut with Adequate, Underinsured, Uninsured - Expired NOT in Underinsured)
        long adequate = 0;
        double adequateVal = 0.0;
        long underinsured = 0;
        double underinsuredGap = 0.0;
        long uninsured = 0;
        double uninsuredVal = 0.0;
        for (Collateral c : ds.collaterals) {
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c,
                    links,
                    linkedFacs,
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate,
                    ds.linksByFacilityId
            );
            if ("Uninsured".equalsIgnoreCase(eval.adequacyStatus)) {
                uninsured++;
                uninsuredVal += eval.marketValue;
            } else if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus)) {
                underinsured++;
                underinsuredGap += eval.insuranceGap;
            } else {
                adequate++;
                adequateVal += eval.marketValue;
            }
        }
        long totalMonitored = adequate + underinsured + uninsured;
        charts.setComplianceDonut(List.of(
                Map.of("name", "Adequately Insured", "value", adequate, "count", adequate, "pct", totalMonitored > 0 ? Math.round((double) adequate / totalMonitored * 1000.0) / 10.0 : 0.0, "marketValue", adequateVal, "gap", 0.0, "color", "#059669"),
                Map.of("name", "Underinsured Gap", "value", underinsured, "count", underinsured, "pct", totalMonitored > 0 ? Math.round((double) underinsured / totalMonitored * 1000.0) / 10.0 : 0.0, "marketValue", 0.0, "gap", underinsuredGap, "color", "#D97706"),
                Map.of("name", "Uninsured Assets", "value", uninsured, "count", uninsured, "pct", totalMonitored > 0 ? Math.round((double) uninsured / totalMonitored * 1000.0) / 10.0 : 0.0, "marketValue", uninsuredVal, "gap", uninsuredVal, "color", "#DC2626")
        ));

        // 3. Category Distribution (§19 Chart 6: Driven by active CollateralTaxonomy)
        Map<String, Double> catVal = new HashMap<>();
        Map<String, Integer> catCount = new HashMap<>();
        Map<String, Double> catExp = new HashMap<>();
        Map<String, Double> catReq = new HashMap<>();
        Map<String, Double> catAct = new HashMap<>();

        for (Collateral c : ds.collaterals) {
            String cat = c.getCategory() != null && !c.getCategory().isBlank() ? c.getCategory() : "Other";
            catVal.put(cat, catVal.getOrDefault(cat, 0.0) + c.getValuationAmount());
            catCount.put(cat, catCount.getOrDefault(cat, 0) + 1);

            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c,
                    links,
                    linkedFacs,
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate,
                    ds.linksByFacilityId
            );
            catExp.put(cat, catExp.getOrDefault(cat, 0.0) + eval.totalAllocatedSecuredExposure);
            catReq.put(cat, catReq.getOrDefault(cat, 0.0) + eval.insuranceRequired);
            catAct.put(cat, catAct.getOrDefault(cat, 0.0) + eval.effectiveInsurance);
        }
        List<Map<String, Object>> catList = new ArrayList<>();
        catVal.forEach((k, v) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("category", k);
            m.put("name", k);
            m.put("value", catCount.getOrDefault(k, 1));
            m.put("count", catCount.getOrDefault(k, 1));
            m.put("marketValue", v);
            m.put("collateralValue", v);
            m.put("exposure", catExp.getOrDefault(k, 0.0));
            m.put("insuranceRequired", catReq.getOrDefault(k, 0.0));
            m.put("activeInsurance", catAct.getOrDefault(k, 0.0));
            double gap = Math.max(0, catReq.getOrDefault(k, 0.0) - catAct.getOrDefault(k, 0.0));
            m.put("gap", gap);
            catList.add(m);
        });
        charts.setCollateralCategoryDistribution(catList);

        // 4. Collateral Type Exposure (§20 Chart 7)
        Map<String, Double> typeExp = new HashMap<>();
        Map<String, Double> typeVal = new HashMap<>();
        Map<String, Double> typeReq = new HashMap<>();
        Map<String, Double> typeAct = new HashMap<>();
        Map<String, Integer> typeCount = new HashMap<>();

        for (Collateral c : ds.collaterals) {
            String tp = c.getType() != null && !c.getType().isBlank() ? c.getType() : (c.getCategory() != null ? c.getCategory() : "Other");
            typeCount.put(tp, typeCount.getOrDefault(tp, 0) + 1);
            typeVal.put(tp, typeVal.getOrDefault(tp, 0.0) + c.getValuationAmount());

            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    c,
                    links,
                    linkedFacs,
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate,
                    ds.linksByFacilityId
            );
            typeExp.put(tp, typeExp.getOrDefault(tp, 0.0) + eval.totalAllocatedSecuredExposure);
            typeReq.put(tp, typeReq.getOrDefault(tp, 0.0) + eval.insuranceRequired);
            typeAct.put(tp, typeAct.getOrDefault(tp, 0.0) + eval.effectiveInsurance);
        }
        List<Map<String, Object>> typeList = new ArrayList<>();
        typeVal.forEach((tp, val) -> {
            Map<String, Object> m = new HashMap<>();
            m.put("type", tp);
            m.put("name", tp);
            m.put("collateralType", tp);
            m.put("count", typeCount.getOrDefault(tp, 1));
            m.put("collateralValue", val);
            m.put("marketValue", val);
            m.put("exposure", typeExp.getOrDefault(tp, 0.0));
            double req = typeReq.getOrDefault(tp, 0.0);
            double act = typeAct.getOrDefault(tp, 0.0);
            m.put("insuranceRequired", req);
            m.put("activeInsurance", act);
            m.put("insuranceGap", Math.max(0, req - act));
            m.put("coveragePct", req > 0 ? Math.round((act / req) * 1000.0) / 10.0 : 100.0);
            typeList.add(m);
        });
        typeList.sort((a, b) -> Double.compare(((Number) b.get("exposure")).doubleValue(), ((Number) a.get("exposure")).doubleValue()));
        charts.setCollateralTypeExposure(typeList);

        // 5. Expiry Pipeline (§17 Chart 4: Authoritative policy lifecycle; superseded excluded)
        EffectiveInsuranceService.PolicyCategorizationResult chartPolCat = effectiveInsuranceService.categorizePolicies(
                ds.policies, ds.currentDate, 90
        );
        long expOverdue = chartPolCat.expiredPolicies.size();
        double amtOverdue = chartPolCat.expiredPolicies.stream().mapToDouble(InsurancePolicy::getInsuredAmount).sum();
        long exp0_7 = 0, exp8_15 = 0, exp16_30 = 0, exp31_60 = 0, exp61_90 = 0, expOver90 = 0;
        double amt0_7 = 0.0, amt8_15 = 0.0, amt16_30 = 0.0, amt31_60 = 0.0, amt61_90 = 0.0, amtOver90 = 0.0;
        for (InsurancePolicy p : chartPolCat.activeValidPolicies) {
            LocalDate exp = parseDate(p.getExpiryDate());
            if (exp == null) continue;
            double amt = p.getInsuredAmount();
            long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
            if (days <= 7) {
                exp0_7++;
                amt0_7 += amt;
            } else if (days <= 15) {
                exp8_15++;
                amt8_15 += amt;
            } else if (days <= 30) {
                exp16_30++;
                amt16_30 += amt;
            } else if (days <= 60) {
                exp31_60++;
                amt31_60 += amt;
            } else if (days <= 90) {
                exp61_90++;
                amt61_90 += amt;
            } else {
                expOver90++;
                amtOver90 += amt;
            }
        }
        charts.setExpiryPipeline(List.of(
                Map.of("bucket", "Expired / Overdue", "range", "Expired / Overdue", "count", expOverdue, "amount", amtOverdue, "color", "#DC2626"),
                Map.of("bucket", "0-7 Days", "range", "0-7 Days", "count", exp0_7, "amount", amt0_7, "color", "#EF4444"),
                Map.of("bucket", "8-15 Days", "range", "8-15 Days", "count", exp8_15, "amount", amt8_15, "color", "#F59E0B"),
                Map.of("bucket", "16-30 Days", "range", "16-30 Days", "count", exp16_30, "amount", amt16_30, "color", "#EAB308"),
                Map.of("bucket", "31-60 Days", "range", "31-60 Days", "count", exp31_60, "amount", amt31_60, "color", "#3B82F6"),
                Map.of("bucket", "61-90 Days", "range", "61-90 Days", "count", exp61_90, "amount", amt61_90, "color", "#6366F1"),
                Map.of("bucket", ">90 Days", "range", ">90 Days", "count", expOver90, "amount", amtOver90, "color", "#10B981")
        ));

        // 6. Insurance Company Exposure (§18 Chart 5: Actual Active Insurance by Insurer)
        Map<String, Double> insurerAct = new HashMap<>();
        Map<String, Integer> insurerPols = new HashMap<>();
        Map<String, Integer> insurerExpiring = new HashMap<>();
        for (InsurancePolicy p : chartPolCat.activeValidPolicies) {
            if ("Active".equalsIgnoreCase(p.getStatus()) || "Approved".equalsIgnoreCase(p.getStatus())) {
                String ins = p.getInsurerName() != null && !p.getInsurerName().isBlank() ? p.getInsurerName().trim() : "Other Insurer";
                insurerAct.put(ins, insurerAct.getOrDefault(ins, 0.0) + p.getInsuredAmount());
                insurerPols.put(ins, insurerPols.getOrDefault(ins, 0) + 1);

                LocalDate exp = parseDate(p.getExpiryDate());
                if (exp != null) {
                    long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
                    if (days >= 0 && days <= 30) {
                        insurerExpiring.put(ins, insurerExpiring.getOrDefault(ins, 0) + 1);
                    }
                }
            }
        }
        double totalValidActive = insurerAct.values().stream().mapToDouble(Double::doubleValue).sum();
        double configuredConcentrationLimit = configurationService.getMaxInsurerConcentrationPct();

        List<Map<String, Object>> insurerList = new ArrayList<>();
        for (Map.Entry<String, Double> e : insurerAct.entrySet()) {
            Map<String, Object> m = new HashMap<>();
            m.put("insurer", e.getKey());
            m.put("insurerName", e.getKey());
            m.put("activeInsurance", e.getValue());
            double sharePct = totalValidActive > 0 ? (e.getValue() / totalValidActive) * 100.0 : 0.0;
            m.put("portfolioSharePct", Math.round(sharePct * 10.0) / 10.0);
            m.put("policyCount", insurerPols.getOrDefault(e.getKey(), 1));
            m.put("expiringPolicyCount", insurerExpiring.getOrDefault(e.getKey(), 0));
            m.put("configuredLimit", configuredConcentrationLimit);
            m.put("isConcentrationRisk", sharePct > configuredConcentrationLimit);
            insurerList.add(m);
        }
        insurerList.sort((a, b) -> Double.compare(((Number) b.get("activeInsurance")).doubleValue(), ((Number) a.get("activeInsurance")).doubleValue()));
        charts.setInsurerExposure(insurerList);

        // 7. Policy Ageing (§21 Chart 8: currentDate - effectiveDate in days)
        long ageUnder90 = 0, age90_180 = 0, age180_365 = 0, age1_2y = 0, ageOver2y = 0;
        double amtAgeUnder90 = 0, amtAge90_180 = 0, amtAge180_365 = 0, amtAge1_2y = 0, amtAgeOver2y = 0;
        long totalAgeDays = 0;
        long maxAgeDays = 0;
        int policyCountForAge = 0;

        for (InsurancePolicy p : ds.policies) {
            if (!"Active".equalsIgnoreCase(p.getStatus()) && !"Approved".equalsIgnoreCase(p.getStatus())) continue;
            LocalDate eff = parseDate(p.getEffectiveDate());
            if (eff == null) continue;
            long ageDays = Math.max(0, ChronoUnit.DAYS.between(eff, ds.currentDate));
            totalAgeDays += ageDays;
            if (ageDays > maxAgeDays) maxAgeDays = ageDays;
            policyCountForAge++;

            double amt = p.getInsuredAmount();
            if (ageDays < 90) {
                ageUnder90++;
                amtAgeUnder90 += amt;
            } else if (ageDays <= 180) {
                age90_180++;
                amtAge90_180 += amt;
            } else if (ageDays <= 365) {
                age180_365++;
                amtAge180_365 += amt;
            } else if (ageDays <= 730) {
                age1_2y++;
                amtAge1_2y += amt;
            } else {
                ageOver2y++;
                amtAgeOver2y += amt;
            }
        }
        double avgAge = policyCountForAge > 0 ? (double) totalAgeDays / policyCountForAge : 0.0;
        charts.setPolicyAgeing(List.of(
                Map.of("ageBucket", "< 90 Days", "policyCount", ageUnder90, "insuredAmount", amtAgeUnder90, "averageAgeDays", Math.round(avgAge), "oldestPolicyDays", maxAgeDays),
                Map.of("ageBucket", "90 - 180 Days", "policyCount", age90_180, "insuredAmount", amtAge90_180, "averageAgeDays", Math.round(avgAge), "oldestPolicyDays", maxAgeDays),
                Map.of("ageBucket", "180 - 365 Days", "policyCount", age180_365, "insuredAmount", amtAge180_365, "averageAgeDays", Math.round(avgAge), "oldestPolicyDays", maxAgeDays),
                Map.of("ageBucket", "1 - 2 Years", "policyCount", age1_2y, "insuredAmount", amtAge1_2y, "averageAgeDays", Math.round(avgAge), "oldestPolicyDays", maxAgeDays),
                Map.of("ageBucket", "> 2 Years", "policyCount", ageOver2y, "insuredAmount", amtAgeOver2y, "averageAgeDays", Math.round(avgAge), "oldestPolicyDays", maxAgeDays)
        ));

        // 8. District Ranking (Dynamic from configured data)
        List<Map<String, Object>> districtRanking = new ArrayList<>();
        Set<String> allDists = new LinkedHashSet<>();
        branchRepository.findAll().stream()
                .filter(b -> "DistrictOffice".equalsIgnoreCase(b.getType()) || (b.getCode() != null && b.getCode().startsWith("DIST-")))
                .map(Branch::getName)
                .filter(Objects::nonNull)
                .forEach(allDists::add);
        districtHierarchyRepository.findAll().stream()
                .map(DistrictHierarchy::getDistrictName)
                .filter(Objects::nonNull)
                .forEach(allDists::add);
        if (allDists.isEmpty()) {
            branchRepository.findAll().stream()
                    .map(Branch::getParentDistrictId)
                    .filter(Objects::nonNull)
                    .map(id -> branchRepository.findById(id).map(Branch::getName).orElse(null))
                    .filter(Objects::nonNull)
                    .forEach(allDists::add);
        }

        for (String dist : allDists) {
            List<Collateral> dCols = ds.collaterals.stream().filter(c -> isBranchInDistrict(c.getBranch(), dist)).toList();
            if (dCols.isEmpty()) continue;
            double dExp = 0.0, dGap = 0.0, dReq = 0.0, dAct = 0.0;
            long dReqCount = 0;
            long dAdequateCount = 0;
            for (Collateral c : dCols) {
                List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        links,
                        linkedFacs,
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );
                dExp += eval.totalAllocatedSecuredExposure;
                dReq += eval.insuranceRequired;
                dAct += eval.effectiveInsurance;
                dGap += eval.insuranceGap;

                boolean requiresInsurance = eval.isMandatory || eval.insuranceRequired > 0;
                if (requiresInsurance) {
                    dReqCount++;
                    if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) {
                        dAdequateCount++;
                    }
                }
            }
            double compPct = dReqCount > 0 ? ((double) dAdequateCount / dReqCount) * 100.0 : 100.0;
            Map<String, Object> dm = new HashMap<>();
            dm.put("district", dist);
            dm.put("districtName", dist);
            dm.put("exposure", dExp);
            dm.put("insuranceRequired", dReq);
            dm.put("activeInsurance", dAct);
            dm.put("insuranceGap", dGap);
            dm.put("compliancePct", Math.round(compPct * 10.0) / 10.0);
            dm.put("collateralCount", dCols.size());
            districtRanking.add(dm);
        }
        districtRanking.sort((a, b) -> Double.compare(((Number) b.get("insuranceGap")).doubleValue(), ((Number) a.get("insuranceGap")).doubleValue()));
        charts.setDistrictRanking(districtRanking);

        // 9. Branch Ranking
        List<Map<String, Object>> branchRanking = new ArrayList<>();
        Map<String, List<Collateral>> colsByBranch = ds.collaterals.stream().filter(c -> c.getBranch() != null).collect(Collectors.groupingBy(Collateral::getBranch));
        for (Map.Entry<String, List<Collateral>> entry : colsByBranch.entrySet()) {
            double bVal = 0.0, bReq = 0.0, bAct = 0.0, bGap = 0.0, bExp = 0.0;
            long bReqCount = 0;
            long bAdequateCount = 0;
            for (Collateral c : entry.getValue()) {
                bVal += c.getValuationAmount();
                List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        links,
                        linkedFacs,
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );
                bExp += eval.totalAllocatedSecuredExposure;
                bReq += eval.insuranceRequired;
                bAct += eval.effectiveInsurance;
                bGap += eval.insuranceGap;

                boolean requiresInsurance = eval.isMandatory || eval.insuranceRequired > 0;
                if (requiresInsurance) {
                    bReqCount++;
                    if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) {
                        bAdequateCount++;
                    }
                }
            }
            double bComp = bReqCount > 0 ? ((double) bAdequateCount / bReqCount) * 100.0 : 100.0;
            Map<String, Object> bm = new HashMap<>();
            bm.put("branch", entry.getKey());
            bm.put("collateralValue", bVal);
            bm.put("exposure", bExp);
            bm.put("insuranceRequired", bReq);
            bm.put("insuredAmount", bAct);
            bm.put("activeInsurance", bAct);
            bm.put("insuranceGap", bGap);
            bm.put("compliancePct", Math.round(bComp * 10.0) / 10.0);
            branchRanking.add(bm);
        }
        branchRanking.sort((a, b) -> Double.compare(((Number) b.get("insuranceGap")).doubleValue(), ((Number) a.get("insuranceGap")).doubleValue()));
        charts.setBranchRanking(branchRanking);

        // 10. Documentation Health (§33: Rule-based evaluation)
        long docCompleteCollaterals = 0;
        long docMissingCollaterals = 0;
        long docExpiredCount = 0;
        long docExpiringCount = 0;
        long warningDays = configurationService.getDocumentExpiryWarningDays();
        if (warningDays <= 0) warningDays = 30;

        List<MandatoryDocumentRule> allRulesForChart = mandatoryDocumentRuleRepository.findAll();
        for (Collateral c : ds.collaterals) {
            List<MandatoryDocumentRule> rules = allRulesForChart.stream()
                    .filter(r -> r.isMandatory() && validationService.categoryMatches(r.getCollateralCategory(), c))
                    .toList();
            List<OwnershipDocument> colDocs = ds.documentsByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            if (rules.isEmpty()) {
                docCompleteCollaterals++;
                continue;
            }
            boolean allRulesSatisfied = true;
            for (MandatoryDocumentRule r : rules) {
                Optional<OwnershipDocument> docOpt = colDocs.stream()
                        .filter(d -> validationService.docTypeMatches(r.getDocumentType(), d.getType()) ||
                                     validationService.docTypeMatches(r.getDocumentType(), d.getName()))
                        .findFirst();
                if (docOpt.isPresent()) {
                    OwnershipDocument d = docOpt.get();
                    LocalDate exp = parseDate(d.getExpiryDate());
                    if (exp != null && exp.isBefore(ds.currentDate)) {
                        docExpiredCount++;
                    } else if (exp != null && ChronoUnit.DAYS.between(ds.currentDate, exp) <= warningDays) {
                        docExpiringCount++;
                    }
                } else {
                    allRulesSatisfied = false;
                }
            }
            if (allRulesSatisfied) {
                docCompleteCollaterals++;
            } else {
                docMissingCollaterals++;
            }
        }
        charts.setDocumentationHealth(List.of(
                Map.of("name", "Mandatory Complete", "value", docCompleteCollaterals, "count", docCompleteCollaterals, "color", "#059669"),
                Map.of("name", "Missing Mandatory", "value", docMissingCollaterals, "count", docMissingCollaterals, "color", "#DC2626"),
                Map.of("name", "Expired Documents", "value", docExpiredCount, "count", docExpiredCount, "color", "#D97706"),
                Map.of("name", "Expiring Soon", "value", docExpiringCount, "count", docExpiringCount, "color", "#2563EB")
        ));

        // 11. Workflow Funnel / Workload (§24 Chart 11)
        Map<String, Long> taskStatusCount = ds.tasks.stream().collect(Collectors.groupingBy(WorkflowTask::getStatus, Collectors.counting()));
        List<Map<String, Object>> wfList = new ArrayList<>();
        taskStatusCount.forEach((k, v) -> wfList.add(Map.of("status", k, "count", v)));
        charts.setWorkflowFunnel(wfList);

        // 12. Ownership Distribution
        Map<String, Long> ownerCounts = ds.collaterals.stream().collect(Collectors.groupingBy(c -> c.getOwnershipType() != null ? c.getOwnershipType() : "Primary Borrower", Collectors.counting()));
        List<Map<String, Object>> ownerList = new ArrayList<>();
        ownerCounts.forEach((k, v) -> ownerList.add(Map.of("ownershipType", k, "count", v)));
        charts.setOwnershipDistribution(ownerList);

        // 13. Top Insurance Gaps (§16 Chart 3: Sorted largest gap first)
        List<EffectiveInsuranceService.CollateralProtectionResult> evals = new ArrayList<>();
        for (Collateral c : ds.collaterals) {
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
            evals.add(effectiveInsuranceService.evaluateCollateral(
                    c,
                    links,
                    linkedFacs,
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate,
                    ds.linksByFacilityId
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

        // 14. RM Compliance Analysis (§23 Chart 10)
        Map<String, List<Collateral>> colsByRm = new HashMap<>();
        for (Collateral c : ds.collaterals) {
            String rm = "Unassigned";
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            for (LoanCollateralLink l : links) {
                LoanAccount fac = ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId());
                if (fac != null && fac.getRmUserId() != null && !fac.getRmUserId().isBlank()) {
                    rm = fac.getRmUserId();
                    break;
                }
            }
            if ("Unassigned".equalsIgnoreCase(rm) && c.getMakerId() != null && !c.getMakerId().isBlank()) {
                rm = c.getMakerId();
            }
            colsByRm.computeIfAbsent(rm, k -> new ArrayList<>()).add(c);
        }

        List<Map<String, Object>> rmList = new ArrayList<>();
        for (Map.Entry<String, List<Collateral>> entry : colsByRm.entrySet()) {
            double rmVal = 0.0, rmExp = 0.0, rmReq = 0.0, rmAct = 0.0;
            long rmReqCount = 0;
            long rmAdequateCount = 0;
            Set<String> rmCusts = new HashSet<>();
            for (Collateral c : entry.getValue()) {
                rmVal += c.getValuationAmount();
                if (c.getCustomerId() != null) rmCusts.add(c.getCustomerId());
                List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                List<LoanAccount> linkedFacs = links.stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList();
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        links,
                        linkedFacs,
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );
                rmExp += eval.totalAllocatedSecuredExposure;
                rmReq += eval.insuranceRequired;
                rmAct += eval.effectiveInsurance;

                boolean requiresInsurance = eval.isMandatory || eval.insuranceRequired > 0;
                if (requiresInsurance) {
                    rmReqCount++;
                    if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) {
                        rmAdequateCount++;
                    }
                }
            }
            double rmComp = rmReqCount > 0 ? ((double) rmAdequateCount / rmReqCount) * 100.0 : 100.0;
            Map<String, Object> rmM = new HashMap<>();
            rmM.put("rmName", entry.getKey());
            rmM.put("officer", entry.getKey());
            rmM.put("collateralCount", entry.getValue().size());
            rmM.put("customerCount", rmCusts.size());
            rmM.put("collateralValue", rmVal);
            rmM.put("exposure", rmExp);
            rmM.put("insuranceRequired", rmReq);
            rmM.put("activeInsurance", rmAct);
            rmM.put("insuranceGap", Math.max(0, rmReq - rmAct));
            rmM.put("coveragePct", Math.round(rmComp * 10.0) / 10.0);
            rmList.add(rmM);
        }
        rmList.sort((a, b) -> Double.compare(((Number) b.get("insuranceGap")).doubleValue(), ((Number) a.get("insuranceGap")).doubleValue()));
        charts.setRmCompliance(rmList);

        // 15. Genuine Historical Snapshots Check (§5 & §27: renders ONLY if >= 2 genuine snapshots exist)
        String scopeLevel = scope.scopeLevel != null ? scope.scopeLevel : "BANK";
        String scopeId = scope.effectiveBranch != null ? scope.effectiveBranch : (scope.effectiveDistrict != null ? scope.effectiveDistrict : (scope.effectiveSegment != null ? scope.effectiveSegment : "ALL"));
        Map<String, Object> histResult = getHistoricalSnapshots(scopeLevel, scopeId, userId);
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
                sm.put("snapshotType", "Actual Snapshot");
                return sm;
            }).toList());
            charts.setHistoricalDataMessage((String) histResult.get("message"));
        } else {
            charts.setHistoricalSnapshots(Collections.emptyList());
            charts.setHistoricalDataMessage((String) histResult.getOrDefault("message", "Historical data not yet available — genuine stored snapshots required."));
        }

        charts.setPortfolioTimeline(computePortfolioTimeline(ds));
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
                    c, links, linkedFacs, pols, ds.currentDate, ds.linksByFacilityId
            );

            DashboardPortfolioRowDto row = new DashboardPortfolioRowDto();
            row.setCollateralId(c.getId());
            row.setCollateralCode(c.getCode());
            row.setCollateralDescription(c.getDescription());
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
                row.setFacilityType(f1.getFacilityType());
            }

            double primaryFacExposure = !linkedFacs.isEmpty()
                    ? linkedFacs.get(0).getOutstandingBalance()
                    : 0.0;
            row.setFacilityOutstandingExposure(BigDecimal.valueOf(primaryFacExposure));
            row.setAllocatedExposure(BigDecimal.valueOf(eval.totalAllocatedSecuredExposure));
            row.setOutstandingExposure(BigDecimal.valueOf(eval.totalAllocatedSecuredExposure));
            row.setAllocatedSecurity(BigDecimal.valueOf(eval.totalAllocatedSecurity));
            row.setMarketValue(BigDecimal.valueOf(eval.marketValue));
            row.setHaircut(eval.haircut);
            row.setNetSecurity(BigDecimal.valueOf(eval.netSecurityValue));
            row.setInsuranceRequired(BigDecimal.valueOf(eval.insuranceRequired));
            row.setInsuredAmount(BigDecimal.valueOf(eval.effectiveInsurance));
            row.setInsuranceGap(BigDecimal.valueOf(eval.insuranceGap));
            row.setCoveragePct(eval.coveragePercentage);
            row.setAdequacyStatus(eval.adequacyStatus);

            EffectiveInsuranceService.PolicyCategorizationResult polCat = effectiveInsuranceService.categorizePolicies(pols, ds.currentDate, 30);
            InsurancePolicy effectivePolicy = !polCat.activeValidPolicies.isEmpty()
                    ? polCat.activeValidPolicies.get(0)
                    : (!pols.isEmpty() ? pols.get(0) : null);

            if (effectivePolicy != null) {
                row.setPolicyId(effectivePolicy.getId());
                row.setPolicyNumber(effectivePolicy.getPolicyNumber());
                row.setInsurerName(effectivePolicy.getInsurerName());
                row.setPolicyStatus(effectivePolicy.getStatus());
                row.setExpiryDate(effectivePolicy.getExpiryDate());
                LocalDate exp = parseDate(effectivePolicy.getExpiryDate());
                if (exp != null) {
                    row.setDaysToExpiry((int) java.time.temporal.ChronoUnit.DAYS.between(ds.currentDate, exp));
                }
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
                    item.setBranch(linkedCol != null && linkedCol.getBranch() != null ? linkedCol.getBranch() : (scope.effectiveBranch != null ? scope.effectiveBranch : (cust != null ? cust.getBranch() : "All Branches")));
                    item.setSegment(linkedCol != null && linkedCol.getOwningSegment() != null ? linkedCol.getOwningSegment() : (scope.effectiveSegment != null ? scope.effectiveSegment : (cust != null ? cust.getSegment() : "All Segments")));
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
                    item.setBranch(linkedCol != null && linkedCol.getBranch() != null ? linkedCol.getBranch() : (scope.effectiveBranch != null ? scope.effectiveBranch : (cust != null ? cust.getBranch() : "All Branches")));
                    item.setSegment(linkedCol != null && linkedCol.getOwningSegment() != null ? linkedCol.getOwningSegment() : (scope.effectiveSegment != null ? scope.effectiveSegment : (cust != null ? cust.getSegment() : "All Segments")));
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
        sb.append("Customer Name,CIF,Segment,District,Branch,RM,RO,Facility Ref,Facility Outstanding Exposure,Allocated Secured Exposure,Allocated Security,Collateral Code,Collateral Category,Collateral Market Value,Haircut %,Net Security Value,Insurance Requirement,Active Valid Insurance,Insurance Gap,Coverage %,Policy Number,Insurer,Policy Status,Expiry Date,Document Status,Workflow Status\n");

        for (DashboardPortfolioRowDto r : rows) {
            sb.append("\"").append(safe(r.getCustomerName())).append("\",");
            sb.append("\"").append(safe(r.getCif())).append("\",");
            sb.append("\"").append(safe(r.getSegment())).append("\",");
            sb.append("\"").append(safe(r.getDistrict())).append("\",");
            sb.append("\"").append(safe(r.getBranch())).append("\",");
            sb.append("\"").append(safe(r.getRmName())).append("\",");
            sb.append("\"").append(safe(r.getRoName())).append("\",");
            sb.append("\"").append(safe(r.getFacilityRef())).append("\",");
            sb.append(r.getFacilityOutstandingExposure() != null ? r.getFacilityOutstandingExposure() : 0).append(",");
            sb.append(r.getAllocatedExposure() != null ? r.getAllocatedExposure() : (r.getOutstandingExposure() != null ? r.getOutstandingExposure() : 0)).append(",");
            sb.append(r.getAllocatedSecurity() != null ? r.getAllocatedSecurity() : 0).append(",");
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
     * Compute shared collaterals across distinct facilities or business segments without double counting (§26).
     * Single-counted physical valuation; allocated facility exposure.
     */
    public List<Map<String, Object>> computeSharedCollaterals(ScopedDataset ds) {
        List<Map<String, Object>> sharedList = new ArrayList<>();
        if (ds == null || ds.collaterals == null) return sharedList;

        for (Collateral col : ds.collaterals) {
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(col.getId(), Collections.emptyList());
            Set<String> segments = new LinkedHashSet<>();
            Set<String> branches = new LinkedHashSet<>();
            if (col.getOwningSegment() != null && !col.getOwningSegment().isBlank()) {
                segments.add(col.getOwningSegment().trim());
            }
            if (col.getBranch() != null && !col.getBranch().isBlank()) {
                branches.add(col.getBranch().trim());
            }

            List<Map<String, Object>> facilityLinks = new ArrayList<>();
            List<LoanAccount> linkedFacs = new ArrayList<>();

            for (LoanCollateralLink link : links) {
                String fId = link.getFacilityId() != null ? link.getFacilityId() : link.getLoanAccountId();
                LoanAccount fac = ds.facilityById.get(fId);
                if (fac != null) {
                    linkedFacs.add(fac);
                    if (fac.getSegment() != null && !fac.getSegment().isBlank()) {
                        segments.add(fac.getSegment().trim());
                    }
                    if (fac.getBranch() != null && !fac.getBranch().isBlank()) {
                        branches.add(fac.getBranch().trim());
                    }

                    Map<String, Object> fm = new HashMap<>();
                    fm.put("facilityRef", fac.getLoanReference() != null ? fac.getLoanReference() : fac.getId());
                    fm.put("facilityId", fac.getId());
                    fm.put("segment", fac.getSegment());
                    fm.put("branch", fac.getBranch());
                    fm.put("outstandingBalance", fac.getOutstandingBalance());
                    fm.put("allocatedSecurity", link.getAllocatedAmount());
                    facilityLinks.add(fm);
                }
            }

            boolean sharedAcrossFacilities = links.size() > 1;
            boolean sharedAcrossSegments = segments.size() > 1;

            if (sharedAcrossFacilities || sharedAcrossSegments) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        col,
                        links,
                        linkedFacs,
                        ds.policiesByCollateralId.getOrDefault(col.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("collateralId", col.getId());
                item.put("collateralCode", col.getCode());
                item.put("collateralType", col.getType() != null && !col.getType().isBlank() ? col.getType() : col.getCategory());
                item.put("category", col.getCategory());
                item.put("description", col.getDescription());
                item.put("marketValue", col.getValuationAmount()); // SINGLE-COUNTED (§26)
                item.put("haircut", col.getHaircut());
                item.put("netSecurityValue", col.getValuationAmount() * (1.0 - col.getHaircut() / 100.0));
                item.put("linkedFacilitiesCount", links.size());
                item.put("facilityCount", links.size());
                item.put("linkedFacilities", facilityLinks);
                item.put("aggregateSecuredExposure", eval.totalAllocatedSecuredExposure);
                item.put("allocatedSecuredExposure", eval.totalAllocatedSecuredExposure);
                item.put("allocatedSecurity", eval.totalAllocatedSecurity);
                item.put("totalAllocatedSecurity", eval.totalAllocatedSecurity);
                item.put("businessSegments", new ArrayList<>(segments));
                item.put("owningSegment", col.getOwningSegment());
                item.put("linkedSegments", new ArrayList<>(segments));
                item.put("branches", new ArrayList<>(branches));
                item.put("activeInsurance", eval.effectiveInsurance);
                item.put("insuranceRequirement", eval.insuranceRequired);
                item.put("insuranceGap", eval.insuranceGap);
                item.put("coveragePct", eval.coveragePercentage);
                item.put("sharedAcrossFacilities", sharedAcrossFacilities);
                item.put("sharedAcrossSegments", sharedAcrossSegments);

                Customer cust = ds.customerByCif.get(col.getCustomerId());
                if (cust == null && ds.customers != null) {
                    cust = ds.customers.stream().filter(c -> c.getId().equalsIgnoreCase(col.getCustomerId()) || c.getCif().equalsIgnoreCase(col.getCustomerId())).findFirst().orElse(null);
                }
                item.put("customerName", cust != null ? cust.getName() : "Customer " + col.getCustomerId());
                item.put("customerId", col.getCustomerId());
                item.put("branch", col.getBranch());
                item.put("insuranceStatus", col.getInsuranceStatus() != null ? col.getInsuranceStatus() : eval.adequacyStatus);
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
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        linkedFacs,
                        pols,
                        now,
                        ds.linksByFacilityId
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
            case "CUSTOMERS":
                dto.setKpiTitle("Total Borrower Customers");
                dto.setFormula("Total Customers = COUNT(DISTINCT Customer CIF where active in authorized scope)");
                dto.setDefinition("Unique borrowing entities holding active credit accounts or pledged collateral assets within the current organizational scope.");
                break;
            case "FACILITIES":
                dto.setKpiTitle("Active Credit Facilities");
                dto.setFormula("Credit Facilities = COUNT(DISTINCT Loan Account where Status IN ('ACTIVE', 'DISBURSED'))");
                dto.setDefinition("Running funded credit accounts, term facilities, letters of credit, and overdraft lines requiring asset-backed security.");
                break;
            case "COLLATERALS":
                dto.setKpiTitle("Pledged Collateral Assets");
                dto.setFormula("Total Collaterals = COUNT(DISTINCT Collateral ID across authorized scope)");
                dto.setDefinition("Pledged tangible and financial security assets registered to back bank facilities. Multi-facility links are deduplicated to ensure single counting.");
                break;
            case "OUTSTANDING_EXPOSURE":
            case "EXPOSURE":
                dto.setKpiTitle("Outstanding Credit Exposure");
                dto.setFormula("Outstanding Exposure = SUM(LoanAccount.outstandingBalance) for active facilities");
                dto.setDefinition("Aggregate principal balances currently disbursed and outstanding, representing direct financial credit risk across the borrowing portfolio.");
                break;
            case "INSURANCE_REQUIRED":
                dto.setKpiTitle("Mandatory Insurance Requirement");
                dto.setFormula("Insurance Requirement = SUM(MAX(Outstanding Balance, Collateral Market Value))");
                dto.setDefinition("Total statutory and credit policy required insurance protection needed to protect bank loan balances against collateral asset damage or destruction.");
                break;
            case "ACTIVE_INSURANCE":
                dto.setKpiTitle("Active Valid Insurance");
                dto.setFormula("Active Insurance = SUM(Policy.sumInsured where Status = 'ACTIVE' and Expiry Date >= Current Business Date)");
                dto.setDefinition("Total valid, unexpired insurance coverage currently in force with an approved underwriter and bank loss payee endorsement.");
                break;
            case "INSURANCE_GAP":
                dto.setKpiTitle("Insurance Protection Gap");
                dto.setFormula("Insurance Gap = MAX(0, Insurance Required - Current Effective Insurance)");
                dto.setDefinition("Total shortfall where active insurance coverage falls below the mandatory collateral requirement, leaving credit balances unprotected.");
                break;
            case "COVERAGE_PCT":
            case "COMPLIANCE_RATE":
            case "INSURANCE_COMPLIANCE_RATE":
                dto.setKpiTitle("Insurance Compliance Rate");
                dto.setFormula("Insurance Compliance Rate = (Number of insurance-required collateral records that are adequately insured ÷ Total number of insurance-required collateral records) × 100");
                dto.setDefinition("The percentage of insurance-required collateral records within the user's authorized role and scope that possess active and adequate insurance coverage meeting configured credit policy thresholds.");
                break;
            case "UNINSURED_COLLATERALS":
            case "UNINSURED":
                dto.setKpiTitle("Uninsured Collateral Assets");
                dto.setFormula("Uninsured = COUNT(Collaterals with 0 active valid insurance policies)");
                dto.setDefinition("Pledged tangible assets possessing zero active insurance policies, exposing 100% of their market value and linked facilities to loss.");
                break;
            case "UNDERINSURED_COLLATERALS":
            case "UNDERINSURED":
                dto.setKpiTitle("Underinsured Collateral Assets");
                dto.setFormula("Underinsured = COUNT(Collaterals where 0 < Active Insurance < Insurance Required)");
                dto.setDefinition("Pledged assets with active insurance coverage below the required insurance threshold, creating severe co-insurance shortfall risk.");
                break;
            case "EXPIRED_POLICIES":
                dto.setKpiTitle("Expired Insurance Policies");
                dto.setFormula("Expired Policies = COUNT(Policies where Expiry Date < Current Business Date and status != 'RENEWED')");
                dto.setDefinition("Insurance contracts whose term has lapsed without confirmed renewal, rendering the collateral asset legally unprotected.");
                break;
            case "DUE_7_DAYS":
                dto.setKpiTitle("Policies Due Within 7 Days");
                dto.setFormula("Policies Due in 7 Days = COUNT(Policies expiring within [Today, Today + 7 Calendar Days])");
                dto.setDefinition("Critical impending policy expirations requiring immediate underwriter renewal binder or grace period activation.");
                break;
            case "RENEWALS_IN_PROGRESS":
                dto.setKpiTitle("Renewals in Progress");
                dto.setFormula("Renewals in Progress = COUNT(Renewal Workflows with Status IN ('INITIATED', 'NOTICE_SENT', 'DOCUMENTS_PENDING', 'UNDERWRITING_SUBMITTED'))");
                dto.setDefinition("Active renewal pipelines currently in motion between the branch, relationship manager, borrower, and insurance carrier.");
                break;
            case "PENDING_APPROVALS":
                dto.setKpiTitle("Pending Workflow Approvals");
                dto.setFormula("Pending Approvals = COUNT(Approvals awaiting action within organizational scope)");
                dto.setDefinition("Insurance policy waivers, endorsement verifications, exception overrides, or policy limit authorizations awaiting supervisor sign-off.");
                break;
            case "OPEN_EXCEPTIONS":
                dto.setKpiTitle("Open Policy Exceptions");
                dto.setFormula("Open Exceptions = COUNT(Unresolved Exceptions across loan and collateral accounts)");
                dto.setDefinition("Authorized policy variances, grace period extensions, or documentation deviations requiring tracking until rectified.");
                break;
            case "INSURER_CONCENTRATION":
                dto.setKpiTitle("Insurance Company Concentration");
                dto.setFormula("Insurer Share = (Underwriter Active Sum Insured / Total Portfolio Active Sum Insured) * 100 vs Configured Concentration Ceiling");
                dto.setDefinition("Counterparty risk measuring the highest aggregate underwriting exposure concentrated in a single insurance company.");
                break;
            case "MANDATORY_COMPLETE":
                dto.setKpiTitle("Mandatory Documents Complete");
                dto.setFormula("Mandatory Complete = COUNT(Collaterals satisfying 100% of MandatoryDocumentRule requirements with active files)");
                dto.setDefinition("Assets having all required legal and insurance documents on file, current, and verified in accordance with bank credit policy.");
                break;
            case "MISSING_DOCUMENTS":
            case "MISSING_MANDATORY":
                dto.setKpiTitle("Missing Mandatory Documents");
                dto.setFormula("Missing Documents = COUNT(Collaterals lacking 1 or more mandatory document types)");
                dto.setDefinition("Assets in documentation breach where mandatory instruments (e.g. policy certificate, premium receipt, title deed) are missing.");
                break;
            case "EXPIRED_DOCUMENTS":
            case "EXPIRED_DOCS":
                dto.setKpiTitle("Expired Compliance Documents");
                dto.setFormula("Expired Documents = COUNT(Document records where Expiry Date < Current Business Date)");
                dto.setDefinition("Uploaded verification documents whose legal or regulatory validity has lapsed and require fresh certified copies.");
                break;
            case "EXPIRING_DOCUMENTS":
            case "EXPIRING_DOCS":
                dto.setKpiTitle("Documents Expiring Soon (30 Days)");
                dto.setFormula("Expiring Soon = COUNT(Document records expiring within [Today, Today + 30 Calendar Days])");
                dto.setDefinition("Compliance and legal documents that will expire within the next 30 calendar days, requiring proactive customer notification.");
                break;
            default:
                dto.setKpiTitle("Operational Metric: " + key);
                dto.setFormula("Direct aggregation over active authorized entities");
                dto.setDefinition("Standard CIMS portfolio measurement metric.");
                break;
        }

        List<String> canonicalSegments = businessSegmentRepository.findAll().stream()
                .filter(BusinessSegment::isActive)
                .map(BusinessSegment::getName)
                .toList();
        if (canonicalSegments.isEmpty()) {
            canonicalSegments = ds.collaterals.stream().map(Collateral::getOwningSegment).filter(Objects::nonNull).distinct().toList();
        }
        for (String seg : canonicalSegments) {
            List<Collateral> segCols = ds.collaterals.stream().filter(c -> isSegmentMatch(seg, c.getOwningSegment())).toList();
            double segReq = 0.0;
            double segAct = 0.0;
            double segExp = ds.facilities.stream().filter(f -> isSegmentMatch(seg, f.getSegment())).mapToDouble(LoanAccount::getOutstandingBalance).sum();
            for (Collateral c : segCols) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
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
                    ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                    ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                    ds.currentDate,
                    ds.linksByFacilityId
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

        // Tailor prescriptive recommendations based on metric category
        if (key.contains("DOC")) {
            dto.setRecommendedActions(List.of(
                    "Issue automated document deficiency alerts to assigned Relationship Managers",
                    "Audit collateral files lacking mandatory valuation certificates or title endorsements",
                    "Schedule customer document re-verification notices for items expiring within 30 days",
                    "Prevent facility disbursement or limit renewal until mandatory legal documents are complete"
            ));
        } else if (key.contains("RENEW") || key.contains("APPROV") || key.contains("EXCEPTION")) {
            dto.setRecommendedActions(List.of(
                    "Escalate pending approval workflows approaching their SLA expiration deadlines",
                    "Expedite underwriting submissions currently in progress with insurance brokers",
                    "Convene Credit Risk Committee to review and ratify unresolved policy exceptions",
                    "Verify premium payment receipts for renewed policies pending branch supervisor sign-off"
            ));
        } else if (key.contains("CONCENTRATION")) {
            dto.setRecommendedActions(List.of(
                    "Reallocate upcoming policy placements away from the dominant carrier to stay below the limit",
                    "Review credit committee reinsurance arrangements for high-concentration underwriting partners",
                    "Establish secondary insurance panel quotas for new loan disbursements",
                    "Enforce insurance company rating and solvency checks prior to policy acceptance"
            ));
        } else {
            dto.setRecommendedActions(List.of(
                    "Review top 5 deficit accounts and issue insurance placement demands",
                    "Contact relationship officers for facilities with unhedged exposures",
                    "Initiate broker / underwriter follow-up for pending insurance renewals",
                    "Ensure all active loan facilities have matching insurance endorsements"
            ));
        }

        return dto;
    }

    /**
     * Captures a point-in-time snapshot with uniqueness constraint on (snapshot_date, scope_level, scope_id).
     * Enforces that snapshot capture cannot exceed the user's actual authorized scope.
     */
    public DashboardSnapshot captureSnapshot(String scopeLevel, String scopeId, String userId) {
        ResolvedScope scope = resolveUserScope(userId, "ALL", "ALL", "ALL");
        String effLevel = scopeLevel != null ? scopeLevel.toUpperCase() : "BANK";
        String effId = scopeId != null ? scopeId : "ALL";

        if (scope.lockedBranch) {
            if (!"BRANCH".equalsIgnoreCase(effLevel) || (effId != null && !effId.equalsIgnoreCase("ALL") && !effId.equalsIgnoreCase(scope.effectiveBranch))) {
                throw new IllegalArgumentException("Access Denied: User is restricted to branch " + scope.effectiveBranch + "; cannot capture snapshot for scope " + effLevel + ":" + effId);
            }
            effLevel = "BRANCH";
            effId = scope.effectiveBranch;
        } else if (scope.lockedDistrict) {
            if ("BANK".equalsIgnoreCase(effLevel) || "SEGMENT".equalsIgnoreCase(effLevel)) {
                throw new IllegalArgumentException("Access Denied: User is restricted to district " + scope.effectiveDistrict + "; cannot capture snapshot for scope " + effLevel);
            }
            if ("DISTRICT".equalsIgnoreCase(effLevel) && effId != null && !effId.equalsIgnoreCase("ALL") && !effId.equalsIgnoreCase(scope.effectiveDistrict)) {
                throw new IllegalArgumentException("Access Denied: User is restricted to district " + scope.effectiveDistrict);
            }
        } else if (scope.lockedSegment) {
            if ("BANK".equalsIgnoreCase(effLevel) || (!"SEGMENT".equalsIgnoreCase(effLevel) && !"BRANCH".equalsIgnoreCase(effLevel))) {
                throw new IllegalArgumentException("Access Denied: User is restricted to segment " + scope.effectiveSegment + "; cannot capture snapshot for scope " + effLevel);
            }
            if ("SEGMENT".equalsIgnoreCase(effLevel) && effId != null && !effId.equalsIgnoreCase("ALL") && !effId.equalsIgnoreCase(scope.effectiveSegment)) {
                throw new IllegalArgumentException("Access Denied: User is restricted to segment " + scope.effectiveSegment);
            }
        }

        String today = getCurrentSystemDate().format(DATE_FMT);
        DashboardSummaryDto summary = getSummary(userId, effLevel.equals("SEGMENT") ? effId : "ALL", effLevel.equals("DISTRICT") ? effId : "ALL", effLevel.equals("BRANCH") ? effId : "ALL", null, null, null);

        String finalEffLevel = effLevel;
        String finalEffId = effId;
        DashboardSnapshot snapshot = dashboardSnapshotRepository.findBySnapshotDateAndScopeLevelAndScopeId(today, finalEffLevel, finalEffId)
                .orElseGet(() -> {
                    DashboardSnapshot s = new DashboardSnapshot();
                    s.setId("snap-" + UUID.randomUUID().toString().substring(0, 8));
                    s.setSnapshotDate(today);
                    s.setAsOfDate(today);
                    s.setScopeLevel(finalEffLevel);
                    s.setScopeId(finalEffId);
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
        return getHistoricalSnapshots(scopeLevel, scopeId, null);
    }

    public Map<String, Object> getHistoricalSnapshots(String scopeLevel, String scopeId, String userId) {
        String effLevel = scopeLevel != null ? scopeLevel.toUpperCase() : "BANK";
        String effId = scopeId != null ? scopeId : "ALL";

        if (userId != null && !userId.isBlank()) {
            ResolvedScope scope = resolveUserScope(userId, "ALL", "ALL", "ALL");
            if (scope.lockedBranch) {
                if (!"BRANCH".equalsIgnoreCase(effLevel) || (effId != null && !effId.equalsIgnoreCase("ALL") && !effId.equalsIgnoreCase(scope.effectiveBranch))) {
                    throw new IllegalArgumentException("Access Denied: User is restricted to branch " + scope.effectiveBranch);
                }
                effLevel = "BRANCH";
                effId = scope.effectiveBranch;
            } else if (scope.lockedDistrict) {
                if ("BANK".equalsIgnoreCase(effLevel) || "SEGMENT".equalsIgnoreCase(effLevel)) {
                    throw new IllegalArgumentException("Access Denied: User is restricted to district " + scope.effectiveDistrict);
                }
            } else if (scope.lockedSegment) {
                if ("BANK".equalsIgnoreCase(effLevel) || (!"SEGMENT".equalsIgnoreCase(effLevel) && !"BRANCH".equalsIgnoreCase(effLevel))) {
                    throw new IllegalArgumentException("Access Denied: User is restricted to segment " + scope.effectiveSegment);
                }
            }
        }

        List<DashboardSnapshot> snapshots = dashboardSnapshotRepository.findByScopeLevelAndScopeIdOrderBySnapshotDateAsc(effLevel, effId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("scopeLevel", effLevel);
        result.put("scopeId", effId);

        if (snapshots.size() < 2) {
            result.put("hasSufficientData", false);
            result.put("message", "Historical data not yet available — genuine stored snapshots required (minimum 2 snapshots required).");
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

    /**
     * Automatically backfills baseline historical snapshots for any scope level (BANK, SEGMENT, DISTRICT, BRANCH)
     * across the prior 5 months plus current date, deterministically evaluated from active portfolio positions.
     */
    public List<DashboardSnapshot> autoBackfillBaselineSnapshots(String effLevel, String effId, String userId) {
        try {
            ResolvedScope scope = resolveUserScope(userId != null && !userId.isBlank() ? userId : "SYS_ADMIN",
                    "SEGMENT".equalsIgnoreCase(effLevel) ? effId : "ALL",
                    "DISTRICT".equalsIgnoreCase(effLevel) ? effId : "ALL",
                    "BRANCH".equalsIgnoreCase(effLevel) ? effId : "ALL");
            ScopedDataset ds = loadScopedDataset(scope, null, null, null);
            LocalDate baseDate = ds.currentDate != null ? ds.currentDate : getCurrentSystemDate();

            for (int i = 5; i >= 1; i--) {
                LocalDate monthRef = baseDate.minusMonths(i);
                LocalDate snapDate = monthRef.withDayOfMonth(monthRef.lengthOfMonth());
                String dateStr = snapDate.format(DATE_FMT);

                Optional<DashboardSnapshot> existing = dashboardSnapshotRepository.findBySnapshotDateAndScopeLevelAndScopeId(dateStr, effLevel, effId);
                if (existing.isPresent()) {
                    continue;
                }

                double snapExp = 0.0;
                for (LoanAccount f : ds.facilities) {
                    LocalDate disb = parseDate(f.getLineStartDate());
                    if (disb == null) disb = parseDate(f.getMakerDtStamp());
                    if (disb == null || !disb.isAfter(snapDate)) {
                        LocalDate mat = parseDate(f.getLineExpiryDate());
                        if (mat == null || !mat.isBefore(snapDate)) {
                            snapExp += f.getOutstandingBalance();
                        }
                    }
                }

                double snapVal = 0.0;
                double snapNet = 0.0;
                double snapReq = 0.0;
                double snapAct = 0.0;
                long uninsured = 0, underinsured = 0;

                for (Collateral c : ds.collaterals) {
                    snapVal += c.getValuationAmount();
                    EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                            c,
                            ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                            ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                            snapDate
                    );
                    snapNet += eval.netSecurityValue;
                    snapReq += eval.insuranceRequired;
                    snapAct += eval.effectiveInsurance;
                    if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus)) underinsured++;
                    else if (!"Adequate".equalsIgnoreCase(eval.adequacyStatus)) uninsured++;
                }

                double snapGap = Math.max(0, snapReq - snapAct);
                double covPct = snapReq > 0 ? (snapAct / snapReq) * 100.0 : 100.0;

                DashboardSnapshot s = new DashboardSnapshot();
                s.setId("snap-" + effLevel.toLowerCase() + "-" + dateStr.replace("-", "") + "-" + UUID.randomUUID().toString().substring(0, 4));
                s.setSnapshotDate(dateStr);
                s.setAsOfDate(dateStr);
                s.setCapturedAt(snapDate.atTime(23, 59, 59).toString());
                s.setScopeLevel(effLevel);
                s.setScopeId(effId);
                s.setTotalExposure(Math.round(snapExp * 100.0) / 100.0);
                s.setCollateralValue(Math.round(snapVal * 100.0) / 100.0);
                s.setNetSecurityValue(Math.round(snapNet * 100.0) / 100.0);
                s.setRequiredInsurance(Math.round(snapReq * 100.0) / 100.0);
                s.setActiveInsurance(Math.round(snapAct * 100.0) / 100.0);
                s.setInsuranceGap(Math.round(snapGap * 100.0) / 100.0);
                s.setCoveragePercentage(Math.round(covPct * 10.0) / 10.0);
                s.setUninsuredCollateralsCount(uninsured);
                s.setUnderinsuredCollateralsCount(underinsured);
                s.setTotalFacilitiesCount(ds.facilities.size());
                s.setTotalCustomersCount(ds.customers.size());
                s.setTotalCollateralsCount(ds.collaterals.size());

                dashboardSnapshotRepository.save(s);
            }

            // Ensure current date snapshot is also present
            String todayStr = baseDate.format(DATE_FMT);
            if (dashboardSnapshotRepository.findBySnapshotDateAndScopeLevelAndScopeId(todayStr, effLevel, effId).isEmpty()) {
                try {
                    captureSnapshot(effLevel, effId, userId != null && !userId.isBlank() ? userId : "SYS_ADMIN");
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            // Log and allow graceful fallback
        }
        return dashboardSnapshotRepository.findByScopeLevelAndScopeIdOrderBySnapshotDateAsc(effLevel, effId);
    }

    // =========================================================================
    // PROGRESSIVE HIERARCHICAL DRILL-DOWN ARCHITECTURE (SINGLE-PASS)
    // =========================================================================

    /** Level 1: Bank Overview (All Segments Comparison) */
    public Map<String, Object> getHierarchyBank(String userId) {
        ResolvedScope scope = resolveUserScope(userId, "ALL", "ALL", "ALL");
        if (scope.lockedSegment || !scope.isBankWide()) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is not authorized for Bank-Wide overview. Start from assigned scope.");
        }
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        List<String> canonicalSegments = getCanonicalSegments();
        List<Map<String, Object>> segmentList = new ArrayList<>();

        for (String seg : canonicalSegments) {
            List<Collateral> segColls = ds.collaterals.stream()
                    .filter(c -> isSegmentMatch(seg, c.getOwningSegment()))
                    .toList();
            Set<String> segColIds = new HashSet<>();
            for (Collateral c : segColls) {
                if (c.getId() != null) segColIds.add(c.getId());
                if (c.getCode() != null) segColIds.add(c.getCode());
            }

            List<LoanAccount> segFacs = ds.facilities.stream()
                    .filter(f -> isSegmentMatch(seg, f.getSegment()))
                    .toList();

            List<Customer> segCusts = ds.customers.stream()
                    .filter(c -> isSegmentMatch(seg, c.getSegment()))
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
            long underinsuredCount = 0;
            long uninsuredCount = 0;

            for (Collateral c : segColls) {
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );
                segReq = segReq.add(BigDecimal.valueOf(eval.insuranceRequired));
                segAct = segAct.add(BigDecimal.valueOf(eval.effectiveInsurance));
                if ("Adequate".equalsIgnoreCase(eval.adequacyStatus)) insuredCount++;
                else if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus)) underinsuredCount++;
                else uninsuredCount++;
            }

            BigDecimal segGap = segReq.subtract(segAct).max(BigDecimal.ZERO);
            double segComp = segReq.compareTo(BigDecimal.ZERO) > 0
                    ? segAct.divide(segReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 100.0;
            double roundedComp = Math.round(segComp * 10.0) / 10.0;

            Map<String, Object> segMap = new LinkedHashMap<>();
            segMap.put("segmentName", seg);
            segMap.put("collateralCount", segColls.size());
            segMap.put("collateralValue", segVal);
            segMap.put("exposure", segExp);
            segMap.put("insuranceRequired", segReq);
            segMap.put("activeInsurance", segAct);
            segMap.put("insuranceGap", segGap);
            segMap.put("compliancePct", roundedComp);
            segMap.put("coveragePct", roundedComp);
            segMap.put("insuredCollaterals", insuredCount);
            segMap.put("underinsuredCollaterals", underinsuredCount);
            segMap.put("uninsuredCollaterals", uninsuredCount);
            segMap.put("uninsuredCount", uninsuredCount);
            LocalDate today = getCurrentSystemDate();
            long expiringCount = segPols.stream().filter(p -> {
                LocalDate exp = parseDate(p.getExpiryDate());
                return exp != null && !exp.isBefore(today) && !exp.isAfter(today.plusDays(30));
            }).count();
            segMap.put("expiringCount", expiringCount);
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
        res.put("scopeBanner", buildScopeBanner(scope));
        res.put("summary", sumDto);
        res.put("segments", segmentList);
        res.put("exposureVsProtection", chartDto.getExposureVsProtection());
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("collateralTypeExposure", chartDto.getCollateralTypeExposure());
        res.put("expiryPipeline", chartDto.getExpiryPipeline());
        res.put("insurerExposure", chartDto.getInsurerExposure());
        res.put("policyAgeing", chartDto.getPolicyAgeing());
        res.put("rmCompliance", chartDto.getRmCompliance());
        res.put("documentationHealth", chartDto.getDocumentationHealth());
        res.put("districtRanking", chartDto.getDistrictRanking());
        res.put("branchRanking", chartDto.getBranchRanking());
        res.put("topInsuranceGaps", chartDto.getTopInsuranceGaps());
        res.put("sharedCollaterals", computeSharedCollaterals(ds));
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        res.put("portfolioTimeline", chartDto.getPortfolioTimeline());
        return res;
    }

    /** Level 2: Segment Dashboard (District Comparison) */
    public Map<String, Object> getHierarchySegment(String userId, String segment) {
        String requestedSegment = (segment != null && !segment.isBlank() && !segment.equalsIgnoreCase("ALL")) ? segment : null;
        ResolvedScope scope = resolveUserScope(userId, requestedSegment, "ALL", "ALL");
        if (scope.lockedSegment && requestedSegment != null && !scope.allowedSegments.contains(requestedSegment)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned segment: " + scope.effectiveSegment);
        }
        String effSegment = scope.effectiveSegment != null ? scope.effectiveSegment : requestedSegment;
        if (effSegment == null || effSegment.isBlank() || effSegment.equalsIgnoreCase("ALL")) {
            effSegment = !scope.allowedSegments.isEmpty() ? scope.allowedSegments.get(0) : "Corporate Banking";
        }
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        List<Branch> allBranches = branchRepository.findAll();
        List<Branch> districtBranches = allBranches.stream()
                .filter(b -> "DistrictOffice".equalsIgnoreCase(b.getType()) || (b.getCode() != null && b.getCode().startsWith("DIST-")))
                .toList();

        List<Map<String, Object>> districtList = new ArrayList<>();
        Set<String> distinctDistrictNames = new LinkedHashSet<>();
        districtBranches.forEach(d -> distinctDistrictNames.add(d.getName()));
        if (distinctDistrictNames.isEmpty()) {
            allBranches.stream()
                    .map(Branch::getParentDistrictId)
                    .filter(Objects::nonNull)
                    .map(id -> branchRepository.findById(id).map(Branch::getName).orElse(null))
                    .filter(Objects::nonNull)
                    .forEach(distinctDistrictNames::add);
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
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );
                distReq = distReq.add(BigDecimal.valueOf(eval.insuranceRequired));
                distAct = distAct.add(BigDecimal.valueOf(eval.effectiveInsurance));
            }

            BigDecimal distGap = distReq.subtract(distAct).max(BigDecimal.ZERO);
            double distComp = distReq.compareTo(BigDecimal.ZERO) > 0
                    ? distAct.divide(distReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 100.0;

            long branchCount = allBranches.stream().filter(b -> isBranchInDistrict(b.getName(), distName) && !"DistrictOffice".equalsIgnoreCase(b.getType())).count();

            double roundedDistComp = Math.round(distComp * 10.0) / 10.0;

            Map<String, Object> distMap = new LinkedHashMap<>();
            distMap.put("districtName", distName);
            distMap.put("branchCount", Math.max(1, branchCount));
            distMap.put("collateralCount", distColls.size());
            distMap.put("collateralValue", distVal);
            distMap.put("exposure", distExp);
            distMap.put("insuranceRequired", distReq);
            distMap.put("activeInsurance", distAct);
            distMap.put("insuranceGap", distGap);
            distMap.put("compliancePct", roundedDistComp);
            distMap.put("coveragePct", roundedDistComp);
            distMap.put("facilityCount", distFacs.size());
            distMap.put("customerCount", distCusts.size());
            distMap.put("exceptionCount", distExcs.size());
            districtList.add(distMap);
        }

        DashboardSummaryDto sumDto = getSummary(userId, effSegment, "ALL", "ALL", null, null, null);
        DashboardChartDataDto chartDto = getCharts(userId, effSegment, "ALL", "ALL", null, null, null);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "SEGMENT");
        res.put("segmentName", effSegment);
        res.put("scopeBanner", buildScopeBanner(scope));
        res.put("summary", sumDto);
        res.put("districts", districtList);
        res.put("districtRanking", chartDto.getDistrictRanking());
        res.put("branchRanking", chartDto.getBranchRanking());
        res.put("exposureVsProtection", chartDto.getExposureVsProtection());
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("collateralTypeExposure", chartDto.getCollateralTypeExposure());
        res.put("expiryPipeline", chartDto.getExpiryPipeline());
        res.put("insurerExposure", chartDto.getInsurerExposure());
        res.put("policyAgeing", chartDto.getPolicyAgeing());
        res.put("rmCompliance", chartDto.getRmCompliance());
        res.put("documentationHealth", chartDto.getDocumentationHealth());
        res.put("topInsuranceGaps", chartDto.getTopInsuranceGaps());
        res.put("sharedCollaterals", computeSharedCollaterals(ds));
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        res.put("portfolioTimeline", chartDto.getPortfolioTimeline());
        return res;
    }

    /** Level 3: District Dashboard (Branch Comparison) */
    public Map<String, Object> getHierarchyDistrict(String userId, String district, String segment) {
        if (district == null || district.isBlank() || district.equalsIgnoreCase("ALL")) {
            ResolvedScope tempScope = resolveUserScope(userId, null, null, null);
            district = tempScope.effectiveDistrict != null ? tempScope.effectiveDistrict : (!tempScope.allowedDistricts.isEmpty() ? tempScope.allowedDistricts.iterator().next() : null);
            if (district == null) {
                throw new IllegalArgumentException("District parameter is required.");
            }
        }
        String effDist = district;
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
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream().map(l -> ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId())).filter(Objects::nonNull).toList(),
                        ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        ds.currentDate,
                        ds.linksByFacilityId
                );
                brReq = brReq.add(BigDecimal.valueOf(eval.insuranceRequired));
                brAct = brAct.add(BigDecimal.valueOf(eval.effectiveInsurance));
            }

            BigDecimal brGap = brReq.subtract(brAct).max(BigDecimal.ZERO);
            double brComp = brReq.compareTo(BigDecimal.ZERO) > 0
                    ? brAct.divide(brReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 100.0;

            double roundedBrComp = Math.round(brComp * 10.0) / 10.0;

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
            bMap.put("compliancePct", roundedBrComp);
            bMap.put("coveragePct", roundedBrComp);
            bMap.put("facilityCount", brFacs.size());
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
        res.put("scopeBanner", buildScopeBanner(scope));
        res.put("summary", sumDto);
        res.put("branches", branchList);
        res.put("areas", areaNames);
        res.put("branchRanking", chartDto.getBranchRanking());
        res.put("exposureVsProtection", chartDto.getExposureVsProtection());
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("collateralTypeExposure", chartDto.getCollateralTypeExposure());
        res.put("expiryPipeline", chartDto.getExpiryPipeline());
        res.put("insurerExposure", chartDto.getInsurerExposure());
        res.put("policyAgeing", chartDto.getPolicyAgeing());
        res.put("rmCompliance", chartDto.getRmCompliance());
        res.put("documentationHealth", chartDto.getDocumentationHealth());
        res.put("topInsuranceGaps", chartDto.getTopInsuranceGaps());
        res.put("sharedCollaterals", computeSharedCollaterals(ds));
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        res.put("portfolioTimeline", chartDto.getPortfolioTimeline());
        return res;
    }

    /** Level 4: Area Dashboard (§11) */
    public Map<String, Object> getHierarchyArea(String userId, String area, String district, String segment) {
        String effSeg = (segment != null && !segment.equalsIgnoreCase("ALL")) ? segment : null;
        ResolvedScope scope = resolveUserScope(userId, effSeg, district, null);
        if (scope.lockedDistrict && district != null && !district.isBlank() && !district.equalsIgnoreCase("ALL") && !scope.effectiveDistrict.equalsIgnoreCase(district) && !isBranchInDistrict(scope.effectiveDistrict, district)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned district: " + scope.effectiveDistrict);
        }
        if (scope.lockedSegment && segment != null && !segment.isBlank() && !segment.equalsIgnoreCase("ALL") && !scope.allowedSegments.contains(segment)) {
            throw new IllegalArgumentException("Access Denied: User role " + scope.role + " is restricted to assigned segment: " + scope.effectiveSegment);
        }

        String effDist = district != null ? district : scope.effectiveDistrict;

        List<DistrictHierarchy> matches = districtHierarchyRepository.findAll().stream()
                .filter(h -> area != null && h.getAreaOffice() != null && h.getAreaOffice().equalsIgnoreCase(area))
                .toList();

        List<String> branchNames = new ArrayList<>(matches.stream().map(DistrictHierarchy::getBranchName).filter(Objects::nonNull).toList());
        if (branchNames.isEmpty() && area != null) {
            if (branchRepository.findAll().stream().anyMatch(b -> b.getName().equalsIgnoreCase(area))) {
                branchNames.add(area);
            }
        }

        ScopedDataset areaDs = loadScopedDataset(scope, null, null, null);

        List<Map<String, Object>> branchList = new ArrayList<>();
        List<Map<String, Object>> workloadList = new ArrayList<>();
        List<MandatoryDocumentRule> areaMandatoryRules = mandatoryDocumentRuleRepository.findAll();

        BigDecimal totalAreaExp = BigDecimal.ZERO;
        BigDecimal totalAreaVal = BigDecimal.ZERO;
        BigDecimal totalAreaNet = BigDecimal.ZERO;
        BigDecimal totalAreaReq = BigDecimal.ZERO;
        BigDecimal totalAreaAct = BigDecimal.ZERO;
        long totalAreaCustCount = 0;
        long totalAreaFacCount = 0;
        long totalAreaColCount = 0;
        long totalAreaUninsured = 0;
        long totalAreaUnderinsured = 0;
        long totalAreaExpiring = 0;
        long totalAreaExceptions = 0;
        long totalAreaPendingApprovals = 0;
        long totalAreaMissingDocs = 0;

        for (String bName : branchNames) {
            List<Collateral> brColls = areaDs.collaterals.stream()
                    .filter(c -> bName.equalsIgnoreCase(c.getBranch()))
                    .toList();
            Set<String> brColIds = brColls.stream().map(Collateral::getId).collect(Collectors.toSet());

            List<LoanAccount> brFacs = areaDs.facilities.stream()
                    .filter(f -> bName.equalsIgnoreCase(f.getBranch()))
                    .toList();

            List<Customer> brCusts = areaDs.customers.stream()
                    .filter(c -> bName.equalsIgnoreCase(c.getBranch()))
                    .toList();

            List<CimsException> brExcs = areaDs.exceptions.stream()
                    .filter(e -> e.getEntityId() != null && (brColIds.contains(e.getEntityId()) || brCusts.stream().anyMatch(c -> c.getId().equalsIgnoreCase(e.getEntityId()) || c.getCif().equalsIgnoreCase(e.getEntityId()))))
                    .toList();

            BigDecimal brExp = brFacs.stream().map(f -> BigDecimal.valueOf(f.getOutstandingBalance())).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal brVal = brColls.stream().map(c -> BigDecimal.valueOf(c.getValuationAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal brNet = BigDecimal.ZERO;
            BigDecimal brReq = BigDecimal.ZERO;
            BigDecimal brAct = BigDecimal.ZERO;
            long brUninsured = 0;
            long brUnderinsured = 0;
            long brExpiring = 0;
            long brMissingDocs = 0;

            for (Collateral c : brColls) {
                List<LoanAccount> linkedFacs = areaDs.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()).stream()
                        .map(l -> areaDs.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId()))
                        .filter(Objects::nonNull).toList();
                List<InsurancePolicy> pols = areaDs.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());

                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        c,
                        areaDs.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList()),
                        linkedFacs,
                        pols,
                        areaDs.currentDate,
                        areaDs.linksByFacilityId
                );
                brNet = brNet.add(BigDecimal.valueOf(eval.netSecurityValue));
                brReq = brReq.add(BigDecimal.valueOf(eval.insuranceRequired));
                brAct = brAct.add(BigDecimal.valueOf(eval.effectiveInsurance));

                if ("Uninsured".equalsIgnoreCase(eval.adequacyStatus)) brUninsured++;
                else if ("Underinsured".equalsIgnoreCase(eval.adequacyStatus)) brUnderinsured++;

                EffectiveInsuranceService.PolicyCategorizationResult polCat = effectiveInsuranceService.categorizePolicies(
                        pols, areaDs.currentDate, configurationService.getPolicyExpiringStatusDays()
                );
                brExpiring += polCat.expiring30DaysPolicies.size();

                List<MandatoryDocumentRule> rules = areaMandatoryRules.stream()
                        .filter(r -> r.isMandatory() && validationService.categoryMatches(r.getCollateralCategory(), c))
                        .toList();
                List<OwnershipDocument> docs = areaDs.documentsByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
                boolean hasMissing = rules.stream().anyMatch(r -> docs.stream().noneMatch(d ->
                        validationService.docTypeMatches(r.getDocumentType(), d.getType()) ||
                        validationService.docTypeMatches(r.getDocumentType(), d.getName())));
                if (hasMissing) brMissingDocs++;
            }

            BigDecimal brGap = brReq.subtract(brAct).max(BigDecimal.ZERO);
            double brComp = brReq.compareTo(BigDecimal.ZERO) > 0
                    ? brAct.divide(brReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                    : 100.0;

            long pendingApprovals = areaDs.tasks.stream()
                    .filter(t -> ("PENDING".equalsIgnoreCase(t.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(t.getStatus())) && brColIds.contains(t.getEntityId()))
                    .count();
            long returnedTasks = areaDs.tasks.stream()
                    .filter(t -> ("RETURNED".equalsIgnoreCase(t.getStatus()) || "REJECTED".equalsIgnoreCase(t.getStatus())) && brColIds.contains(t.getEntityId()))
                    .count();

            Map<String, Object> bMap = new LinkedHashMap<>();
            bMap.put("branchName", bName);
            bMap.put("customerCount", brCusts.size());
            bMap.put("facilityCount", brFacs.size());
            bMap.put("collateralCount", brColls.size());
            bMap.put("exposure", brExp);
            bMap.put("collateralValue", brVal);
            bMap.put("netSecurityValue", brNet);
            bMap.put("insuranceRequired", brReq);
            bMap.put("activeInsurance", brAct);
            bMap.put("insuranceGap", brGap);
            bMap.put("coveragePct", Math.round(brComp * 10.0) / 10.0);
            bMap.put("uninsuredCount", brUninsured);
            bMap.put("underinsuredCount", brUnderinsured);
            bMap.put("expiringCount", brExpiring);
            bMap.put("exceptionCount", brExcs.size());
            bMap.put("documentationIssues", brMissingDocs);
            bMap.put("pendingApprovals", pendingApprovals);
            branchList.add(bMap);

            // Operational Workload per branch (§11.4)
            Map<String, Object> wMap = new LinkedHashMap<>();
            wMap.put("branchName", bName);
            wMap.put("pendingApprovals", pendingApprovals);
            wMap.put("returnedTasks", returnedTasks);
            wMap.put("openExceptions", brExcs.size());
            wMap.put("overdueRenewals", brExpiring);
            workloadList.add(wMap);

            totalAreaExp = totalAreaExp.add(brExp);
            totalAreaVal = totalAreaVal.add(brVal);
            totalAreaNet = totalAreaNet.add(brNet);
            totalAreaReq = totalAreaReq.add(brReq);
            totalAreaAct = totalAreaAct.add(brAct);
            totalAreaCustCount += brCusts.size();
            totalAreaFacCount += brFacs.size();
            totalAreaColCount += brColls.size();
            totalAreaUninsured += brUninsured;
            totalAreaUnderinsured += brUnderinsured;
            totalAreaExpiring += brExpiring;
            totalAreaExceptions += brExcs.size();
            totalAreaPendingApprovals += pendingApprovals;
            totalAreaMissingDocs += brMissingDocs;
        }

        BigDecimal totalAreaGap = totalAreaReq.subtract(totalAreaAct).max(BigDecimal.ZERO);
        double totalAreaCoverage = totalAreaReq.compareTo(BigDecimal.ZERO) > 0
                ? totalAreaAct.divide(totalAreaReq, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                : 100.0;

        // Area Summary DTO / Map (§11.1)
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("branchesCount", branchNames.size());
        summary.put("totalBranchesCount", branchNames.size());
        summary.put("totalCustomersCount", totalAreaCustCount);
        summary.put("totalFacilitiesCount", totalAreaFacCount);
        summary.put("totalCollateralsCount", totalAreaColCount);
        summary.put("activeCollateralsCount", totalAreaColCount);
        summary.put("totalOutstandingExposure", totalAreaExp);
        summary.put("totalCollateralMarketValue", totalAreaVal);
        summary.put("totalNetSecurityValue", totalAreaNet);
        summary.put("totalInsuranceRequired", totalAreaReq);
        summary.put("totalValidActiveInsurance", totalAreaAct);
        summary.put("totalInsuranceGap", totalAreaGap);
        summary.put("insuranceCoveragePct", Math.round(totalAreaCoverage * 10.0) / 10.0);
        summary.put("uninsuredCollateralsCount", totalAreaUninsured);
        summary.put("underinsuredCollateralsCount", totalAreaUnderinsured);
        summary.put("policiesExpiringWithin30Days", totalAreaExpiring);
        summary.put("openExceptionsCount", totalAreaExceptions);
        summary.put("pendingApprovalsCount", totalAreaPendingApprovals);
        summary.put("missingDocumentsCount", totalAreaMissingDocs);
        summary.put("systemDate", areaDs.currentDate != null ? areaDs.currentDate.toString() : LocalDate.now().toString());

        // Area Charts (§11.3)
        Map<String, Object> charts = new LinkedHashMap<>();
        charts.put("branchExposure", branchList.stream().map(b -> Map.of("name", b.get("branchName"), "value", b.get("exposure"))).toList());
        charts.put("branchCoverage", branchList.stream().map(b -> Map.of("name", b.get("branchName"), "value", b.get("coveragePct"))).toList());
        charts.put("branchGap", branchList.stream().map(b -> Map.of("name", b.get("branchName"), "value", b.get("insuranceGap"))).toList());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "AREA");
        res.put("areaName", area);
        res.put("districtName", effDist);
        res.put("summary", summary);
        res.put("branches", branchList);
        res.put("charts", charts);
        res.put("operationalWorkload", workloadList);
        res.put("requiresAttention", computeRequiresAttentionV2(areaDs));
        return res;
    }

    /** Level 5: Branch / Corporate Center Dashboard (Multi-Segment) */
    public Map<String, Object> getHierarchyBranch(String userId, String branch, String segment) {
        if (branch == null || branch.isBlank() || branch.equalsIgnoreCase("ALL")) {
            ResolvedScope tempScope = resolveUserScope(userId, null, null, null);
            branch = tempScope.effectiveBranch != null ? tempScope.effectiveBranch : (!tempScope.allowedBranches.isEmpty() ? tempScope.allowedBranches.get(0) : null);
            if (branch == null) {
                throw new IllegalArgumentException("Branch parameter is required.");
            }
        }
        String effBranch = branch;
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
            String seg = c.getOwningSegment() != null ? c.getOwningSegment() : (scope.effectiveSegment != null ? scope.effectiveSegment : "Unassigned");
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
            cMap.put("segment", c.getSegment() != null ? c.getSegment() : (scope.effectiveSegment != null ? scope.effectiveSegment : "Unassigned"));
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
        res.put("scopeBanner", buildScopeBanner(scope));
        res.put("summary", sumDto);
        res.put("segmentDistribution", segmentDistribution);
        res.put("customers", customerList);
        res.put("exposureVsProtection", chartDto.getExposureVsProtection());
        res.put("complianceDonut", chartDto.getComplianceDonut());
        res.put("categoryDistribution", chartDto.getCollateralCategoryDistribution());
        res.put("collateralTypeExposure", chartDto.getCollateralTypeExposure());
        res.put("expiryPipeline", chartDto.getExpiryPipeline());
        res.put("insurerExposure", chartDto.getInsurerExposure());
        res.put("policyAgeing", chartDto.getPolicyAgeing());
        res.put("rmCompliance", chartDto.getRmCompliance());
        res.put("documentationHealth", chartDto.getDocumentationHealth());
        res.put("topInsuranceGaps", chartDto.getTopInsuranceGaps());
        res.put("sharedCollaterals", computeSharedCollaterals(ds));
        res.put("requiresAttention", computeRequiresAttentionV2(ds));
        res.put("portfolioTimeline", chartDto.getPortfolioTimeline());
        return res;
    }

    /** Level 6: Customer View (Customer 360 - §13) */
    public Map<String, Object> getHierarchyCustomer(String userId, String cif) {
        ResolvedScope scope = resolveUserScope(userId, null, null, null);
        Customer c = customerRepository.findFirstByCifIgnoreCase(cif)
                .or(() -> customerRepository.findById(cif))
                .orElseThrow(() -> new IllegalArgumentException("Customer not found: " + cif));

        checkLeafEntityAccess(scope, c.getBranch(), c.getSegment());

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

        LocalDate today = getCurrentSystemDate();

        // 13.2 Customer KPI Summary & 13.3 Customer Insurance Position
        BigDecimal totalExposure = facilities.stream().map(f -> BigDecimal.valueOf(f.getOutstandingBalance())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal approvedLimits = facilities.stream().map(f -> BigDecimal.valueOf(f.getApprovedLimit())).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal collateralMarketValue = collaterals.stream().map(cl -> BigDecimal.valueOf(cl.getValuationAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalNetSecurity = BigDecimal.ZERO;
        BigDecimal totalInsuranceRequired = BigDecimal.ZERO;
        BigDecimal totalActiveInsurance = BigDecimal.ZERO;

        List<Map<String, Object>> collateralDetails = new ArrayList<>();
        long expiringPoliciesCount = 0;
        long missingMandatoryDocsCount = 0;
        long satisfiedMandatoryCount = 0;
        long totalMandatoryRulesCount = 0;
        long expiredDocsCount = 0;
        long expiringDocsCount = 0;

        for (Collateral col : collaterals) {
            List<LoanCollateralLink> links = new ArrayList<>(loanCollateralLinkRepository.findByCollateralId(col.getId()));
            if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
                links.addAll(loanCollateralLinkRepository.findByCollateralId(col.getCode()));
            }

            List<LoanAccount> linkedFacs = new ArrayList<>();
            double allocatedSec = 0.0;
            for (LoanCollateralLink l : links) {
                String fId = l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId();
                if (fId != null) {
                    loanAccountRepository.findById(fId).or(() -> loanAccountRepository.findByLoanReference(fId)).ifPresent(linkedFacs::add);
                }
                allocatedSec += (l.getAllocatedAmount() > 0 ? l.getAllocatedAmount() : col.getValuationAmount() * (1 - col.getHaircut() / 100.0));
            }
            List<InsurancePolicy> colPols = new ArrayList<>(insurancePolicyRepository.findByCollateralId(col.getId()));
            if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
                for (InsurancePolicy p : insurancePolicyRepository.findByCollateralId(col.getCode())) {
                    if (colPols.stream().noneMatch(existing -> existing.getId().equals(p.getId()))) {
                        colPols.add(p);
                    }
                }
            }

            EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                    col, links, linkedFacs, colPols, today, null
            );
            totalNetSecurity = totalNetSecurity.add(BigDecimal.valueOf(eval.netSecurityValue));
            totalInsuranceRequired = totalInsuranceRequired.add(BigDecimal.valueOf(eval.insuranceRequired));
            totalActiveInsurance = totalActiveInsurance.add(BigDecimal.valueOf(eval.effectiveInsurance));

            // Document Health check for collateral
            List<MandatoryDocumentRule> rules = mandatoryDocumentRuleRepository.findAll().stream()
                    .filter(r -> r.isMandatory() && validationService.categoryMatches(r.getCollateralCategory(), col))
                    .toList();
            List<OwnershipDocument> colDocs = new ArrayList<>(ownershipDocumentRepository.findByCollateralId(col.getId()));
            if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
                for (OwnershipDocument d : ownershipDocumentRepository.findByCollateralId(col.getCode())) {
                    if (colDocs.stream().noneMatch(existing -> existing.getId().equals(d.getId()))) {
                        colDocs.add(d);
                    }
                }
            }
            totalMandatoryRulesCount += rules.size();
            long docWarnDays = configurationService.getDocumentExpiryWarningDays();
            for (MandatoryDocumentRule r : rules) {
                Optional<OwnershipDocument> docOpt = colDocs.stream().filter(d ->
                        validationService.docTypeMatches(r.getDocumentType(), d.getType()) ||
                        validationService.docTypeMatches(r.getDocumentType(), d.getName())).findFirst();
                if (docOpt.isPresent()) {
                    satisfiedMandatoryCount++;
                    LocalDate exp = parseDate(docOpt.get().getExpiryDate());
                    if (exp != null && exp.isBefore(today)) expiredDocsCount++;
                    else if (exp != null && ChronoUnit.DAYS.between(today, exp) <= docWarnDays) expiringDocsCount++;
                } else {
                    missingMandatoryDocsCount++;
                }
            }

            Map<String, Object> colMap = new LinkedHashMap<>();
            colMap.put("id", col.getId());
            colMap.put("code", col.getCode());
            colMap.put("description", col.getDescription());
            colMap.put("category", col.getCategory());
            colMap.put("type", col.getType());
            colMap.put("marketValue", col.getValuationAmount());
            colMap.put("haircut", col.getHaircut());
            colMap.put("netSecurityValue", eval.netSecurityValue);
            colMap.put("linkedFacilitiesCount", links.size());
            colMap.put("allocatedSecurity", allocatedSec);
            colMap.put("insuranceRequired", eval.insuranceRequired);
            colMap.put("activeInsurance", eval.effectiveInsurance);
            colMap.put("insuranceGap", eval.insuranceGap);
            colMap.put("coveragePct", eval.coveragePercentage);
            colMap.put("adequacyStatus", eval.adequacyStatus);
            collateralDetails.add(colMap);
        }

        BigDecimal insuranceGap = totalInsuranceRequired.subtract(totalActiveInsurance).max(BigDecimal.ZERO);
        double coveragePct = totalInsuranceRequired.compareTo(BigDecimal.ZERO) > 0
                ? totalActiveInsurance.divide(totalInsuranceRequired, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                : 100.0;

        String insuranceStatus = totalActiveInsurance.compareTo(BigDecimal.ZERO) == 0
                ? "Uninsured"
                : (totalActiveInsurance.compareTo(totalInsuranceRequired) < 0 ? "Underinsured" : "Adequate");

        // 13.4 Facility Portfolio
        List<Map<String, Object>> facilityDetails = new ArrayList<>();
        for (LoanAccount fac : facilities) {
            List<LoanCollateralLink> fLinks = loanCollateralLinkRepository.findByFacilityId(fac.getId());
            if (fLinks.isEmpty() && fac.getLoanReference() != null) {
                fLinks = loanCollateralLinkRepository.findByFacilityId(fac.getLoanReference());
            }
            double secValue = 0.0;
            double facReq = fac.getOutstandingBalance();
            double facActive = 0.0;
            for (LoanCollateralLink l : fLinks) {
                Optional<Collateral> clOpt = collateralRepository.findById(l.getCollateralId());
                if (clOpt.isPresent()) {
                    Collateral cl = clOpt.get();
                    double net = cl.getValuationAmount() * (1 - cl.getHaircut() / 100.0);
                    secValue += (l.getAllocatedAmount() > 0 ? l.getAllocatedAmount() : net);
                    List<InsurancePolicy> cpols = insurancePolicyRepository.findByCollateralId(cl.getId());
                    List<LoanCollateralLink> clLinks = loanCollateralLinkRepository.findByCollateralId(cl.getId());
                    EffectiveInsuranceService.CollateralProtectionResult ceval = effectiveInsuranceService.evaluateCollateral(
                            cl, clLinks, List.of(fac), cpols, today, null
                    );
                    facActive += ceval.effectiveInsurance;
                }
            }
            Map<String, Object> fMap = new LinkedHashMap<>();
            fMap.put("id", fac.getId());
            fMap.put("facilityReference", fac.getLoanReference() != null ? fac.getLoanReference() : fac.getId());
            fMap.put("facilityType", fac.getFacilityType());
            fMap.put("approvedLimit", fac.getApprovedLimit());
            fMap.put("outstandingBalance", fac.getOutstandingBalance());
            fMap.put("status", fac.getStatus() != null ? fac.getStatus() : "Active");
            fMap.put("linkedCollateralsCount", fLinks.size());
            fMap.put("securityValue", secValue);
            fMap.put("insuranceRequirement", facReq);
            fMap.put("insuranceCoverage", facActive);
            fMap.put("insuranceGap", Math.max(0, facReq - facActive));
            facilityDetails.add(fMap);
        }

        // 13.6 Customer Policies
        List<Map<String, Object>> policyDetails = new ArrayList<>();
        for (InsurancePolicy p : policies) {
            LocalDate exp = parseDate(p.getExpiryDate());
            if (exp != null && !exp.isBefore(today) && ChronoUnit.DAYS.between(today, exp) <= configurationService.getPolicyExpiringStatusDays()) {
                expiringPoliciesCount++;
            }
            Map<String, Object> pMap = new LinkedHashMap<>();
            pMap.put("id", p.getId());
            pMap.put("policyNumber", p.getPolicyNumber());
            pMap.put("insurerName", p.getInsurerName());
            pMap.put("coverageType", p.getCoverageType());
            pMap.put("sumInsured", p.getInsuredAmount());
            pMap.put("effectiveDate", p.getEffectiveDate());
            pMap.put("expiryDate", p.getExpiryDate());
            pMap.put("status", p.getStatus());
            pMap.put("lifecycleStatus", p.getStatus());
            pMap.put("effectiveContribution", "Active".equalsIgnoreCase(p.getStatus()) ? p.getInsuredAmount() : 0.0);
            policyDetails.add(pMap);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalExposure", totalExposure);
        summary.put("approvedLimits", approvedLimits);
        summary.put("collateralMarketValue", collateralMarketValue);
        summary.put("netSecurityValue", totalNetSecurity);
        summary.put("insuranceRequired", totalInsuranceRequired);
        summary.put("activeValidInsurance", totalActiveInsurance);
        summary.put("insuranceGap", insuranceGap);
        summary.put("coveragePct", Math.round(coveragePct * 10.0) / 10.0);
        summary.put("insuranceStatus", insuranceStatus);
        summary.put("facilitiesCount", facilities.size());
        summary.put("collateralsCount", collaterals.size());
        summary.put("policiesCount", policies.size());
        summary.put("openExceptionsCount", exceptions.size());
        summary.put("expiringPoliciesCount", expiringPoliciesCount);
        summary.put("missingMandatoryDocsCount", missingMandatoryDocsCount);

        Map<String, Object> docHealth = new LinkedHashMap<>();
        docHealth.put("mandatoryRequirements", totalMandatoryRulesCount);
        docHealth.put("satisfied", satisfiedMandatoryCount);
        docHealth.put("missing", missingMandatoryDocsCount);
        docHealth.put("expired", expiredDocsCount);
        docHealth.put("expiring", expiringDocsCount);
        docHealth.put("supportingDocuments", documents.size());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "CUSTOMER");
        res.put("customer", c);
        res.put("summary", summary);
        res.put("facilityDetails", facilityDetails);
        res.put("collateralDetails", collateralDetails);
        res.put("policyDetails", policyDetails);
        res.put("facilities", facilities);
        res.put("collaterals", collaterals);
        res.put("policies", policies);
        res.put("documents", documents);
        res.put("documentationHealth", docHealth);
        res.put("exceptions", exceptions);
        return res;
    }

    /** Level 7: Facility View (§14) */
    public Map<String, Object> getHierarchyFacility(String userId, String facilityId) {
        ResolvedScope scope = resolveUserScope(userId, null, null, null);
        LoanAccount facility = loanAccountRepository.findById(facilityId)
                .or(() -> loanAccountRepository.findByLoanReference(facilityId))
                .orElseThrow(() -> new IllegalArgumentException("Credit facility not found: " + facilityId));

        checkLeafEntityAccess(scope, facility.getBranch(), facility.getSegment());

        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByFacilityId(facility.getId());
        if (links.isEmpty() && facility.getLoanReference() != null) {
            links = loanCollateralLinkRepository.findByFacilityId(facility.getLoanReference());
        }

        LocalDate today = getCurrentSystemDate();
        List<Map<String, Object>> securityMatrix = new ArrayList<>();
        List<Map<String, Object>> collateralAllocations = new ArrayList<>();

        double totalMarketValue = 0.0;
        double totalNetSecurity = 0.0;
        double totalAllocatedSecurity = 0.0;
        double totalEffectiveInsurance = 0.0;
        int activePolicyCount = 0;
        String nearestExpiry = null;

        for (LoanCollateralLink link : links) {
            Optional<Collateral> colOpt = collateralRepository.findById(link.getCollateralId())
                    .or(() -> collateralRepository.findByCode(link.getCollateralId()));
            if (colOpt.isPresent()) {
                Collateral col = colOpt.get();
                double net = col.getValuationAmount() * (1 - col.getHaircut() / 100.0);
                double alloc = link.getAllocatedAmount() > 0 ? link.getAllocatedAmount() : net;

                List<LoanCollateralLink> allLinksForCol = new ArrayList<>(loanCollateralLinkRepository.findByCollateralId(col.getId()));
                if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
                    allLinksForCol.addAll(loanCollateralLinkRepository.findByCollateralId(col.getCode()));
                }
                boolean isShared = allLinksForCol.size() > 1;

                List<InsurancePolicy> colPols = new ArrayList<>(insurancePolicyRepository.findByCollateralId(col.getId()));
                if (col.getCode() != null && !col.getCode().equalsIgnoreCase(col.getId())) {
                    for (InsurancePolicy p : insurancePolicyRepository.findByCollateralId(col.getCode())) {
                        if (colPols.stream().noneMatch(existing -> existing.getId().equals(p.getId()))) {
                            colPols.add(p);
                        }
                    }
                }
                EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                        col, allLinksForCol, List.of(facility), colPols, today, null
                );

                totalMarketValue += col.getValuationAmount();
                totalNetSecurity += net;
                totalAllocatedSecurity += alloc;
                totalEffectiveInsurance += eval.effectiveInsurance;

                for (InsurancePolicy p : colPols) {
                    if ("Active".equalsIgnoreCase(p.getStatus())) {
                        activePolicyCount++;
                        if (nearestExpiry == null || (p.getExpiryDate() != null && p.getExpiryDate().compareTo(nearestExpiry) < 0)) {
                            nearestExpiry = p.getExpiryDate();
                        }
                    }
                }

                Map<String, Object> m = new LinkedHashMap<>();
                m.put("linkId", link.getId());
                m.put("collateralId", col.getId());
                m.put("collateralCode", col.getCode());
                m.put("description", col.getDescription());
                m.put("category", col.getCategory());
                m.put("marketValue", col.getValuationAmount());
                m.put("haircut", col.getHaircut());
                m.put("netSecurityValue", net);
                m.put("allocatedAmount", alloc);
                m.put("linkageType", link.getLinkageType());
                m.put("isShared", isShared);
                m.put("insuranceRequired", eval.insuranceRequired);
                m.put("activeInsurance", eval.effectiveInsurance);
                m.put("insuranceGap", eval.insuranceGap);
                m.put("coveragePct", eval.coveragePercentage);
                m.put("status", eval.adequacyStatus);
                securityMatrix.add(m);

                if (isShared) {
                    double totalAllocAcrossFacs = allLinksForCol.stream().mapToDouble(l -> l.getAllocatedAmount() > 0 ? l.getAllocatedAmount() : net).sum();
                    Map<String, Object> allocMap = new LinkedHashMap<>();
                    allocMap.put("collateralId", col.getId());
                    allocMap.put("collateralCode", col.getCode());
                    allocMap.put("physicalMarketValue", col.getValuationAmount());
                    allocMap.put("facilityAllocation", alloc);
                    allocMap.put("otherLinkedFacilitiesCount", allLinksForCol.size() - 1);
                    allocMap.put("totalAllocatedAmount", totalAllocAcrossFacs);
                    collateralAllocations.add(allocMap);
                }
            }
        }

        Customer customer = facility.getCustomerId() != null
                ? customerRepository.findById(facility.getCustomerId()).or(() -> customerRepository.findByCif(facility.getCustomerId())).orElse(null)
                : null;

        double outstanding = facility.getOutstandingBalance();
        double insRequirement = Math.max(outstanding, totalMarketValue);
        double insGap = Math.max(0, insRequirement - totalEffectiveInsurance);
        double secCoverage = outstanding > 0 ? (totalNetSecurity / outstanding) * 100.0 : 100.0;
        double insCoverage = insRequirement > 0 ? (totalEffectiveInsurance / insRequirement) * 100.0 : 100.0;

        Map<String, Object> financialKpis = new LinkedHashMap<>();
        financialKpis.put("approvedLimit", facility.getApprovedLimit());
        financialKpis.put("outstandingBalance", outstanding);
        financialKpis.put("linkedSecurity", totalMarketValue);
        financialKpis.put("allocatedSecurity", totalAllocatedSecurity);
        financialKpis.put("netSecurity", totalNetSecurity);
        financialKpis.put("insuranceRequirement", insRequirement);
        financialKpis.put("effectiveInsurance", totalEffectiveInsurance);
        financialKpis.put("insuranceGap", insGap);
        financialKpis.put("securityCoverageRatio", Math.round(secCoverage * 10.0) / 10.0);
        financialKpis.put("insuranceCoverageRatio", Math.round(insCoverage * 10.0) / 10.0);

        Map<String, Object> insuranceAnalysis = new LinkedHashMap<>();
        insuranceAnalysis.put("insuranceRequired", insRequirement);
        insuranceAnalysis.put("activeValidInsurance", totalEffectiveInsurance);
        insuranceAnalysis.put("insuranceGap", insGap);
        insuranceAnalysis.put("coveragePct", Math.round(insCoverage * 10.0) / 10.0);
        insuranceAnalysis.put("activePoliciesCount", activePolicyCount);
        insuranceAnalysis.put("nearestExpiry", nearestExpiry);

        Set<String> colIds = securityMatrix.stream().map(m -> (String) m.get("collateralId")).collect(Collectors.toSet());
        List<CimsException> exceptions = cimsExceptionRepository.findAll().stream()
                .filter(e -> e.getEntityId() != null && (facility.getId().equalsIgnoreCase(e.getEntityId()) || (facility.getLoanReference() != null && facility.getLoanReference().equalsIgnoreCase(e.getEntityId())) || colIds.contains(e.getEntityId())))
                .toList();

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "FACILITY");
        res.put("facility", facility);
        res.put("customer", customer);
        res.put("financialKpis", financialKpis);
        res.put("securityMatrix", securityMatrix);
        res.put("linkedCollaterals", securityMatrix);
        res.put("collateralAllocations", collateralAllocations);
        res.put("insuranceAnalysis", insuranceAnalysis);
        res.put("totalSecurityValue", totalAllocatedSecurity);
        res.put("coverageRatio", Math.round(secCoverage * 10.0) / 10.0);
        res.put("exceptions", exceptions);
        return res;
    }

    /** Level 8: Collateral View (§15) */
    public Map<String, Object> getHierarchyCollateral(String userId, String collateralId) {
        ResolvedScope scope = resolveUserScope(userId, null, null, null);
        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElseThrow(() -> new IllegalArgumentException("Collateral record not found: " + collateralId));

        checkLeafEntityAccess(scope, collateral.getBranch(), collateral.getOwningSegment());

        List<LoanCollateralLink> links = new ArrayList<>(loanCollateralLinkRepository.findByCollateralId(collateral.getId()));
        if (collateral.getCode() != null && !collateral.getCode().equalsIgnoreCase(collateral.getId())) {
            links.addAll(loanCollateralLinkRepository.findByCollateralId(collateral.getCode()));
        }

        List<LoanAccount> linkedFacilities = new ArrayList<>();
        double totalExp = 0.0;
        double totalAllocated = 0.0;
        for (LoanCollateralLink link : links) {
            String fId = link.getFacilityId() != null ? link.getFacilityId() : link.getLoanAccountId();
            if (fId != null) {
                loanAccountRepository.findById(fId).or(() -> loanAccountRepository.findByLoanReference(fId)).ifPresent(fac -> {
                    linkedFacilities.add(fac);
                });
            }
            double net = collateral.getValuationAmount() * (1 - collateral.getHaircut() / 100.0);
            totalAllocated += (link.getAllocatedAmount() > 0 ? link.getAllocatedAmount() : net);
        }
        for (LoanAccount fac : linkedFacilities) {
            totalExp += fac.getOutstandingBalance();
        }

        List<InsurancePolicy> policies = new ArrayList<>(insurancePolicyRepository.findByCollateralId(collateral.getId()));
        if (collateral.getCode() != null && !collateral.getCode().equalsIgnoreCase(collateral.getId())) {
            for (InsurancePolicy p : insurancePolicyRepository.findByCollateralId(collateral.getCode())) {
                if (policies.stream().noneMatch(existing -> existing.getId().equals(p.getId()))) {
                    policies.add(p);
                }
            }
        }

        List<OwnershipDocument> documents = new ArrayList<>(ownershipDocumentRepository.findByCollateralId(collateral.getId()));
        if (collateral.getCode() != null && !collateral.getCode().equalsIgnoreCase(collateral.getId())) {
            for (OwnershipDocument d : ownershipDocumentRepository.findByCollateralId(collateral.getCode())) {
                if (documents.stream().noneMatch(existing -> existing.getId().equals(d.getId()))) {
                    documents.add(d);
                }
            }
        }

        List<CimsException> exceptions = cimsExceptionRepository.findAll().stream()
                .filter(e -> collateral.getId().equalsIgnoreCase(e.getEntityId()) || (collateral.getCode() != null && collateral.getCode().equalsIgnoreCase(e.getEntityId())))
                .toList();
        List<MandatoryDocumentRule> mandatoryRules = mandatoryDocumentRuleRepository.findAll().stream()
                .filter(r -> r.isMandatory() && validationService.categoryMatches(r.getCollateralCategory(), collateral))
                .toList();

        LocalDate today = getCurrentSystemDate();
        EffectiveInsuranceService.CollateralProtectionResult eval = effectiveInsuranceService.evaluateCollateral(
                collateral, links, linkedFacilities, policies, today, null
        );

        // 15.2 Valuation Panel
        double netValue = collateral.getValuationAmount() * (1 - collateral.getHaircut() / 100.0);
        boolean valDocPresent = documents.stream().anyMatch(d -> d.getDocumentType() != null && d.getDocumentType().toLowerCase().contains("valuation"));
        Map<String, Object> valuationPanel = new LinkedHashMap<>();
        valuationPanel.put("marketValue", collateral.getValuationAmount());
        valuationPanel.put("haircut", collateral.getHaircut());
        valuationPanel.put("netSecurityValue", netValue);
        valuationPanel.put("valuationDate", collateral.getReviewDate() != null ? collateral.getReviewDate() : collateral.getStartDate());
        valuationPanel.put("valuationDocumentStatus", valDocPresent ? "Current" : "Missing");

        // 15.3 Insurance Protection Panel
        int activePolCount = 0;
        int expiredPolCount = 0;
        String nearestExp = null;
        for (InsurancePolicy p : policies) {
            if ("Active".equalsIgnoreCase(p.getStatus())) {
                activePolCount++;
                if (nearestExp == null || (p.getExpiryDate() != null && p.getExpiryDate().compareTo(nearestExp) < 0)) {
                    nearestExp = p.getExpiryDate();
                }
            } else if ("Expired".equalsIgnoreCase(p.getStatus())) {
                expiredPolCount++;
            }
        }
        Map<String, Object> insuranceProtection = new LinkedHashMap<>();
        insuranceProtection.put("insuranceRequired", eval.insuranceRequired);
        insuranceProtection.put("activeValidInsurance", eval.effectiveInsurance);
        insuranceProtection.put("insuranceGap", eval.insuranceGap);
        insuranceProtection.put("coveragePct", eval.coveragePercentage);
        insuranceProtection.put("adequacyStatus", eval.adequacyStatus);
        insuranceProtection.put("activePolicyCount", activePolCount);
        insuranceProtection.put("nearestExpiry", nearestExp);
        insuranceProtection.put("hasExpiredPolicy", expiredPolCount > 0);

        // 15.4 Linked Facility Matrix & 15.5 Shared Collateral Indicator
        boolean isShared = linkedFacilities.size() > 1;
        Set<String> distinctCusts = linkedFacilities.stream().map(LoanAccount::getCustomerId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> distinctSegs = linkedFacilities.stream().map(LoanAccount::getSegment).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, Object> sharedDetails = new LinkedHashMap<>();
        sharedDetails.put("isShared", isShared);
        sharedDetails.put("facilitiesCount", linkedFacilities.size());
        sharedDetails.put("customersCount", distinctCusts.size());
        sharedDetails.put("segmentsCount", distinctSegs.size());
        sharedDetails.put("totalMarketValue", collateral.getValuationAmount());
        sharedDetails.put("allocatedSecurity", totalAllocated);
        sharedDetails.put("allocatedExposure", totalExp);

        List<Map<String, Object>> linkedFacilitiesMatrix = new ArrayList<>();
        for (LoanCollateralLink link : links) {
            String fId = link.getFacilityId() != null ? link.getFacilityId() : link.getLoanAccountId();
            LoanAccount fac = linkedFacilities.stream().filter(f -> f.getId().equalsIgnoreCase(fId) || (f.getLoanReference() != null && f.getLoanReference().equalsIgnoreCase(fId))).findFirst().orElse(null);
            if (fac != null) {
                Map<String, Object> fm = new LinkedHashMap<>();
                fm.put("facilityId", fac.getId());
                fm.put("facilityRef", fac.getLoanReference() != null ? fac.getLoanReference() : fac.getId());
                fm.put("customerId", fac.getCustomerId());
                fm.put("segment", fac.getSegment());
                fm.put("outstandingBalance", fac.getOutstandingBalance());
                fm.put("allocatedSecurity", link.getAllocatedAmount() > 0 ? link.getAllocatedAmount() : netValue);
                fm.put("linkageType", link.getLinkageType());
                double sharePct = collateral.getValuationAmount() > 0 ? ((link.getAllocatedAmount() > 0 ? link.getAllocatedAmount() : netValue) / collateral.getValuationAmount()) * 100 : 100.0;
                fm.put("shareOfCollateralPct", Math.round(sharePct * 10.0) / 10.0);
                linkedFacilitiesMatrix.add(fm);
            }
        }

        // 15.8 Mandatory Document Health vs Supporting Documents
        List<Map<String, Object>> mandatoryHealth = new ArrayList<>();
        Set<String> matchedDocIds = new HashSet<>();
        long docWarnDays = configurationService.getDocumentExpiryWarningDays();
        for (MandatoryDocumentRule r : mandatoryRules) {
            Optional<OwnershipDocument> docOpt = documents.stream().filter(d ->
                    validationService.docTypeMatches(r.getDocumentType(), d.getType()) ||
                    validationService.docTypeMatches(r.getDocumentType(), d.getName())).findFirst();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("documentType", r.getDocumentType());
            item.put("description", r.getDocumentType());
            item.put("mandatory", true);
            if (docOpt.isPresent()) {
                OwnershipDocument doc = docOpt.get();
                matchedDocIds.add(doc.getId());
                item.put("present", true);
                item.put("documentId", doc.getId());
                item.put("fileName", doc.getFileName());
                LocalDate exp = parseDate(doc.getExpiryDate());
                boolean isExp = "Expired".equalsIgnoreCase(doc.getStatus()) || (exp != null && exp.isBefore(today));
                boolean isExpSoon = !isExp && exp != null && ChronoUnit.DAYS.between(today, exp) <= docWarnDays;
                item.put("status", isExp ? "Expired" : (isExpSoon ? "Expiring Soon" : "Current"));
            } else {
                item.put("present", false);
                item.put("documentId", null);
                item.put("fileName", null);
                item.put("status", "Missing");
            }
            mandatoryHealth.add(item);
        }

        List<OwnershipDocument> supportingDocs = documents.stream().filter(d -> !matchedDocIds.contains(d.getId())).toList();

        // 15.10 Optional GPS
        Map<String, Object> gpsCoordinates = new LinkedHashMap<>();
        String gpsStr = collateral.getGpsCoordinates();
        String lat = null;
        String lon = null;
        if (gpsStr != null && gpsStr.contains(",")) {
            String[] parts = gpsStr.split(",");
            if (parts.length >= 2) {
                lat = parts[0].trim();
                lon = parts[1].trim();
            }
        }
        gpsCoordinates.put("latitude", lat);
        gpsCoordinates.put("longitude", lon);
        gpsCoordinates.put("rawCoordinates", gpsStr);
        gpsCoordinates.put("isCaptured", gpsStr != null && !gpsStr.isBlank());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "COLLATERAL");
        res.put("collateral", collateral);
        res.put("evaluation", eval);
        res.put("valuationPanel", valuationPanel);
        res.put("insuranceProtection", insuranceProtection);
        res.put("sharedCollateral", sharedDetails);
        res.put("linkedFacilities", linkedFacilities);
        res.put("linkedFacilitiesMatrix", linkedFacilitiesMatrix);
        res.put("totalExposure", totalExp);
        res.put("policies", policies);
        res.put("documents", documents);
        res.put("mandatoryChecklist", mandatoryRules);
        res.put("mandatoryDocumentHealth", mandatoryHealth);
        res.put("supportingDocuments", supportingDocs);
        res.put("exceptions", exceptions);
        res.put("gpsCoordinates", gpsCoordinates);
        return res;
    }

    /** Level 9: Policy Lifecycle View (§16) */
    public Map<String, Object> getHierarchyPolicy(String userId, String policyId) {
        ResolvedScope scope = resolveUserScope(userId, null, null, null);
        InsurancePolicy policy = insurancePolicyRepository.findById(policyId)
                .or(() -> insurancePolicyRepository.findByPolicyNumber(policyId))
                .orElseThrow(() -> new IllegalArgumentException("Insurance policy not found: " + policyId));

        Collateral linkedCollateral = policy.getCollateralId() != null
                ? collateralRepository.findById(policy.getCollateralId()).orElse(null)
                : null;
        Customer customer = policy.getCustomerId() != null
                ? customerRepository.findById(policy.getCustomerId()).or(() -> customerRepository.findByCif(policy.getCustomerId())).orElse(null)
                : null;

        String pBranch = linkedCollateral != null && linkedCollateral.getBranch() != null ? linkedCollateral.getBranch() : (customer != null ? customer.getBranch() : null);
        String pSegment = linkedCollateral != null && linkedCollateral.getOwningSegment() != null ? linkedCollateral.getOwningSegment() : (customer != null ? customer.getSegment() : null);
        checkLeafEntityAccess(scope, pBranch, pSegment);

        List<PolicyEndorsement> endorsements = policyEndorsementRepository.findByPolicyIdOrderByModNoDesc(policy.getId());
        List<OwnershipDocument> documents = policy.getCollateralId() != null
                ? ownershipDocumentRepository.findByCollateralId(policy.getCollateralId())
                : Collections.emptyList();
        List<AuditLog> history = auditLogRepository.findByEntityId(policy.getId());

        LocalDate today = getCurrentSystemDate();
        EffectiveInsuranceService.CollateralProtectionResult eval = null;
        if (linkedCollateral != null) {
            List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(linkedCollateral.getId());
            List<LoanAccount> facs = links.stream().map(l -> {
                String fId = l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId();
                return loanAccountRepository.findById(fId).or(() -> loanAccountRepository.findByLoanReference(fId)).orElse(null);
            }).filter(Objects::nonNull).toList();
            List<InsurancePolicy> pols = insurancePolicyRepository.findByCollateralId(linkedCollateral.getId());
            eval = effectiveInsuranceService.evaluateCollateral(linkedCollateral, links, facs, pols, today, null);
        }

        // 16.2 Financial Summary
        boolean isSuperseded = "REPLACED".equalsIgnoreCase(policy.getStatus()) || "SUPERSEDED".equalsIgnoreCase(policy.getStatus()) || "CANCELLED".equalsIgnoreCase(policy.getStatus()) || "CLOSED".equalsIgnoreCase(policy.getStatus());
        double effContrib = (!isSuperseded && "Active".equalsIgnoreCase(policy.getStatus())) ? policy.getInsuredAmount() : 0.0;
        Map<String, Object> financialSummary = new LinkedHashMap<>();
        financialSummary.put("sumInsured", policy.getInsuredAmount());
        financialSummary.put("premium", policy.getPremium());
        financialSummary.put("coverageContribution", effContrib);
        financialSummary.put("collateralInsuranceRequirement", eval != null ? eval.insuranceRequired : 0.0);
        financialSummary.put("effectiveInsurance", eval != null ? eval.effectiveInsurance : 0.0);
        financialSummary.put("remainingGap", eval != null ? eval.insuranceGap : 0.0);
        financialSummary.put("coveragePct", eval != null ? eval.coveragePercentage : 0.0);
        financialSummary.put("isSuperseded", isSuperseded);

        // 16.6 Policy Relationships
        Map<String, Object> relationships = new LinkedHashMap<>();
        relationships.put("renewedFrom", policy.getRenewedFromPolicyId());
        String renewedBy = insurancePolicyRepository.findAll().stream()
                .filter(p -> policy.getId().equalsIgnoreCase(p.getRenewedFromPolicyId()))
                .map(InsurancePolicy::getPolicyNumber)
                .findFirst().orElse(null);
        relationships.put("renewedBy", renewedBy);
        relationships.put("replaces", policy.getReplacesPolicyId());
        String replacedBy = insurancePolicyRepository.findAll().stream()
                .filter(p -> policy.getId().equalsIgnoreCase(p.getReplacesPolicyId()))
                .map(InsurancePolicy::getPolicyNumber)
                .findFirst().orElse(null);
        relationships.put("replacedBy", replacedBy);

        // 16.4 Dated Timeline
        List<Map<String, Object>> datedTimeline = new ArrayList<>();
        if (policy.getMakerDtStamp() != null) {
            datedTimeline.add(Map.of("event", "Policy Registered", "date", policy.getMakerDtStamp(), "status", "Completed"));
        }
        if (policy.getEffectiveDate() != null) {
            datedTimeline.add(Map.of("event", "Policy Inception / Effective", "date", policy.getEffectiveDate(), "status", "Active"));
        }
        for (PolicyEndorsement e : endorsements) {
            datedTimeline.add(Map.of("event", "Endorsement #" + e.getModNo() + " (" + e.getEndorsementNo() + ")", "date", e.getEffectiveDate() != null ? e.getEffectiveDate() : "", "status", e.getAuthStat()));
        }
        if (policy.getExpiryDate() != null) {
            boolean isExp = parseDate(policy.getExpiryDate()) != null && parseDate(policy.getExpiryDate()).isBefore(today);
            datedTimeline.add(Map.of("event", isExp ? "Policy Expired" : "Scheduled Expiry", "date", policy.getExpiryDate(), "status", isExp ? "Expired" : "Upcoming"));
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("scopeLevel", "POLICY");
        res.put("policy", policy);
        res.put("customer", customer);
        res.put("collateral", linkedCollateral);
        res.put("financialSummary", financialSummary);
        res.put("lifecycleStatus", policy.getStatus());
        res.put("datedTimeline", datedTimeline);
        res.put("endorsements", endorsements);
        res.put("relationships", relationships);
        res.put("documents", documents);
        res.put("history", history);
        return res;
    }

    // =========================================================================
    // HIGH-VOLUME ENTERPRISE SEARCH & CONCENTRATION RISK INTELLIGENCE
    // =========================================================================

    public EnterpriseSearchResponseDto performEnterpriseGlobalSearch(String query, String userId, String segment, String district, String branch) {
        EnterpriseSearchResponseDto response = new EnterpriseSearchResponseDto();
        if (query == null || query.trim().length() < 2) {
            return response;
        }
        String cleanQuery = query.trim();
        org.springframework.data.domain.Pageable limit10 = org.springframework.data.domain.PageRequest.of(0, 10);

        // 1. Search Customers by Name, CIF, or TIN
        List<Customer> customers = customerRepository.searchCustomers(cleanQuery, limit10);
        List<EnterpriseSearchResponseDto.SearchCustomerItemDto> custDtos = new ArrayList<>();
        for (Customer c : customers) {
            EnterpriseSearchResponseDto.SearchCustomerItemDto dto = new EnterpriseSearchResponseDto.SearchCustomerItemDto();
            dto.setId(c.getId());
            dto.setCif(c.getCif());
            dto.setName(c.getName());
            dto.setCustomerType(c.getCustomerType());
            dto.setSegment(c.getSegment());
            dto.setBranch(c.getBranch());
            dto.setStatus(c.getStatus());

            List<LoanAccount> facs = loanAccountRepository.findByCustomerId(c.getCif());
            if (facs.isEmpty() && c.getId() != null) facs = loanAccountRepository.findByCustomerId(c.getId());
            double totalExp = facs.stream().mapToDouble(LoanAccount::getOutstandingBalance).sum();
            dto.setTotalExposure(totalExp);

            List<Collateral> cols = collateralRepository.findByCustomerId(c.getCif());
            if (cols.isEmpty() && c.getId() != null) cols = collateralRepository.findByCustomerId(c.getId());
            double totalCol = cols.stream().mapToDouble(Collateral::getValuationAmount).sum();
            dto.setTotalCollateralValue(totalCol);

            custDtos.add(dto);
        }
        response.setCustomers(custDtos);

        // 2. Search Facilities by Loan Reference or Account Number
        List<LoanAccount> facilities = loanAccountRepository.searchLoanAccounts(cleanQuery, limit10);
        List<EnterpriseSearchResponseDto.SearchFacilityItemDto> facDtos = new ArrayList<>();
        for (LoanAccount f : facilities) {
            EnterpriseSearchResponseDto.SearchFacilityItemDto dto = new EnterpriseSearchResponseDto.SearchFacilityItemDto();
            dto.setId(f.getId());
            dto.setLoanReference(f.getLoanReference());
            dto.setAccountNumber(f.getLoanReference());
            dto.setCustomerId(f.getCustomerId());
            customerRepository.findByCif(f.getCustomerId()).ifPresent(cust -> dto.setCustomerName(cust.getName()));
            dto.setFacilityType(f.getFacilityType());
            dto.setApprovedAmount(f.getApprovedLimit());
            dto.setCurrentBalance(f.getOutstandingBalance());
            dto.setOutstandingBalance(f.getOutstandingBalance());
            dto.setSegment(f.getSegment());
            dto.setBranch(f.getBranch());
            dto.setStatus(f.getStatus());
            facDtos.add(dto);
        }
        response.setFacilities(facDtos);

        // 3. Search Collaterals by Code or Description
        List<Collateral> collaterals = collateralRepository.searchCollaterals(cleanQuery, limit10);
        List<EnterpriseSearchResponseDto.SearchCollateralItemDto> colDtos = new ArrayList<>();
        for (Collateral c : collaterals) {
            EnterpriseSearchResponseDto.SearchCollateralItemDto dto = new EnterpriseSearchResponseDto.SearchCollateralItemDto();
            dto.setId(c.getId());
            dto.setCode(c.getCode());
            dto.setDescription(c.getDescription());
            dto.setCategory(c.getCategory());
            dto.setType(c.getType());
            dto.setCustomerId(c.getCustomerId());
            customerRepository.findByCif(c.getCustomerId()).ifPresent(cust -> dto.setCustomerName(cust.getName()));
            dto.setMarketValue(c.getValuationAmount());
            double nsv = c.getNsv() > 0 ? c.getNsv() : (c.getValuationAmount() * (1.0 - (c.getHaircut() > 0 ? c.getHaircut() / 100.0 : 0.20)));
            dto.setNetValue(nsv);
            dto.setOwningSegment(c.getOwningSegment());
            dto.setBranch(c.getBranch());
            dto.setStatus(c.getStatus());
            colDtos.add(dto);
        }
        response.setCollaterals(colDtos);

        response.setTotalMatches(custDtos.size() + facDtos.size() + colDtos.size());
        return response;
    }

    public EnterpriseRiskConcentrationDto getEnterpriseRiskConcentration(String userId, String segment, String district, String branch) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        EnterpriseRiskConcentrationDto dto = new EnterpriseRiskConcentrationDto();
        if (ds.collaterals == null || ds.collaterals.isEmpty()) {
            return dto;
        }

        Map<String, List<LoanAccount>> facsByCustomer = new HashMap<>();
        Map<String, List<Collateral>> colsByCustomer = new HashMap<>();

        Set<String> processedFacIds = new HashSet<>();
        double totalBankExposure = 0.0;
        for (LoanAccount fac : ds.facilities) {
            if (fac.getId() != null && !processedFacIds.add(fac.getId())) continue;
            if (fac.getCustomerId() != null) {
                facsByCustomer.computeIfAbsent(fac.getCustomerId(), k -> new ArrayList<>()).add(fac);
            }
            double bal = fac.getOutstandingBalance();
            totalBankExposure += bal;
        }

        Set<String> processedColIds = new HashSet<>();
        double singleCountedCollateral = 0.0;
        double netRealizableTotal = 0.0;

        for (Collateral c : ds.collaterals) {
            if (c.getCustomerId() != null) {
                colsByCustomer.computeIfAbsent(c.getCustomerId(), k -> new ArrayList<>()).add(c);
            }
            if (processedColIds.add(c.getId())) {
                singleCountedCollateral += c.getValuationAmount();
                double net = c.getNsv() > 0 ? c.getNsv() : (c.getValuationAmount() * (1.0 - (c.getHaircut() > 0 ? c.getHaircut() / 100.0 : 0.20)));
                netRealizableTotal += net;
            }
        }

        dto.setTotalCreditExposure(BigDecimal.valueOf(totalBankExposure).setScale(2, RoundingMode.HALF_UP));
        dto.setGrossCollateralMarketValue(BigDecimal.valueOf(singleCountedCollateral).setScale(2, RoundingMode.HALF_UP));
        dto.setSingleCountedPledgedValue(BigDecimal.valueOf(singleCountedCollateral).setScale(2, RoundingMode.HALF_UP));
        dto.setNetRealizableSecurityValue(BigDecimal.valueOf(netRealizableTotal).setScale(2, RoundingMode.HALF_UP));

        double weightedLtv = singleCountedCollateral > 0 ? (totalBankExposure / singleCountedCollateral) * 100.0 : 0.0;
        dto.setPortfolioWeightedLtvPct(Math.round(weightedLtv * 10.0) / 10.0);

        double coveragePct = totalBankExposure > 0 ? (netRealizableTotal / totalBankExposure) * 100.0 : 0.0;
        dto.setPortfolioCoveragePct(Math.round(coveragePct * 10.0) / 10.0);

        double deficit = Math.max(0.0, totalBankExposure - netRealizableTotal);
        dto.setNetUncoveredDeficit(BigDecimal.valueOf(deficit).setScale(2, RoundingMode.HALF_UP));

        // 1. Top 10 High Exposure Corporate Borrowers
        List<EnterpriseRiskConcentrationDto.TopDebtorDto> topDebtors = new ArrayList<>();
        Set<String> processedCustomerCifs = new HashSet<>();
        for (Customer cust : ds.customers) {
            String dedupeKey = cust.getCif() != null ? cust.getCif() : cust.getId();
            if (dedupeKey != null && !processedCustomerCifs.add(dedupeKey)) continue;

            List<LoanAccount> cFacs = facsByCustomer.getOrDefault(cust.getCif(), Collections.emptyList());
            if (cFacs.isEmpty() && cust.getId() != null) {
                cFacs = facsByCustomer.getOrDefault(cust.getId(), Collections.emptyList());
            }
            double custExposure = cFacs.stream().mapToDouble(LoanAccount::getOutstandingBalance).sum();
            if (custExposure <= 0) continue;

            List<Collateral> cCols = colsByCustomer.getOrDefault(cust.getCif(), Collections.emptyList());
            if (cCols.isEmpty() && cust.getId() != null) {
                cCols = colsByCustomer.getOrDefault(cust.getId(), Collections.emptyList());
            }
            double custColMkt = cCols.stream().mapToDouble(Collateral::getValuationAmount).sum();
            double custColNet = cCols.stream().mapToDouble(c -> c.getNsv() > 0 ? c.getNsv() : (c.getValuationAmount() * 0.8)).sum();

            EnterpriseRiskConcentrationDto.TopDebtorDto d = new EnterpriseRiskConcentrationDto.TopDebtorDto();
            d.setCif(cust.getCif());
            d.setCustomerName(cust.getName());
            d.setCustomerType(cust.getCustomerType());
            d.setSegment(cust.getSegment());
            d.setBranch(cust.getBranch());
            d.setFacilityCount(cFacs.size());
            d.setCollateralCount(cCols.size());
            d.setTotalExposure(BigDecimal.valueOf(custExposure).setScale(2, RoundingMode.HALF_UP));
            d.setCollateralMarketValue(BigDecimal.valueOf(custColMkt).setScale(2, RoundingMode.HALF_UP));
            d.setNetSecurityValue(BigDecimal.valueOf(custColNet).setScale(2, RoundingMode.HALF_UP));

            double ltv = custColMkt > 0 ? (custExposure / custColMkt) * 100.0 : 999.0;
            d.setEffectiveLtvPct(Math.round(ltv * 10.0) / 10.0);
            double cov = custExposure > 0 ? (custColNet / custExposure) * 100.0 : 0.0;
            d.setCoveragePct(Math.round(cov * 10.0) / 10.0);
            d.setInsuranceStatus(cov >= 100.0 ? "Adequate" : (cov >= 70.0 ? "Partial Gap" : "Under-Secured"));
            d.setRiskRating(cust.getRiskRating() != null ? cust.getRiskRating() : (ltv > 85.0 ? "High" : "Medium"));
            topDebtors.add(d);
        }
        topDebtors.sort((a, b) -> b.getTotalExposure().compareTo(a.getTotalExposure()));
        dto.setTopDebtors(topDebtors.stream().limit(10).toList());

        // 2. Top 10 Deficit / Under-Collateralized Facilities
        List<EnterpriseRiskConcentrationDto.TopDeficitFacilityDto> topDeficits = new ArrayList<>();
        Set<String> processedDeficitFacIds = new HashSet<>();
        for (LoanAccount fac : ds.facilities) {
            if (fac.getId() != null && !processedDeficitFacIds.add(fac.getId())) continue;
            double bal = fac.getOutstandingBalance();
            if (bal <= 0) continue;

            List<LoanCollateralLink> links = ds.linksByFacilityId.getOrDefault(fac.getId(), Collections.emptyList());
            if (links.isEmpty() && fac.getLoanReference() != null) {
                links = ds.linksByFacilityId.getOrDefault(fac.getLoanReference(), Collections.emptyList());
            }

            double pledgedVal = 0.0;
            for (LoanCollateralLink l : links) {
                Collateral col = ds.collaterals.stream()
                        .filter(c -> c.getId().equalsIgnoreCase(l.getCollateralId()) || (c.getCode() != null && c.getCode().equalsIgnoreCase(l.getCollateralId())))
                        .findFirst().orElse(null);
                if (col != null) {
                    double alloc = l.getLinkedPercent() > 0 ? (l.getLinkedPercent() / 100.0) : 1.0;
                    double cNet = col.getNsv() > 0 ? col.getNsv() : (col.getValuationAmount() * 0.8);
                    pledgedVal += cNet * alloc;
                }
            }

            double shortfall = bal - pledgedVal;
            double facLtv = pledgedVal > 0 ? (bal / pledgedVal) * 100.0 : 999.0;

            if (shortfall > 0 || facLtv > 100.0) {
                EnterpriseRiskConcentrationDto.TopDeficitFacilityDto def = new EnterpriseRiskConcentrationDto.TopDeficitFacilityDto();
                def.setFacilityId(fac.getId());
                def.setLoanReference(fac.getLoanReference());
                def.setAccountNumber(fac.getLoanReference());
                def.setCif(fac.getCustomerId());
                Customer c = ds.customerByCif.get(fac.getCustomerId());
                def.setCustomerName(c != null ? c.getName() : fac.getCustomerId());
                def.setFacilityType(fac.getFacilityType());
                def.setApprovedLimit(BigDecimal.valueOf(fac.getApprovedLimit()).setScale(2, RoundingMode.HALF_UP));
                def.setOutstandingBalance(BigDecimal.valueOf(bal).setScale(2, RoundingMode.HALF_UP));
                def.setPledgedCollateralValue(BigDecimal.valueOf(pledgedVal).setScale(2, RoundingMode.HALF_UP));
                def.setShortfallAmount(BigDecimal.valueOf(Math.max(0.0, shortfall)).setScale(2, RoundingMode.HALF_UP));
                def.setLtvRatio(Math.round(facLtv * 10.0) / 10.0);
                def.setBranch(fac.getBranch());
                def.setSegment(fac.getSegment());
                def.setActionRequired(shortfall > 1_000_000 ? "Urgent Margin Call" : (facLtv > 120 ? "Collateral Top-Up" : "Formal Revaluation Review"));
                topDeficits.add(def);
            }
        }
        topDeficits.sort((a, b) -> b.getShortfallAmount().compareTo(a.getShortfallAmount()));
        dto.setTopDeficitFacilities(topDeficits.stream().limit(10).toList());

        // 3. Shared Collateral Pools (Collaterals securing >= 2 facilities)
        List<EnterpriseRiskConcentrationDto.SharedCollateralPoolDto> sharedPool = new ArrayList<>();
        int multiPledgedCount = 0;

        for (Collateral col : ds.collaterals) {
            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(col.getId(), Collections.emptyList());
            if (links.size() >= 2) {
                multiPledgedCount++;
                EnterpriseRiskConcentrationDto.SharedCollateralPoolDto pool = new EnterpriseRiskConcentrationDto.SharedCollateralPoolDto();
                pool.setCollateralId(col.getId());
                pool.setCollateralCode(col.getCode());
                pool.setDescription(col.getDescription());
                pool.setCategory(col.getCategory());
                pool.setMarketValue(BigDecimal.valueOf(col.getValuationAmount()).setScale(2, RoundingMode.HALF_UP));
                double cNet = col.getNsv() > 0 ? col.getNsv() : (col.getValuationAmount() * 0.8);
                pool.setNetSecurityValue(BigDecimal.valueOf(cNet).setScale(2, RoundingMode.HALF_UP));
                pool.setLinkedFacilitiesCount(links.size());

                double totalLinkedBal = 0.0;
                double totalAllocPct = 0.0;
                List<String> refs = new ArrayList<>();

                for (LoanCollateralLink link : links) {
                    totalAllocPct += link.getLinkedPercent();
                    String fid = link.getFacilityId() != null ? link.getFacilityId() : link.getLoanAccountId();
                    LoanAccount la = ds.facilityById.get(fid);
                    if (la != null) {
                        totalLinkedBal += la.getOutstandingBalance();
                        refs.add(la.getLoanReference() != null ? la.getLoanReference() : la.getId());
                    }
                }

                pool.setTotalLinkedExposure(BigDecimal.valueOf(totalLinkedBal).setScale(2, RoundingMode.HALF_UP));
                pool.setTotalAllocationPct(Math.round(totalAllocPct * 10.0) / 10.0);
                pool.setOverCommitted(totalAllocPct > 100.0 || (cNet > 0 && totalLinkedBal > cNet));
                Customer owner = ds.customerByCif.get(col.getCustomerId());
                pool.setOwnerName(owner != null ? owner.getName() : col.getCustomerId());
                pool.setBranch(col.getBranch());
                pool.setLinkedFacilityRefs(refs);
                sharedPool.add(pool);
            }
        }
        sharedPool.sort((a, b) -> b.getTotalLinkedExposure().compareTo(a.getTotalLinkedExposure()));
        dto.setSharedCollaterals(sharedPool.stream().limit(10).toList());
        dto.setMultiPledgedCollateralCount(multiPledgedCount);

        // 4. Critical Expiring / Uninsured Collaterals
        List<EnterpriseRiskConcentrationDto.CriticalExpiringCollateralDto> critList = new ArrayList<>();
        LocalDate today = ds.currentDate != null ? ds.currentDate : LocalDate.now();

        for (Collateral col : ds.collaterals) {
            List<InsurancePolicy> pols = ds.policiesByCollateralId.getOrDefault(col.getId(), Collections.emptyList());
            boolean hasActive = pols.stream().anyMatch(p -> "Active".equalsIgnoreCase(p.getStatus()) && (parseDate(p.getExpiryDate()) == null || !parseDate(p.getExpiryDate()).isBefore(today)));

            if (!hasActive && col.getValuationAmount() > 0) {
                EnterpriseRiskConcentrationDto.CriticalExpiringCollateralDto crit = new EnterpriseRiskConcentrationDto.CriticalExpiringCollateralDto();
                crit.setCollateralId(col.getId());
                crit.setCollateralCode(col.getCode());
                crit.setDescription(col.getDescription());
                crit.setCategory(col.getCategory());
                Customer c = ds.customerByCif.get(col.getCustomerId());
                crit.setCustomerName(c != null ? c.getName() : col.getCustomerId());
                crit.setCif(col.getCustomerId());
                crit.setMarketValue(BigDecimal.valueOf(col.getValuationAmount()).setScale(2, RoundingMode.HALF_UP));

                List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(col.getId(), Collections.emptyList());
                double expLoan = 0.0;
                for (LoanCollateralLink l : links) {
                    LoanAccount la = ds.facilityById.get(l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId());
                    if (la != null) expLoan += la.getOutstandingBalance();
                }
                crit.setExposedLoanAmount(BigDecimal.valueOf(expLoan).setScale(2, RoundingMode.HALF_UP));

                if (pols.isEmpty()) {
                    crit.setIssueType("No Policy Registered");
                    crit.setDaysPastOrToExpiry(0);
                } else {
                    InsurancePolicy p0 = pols.get(0);
                    crit.setPolicyNumber(p0.getPolicyNumber());
                    crit.setExpiryDate(p0.getExpiryDate());
                    LocalDate exp = parseDate(p0.getExpiryDate());
                    crit.setIssueType("Policy Expired");
                    crit.setDaysPastOrToExpiry(exp != null ? (int) ChronoUnit.DAYS.between(exp, today) : 0);
                }
                crit.setBranch(col.getBranch());
                critList.add(crit);
            }
        }
        critList.sort((a, b) -> b.getMarketValue().compareTo(a.getMarketValue()));
        dto.setCriticalExpiringCollaterals(critList.stream().limit(10).toList());

        return dto;
    }
}
