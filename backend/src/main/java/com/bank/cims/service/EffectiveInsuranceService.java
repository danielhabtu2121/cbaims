package com.bank.cims.service;

import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Single authoritative service for all collateral insurance requirement, effective coverage,
 * and adequacy calculations across CIMS.
 *
 * Grounded in the CIMS policy lifecycle:
 * Insurance Requirement = MAX(Outstanding Exposure, Collateral Market Value)
 * Coverage % = (Active Valid Insurance / Insurance Requirement) * 100
 * Status:
 *   - 0% = Uninsured
 *   - >0% and <100% = Underinsured
 *   - >=100% = Adequate
 */
@Service
public class EffectiveInsuranceService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Autowired
    private CollateralTaxonomyRepository collateralTaxonomyRepository;

    @Autowired
    private PolicyEndorsementRepository policyEndorsementRepository;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private ConfigurationService configurationService;

    public static class CollateralProtectionResult {
        public String collateralId;
        public String collateralCode;
        public String category;
        public double marketValue;
        public double haircut;
        public double netSecurityValue;
        public double totalLinkedExposure;
        public double totalAllocatedSecuredExposure;
        public double totalAllocatedSecurity;
        public double insuranceRequired;
        public double effectiveInsurance;
        public double insuranceGap;
        public double coveragePercentage;
        public String adequacyStatus;
        public boolean isMandatory;
        public boolean hasExpiredPolicies;
        public int activePolicyCount;
        public List<String> activePolicyNumbers = new ArrayList<>();
    }

    public static class PolicyCategorizationResult {
        public List<InsurancePolicy> activeValidPolicies = new ArrayList<>();
        public List<InsurancePolicy> expiredPolicies = new ArrayList<>();
        public List<InsurancePolicy> expiring30DaysPolicies = new ArrayList<>();
        public List<InsurancePolicy> dueWithin7DaysPolicies = new ArrayList<>();
        public double totalActiveSumInsured = 0.0;
        public boolean hasExpiredUnreplacedPolicies = false;
    }

    /**
     * Authoritative single-point policy lifecycle categorization.
     * Accurately distinguishes Draft, Pending Approval, Active, Expiring, Expired, Renewed, Replaced, Cancelled, Closed.
     * When an old policy is replaced/renewed by a valid policy, the old policy is NEVER treated as an active risk.
     */
    public PolicyCategorizationResult categorizePolicies(List<InsurancePolicy> policies, LocalDate asOfDate, int expiringDays) {
        return categorizePoliciesWithAllocations(policies, null, asOfDate, expiringDays);
    }

    /**
     * Categorizes policies while using explicit per-collateral allocated insured amounts when provided,
     * preventing double-counting when one policy covers multiple collaterals.
     */
    public PolicyCategorizationResult categorizePoliciesWithAllocations(
            List<InsurancePolicy> policies,
            Map<String, Double> allocatedAmountByPolicyId,
            LocalDate asOfDate,
            int expiringDays) {
        PolicyCategorizationResult res = new PolicyCategorizationResult();
        if (policies == null || policies.isEmpty()) return res;

        LocalDate effectiveAsOf = asOfDate != null ? asOfDate : LocalDate.now();
        int warnDays = expiringDays > 0 ? expiringDays : 30;

        // 1. Identify all superseded policy IDs (replaced or renewed from)
        Set<String> supersededPolicyIds = new HashSet<>();
        for (InsurancePolicy p : policies) {
            String stat = p.getStatus() != null ? p.getStatus().trim() : "";
            if ("Cancelled".equalsIgnoreCase(stat) || "Closed".equalsIgnoreCase(stat) || "Draft".equalsIgnoreCase(stat)) {
                continue;
            }
            if (p.getReplacesPolicyId() != null && !p.getReplacesPolicyId().isBlank()) {
                supersededPolicyIds.add(p.getReplacesPolicyId().trim());
            }
            if (p.getRenewedFromPolicyId() != null && !p.getRenewedFromPolicyId().isBlank()) {
                // If renewal is active/approved and effective, old policy is superseded
                LocalDate eff = parseDate(p.getEffectiveDate());
                if (eff == null || !eff.isAfter(effectiveAsOf)) {
                    supersededPolicyIds.add(p.getRenewedFromPolicyId().trim());
                }
            }
        }

        // 2. Classify each policy
        for (InsurancePolicy p : policies) {
            if ("C".equalsIgnoreCase(p.getRecordStat())) continue;
            if ("U".equalsIgnoreCase(p.getAuthStat())) continue;

            String stat = p.getStatus() != null ? p.getStatus().trim() : "";
            if ("Cancelled".equalsIgnoreCase(stat) || "Closed".equalsIgnoreCase(stat) || "Draft".equalsIgnoreCase(stat)) {
                continue;
            }

            // If this policy was replaced or renewed by an active policy, it is superseded
            if (p.getId() != null && supersededPolicyIds.contains(p.getId())) {
                continue;
            }

            LocalDate expDate = parseDate(p.getExpiryDate());
            LocalDate effDate = parseDate(p.getEffectiveDate());

            boolean isExpired = "Expired".equalsIgnoreCase(stat) || (expDate != null && expDate.isBefore(effectiveAsOf));

            if (isExpired) {
                res.expiredPolicies.add(p);
                res.hasExpiredUnreplacedPolicies = true;
                continue;
            }

            // Check if status is Active or Approved
            if ("Active".equalsIgnoreCase(stat) || "Approved".equalsIgnoreCase(stat)) {
                if (effDate != null && effDate.isAfter(effectiveAsOf)) {
                    // Future inception policy, not yet effective
                    continue;
                }

                res.activeValidPolicies.add(p);
                double effectiveAmt = (allocatedAmountByPolicyId != null && allocatedAmountByPolicyId.containsKey(p.getId()))
                        ? allocatedAmountByPolicyId.get(p.getId())
                        : p.getInsuredAmount();
                res.totalActiveSumInsured += effectiveAmt;

                if (expDate != null) {
                    long daysToExpiry = java.time.temporal.ChronoUnit.DAYS.between(effectiveAsOf, expDate);
                    if (daysToExpiry >= 0 && daysToExpiry <= 7) {
                        res.dueWithin7DaysPolicies.add(p);
                    }
                    if (daysToExpiry >= 0 && daysToExpiry <= warnDays) {
                        res.expiring30DaysPolicies.add(p);
                    }
                }
            }
        }

        return res;
    }

    /**
     * Compute current effective insurance coverage for a collateral asset grounded in CIMS policy lifecycle.
     */
    public double computeEffectiveCoverage(String collateralId, List<InsurancePolicy> policies, LocalDate asOfDate) {
        PolicyCategorizationResult cat = categorizePolicies(policies, asOfDate, 30);
        return cat.totalActiveSumInsured;
    }

    /**
     * Determine if a collateral has any expired policies requiring replacement or renewal.
     */
    public boolean checkHasExpiredPolicies(List<InsurancePolicy> policies, LocalDate asOfDate) {
        PolicyCategorizationResult cat = categorizePolicies(policies, asOfDate, 30);
        return cat.hasExpiredUnreplacedPolicies;
    }

    /**
     * Comprehensive protection calculation for a single collateral asset (backward-compatible overload).
     */
    public CollateralProtectionResult evaluateCollateral(Collateral collateral, List<LoanAccount> linkedFacilities, List<InsurancePolicy> policies, LocalDate asOfDate) {
        return evaluateCollateral(collateral, null, linkedFacilities, policies, asOfDate, null);
    }

    /**
     * Comprehensive protection calculation for a single collateral asset with allocation-aware exposure.
     * Correctly handles:
     * - 1 collateral -> 1 facility
     * - 1 collateral -> multiple facilities
     * - multiple collateral -> 1 facility
     * - multiple collateral -> multiple facilities
     * - cross-collateralization
     * Uses link allocations (allocatedAmount, linkedAmount, linkedPercent, utilAmount, utilizationPct, linkageType).
     * Never double counts facility exposure against multiple collaterals.
     */
    public CollateralProtectionResult evaluateCollateral(
            Collateral collateral,
            List<LoanCollateralLink> collateralLinks,
            List<LoanAccount> linkedFacilities,
            List<InsurancePolicy> policies,
            LocalDate asOfDate,
            Map<String, List<LoanCollateralLink>> allLinksByFacilityId) {

        CollateralProtectionResult res = new CollateralProtectionResult();
        if (collateral == null) return res;

        res.collateralId = collateral.getId();
        res.collateralCode = collateral.getCode();
        res.category = collateral.getCategory();
        res.marketValue = collateral.getValuationAmount();
        res.haircut = collateral.getHaircut();
        res.netSecurityValue = collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0));

        // Allocation-aware exposure calculation
        double allocatedSecuredExp = 0.0;
        double totalNominalAllocSecurity = 0.0;
        double rawFacilityBalanceSum = 0.0;

        if (linkedFacilities != null && !linkedFacilities.isEmpty()) {
            for (LoanAccount f : linkedFacilities) {
                if (f == null) continue;
                rawFacilityBalanceSum += f.getOutstandingBalance();
                double balance = f.getOutstandingBalance();
                String facId = f.getId();
                String facRef = f.getLoanReference();

                // Find link between this collateral and facility
                LoanCollateralLink matchingLink = null;
                if (collateralLinks != null) {
                    for (LoanCollateralLink l : collateralLinks) {
                        if (!isLinkActive(l)) continue;
                        String lFacId = l.getFacilityId();
                        String lLoanAccId = l.getLoanAccountId();
                        String fLineCode = f.getLineCode();
                        boolean matches = (lFacId != null && (lFacId.equalsIgnoreCase(facId) || (facRef != null && lFacId.equalsIgnoreCase(facRef)) || (fLineCode != null && lFacId.equalsIgnoreCase(fLineCode))))
                                       || (lLoanAccId != null && (lLoanAccId.equalsIgnoreCase(facId) || (facRef != null && lLoanAccId.equalsIgnoreCase(facRef)) || (fLineCode != null && lLoanAccId.equalsIgnoreCase(fLineCode))));
                        if (matches) {
                            matchingLink = l;
                            break;
                        }
                    }
                }

                // If no direct link passed, try 1:1 fallback
                if (matchingLink == null && collateralLinks == null) {
                    allocatedSecuredExp += balance;
                    totalNominalAllocSecurity += res.netSecurityValue;
                    continue;
                }

                if (matchingLink == null) {
                    continue;
                }

                // Compute nominal link allocation
                double nomAlloc = 0.0;
                if (matchingLink.getAllocatedAmount() > 0) {
                    nomAlloc = matchingLink.getAllocatedAmount();
                } else if (matchingLink.getLinkedAmount() > 0) {
                    nomAlloc = matchingLink.getLinkedAmount();
                } else if (matchingLink.getLinkedPercent() > 0) {
                    nomAlloc = (matchingLink.getLinkedPercent() / 100.0) * balance;
                } else if (matchingLink.getUtilAmount() > 0) {
                    nomAlloc = matchingLink.getUtilAmount();
                } else if (matchingLink.getUtilizationPct() > 0) {
                    nomAlloc = (matchingLink.getUtilizationPct() / 100.0) * balance;
                }

                totalNominalAllocSecurity += nomAlloc;

                // Find all links for this facility to compute total allocation and apportion balance without double counting
                List<LoanCollateralLink> facLinks = null;
                if (allLinksByFacilityId != null) {
                    facLinks = allLinksByFacilityId.get(facId);
                    if (facLinks == null && facRef != null) {
                        facLinks = allLinksByFacilityId.get(facRef);
                    }
                    if (facLinks == null && f.getLineCode() != null) {
                        facLinks = allLinksByFacilityId.get(f.getLineCode());
                    }
                }

                double totalFacNomAlloc = 0.0;
                int facLinkCount = 1;
                if (facLinks != null && !facLinks.isEmpty()) {
                    facLinkCount = facLinks.size();
                    for (LoanCollateralLink fl : facLinks) {
                        if (!isLinkActive(fl)) continue;
                        double fa = fl.getAllocatedAmount() > 0 ? fl.getAllocatedAmount()
                                : (fl.getLinkedAmount() > 0 ? fl.getLinkedAmount()
                                : (fl.getLinkedPercent() > 0 ? (fl.getLinkedPercent() / 100.0) * balance
                                : (fl.getUtilAmount() > 0 ? fl.getUtilAmount()
                                : (fl.getUtilizationPct() > 0 ? (fl.getUtilizationPct() / 100.0) * balance : 0.0))));
                        totalFacNomAlloc += fa;
                    }
                }

                double linkExposure;
                if (totalFacNomAlloc > 0 && nomAlloc > 0) {
                    double ratio = nomAlloc / totalFacNomAlloc;
                    linkExposure = balance * Math.min(1.0, ratio);
                } else if (facLinkCount > 1) {
                    // Shared collateral without explicit allocation amounts: equal proportional split
                    linkExposure = balance / facLinkCount;
                } else if (nomAlloc > 0) {
                    linkExposure = Math.min(balance, nomAlloc);
                } else {
                    linkExposure = balance;
                }

                allocatedSecuredExp += linkExposure;
            }
        }

        res.totalAllocatedSecuredExposure = allocatedSecuredExp;
        res.totalLinkedExposure = allocatedSecuredExp > 0 ? allocatedSecuredExp : rawFacilityBalanceSum;
        res.totalAllocatedSecurity = Math.min(res.netSecurityValue, totalNominalAllocSecurity > 0 ? totalNominalAllocSecurity : res.netSecurityValue);

        // Check if insurance is mandatory for this category and type
        res.isMandatory = isInsuranceMandatory(collateral.getCategory(), collateral.getType());

        // Insurance Requirement = MAX(Allocated Secured Exposure, Collateral Value / Insurable Value)
        if (res.isMandatory) {
            double baseAssetVal = (collateral.getInsurableValue() != null && collateral.getInsurableValue() > 0)
                    ? collateral.getInsurableValue()
                    : collateral.getValuationAmount();
            res.insuranceRequired = Math.max(res.totalAllocatedSecuredExposure, baseAssetVal);
        } else {
            res.insuranceRequired = 0.0;
        }

        // Effective Insurance Coverage using authoritative policy categorization
        LocalDate effectiveAsOf = asOfDate != null ? asOfDate : LocalDate.now();
        PolicyCategorizationResult polCat = categorizePolicies(policies, effectiveAsOf, 30);
        res.effectiveInsurance = polCat.totalActiveSumInsured;
        res.hasExpiredPolicies = polCat.hasExpiredUnreplacedPolicies;

        // Insurance Gap = MAX(0, Required - Effective)
        res.insuranceGap = Math.max(0.0, res.insuranceRequired - res.effectiveInsurance);

        // Raw Coverage Percentage (unclipped)
        if (res.insuranceRequired > 0) {
            res.coveragePercentage = Math.round((res.effectiveInsurance / res.insuranceRequired) * 1000.0) / 10.0;
        } else {
            res.coveragePercentage = 100.0;
        }

        // Adequacy Status using configured threshold (System Parameter: min_coverage_adequacy_pct)
        double minAdequacyPct = 100.0;
        if (configurationService != null) {
            try {
                minAdequacyPct = configurationService.getMinimumCoverageAdequacyPct();
            } catch (Exception ignored) {}
        }
        double threshold = res.insuranceRequired * (minAdequacyPct / 100.0);

        if (!res.isMandatory) {
            res.adequacyStatus = "Not Required";
        } else if (res.effectiveInsurance <= 0.0) {
            res.adequacyStatus = "Uninsured";
        } else if (res.effectiveInsurance + 1e-6 < threshold) {
            res.adequacyStatus = "Underinsured";
        } else {
            res.adequacyStatus = "Adequate";
        }

        // Active policy numbers
        for (InsurancePolicy p : polCat.activeValidPolicies) {
            if (p.getPolicyNumber() != null) {
                res.activePolicyNumbers.add(p.getPolicyNumber());
            }
        }
        res.activePolicyCount = res.activePolicyNumbers.size();

        return res;
    }

    /**
     * Determines whether insurance is mandatory by resolving against CollateralTaxonomy.
     * Evaluates specific subCategory / type first, and falls back to category-level rule.
     */
    public boolean isInsuranceMandatory(String category, String type) {
        if (category == null || category.isBlank()) return true;
        try {
            // Finding 35: ONLY active taxonomy records can determine insurance requirements
            List<CollateralTaxonomy> allTax = collateralTaxonomyRepository.findAll().stream()
                    .filter(CollateralTaxonomy::isActive)
                    .toList();
            if (allTax.isEmpty()) return true;

            String normCat = category.trim().toLowerCase(Locale.ROOT);
            String normType = type != null ? type.trim().toLowerCase(Locale.ROOT) : "";

            // 1. Try exact or canonical alias match on both category and subCategory (type)
            if (!normType.isBlank()) {
                // Tier 1: Exact category + exact subCategory
                for (CollateralTaxonomy t : allTax) {
                    if (t.getCategory() != null && t.getCategory().trim().equalsIgnoreCase(normCat)
                            && t.getSubCategory() != null && t.getSubCategory().trim().equalsIgnoreCase(normType)) {
                        return t.isInsuranceMandatory();
                    }
                }

                // Tier 2: Canonical alias match
                for (CollateralTaxonomy t : allTax) {
                    if (t.getCategory() != null && isCategoryMatch(t.getCategory(), normCat)) {
                        if (t.getSubCategory() != null && isSubCategoryMatch(t.getSubCategory(), normType)) {
                            return t.isInsuranceMandatory();
                        }
                    }
                }
            }

            // 2. Fall back to category-level check
            List<CollateralTaxonomy> catTax = allTax.stream()
                    .filter(t -> t.getCategory() != null && isCategoryMatch(t.getCategory(), normCat))
                    .toList();
            if (catTax.isEmpty()) return true;
            return catTax.stream().anyMatch(CollateralTaxonomy::isInsuranceMandatory);
        } catch (Exception e) {
            return true;
        }
    }

    public boolean isInsuranceMandatoryForCategory(String category) {
        return isInsuranceMandatory(category, null);
    }

    public String getMandatoryCoverageType(String category, String type) {
        if (category == null || category.isBlank()) return null;
        try {
            // Finding 35: ONLY active taxonomy records can determine mandatory coverage
            List<CollateralTaxonomy> allTax = collateralTaxonomyRepository.findAll().stream()
                    .filter(CollateralTaxonomy::isActive)
                    .toList();
            String normCat = category.trim().toLowerCase(Locale.ROOT);
            String normType = type != null ? type.trim().toLowerCase(Locale.ROOT) : "";

            if (!normType.isBlank()) {
                // Tier 1: Exact category + exact subCategory
                for (CollateralTaxonomy t : allTax) {
                    if (t.getCategory() != null && t.getCategory().trim().equalsIgnoreCase(normCat)
                            && t.getSubCategory() != null && t.getSubCategory().trim().equalsIgnoreCase(normType)) {
                        if (t.getMandatoryCoverageType() != null && !t.getMandatoryCoverageType().isBlank()) {
                            return t.getMandatoryCoverageType();
                        }
                    }
                }

                // Tier 2: Canonical alias match
                for (CollateralTaxonomy t : allTax) {
                    if (t.getCategory() != null && isCategoryMatch(t.getCategory(), normCat)
                            && t.getSubCategory() != null && isSubCategoryMatch(t.getSubCategory(), normType)) {
                        if (t.getMandatoryCoverageType() != null && !t.getMandatoryCoverageType().isBlank()) {
                            return t.getMandatoryCoverageType();
                        }
                    }
                }
            }
            // Tier 3: Category level fallback
            for (CollateralTaxonomy t : allTax) {
                if (t.getCategory() != null && isCategoryMatch(t.getCategory(), normCat)) {
                    if (t.getMandatoryCoverageType() != null && !t.getMandatoryCoverageType().isBlank()) {
                        return t.getMandatoryCoverageType();
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean isCategoryMatch(String catA, String catB) {
        String a = catA.toLowerCase(Locale.ROOT);
        String b = catB.toLowerCase(Locale.ROOT);
        if (a.equals(b)) return true;
        if ((a.contains("immovable") || a.contains("real")) && (b.contains("immovable") || b.contains("real"))) return true;
        if ((a.contains("movable") || a.contains("vehicle")) && (b.contains("movable") || b.contains("vehicle"))) return true;
        if (a.contains("machin") && b.contains("machin")) return true;
        if (a.contains("financial") && b.contains("financial")) return true;
        return a.contains(b) || b.contains(a);
    }

    private boolean isSubCategoryMatch(String subA, String subB) {
        String a = subA.toLowerCase(Locale.ROOT);
        String b = subB.toLowerCase(Locale.ROOT);
        return a.equals(b) || a.contains(b) || b.contains(a);
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.substring(0, Math.min(10, s.length())), DATE_FMT);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isLinkActive(LoanCollateralLink l) {
        if (l == null) return false;
        String s = l.getStatus() != null ? l.getStatus().trim() : "";
        String rs = l.getRelationshipStatus() != null ? l.getRelationshipStatus().trim() : "";
        if ("Historical".equalsIgnoreCase(s) || "Released".equalsIgnoreCase(s) || "Ended".equalsIgnoreCase(s) || "Inactive".equalsIgnoreCase(s)) return false;
        if ("Historical".equalsIgnoreCase(rs) || "Released".equalsIgnoreCase(rs) || "Ended".equalsIgnoreCase(rs) || "Inactive".equalsIgnoreCase(rs)) return false;
        return true;
    }
}
