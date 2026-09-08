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
    private ConfigurationService configurationService;

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
        public String effectiveDistrict;
        public String effectiveBranch;
        public String portfolioOwner;
        public boolean lockedSegment;
        public boolean lockedDistrict;
        public boolean lockedBranch;
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

    public ResolvedScope resolveUserScope(String userId, String reqSegment, String reqDistrict, String reqBranch) {
        ResolvedScope scope = new ResolvedScope();
        User user = null;
        if (userId != null && !userId.isBlank()) {
            user = userRepository.findById(userId)
                    .or(() -> userRepository.findByUsername(userId))
                    .orElse(null);
        }
        if (user == null) {
            user = new User("usr-exec", "exec_user", "password123", "Executive", "exec@bank.com", "EXEC", "Head Office", "Corporate Banking");
        }
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

        switch (role) {
            case "EXEC":
            case "SRMGMT":
            case "SYSADMIN":
            case "AUDITOR":
            case "COMPLIANCE":
            case "RISK":
                scope.scopeLevel = "BANK_WIDE";
                scope.allowedSegments = allSegments;
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                scope.effectiveDistrict = (reqDistrict != null && !reqDistrict.equalsIgnoreCase("ALL")) ? reqDistrict : null;
                scope.effectiveBranch = (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL")) ? reqBranch : null;
                scope.lockedSegment = false;
                scope.lockedDistrict = false;
                scope.lockedBranch = false;
                break;

            case "HODEPT":
                scope.scopeLevel = "SEGMENT";
                scope.allowedSegments = userAssignedSegments.isEmpty() ? List.of(user.getSegment()) : userAssignedSegments;
                if (reqSegment != null && scope.allowedSegments.contains(reqSegment)) {
                    scope.effectiveSegment = reqSegment;
                } else {
                    scope.effectiveSegment = scope.allowedSegments.get(0);
                }
                scope.effectiveDistrict = (reqDistrict != null && !reqDistrict.equalsIgnoreCase("ALL")) ? reqDistrict : null;
                scope.effectiveBranch = (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL")) ? reqBranch : null;
                scope.lockedSegment = true;
                scope.lockedDistrict = false;
                scope.lockedBranch = false;
                break;

            case "DISTDIR":
                scope.scopeLevel = "DISTRICT";
                scope.allowedSegments = userAssignedSegments.isEmpty() ? List.of(user.getSegment()) : userAssignedSegments;
                scope.effectiveSegment = user.getSegment();
                scope.effectiveDistrict = user.getBranch();
                scope.lockedSegment = true;
                scope.lockedDistrict = true;
                if (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL") && isBranchInDistrict(reqBranch, scope.effectiveDistrict)) {
                    scope.effectiveBranch = reqBranch;
                } else {
                    scope.effectiveBranch = null;
                }
                scope.lockedBranch = false;
                break;

            case "BRMGR":
                scope.scopeLevel = "BRANCH";
                scope.allowedSegments = List.of(user.getSegment());
                scope.effectiveSegment = user.getSegment();
                scope.effectiveBranch = user.getBranch();
                scope.effectiveDistrict = resolveDistrictForBranch(user.getBranch());
                scope.lockedSegment = true;
                scope.lockedDistrict = true;
                scope.lockedBranch = true;
                break;

            case "RM":
            case "SRM":
            case "BRM":
            case "RO":
            case "CRO":
            case "BRO":
                scope.scopeLevel = "PORTFOLIO";
                scope.allowedSegments = List.of(user.getSegment());
                scope.effectiveSegment = user.getSegment();
                scope.effectiveBranch = user.getBranch();
                scope.effectiveDistrict = resolveDistrictForBranch(user.getBranch());
                scope.portfolioOwner = user.getFullName() != null ? user.getFullName() : user.getUsername();
                scope.lockedSegment = true;
                scope.lockedDistrict = true;
                scope.lockedBranch = true;
                break;

            case "MGRCOLLDOC":
            case "COLLDOCOFF":
                scope.scopeLevel = "BANK_WIDE";
                scope.allowedSegments = userAssignedSegments.isEmpty() ? allSegments : userAssignedSegments;
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                scope.effectiveDistrict = (reqDistrict != null && !reqDistrict.equalsIgnoreCase("ALL")) ? reqDistrict : null;
                scope.effectiveBranch = (reqBranch != null && !reqBranch.equalsIgnoreCase("ALL")) ? reqBranch : null;
                scope.lockedSegment = false;
                scope.lockedDistrict = false;
                scope.lockedBranch = false;
                break;

            default:
                scope.scopeLevel = "BANK_WIDE";
                scope.allowedSegments = allSegments;
                scope.effectiveSegment = (reqSegment != null && !reqSegment.equalsIgnoreCase("ALL")) ? reqSegment : null;
                scope.effectiveDistrict = null;
                scope.effectiveBranch = null;
                scope.lockedSegment = false;
                scope.lockedDistrict = false;
                scope.lockedBranch = false;
                break;
        }

        return scope;
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
        if (branchName == null) return "Head Office District";
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

            if (statusFilter != null && !statusFilter.equalsIgnoreCase("ALL")) {
                String stat = c.getInsuranceStatus() == null ? "" : c.getInsuranceStatus().toLowerCase();
                if (statusFilter.equalsIgnoreCase("ADEQUATE") && !stat.contains("adequate")) return false;
                if (statusFilter.equalsIgnoreCase("UNDERINSURED") && !stat.contains("underinsured")) return false;
                if (statusFilter.equalsIgnoreCase("EXPIRED") && !stat.contains("expired")) return false;
                if (statusFilter.equalsIgnoreCase("UNINSURED") && (!stat.contains("uninsured") && !stat.contains("missing"))) return false;
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

        if (expiryFilter != null && !expiryFilter.equalsIgnoreCase("ALL")) {
            ds.policies = ds.policies.stream().filter(p -> {
                LocalDate exp = parseDate(p.getExpiryDate());
                if (exp == null) return false;
                long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
                if (expiryFilter.equalsIgnoreCase("EXPIRED")) return days < 0;
                if (expiryFilter.equalsIgnoreCase("0-7")) return days >= 0 && days <= 7;
                if (expiryFilter.equalsIgnoreCase("8-15")) return days >= 8 && days <= 15;
                if (expiryFilter.equalsIgnoreCase("16-30")) return days >= 16 && days <= 30;
                if (expiryFilter.equalsIgnoreCase("31-60")) return days >= 31 && days <= 60;
                if (expiryFilter.equalsIgnoreCase("61-90")) return days >= 61 && days <= 90;
                if (expiryFilter.equalsIgnoreCase(">90")) return days > 90;
                return true;
            }).collect(Collectors.toList());
        }

        for (OwnershipDocument doc : allDocs) {
            if (doc.getCollateralId() != null && scopedCollateralIds.contains(doc.getCollateralId())) {
                ds.documentsByCollateralId.computeIfAbsent(doc.getCollateralId(), k -> new ArrayList<>()).add(doc);
            }
        }
        ds.documents = allDocs.stream().filter(d -> d.getCollateralId() != null && scopedCollateralIds.contains(d.getCollateralId())).collect(Collectors.toList());

        ds.exceptions = allExceptions.stream().filter(e -> (e.getEntityId() != null && scopedCollateralIds.contains(e.getEntityId())) || (e.getEntityId() != null && scopedCustomerCifs.contains(e.getEntityId()))).collect(Collectors.toList());

        ds.tasks = allTasks.stream().filter(t -> {
            if (t.getEntityId() != null && scopedCollateralIds.contains(t.getEntityId())) return true;
            return true;
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
        if ("BANK_WIDE".equalsIgnoreCase(scope.scopeLevel) && scope.effectiveSegment == null && scope.effectiveDistrict == null && scope.effectiveBranch == null) {
            disp.append("BANK-WIDE");
        } else {
            disp.append(scope.effectiveSegment != null ? scope.effectiveSegment : "Bank-Wide");
            if (scope.effectiveDistrict != null) {
                disp.append(" → ").append(scope.effectiveDistrict);
            }
            if (scope.effectiveBranch != null) {
                disp.append(" → ").append(scope.effectiveBranch);
            }
            if (scope.portfolioOwner != null) {
                disp.append(" → My Portfolio (").append(scope.portfolioOwner).append(")");
            }
        }
        b.setDisplayScope(disp.toString());
        b.setServerDate(getCurrentSystemDate().format(DATE_FMT));
        b.setLastRefresh(LocalDateTime.now().format(DISPLAY_DT_FMT));
        return b;
    }

    public DashboardSummaryDto getSummary(String userId, String segment, String district, String branch, String category, String status, String expiry) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, category, status, expiry);

        DashboardSummaryDto dto = new DashboardSummaryDto();
        dto.setScopeBanner(buildScopeBanner(scope));

        BigDecimal totalExposure = ds.facilities.stream()
                .map(f -> BigDecimal.valueOf(f.getOutstandingBalance()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setTotalOutstandingExposure(totalExposure);

        BigDecimal totalMarketVal = ds.collaterals.stream()
                .map(c -> BigDecimal.valueOf(c.getValuationAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        dto.setTotalCollateralMarketValue(totalMarketVal);

        BigDecimal totalNetSecurity = BigDecimal.ZERO;
        BigDecimal totalRequiredInsurance = BigDecimal.ZERO;
        BigDecimal totalValidActiveInsurance = BigDecimal.ZERO;
        BigDecimal totalInsuranceGap = BigDecimal.ZERO;

        for (Collateral c : ds.collaterals) {
            BigDecimal val = BigDecimal.valueOf(c.getValuationAmount());
            BigDecimal haircut = BigDecimal.valueOf(c.getHaircut());
            BigDecimal netSec = val.multiply(BigDecimal.ONE.subtract(haircut.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)));
            totalNetSecurity = totalNetSecurity.add(netSec);

            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            BigDecimal linkedExposure = BigDecimal.ZERO;
            for (LoanCollateralLink l : links) {
                if (l.getAllocatedAmount() > 0) {
                    linkedExposure = linkedExposure.add(BigDecimal.valueOf(l.getAllocatedAmount()));
                } else if (l.getLinkedAmount() > 0) {
                    linkedExposure = linkedExposure.add(BigDecimal.valueOf(l.getLinkedAmount()));
                } else {
                    String fId = l.getFacilityId() != null ? l.getFacilityId() : l.getLoanAccountId();
                    LoanAccount fac = ds.facilityById.get(fId);
                    if (fac != null) {
                        linkedExposure = linkedExposure.add(BigDecimal.valueOf(fac.getOutstandingBalance()));
                    }
                }
            }
            BigDecimal required = linkedExposure.max(val);
            totalRequiredInsurance = totalRequiredInsurance.add(required);

            List<InsurancePolicy> pols = ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            BigDecimal activePolSum = BigDecimal.ZERO;
            for (InsurancePolicy p : pols) {
                LocalDate exp = parseDate(p.getExpiryDate());
                if ("Active".equalsIgnoreCase(p.getStatus()) && (exp == null || !exp.isBefore(ds.currentDate))) {
                    activePolSum = activePolSum.add(BigDecimal.valueOf(p.getInsuredAmount()));
                }
            }
            totalValidActiveInsurance = totalValidActiveInsurance.add(activePolSum);

            BigDecimal colGap = required.subtract(activePolSum).max(BigDecimal.ZERO);
            totalInsuranceGap = totalInsuranceGap.add(colGap);
        }

        dto.setTotalNetSecurityValue(totalNetSecurity);
        dto.setTotalInsuranceRequired(totalRequiredInsurance);
        dto.setTotalValidActiveInsurance(totalValidActiveInsurance);
        dto.setTotalInsuranceGap(totalInsuranceGap);

        double covPct = totalRequiredInsurance.compareTo(BigDecimal.ZERO) > 0
                ? totalValidActiveInsurance.divide(totalRequiredInsurance, 4, RoundingMode.HALF_UP).doubleValue() * 100.0
                : 100.0;
        dto.setInsuranceCoveragePct(Math.min(100.0, Math.round(covPct * 100.0) / 100.0));

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
        dto.setTotalBranchesCount(branchRepository.count());
        dto.setMissingDocumentsCount(ds.documents.stream().filter(d -> "Missing".equalsIgnoreCase(d.getStatus())).count());
        dto.setPendingDocumentVerificationsCount(ds.documents.stream().filter(d -> !"Verified".equalsIgnoreCase(d.getVerificationStatus()) && !"Rejected".equalsIgnoreCase(d.getStatus())).count());
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

        // Chart 1: Compliance Donut
        long adequate = 0, underinsured = 0, uninsured = 0, expired = 0, notRequired = 0;
        for (Collateral c : ds.collaterals) {
            String s = c.getInsuranceStatus() == null ? "Uninsured" : c.getInsuranceStatus();
            if (s.toLowerCase().contains("adequate")) adequate++;
            else if (s.toLowerCase().contains("underinsured")) underinsured++;
            else if (s.toLowerCase().contains("expired")) expired++;
            else if (s.toLowerCase().contains("not required") || s.toLowerCase().contains("exempt")) notRequired++;
            else uninsured++;
        }
        List<Map<String, Object>> donut = new ArrayList<>();
        donut.add(Map.of("name", "Adequately Insured", "value", adequate, "color", "#15803D"));
        donut.add(Map.of("name", "Underinsured", "value", underinsured, "color", "#D97706"));
        donut.add(Map.of("name", "Uninsured", "value", uninsured, "color", "#DC2626"));
        donut.add(Map.of("name", "Expired", "value", expired, "color", "#991B1B"));
        donut.add(Map.of("name", "Not Required", "value", notRequired, "color", "#64748B"));
        charts.setComplianceDonut(donut);

        // Chart 2: Exposure vs Protection grouped bars (by Segment)
        Map<String, List<Collateral>> colsBySeg = ds.collaterals.stream()
                .collect(Collectors.groupingBy(c -> c.getOwningSegment() != null ? c.getOwningSegment() : "Corporate Banking"));
        List<Map<String, Object>> expVsProt = new ArrayList<>();
        for (Map.Entry<String, List<Collateral>> entry : colsBySeg.entrySet()) {
            String segName = entry.getKey();
            List<Collateral> segCols = entry.getValue();
            double colVal = segCols.stream().mapToDouble(Collateral::getValuationAmount).sum();
            double insured = segCols.stream().mapToDouble(Collateral::getInsuredAmount).sum();
            double req = colVal;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("segment", segName);
            row.put("collateralValue", colVal);
            row.put("insuranceRequired", req);
            row.put("insuredCoverage", insured);
            row.put("gap", Math.max(0, req - insured));
            expVsProt.add(row);
        }
        charts.setExposureVsProtection(expVsProt);

        // Chart 3: District Risk Ranking
        List<Branch> distBranches = branchRepository.findAll().stream()
                .filter(b -> b.getType() != null && (b.getType().equalsIgnoreCase("DistrictOffice") || b.getType().equalsIgnoreCase("HeadOffice")))
                .toList();
        List<Map<String, Object>> distRank = new ArrayList<>();
        for (Branch dist : distBranches) {
            List<Collateral> distCols = ds.collaterals.stream().filter(c -> isBranchInDistrict(c.getBranch(), dist.getName())).toList();
            double distVal = distCols.stream().mapToDouble(Collateral::getValuationAmount).sum();
            double distIns = distCols.stream().mapToDouble(Collateral::getInsuredAmount).sum();
            double distGap = Math.max(0, distVal - distIns);
            double distCov = distVal > 0 ? (distIns / distVal) * 100.0 : 100.0;

            Map<String, Object> dr = new LinkedHashMap<>();
            dr.put("district", dist.getName());
            dr.put("exposure", distVal);
            dr.put("insuranceGap", distGap);
            dr.put("compliancePct", Math.round(distCov * 10.0) / 10.0);
            distRank.add(dr);
        }
        charts.setDistrictRanking(distRank);

        // Chart 4: Branch Compliance Ranking
        Map<String, List<Collateral>> colsByBranch = ds.collaterals.stream()
                .collect(Collectors.groupingBy(c -> c.getBranch() != null ? c.getBranch() : "Bole Special Branch"));
        List<Map<String, Object>> brnRank = new ArrayList<>();
        for (Map.Entry<String, List<Collateral>> entry : colsByBranch.entrySet()) {
            String brn = entry.getKey();
            List<Collateral> bCols = entry.getValue();
            double bVal = bCols.stream().mapToDouble(Collateral::getValuationAmount).sum();
            double bIns = bCols.stream().mapToDouble(Collateral::getInsuredAmount).sum();
            double bGap = Math.max(0, bVal - bIns);
            double bCov = bVal > 0 ? (bIns / bVal) * 100.0 : 100.0;

            Map<String, Object> br = new LinkedHashMap<>();
            br.put("branch", brn);
            br.put("collateralValue", bVal);
            br.put("insuranceRequired", bVal);
            br.put("insuredAmount", bIns);
            br.put("insuranceGap", bGap);
            br.put("compliancePct", Math.round(bCov * 10.0) / 10.0);
            brnRank.add(br);
        }
        charts.setBranchRanking(brnRank);

        // Chart 5: Expiry Pipeline Buckets
        long expExpired = 0, exp0_7 = 0, exp8_15 = 0, exp16_30 = 0, exp31_60 = 0, exp61_90 = 0, expGt90 = 0;
        for (InsurancePolicy p : ds.policies) {
            LocalDate exp = parseDate(p.getExpiryDate());
            if (exp == null) continue;
            long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
            if (days < 0 || "Expired".equalsIgnoreCase(p.getStatus())) expExpired++;
            else if (days <= 7) exp0_7++;
            else if (days <= 15) exp8_15++;
            else if (days <= 30) exp16_30++;
            else if (days <= 60) exp31_60++;
            else if (days <= 90) exp61_90++;
            else expGt90++;
        }
        List<Map<String, Object>> pipeline = List.of(
                Map.of("bucket", "Expired", "count", expExpired, "color", "#DC2626"),
                Map.of("bucket", "0-7 Days", "count", exp0_7, "color", "#EA580C"),
                Map.of("bucket", "8-15 Days", "count", exp8_15, "color", "#D97706"),
                Map.of("bucket", "16-30 Days", "count", exp16_30, "color", "#CA8A04"),
                Map.of("bucket", "31-60 Days", "count", exp31_60, "color", "#2563EB"),
                Map.of("bucket", "61-90 Days", "count", exp61_90, "color", "#0284C7"),
                Map.of("bucket", ">90 Days", "count", expGt90, "color", "#16A34A")
        );
        charts.setExpiryPipeline(pipeline);

        // Chart 6: Collateral Category Distribution
        Map<String, List<Collateral>> colsByCategory = ds.collaterals.stream()
                .collect(Collectors.groupingBy(c -> c.getCategory() != null ? c.getCategory() : "Immovable Properties"));
        List<Map<String, Object>> catDist = new ArrayList<>();
        for (Map.Entry<String, List<Collateral>> entry : colsByCategory.entrySet()) {
            String cat = entry.getKey();
            List<Collateral> clist = entry.getValue();
            double cval = clist.stream().mapToDouble(Collateral::getValuationAmount).sum();
            double cins = clist.stream().mapToDouble(Collateral::getInsuredAmount).sum();
            double cgap = Math.max(0, cval - cins);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("category", cat);
            item.put("count", clist.size());
            item.put("value", cval);
            item.put("insuranceGap", cgap);
            catDist.add(item);
        }
        charts.setCollateralCategoryDistribution(catDist);

        // Chart 7: Top Insurance Gaps
        List<Map<String, Object>> topGaps = ds.collaterals.stream()
                .map(c -> {
                    double val = c.getValuationAmount();
                    double ins = c.getInsuredAmount();
                    double gap = Math.max(0, val - ins);
                    Customer cust = ds.customerByCif.get(c.getCustomerId());
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("collateralCode", c.getCode());
                    m.put("customerName", cust != null ? cust.getName() : c.getCustomerId());
                    m.put("cif", c.getCustomerId());
                    m.put("branch", c.getBranch());
                    m.put("requiredInsurance", val);
                    m.put("activeInsurance", ins);
                    m.put("insuranceGap", gap);
                    return m;
                })
                .sorted((a, b) -> Double.compare((double) b.get("insuranceGap"), (double) a.get("insuranceGap")))
                .limit(10)
                .collect(Collectors.toList());
        charts.setTopInsuranceGaps(topGaps);

        // Chart 8: Workflow Funnel
        Map<String, Long> taskStatusCounts = ds.tasks.stream()
                .collect(Collectors.groupingBy(t -> t.getStatus() != null ? t.getStatus() : "Pending", Collectors.counting()));
        List<Map<String, Object>> funnel = List.of(
                Map.of("status", "Draft", "count", taskStatusCounts.getOrDefault("Draft", 0L)),
                Map.of("status", "Submitted", "count", taskStatusCounts.getOrDefault("Submitted", 0L)),
                Map.of("status", "Pending Approval", "count", taskStatusCounts.getOrDefault("Pending", 0L)),
                Map.of("status", "Returned", "count", taskStatusCounts.getOrDefault("Returned", 0L)),
                Map.of("status", "Rejected", "count", taskStatusCounts.getOrDefault("Rejected", 0L)),
                Map.of("status", "Approved", "count", taskStatusCounts.getOrDefault("Approved", 0L)),
                Map.of("status", "Overdue", "count", taskStatusCounts.getOrDefault("Overdue", 0L))
        );
        charts.setWorkflowFunnel(funnel);

        // Chart 9: Documentation Health
        long docComplete = 0, docMissing = 0, docPending = 0, docRejected = 0, docExpired = 0;
        for (OwnershipDocument d : ds.documents) {
            LocalDate exp = parseDate(d.getExpiryDate());
            if ("Rejected".equalsIgnoreCase(d.getStatus())) docRejected++;
            else if ("Missing".equalsIgnoreCase(d.getStatus())) docMissing++;
            else if ("Verified".equalsIgnoreCase(d.getVerificationStatus())) docComplete++;
            else docPending++;
            if (exp != null && exp.isBefore(ds.currentDate)) docExpired++;
        }
        List<Map<String, Object>> docHealth = List.of(
                Map.of("name", "Complete & Verified", "value", docComplete, "color", "#16A34A"),
                Map.of("name", "Pending Verification", "value", docPending, "color", "#EA580C"),
                Map.of("name", "Missing Mandatory", "value", docMissing, "color", "#DC2626"),
                Map.of("name", "Rejected", "value", docRejected, "color", "#991B1B"),
                Map.of("name", "Expired Documents", "value", docExpired, "color", "#7F1D1D")
        );
        charts.setDocumentationHealth(docHealth);

        // Chart 10: Ownership Distribution
        Map<String, List<Collateral>> colsByOwner = ds.collaterals.stream()
                .collect(Collectors.groupingBy(c -> c.getOwnerType() != null ? c.getOwnerType() : (c.getType() != null ? c.getType() : "Borrower-owned")));
        List<Map<String, Object>> ownerDist = new ArrayList<>();
        for (Map.Entry<String, List<Collateral>> entry : colsByOwner.entrySet()) {
            ownerDist.add(Map.of("ownershipType", entry.getKey(), "count", entry.getValue().size()));
        }
        charts.setOwnershipDistribution(ownerDist);

        // Chart 11: Real Historical Performance
        charts.setHistoricalSnapshots(Collections.emptyList());
        charts.setHistoricalDataMessage("Historical data not yet available. Daily automated snapshot aggregation is active.");

        return charts;
    }

    public List<DashboardPortfolioRowDto> getPortfolio(String userId, String segment, String district, String branch, String category, String status, String expiry) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, category, status, expiry);

        List<DashboardPortfolioRowDto> rows = new ArrayList<>();
        for (Collateral c : ds.collaterals) {
            DashboardPortfolioRowDto row = new DashboardPortfolioRowDto();
            Customer cust = ds.customerByCif.get(c.getCustomerId());

            row.setCustomerId(cust != null ? cust.getId() : "");
            row.setCustomerName(cust != null ? cust.getName() : c.getCustomerId());
            row.setCif(c.getCustomerId());
            row.setSegment(c.getOwningSegment() != null ? c.getOwningSegment() : "Corporate Banking");
            row.setDistrict(resolveDistrictForBranch(c.getBranch()));
            row.setBranch(c.getBranch() != null ? c.getBranch() : "Bole Special Branch");
            row.setRmName("Tewodros Kassahun");
            row.setRoName("Kidist Selasse");

            List<LoanCollateralLink> links = ds.linksByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            BigDecimal linkedExposure = BigDecimal.ZERO;
            String facRef = "";
            String facType = "";
            String facId = "";
            if (!links.isEmpty()) {
                LoanCollateralLink firstLink = links.get(0);
                facId = firstLink.getFacilityId() != null ? firstLink.getFacilityId() : firstLink.getLoanAccountId();
                LoanAccount fac = ds.facilityById.get(facId);
                if (fac != null) {
                    facRef = fac.getLoanReference() != null ? fac.getLoanReference() : fac.getId();
                    facType = fac.getFacilityType() != null ? fac.getFacilityType() : "Term Loan";
                    linkedExposure = BigDecimal.valueOf(fac.getOutstandingBalance());
                }
            }
            row.setFacilityId(facId);
            row.setFacilityRef(facRef);
            row.setFacilityType(facType);
            row.setOutstandingExposure(linkedExposure);

            row.setCollateralId(c.getId());
            row.setCollateralCode(c.getCode());
            row.setCollateralDescription(c.getDescription());
            row.setCollateralCategory(c.getCategory());
            row.setCollateralType(c.getType());
            row.setOwnershipType(c.getOwnerType() != null ? c.getOwnerType() : "Borrower-owned");

            BigDecimal marketVal = BigDecimal.valueOf(c.getValuationAmount());
            row.setMarketValue(marketVal);
            row.setHaircut(c.getHaircut());
            BigDecimal netSec = marketVal.multiply(BigDecimal.ONE.subtract(BigDecimal.valueOf(c.getHaircut()).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP)));
            row.setNetSecurity(netSec);
            row.setAllocatedSecurity(linkedExposure);

            BigDecimal required = linkedExposure.max(marketVal);
            row.setInsuranceRequired(required);

            List<InsurancePolicy> pols = ds.policiesByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            BigDecimal activeIns = BigDecimal.ZERO;
            InsurancePolicy primePol = null;
            for (InsurancePolicy p : pols) {
                LocalDate exp = parseDate(p.getExpiryDate());
                if ("Active".equalsIgnoreCase(p.getStatus()) && (exp == null || !exp.isBefore(ds.currentDate))) {
                    activeIns = activeIns.add(BigDecimal.valueOf(p.getInsuredAmount()));
                    if (primePol == null) primePol = p;
                }
            }
            if (primePol == null && !pols.isEmpty()) primePol = pols.get(0);

            row.setInsuredAmount(activeIns);
            BigDecimal gap = required.subtract(activeIns).max(BigDecimal.ZERO);
            row.setInsuranceGap(gap);

            double covPct = required.compareTo(BigDecimal.ZERO) > 0 ? (activeIns.doubleValue() / required.doubleValue()) * 100.0 : 100.0;
            row.setCoveragePct(Math.min(100.0, Math.round(covPct * 10.0) / 10.0));

            if (primePol != null) {
                row.setPolicyId(primePol.getId());
                row.setPolicyNumber(primePol.getPolicyNumber());
                row.setInsurerName(primePol.getInsurerName());
                row.setPolicyStatus(primePol.getStatus());
                if (primePol.getExpiryDate() != null) {
                    row.setExpiryDate(primePol.getExpiryDate());
                    LocalDate exp = parseDate(primePol.getExpiryDate());
                    if (exp != null) {
                        row.setDaysToExpiry((int) ChronoUnit.DAYS.between(ds.currentDate, exp));
                    }
                }
            } else {
                row.setPolicyStatus(c.getInsuranceStatus() != null ? c.getInsuranceStatus() : "Uninsured");
            }

            List<OwnershipDocument> docs = ds.documentsByCollateralId.getOrDefault(c.getId(), Collections.emptyList());
            boolean hasMissing = docs.stream().anyMatch(d -> "Missing".equalsIgnoreCase(d.getStatus()));
            boolean hasUnverified = docs.stream().anyMatch(d -> !"Verified".equalsIgnoreCase(d.getVerificationStatus()));
            row.setDocumentStatus(hasMissing ? "Missing Mandatory" : (hasUnverified ? "Pending Verification" : "Complete"));
            row.setWorkflowStatus(c.getStatus() != null ? c.getStatus() : "Active");
            row.setExceptionStatus(gap.compareTo(BigDecimal.ZERO) > 0 ? "Underinsured Gap" : "Normal");

            row.setPriority(gap.compareTo(BigDecimal.ZERO) > 0 || row.getDaysToExpiry() <= 30 ? "High" : "Normal");

            rows.add(row);
        }
        return rows;
    }

    public List<DashboardWorkQueueItemDto> getWorkQueue(String userId, String segment, String district, String branch) {
        ResolvedScope scope = resolveUserScope(userId, segment, district, branch);
        ScopedDataset ds = loadScopedDataset(scope, null, null, null);

        List<DashboardWorkQueueItemDto> queue = new ArrayList<>();

        for (InsurancePolicy p : ds.policies) {
            LocalDate exp = parseDate(p.getExpiryDate());
            if (exp == null) continue;
            long days = ChronoUnit.DAYS.between(ds.currentDate, exp);
            if (days < 0 || "Expired".equalsIgnoreCase(p.getStatus())) {
                DashboardWorkQueueItemDto item = new DashboardWorkQueueItemDto();
                item.setId("wq-exp-" + p.getId());
                item.setPriority("Critical");
                item.setCategory("Expired Insurance");
                Customer cust = ds.customerByCif.get(p.getCustomerId());
                item.setCustomerName(cust != null ? cust.getName() : p.getCustomerId());
                item.setCustomerCif(p.getCustomerId());
                item.setPolicyNumber(p.getPolicyNumber());
                item.setIssueDescription("Policy expired " + Math.abs(days) + " days ago. Collateral is exposed.");
                item.setDaysRemainingOrOverdue((int) days);
                item.setRequiredAction("Initiate Policy Renewal / Customer Notice");
                item.setStatus("Action Required");
                item.setAssignedOfficer(scope.portfolioOwner != null ? scope.portfolioOwner : "Relationship Officer");
                item.setBranch(scope.effectiveBranch != null ? scope.effectiveBranch : "Bole Special Branch");
                item.setSegment(scope.effectiveSegment != null ? scope.effectiveSegment : "Corporate Banking");
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
                item.setBranch(scope.effectiveBranch != null ? scope.effectiveBranch : "Bole Special Branch");
                item.setSegment(scope.effectiveSegment != null ? scope.effectiveSegment : "Corporate Banking");
                item.setGapAmount(BigDecimal.valueOf(p.getInsuredAmount()));
                item.setTargetModule("policies");
                item.setTargetEntityId(p.getId());
                queue.add(item);
            }
        }

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
}
