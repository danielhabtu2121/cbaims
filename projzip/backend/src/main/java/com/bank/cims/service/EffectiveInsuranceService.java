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

    public static class CollateralProtectionResult {
        public String collateralId;
        public String collateralCode;
        public String category;
        public double marketValue;
        public double haircut;
        public double netSecurityValue;
        public double totalLinkedExposure;
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

    /**
     * Compute current effective insurance coverage for a collateral asset grounded in CIMS policy lifecycle.
     */
    public double computeEffectiveCoverage(String collateralId, List<InsurancePolicy> policies, LocalDate asOfDate) {
        if (policies == null || policies.isEmpty()) {
            return 0.0;
        }

        LocalDate effectiveAsOf = asOfDate != null ? asOfDate : LocalDate.now();

        // 1. Identify superseded policies (replaces_policy_id)
        Set<String> replacedPolicyIds = policies.stream()
                .map(InsurancePolicy::getReplacesPolicyId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        double effectiveTotal = 0.0;

        for (InsurancePolicy p : policies) {
            // Must be open and authorized if those flags exist
            if ("C".equalsIgnoreCase(p.getRecordStat())) continue;
            if ("U".equalsIgnoreCase(p.getAuthStat())) continue;

            // Must have active/approved status
            String stat = p.getStatus() != null ? p.getStatus().trim() : "";
            if (!"Active".equalsIgnoreCase(stat) && !"Approved".equalsIgnoreCase(stat)) {
                continue;
            }

            // Exclude if explicitly replaced by another active policy
            if (p.getId() != null && replacedPolicyIds.contains(p.getId())) {
                continue;
            }

            // Check if renewal has actually taken effect
            LocalDate effDate = parseDate(p.getEffectiveDate());
            if (effDate != null && effDate.isAfter(effectiveAsOf)) {
                // Renewal policy not yet effective
                continue;
            }

            // Check expiry date
            LocalDate expDate = parseDate(p.getExpiryDate());
            if (expDate != null && expDate.isBefore(effectiveAsOf)) {
                // Policy has expired
                continue;
            }

            // Add base insured amount
            double policySum = p.getInsuredAmount();

            effectiveTotal += policySum;
        }

        return effectiveTotal;
    }

    /**
     * Determine if a collateral has any expired policies.
     */
    public boolean checkHasExpiredPolicies(List<InsurancePolicy> policies, LocalDate asOfDate) {
        if (policies == null || policies.isEmpty()) return false;
        LocalDate effectiveAsOf = asOfDate != null ? asOfDate : LocalDate.now();

        for (InsurancePolicy p : policies) {
            String stat = p.getStatus() != null ? p.getStatus().trim() : "";
            LocalDate expDate = parseDate(p.getExpiryDate());
            if ("Expired".equalsIgnoreCase(stat) || (expDate != null && expDate.isBefore(effectiveAsOf))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Comprehensive protection calculation for a single collateral asset.
     */
    public CollateralProtectionResult evaluateCollateral(Collateral collateral, List<LoanAccount> linkedFacilities, List<InsurancePolicy> policies, LocalDate asOfDate) {
        CollateralProtectionResult res = new CollateralProtectionResult();
        if (collateral == null) return res;

        res.collateralId = collateral.getId();
        res.collateralCode = collateral.getCode();
        res.category = collateral.getCategory();
        res.marketValue = collateral.getValuationAmount();
        res.haircut = collateral.getHaircut();
        res.netSecurityValue = collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0));

        // Total linked loan exposure
        double totalExp = 0.0;
        if (linkedFacilities != null) {
            for (LoanAccount f : linkedFacilities) {
                if (f != null) {
                    totalExp += f.getOutstandingBalance();
                }
            }
        }
        res.totalLinkedExposure = totalExp;

        // Check if insurance is mandatory for this category
        res.isMandatory = isInsuranceMandatoryForCategory(collateral.getCategory());

        // Insurance Requirement = MAX(Outstanding Exposure, Collateral Value)
        if (res.isMandatory) {
            res.insuranceRequired = Math.max(totalExp, collateral.getValuationAmount());
        } else {
            res.insuranceRequired = 0.0;
        }

        // Effective Insurance Coverage
        LocalDate effectiveAsOf = asOfDate != null ? asOfDate : LocalDate.now();
        res.effectiveInsurance = computeEffectiveCoverage(collateral.getId(), policies, effectiveAsOf);
        res.hasExpiredPolicies = checkHasExpiredPolicies(policies, effectiveAsOf);

        // Insurance Gap = MAX(0, Required - Effective)
        res.insuranceGap = Math.max(0.0, res.insuranceRequired - res.effectiveInsurance);

        // Raw Coverage Percentage (unclipped)
        if (res.insuranceRequired > 0) {
            res.coveragePercentage = Math.round((res.effectiveInsurance / res.insuranceRequired) * 1000.0) / 10.0;
        } else {
            res.coveragePercentage = 100.0;
        }

        // Adequacy Status: 0% = Uninsured, >0% and <100% = Underinsured, >=100% = Adequate
        if (!res.isMandatory) {
            res.adequacyStatus = "Not Required";
        } else if (res.effectiveInsurance <= 0.0) {
            res.adequacyStatus = "Uninsured";
        } else if (res.effectiveInsurance < res.insuranceRequired) {
            res.adequacyStatus = "Underinsured";
        } else {
            res.adequacyStatus = "Adequate";
        }

        // Active policy numbers
        if (policies != null) {
            for (InsurancePolicy p : policies) {
                LocalDate exp = parseDate(p.getExpiryDate());
                if ("Active".equalsIgnoreCase(p.getStatus()) && (exp == null || !exp.isBefore(effectiveAsOf))) {
                    res.activePolicyNumbers.add(p.getPolicyNumber());
                }
            }
        }
        res.activePolicyCount = res.activePolicyNumbers.size();

        return res;
    }

    private boolean isInsuranceMandatoryForCategory(String category) {
        if (category == null || category.isBlank()) return true;
        try {
            List<CollateralTaxonomy> tax = collateralTaxonomyRepository.findByCategoryIgnoreCase(category);
            if (tax.isEmpty()) return true;
            return tax.stream().anyMatch(CollateralTaxonomy::isInsuranceMandatory);
        } catch (Exception e) {
            return true;
        }
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.substring(0, Math.min(10, s.length())), DATE_FMT);
        } catch (Exception e) {
            return null;
        }
    }
}
