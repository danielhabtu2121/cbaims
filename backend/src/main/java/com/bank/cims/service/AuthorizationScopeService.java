package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Authoritative authorization scope for CBAIMS.
 *
 * <p>The branch, segment and district of the signed-in user are read from the persisted
 * user record (and the normalized organization assignment tables), never from a client
 * supplied value. Every read API that returns portfolio data must filter through this
 * scope so that a branch user cannot see another branch's customers/collateral, a
 * district manager can only see their district, and a segment officer is limited to
 * their assigned business segments.</p>
 */
@Service
public class AuthorizationScopeService {

    @Autowired private UserRepository userRepository;
    @Autowired private BranchRepository branchRepository;
    @Autowired private UserOrgAssignmentRepository userOrgAssignmentRepository;
    @Autowired private OrganizationalUnitRepository organizationalUnitRepository;
    @Autowired private PortfolioAssignmentRepository portfolioAssignmentRepository;
    @Autowired private ObjectMapper objectMapper;

    /** Roles that inherently see the whole bank (subject to their own module permissions). */
    private static final Set<String> BANK_WIDE_ROLES = Set.of("SYSADMIN", "EXEC", "SRMGMT");
    /**
     * Bank-wide inspection roles. RISK and COMPLIANCE are intentionally not read-only:
     * the Administration > Workflow Approval Hierarchy may route approvals to them.
     * Only audit/inspection-only accounts are denied mutations.
     */
    private static final Set<String> READ_ONLY_BANK_WIDE_ROLES = Set.of("AUDITOR", "AUDIT", "RDONLY", "TEST_RISK_VIEW", "TEST_COMPLIANCE_VIEW");
    /** Roles limited to the operating branch they are posted to. */
    private static final Set<String> BRANCH_SCOPED_ROLES = Set.of(
            "BRMGR", "BRO", "CRO", "SRM", "BRM", "RO", "CRM", "COLLDOCOFF", "MGRCOLLDOC"
    );
    /** Roles limited to a district and all branches inside it. */
    private static final Set<String> DISTRICT_SCOPED_ROLES = Set.of("DISTDIR");

    public static class Scope {
        private String userId;
        private String username;
        private String role;
        private String branch;
        private String segment;
        private String district;
        private boolean bankWide;
        private boolean readOnly;
        private boolean restricted;
        private final Set<String> allowedSegments = new LinkedHashSet<>();
        private final Set<String> allowedBranches = new LinkedHashSet<>();
        private final Set<String> allowedDistricts = new LinkedHashSet<>();
        private final Set<String> allowedEntityIds = new LinkedHashSet<>();

        public String getUserId() { return userId; }
        public String getUsername() { return username; }
        public String getRole() { return role; }
        public String getBranch() { return branch; }
        public String getSegment() { return segment; }
        public String getDistrict() { return district; }
        public boolean isBankWide() { return bankWide; }
        public boolean isReadOnly() { return readOnly; }
        public boolean isRestricted() { return restricted; }
        public Set<String> getAllowedSegments() { return allowedSegments; }
        public Set<String> getAllowedBranches() { return allowedBranches; }
        public Set<String> getAllowedDistricts() { return allowedDistricts; }
        public Set<String> getAllowedEntityIds() { return allowedEntityIds; }

        public boolean segmentAllowed(String value) {
            if (!restricted || allowedSegments.isEmpty() || isBlank(value)) return true;
            String v = norm(value);
            return allowedSegments.contains(v);
        }

        public boolean branchAllowed(String... values) {
            if (!restricted || allowedBranches.isEmpty()) return true;
            for (String value : values) {
                if (isBlank(value)) continue;
                String v = norm(value);
                if (allowedBranches.contains(v)) return true;
                for (String allowed : allowedBranches) {
                    if (v.equals(allowed) || v.contains(allowed) || allowed.contains(v)) return true;
                }
            }
            return false;
        }

        public boolean districtAllowed(String value) {
            if (!restricted || allowedDistricts.isEmpty() || isBlank(value)) return true;
            String v = norm(value);
            if (allowedDistricts.contains(v)) return true;
            for (String allowed : allowedDistricts) {
                if (v.contains(allowed) || allowed.contains(v)) return true;
            }
            return false;
        }

        public boolean allowsCustomer(Customer c) {
            if (c == null || bankWide) return true;
            if (!segmentAllowed(c.getSegment())) return false;
            if (!allowedBranches.isEmpty() && !branchAllowed(c.getBranch())) return false;
            if (!allowedDistricts.isEmpty() && !districtAllowed(c.getDistrict())) return false;
            return true;
        }

        public boolean allowsCollateral(Collateral c, Set<String> visibleCustomerIds) {
            if (c == null || bankWide) return true;
            if (c.getCustomerId() != null && visibleCustomerIds != null
                    && visibleCustomerIds.contains(c.getCustomerId())) return true;
            if (!segmentAllowed(c.getOwningSegment())) return false;
            if (!allowedBranches.isEmpty() && !branchAllowed(c.getBranch())) return false;
            if (!allowedDistricts.isEmpty() && !districtAllowed(c.getDistrict())) return false;
            return true;
        }

        public boolean allowsFacility(LoanAccount f, Set<String> visibleCustomerIds) {
            if (f == null || bankWide) return true;
            if (f.getCustomerId() != null && visibleCustomerIds != null
                    && visibleCustomerIds.contains(f.getCustomerId())) return true;
            if (!segmentAllowed(f.getSegment())) return false;
            if (!allowedBranches.isEmpty() && !branchAllowed(f.getBranch())) return false;
            if (!allowedDistricts.isEmpty() && !districtAllowed(f.getDistrict())) return false;
            return true;
        }

        public boolean allowsException(CimsException e, Set<String> visibleCustomerIds, Set<String> visibleCollateralIds) {
            if (e == null || bankWide) return true;
            if (e.getCustomerId() != null && visibleCustomerIds != null && visibleCustomerIds.contains(e.getCustomerId())) return true;
            if (e.getCollateralId() != null && visibleCollateralIds != null && visibleCollateralIds.contains(e.getCollateralId())) return true;
            if (e.getEntityId() != null && ((visibleCustomerIds != null && visibleCustomerIds.contains(e.getEntityId()))
                    || (visibleCollateralIds != null && visibleCollateralIds.contains(e.getEntityId())))) return true;
            if (!segmentAllowed(e.getBusinessSegment())) return false;
            if (!allowedBranches.isEmpty() && !branchAllowed(e.getBranch())) return false;
            if (!allowedDistricts.isEmpty() && !districtAllowed(e.getDistrict())) return false;
            return e.getBusinessSegment() == null && e.getBranch() == null && e.getDistrict() == null;
        }
    }

    public Scope currentScope() {
        return resolve(currentUser());
    }

    public User currentUser() {
        try {
            var attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return null;
            HttpServletRequest request = attrs.getRequest();
            Object bound = request.getAttribute("authenticatedUser");
            if (bound instanceof User u) return u;
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getName() != null) {
                String principal = auth.getName();
                return userRepository.findByUsernameIgnoreCase(principal)
                        .or(() -> userRepository.findById(principal))
                        .orElse(null);
            }
        } catch (Exception ignored) { }
        return null;
    }

    public Scope resolve(String userReference) {
        if (isBlank(userReference)) return unrestricted(null);
        String ref = userReference.trim();
        User user = userRepository.findById(ref)
                .or(() -> userRepository.findByUsernameIgnoreCase(ref))
                .or(() -> userRepository.findByUsername(ref))
                .orElse(null);
        return resolve(user);
    }

    public Scope resolve(User user) {
        if (user == null) return unrestricted(null);

        String role = user.getRole() == null ? "" : user.getRole().trim().toUpperCase(Locale.ROOT);
        Scope scope = new Scope();
        scope.userId = user.getId();
        scope.username = user.getUsername();
        scope.role = role;
        scope.branch = user.getBranch();
        scope.segment = user.getSegment();
        scope.district = user.getDistrict();
        scope.readOnly = READ_ONLY_BANK_WIDE_ROLES.contains(role)
                || role.contains("AUDIT") || role.contains("RDONLY") || role.contains("TEST_RISK_VIEW")
                || role.contains("TEST_COMPLIANCE_VIEW");

        boolean bankWide = BANK_WIDE_ROLES.contains(role) || READ_ONLY_BANK_WIDE_ROLES.contains(role)
                || role.contains("AUDIT") || role.contains("RISK") || role.contains("COMPLIANCE");
        // Head-office users without an operating branch are not branch restricted.
        boolean headOffice = isHeadOffice(user.getBranch()) || isHeadOffice(user.getSegment());

        if (bankWide) {
            scope.bankWide = true;
            scope.restricted = false;
            addSegments(scope, parseSegments(user.getSegmentIds()));
            if (scope.allowedSegments.isEmpty() && !isBlank(user.getSegment())) {
                scope.allowedSegments.add(norm(user.getSegment()));
            }
            return scope;
        }

        List<UserOrgAssignment> assignments = safeAssignments(user);
        Set<String> segments = new LinkedHashSet<>();
        if (user.getSegmentIds() != null && !user.getSegmentIds().isBlank()) {
            segments.addAll(parseSegments(user.getSegmentIds()));
        }
        for (UserOrgAssignment a : assignments) {
            if (!isBlank(a.getSegmentId())) segments.add(a.getSegmentId());
        }
        if (segments.isEmpty() && !isBlank(user.getSegment()) && !isHeadOffice(user.getSegment())) {
            segments.add(user.getSegment());
        }
        addSegments(scope, segments);

        // Branch scope: explicit organization assignments first, then the legacy branch field.
        Set<String> branchRefs = new LinkedHashSet<>();
        for (UserOrgAssignment a : assignments) {
            if (!isBlank(a.getBranchId())) branchRefs.add(a.getBranchId());
        }
        if (!isBlank(user.getBranch())) branchRefs.add(user.getBranch());

        Set<Branch> resolvedBranches = new LinkedHashSet<>();
        for (String ref : branchRefs) {
            resolveBranch(ref).ifPresent(resolvedBranches::add);
        }

        boolean branchScoped = BRANCH_SCOPED_ROLES.contains(role) && !headOffice && !resolvedBranches.isEmpty();
        if (branchScoped) {
            for (Branch b : resolvedBranches) addBranch(scope, b);
        }

        if (DISTRICT_SCOPED_ROLES.contains(role)) {
            Set<String> districtRefs = new LinkedHashSet<>();
            if (!isBlank(user.getDistrict())) districtRefs.add(user.getDistrict());
            for (UserOrgAssignment a : assignments) {
                if (!isBlank(a.getUnitId())) {
                    organizationalUnitRepository.findById(a.getUnitId())
                            .filter(u -> "DISTRICT".equalsIgnoreCase(u.getUnitType()))
                            .ifPresent(u -> districtRefs.add(u.getId()));
                }
            }
            Set<OrganizationalUnit> districts = new LinkedHashSet<>();
            for (String ref : districtRefs) {
                resolveDistrict(ref).ifPresent(districts::add);
            }
            for (OrganizationalUnit d : districts) {
                scope.allowedDistricts.add(norm(d.getName()));
                scope.allowedDistricts.add(norm(d.getCode()));
                scope.allowedDistricts.add(norm(d.getId()));
                for (Branch b : branchRepository.findByParentDistrictId(d.getId())) addBranch(scope, b);
                for (Branch b : branchRepository.findAll()) {
                    if (d.getId().equalsIgnoreCase(b.getCanonicalDistrictId())) addBranch(scope, b);
                }
            }
            for (Branch b : resolvedBranches) addBranch(scope, b);
        }

        // Portfolio assignments can extend (never reduce) a user's visible portfolio.
        for (PortfolioAssignment pa : safePortfolioAssignments(user)) {
            if (!"ASSIGNED".equalsIgnoreCase(pa.getStatus())) continue;
            if (pa.getEntityId() != null) scope.allowedEntityIds.add(pa.getEntityId());
            if (!isBlank(pa.getBranchId())) resolveBranch(pa.getBranchId()).ifPresent(b -> addBranch(scope, b));
        }

        scope.restricted = !scope.allowedBranches.isEmpty() || !scope.allowedSegments.isEmpty()
                || !scope.allowedDistricts.isEmpty();

        if (!scope.restricted) {
            // Unknown/unspecified assignment: fail closed to the user's own declared branch/segment.
            if (!isBlank(user.getBranch())) {
                scope.allowedBranches.add(norm(user.getBranch()));
                scope.restricted = true;
            }
        }
        return scope;
    }

    public Scope unrestricted(String userReference) {
        Scope scope = new Scope();
        scope.userId = userReference;
        scope.bankWide = true;
        scope.restricted = false;
        return scope;
    }

    public Set<String> visibleFinancialSegments(Scope scope) {
        if (scope == null || scope.isBankWide() || scope.getAllowedSegments().isEmpty()) return null;
        return scope.getAllowedSegments();
    }

    private void addSegments(Scope scope, Collection<String> values) {
        if (values == null) return;
        for (String v : values) {
            if (!isBlank(v) && !isHeadOffice(v)) scope.allowedSegments.add(norm(v));
        }
    }

    private void addBranch(Scope scope, Branch b) {
        if (b == null) return;
        if (!isBlank(b.getId())) scope.allowedBranches.add(norm(b.getId()));
        if (!isBlank(b.getCode())) scope.allowedBranches.add(norm(b.getCode()));
        if (!isBlank(b.getName())) scope.allowedBranches.add(norm(b.getName()));
        if (!isBlank(b.getCbsBranchCode())) scope.allowedBranches.add(norm(b.getCbsBranchCode()));
        if (!isBlank(b.getCanonicalDistrictId())) scope.allowedDistricts.add(norm(b.getCanonicalDistrictId()));
    }

    private Optional<Branch> resolveBranch(String reference) {
        if (isBlank(reference)) return Optional.empty();
        String ref = reference.trim();
        return branchRepository.findById(ref)
                .or(() -> branchRepository.findFirstByCodeIgnoreCase(ref))
                .or(() -> branchRepository.findFirstByNameIgnoreCase(ref))
                .or(() -> branchRepository.findAll().stream()
                        .filter(b -> ref.equalsIgnoreCase(b.getCbsBranchCode())
                                || ref.equalsIgnoreCase(b.getCode())
                                || ref.equalsIgnoreCase(b.getName()))
                        .findFirst());
    }

    private Optional<OrganizationalUnit> resolveDistrict(String reference) {
        if (isBlank(reference)) return Optional.empty();
        String ref = reference.trim();
        return organizationalUnitRepository.findById(ref)
                .or(() -> organizationalUnitRepository.findByCodeIgnoreCase(ref))
                .or(() -> organizationalUnitRepository.findAll().stream()
                        .filter(u -> "DISTRICT".equalsIgnoreCase(u.getUnitType()))
                        .filter(u -> ref.equalsIgnoreCase(u.getName())
                                || ref.equalsIgnoreCase(u.getCode())
                                || norm(u.getName()).contains(norm(ref))
                                || norm(ref).contains(norm(u.getName())))
                        .findFirst());
    }

    private List<UserOrgAssignment> safeAssignments(User user) {
        try {
            List<UserOrgAssignment> byId = userOrgAssignmentRepository.findByUserIdAndActiveTrue(user.getId());
            if (!byId.isEmpty()) return byId;
            return userOrgAssignmentRepository.findByUserIdAndActiveTrue(user.getUsername());
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<PortfolioAssignment> safePortfolioAssignments(User user) {
        try {
            List<PortfolioAssignment> result = new ArrayList<>();
            if (user.getId() != null) {
                result.addAll(portfolioAssignmentRepository.findByMakerUserId(user.getId()));
                result.addAll(portfolioAssignmentRepository.findByCheckerUserId(user.getId()));
            }
            if (user.getUsername() != null) {
                result.addAll(portfolioAssignmentRepository.findByMakerUserId(user.getUsername()));
                result.addAll(portfolioAssignmentRepository.findByCheckerUserId(user.getUsername()));
            }
            return result.stream().filter(Objects::nonNull).distinct().collect(Collectors.toList());
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<String> parseSegments(String raw) {
        if (isBlank(raw)) return List.of();
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception ignored) {
            return Arrays.stream(raw.replace("[", "").replace("]", "").split(","))
                    .map(String::trim)
                    .map(s -> s.replace("\"", ""))
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toList());
        }
    }

    private static boolean isHeadOffice(String value) {
        if (isBlank(value)) return false;
        String v = value.trim().toLowerCase(Locale.ROOT);
        return v.equals("head office") || v.equals("ho") || v.equals("head office / ho")
                || v.contains("head office") || v.equals("hq") || v.startsWith("hq-");
    }

    private static String norm(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
