package com.bank.cims.service;

import com.bank.cims.dto.InsuranceComplianceDto;
import com.bank.cims.model.*;
import com.bank.cims.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Authoritative service for calculating insurance requirements, coverage adequacy,
 * and multi-facility compliance across CIMS.
 */
@Service
public class InsuranceRequirementService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Autowired private CollateralRepository collateralRepository;
    @Autowired private LoanAccountRepository loanAccountRepository;
    @Autowired private LoanCollateralLinkRepository loanCollateralLinkRepository;
    @Autowired private ApprovedInsurerRepository approvedInsurerRepository;
    @Autowired private CollateralTaxonomyRepository collateralTaxonomyRepository;
    @Autowired private MandatoryDocumentRuleRepository mandatoryDocumentRuleRepository;
    @Autowired private OwnershipDocumentRepository ownershipDocumentRepository;
    @Autowired private InsurancePolicyRepository insurancePolicyRepository;
    @Autowired private ConfigurationService configurationService;

    /**
     * Authoritative calculation of insurance requirement and compliance for a collateral and policy.
     */
    public InsuranceComplianceDto evaluateCompliance(String collateralId, InsurancePolicy policy) {
        return evaluateCompliance(collateralId, policy, (List<Map<String, Object>>) null);
    }

    public InsuranceComplianceDto evaluateCompliance(String collateralId, InsurancePolicy policy, String loanAccountId) {
        if (policy != null && loanAccountId != null && (policy.getLoanAccountId() == null || policy.getLoanAccountId().isBlank())) {
            policy.setLoanAccountId(loanAccountId);
        }
        return evaluateCompliance(collateralId, policy, (List<Map<String, Object>>) null);
    }

    public InsuranceComplianceDto evaluateCompliance(String collateralId, InsurancePolicy policy, List<Map<String, Object>> attachedDocs) {
        InsuranceComplianceDto dto = new InsuranceComplianceDto();

        if (collateralId == null || collateralId.isBlank()) {
            dto.setOverallStatus("NON_COMPLIANT");
            dto.getValidationErrors().add("Collateral ID is mandatory for insurance compliance evaluation.");
            return dto;
        }

        Collateral collateral = collateralRepository.findById(collateralId)
                .or(() -> collateralRepository.findByCode(collateralId))
                .orElse(null);

        if (collateral == null) {
            dto.setOverallStatus("NON_COMPLIANT");
            dto.getValidationErrors().add("Collateral not found: " + collateralId);
            return dto;
        }

        dto.setCollateralCategory(collateral.getCategory());
        dto.setCollateralType(collateral.getType());
        dto.setCollateralValue(collateral.getValuationAmount());
        dto.setHaircut(collateral.getHaircut());
        double nsv = collateral.getValuationAmount() * (1.0 - (collateral.getHaircut() / 100.0));
        dto.setNetSecurityValue(nsv);

        // 1. Determine whether insurance is mandatory and what coverage type is required
        boolean mandatory = isInsuranceMandatory(collateral.getCategory(), collateral.getType());
        dto.setInsuranceRequired(mandatory);
        String requiredCoverage = getMandatoryCoverageType(collateral.getCategory(), collateral.getType());
        dto.setRequiredCoverageType(requiredCoverage != null ? requiredCoverage : "Standard Property / Loss Payee");

        // 2. Multi-facility allocated secured exposure calculation
        double allocatedExposure = calculateAllocatedSecuredExposure(collateral);
        dto.setOutstandingExposure(allocatedExposure);

        // Required Insurance = MAX(Allocated Secured Exposure, Collateral Value)
        double requiredAmount = mandatory ? Math.max(allocatedExposure, collateral.getValuationAmount()) : 0.0;
        dto.setRequiredInsuranceAmount(requiredAmount);

        // If no policy provided, evaluate as unattached/uninsured
        if (policy == null) {
            dto.setInsuredAmount(0.0);
            dto.setCoveragePercentage(0.0);
            dto.setCoverageGap(requiredAmount);
            dto.setCoverageStatus(mandatory ? "UNINSURED" : "NOT_REQUIRED");
            dto.setOverallStatus(mandatory ? "NON_COMPLIANT" : "COMPLIANT");
            if (mandatory) {
                dto.getValidationErrors().add("No active insurance policy registered for mandatory collateral asset.");
            }
            return dto;
        }

        // 3. Evaluate Provided Policy
        double insuredAmt = policy.getInsuredAmount();
        dto.setInsuredAmount(insuredAmt);

        if (requiredAmount > 0) {
            double covPct = Math.round((insuredAmt / requiredAmount) * 1000.0) / 10.0;
            dto.setCoveragePercentage(covPct);
            if (insuredAmt < requiredAmount) {
                dto.setCoverageGap(requiredAmount - insuredAmt);
                dto.setCoverageExcess(0.0);
                dto.setCoverageStatus("UNDERINSURED");
                dto.getValidationErrors().add(String.format(Locale.ROOT,
                        "Policy is underinsured. Insured Amount (ETB %,.2f) is below the required coverage (ETB %,.2f). Under-insurance is prohibited.",
                        insuredAmt, requiredAmount));
            } else if (insuredAmt > requiredAmount) {
                dto.setCoverageGap(0.0);
                dto.setCoverageExcess(insuredAmt - requiredAmount);
                dto.setCoverageStatus("EXCESS_INSURANCE");
            } else {
                dto.setCoverageGap(0.0);
                dto.setCoverageExcess(0.0);
                dto.setCoverageStatus("ADEQUATELY_INSURED");
            }
        } else {
            dto.setCoveragePercentage(100.0);
            dto.setCoverageGap(0.0);
            dto.setCoverageExcess(insuredAmt);
            dto.setCoverageStatus(mandatory ? "ADEQUATELY_INSURED" : "NOT_REQUIRED");
        }

        // 4. Insurer Validation
        if (configurationService.isApprovedInsurerRequired()) {
            String insName = policy.getInsurerName() != null ? policy.getInsurerName().trim() : "";
            if (insName.isBlank()) {
                dto.setApprovedInsurerStatus("MISSING");
                dto.getValidationErrors().add("Approved insurance company selection is mandatory.");
            } else {
                boolean approved = isApprovedInsurer(insName);
                if (!approved) {
                    dto.setApprovedInsurerStatus("UNAPPROVED");
                    dto.getValidationErrors().add("Insurer '" + insName + "' is not an active approved insurance company.");
                } else {
                    dto.setApprovedInsurerStatus("APPROVED");
                }
            }
        }

        // 5. Coverage Type Compatibility Validation
        if (mandatory && requiredCoverage != null && !requiredCoverage.isBlank()) {
            String polCov = policy.getCoverageType() != null ? policy.getCoverageType().trim() : "";
            if (polCov.isBlank()) {
                dto.getValidationErrors().add("Coverage type is mandatory. Required coverage for " + collateral.getCategory() + " is: " + requiredCoverage);
            } else if (!isCoverageTypeCompatible(polCov, requiredCoverage)) {
                dto.getValidationErrors().add(String.format(
                        "Policy coverage type '%s' does not satisfy mandatory coverage type '%s' required for %s / %s.",
                        polCov, requiredCoverage, collateral.getCategory(), collateral.getType()));
            }
        }

        // 6. Policy Dates & Validity Term Validation
        validatePolicyDates(policy, collateral, dto);

        // 7. Duplicate Policy Validation
        validateDuplicates(policy, collateral, dto);

        // 8. Mandatory Documents Validation
        if (configurationService.areMandatoryDocumentRulesEnabled()) {
            validateMandatoryDocuments(collateral, policy, attachedDocs, dto);
        }

        // Overall compliance determination
        if (dto.getValidationErrors().isEmpty()) {
            dto.setOverallStatus("COMPLIANT");
        } else {
            dto.setOverallStatus("NON_COMPLIANT");
        }

        return dto;
    }

    /**
     * Apportions and sums active facility exposure across all links for this collateral.
     */
    public double calculateAllocatedSecuredExposure(Collateral collateral) {
        if (collateral == null) return 0.0;
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        if (collateral.getCode() != null && !collateral.getCode().equalsIgnoreCase(collateral.getId())) {
            List<LoanCollateralLink> codeLinks = loanCollateralLinkRepository.findByCollateralId(collateral.getCode());
            for (LoanCollateralLink cl : codeLinks) {
                if (links.stream().noneMatch(l -> l.getId().equalsIgnoreCase(cl.getId()))) {
                    links.add(cl);
                }
            }
        }

        double totalExposure = 0.0;
        for (LoanCollateralLink link : links) {
            if ("Released".equalsIgnoreCase(link.getStatus()) || "Historical".equalsIgnoreCase(link.getStatus())) {
                continue;
            }
            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (facId == null) continue;

            Optional<LoanAccount> loanOpt = loanAccountRepository.findById(facId)
                    .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(facId))
                    .or(() -> loanAccountRepository.findFirstByLineCodeIgnoreCase(facId));

            if (loanOpt.isPresent()) {
                LoanAccount loan = loanOpt.get();
                double balance = Math.max(0, loan.getOutstandingBalance());

                // Check allocation amount on link
                double alloc = 0.0;
                if (link.getAllocatedAmount() > 0) {
                    alloc = link.getAllocatedAmount();
                } else if (link.getLinkedAmount() > 0) {
                    alloc = link.getLinkedAmount();
                } else if (link.getLinkedPercent() > 0) {
                    alloc = (link.getLinkedPercent() / 100.0) * balance;
                } else {
                    alloc = balance;
                }
                totalExposure += Math.min(balance, alloc > 0 ? alloc : balance);
            }
        }
        return totalExposure;
    }

    public boolean isInsuranceMandatory(String category, String type) {
        if (category == null || category.isBlank()) return true;
        try {
            List<CollateralTaxonomy> all = collateralTaxonomyRepository.findAll();
            if (all.isEmpty()) return true;

            String normCat = category.trim().toLowerCase(Locale.ROOT);
            String normType = type != null ? type.trim().toLowerCase(Locale.ROOT) : "";

            if (!normType.isBlank()) {
                for (CollateralTaxonomy t : all) {
                    if (t.getCategory() != null && t.getCategory().trim().equalsIgnoreCase(normCat)
                            && t.getSubCategory() != null && t.getSubCategory().trim().equalsIgnoreCase(normType)) {
                        return t.isInsuranceMandatory();
                    }
                }
                for (CollateralTaxonomy t : all) {
                    if (t.getCategory() != null && isCategoryMatch(t.getCategory(), normCat)
                            && t.getSubCategory() != null && isSubCategoryMatch(t.getSubCategory(), normType)) {
                        return t.isInsuranceMandatory();
                    }
                }
            }

            List<CollateralTaxonomy> catTax = collateralTaxonomyRepository.findByCategoryIgnoreCase(category);
            if (!catTax.isEmpty()) {
                return catTax.stream().anyMatch(CollateralTaxonomy::isInsuranceMandatory);
            }
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    public String getMandatoryCoverageType(String category, String type) {
        if (category == null || category.isBlank()) return null;
        try {
            List<CollateralTaxonomy> all = collateralTaxonomyRepository.findAll();
            String normCat = category.trim().toLowerCase(Locale.ROOT);
            String normType = type != null ? type.trim().toLowerCase(Locale.ROOT) : "";

            if (!normType.isBlank()) {
                for (CollateralTaxonomy t : all) {
                    if (t.getCategory() != null && isCategoryMatch(t.getCategory(), normCat)
                            && t.getSubCategory() != null && isSubCategoryMatch(t.getSubCategory(), normType)) {
                        if (t.getMandatoryCoverageType() != null && !t.getMandatoryCoverageType().isBlank()) {
                            return t.getMandatoryCoverageType();
                        }
                    }
                }
            }
            for (CollateralTaxonomy t : all) {
                if (t.getCategory() != null && isCategoryMatch(t.getCategory(), normCat)) {
                    if (t.getMandatoryCoverageType() != null && !t.getMandatoryCoverageType().isBlank()) {
                        return t.getMandatoryCoverageType();
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean isApprovedInsurer(String insurerName) {
        String pIns = insurerName.trim().toLowerCase(Locale.ROOT);
        return approvedInsurerRepository.findByNameIgnoreCase(insurerName.trim())
                .map(ApprovedInsurer::isActive)
                .orElseGet(() -> approvedInsurerRepository.findAll().stream().anyMatch(i ->
                        i.isActive() && (
                                i.getName().equalsIgnoreCase(insurerName.trim()) ||
                                pIns.contains(i.getName().toLowerCase().replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim()) ||
                                i.getName().toLowerCase().contains(pIns.replace(" company", "").replace(" s.c.", "").replace(" plc", "").trim())
                        )
                ));
    }

    private void validatePolicyDates(InsurancePolicy policy, Collateral collateral, InsuranceComplianceDto dto) {
        if (policy.getEffectiveDate() == null || policy.getEffectiveDate().isBlank() ||
            policy.getExpiryDate() == null || policy.getExpiryDate().isBlank()) {
            dto.setPolicyValidityStatus("MISSING_DATES");
            dto.getValidationErrors().add("Effective Date and Expiry Date are mandatory.");
            return;
        }

        LocalDate eff = parseDate(policy.getEffectiveDate());
        LocalDate exp = parseDate(policy.getExpiryDate());

        if (eff == null || exp == null) {
            dto.setPolicyValidityStatus("INVALID_RANGE");
            dto.getValidationErrors().add("Policy dates must be in valid YYYY-MM-DD format.");
            return;
        }

        if (!exp.isAfter(eff)) {
            dto.setPolicyValidityStatus("INVALID_RANGE");
            dto.getValidationErrors().add("Policy expiry date must be strictly after the effective date.");
            return;
        }

        if (exp.isBefore(LocalDate.now())) {
            dto.setPolicyValidityStatus("EXPIRED");
            dto.getValidationErrors().add("Policy is expired (Expiry date: " + exp + "). Expired policies cannot be activated.");
            return;
        }

        // Validity tenor check:
        // Short-term merchandise/shipment facility check
        boolean shortTermFacility = isShortTermMerchandiseFacility(collateral);
        if (shortTermFacility) {
            LocalDate requiredLoanExpiry = findEarliestLoanExpiry(collateral);
            if (requiredLoanExpiry != null && exp.isBefore(requiredLoanExpiry)) {
                dto.setPolicyValidityStatus("INSUFFICIENT_TERM");
                dto.getValidationErrors().add(String.format(
                        "Policy expiry date (%s) must cover the linked short-term facility tenor through %s.",
                        exp, requiredLoanExpiry));
                return;
            }
        } else {
            long days = ChronoUnit.DAYS.between(eff, exp);
            long minDays = configurationService.getMinimumPolicyValidityDays() > 0 ? configurationService.getMinimumPolicyValidityDays() : 365;
            if (days < minDays) {
                dto.setPolicyValidityStatus("INSUFFICIENT_TERM");
                dto.getValidationErrors().add(String.format(
                        "Policy validity period (%d days) is less than the required minimum of %d days (1 year).",
                        days, minDays));
                return;
            }
        }

        dto.setPolicyValidityStatus("VALID");
    }

    private void validateDuplicates(InsurancePolicy policy, Collateral collateral, InsuranceComplianceDto dto) {
        if (policy.getPolicyNumber() == null || policy.getPolicyNumber().isBlank()) {
            dto.getValidationErrors().add("Policy number is mandatory.");
            return;
        }

        List<InsurancePolicy> existingPolicies = insurancePolicyRepository.findAll();
        for (InsurancePolicy p : existingPolicies) {
            if (policy.getId() != null && policy.getId().equalsIgnoreCase(p.getId())) continue;

            // Check duplicate policy number
            if (policy.getPolicyNumber().trim().equalsIgnoreCase(p.getPolicyNumber().trim())) {
                dto.setDuplicateStatus("DUPLICATE_POLICY_NUMBER");
                dto.getValidationErrors().add("A policy with number '" + policy.getPolicyNumber() + "' is already registered in CIMS.");
                return;
            }

            // Exclude historical lifecycle states from duplicate active policy check
            if ("Cancelled".equalsIgnoreCase(p.getStatus()) || "Closed".equalsIgnoreCase(p.getStatus()) ||
                "Rejected".equalsIgnoreCase(p.getStatus()) || "Renewed".equalsIgnoreCase(p.getStatus()) ||
                "Replaced".equalsIgnoreCase(p.getStatus())) {
                continue;
            }

            // Skip if this is explicitly a renewal or replacement of policy p
            if (policy.getRenewedFromPolicyId() != null && (policy.getRenewedFromPolicyId().equalsIgnoreCase(p.getId()) || policy.getRenewedFromPolicyId().equalsIgnoreCase(p.getPolicyNumber()))) {
                continue;
            }
            if (policy.getReplacesPolicyId() != null && (policy.getReplacesPolicyId().equalsIgnoreCase(p.getId()) || policy.getReplacesPolicyId().equalsIgnoreCase(p.getPolicyNumber()))) {
                continue;
            }

            // Check duplicate active policy for same customer, collateral, and insurer
            if (same(policy.getCustomerId(), p.getCustomerId()) &&
                same(policy.getCollateralId(), p.getCollateralId()) &&
                same(policy.getInsurerName(), p.getInsurerName())) {
                dto.setDuplicateStatus("DUPLICATE_ACTIVE_POLICY");
                dto.getValidationErrors().add("An active insurance policy (" + p.getPolicyNumber() + ") already exists for this customer, collateral, and insurer.");
                return;
            }
        }
        dto.setDuplicateStatus("UNIQUE");
    }

    private void validateMandatoryDocuments(Collateral collateral, InsurancePolicy policy, List<Map<String, Object>> attachedDocs, InsuranceComplianceDto dto) {
        List<MandatoryDocumentRule> rules = mandatoryDocumentRuleRepository.findAll();
        List<OwnershipDocument> existingDocs = ownershipDocumentRepository.findAll();
        List<String> missing = new ArrayList<>();

        for (MandatoryDocumentRule rule : rules) {
            if (!rule.isMandatory()) continue;
            if (!categoryMatches(rule.getCollateralCategory(), collateral)) continue;

            boolean satisfied = existingDocs.stream().anyMatch(d -> {
                if (!documentBelongsTo(d, collateral, policy)) return false;
                if ("Rejected".equalsIgnoreCase(d.getVerificationStatus()) || "Archived".equalsIgnoreCase(d.getStatus())) return false;
                boolean typeMatch = docTypeMatches(rule.getDocumentType(), d.getType()) || docTypeMatches(rule.getDocumentType(), d.getName());
                if (!typeMatch) return false;
                return (d.getFileContent() != null && !d.getFileContent().isBlank()) || (d.getDmsRef() != null && !d.getDmsRef().isBlank());
            });

            if (!satisfied && attachedDocs != null) {
                satisfied = attachedDocs.stream().anyMatch(docMap -> {
                    String dt = (String) docMap.getOrDefault("type", docMap.get("docType"));
                    String nm = (String) docMap.getOrDefault("name", docMap.get("fileName"));
                    boolean typeMatch = docTypeMatches(rule.getDocumentType(), dt) || docTypeMatches(rule.getDocumentType(), nm);
                    if (!typeMatch) return false;
                    String content = (String) docMap.getOrDefault("fileContent", docMap.get("fileData"));
                    return content != null && !content.isBlank();
                });
            }

            if (!satisfied) {
                missing.add(rule.getDocumentType());
            }
        }

        if (!missing.isEmpty()) {
            dto.setMandatoryDocumentStatus("MISSING_DOCUMENTS");
            dto.setMissingDocuments(missing);
            dto.getValidationErrors().add("Missing mandatory digital documents for collateral " +
                    (collateral.getCode() != null ? collateral.getCode() : collateral.getId()) + ": " + String.join(", ", missing));
        } else {
            dto.setMandatoryDocumentStatus("SATISFIED");
        }
    }

    private boolean documentBelongsTo(OwnershipDocument d, Collateral collateral, InsurancePolicy policy) {
        if (d == null) return false;
        if (collateral != null) {
            if (same(collateral.getId(), d.getCollateralId()) || same(collateral.getCode(), d.getCollateralId())) return true;
            if (same(collateral.getId(), d.getEntityId()) || same(collateral.getCode(), d.getEntityId())) return true;
        }
        if (policy != null && policy.getId() != null) {
            if (same(policy.getId(), d.getEntityId()) || same(policy.getPolicyNumber(), d.getEntityId())) return true;
        }
        return false;
    }

    private boolean docTypeMatches(String ruleType, String docType) {
        if (ruleType == null || docType == null) return false;
        String a = ruleType.trim().toLowerCase(Locale.ROOT);
        String b = docType.trim().toLowerCase(Locale.ROOT);
        if (a.equals(b)) return true;
        if (a.contains("schedule") && b.contains("schedule")) return true;
        if (a.contains("receipt") && b.contains("receipt")) return true;
        if (a.contains("certificate") && b.contains("certificate")) return true;
        if (a.contains("policy") && b.contains("policy")) return true;
        return a.contains(b) || b.contains(a);
    }

    private boolean categoryMatches(String ruleCategory, Collateral collateral) {
        if (ruleCategory == null || ruleCategory.isBlank()) return true;
        if ("All".equalsIgnoreCase(ruleCategory.trim())) return true;
        return isCategoryMatch(ruleCategory, collateral.getCategory());
    }

    private boolean isShortTermMerchandiseFacility(Collateral collateral) {
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        for (LoanCollateralLink link : links) {
            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (facId != null) {
                Optional<LoanAccount> l = loanAccountRepository.findById(facId)
                        .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(facId));
                if (l.isPresent()) {
                    String ft = l.get().getFacilityType();
                    if (ft != null && (ft.toLowerCase().contains("short") || ft.toLowerCase().contains("merchandise") || ft.toLowerCase().contains("shipment"))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private LocalDate findEarliestLoanExpiry(Collateral collateral) {
        LocalDate earliest = null;
        List<LoanCollateralLink> links = loanCollateralLinkRepository.findByCollateralId(collateral.getId());
        for (LoanCollateralLink link : links) {
            String facId = link.getLoanAccountId() != null ? link.getLoanAccountId() : link.getFacilityId();
            if (facId == null) continue;
            Optional<LoanAccount> l = loanAccountRepository.findById(facId)
                    .or(() -> loanAccountRepository.findFirstByLoanReferenceIgnoreCase(facId));
            if (l.isPresent() && l.get().getLineExpiryDate() != null) {
                LocalDate d = parseDate(l.get().getLineExpiryDate());
                if (d != null && (earliest == null || d.isBefore(earliest))) {
                    earliest = d;
                }
            }
        }
        return earliest;
    }

    public boolean isCoverageTypeCompatible(String policyCoverage, String mandatoryCoverage) {
        if (policyCoverage == null || mandatoryCoverage == null) return false;
        String p = policyCoverage.trim().toLowerCase(Locale.ROOT);
        String m = mandatoryCoverage.trim().toLowerCase(Locale.ROOT);
        if (p.equals(m)) return true;
        if (m.contains("fire") && (p.contains("fire") || p.contains("allied") || p.contains("property") || p.contains("all risk"))) return true;
        if (m.contains("motor") && (p.contains("motor") || p.contains("vehicle") || p.contains("comprehensive"))) return true;
        if (m.contains("machin") && (p.contains("machin") || p.contains("all-risk") || p.contains("all risk") || p.contains("comprehensive"))) return true;
        if (m.contains("merchandise") && (p.contains("fire") || p.contains("burglary") || p.contains("combustion") || p.contains("merchandise") || p.contains("inventory"))) return true;
        if (m.contains("comprehensive") && (p.contains("comprehensive") || p.contains("all risk") || p.contains("all-risk"))) return true;
        return p.contains(m) || m.contains(p);
    }

    private boolean isCategoryMatch(String catA, String catB) {
        if (catA == null || catB == null) return false;
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
        if (subA == null || subB == null) return false;
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

    private boolean same(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.trim().equalsIgnoreCase(b.trim());
    }
}
